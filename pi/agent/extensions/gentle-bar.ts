import * as os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// Owns the footer and renders the gentle-pi shell bar, with the extra segments
// coloured: plan windows by threshold, tool flags per capability. Extension
// statuses from setStatus() are rendered too, in the bar's muted status role.

type Theme = ExtensionContext["ui"]["theme"];

interface FooterData {
  getGitBranch(): string | null;
  getExtensionStatuses(): ReadonlyMap<string, string>;
  onBranchChange(callback: () => void): () => void;
}

interface GoWindow {
  label: string;
  percent: number;
}

interface BarState {
  render?: () => void;
  notify: boolean;
  dirty: number | undefined;
  quota: GoWindow[] | undefined;
}

const BRAND = "✿ gentle-pi";
const SEPARATOR = "⟡";
const GAUGE_CELLS = 8;
const WARN_PERCENT = 50;
const HOT_PERCENT = 80;
const GIT_TIMEOUT_MS = 5000;
const GIT_THROTTLE_MS = 2000;
const COMPACT_BRANCH_WIDTH = 15;

const ASK_TOOL_NAMES = ["questionnaire"];
const SEARCH_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content", "search", "web-search"];

const GO_PROVIDER = "opencode-go";
const GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const GO_REFRESH_MS = 5 * 60_000;
const GO_WINDOWS: ReadonlyArray<[string, string]> = [
  ["rolling", "5h"],
  ["weekly", "week"],
  ["monthly", "month"],
];

interface GoUsagePayload {
  usage?: Record<string, { percent?: number } | undefined>;
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function sanitize(text: string): string {
  return stripAnsi(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

function shortenHome(cwd: string): string {
  const home = os.homedir();
  return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

function shortenPath(cwd: string): string {
  const base = shortenHome(cwd)
    .split(/[\\/]/)
    .filter((part) => part.length > 0)
    .pop();
  return base ?? cwd;
}

function clip(text: string, max: number): string {
  let clipped = "";
  for (const char of text) {
    if (visibleWidth(clipped + char) > max - 1) return `${clipped}…`;
    clipped += char;
  }
  return clipped;
}

function tone(percent: number): "success" | "warning" | "error" {
  if (percent >= HOT_PERCENT) return "error";
  if (percent >= WARN_PERCENT) return "warning";
  return "success";
}

function gauge(theme: Theme, percent: number | null): string {
  if (percent === null) return theme.fg("dim", "▱".repeat(GAUGE_CELLS));
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.max(0, Math.min(GAUGE_CELLS, Math.round((clamped / 100) * GAUGE_CELLS)));
  return theme.fg(tone(clamped), "▰".repeat(filled)) + theme.fg("dim", "▱".repeat(GAUGE_CELLS - filled));
}

function percentText(percent: number | null): string {
  return percent === null ? "?%" : `${Math.round(percent)}%`;
}

function flag(theme: Theme, enabled: boolean, char: string, color: "success" | "accent" | "warning"): string {
  return enabled ? theme.fg(color, char) : theme.fg("dim", char);
}

function activeToolSet(pi: ExtensionAPI): Set<string> {
  try {
    return new Set(pi.getActiveTools().map((name) => name.toLowerCase()));
  } catch {
    return new Set();
  }
}

function availableToolSet(pi: ExtensionAPI): Set<string> {
  try {
    return new Set(pi.getAllTools().map((tool) => tool.name.toLowerCase()));
  } catch {
    return new Set();
  }
}

function hasAny(available: Set<string>, wanted: string[]): boolean {
  return wanted.some((name) => available.has(name));
}

function formatWindowTokens(count: number): string | undefined {
  if (!count) return undefined;
  if (count < 1000) return `${count}`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}K`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

function costLabel(ctx: ExtensionContext): string {
  let total = 0;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
    total += entry.message.usage?.cost?.total ?? 0;
  }
  const amount = total >= 1 ? total.toFixed(2) : total.toFixed(3);
  let subscription = false;
  try {
    subscription = ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false;
  } catch {
    subscription = false;
  }
  return subscription ? `$${amount} sub` : `$${amount}`;
}

function statuses(footerData: FooterData): string[] {
  return Array.from(footerData.getExtensionStatuses().entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, status]) => sanitize(status))
    .filter((status) => status.length > 0);
}

async function fetchGoQuota(ctx: ExtensionContext): Promise<GoWindow[] | undefined> {
  const key = await ctx.modelRegistry.getApiKeyForProvider(GO_PROVIDER).catch(() => undefined);
  if (!key) return undefined;
  const response = await fetch(GO_USAGE_URL, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as GoUsagePayload;
  const usage = payload.usage;
  if (!usage) return undefined;
  const windows: GoWindow[] = [];
  for (const [name, label] of GO_WINDOWS) {
    const window = usage[name];
    if (typeof window?.percent !== "number") continue;
    windows.push({ label, percent: window.percent });
  }
  return windows.length > 0 ? windows : undefined;
}

export default function registerGentleBar(pi: ExtensionAPI): void {
  const state: BarState = { notify: false, dirty: undefined, quota: undefined };
  let lastCtx: ExtensionContext | undefined;
  let quotaFetchedAt = 0;
  let quotaFingerprint: string | undefined;
  let dirtyFetchedAt = 0;

  const refreshQuota = async (ctx: ExtensionContext, force: boolean): Promise<void> => {
    const now = Date.now();
    if (!force && now - quotaFetchedAt < GO_REFRESH_MS) return;
    quotaFetchedAt = now;
    const quota = await fetchGoQuota(ctx).catch(() => undefined);
    if (!quota) return;
    const fingerprint = JSON.stringify(quota);
    if (fingerprint === quotaFingerprint) return;
    quotaFingerprint = fingerprint;
    state.quota = quota;
    state.render?.();
  };

  const refreshDirty = async (ctx: ExtensionContext): Promise<void> => {
    const now = Date.now();
    if (now - dirtyFetchedAt < GIT_THROTTLE_MS) return;
    dirtyFetchedAt = now;
    const result = await pi
      .exec("git", ["-C", ctx.cwd, "status", "--porcelain"], { timeout: GIT_TIMEOUT_MS })
      .catch(() => undefined);
    if (!result || result.code !== 0) return;
    const dirty = result.stdout.split("\n").filter((line) => line.trim().length > 0).length;
    if (dirty === state.dirty) return;
    state.dirty = dirty;
    state.render?.();
  };

  const apply = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return;
    lastCtx = ctx;
    try {
      ctx.ui.setFooter((tui, theme, footerData) => {
        state.render = () => tui.requestRender();
        const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
        return {
          render(width: number) {
            return renderBar(pi, ctx, footerData, state, theme, width);
          },
          invalidate() {},
          dispose() {
            unsubscribe();
          },
        };
      });
    } catch {
      // setFooter can reject after the session is gone; never take the TUI down.
    }
  };

  // The bar is claimed from every event that can rebind the session, and again
  // on the next tick so the claim lands after other extensions' session_start
  // handlers.
  const claim = (ctx: ExtensionContext): void => {
    apply(ctx);
    setTimeout(() => apply(ctx), 0);
  };

  pi.on("session_start", (_event, ctx) => {
    claim(ctx);
    void refreshDirty(ctx);
    void refreshQuota(ctx, true);
  });
  pi.on("session_switch", (_event, ctx) => {
    claim(ctx);
    void refreshDirty(ctx);
    void refreshQuota(ctx, true);
  });
  pi.on("session_branch", (_event, ctx) => claim(ctx));
  pi.on("model_select", (_event, ctx) => {
    claim(ctx);
    void refreshQuota(ctx, false);
  });
  pi.on("agent_start", (_event, ctx) => {
    state.notify = false;
    claim(ctx);
    void refreshDirty(ctx);
    void refreshQuota(ctx, false);
  });
  pi.on("agent_end", (_event, ctx) => void refreshDirty(ctx));
  pi.on("tool_execution_end", (_event, ctx) => void refreshDirty(ctx));
  // Emitted after every session_start handler, so this claim wins the bar at
  // startup instead of racing Gentle Shell's own footer on the first turn.
  pi.on("resources_discover", (_event, ctx) => claim(ctx));

  const quotaTimer = setInterval(() => {
    if (lastCtx) void refreshQuota(lastCtx, true);
  }, GO_REFRESH_MS);
  quotaTimer.unref();

  pi.events.on("pi-notify:fired", () => {
    state.notify = true;
    state.render?.();
  });
  pi.on("input", () => {
    if (!state.notify) return;
    state.notify = false;
    state.render?.();
  });
}

function renderBar(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  footerData: FooterData,
  state: BarState,
  theme: Theme,
  width: number,
): string[] {
  try {
    let segments = buildSegments(pi, ctx, footerData, state, theme, false);
    if (visibleWidth(join(segments, theme)) > width) segments = buildSegments(pi, ctx, footerData, state, theme, true);
    while (segments.length > 1 && visibleWidth(join(segments, theme)) > width) segments.pop();
    return [truncateToWidth(join(segments, theme), width, theme.fg("dim", "…"))];
  } catch {
    return [`${theme.fg("accent", BRAND)} ${theme.fg("dim", SEPARATOR)} ${theme.fg("muted", ctx.cwd)}`];
  }
}

function join(segments: string[], theme: Theme): string {
  return segments.join(` ${theme.fg("dim", SEPARATOR)} `);
}

// Least important segment last: overflow drops the statuses first, then the
// window budget, then the capability flags.
function buildSegments(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  footerData: FooterData,
  state: BarState,
  theme: Theme,
  compact: boolean,
): string[] {
  const segments: string[] = [theme.fg("accent", BRAND)];

  const branch = footerData.getGitBranch();
  const cwd = compact ? shortenPath(ctx.cwd) : shortenHome(ctx.cwd);
  const dirty = state.dirty ? ` ${theme.fg("warning", `±${state.dirty}`)}` : "";
  const branchText = branch ? theme.fg("text", compact ? clip(branch, COMPACT_BRANCH_WIDTH) : branch) : "";
  segments.push(`${theme.fg("muted", cwd)}${branchText ? ` ${branchText}` : ""}${dirty}`);

  const modelId = ctx.model?.id ?? "no-model";
  const effort = ctx.model?.reasoning ? pi.getThinkingLevel() : undefined;
  segments.push(
    effort
      ? `${theme.fg("text", modelId)} ${theme.fg("muted", "·")} ${theme.fg("syntaxFunction", effort)}`
      : theme.fg("text", modelId),
  );

  const usage = ctx.getContextUsage();
  const percent = typeof usage?.percent === "number" ? usage.percent : null;
  segments.push(`${theme.fg("muted", "ctx")} ${gauge(theme, percent)} ${theme.fg("text", percentText(percent))}`);

  segments.push(theme.fg("text", costLabel(ctx)));

  if (state.quota) {
    const parts = state.quota.map((window, index) =>
      index === 0
        ? `${theme.fg("muted", window.label)} ${gauge(theme, window.percent)} ${theme.fg("text", percentText(window.percent))}`
        : theme.fg("muted", `${window.label} ${percentText(window.percent)}`),
    );
    segments.push(`${theme.fg("muted", "go")} ${parts.join(` ${theme.fg("muted", "·")} `)}`);
  }

  const active = activeToolSet(pi);
  segments.push(
    `${theme.fg("muted", "tools")} ${flag(theme, active.has("read"), "r", "success")}${flag(theme, active.has("write") || active.has("edit"), "w", "accent")}${flag(theme, active.has("bash"), "x", "warning")}`,
  );

  const available = availableToolSet(pi);
  segments.push(
    `${theme.fg("muted", "can")} ${flag(theme, hasAny(available, ASK_TOOL_NAMES), "q", "accent")}${flag(theme, hasAny(available, SEARCH_TOOL_NAMES), "s", "accent")}`,
  );

  const window = formatWindowTokens(usage?.contextWindow ?? ctx.model?.contextWindow ?? 0);
  if (window) segments.push(`${theme.fg("muted", "win")} ${theme.fg("muted", window)}`);

  if (state.notify) segments.push(theme.fg("warning", "notify"));
  for (const status of statuses(footerData)) segments.push(theme.fg("muted", status));
  return segments;
}

