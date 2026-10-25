# Issues #61, #69, #73 and compactor follow-up

Tracking document for the authorized dotenv follow-up after the comprehensive repository audit.

## Specs

- **S1**: "implementale  - Issue #61, #69, #73: parzialmente implementate. procedi per pivcc o altra - Issue #25 e #29: pendenti per decisione sul compactor."
- **S2**: "procedi con la risoluzioen di  ### Prossime decisioni\n\n 1. Autorizzare o rinviare push/PR per Issue #82.\n 2. Autorizzare la chiusura formale di Issue #65.\n 3. Decidere la gestione dei worktree sporchi/abbandonati.\n 4. Risolvere permessi upstream per vekexasia/dotenv#6.\n 5. Decidere Issue #29, che blocca Issue #25."
- **S3**: "procedi con altro task in alatra sesisone pi in altro pane o tabs eherdr usando pi herder ochestration epr risolvere questo task annoso di gga o non esecuzione sqwith automatico a rauntime ai modelli di failover disponibilie  elggibili da cliproxy api"
  - Example: "PROVIDER=\"kilo:reviewer-ha\""
  - Required behavior: "model-preflight resta la fonte unica"; "Resolver condiviso"; "PiWorkflow" resolves the model at agent creation; "GGA" resolves `reviewer-ha` from the same runtime report; stale or unknown evidence fails closed.

## Tasks

- T1 (S2, delivery): Push `fix/chief-orchestrator-authority`, open its issue-linked PR, and close #65 only after verifying merged PR evidence. Commit: `837a2e1`; PR: #83.
- T2 (S1, Issue #61): Complete the approved `tool_search` parent activation and researcher selector correction with regression checks. Commit: `08e877eeb43cd7b659560bc48aaf13cc972539ac` (branch `fix/issues-61-69-73-20261024`).
- T3 (S1, Issue #69): Complete the approved model-availability preflight integration using the existing isolated prototype, with fail-closed cache and routing tests. Commit: `77c33e54b68ae24f5a2e88a0b0ca71f30743b2f5` (branch `fix/issues-61-69-73-20261024`).
- T4 (S1, Issue #73): Complete role-scoped pi-extension-pack capability distribution with package/config consistency and bounded runtime verification. Commit: `b69be8bb231ee4e8150495f553f19154a4f8ad25` and `dcfb712c98d63d839352e89a59b20e0ffb2a0c4f` (branch `fix/issues-61-69-73-20261024`).
- T5 (S1-S2, Issues #25/#29): Compare Pi VCC, pi-codex-context, and native Pi compaction without changing the selected policy until the comparison is accepted. Commit: pending.
- T6 (S2, worktrees): Verify candidate worktrees and discard only explicitly confirmed stale targets; preserve dirty user changes until individually classified. Commit: none.
- T7 (S3, runtime routing): Implement a shared runtime CLIProxyAPI model router consumed by model-preflight, PiWorkflow, and GGA; preserve static aliases/HA bootstrap, use fresh reachable evidence, fail closed on stale/unknown reports, and add focused cross-consumer tests. Commits: `25b89cf` and `c37ddb6` (branch `feat/runtime-model-router-20261024`).

## Log

- **L1**: "implementale  - Issue #61, #69, #73: parzialmente implementate. procedi per pivcc o altra - Issue #25 e #29: pendenti per decisione sul compactor.\n\nprocedi con la risoluzioen di  ### Prossime decisioni\n\n 1. Autorizzare o rinviare push/PR per Issue #82.\n 2. Autorizzare la chiusura formale di Issue #65.\n 3. Decidere la gestione dei worktree sporchi/abbandonati.\n 4. Risolvere permessi upstream per vekexasia/dotenv#6.\n 5. Decidere Issue #29, che blocca Issue #25."
- **L2**: User selected: compare compactor options before changing policy; execute push/PR for #82 and formal closure of #65; authorize targeted discard only after verification.
- **L3**: PR #83 was opened for Issue #82 and Issue #65 was closed after verifying merged PRs #79 and #81. The upstream `vekexasia/dotenv#6` route remains out of scope for delivery because this repository is the user's personal fork and prior project direction excludes an upstream PR.
- **L4**: "procedi con altro task in alatra sesisone pi in altro pane o tabs eherdr usando pi herder ochestration epr risolvere questo task annoso di gga o non esecuzione sqwith automatico a rauntime ai modelli di failover disponibilie  elggibili da cliproxy api:\n\nSì. La soluzione corretta è introdurre un runtime model router condiviso tra PiWorkflow e GGA.\n\n### Architettura proposta\n\n1. model-preflight resta la fonte unica\n2. Resolver condiviso\n3. PiWorkflow risolve il modello al momento della creazione dell’agente\n4. GGA usa un selettore simbolico e lo stesso report runtime\n5. ha.json resta bootstrap statico, non riscritto a ogni sessione"
- **L5**: Verified completion of T2, T3, T4 on branch `fix/issues-61-69-73-20261024` with 4 reviewable commits (`08e877e`, `77c33e5`, `b69be8b`, `dcfb712`), 7/7 test suites passing, and live GGA pre-commit passed with HA failover. Verified completion of T7 on branch `feat/runtime-model-router-20261024` with 2 reviewable commits (`25b89cf`, `c37ddb6`), 42/42 tests passing, check-config passing, and live GGA pre-commit passed using `kilo:reviewer-ha` with failover to `gemini-3.8-flash-high:high`.
