const EFFORTS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

export function normalizeModelId(value) {
  const raw = String(value ?? "").trim();
  const suffix = raw.lastIndexOf(":");
  return suffix > raw.indexOf("/") && EFFORTS.has(raw.slice(suffix + 1)) ? raw.slice(0, suffix) : raw;
}

export function resolveAlias(reference, aliases, seen = []) {
  const raw = String(reference ?? "").trim();
  const suffix = raw.lastIndexOf(":");
  const name = suffix > raw.indexOf("/") && EFFORTS.has(raw.slice(suffix + 1)) ? raw.slice(0, suffix) : raw;
  const effort = suffix > raw.indexOf("/") && EFFORTS.has(raw.slice(suffix + 1)) ? raw.slice(suffix + 1) : null;
  if (name.includes("/")) return { model: name, effort };
  if (seen.includes(name)) throw new Error(`model alias cycle: ${[...seen, name].join(" -> ")}`);
  if (typeof aliases?.[name] !== "string") throw new Error(`missing model alias: ${name}`);
  const resolved = resolveAlias(aliases[name], aliases, [...seen, name]);
  return { model: resolved.model, effort: effort ?? resolved.effort };
}

export function resolveRolePrimaries({ roleModels, aliases }) {
  return Object.fromEntries(Object.entries(roleModels).map(([role, reference]) => [role, resolveAlias(reference, aliases)]));
}

export function assertRoleGroupCoverage({ primaries, roleGroups, groups }) {
  const failures = [];
  for (const [role, primary] of Object.entries(primaries)) {
    const groupId = roleGroups?.[role];
    const group = groups?.[groupId];
    if (!group) {
      failures.push(`${role}: bound HA group is missing: ${groupId ?? "none"}`);
      continue;
    }
    const covered = (group.entries ?? []).some((entry) => normalizeModelId(entry?.id) === primary.model);
    if (!covered) failures.push(`${role}: primary ${primary.model} is absent from HA group ${groupId}`);
  }
  return failures;
}
