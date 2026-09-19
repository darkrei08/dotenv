#!/usr/bin/env node
// OS desktop notification for herdr agent status changes.
//
// herdr's own popups ([ui.toast]) are skipped for panes in the active tab of the
// focused workspace, so an agent that needs input in a pane you are not looking
// at stays silent as soon as sound is muted. This hook runs on every
// pane.agent_status_changed event, in every tab, and never suppresses.
//
// Usage: `node notify.mjs` as a herdr [[events]] hook (reads
// HERDR_PLUGIN_EVENT_JSON), `--test` for one manual notification, and
// `--self-test` for the pure-logic checks.

import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const EVENT_TEXT = { blocked: "needs input", done: "finished" };
const URGENCY = { blocked: "critical", done: "normal" };

// WinRT toast through Windows PowerShell: no module, no extra install. The AppId
// is the PowerShell AUMID Windows already registers, which a non-packaged app
// needs for the toast to be accepted.
const WINDOWS_TOAST = [
  "$ErrorActionPreference = 'Stop'",
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null",
  "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
  "$x = $t.GetElementsByTagName('text')",
  "$x.Item(0).AppendChild($t.CreateTextNode($env:HERDR_NOTIFY_TITLE)) > $null",
  "$x.Item(1).AppendChild($t.CreateTextNode($env:HERDR_NOTIFY_BODY)) > $null",
  "$a = $t.CreateElement('audio')",
  "$a.SetAttribute('silent', 'true')",
  "$t.DocumentElement.AppendChild($a) > $null",
  "$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
  "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($t))",
].join("; ");

function isWsl() {
  if (process.platform !== "linux") return false;
  try {
    return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function notify(title, body, urgency) {
  if (process.platform === "darwin") {
    // Title and body travel as argv, so neither is interpolated into AppleScript.
    return spawnSync(
      "osascript",
      [
        "-e", "on run argv",
        "-e", "display notification (item 2 of argv) with title (item 1 of argv)",
        "-e", "end run",
        title,
        body,
      ],
      { stdio: "ignore", timeout: 10000 },
    );
  }

  if (process.platform === "win32") {
    return spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_TOAST], {
      stdio: "ignore",
      timeout: 10000,
      env: { ...process.env, HERDR_NOTIFY_TITLE: title, HERDR_NOTIFY_BODY: body },
    });
  }

  if (isWsl()) {
    return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_TOAST], {
      stdio: "ignore",
      timeout: 10000,
      env: { ...process.env, HERDR_NOTIFY_TITLE: title, HERDR_NOTIFY_BODY: body },
    });
  }

  return spawnSync("notify-send", ["-a", "herdr", "-u", urgency, "--", title, body], {
    stdio: "ignore",
    timeout: 10000,
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw ?? "{}") ?? {};
  } catch {
    return {};
  }
}

// Tests can pin a session; normal events resolve it through herdr.
function agentSessionPath(paneId) {
  const override = process.env.HERDR_NOTIFY_SESSION_PATH;
  if (override) return override;
  if (!paneId) return undefined;
  try {
    const result = spawnSync(process.env.HERDR_BIN_PATH ?? "herdr", ["agent", "get", paneId], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    });
    if (result.error || result.status !== 0) return undefined;
    const path = parseJson(result.stdout).result?.agent?.agent_session?.value;
    return typeof path === "string" && path ? path : undefined;
  } catch {
    return undefined;
  }
}

function readTail(path, maxBytes = 65536) {
  let fd;
  try {
    const size = statSync(path).size;
    const start = Math.max(0, size - maxBytes);
    const readStart = start > 0 ? start - 1 : start;
    fd = openSync(path, "r");
    const buffer = Buffer.alloc(size - readStart);
    const bytes = readSync(fd, buffer, 0, buffer.length, readStart);
    let text = buffer.subarray(0, bytes).toString("utf8");
    if (start > 0) {
      if (text.startsWith("\n")) {
        text = text.slice(1);
      } else {
        const newline = text.indexOf("\n");
        text = newline === -1 ? "" : text.slice(newline + 1);
      }
    }
    return text;
  } catch {
    return "";
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // The read already failed or completed; there is nothing to report.
      }
    }
  }
}

function pendingQuestion(sessionPath) {
  if (!sessionPath) return undefined;
  const answeredToolCallIds = new Set();
  const lines = readTail(sessionPath).split(/\r?\n/);
  for (let line = lines.length - 1; line >= 0; line -= 1) {
    const record = parseJson(lines[line]);
    const message = record.type === "message" ? record.message : undefined;
    if (message?.role === "toolResult" && typeof message.toolCallId === "string") {
      answeredToolCallIds.add(message.toolCallId);
    }
    const content = message?.role === "assistant" ? message.content : undefined;
    if (!Array.isArray(content)) continue;
    for (let index = content.length - 1; index >= 0; index -= 1) {
      const call = content[index];
      if (call?.type !== "toolCall" || !["questionnaire", "ask_user_choice"].includes(call.name)) continue;
      if (answeredToolCallIds.has(call.id)) continue;
      if (Array.isArray(call.arguments?.questions) && call.arguments.questions.length > 0) {
        return { tool: call.name, questions: call.arguments.questions };
      }
    }
  }
  return undefined;
}

function category(event, question) {
  if (event.agent_status === "done") return { emoji: "✅", reason: "finished" };
  if (event.agent_status === "blocked" && question) return { emoji: "❓", reason: "needs your answer" };
  if (event.agent_status === "blocked") return { emoji: "✋", reason: "needs input" };
  return { emoji: "🔔", reason: event.agent_status ?? "event" };
}

// Plain text only: KDE Plasma renders the freedesktop markup subset literally (verified on 6.7.5, with and without the body-markup hint), so tags would show up as text instead of bold.
function limitText(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function formatBody({ event, ctx, question }) {
  const questions = Array.isArray(question?.questions) ? question.questions : [];
  const item = questions[0];
  const lines = [];
  if (item && typeof item === "object") {
    const prompt = String(item.prompt ?? item.label ?? "");
    const prefix = question.tool && question.tool !== "questionnaire" ? `${question.tool}: ` : "";
    const more = questions.length > 1 ? ` (+${questions.length - 1} more question${questions.length === 2 ? "" : "s"})` : "";
    lines.push(`${prefix}${prompt}${more}`);
    const options = Array.isArray(item.options) ? item.options : [];
    for (const [index, option] of options.slice(0, 4).entries()) {
      const label = option?.label ?? option?.value ?? "";
      const description = option?.description ? ` - ${option.description}` : "";
      lines.push(`${index + 1}. ${label}${description}`);
    }
    if (item.recommendation) {
      lines.push(`Suggested: ${item.recommendation}`);
    }
    lines.push("");
  }
  lines.push(location(ctx) || event.title || "herdr");
  lines.push(`pane ${event.pane_id ?? ""}`);
  return limitText(lines.join("\n"), 400);
}

function formatTitle({ event, ctx, kind }) {
  const agent = ctx.focused_pane_agent ?? event.display_agent ?? event.agent ?? "agent";
  const suffix = ctx.workspace_label && ctx.tab_label
    ? ` · ${ctx.workspace_label} / ${ctx.tab_label}`
    : "";
  return limitText(`${kind.emoji} ${agent} ${kind.reason}${suffix}`, 79);
}

// herdr also emits the event for presentation-only changes, so the same pane
// status must not re-notify. One file under HERDR_PLUGIN_STATE_DIR tracks it.
function previousStatus(paneId) {
  const dir = process.env.HERDR_PLUGIN_STATE_DIR;
  if (!dir || !paneId) return undefined;
  try {
    return parseJson(readFileSync(join(dir, "last-status.json"), "utf8"))[paneId];
  } catch {
    return undefined;
  }
}

function rememberStatus(paneId, status) {
  const dir = process.env.HERDR_PLUGIN_STATE_DIR;
  if (!dir || !paneId) return;
  const file = join(dir, "last-status.json");
  let seen = {};
  try {
    seen = parseJson(readFileSync(file, "utf8"));
  } catch {
    seen = {};
  }
  seen[paneId] = status;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(seen));
  } catch {
    // An unwritable state dir only costs a duplicate notification.
  }
}

function forgetStatus(paneId) {
  const dir = process.env.HERDR_PLUGIN_STATE_DIR;
  if (!dir || !paneId) return;
  const file = join(dir, "last-status.json");
  let seen = {};
  try {
    seen = parseJson(readFileSync(file, "utf8"));
  } catch {
    return;
  }
  delete seen[paneId];
  try {
    writeFileSync(file, JSON.stringify(seen));
  } catch {
    // An unwritable state dir only costs a duplicate notification.
  }
}

function isRepeat(paneId, status) {
  const previous = previousStatus(paneId);
  rememberStatus(paneId, status);
  return previous === status;
}

function location(ctx) {
  const cwd = ctx.focused_pane_cwd ?? ctx.workspace_cwd ?? "";
  const parts = [ctx.workspace_label, ctx.tab_label, cwd ? basename(cwd) : ""].filter(Boolean);
  return parts.filter((part, index) => parts.indexOf(part) === index).join(" · ");
}

function handleEvent() {
  const envelope = parseJson(process.env.HERDR_PLUGIN_EVENT_JSON);
  const event = envelope.data ?? envelope;
  const previous = previousStatus(event.pane_id);
  if (isRepeat(event.pane_id, event.agent_status) || !EVENT_TEXT[event.agent_status]) return;
  const ctx = parseJson(process.env.HERDR_PLUGIN_CONTEXT_JSON);
  const question = event.agent_status === "done"
    ? undefined
    : pendingQuestion(agentSessionPath(event.pane_id));
  const kind = category(event, question);
  const title = formatTitle({ event, ctx, kind });
  const body = formatBody({ event, ctx, question });
  const result = notify(title, body, URGENCY[event.agent_status]);
  if (result.error || result.status !== 0) {
    if (previous === undefined) {
      forgetStatus(event.pane_id);
    } else {
      rememberStatus(event.pane_id, previous);
    }
    console.error(result.error
      ? `agent-notify: ${result.error.message}`
      : `agent-notify: notification backend exited ${result.status}`);
    process.exitCode = 1;
  }
}

// --self-test: pure logic only, no notification is sent.
function selfTest() {
  let failed = 0;
  const assert = (label, actual, expected) => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) return;
    failed += 1;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };

  assert("parseJson valid", parseJson('{"a":1}'), { a: 1 });
  assert("parseJson invalid", parseJson("not json"), {});

  const envelope = parseJson('{"event":"pane.agent_status_changed","data":{"agent_status":"blocked"}}');
  assert("envelope unwrap", envelope.data ?? envelope, { agent_status: "blocked" });

  assert(
    "location dedupes repeated labels",
    location({ workspace_label: "dotenv", tab_label: "api", focused_pane_cwd: "/srv/dotenv" }),
    "dotenv · api",
  );
  assert("location without cwd", location({ workspace_label: "dotenv", tab_label: "api" }), "dotenv · api");

  const doneEvent = { agent_status: "done", pane_id: "w1:p2" };
  const doneContext = { focused_pane_agent: "codex", workspace_label: "repo" };
  const doneKind = category(doneEvent, undefined);
  assert("done title", formatTitle({ event: doneEvent, ctx: doneContext, kind: doneKind }), "✅ codex finished");
  assert("done body", formatBody({ event: doneEvent, ctx: doneContext }), "repo\npane w1:p2");

  const fixtureDir = mkdtempSync(join(tmpdir(), "agent-notify-"));
  const tailPath = join(fixtureDir, "large.jsonl");
  writeFileSync(tailPath, `discarded\n${"x".repeat(80)}\nkept\n`);
  const tail = readTail(tailPath, 32);
  assert("readTail uses the last window", tail.endsWith("kept\n") && !tail.includes("discarded"), true);

  const oldQuestion = { id: "old", prompt: "old question", options: [] };
  const lastQuestion = { id: "last", prompt: "last question", options: [] };
  const toolCall = (tool, question, id) => JSON.stringify({
    type: "message",
    message: {
      role: "assistant",
      content: [{ type: "toolCall", name: tool, id, arguments: { questions: [question] } }],
    },
  });
  const answeredQuestionPath = join(fixtureDir, "answered-question.jsonl");
  writeFileSync(answeredQuestionPath, [
    toolCall("questionnaire", oldQuestion, "answered-call"),
    JSON.stringify({ type: "message", message: { role: "toolResult", toolCallId: "answered-call" } }),
    JSON.stringify({ type: "state", status: "blocked" }),
  ].join("\n"));
  assert("pending question skips answered calls", pendingQuestion(answeredQuestionPath), undefined);

  const sessionPath = join(fixtureDir, "session.jsonl");
  writeFileSync(sessionPath, [
    toolCall("questionnaire", oldQuestion, "old-call"),
    JSON.stringify({ type: "message", message: { role: "toolResult", toolCallId: "old-call" } }),
    toolCall("other_tool", { id: "other", prompt: "ignore", options: [] }, "other-call"),
    JSON.stringify({ type: "message", message: { role: "tool", content: [{ type: "toolResult" }] } }),
    toolCall("questionnaire", lastQuestion, "last-call"),
  ].join("\n"));
  assert("pending question uses the last questionnaire", pendingQuestion(sessionPath), {
    tool: "questionnaire",
    questions: [lastQuestion],
  });

  const noQuestionPath = join(fixtureDir, "no-question.jsonl");
  writeFileSync(noQuestionPath, toolCall("other_tool", { id: "other", prompt: "ignore", options: [] }));
  assert("pending question ignores unrelated calls", pendingQuestion(noQuestionPath), undefined);

  assert("category done", category({ agent_status: "done" }, undefined), { emoji: "✅", reason: "finished" });
  assert("category blocked with question", category({ agent_status: "blocked" }, { questions: [lastQuestion] }), {
    emoji: "❓",
    reason: "needs your answer",
  });
  assert("category blocked without question", category({ agent_status: "blocked" }, undefined), {
    emoji: "✋",
    reason: "needs input",
  });
  assert("category other", category({ agent_status: "working" }, undefined), { emoji: "🔔", reason: "working" });

  const sampleEvent = { pane_id: "w1:p1", agent_status: "blocked" };
  const sampleContext = {
    workspace_label: "dotenv",
    tab_label: "api",
    focused_pane_cwd: "/srv/dotenv",
    focused_pane_agent: "pi",
  };
  const sampleQuestion = {
    tool: "ask_user_choice",
    questions: [{
      prompt: "Pick a path?",
      options: [{ label: "First", description: "one" }],
      recommendation: "First",
    }],
  };
  assert(
    "formatBody plain",
    formatBody({ event: sampleEvent, ctx: sampleContext, question: sampleQuestion }),
    "ask_user_choice: Pick a path?\n1. First - one\nSuggested: First\n\ndotenv · api\npane w1:p1",
  );
  const longBody = formatBody({
    event: sampleEvent,
    ctx: sampleContext,
    question: { tool: "questionnaire", questions: [{ prompt: "x".repeat(500), options: [] }] },
  });
  assert(
    "formatBody caps at 400 characters",
    longBody.startsWith("x".repeat(20)) && longBody.length === 400 && longBody.endsWith("..."),
    true,
  );
  const titleKind = category(sampleEvent, sampleQuestion);
  const title = formatTitle({ event: sampleEvent, ctx: { ...sampleContext, workspace_label: "git", tab_label: "herder notify" }, kind: titleKind });
  assert("title shape", title, "❓ pi needs your answer · git / herder notify");
  assert("title stays under 80 characters", title.length < 80, true);

  process.env.HERDR_PLUGIN_STATE_DIR = mkdtempSync(join(tmpdir(), "agent-notify-"));
  assert("first blocked is new", isRepeat("w1:p1", "blocked"), false);
  assert("same status repeats", isRepeat("w1:p1", "blocked"), true);
  assert("blocked to working is new", isRepeat("w1:p1", "working"), false);
  assert("blocked after working is new", isRepeat("w1:p1", "blocked"), false);
  assert("working alone is not notifiable", category({ agent_status: "working" }, undefined), {
    emoji: "🔔",
    reason: "working",
  });
  assert("other pane is new", isRepeat("w1:p2", "blocked"), false);
  assert("status change is new", isRepeat("w1:p1", "done"), false);

  if (failed > 0) {
    console.error(`self-test: ${failed} failure(s)`);
    process.exitCode = 1;
    return;
  }
  console.log("self-test: ok");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else if (process.argv.includes("--test")) {
  const event = { pane_id: "test:p1", agent_status: "blocked", display_agent: "pi" };
  const ctx = {
    workspace_label: "test",
    tab_label: "manual",
    focused_pane_cwd: "/tmp",
    focused_pane_agent: "pi",
  };
  const question = {
    tool: "questionnaire",
    questions: [{
      prompt: "Which path should I take?",
      options: [
        { label: "Continue", description: "keep working" },
        { label: "Stop", description: "end the turn" },
      ],
      recommendation: "Continue",
    }],
  };
  const kind = category(event, question);
  const probe = notify(
    formatTitle({ event, ctx, kind }),
    formatBody({ event, ctx, question }),
    "normal",
  );
  if (probe.error || probe.status !== 0) {
    console.error(`agent-notify: test notification failed (${probe.error?.message ?? `exit ${probe.status}`})`);
    process.exitCode = 1;
  }
} else {
  handleEvent();
}
