import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { bindHaGroup } from "./bind.ts";

export default function (pi: ExtensionAPI) {
  bindHaGroup(pi, "research");
}
