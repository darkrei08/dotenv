import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await readFile(join(root, relativePath), "utf8"));

const workflow = await readJson("pi/agent/pi-extensible-workflows/settings.json");
const roles = await readJson("pi/agent/pi-ext-roles/settings.json");
const ha = await readJson("pi/agent/ha-failover.example.json");
const roleGroups = await readJson("pi/agent/pi-ha-role-groups.json");
const workflowAliases = workflow.modelAliases ?? {};
const roleAliases = roles.modelAliases ?? {};
const efforts = "off|minimal|low|medium|high|xhigh|max";
const routePattern = new RegExp(`^([^/\\s]+)\\/([^:\\s]+)(?::(${efforts}))?$`);
const effortSuffix = new RegExp(`:(?:${efforts})$`);
// Providers the tracked matrix may route to. OpenCode Go carries only the operator-approved
// DeepSeek routes; OpenAI, Antigravity and Claude stay behind CLIProxyAPI.
const allowedProviders = new Set(["anthropic", "cliproxyapi", "openai-codex", "opencode-go"]);

function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function routeProvider(value) {
  const match = typeof value === "string" ? value.match(routePattern) : null;
  return match?.[1];
}

function modelId(reference) {
  return reference.replace(effortSuffix, "");
}

function resolveAlias(reference, aliases, seen = []) {
  if (routePattern.test(reference)) return reference;
  assert.equal(typeof aliases[reference], "string", `missing model alias: ${reference}`);
  assert.ok(!seen.includes(reference), `model alias cycle: ${[...seen, reference].join(" -> ")}`);
  return resolveAlias(aliases[reference], aliases, [...seen, reference]);
}

test("workflow aliases are exactly the pi-ext-roles aliases", () => {
  assert.deepEqual(Object.keys(workflowAliases).sort(), Object.keys(roleAliases).sort());
  for (const [name, value] of Object.entries(roleAliases)) {
    assert.equal(workflowAliases[name], value, `${name} drifted from pi-ext-roles`);
  }
});

test("workflow alias values are provider/model routes with supported efforts", () => {
  for (const [name, value] of Object.entries(workflowAliases)) {
    const match = routePattern.exec(value);
    assert.ok(match, `${name} has invalid route: ${value}`);
    assert.ok(allowedProviders.has(match[1]), `${name} uses an unlisted provider: ${match[1]}`);
  }
});

test("HA entries are bare provider/model ids", () => {
  // The HA extension resolves an entry id by exact registry id, so a :effort suffix never matches.
  for (const group of Object.values(ha.groups ?? {})) {
    for (const entry of group.entries ?? []) {
      assert.match(entry.id, /^[^/\s]+\/[^:\s]+$/, `${group.name}: HA entry must be a bare provider/model id: ${entry.id}`);
    }
  }
});

test("only the approved providers are routed to", () => {
  for (const source of [workflowAliases, ha]) {
    for (const value of collectStrings(source)) {
      const provider = routeProvider(value);
      if (provider) assert.ok(allowedProviders.has(provider), `unexpected provider in ${value}`);
    }
  }
});

test("OpenCode Go routes carry DeepSeek models only", () => {
  for (const source of [workflowAliases, ha]) {
    for (const value of collectStrings(source)) {
      const match = routePattern.exec(value);
      if (match?.[1] !== "opencode-go") continue;
      assert.match(match[2], /^deepseek-/, `OpenCode Go route is not a DeepSeek model: ${value}`);
    }
  }
});

test("role primaries are covered by their bound HA groups", () => {
  for (const [role, groupId] of Object.entries(roleGroups.roleGroups ?? {})) {
    const aliasName = role === "tests-expert" ? role : `${role}-model`;
    const primary = modelId(resolveAlias(roleAliases[aliasName], roleAliases));
    const group = ha.groups?.[groupId];
    assert.ok(group, `${role} binds to missing HA group: ${groupId}`);
    assert.ok(
      group.entries?.some((entry) => entry.id === primary),
      `${role} primary ${primary} is absent from HA group ${groupId}`,
    );
  }
});
