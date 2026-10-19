import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./pi-ha", import.meta.url));

function fixture(t, config) {
  const home = mkdtempSync(join(tmpdir(), "dotenv-pi-ha-"));
  const configPath = join(home, "ha.json");
  if (config !== undefined) writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { configPath };
}

function run(configPath) {
  return spawnSync(script, ["--json", "ensure"], {
    encoding: "utf8",
    env: { ...process.env, PI_HA_CONFIG: configPath },
  });
}

test("ensure creates the tracked matrix when the live config is missing", (t) => {
  const paths = fixture(t);
  const result = run(paths.configPath);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(readFileSync(paths.configPath, "utf8"));
  assert.equal(config.defaultGroup, "development");
  assert.equal(JSON.parse(result.stdout).activeGroup, "development");
  assert.ok(config.groups.development);
  assert.ok(config.groups.testing);
  assert.deepEqual(JSON.parse(result.stdout).groups.development, config.groups.development.entries.map((entry) => entry.id));
});

test("ensure preserves credentials, active state, custom groups, and default group", (t) => {
  const original = {
    credentials: { provider: "keep-me" },
    activeGroup: "custom",
    defaultGroup: "custom",
    groups: {
      custom: { name: "Custom", entries: [{ id: "custom/model" }] },
      development: { name: "My development", entries: [{ id: "custom/development" }] },
    },
  };
  const paths = fixture(t, original);
  const result = run(paths.configPath);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(readFileSync(paths.configPath, "utf8"));
  assert.deepEqual(config.credentials, original.credentials);
  assert.equal(config.activeGroup, original.activeGroup);
  assert.equal(config.defaultGroup, original.defaultGroup);
  assert.deepEqual(config.groups.custom, original.groups.custom);
  assert.deepEqual(config.groups.development, original.groups.development);
  assert.ok(config.groups.scout);
});

test("ensure is byte-for-byte idempotent after the first merge", (t) => {
  const paths = fixture(t, { groups: { custom: { entries: [{ id: "custom/model" }] } } });
  const first = run(paths.configPath);
  assert.equal(first.status, 0, first.stderr);
  const afterFirst = readFileSync(paths.configPath, "utf8");
  const second = run(paths.configPath);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(paths.configPath, "utf8"), afterFirst);
});
