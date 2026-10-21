import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const aliases = JSON.parse(readFileSync(new URL("pi/agent/pi-ext-roles/settings.json", root), "utf8")).modelAliases;

function resolveModel(reference, seen = []) {
  const match = reference.match(/^(.*?)(?::(off|minimal|low|medium|high|xhigh|max))?$/);
  const [, name, effort] = match;
  if (name.includes("/")) return { model: name, effort };
  assert.ok(!seen.includes(name), `Alias cycle: ${[...seen, name].join(" -> ")}`);
  assert.equal(typeof aliases[name], "string", `Missing alias: ${name}`);
  const resolved = resolveModel(aliases[name], [...seen, name]);
  return { model: resolved.model, effort: effort ?? resolved.effort };
}

test("managed aliases, roles and GGA resolve to medium effort", () => {
  const assignments = Object.keys(aliases).map((name) => [name, resolveModel(name)]);
  const roles = new URL("pi/agent/pi-ext-roles/roles/", root);
  for (const name of readdirSync(roles).filter((name) => name.endsWith(".md"))) {
    const content = readFileSync(new URL(name, roles), "utf8");
    const model = content.match(/^model:\s*(\S+)\s*$/m)?.[1];
    assert.ok(model, `${name}: missing model declaration`);
    assignments.push([`role:${name}`, resolveModel(model)]);
  }
  const gga = readFileSync(new URL(".gga", root), "utf8").match(/^PROVIDER="kilo:([^"]+)"$/m)?.[1];
  assert.ok(gga, "GGA must keep its Pi bridge provider");
  const reviewer = resolveModel("reviewer-model");
  const reviewGate = resolveModel(gga);
  assert.deepEqual(reviewGate, reviewer, "GGA and the reviewer role must use the same model and effort");
  assignments.push(["GGA", reviewGate]);
  const settings = JSON.parse(readFileSync(new URL("pi/agent/settings.json", root), "utf8"));
  assignments.push(["Pi:default", { effort: settings.defaultThinkingLevel }]);
  for (const [model, effort] of Object.entries(settings.modelThinkingLevels)) {
    assignments.push([`Pi:${model}`, { model, effort }]);
  }
  const subagents = JSON.parse(readFileSync(new URL("pi/agent/subagents.json", root), "utf8"));
  assignments.push(["subagents:default", { effort: subagents.default_effort }]);
  for (const [name, profile] of Object.entries(subagents.model_profiles)) {
    assignments.push([`subagents:${name}`, { model: profile.model, effort: profile.effort ?? subagents.default_effort }]);
  }
  const { modes } = JSON.parse(readFileSync(new URL("pi/agent/modes.json", root), "utf8"));
  for (const [name, mode] of Object.entries(modes)) {
    assignments.push([`mode:${name}`, { model: `${mode.provider}/${mode.modelId}`, effort: mode.thinkingLevel }]);
  }
  assert.deepEqual(assignments.filter(([, value]) => value.effort !== "medium"), [], "Only medium effort is permitted");
});

test("configuration checker accepts the policy and still rejects mismatched GGA effort without writes", () => {
  const fixture = mkdtempSync(join(tmpdir(), "pi-medium-policy-"));
  try {
    for (const file of ["check-config.sh", "setup_env.sh", ".gga", "pi/agent", "agents/gga-pi"]) {
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

    // Mutate live alias effort: check-config must fail when live diverges from canonical
    const liveAliasesPath = join(liveDir, "pi-ext-roles/settings.json");
    const liveAliases = JSON.parse(readFileSync(liveAliasesPath, "utf8"));
    liveAliases.modelAliases["cliproxy-reviewer-model"] = "cliproxyapi/claude-opus-5-5:high";
    writeFileSync(liveAliasesPath, JSON.stringify(liveAliases, null, 2));
    const driftedResult = runDistinct();
    assert.equal(driftedResult.status, 1);
    assert.match(driftedResult.stdout, /canonical modelAliases\/tools\/extensions differ/);
    rmSync(liveDir, { recursive: true, force: true });

    const ggaPath = join(fixture, ".gga");
    const rejected = readFileSync(ggaPath, "utf8").replace(/:medium"/, ":high\"");
    writeFileSync(ggaPath, rejected);
    const settingsPath = join(fixture, "pi/agent/settings.json");
    const aliasesPath = join(fixture, "pi/agent/pi-ext-roles/settings.json");
    const settingsBefore = readFileSync(settingsPath, "utf8");
    const aliasesBefore = readFileSync(aliasesPath, "utf8");
    const invalid = run();
    const { model } = resolveModel("reviewer-model");
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stderr, "");
    assert.equal(invalid.stdout, `${ggaPath}: PROVIDER must match the Pi workflow reviewer role (kilo:${model}:medium, found: kilo:${model}:high)\n`);
    assert.equal(readFileSync(ggaPath, "utf8"), rejected);
    assert.equal(readFileSync(settingsPath, "utf8"), settingsBefore);
    assert.equal(readFileSync(aliasesPath, "utf8"), aliasesBefore);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
