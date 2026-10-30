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
  computeSessionCost,
  computeSessionUsage,
  contextPercent,
  createUnifiedUiState,
  formatCost,
  formatFooterLine,
  formatTokens,
  formatUnifiedUiLines,
  gaugeRole,
  handleToolEnd,
  handleToolStart,
  handleWorkflowEvent,
  readGitInfo,
  renderGauge,
} from "./unified-ui.js";

test("gauge: renders 8-cell tacchette and tone thresholds", () => {
  assert.equal(renderGauge(0), "▱▱▱▱▱▱▱▱");
  assert.equal(renderGauge(50), "▰▰▰▰▱▱▱▱");
  assert.equal(renderGauge(100), "▰▰▰▰▰▰▰▰");
  assert.equal(gaugeRole(50), "accent");
  assert.equal(gaugeRole(85), "warning");
  assert.equal(gaugeRole(98), "error");
  assert.equal(gaugeRole(null), "dim");
});

test("formatters: formats tokens, costs and session cost cleanly", () => {
  assert.equal(formatTokens(500), "500");
  assert.equal(formatTokens(1500), "1.5k");
  assert.equal(formatTokens(2500000), "2.5M");
  assert.equal(formatCost(0), "$0.00");
  assert.equal(formatCost(0.045), "$0.045");
  assert.equal(formatCost(1.2), "$1.20");

  const mockSession = {
    getEntries: () => [
      { type: "custom", customType: "init" },
      { type: "message", message: { role: "user", content: "hi" } },
      { type: "message", message: { role: "assistant", usage: { cost: { total: 0.042 } } } },
      { type: "message", message: { role: "assistant", usage: { cost: { total: 0.018 } } } },
    ],
  };
  assert.equal(Number(computeSessionCost(mockSession)?.toFixed(3)), 0.06);
});

test("session usage: aggregates only runtime-reported input, output, and cache-read tokens", () => {
  const session = {
    getEntries: () => [
      { type: "message", message: { role: "assistant", usage: { input: 10, output: 4, cacheRead: 8 } } },
      { type: "message", message: { role: "assistant", usage: { input: 2, output: 3, cacheRead: 1 } } },
      { type: "message", message: { role: "user", usage: { input: 99 } } },
    ],
  };
  assert.deepEqual(computeSessionUsage(session), { input: 12, output: 7, cacheRead: 9 });
  assert.deepEqual(computeSessionUsage({ getEntries: () => [] }), {});
});

test("git info: safely extracts git branch and dirty status from repository or worktree", () => {
  const info = readGitInfo(process.cwd());
  assert.ok(typeof info === "object");
  if (info.branch) {
    assert.ok(typeof info.branch === "string");
    assert.ok(info.branch.length > 0);
  }
});

test("footer: formats sovereign single-line footer with separators, tokens, cost, and tacchette", () => {
  const state = createUnifiedUiState();
  state.modelId = "gpt-5.6-luna";
  state.effort = "high";
  state.contextPercent = 42;
  state.totalTokens = 8500;
  state.costTotal = 0.15;
  state.currentPhase = "implementing";
  state.branch = "main";
  state.dirty = 2;

  const footer = formatFooterLine(state, 120);
  assert.match(footer, /Unified UI/);
  assert.match(footer, /m:gpt-5\.6-luna/);
  assert.match(footer, /e:high/);
  assert.match(footer, /c:42%/);
  assert.match(footer, /t:8\.5k/); // formatted tokens
  assert.match(footer, /⟡/); // left/right separator
  assert.match(footer, /\$:0.150/);
  assert.match(footer, /b:main ±2/);
  assert.ok(visibleWidth(footer) <= 120);
});

test("footer: renders runtime telemetry and explicit placeholders without inventing zeros", () => {
  const missing = formatFooterLine(createUnifiedUiState(), 300);
  assert.match(missing, /in —/);
  assert.match(missing, /out —/);
  assert.match(missing, /cache —/);
  assert.match(missing, /ctx —/);
  assert.match(missing, /auto —/);
  assert.match(missing, /cost —/);
  assert.match(missing, /model —/);
  assert.match(missing, /effort —/);
  assert.match(missing, /workspace —/);
  assert.match(missing, /branch —/);
  assert.match(missing, /session —/);
  assert.match(missing, /extensions\/skills —/);
  assert.doesNotMatch(missing, /\$0\.00/);

  const state = createUnifiedUiState();
  state.modelId = "gpt-6-luna";
  state.effort = "high";
  state.inputTokens = 1200;
  state.outputTokens = 125;
  state.cacheReadTokens = 900;
  state.totalTokens = 2048;
  state.contextWindow = 8192;
  state.contextAuto = true;
  state.contextPercent = 25;
  state.costTotal = 0.25;
  state.cwd = "/work/project";
  state.branch = "main";
  state.sessionId = "abcdef1234567890";
  state.extensionStatuses = new Map([["codex-image", "●"], ["ponytail", "full"]]);
  const footer = formatFooterLine(state, 260);
  assert.match(footer, /in 1\.2k/);
  assert.match(footer, /out 125/);
  assert.match(footer, /cache 900/);
  assert.match(footer, /25%/);
  assert.match(footer, /2\.0k\/8\.2k auto/);
  assert.match(footer, /\$0\.250/);
  assert.match(footer, /gpt-6-luna · high/);
  assert.match(footer, /\/work\/project/);
  assert.match(footer, /main/);
  assert.match(footer, /abcdef12…/);
  assert.match(footer, /codex-image: ●/);
  assert.match(footer, /ponytail: full/);
});

test("footer: keeps compact telemetry labels at narrow widths", () => {
  const state = createUnifiedUiState();
  state.modelId = "gpt-6-luna";
  state.effort = "high";
  state.contextPercent = 25;
  state.totalTokens = 2048;
  state.contextWindow = 8192;
  state.contextAuto = true;
  state.costTotal = 0.25;
  state.cwd = "/work/project";
  state.branch = "main";
  state.inputTokens = 1200;
  state.outputTokens = 125;
  state.cacheReadTokens = 900;
  state.sessionId = "abcdef1234567890";
  state.extensionStatuses = new Map([["codex-image", "●"], ["ponytail", "full"]]);
  const footer = formatFooterLine(state, 120);

  for (const label of ["m:", "e:", "c:", "t:", "a:", "$:", "w:", "b:", "i:", "o:", "r:", "s:", "x:", "i=", "p="]) {
    assert.match(footer, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.ok(visibleWidth(footer) <= 120);
});

test("cleanliness: widget returns empty lines when idle", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  state.agent = "idle";
  state.errorCount = 1; // Prior session error must not cause persistent idle display
  // When idle with no workflows, agents or tools, returns zero lines (Claude Code clean)
  const lines = formatUnifiedUiLines(state, 80);
  assert.deepEqual(lines, []);
});

test("widget: renders active workflows and agents when running, asserting bounded width", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  state.agent = "working";
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
    message: "secret message",
  }, sessionId);
  handleWorkflowEvent(state, WORKFLOW_AGENT_STATE_CHANGED_EVENT, {
    sessionId,
    runId: "run-1",
    agentId: "agent-1",
    state: "running",
  }, sessionId);

  const lines = formatUnifiedUiLines(state, 120);
  assert.ok(lines.length >= 2);
  assert.match(lines[0], /Workflows & Agents/);
  assert.match(lines[0], /1 agent/);
  assert.match(lines[1], /Workflow review/);
  assert.match(lines[1], /verify/);
  assert.doesNotMatch(lines.join("\n"), /secret/);
  assert.ok(lines.every((line) => visibleWidth(line) <= 120));
});

test("same-session: rejects other-session events and handles malformed payloads", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  // Other session event is rejected
  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, {
    sessionId: "other-session",
    runId: "run-other",
    workflowName: "other",
  }, "session-1");
  assert.equal(state.workflows.size, 0);

  // Malformed payload is rejected
  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, null, "session-1");
  handleWorkflowEvent(state, WORKFLOW_RUN_STARTED_EVENT, { sessionId: "session-1" }, "session-1");
  assert.equal(state.workflows.size, 0);
  assert.deepEqual(formatUnifiedUiLines(state, 120), []);
});

test("tracks tool calls by id and clamps context usage", () => {
  const state = createUnifiedUiState();
  handleToolStart(state, "same-name-1");
  handleToolStart(state, "same-name-2");
  handleToolEnd(state, "same-name-1", true);
  assert.deepEqual([...state.activeToolCalls], ["same-name-2"]);
  assert.equal(state.errorCount, 1);
  assert.equal(contextPercent({ tokens: 150, contextWindow: 100 }), 100);
  assert.equal(contextPercent({ percent: 45 }), 45);
  assert.equal(contextPercent({ tokens: 10, contextWindow: 0 }), undefined);
});

test("mounts both widget and footer components, verifying component render contracts and Pi 1.4 events", async () => {
  let command: any;
  let mountedWidgetFactory: any;
  let mountedFooterFactory: any;
  const handlers = new Map<string, (event: unknown, ctx: any) => unknown>();
  const pi: any = {
    events: { on: () => () => undefined },
    on: (name: string, handler: any) => handlers.set(name, handler),
    registerCommand: (_name: string, definition: any) => { command = definition; },
  };
  unifiedUiExtension(pi);

  const mockSessionManager = {
    getSessionId: () => "tui-session",
    getEntries: () => [
      { type: "message", message: { role: "assistant", usage: { cost: { total: 0.05 } } } },
    ],
  };

  const tuiContext = {
    mode: "tui",
    hasUI: true,
    ui: {
      setWidget: (_key: string, factory: any) => { mountedWidgetFactory = factory; },
      setFooter: (factory: any) => { mountedFooterFactory = factory; },
      notify: () => undefined,
    },
    sessionManager: mockSessionManager,
    model: { id: "gpt-5.6-luna" },
    thinkingLevel: "high",
    cwd: "/root/git/personale/pi.dev/dotenv",
  };
  await handlers.get("session_start")?.({}, tuiContext);

  // Verify widget component contract
  assert.ok(mountedWidgetFactory);
  const widgetComponent = mountedWidgetFactory({ requestRender: () => undefined });
  assert.equal(typeof widgetComponent.render, "function");
  const widgetLines = widgetComponent.render(80);
  assert.ok(Array.isArray(widgetLines));

  // Verify footer component contract
  assert.ok(mountedFooterFactory);
  const footerComponent = mountedFooterFactory({}, { fg: (_r: string, t: string) => t, bold: (t: string) => t });
  assert.equal(typeof footerComponent.render, "function");
  const footerLines = footerComponent.render(100);
  assert.ok(Array.isArray(footerLines));
  assert.equal(footerLines.length, 1);
  assert.match(footerLines[0], /Unified UI/);
  assert.match(footerLines[0], /m:gpt-5\.6-luna/);
  assert.match(footerLines[0], /\$:0.050/);

  // Verify Pi 1.4 SDK model_select event payload { model: { id: "claude-sonnet-4-6" } }
  await handlers.get("model_select")?.({ model: { id: "claude-sonnet-4-6" }, type: "model_select" }, tuiContext);
  const modelFooter = footerComponent.render(100);
  assert.match(modelFooter[0], /claude-sonnet-4-6/);

  // Verify Pi 1.4 SDK thinking_level_select event payload { level: "medium" }
  await handlers.get("thinking_level_select")?.({ level: "medium", type: "thinking_level_select" }, tuiContext);
  const effortFooter = footerComponent.render(100);
  assert.match(effortFooter[0], /m:claude-sonnet-4-6/);
  assert.match(effortFooter[0], /e:medium/);

  // Verify turn_end updates context tokens and cost
  await handlers.get("turn_end")?.({}, {
    getContextUsage: () => ({ tokens: 2048, contextWindow: 10000, percent: 20 }),
    sessionManager: mockSessionManager,
  });
  const updatedFooter = footerComponent.render(120);
  assert.match(updatedFooter[0], /20%/);
  assert.match(updatedFooter[0], /2\.0k/);
  assert.match(updatedFooter[0], /\$:0.050/);

  // Verify headless no-op
  let headlessWidgetCalled = false;
  let headlessFooterCalled = false;
  await command.handler("on", {
    mode: "print",
    hasUI: false,
    ui: {
      setWidget: () => { headlessWidgetCalled = true; },
      setFooter: () => { headlessFooterCalled = true; },
    },
  });
  assert.equal(headlessWidgetCalled, false);
  assert.equal(headlessFooterCalled, false);
});

test("footer: shows graphical prompt state in green/red and uses a right-aligned row", () => {
  const state = createUnifiedUiState();
  state.enabled = true;
  state.agent = "working";
  state.promptStatus = "working";
  state.modelId = "gpt-6-luna";
  const roles: string[] = [];
  const theme = {
    fg: (role: string, text: string) => { roles.push(role); return text; },
    bold: (text: string) => text,
  };

  const working = formatFooterLine(state, 120, theme);
  assert.match(working, /●/);
  assert.ok(roles.includes("success"));
  assert.equal(visibleWidth(working), 120);

  handleToolStart(state, "failed-call");
  handleToolEnd(state, "failed-call", true);
  roles.length = 0;
  const failed = formatFooterLine(state, 120, theme);
  assert.match(failed, /×/);
  assert.ok(roles.includes("error"));
  assert.ok(visibleWidth(failed) <= 120);
});
