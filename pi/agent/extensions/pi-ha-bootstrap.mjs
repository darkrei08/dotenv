import { normalizeModelId } from "./pi-ha-role-groups/bind.mjs";

export function nextEntries(config, currentModel, groupId) {
  const current = normalizeModelId(currentModel);
  if (!current) return [];
  const groups = groupId == null
    ? Object.values(config?.groups ?? {}).filter((group) =>
      (group?.entries ?? []).some((entry) => normalizeModelId(entry?.id) === current))
    : [config?.groups?.[groupId]];
  if (groups.length !== 1) return [];
  const entries = groups[0]?.entries ?? [];
  const index = entries.findIndex((entry) => normalizeModelId(entry?.id) === current);
  return index >= 0 ? entries.slice(index + 1) : [];
}
