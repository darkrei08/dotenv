import assert from "node:assert/strict";
import test from "node:test";
import modelPreflight, {
  DEFAULT_HA_CONFIG_PATH,
  DEFAULT_REFRESH_MS,
  chooseFallback,
  getRefreshIntervalMs,
  isFresh,
  isReady,
  parsePreflightOutput,
  routeKey,
  runPreflightCommand,
} from "./model-preflight.mjs";

const report = {
  generatedAt: "2026-10-22T00:00:00.000Z",
  expiresAt: "2026-10-22T00:15:00.000Z",
  probe: { status: "ok", modelCount: 2 },
  matrix: {
    development: {
      state: "ready",
      selected: { route: "anthropic/model:high", id: "anthropic/model", provider: "anthropic", model: "model", effort: "high", state: "reachable" },
      entries: [
        { route: "anthropic/primary:high", id: "anthropic/primary", provider: "anthropic", model: "primary", effort: "high", state: "unavailable" },
        { route: "anthropic/model:high", id: "anthropic/model", provider: "anthropic", model: "model", effort: "high", state: "reachable" },
      ],
    },
  },
};

function fakePi() {
  const handlers = new Map();
  const commands = new Map();
  const state = { model: null, effort: null };
  return {
    handlers,
    commands,
    state,
    registerCommand(name, command) { commands.set(name, command); },
    on(name, handler) { handlers.set(name, handler); },
    async setModel(model) { state.model = model; return true; },
    setThinkingLevel(effort) { state.effort = effort; },
  };
}

const ctx = (route = "anthropic/primary") => ({
  model: { provider: route.split("/")[0], id: route.split("/")[1] },
  modelRegistry: { find: (provider, model) => ({ provider, id: model }) },
  ui: { notify() {} },
});

test("recognizes fresh ready evidence and rejects stale or unknown evidence", () => {
  assert.equal(isFresh(report, Date.parse("2026-10-22T00:14:59.000Z")), true);
  assert.equal(isFresh(report, Date.parse("2026-10-22T00:15:00.000Z")), false);
  assert.equal(isReady(report, "development"), true);
  assert.equal(isReady({ ...report, probe: { status: "unknown" } }, "development"), false);
  assert.equal(isReady(report, "missing"), false);
});

test("selects a reachable fallback only for a bound, unavailable primary", () => {
  assert.equal(routeKey({ provider: "anthropic", id: "model" }), "anthropic/model");
  assert.equal(chooseFallback(report, "anthropic/primary", "development").route, "anthropic/model:high");
  assert.equal(chooseFallback(report, "unknown/model", "development"), null);
  assert.equal(chooseFallback(report, "anthropic/model", "development"), null);
});

test("parses valid output and rejects malformed output", () => {
  assert.deepEqual(parsePreflightOutput(JSON.stringify(report)), report);
  assert.throws(() => parsePreflightOutput("not-json"), /invalid|Unexpected/);
});

test("uses an explicit preflight script and bounded command", async () => {
  let invocation;
  const value = await runPreflightCommand({
    env: { PI_MODEL_PREFLIGHT_SCRIPT: process.execPath, PI_MODEL_PREFLIGHT_CACHE: "/tmp/preflight.json" },
    refresh: true,
    execImpl: async (...args) => {
      invocation = args;
      return { stdout: JSON.stringify(report) };
    },
  });
  assert.deepEqual(value, report);
  assert.equal(invocation[0], "node");
  assert.deepEqual(invocation[1].slice(1, 4), ["--json", "--refresh", "--cache"]);
  assert.equal(invocation[1][invocation[1].indexOf("--ha-config") + 1], DEFAULT_HA_CONFIG_PATH);
  assert.equal(invocation[2].timeout, 35_000);
});

test("bounds malformed and non-finite refresh intervals to a safe default", () => {
  assert.equal(getRefreshIntervalMs("not-a-number"), DEFAULT_REFRESH_MS);
  assert.equal(getRefreshIntervalMs("Infinity"), DEFAULT_REFRESH_MS);
  assert.equal(getRefreshIntervalMs("0"), DEFAULT_REFRESH_MS);
  assert.equal(getRefreshIntervalMs("1"), 60_000);
  assert.equal(getRefreshIntervalMs(undefined), DEFAULT_REFRESH_MS);
});

test("fails closed before routing when the refreshed report is stale or unbound", async () => {
  const pi = fakePi();
  modelPreflight(pi, {
    now: () => Date.parse("2026-10-22T00:14:00.000Z"),
    runCommand: async () => report,
  });
  await pi.handlers.get("session_start")({}, { ...ctx(), ui: { notify() {} } });
  await assert.rejects(
    pi.handlers.get("before_agent_start")({}, ctx("unknown/model")),
    /not bound to a failover group/,
  );
});

test("rejects stale or unknown refresh output, including concurrent refreshes", async () => {
  const pi = fakePi();
  let calls = 0;
  let release;
  modelPreflight(pi, {
    now: () => Date.parse("2026-10-22T00:14:00.000Z"),
    runCommand: async () => {
      calls += 1;
      return new Promise((resolve) => { release = resolve; });
    },
  });
  const handler = pi.handlers.get("before_agent_start");
  const first = handler({}, ctx());
  const second = handler({}, ctx());
  release({ ...report, probe: { status: "unknown" } });
  await assert.rejects(first, /unavailable|stale|unknown/);
  await assert.rejects(second, /unavailable|stale|unknown/);
  assert.equal(calls, 1);

  const stalePi = fakePi();
  modelPreflight(stalePi, {
    now: () => Date.parse("2026-10-22T00:16:00.000Z"),
    runCommand: async () => report,
  });
  await assert.rejects(stalePi.handlers.get("before_agent_start")({}, ctx()), /unavailable|stale|unknown/);
});

test("fails closed when the preflight launcher is unavailable", async () => {
  await assert.rejects(
    runPreflightCommand({
      env: { PI_MODEL_PREFLIGHT_SCRIPT: "/missing/preflight.mjs", HOME: "/missing-home" },
      execImpl: async () => ({ stdout: "{}" }),
    }),
    /unavailable/,
  );
});

console.log("model preflight extension checks passed");
