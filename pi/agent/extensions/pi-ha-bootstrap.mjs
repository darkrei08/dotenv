import { normalizeModelId } from "./pi-ha-role-groups/bind.mjs";

export function nextEntries(config, currentModel) {
  const current = normalizeModelId(currentModel);
  if (!current) return [];
  for (const group of Object.values(config?.groups ?? {})) {
    const entries = group.entries ?? [];
    const index = entries.findIndex((entry) => normalizeModelId(entry?.id) === current);
    if (index >= 0) return entries.slice(index + 1);
  }
  return [];
}
