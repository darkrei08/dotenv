# Pi unified UI verification

## Scope

This record covers the first `unified-ui.ts` presentation slice. The Windows Terminal screenshot transport task is intentionally deferred.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Focused unit tests | PASS | `bun test pi/agent/extensions/unified-ui.test.ts` — 5 passed, 0 failed |
| Width and sanitization coverage | PASS | Focused tests cover bounded rows, same-session workflow events, rendered active-agent count, malformed payloads, toolCallId tracking, context clamping, and secret/raw-detail exclusion |
| Bun build | PASS | `bun build pi/agent/extensions/unified-ui.ts --target=node --packages=external --outfile=/tmp/pi-unified-ui.js` — exit 0 |
| Configuration regression | PASS | `bash check-config.sh` — `config check passed` |
| Workflow routing regression | PASS | `node --test pi/agent/extensions/workflow-intent.test.mjs` — all reported subtests passed |
| TUI registration smoke | PASS | Mock TUI `session_start` auto-activation registered one widget, rendered two rows, and stayed within 24 visible columns; headless command remained a no-op |
| Full TypeScript check | BLOCKED | `bunx tsc --noEmit -p pi/agent/tsconfig.json` fails on pre-existing installed SDK/dependency issues: Pi AI JSON import attributes, Pi path typings, missing MCP typings, Bun test typings, and existing extension errors. The filtered output contains no `unified-ui.ts` diagnostic. |
| Diff whitespace | PASS | `git diff --check` and trailing-whitespace scan for new files returned clean |

## Runtime boundaries

- Interactive TUI sessions mount the widget automatically; `/unified-ui off` disables it for the session and `/unified-ui on` re-enables it.
- Headless/print/RPC command handling is a no-op and does not notify or mount a widget.
- Gentle Shell retains footer ownership; PiWorkflow retains workflow and child-agent execution ownership.
- The adapter uses a unique widget key and public `pi.events` channels only.
- No network, filesystem polling, raw prompt/tool payload display, or second scheduler is introduced.

## Environment note

The repository checkout does not vendor Pi runtime packages. Local ignored symlinks under `pi/agent/node_modules` and `pi/agent/extensions/node_modules` point to the installed Pi runtime solely to run the focused checks; these paths are not tracked changes.
