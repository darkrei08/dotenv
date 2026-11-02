import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const aliases = JSON.parse(readFileSync(new URL("pi/agent/pi-ext-roles/settings.json", root), "utf8")).modelAliases;
const ha = JSON.parse(readFileSync(new URL("pi/agent/ha-failover.example.json", root), "utf8"));

function resolveModel(reference, seen = []) {
  const match = reference.match(/^(.*?)(?::(off|minimal|low|medium|high|xhigh|max))?$/);
  const [, name, effort] = match;
  if (name.includes("/")) return { model: name, effort };
  assert.ok(!seen.includes(name), `Alias cycle: ${[...seen, name].join(" -> ")}`);
  assert.equal(typeof aliases[name], "string", `Missing alias: ${name}`);
  const resolved = resolveModel(aliases[name], [...seen, name]);
  return { model: resolved.model, effort: effort ?? resolved.effort };
}

test("orchestration package is pinned to the reviewed v1.2.6 commit", () => {
  const source = "git:github.com/darkrei08/pi-herdr-orchestration@e8e52d3a358f036f5cb2bcb517b0abe572d3d216";
  const settings = JSON.parse(readFileSync(new URL("pi/agent/settings.json", root), "utf8"));
  assert.ok(settings.packages.includes(source));
  assert.ok(readFileSync(new URL("pi/agent/pi-packages.txt", root), "utf8").split("\n").includes(source));
});

test("managed aliases, roles and GGA resolve to the configured model matrix", () => {
  const expected = {
    "developer-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "tests-expert": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "reviewer-model": { model: "cliproxyapi/gpt-6-sol", effort: "high" },
    "architect-model": { model: "cliproxyapi/gpt-6-sol", effort: "high" },
    "security-model": { model: "cliproxyapi/gpt-6-sol", effort: "high" },
    "oracle-model": { model: "cliproxyapi/gpt-6-sol", effort: "high" },
    "debugger-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "verifier-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "qa-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "release-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "sre-model": { model: "cliproxyapi/gpt-5.6-luna", effort: "high" },
    "researcher-model": { model: "cliproxyapi/gemini-3.8-flash-high", effort: "medium" },
    "scout-model": { model: "cliproxyapi/gemini-3.8-flash-high", effort: "medium" },
    "market-researcher-model": { model: "cliproxyapi/gemini-3.8-flash-high", effort: "medium" },
    "marketing-strategist-model": { model: "cliproxyapi/gemini-3.8-flash-high", effort: "medium" },
    "summarizer-model": { model: "cliproxyapi/gemini-3.5-flash-lite", effort: "low" }
  };
  assert.deepEqual(Object.keys(aliases).sort(), Object.keys(expected).sort(), "alias key set must match the pinned matrix exactly");
  assert.deepEqual(JSON.parse(readFileSync(new URL("pi/agent/settings.json", root), "utf8")).defaultTools, ["+tool_search"]);
  for (const [name, expectedModel] of Object.entries(expected)) {
    assert.deepEqual(resolveModel(name), expectedModel, `${name}: unexpected route`);
  }
  const roles = new URL("pi/agent/pi-ext-roles/roles/", root);
  for (const name of readdirSync(roles).filter((name) => name.endsWith(".md"))) {
    const content = readFileSync(new URL(name, roles), "utf8");
    const model = content.match(/^model:\s*(\S+)\s*$/m)?.[1];
    assert.ok(model, `${name}: missing model declaration`);
    assert.ok(["off", "low", "medium", "high", "xhigh"].includes(resolveModel(model).effort), `${name}: unsupported effort`);
  }
  const gga = readFileSync(new URL(".gga", root), "utf8").match(/^PROVIDER="kilo:([^"]+)"$/m)?.[1];
  assert.ok(gga, "GGA must keep its Pi bridge provider");
  const ggaRoute = resolveModel(gga);
  assert.deepEqual(ggaRoute, { model: "cliproxyapi/gpt-6-luna", effort: "high" }, "GGA must use the direct development route");
  assert.ok(ha.groups.development.entries.some((entry) => entry.id === `${ggaRoute.model}:${ggaRoute.effort}`), "GGA must use the exact development HA route");
});

test("configuration checker accepts the matrix and rejects mismatched GGA effort without writes", () => {
  const fixture = mkdtempSync(join(tmpdir(), "pi-medium-policy-"));
  try {
    for (const file of ["check-config.sh", "setup_env.sh", ".gga", "pi/agent", "agents/gga-pi", "agents/skills.manifest.json"]) {
      cpSync(new URL(file, root), join(fixture, file), { recursive: true });
    }
    const run = () => spawnSync("bash", [join(fixture, "check-config.sh")], {
      encoding: "utf8",
      env: { ...process.env, PI_CODING_AGENT_DIR: join(fixture, "pi/agent") },
      timeout: 10000,
    });
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.equal(valid.stderr, "");
    assert.equal(valid.stdout, `config check passed: ${fixture}/pi/agent/settings.json and ${fixture}/setup_env.sh\n`);

    // Verify distinct source vs live behavior: live may have different subagent models or packages,
    // but as long as modelAliases/tools/extensions and package source/extensions match the checker rules,
    // it passes. Then verify that actual alias/thinking drift between source and live fails.
    const liveDir = mkdtempSync(join(tmpdir(), "pi-live-fixture-"));
    cpSync(join(fixture, "pi/agent"), liveDir, { recursive: true });
    const runDistinct = () => spawnSync("bash", [join(fixture, "check-config.sh")], {
      encoding: "utf8",
      env: { ...process.env, PI_CODING_AGENT_DIR: liveDir },
      timeout: 10000,
    });
    const distinctResult = runDistinct();
    assert.equal(distinctResult.status, 0, distinctResult.stdout + distinctResult.stderr);

    const piSkillsDir = join(fixture, "pi/agent/skills");
    mkdirSync(piSkillsDir, { recursive: true });
    symlinkSync(join(fixture, ".agents/skills/project-memory"), join(piSkillsDir, "project-memory"), "dir");
    const danglingCollision = spawnSync("bash", [join(fixture, "check-config.sh")], {
      encoding: "utf8",
      env: { ...process.env, HOME: fixture, PI_CODING_AGENT_DIR: join(fixture, "pi/agent") },
      timeout: 10000,
    });
    assert.equal(danglingCollision.status, 1);
    assert.match(danglingCollision.stdout, /skill\(s\) exist in the Pi-local root/);
    rmSync(join(piSkillsDir, "project-memory"), { force: true });

    // Mutate live alias effort: check-config must fail when live diverges from canonical
    const liveAliasesPath = join(liveDir, "pi-ext-roles/settings.json");
    const liveAliases = JSON.parse(readFileSync(liveAliasesPath, "utf8"));
    liveAliases.modelAliases["reviewer-model"] = "cliproxyapi/gpt-5.6-luna:medium";
    writeFileSync(liveAliasesPath, JSON.stringify(liveAliases, null, 2));
    const driftedResult = runDistinct();
    assert.equal(driftedResult.status, 1);
    assert.match(driftedResult.stdout, /canonical modelAliases\/tools\/extensions differ/);
    rmSync(liveDir, { recursive: true, force: true });

    const haPath = join(fixture, "pi/agent/ha-failover.example.json");
    const haBefore = readFileSync(haPath, "utf8");
    const haMismatch = JSON.parse(haBefore);
    haMismatch.groups.reviewer.entries[0].id = "cliproxyapi/gpt-5.6-luna:high";
    writeFileSync(haPath, JSON.stringify(haMismatch, null, 2));
    const routeMismatch = run();
    assert.equal(routeMismatch.status, 1);
    assert.equal(routeMismatch.stderr, "oracle: primary cliproxyapi/gpt-6-sol is absent from HA group reviewer\nreviewer: primary cliproxyapi/gpt-6-sol is absent from HA group reviewer\narchitect: primary cliproxyapi/gpt-6-sol is absent from HA group reviewer\nsecurity: primary cliproxyapi/gpt-6-sol is absent from HA group reviewer\n");
    assert.equal(routeMismatch.stdout, `${fixture}/pi/agent/ha-failover.example.json: configured role primaries must be covered by their HA groups\n`);
    writeFileSync(haPath, haBefore);

    const ggaPath = join(fixture, ".gga");
    const rejected = readFileSync(ggaPath, "utf8").replace(/gpt-6-luna:high/, "gpt-6-luna:medium");
    writeFileSync(ggaPath, rejected);
    const settingsPath = join(fixture, "pi/agent/settings.json");
    const aliasesPath = join(fixture, "pi/agent/pi-ext-roles/settings.json");
    const settingsBefore = readFileSync(settingsPath, "utf8");
    const aliasesBefore = readFileSync(aliasesPath, "utf8");
    const invalid = run();
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stderr, "");
    assert.equal(invalid.stdout, `${fixture}/pi/agent/settings.json: GGA reviewer model/effort must be enabled (found: cliproxyapi/gpt-6-luna:medium)\n${fixture}/.gga: GGA route must use the configured direct route (expected: kilo:cliproxyapi/gpt-6-luna:high, found: kilo:cliproxyapi/gpt-6-luna:medium)\n${fixture}/.gga: GGA route must be listed in the development HA group (found: kilo:cliproxyapi/gpt-6-luna:medium)\n`);
    assert.equal(readFileSync(ggaPath, "utf8"), rejected);
    assert.equal(readFileSync(settingsPath, "utf8"), settingsBefore);
    assert.equal(readFileSync(aliasesPath, "utf8"), aliasesBefore);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
