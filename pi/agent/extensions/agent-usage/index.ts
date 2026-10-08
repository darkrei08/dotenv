import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

const AGENTS = ["pi", "codex", "claude"];
const PERIODS = ["daily", "weekly", "monthly", "session"];

// `/agent-usage [pi|codex|claude] [daily|weekly|monthly|session]` -> ccusage argv.
export function usageArgs(input: string): string[] {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const agent = words.find((w) => AGENTS.includes(w));
  const period = words.find((w) => PERIODS.includes(w)) ?? "daily";
  return agent ? [agent, period] : [period];
}

// ccusage reads the local session logs of Pi, Codex and Claude Code. Its cost is the
// API-equivalent price, not the plan quota: gentle-pi's footer says "no subscription
// usage for this provider" for cliproxyapi, whose quota lives in the CPA Usage Keeper.
export default function (pi: ExtensionAPI) {
  pi.registerCommand("agent-usage", {
    description: "Local token/cost usage of Pi, Codex and Claude Code (ccusage)",
    handler: async (args, ctx) => {
      execFile("ccusage", usageArgs(args), { encoding: "utf8", timeout: 120_000 }, (error, stdout) => {
        const note = "\nPlan quota via CLIProxyAPI: CPA Usage Keeper, http://127.0.0.1:8080";
        ctx.ui.notify(error ? `ccusage failed: ${error.message}` : stdout.trimEnd() + note, error ? "error" : "info");
      });
    },
  });
}
