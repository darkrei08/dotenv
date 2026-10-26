import type {
  ExtensionAPI,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  WORKFLOW_AGENT_STATE_CHANGED_EVENT,
  WORKFLOW_PHASE_CHANGED_EVENT,
  WORKFLOW_RUN_COMPLETED_EVENT,
  WORKFLOW_RUN_FAILED_EVENT,
  WORKFLOW_RUN_STARTED_EVENT,
  WORKFLOW_RUN_STATE_CHANGED_EVENT,
} from "pi-extensible-workflows";

export const UNIFIED_UI_WIDGET_KEY = "dotenv:unified-ui";
export const UNIFIED_UI_COALESCE_MS = 100;

export const GAUGE_CELLS = 8;
const GAUGE_FILLED = "▰";
const GAUGE_EMPTY = "▱";

const TERMINAL_WORKFLOW_STATES = new Set([
  "completed",
  "failed",
  "stopped",
  "interrupted",
  "budget_exhausted",
]);

type WorkflowState = {
  name: string;
  state: string;
  phase?: string;
};

export interface UnifiedUiState {
  enabled: boolean;
  agent: "idle" | "working";
  currentPhase?: string;
  modelId?: string;
  effort?: string;
  activeToolCalls: Set<string>;
  errorCount: number;
  totalTokens?: number;
  contextPercent?: number;
  costTotal: number;
  cwd?: string;
  branch?: string;
  dirty?: number;
  workflows: Map<string, WorkflowState>;
  workflowAgents: Map<string, string>;
}

export interface ThemeAdapter {
  fg(role: string, text: string): string;
  bold(text: string): string;
}

export interface PiComponent {
  render(width: number): string[];
  invalidate?(): void;
  dispose?(): void;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function displayLabel(value: unknown, fallback: string): string {
  const label = stringValue(value) ?? fallback;
  return label
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

function sameSession(payload: Record<string, unknown>, sessionId: string): boolean {
  return stringValue(payload.sessionId) === sessionId;
}

function runIdOf(payload: Record<string, unknown>): string | undefined {
  return stringValue(payload.runId);
}

function removeWorkflowAgents(state: UnifiedUiState, runId: string): void {
  for (const key of state.workflowAgents.keys()) {
    if (key.startsWith(`${runId}:`)) state.workflowAgents.delete(key);
  }
}

export function renderGauge(percent: number | null, cells = GAUGE_CELLS): string {
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const filled = Math.round((clamped / 100) * cells);
  return GAUGE_FILLED.repeat(filled) + GAUGE_EMPTY.repeat(cells - filled);
}

export function gaugeRole(percent: number | null): "accent" | "warning" | "error" | "dim" {
  if (percent === null || percent === undefined) return "dim";
  if (percent >= 95) return "error";
  if (percent >= 80) return "warning";
  return "accent";
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatCost(total: number): string {
  if (!total || total <= 0) return "$0.00";
  return total >= 1 ? `$${total.toFixed(2)}` : `$${total.toFixed(3)}`;
}

export function computeSessionCost(sessionManager: any): number {
  let total = 0;
  try {
    const entries = sessionManager?.getEntries?.() ?? [];
    for (const entry of entries) {
      if (entry?.type !== "message" || entry?.message?.role !== "assistant") continue;
      const costVal = entry?.message?.usage?.cost?.total;
      if (typeof costVal === "number" && Number.isFinite(costVal)) {
        total += costVal;
      }
    }
  } catch (error) {
    console.debug("[unified-ui] session cost computation failed", error);
  }
  return total;
}

export function readGitInfo(cwd: string): { branch?: string; dirty?: number } {
  try {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      timeout: 2000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    let dirty: number | undefined;
    try {
      const statusOut = execFileSync("git", ["status", "--porcelain"], {
        cwd,
        timeout: 2000,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      dirty = statusOut ? statusOut.split("\n").filter(Boolean).length : 0;
    } catch (statusErr) {
      console.debug("[unified-ui] git status read failed", statusErr);
      dirty = undefined;
    }
    return { branch: branch || undefined, dirty };
  } catch (gitErr) {
    console.debug("[unified-ui] git rev-parse failed, checking file fallback", gitErr);
    // Fallback: resolve .git directory or worktree gitdir pointer
    try {
      const gitPath = path.join(cwd, ".git");
      if (!existsSync(gitPath)) return {};
      let headPath = path.join(gitPath, "HEAD");
      if (!existsSync(headPath)) {
        const ptr = readFileSync(gitPath, "utf8").trim();
        if (ptr.startsWith("gitdir:")) {
          const rel = ptr.replace("gitdir:", "").trim();
          headPath = path.isAbsolute(rel) ? path.join(rel, "HEAD") : path.resolve(cwd, rel, "HEAD");
        }
      }
      if (!existsSync(headPath)) return {};
      const content = readFileSync(headPath, "utf8").trim();
      const branch = content.startsWith("ref: refs/heads/")
        ? content.replace("ref: refs/heads/", "").trim()
        : content.slice(0, 7);
      return { branch: branch || undefined };
    } catch (fallbackErr) {
      console.debug("[unified-ui] git file fallback failed", fallbackErr);
      return {};
    }
  }
}

export function createUnifiedUiState(): UnifiedUiState {
  return {
    enabled: false,
    agent: "idle",
    activeToolCalls: new Set(),
    errorCount: 0,
    costTotal: 0,
    workflows: new Map(),
    workflowAgents: new Map(),
  };
}

export function contextPercent(usage: unknown): number | undefined {
  const value = record(usage);
  if (!value) return undefined;
  if (typeof value.percent === "number" && Number.isFinite(value.percent)) {
    return Math.max(0, Math.min(100, Math.round(value.percent)));
  }
  const tokens = value.tokens;
  const contextWindow = value.contextWindow;
  if (
    typeof tokens !== "number" ||
    !Number.isFinite(tokens) ||
    typeof contextWindow !== "number" ||
    !Number.isFinite(contextWindow) ||
    contextWindow <= 0
  ) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round((tokens / contextWindow) * 100)));
}

export function handleWorkflowEvent(
  state: UnifiedUiState,
  channel: string,
  payload: unknown,
  sessionId: string,
): void {
  const value = record(payload);
  if (!value || !sameSession(value, sessionId)) return;
  const runId = runIdOf(value);
  if (!runId) return;

  if (channel === WORKFLOW_RUN_STARTED_EVENT) {
    state.workflows.set(runId, {
      name: displayLabel(value.workflowName, "workflow"),
      state: "running",
    });
    return;
  }

  if (channel === WORKFLOW_PHASE_CHANGED_EVENT) {
    const current = state.workflows.get(runId);
    if (!current) return;
    const phase = stringValue(value.phase);
    if (phase) {
      current.phase = displayLabel(phase, "phase");
      state.currentPhase = current.phase;
    }
    return;
  }

  if (channel === WORKFLOW_AGENT_STATE_CHANGED_EVENT) {
    const agentId = stringValue(value.agentId);
    const agentState = stringValue(value.state);
    if (agentId && agentState) state.workflowAgents.set(`${runId}:${agentId}`, agentState);
    return;
  }

  if (channel === WORKFLOW_RUN_STATE_CHANGED_EVENT) {
    const current = state.workflows.get(runId);
    if (!current) return;
    const next = stringValue(value.state);
    if (!next) return;
    current.state = next;
    if (TERMINAL_WORKFLOW_STATES.has(next)) {
      state.workflows.delete(runId);
      removeWorkflowAgents(state, runId);
      if (state.workflows.size === 0) state.currentPhase = undefined;
    }
    return;
  }

  if (channel === WORKFLOW_RUN_COMPLETED_EVENT) {
    state.workflows.delete(runId);
    removeWorkflowAgents(state, runId);
    if (state.workflows.size === 0) state.currentPhase = undefined;
    return;
  }

  if (channel === WORKFLOW_RUN_FAILED_EVENT) {
    state.errorCount += 1;
    state.workflows.delete(runId);
    removeWorkflowAgents(state, runId);
    if (state.workflows.size === 0) state.currentPhase = undefined;
  }
}

export function handleToolStart(state: UnifiedUiState, toolCallId: unknown): void {
  const id = stringValue(toolCallId);
  if (id) state.activeToolCalls.add(id);
}

export function handleToolEnd(
  state: UnifiedUiState,
  toolCallId: unknown,
  isError: unknown,
): void {
  const id = stringValue(toolCallId);
  if (!id || !state.activeToolCalls.delete(id)) return;
  if (isError === true) state.errorCount += 1;
}

// Sovereign Footer Line: incorporates Gentle Shell's gauge, separators, model, cost, and context
export function formatFooterLine(
  state: UnifiedUiState,
  width: number,
  theme?: ThemeAdapter,
): string {
  const maxWidth = Math.max(1, Math.floor(width));
  const fg = theme?.fg ?? ((_r: string, t: string) => t);
  const bold = theme?.bold ?? ((t: string) => t);
  const sep = ` ${fg("dim", "⟡")} `;

  // 1. Brand & Phase
  const brand = bold(fg("accent", "⚡ Unified UI"));
  const phase = state.currentPhase
    ? fg("text", state.currentPhase)
    : state.agent === "working"
      ? fg("accent", "working")
      : undefined;

  // 2. Execution / Model
  const modelText = state.modelId ? fg("text", state.modelId) : undefined;
  const effortText = state.effort ? fg("syntaxFunction", state.effort) : undefined;
  const exec = modelText && effortText ? `${modelText} · ${effortText}` : modelText;

  // 3. Context & Tacchette Gauge
  const pct = state.contextPercent;
  let contextStr: string;
  if (pct !== undefined) {
    const gauge = fg(gaugeRole(pct), renderGauge(pct));
    const tokenBadge = state.totalTokens !== undefined ? ` (${formatTokens(state.totalTokens)})` : "";
    contextStr = `${fg("text", `${pct}%`)}${fg("dim", tokenBadge)} ${gauge}`;
  } else {
    contextStr = fg("dim", "Context —");
  }

  // 4. Cost
  const costStr = fg("text", formatCost(state.costTotal));

  // 5. Git / CWD
  let gitStr: string | undefined;
  if (state.branch) {
    const dirtyStr = state.dirty !== undefined && state.dirty > 0 ? fg("warning", ` ±${state.dirty}`) : "";
    const baseCwd = state.cwd ? path.basename(state.cwd) : "";
    gitStr = `${fg("muted", baseCwd)} ${fg("text", state.branch)}${dirtyStr}`.trim();
  } else if (state.cwd) {
    gitStr = fg("muted", path.basename(state.cwd));
  }

  const parts = [brand, phase, exec, contextStr, costStr, gitStr].filter(Boolean);
  return truncateToWidth(parts.join(sep), maxWidth);
}

// Widget above the editor: Claude Code cleanliness (Zero overhead when idle)
export function formatUnifiedUiLines(
  state: UnifiedUiState,
  width: number,
  theme?: ThemeAdapter,
): string[] {
  if (!state.enabled) return [];
  const maxWidth = Math.max(1, Math.floor(width));
  const fg = theme?.fg ?? ((_r: string, t: string) => t);
  const bold = theme?.bold ?? ((t: string) => t);

  const activeWorkflows = [...state.workflows.values()].filter(
    (workflow) => !TERMINAL_WORKFLOW_STATES.has(workflow.state),
  );
  const activeAgentCount = [...state.workflowAgents.values()].filter(
    (value) => value === "running" || value === "waiting_for_child" || value === "retrying",
  ).length;

  // Cleanliness principle: if no workflow, agent, or active tools are executing, keep screen clean!
  if (activeWorkflows.length === 0 && activeAgentCount === 0 && state.activeToolCalls.size === 0) {
    return [];
  }

  const lines: string[] = [];

  // Card header
  const title = bold(fg("customMessageLabel", "❀ Workflows & Agents"));
  const sub = fg(
    "dim",
    `· ${activeWorkflows.length} workflow${activeWorkflows.length === 1 ? "" : "s"} · ${activeAgentCount} agent${activeAgentCount === 1 ? "" : "s"} · Tools ${state.activeToolCalls.size}${state.errorCount > 0 ? ` · ${state.errorCount} failed` : ""}`,
  );
  lines.push(truncateToWidth(`${title} ${sub}`, maxWidth));

  // Active workflow items
  for (const wf of activeWorkflows.slice(0, 3)) {
    const glyph = fg("accent", "◐");
    const name = fg("text", wf.name);
    const phaseText = wf.phase ? fg("dim", `· ${wf.phase}`) : "";
    lines.push(truncateToWidth(`  ${glyph} Workflow ${name} ${phaseText}`, maxWidth));
  }

  return lines.map((l) => truncateToWidth(l, maxWidth));
}

export default function unifiedUiExtension(pi: ExtensionAPI): void {
  const state = createUnifiedUiState();
  let sessionId = "";
  let requestRender: (() => void) | undefined;
  let repaintTimer: ReturnType<typeof setTimeout> | undefined;
  let activeUi: Pick<ExtensionUIContext, "setWidget" | "setFooter"> | undefined;

  const clearTimer = (): void => {
    if (repaintTimer !== undefined) clearTimeout(repaintTimer);
    repaintTimer = undefined;
  };

  const clearWidget = (): void => {
    clearTimer();
    try {
      activeUi?.setWidget(UNIFIED_UI_WIDGET_KEY, undefined);
      activeUi?.setFooter(undefined);
    } catch (error) {
      console.warn("[unified-ui] teardown failed", error);
    }
    requestRender = undefined;
    activeUi = undefined;
  };

  const scheduleRender = (): void => {
    if (!state.enabled || !requestRender || repaintTimer !== undefined) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = undefined;
      requestRender?.();
    }, UNIFIED_UI_COALESCE_MS);
    repaintTimer.unref?.();
  };

  const mountUi = (ctx: any): void => {
    if (!state.enabled || ctx.mode !== "tui" || ctx.hasUI !== true) return;
    activeUi = ctx.ui;

    // 1. Mount the aboveEditor widget for active workflows/agents (Zero overhead when idle)
    try {
      ctx.ui.setWidget(
        UNIFIED_UI_WIDGET_KEY,
        (tui: { requestRender?: () => void }): PiComponent => {
          requestRender = () => tui.requestRender?.();
          return {
            render: (width: number) => formatUnifiedUiLines(state, width),
            invalidate: () => undefined,
            dispose: () => {
              requestRender = undefined;
            },
          };
        },
        { placement: "aboveEditor" },
      );
    } catch (error) {
      console.warn("[unified-ui] widget mount failed", error);
    }

    // 2. Mount the sovereign footer component implementing render(width): string[]
    try {
      ctx.ui.setFooter((_tui: any, theme: any): PiComponent => {
        return {
          render: (width: number) => [formatFooterLine(state, width, theme)],
          invalidate: () => undefined,
          dispose: () => undefined,
        };
      });
    } catch (error) {
      console.warn("[unified-ui] footer mount failed", error);
    }
  };

  const workflowChannels = [
    WORKFLOW_RUN_STARTED_EVENT,
    WORKFLOW_RUN_STATE_CHANGED_EVENT,
    WORKFLOW_RUN_COMPLETED_EVENT,
    WORKFLOW_RUN_FAILED_EVENT,
    WORKFLOW_PHASE_CHANGED_EVENT,
    WORKFLOW_AGENT_STATE_CHANGED_EVENT,
  ];
  for (const channel of workflowChannels) {
    pi.events.on(channel, (payload) => {
      handleWorkflowEvent(state, channel, payload, sessionId);
      scheduleRender();
    });
  }

  pi.registerCommand("unified-ui", {
    description: "Toggle the unified Pi UI (footer and workflow cards)",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui" || !ctx.hasUI) return;
      const action = args.trim().toLowerCase();
      if (action !== "" && action !== "on" && action !== "off") {
        ctx.ui.notify("Usage: /unified-ui [on|off]", "warning");
        return;
      }
      state.enabled = action === "on" || (action === "" && !state.enabled);
      if (state.enabled) mountUi(ctx);
      else clearWidget();
      ctx.ui.notify(`Unified UI ${state.enabled ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    clearWidget();
    const interactive = ctx.mode === "tui" && ctx.hasUI === true;
    state.enabled = interactive;
    state.agent = "idle";
    state.currentPhase = undefined;
    state.activeToolCalls.clear();
    state.errorCount = 0;
    state.costTotal = computeSessionCost(ctx.sessionManager);
    state.totalTokens = undefined;
    state.contextPercent = undefined;
    state.workflows.clear();
    state.workflowAgents.clear();
    sessionId = String(ctx.sessionManager?.getSessionId?.() ?? "");

    state.cwd = String(ctx.cwd || process.cwd());
    const gitInfo = readGitInfo(state.cwd);
    state.branch = gitInfo.branch;
    state.dirty = gitInfo.dirty;
    if (ctx.model) {
      state.modelId = String((ctx.model as any)?.id || ctx.model);
    }
    if (ctx.thinkingLevel) state.effort = String(ctx.thinkingLevel);

    if (interactive) mountUi(ctx);
  });

  // Pi 1.4 SDK emits event.model (Model object with .id)
  pi.on("model_select", async (event: any) => {
    if (event?.model) {
      state.modelId = String(event.model?.id || event.model);
    } else if (event?.modelId) {
      state.modelId = String(event.modelId);
    }
    scheduleRender();
  });

  // Pi 1.4 SDK emits event.level
  pi.on("thinking_level_select", async (event: any) => {
    if (event?.level) {
      state.effort = String(event.level);
    } else if (event?.thinkingLevel) {
      state.effort = String(event.thinkingLevel);
    }
    scheduleRender();
  });

  pi.on("agent_start", async () => {
    state.agent = "working";
    scheduleRender();
  });

  pi.on("agent_end", async () => {
    state.agent = "idle";
    scheduleRender();
  });

  pi.on("tool_execution_start", async (event) => {
    handleToolStart(state, event.toolCallId);
    scheduleRender();
  });

  pi.on("tool_execution_end", async (event) => {
    handleToolEnd(state, event.toolCallId, event.isError);
    scheduleRender();
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (ctx?.getContextUsage) {
      const usage = ctx.getContextUsage();
      state.contextPercent = contextPercent(usage);
      const val = record(usage);
      if (typeof val?.tokens === "number" && Number.isFinite(val.tokens)) {
        state.totalTokens = val.tokens;
      }
    }
    state.costTotal = computeSessionCost(ctx.sessionManager);
    scheduleRender();
  });

  pi.on("session_shutdown", async () => {
    state.enabled = false;
    clearWidget();
  });
}
