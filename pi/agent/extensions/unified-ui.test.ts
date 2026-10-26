import assert from "node:assert/strict";
import test from "node:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import {
  WORKFLOW_AGENT_STATE_CHANGED_EVENT,
  WORKFLOW_PHASE_CHANGED_EVENT,
  WORKFLOW_RUN_STARTED_EVENT,
  WORKFLOW_RUN_STATE_CHANGED_EVENT,
} from "pi-extensible-workflows";
import unifiedUiExtension, {
  contextPercent,
  createUnifiedUiState,
  formatUnifiedUiLines,
  handleToolEnd,
  handleToolStart,
  handleWorkflowEvent,
} from "./unified-ui.js";

test("renders bounded text without relying on color", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  state.agent = "working";
  state.contextPercent = 42;
  state.activeToolCalls.add("tool-1");
  const lines = formatUnifiedUiLines(state, 28);
  const wideLines = formatUnifiedUiLines(state, 80);

  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => visibleWidth(line) <= 28));
  assert.match(wideLines[0], /working/);
  assert.match(wideLines[0], /42%/);
});

test("accepts only same-session workflow events and aggregates safe fields", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  const sessionId = "session-1";

  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, {
    sessionId,
    runId: "run-1",
    state: "running",
    workflowName: "review",
  }, sessionId);
  handleWorkflowEvent(state, WORKFLOW_PHASE_CHANGED_EVENT, {
    sessionId,
    runId: "run-1",
    phase: "verify",
    message: "do not display this",
  }, sessionId);
  handleWorkflowEvent(state, WORKFLOW_AGENT_STATE_CHANGED_EVENT, {
    sessionId,
    runId: "run-1",
    agentId: "agent-1",
    state: "running",
    displayLabel: "reviewer",
    prompt: "secret prompt",
  }, sessionId);
  handleWorkflowEvent(state, WORKFLOW_RUN_STATE_CHANGED_EVENT, {
    sessionId: "other-session",
    runId: "run-2",
    state: "failed",
    error: { message: "secret error" },
  }, sessionId);

  const lines = formatUnifiedUiLines(state, 120).join("\n");
  assert.match(lines, /review/);
  assert.match(lines, /verify/);
  assert.match(lines, /Agents 1/);
  assert.doesNotMatch(lines, /secret/);
  assert.doesNotMatch(lines, /run-2/);
});

test("ignores malformed workflow payloads", () => {
  const state = createUnifiedUiState();
  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, null, "session-1");
  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, { sessionId: "session-1" }, "session-1");
  assert.deepEqual(formatUnifiedUiLines(state, 120), [
    "Unified UI off",
    "Workflow unavailable · Tools 0 · Errors 0",
  ]);
});

test("tracks tool calls by id and clamps context usage", () => {
  const state = createUnifiedUiState();
  handleToolStart(state, "same-name-1");
  handleToolStart(state, "same-name-2");
  handleToolEnd(state, "same-name-1", true);
  assert.deepEqual([...state.activeToolCalls], ["same-name-2"]);
  assert.equal(state.errorCount, 1);
  assert.equal(contextPercent({ tokens: 150, contextWindow: 100 }), 100);
  assert.equal(contextPercent({ tokens: 10, contextWindow: 0 }), undefined);
});

test("mounts by default in TUI and remains a headless no-op", async () => {
  let command: any;
  let widgetCalls = 0;
  const handlers = new Map<string, (event: unknown, ctx: any) => unknown>();
  const pi: any = {
    events: { on: () => () => undefined },
    on: (name: string, handler: any) => handlers.set(name, handler),
    registerCommand: (_name: string, definition: any) => { command = definition; },
  };
  unifiedUiExtension(pi);

  const tuiContext = {
    mode: "tui",
    hasUI: true,
    ui: {
      setWidget: () => { widgetCalls += 1; },
      notify: () => undefined,
    },
    sessionManager: { getSessionId: () => "tui-session" },
  };
  await handlers.get("session_start")?.({}, tuiContext);
  assert.equal(widgetCalls, 1);

  await command.handler("on", {
    mode: "print",
    hasUI: false,
    ui: {
      setWidget: () => { widgetCalls += 1; },
      notify: () => { throw new Error("headless UI must not notify"); },
    },
  });
  assert.equal(widgetCalls, 1);
});
