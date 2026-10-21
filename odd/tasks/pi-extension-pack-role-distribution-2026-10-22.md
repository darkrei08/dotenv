# Pi extension-pack role distribution
Issue: darkrei08/dotenv#73
Branch: feat/subagents-definitive-filter-normalization
Objective: install the owned `gwelinder/pi-extension-pack` package and expose only role-appropriate resources to Pi workflow and Herdr child agents.

## Specs
S1. User: "Benissimo, allora installa le estensioni da te suggerite ed distribuiscile in base anche alle tipologie di ruoli che abbiamo individuato rispetto anche agli alias, e pertanto quindi installa aggiorna il mio dot tempo localmente, fai il relo di tutte le sessioni P e pubblica poi i rispettivi commit sul mio repo dotenv"

S2. Install the upstream Pi package and align the role aliases with the refreshed gateway-first model matrix, keeping the reviewer/GGA route at medium.

S3. Distribute resources by role: coding workers may use bash-fixer, tool-fixer, and codegraph; research workers may use codegraph, exa, and rich-fetch; reviewer/security workers may use codegraph and dcg-guard when available; UI workers may use frontend-stack, codex-ui-design, and codex-ui-gallery.

S4. Keep parent-only resources out of generic children: pi-memory-system, skill-gateway, tool-profiles, worker-prompt-compiler, duel-deck, skill-observer, skill-update-checker, and harness telemetry.

S5. Use agent-mail-coordination only for agents sharing a checkout; isolated Herdr/workflow worktrees use the existing orchestration ownership model.

S6. Verify package installation, effective role selectors, configuration, reload behavior, and relevant tests. Preserve unrelated pre-existing worktree changes.

## Tasks
T1 [S1,S2,S6] inspect current branch, issue gate, package manifests, role selectors, and live session inventory; route: master; commit: pending.
T2 [S2,S3,S4,S5] define exact package and role distribution matrix; route: architecture/config; commit: pending.
T3 [S1,S2,S3,S4,S5] update package manifest, settings, role selectors, docs/checks as required; route: config owner; commit: pending.
T4 [S1,S6] install/update live package and reload active Pi sessions; route: runtime owner; commit: none.
T5 [S6] run configuration/package/runtime checks, commit coherent work units, and push; route: master; commit: pending.

## Log
L1 (2026-10-22) Original request verbatim: "Benissimo, allora installa le estensioni da te suggerite ed distribuiscile in base anche alle tipologie di ruoli che abbiamo individuato rispetto anche agli alias, e pertanto quindi installa aggiorna il mio dot tempo localmente, fai il relo di tutte le sessioni P e pubblica poi i rispettivi commit sul mio repo dotenv"
L2 Read-only analysis concluded that runtime extensions must not be blanket-shared. Child roles need explicit selectors; parent-only memory/routing/prompt compiler/telemetry remain excluded. Current repository already uses `extensions: ["!*, ..."]` role ceilings and medium aliases.
L3 Issue #73 created with `enhancement`, `status:approved`, and `type:feature` labels before implementation.
L4 (2026-10-22) User decision: "Mantieni la nuova matrice". The refreshed matrix supersedes the previous medium-only assumption for routine, test, research, and Gemini fallback routes; reviewer/GGA remains medium.
