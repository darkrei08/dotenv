import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relativePath) => JSON.parse(await readFile(join(root, relativePath), "utf8"));

const workflow = await readJson("pi/agent/pi-extensible-workflows/settings.json");
const roles = await readJson("pi/agent/pi-ext-roles/settings.json");
const models = await readJson("pi/agent/models.json");
const ha = await readJson("pi/agent/ha-failover.example.json");
const roleGroups = await readJson("pi/agent/pi-ha-role-groups.json");
const workflowAliases = workflow.modelAliases ?? {};
const roleAliases = roles.modelAliases ?? {};
const efforts = "off|minimal|low|medium|high|xhigh|max";
const routePattern = new RegExp(`^([^/\\s]+)\\/([^:\\s]+)(?::(${efforts}))?$`);
const legacyAliasNames = new Set([
  "cheap-model",
  "cheap-model-ant",
  "claude-developer-model",
  "old-reviewer-model",
  "gemini-flash-low",
  "gemini-flash-medium",
  "gemini-flash-high",
  "gemini-pro-low",
  "gemini-pro-high",
  "opencode-fast",
  "opencode-balanced",
  "opencode-flash-max",
  "opencode-deep",
]);
const opencodeCanonicalSpecs = new Set([
  "opencode-go/deepseek-v4.1-flash:low",
  "opencode-go/deepseek-v4.1-flash:medium",
  "opencode-go/deepseek-v4.1-flash:max",
  "opencode-go/deepseek-v4-pro:high",
]);

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

function resolveAlias(reference, aliases, seen = []) {
  if (routePattern.test(reference)) return reference;
  assert.equal(typeof aliases[reference], "string", `missing model alias: ${reference}`);
  assert.ok(!seen.includes(reference), `model alias cycle: ${[...seen, reference].join(" -> ")}`);
  return resolveAlias(aliases[reference], aliases, [...seen, reference]);
}

function modelId(reference) {
  return reference.replace(/:(?:off|minimal|low|medium|high|xhigh|max)$/, "");
}

const providers = new Set(Object.keys(models.providers ?? {}));
for (const source of [roles, ha]) {
  for (const value of collectStrings(source)) {
    const provider = routeProvider(value);
    if (provider) providers.add(provider);
  }
}
// The tracked HA example has no OpenCode entry, but the requested legacy routes are catalog-verified.
for (const spec of opencodeCanonicalSpecs) providers.add(routeProvider(spec));

const canonicalRoleSpecs = new Set(
  Object.entries(roleAliases)
    .filter(([name]) => !legacyAliasNames.has(name))
    .map(([, value]) => resolveAlias(value, roleAliases)),
);


test("workflow aliases match non-legacy pi-ext-roles aliases", () => {
  for (const [name, value] of Object.entries(roleAliases)) {
    if (legacyAliasNames.has(name)) continue;
    assert.equal(workflowAliases[name], value, `${name} drifted from pi-ext-roles`);
  }
});

test("workflow alias values are provider/model routes with supported efforts", () => {
  for (const [name, value] of Object.entries(workflowAliases)) {
    const match = routePattern.exec(value);
    assert.ok(match, `${name} has invalid route: ${value}`);
    assert.ok(providers.has(match[1]), `${name} uses an unreferenced provider: ${match[1]}`);
  }
});

test("legacy aliases point to canonical role or verified OpenCode specs", () => {
  const canonicalSpecs = new Set([...canonicalRoleSpecs, ...opencodeCanonicalSpecs]);
  for (const name of legacyAliasNames) {
    assert.ok(name in workflowAliases, `missing legacy alias: ${name}`);
    assert.ok(canonicalSpecs.has(workflowAliases[name]), `${name} has an orphan spec: ${workflowAliases[name]}`);
  }
});

test("role primaries are covered by their bound HA groups", () => {
  for (const [role, groupId] of Object.entries(roleGroups.roleGroups ?? {})) {
    const aliasName = role === "tests-expert" ? role : `${role}-model`;
    const primary = modelId(resolveAlias(roleAliases[aliasName], roleAliases));
    const group = ha.groups?.[groupId];
    assert.ok(group, `${role} binds to missing HA group: ${groupId}`);
    assert.ok(
      group.entries?.some((entry) => modelId(entry.id) === primary),
      `${role} primary ${primary} is absent from HA group ${groupId}`,
    );
  }
});
