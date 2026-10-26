import type {
  ExtensionAPI,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
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
  activeToolCalls: Set<string>;
  errorCount: number;
  contextPercent?: number;
  workflows: Map<string, WorkflowState>;
  workflowAgents: Map<string, string>;
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

export function createUnifiedUiState(): UnifiedUiState {
  return {
    enabled: false,
    agent: "idle",
    activeToolCalls: new Set(),
    errorCount: 0,
    workflows: new Map(),
    workflowAgents: new Map(),
  };
}

export function contextPercent(usage: unknown): number | undefined {
  const value = record(usage);
  const tokens = value?.tokens;
  const contextWindow = value?.contextWindow;
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
    if (phase) current.phase = displayLabel(phase, "phase");
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
    }
    return;
  }

  if (channel === WORKFLOW_RUN_COMPLETED_EVENT) {
    state.workflows.delete(runId);
    removeWorkflowAgents(state, runId);
    return;
  }

  if (channel === WORKFLOW_RUN_FAILED_EVENT) {
    state.errorCount += 1;
    state.workflows.delete(runId);
    removeWorkflowAgents(state, runId);
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

export function formatUnifiedUiLines(
  state: UnifiedUiState,
  width: number,
): string[] {
  const maxWidth = Math.max(1, Math.floor(width));
  const context = state.contextPercent === undefined ? "Context —" : `Context ${state.contextPercent}%`;
  const first = state.enabled
    ? `Unified UI on · Agent ${state.agent} · ${context}`
    : "Unified UI off";
  const active = [...state.workflows.values()].filter(
    (workflow) => !TERMINAL_WORKFLOW_STATES.has(workflow.state),
  );
  const activeAgentCount = [...state.workflowAgents.values()].filter((value) =>
    value === "running" || value === "waiting_for_child" || value === "retrying",
  ).length;
  const workflow = active[0]
    ? `Workflow ${active[0].name}${active.length > 1 ? ` +${active.length - 1}` : ""}${active[0].phase ? ` · ${active[0].phase}` : ""}`
    : "Workflow unavailable";
  const second = `${workflow}${activeAgentCount > 0 ? ` · Agents ${activeAgentCount}` : ""} · Tools ${state.activeToolCalls.size} · Errors ${state.errorCount}`;
  return [truncateToWidth(first, maxWidth), truncateToWidth(second, maxWidth)];
}

export default function unifiedUiExtension(pi: ExtensionAPI): void {
  const state = createUnifiedUiState();
  let sessionId = "";
  let requestRender: (() => void) | undefined;
  let repaintTimer: ReturnType<typeof setTimeout> | undefined;
  let activeUi: Pick<ExtensionUIContext, "setWidget"> | undefined;

  const clearTimer = (): void => {
    if (repaintTimer !== undefined) clearTimeout(repaintTimer);
    repaintTimer = undefined;
  };

  const clearWidget = (): void => {
    clearTimer();
    try {
      activeUi?.setWidget(UNIFIED_UI_WIDGET_KEY, undefined);
    } catch (error) {
      console.warn("[unified-ui] widget teardown failed", error);
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

  const mountWidget = (ctx: any): void => {
    if (!state.enabled || ctx.mode !== "tui" || ctx.hasUI !== true) return;
    if (requestRender) return;
    activeUi = ctx.ui;
    try {
      ctx.ui.setWidget(
        UNIFIED_UI_WIDGET_KEY,
        (tui: { requestRender?: () => void }) => {
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
      state.enabled = false;
      requestRender = undefined;
      activeUi = undefined;
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
    description: "Toggle the unified Pi UI widget",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui" || !ctx.hasUI) return;
      const action = args.trim().toLowerCase();
      if (action !== "" && action !== "on" && action !== "off") {
        ctx.ui.notify("Usage: /unified-ui [on|off]", "warning");
        return;
      }
      state.enabled = action === "on" || (action === "" && !state.enabled);
      if (state.enabled) mountWidget(ctx);
      else clearWidget();
      ctx.ui.notify(`Unified UI ${state.enabled ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    clearWidget();
    const interactive = ctx.mode === "tui" && ctx.hasUI === true;
    state.enabled = interactive;
    state.agent = "idle";
    state.activeToolCalls.clear();
    state.errorCount = 0;
    state.contextPercent = undefined;
    state.workflows.clear();
    state.workflowAgents.clear();
    sessionId = String(ctx.sessionManager.getSessionId?.() ?? "");
    if (interactive) mountWidget(ctx);
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
    state.contextPercent = contextPercent(ctx.getContextUsage());
    scheduleRender();
  });

  pi.on("session_shutdown", async () => {
    state.enabled = false;
    clearWidget();
  });
}
