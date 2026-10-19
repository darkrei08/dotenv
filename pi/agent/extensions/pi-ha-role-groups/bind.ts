import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Binding {
  group: string;
  active: boolean;
}

const bindings: Binding[] = [];
let initialGroup: string | undefined;

export function bindHaGroup(pi: ExtensionAPI, group: string) {
  if (bindings.length === 0) initialGroup = process.env.PI_HA_GROUP;
  const binding: Binding = { group, active: true };
  bindings.push(binding);
  process.env.PI_HA_GROUP = group;

  pi.on("session_shutdown", () => {
    if (!binding.active) return;
    binding.active = false;
    bindings.splice(bindings.indexOf(binding), 1);

    const activeBinding = bindings.at(-1);
    if (activeBinding) {
      process.env.PI_HA_GROUP = activeBinding.group;
      return;
    }
    if (initialGroup === undefined) delete process.env.PI_HA_GROUP;
    else process.env.PI_HA_GROUP = initialGroup;
    initialGroup = undefined;
  });
}
