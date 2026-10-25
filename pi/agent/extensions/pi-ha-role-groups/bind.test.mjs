import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertRoleGroupCoverage, resolveRolePrimaries } from "./bind.mjs";
import { nextEntries } from "../pi-ha-bootstrap.mjs";

const root = new URL("../../", import.meta.url);
const aliases = JSON.parse(readFileSync(new URL("pi-ext-roles/settings.json", root), "utf8")).modelAliases;
const ha = JSON.parse(readFileSync(new URL("ha-failover.example.json", root), "utf8"));
const roleGroups = JSON.parse(readFileSync(new URL("pi-ha-role-groups.json", root), "utf8")).roleGroups;
const roleModels = {};
for (const role of Object.keys(roleGroups)) {
  const source = readFileSync(new URL(`pi-ext-roles/roles/${role}.md`, root), "utf8");
  roleModels[role] = source.match(/^model:\s*(\S+)\s*$/m)?.[1];
}

test("every configured role primary resolves into its bound HA group", () => {
  const primaries = resolveRolePrimaries({ roleModels, aliases });
  assert.deepEqual(assertRoleGroupCoverage({ primaries, roleGroups, groups: ha.groups }), []);
});

test("bootstrap returns configured fallbacks and stays empty for unknown models", () => {
  const primaries = resolveRolePrimaries({ roleModels, aliases });
  for (const [role, primary] of Object.entries(primaries)) {
    assert.ok(nextEntries(ha, primary.model, roleGroups[role]).length > 0, `${role} must have a bootstrap fallback`);
  }
  assert.deepEqual(nextEntries(ha, "unknown/provider-model"), []);
});

console.log("HA role-group checks passed");
