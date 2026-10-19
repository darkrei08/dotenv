# Issue 143 assessment: model fit, automatic failover, and pi-ext-roles

Local-only work unit. Remote push, merge, and issue closure remain deferred.

## Specs

1. **S1** — "analizzando i motiic per cui pi model fit abbia usato gemini 3 e non altri modelli aggiornati per effort conusmo token e capacita se necessario amplica le conoscenze ed i criteri di assegnazione dei modelli per pi model fit JJ"
2. **S2** — "in piu devi fare in modo che la matrice di modelli base e di fail over si attivi automaticmante e quinid non debba ogni volta modificare il modello s enon funziona o non fa partire pi workflow"
3. **S3** — "inoltre aggiorna in modo analitico e perofmante anche i ruoli in pi ext role mio"
4. **S4** — "aggiungi al task ache di dover usare direttamente tutti i modelli disponibili in cliproxy api (evitanto i nativi - solo failover ove necessari e quelli di opencode go - in questo caso se usavo luna con lui avrei perso tutti e subutio il pinao) riscrivi meglio i modelli e model fit"

## Verified baseline

- `pi-model-fit` inventory reports current aliases and roles, but the configured `cliproxyapi/claude-opus-5-5` route can fail at workflow runtime with an unknown-provider/model error despite stale local availability metadata.
- Gemini 3.8 Flash High is configured as an explicit fallback for scout/developer/tests, not as the base for those roles.
- `pi-high-availability` classifies quota, capacity, and authentication failures after `turn_end`; the repository-owned `pi-ha-bootstrap.mjs` adds startup model selection and unknown-provider recovery around that third-party extension.
- `ha-failover.example.json` is a credentials-free template. The live `~/.pi/agent/ha.json` is outside this repository and must not be overwritten or committed.
- Model-fit role constraints require context and output budgets, effort support, provider availability evidence, and cost/latency fit; unverified models cannot silently replace verified primaries.

## Tasks

- T1 (S1, S4): Produce a dated model-fit report explaining Gemini 3 selection versus newer available candidates by capability, effort levels, context/output limits, token cost, latency tier, bridge/provider, subscription-plan impact, and verified availability. Base routing must use CLIProxyAPI directly; native and OpenCode Go routes are explicit emergency failover only.
- T2 (S2, S4): Make the tracked base/failover matrix self-activating for PiWorkflow without overwriting credentials or requiring manual model replacement after a startup/provider failure; add deterministic tests for supported failure paths and fail-closed behavior for unknown models. Keep the automatic matrix CLIProxyAPI-first and free of native/OpenCode Go defaults.
- T3 (S3, S4): Update `pi-ext-roles` aliases and role assignments only where the evidence-based rubric supports it; use direct CLIProxyAPI targets for normal roles, keep role prompts and tool boundaries stable, and reserve native/OpenCode Go aliases for explicit failover paths.

## Allowed edit surfaces

- `pi/agent/pi-ext-roles/settings.json`
- `pi/agent/pi-ext-roles/roles/*.md` frontmatter model fields only
- `setup_env.sh`
- `agents/gga-pi/bin/kilo`
- `agents/gga-pi/run-gga.sh`
- `agents/gga-pi.test.mjs`
- `pi/agent/bin/pi-ha`
- `pi/agent/bin/pi-ha.test.mjs`
- `pi/agent/ha-failover.example.json`
- `pi/agent/pi-ext-roles/settings.json`
- `pi/agent/pi-ext-roles/roles/*.md` frontmatter model fields only
- `pi/agent/extensions/pi-ext-workflows/*.ts`
- `pi/agent/extensions/pi-ext-workflows/*.test.ts`
- `pi/agent/extensions/pi-ha-bootstrap.mjs`
- `pi/agent/extensions/pi-ha-bootstrap.test.mjs`
- `pi/agent/extensions/piextworkflows.ts`
- `pi/agent/README.md`
- `pi/agent/MODELS.md`
- `docs/pi-configuration.md`
- `docs/setup-reference.md`
- `check-config.sh`
- `REVIEW_RULES.md`
- `odd/tasks/issue143-model-fit-failover.md`
- `reports/YYYY-MM-DD.md`

## Log

- L1: User authorized local commits first; remote merge and closure are deferred.
- L2: Read-only workflow assessment used explicit failover models after the configured Claude reviewer route failed with `unknown provider for model claude-opus-5-5`.
- L3: The base-routing policy is CLIProxyAPI-first: do not route Luna through OpenCode Go for normal work because that consumes the wrong provider plan/quota; native and OpenCode Go routes remain only as explicit emergency failover candidates.
- L4: Implemented the idempotent `pi-ha ensure` bootstrap, added the credentials-free template to `sync_pi`, and added native Node tests for missing-config creation, preservation, and byte-for-byte idempotence. The automatic matrix is CLIProxyAPI-only; the repository-owned `pi-ha-bootstrap.mjs` handles startup model selection and unknown-provider recovery before/after the third-party HA extension.
- L5: Updated `pi-ext-roles` Scout and Gemini reviewer routes to direct CLIProxyAPI models, aligned README/MODELS/docs/check-config, and wrote `reports/2026-10-19.md`. Focused tests, isolated `check-config.sh`, JSON/syntax checks, structural routing assertions, and Debian 13, Fedora, Arch, openSUSE, and Alpine container checks passed. Full installer execution and Windows/macOS checks were not run.
- L3: Implemented T2 only. `sync_pi` now allowlists `ha-failover.example.json`, then invokes `~/.pi/agent/bin/pi-ha ensure`. The idempotent `ensure` command creates a missing `ha.json` from the tracked credentials-free template; for an existing file it adds only absent template groups and `defaultGroup`, preserving credentials, `activeGroup`, existing/custom groups, and unrelated runtime state. No issue-61 files were edited by this work unit.
- L4: Deterministic tests passed: `node --test pi/agent/bin/pi-ha.test.mjs` -> 3 tests passed (missing-config creation and activation, existing-config preservation, repeat byte-for-byte idempotence). Additional checks passed: `python3` compile check for `pi/agent/bin/pi-ha`, `bash -n setup_env.sh`, `bash check-config.sh` -> `config check passed`, and `git diff --check`.
- L5: Container evidence passed with the project's claimed Linux families. Debian 13 image `debian@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5`: `PI_HA_CONFIG=/tmp/pi-ha-missing.json python3 pi/agent/bin/pi-ha --json ensure` plus assertions -> `debian: missing-config creation passed`; `bash -n setup_env.sh` passed. Arch image `archlinux@sha256:3c64b538588416593f69a1aebd2f2ec0f2541b29159f32556fa7def2167147a0`: the same ensure/assertion command -> `arch: missing-config creation passed`; `bash -n setup_env.sh` passed. Full `setup_env.sh` provisioning and Windows verification were not run in this worktree.
- L6: The user chose the task-approved CLIProxyAPI-first policy over the stale GGA rule: Scout remains direct CLIProxyAPI Gemini, and GGA may fail over only through configured CLIProxyAPI gateway models. `REVIEW_RULES.md` was updated accordingly. Full installer matrix attempts reached setup package installation; Debian stopped because the base image has no `glab` package, and Arch stopped because GGA was invoked outside a Git repository after provisioning.
- L7: Added `pi-ha-bootstrap.mjs` and deterministic tests. On session start it selects the first available active-matrix entry when the configured model is missing; on unknown-provider/model turn errors it selects the next gateway entry and replays the failed prompt once without editing credentials or model settings.
- L8: GGA identified that model IDs such as GPT-6 Luna occur in multiple role profiles, so the bootstrap now accepts `PI_HA_GROUP` from a role launcher and otherwise uses active/default group. It no longer claims to infer a workflow role from the model ID.
