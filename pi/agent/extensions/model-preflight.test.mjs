import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import modelPreflight, {
  DEFAULT_HA_CONFIG_PATH,
  DEFAULT_REFRESH_MS,
  getTimeoutMs,
  applyMatrixToConfig,
  applyMatrixToHaConfig,
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
        { route: "anthropic/primary:high", id: "anthropic/primary:high", provider: "anthropic", model: "primary", effort: "high", state: "unavailable" },
        { route: "anthropic/model:high", id: "anthropic/model:high", provider: "anthropic", model: "model", effort: "high", state: "reachable" },
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

test("the default-loadable adapter re-exports the tested implementation", async () => {
  const loader = await import("./model-preflight.js");
  assert.equal(loader.default, modelPreflight);
  assert.equal(loader.runPreflightCommand, runPreflightCommand);
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
  assert.throws(() => parsePreflightOutput("not-json"), /malformed JSON/);
  assert.throws(
    () => parsePreflightOutput(JSON.stringify({ probe: { status: "ok" }, matrix: { development: { state: "ready", entries: [{ route: 42, id: "bad", state: "reachable" }] } } })),
    /invalid failover route/,
  );
  assert.throws(
    () => parsePreflightOutput(JSON.stringify({ ...report, matrix: { development: { ...report.matrix.development, selected: { ...report.matrix.development.selected, effort: "bogus" } } } })),
    /invalid selected route/,
  );
});

test("accepts producer-shaped matrix entries without redacted ids", () => {
  const producerReport = structuredClone(report);
  for (const group of Object.values(producerReport.matrix)) {
    for (const entry of group.entries) delete entry.id;
    delete group.selected.id;
  }
  assert.deepEqual(parsePreflightOutput(JSON.stringify(producerReport)), producerReport);
  assert.equal(chooseFallback(producerReport, "anthropic/primary").route, "anthropic/model:high");
});

test("applies reachable matrix routes without changing credentials or other HA settings", () => {
  const config = {
    defaultGroup: "development",
    credentials: { cliproxyapi: { primary: { refresh: "secret" } } },
    errorHandling: { maxRetriesPerTurn: 2 },
    groups: {
      development: { name: "old", entries: [{ id: "old/model" }] },
      legacy: { name: "legacy", entries: [{ id: "legacy/model" }] },
    },
  };
  const updated = applyMatrixToConfig(config, report);
  assert.deepEqual(updated.groups.development.entries, [{ id: "anthropic/model:high" }]);
  assert.deepEqual(updated.groups.legacy, config.groups.legacy);
  assert.equal(updated.groups.development.name, "old");
  assert.deepEqual(updated.credentials, config.credentials);
  assert.deepEqual(updated.errorHandling, config.errorHandling);
  assert.equal(updated.defaultGroup, "development");
});

test("refuses to apply blocked groups", () => {
  assert.throws(
    () => applyMatrixToConfig({ groups: {} }, { ...report, matrix: { development: { state: "blocked", entries: [] } } }),
    /blocked failover group/,
  );
});

test("the explicit apply command refreshes and atomically preserves the live HA config", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-model-preflight-apply-"));
  const configPath = join(root, "ha.json");
  const original = {
    defaultGroup: "development",
    credentials: { cliproxyapi: { primary: { refresh: "secret" } } },
    groups: { development: { name: "old", entries: [{ id: "old/model" }] } },
  };
  writeFileSync(configPath, `${JSON.stringify(original)}\n`);
  let released = false;
  const lockImpl = { lock: async () => async () => { released = true; } };
  let reloaded = false;
  const pi = fakePi();
  modelPreflight(pi, {
    now: () => Date.parse("2026-10-22T00:14:00.000Z"),
    haConfigPath: configPath,
    lockImpl,
    runCommand: async () => report,
  });
  await pi.commands.get("model-preflight").handler("apply", {
    ...ctx(),
    ui: { notify() {} },
    reload: async () => { reloaded = true; },
  });
  const updated = JSON.parse(readFileSync(configPath, "utf8"));
  assert.deepEqual(updated.groups.development.entries, [{ id: "anthropic/model:high" }]);
  assert.deepEqual(updated.credentials, original.credentials);
  assert.equal(reloaded, true);
  assert.equal(released, true);
});

test("unknown evidence leaves the HA config untouched", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-model-preflight-no-apply-"));
  const configPath = join(root, "ha.json");
  const original = JSON.stringify({ credentials: { cliproxyapi: { primary: { refresh: "secret" } } }, groups: {} });
  writeFileSync(configPath, `${original}\n`);
  const pi = fakePi();
  modelPreflight(pi, {
    now: () => Date.parse("2026-10-22T00:14:00.000Z"),
    haConfigPath: configPath,
    lockImpl: { lock: async () => { throw new Error("lock must not be acquired"); } },
    runCommand: async () => ({ ...report, probe: { status: "unknown" } }),
  });
  await pi.commands.get("model-preflight").handler("apply", { ...ctx(), ui: { notify() {} } });
  assert.equal(readFileSync(configPath, "utf8"), `${original}\n`);
});

test("normalizes missing child stdout to the invalid JSON diagnostic", async () => {
  await assert.rejects(
    runPreflightCommand({
      env: { PI_MODEL_PREFLIGHT_SCRIPT: process.execPath },
      execImpl: async () => ({ stdout: null, stderr: "empty preflight" }),
    }),
    /invalid model preflight output: empty output/,
  );
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
  assert.equal(getTimeoutMs("not-a-number"), 35_000);
  assert.equal(getTimeoutMs("999999999"), 300_000);
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
  const root = mkdtempSync(join(tmpdir(), "pi-preflight-directory-"));
  await assert.rejects(
    runPreflightCommand({
      env: { PI_MODEL_PREFLIGHT_SCRIPT: root, HOME: "/missing-home" },
      execImpl: async () => ({ stdout: "{}" }),
    }),
    /unavailable/,
  );
});

test("runPreflightCommand resolves symlinked script path before invoking node (S3)", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-preflight-symlink-"));
  const realScript = join(root, "preflight-real.mjs");
  const linkScript = join(root, "preflight-link.mjs");
  writeFileSync(realScript, "// real script");
  symlinkSync(realScript, linkScript);
  let capturedArgs;
  const value = await runPreflightCommand({
    env: { PI_MODEL_PREFLIGHT_SCRIPT: linkScript, PI_MODEL_PREFLIGHT_CACHE: join(root, "cache.json") },
    refresh: false,
    execImpl: async (...args) => {
      capturedArgs = args;
      return { stdout: JSON.stringify(report) };
    },
  });
  // The first arg to node must be the real path, not the symlink.
  assert.equal(capturedArgs[1][0], realScript, "script arg must be realpath, not symlink");
  assert.deepEqual(value, report);
});

test("applyMatrixToHaConfig rejects a pre-created symlink at the temp path (S9)", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-ha-symlink-"));
  const configPath = join(root, "ha.json");
  const victim = join(root, "victim.txt");
  const originalBytes = `${JSON.stringify({ groups: { development: { name: "x", entries: [{ id: "old" }] } } })}\n`;
  writeFileSync(configPath, originalBytes);
  writeFileSync(victim, "original");
  const suffix = "a1b2c3d4e5f6";
  const temporaryPath = `${configPath}.${suffix}.tmp`;
  symlinkSync(victim, temporaryPath);
  const lockImpl = { lock: async () => async () => {} };

  try {
    await assert.rejects(
      applyMatrixToHaConfig({
        configPath,
        report,
        lockImpl,
        randomBytesImpl: () => Buffer.from(suffix, "hex"),
      }),
      { code: "EEXIST" },
      "atomic HA write must reject a pre-created symlink",
    );
  } finally {
    unlinkSync(temporaryPath);
  }
  assert.equal(readFileSync(victim, "utf8"), "original", "symlink target must remain unchanged");
  assert.equal(readFileSync(configPath, "utf8"), originalBytes, "HA config must remain unchanged");
});

test("applyMatrixToHaConfig keeps HA config owner-only while preserving private mode (S10)", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-ha-mode-"));
  const original = { groups: { development: { name: "old", entries: [{ id: "old" }], state: "ready" } } };
  const lockImpl = { lock: async () => async () => {} };

  const writableConfigPath = join(root, "writable-ha.json");
  writeFileSync(writableConfigPath, `${JSON.stringify(original)}\n`, { mode: 0o644 });
  chmodSync(writableConfigPath, 0o644);
  await applyMatrixToHaConfig({ configPath: writableConfigPath, report, lockImpl });
  assert.equal(statSync(writableConfigPath).mode & 0o777, 0o600, "normal writable config must become owner-only");

  const privateConfigPath = join(root, "private-ha.json");
  writeFileSync(privateConfigPath, `${JSON.stringify(original)}\n`, { mode: 0o400 });
  chmodSync(privateConfigPath, 0o400);
  await applyMatrixToHaConfig({ configPath: privateConfigPath, report, lockImpl });
  assert.equal(statSync(privateConfigPath).mode & 0o777, 0o400, "already-private config must preserve its owner-only mode");
});

test("apply command rolls back HA config atomically when ctx.reload() fails (S11)", async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-ha-rollback-"));
  const configPath = join(root, "ha.json");
  const original = {
    defaultGroup: "development",
    credentials: { cliproxyapi: { primary: { refresh: "secret" } } },
    groups: { development: { name: "old", entries: [{ id: "old/model" }] } },
  };
  const originalBytes = `${JSON.stringify(original)}\n`;
  writeFileSync(configPath, originalBytes);
  let lockCallCount = 0;
  const lockImpl = {
    lock: async () => {
      lockCallCount += 1;
      return async () => {};
    },
  };
  const pi = fakePi();
  modelPreflight(pi, {
    now: () => Date.parse("2026-10-22T00:14:00.000Z"),
    haConfigPath: configPath,
    lockImpl,
    runCommand: async () => report,
  });
  let notified;
  await pi.commands.get("model-preflight").handler("apply", {
    ...ctx(),
    ui: { notify(msg, level) { notified = { msg, level }; } },
    reload: async () => { throw new Error("runtime restart failed"); },
  });
  // The handler catches errors and notifies, so check the notification message.
  assert.match(notified.msg, /rolled back|reload failed|runtime restart failed/, "must report rollback");
  assert.equal(notified.level, "error");
  // The config on disk must be the original bytes (rolled back).
  assert.equal(readFileSync(configPath, "utf8"), originalBytes, "config must be restored to pre-apply state");
  // Lock must have been acquired twice: once for apply, once for rollback.
  assert.ok(lockCallCount >= 2, `expected at least 2 lock acquisitions, got ${lockCallCount}`);
});

console.log("model preflight extension checks passed");
