# Herdr agent-notify: richer request notifications

## Problem

The plugin notifies `blocked`/`done` with `agent · event` plus a location line, but the human
cannot tell *what* is being asked: the pending question, the options, and the recommendation are
missing, and the request is not categorised. The user asked for a notification that names the
pane and tab and shows the actual question, with an emoji category.

## Verified facts (herdr source at 5a244caa, live checks on this host)

- `HERDR_PLUGIN_EVENT_JSON.data` carries only `pane_id`, `workspace_id`, `agent_status`,
  `input_pending`, `input_prompt_kind`, `agent`, `title`, `display_agent`, `state_labels`, `turn`,
  `turn_epoch`. No question text.
- `HERDR_PLUGIN_CONTEXT_JSON` carries `workspace_label`, `tab_label`, `workspace_cwd`,
  `focused_pane_id`, `focused_pane_cwd`, `focused_pane_agent`, `focused_pane_status`, `worktree`.
  Verified live: `git · herder notify · tmp` for workspace `git`, tab `herder notify`, cwd `/tmp`.
- `input_prompt_kind` is **null** for pi panes (the pi integration reports state through
  `pane.report_agent`, and herdr then sets `screen_detection_skip_reason: full_lifecycle_hook_authority`).
- `herdr agent get <pane_id>` returns `agent_session.value`, the absolute path of the pi session
  JSONL (`~/.pi/agent/sessions/<project-dir>/<timestamp>_<uuid>.jsonl`). Verified live.
- That JSONL contains the pending tool call as a `message` record, `role: assistant`,
  `content[]` entry `{"type":"toolCall","name":"questionnaire","id":"call_...","arguments":{...}}`
  with `arguments.questions[]` = `{id, label, prompt, recommendation?, options[{value,label,description?}]}`.
  Verified live on a real blocked pane.
- A `blocked` pi pane means the tool is still executing, so the **last** `questionnaire` /
  `ask_user_choice` tool call in the file is the pending one. `toolResult` records carry
  `message.toolCallId`, and matching it to the tool call's `id` avoids replaying an answered
  question.
- `notify-send` reaches KDE Plasma 6.7.5 `org.freedesktop.Notifications.Notify` (verified on D-Bus).
  The freedesktop spec allows a limited HTML subset (`<b> <i> <u> <a>`) in summary/body; the
  daemon may ignore it. macOS `osascript` and the Windows toast are plain text.

## Design

One extra step in the existing hook, no new files, no new dependencies. Use plain text only:
KDE renders the freedesktop markup subset literally.

1. `herdr agent get <pane_id>` (via `HERDR_BIN_PATH`) -> `agent_session.value`.
2. Read the tail of that file (last 64 KiB), walk backwards to the last tool call named
   `questionnaire` or `ask_user_choice`, parse `arguments.questions[]`.
3. Compose:
   - summary: `<emoji> <agent> <reason> · <workspace> / <tab>`
   - body: the first question only, numbered options with descriptions, recommendation, then a
     location line `workspace · tab · cwd` and `pane <id>`. When more questions exist, append a
     `(+N more questions)` marker to the question line.
4. Categorise by emoji: `❓` request with a question, `✋` blocked without one, `✅` finished,
   `🔔` other.
5. Degrade in order: question from the session file -> `input_prompt_kind`/`state_labels`/`title`
   from herdr -> today's plain `agent · event` + location.
6. Cap the body (~400 chars) so the popup stays readable.

## Tasks

1. Extend `herdr/plugins/agent-notify/notify.mjs`: session lookup, tail parse, question
   extraction, emoji category, plain-text body, and `--self-test` coverage for the new pure
   functions.
2. Fix the stale `Known gaps` bullet about `herdr-agent-state.ts` (the integration is installed now)
   and document the enrichment plus its limits in the `Herdr agent notifications` section of
   `README.md`.
3. Verify: `--self-test` green, a real blocked pane produces a notification carrying the actual
   question, and the previous `done` path still works.
