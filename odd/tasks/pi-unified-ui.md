# Pi unified UI and Gentle Shell comparison
Feature ledger for the authorized comparison and smallest compatible unified Pi UI slice. Read through `## Log` before editing.

## Specs

S1. "ti aggiungi che esiste anceh la tui di gentle-ai che devi confrontare e caprire. dopo possiamo creare una mia estensionezionem che inglobi le migliori di tutte le altre estensioni"

S2. "il problema dello screenshort lo risolviamo dopo, aggiingilo come pr"

S3. "ora prosegui con i task che stavi analizzando"

S4. "Esegui aggiornamento locale con rispettiva attivazione della UnifiedUI.ts"

## Tasks

- T1 [S1,S3] Compare Gentle Shell with pi-cc-tools, pi-subagents, pi-context-bar, pi-polish, native Pi TUI, PiWorkflow, and current dotenv UI surfaces; route: master; commit: none (analysis complete).
- T2 [S1,S3] Define one presentation owner, adapter boundaries, public Pi TUI contracts, and the minimum unified UI slice without duplicating workflow or subagent execution; route: architecture; commit: none (complete).
- T3 [S1,S3,S4] Implement and activate the unified UI extension slice with tests and documentation; route: implementation; commit: complete.
- T4 [S2] Investigate and fix Windows Terminal screenshot transport and user-visible inline image delivery; route: runtime/UI; commit: pending and intentionally deferred.
- T5 [S1-S4] Run width, headless/RPC, startup, regression, and accessibility-oriented checks; record evidence and limitations; route: verification; commit: complete.
- T6 [S4] Sync the local Pi profile, commit the coherent Unified UI slice, and push it to the user's dotenv remote; route: delivery; commit: pending.
- T7 [S2,S4] Launch a separate PiWorkflow session for SDK dependency repair, screenshot transport, and local/remote forwarding checks; route: follow-up; commit: pending.

## Log

L1. User request: "ti aggiungi che esiste anceh la tui di gentle-ai che devi confrontare e caprire. dopo possiamo creare una mia estensionezionem che inglobi le migliori di tutte le altre estensioni"
L2. User follow-up: "il problema dello screenshort lo risolviamo dopo, aggiingilo come pr"
L3. User continuation: "ora prosegui con i task che stavi analizzando"
L4. Read-only findings before implementation: Gentle Shell/gentle-pi is the most complete integrated presentation baseline. It aggregates parent-visible subagent state rather than inheriting the parent TUI into child processes; it provides context/cost gauges, TODO, changes, usage, responsive status surfaces, overlays, keyboard/mouse paths, and card styles. The current dotenv configuration intentionally excludes Gentle's quiet-tools, presentation, codegraph, and standalone-agent extensions while PiWorkflow remains the workflow/subagent execution owner. The repository's `live-dashboard.ts` is telemetry-only and currently has known integrity, privacy, and performance risks; it is not a suitable UI ownership layer.
L5. Architecture direction: prefer a thin optional adapter/presentation extension over a second scheduler, second subagent runtime, or fork of Gentle Shell. Use public Pi TUI/widget/status/overlay APIs where possible; keep workflow state owned by PiWorkflow and child execution owned by the configured executor. Do not change source configuration or install packages until T2 is complete.
L6. T2 verification: the active `gentle-pi` package registers `gentle-shell.ts`, which calls `ctx.ui.setFooter`; the configured exclusions do not remove that file. Pi exposes `pi.events` with public `on(channel, handler)` and PiWorkflow exports typed lifecycle channel constants for run, agent, phase, and budget events. The first slice will therefore avoid `setFooter`, use a unique `unified-ui` widget, and consume only validated same-session event payloads. When workflow events are unavailable, the widget reports no workflow state instead of polling files or inferring it from transcript text.
L7. T2 decision from the read-only architecture review: the first slice is opt-in via `/unified-ui`, owns only derived local presentation state, uses no network/filesystem/timers beyond one coalesced repaint timer, and remains silent in headless/RPC mode. The Windows Terminal screenshot issue remains a separate deferred task.
L8. T3 implementation: added `pi/agent/extensions/unified-ui.ts` and `unified-ui.test.ts`. The adapter uses the public Pi widget and event-bus APIs, validates same-session workflow payloads, tracks tool calls by ID, renders agent/tool/context/workflow summaries in two bounded rows, coalesces repaint requests, and cleans up on session replacement/shutdown. It does not modify settings, install packages, patch the footer, or start an executor.
L9. T5 verification: focused unit tests pass 5/5, Bun build passes, `check-config.sh` passes, workflow-intent regression passes, mock TUI registration stays within 24 visible columns, and whitespace checks pass. Full TypeScript checking remains blocked by unrelated installed SDK/dependency diagnostics and reports no `unified-ui.ts` diagnostic. Evidence is in `odd/pi-unified-ui/verification.md`.
L10. Requirement change: the user explicitly authorized local activation of Unified UI. Interactive TUI sessions now mount the widget during `session_start`; print/RPC/headless sessions remain silent and `/unified-ui off` remains available. This reopens T3 for focused verification before delivery.
L11. User delivery request: "Esegui aggiornamento locale con rispettiva attivazione della UnifiedUI.ts ed esegui anche il commit locale con rispettivo push verso il mio dot env così ho tutta la impostazione corretta, dopodiché, chiudi questa sessione, ma nel frattempo ne apri un'altra di Piegen sempre in dot envo in cui si procede con la correzione delle dipendenze S dK e con la pull request degli screenshot da inviare verso il terminale. Potrebbe essere utile forse controllare anche il local forward e il remote forward."
L12. User directive: "Procedi quindi all'aggiornamento locale, effettua tutti i controlli del caso per non esserci sovrapposizioni, effettua poi anche con Guardian Angel delle validazioni a lungo termine delle operazioni effettuate e dove di che esegui il commit anche verso la repo ed esegui poi il reload di questa sessione per capire se il tutto funziona e se ti è utile poi effettuare anche dei test con p harder orchestrations."
L13. Sovereign Unified UI implemented: absorbed Gentle Shell's 8-cell tacchette gauge (▰▰▰▱▱▱▱▱) with dynamic tone thresholds (<80% accent, 80-94% warning, >=95% error), dim separators (⟡), cost ($) from session entries, token formatters, Git branch and dirty status, and Claude Code zero-overhead aboveEditor widget (returns 0 lines when idle). Excluded gentle-shell.ts in settings.json to prevent footer conflicts. Unit tests pass 9/9; check-config, skill-collision, medium-effort-policy pass. GGA code review executed and resolved. Local sync completed via sync_pi.
