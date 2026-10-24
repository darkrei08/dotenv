# Pi ecosystem activation and routing
Feature ledger for the authorized Pi orchestration consolidation. Read through `## Log` before editing.

## Specs

S1. "Implement a permanent ownership and namespace strategy."

S2. "One authoritative skill registration per logical capability."

S3. "Implement a repeatable collision audit that detects regressions after installation, upgrade or reload."

S4. "A user must be able to request a workflow naturally, without memorizing internal command syntax."

S5. "Examples:

“Review this repository, identify the critical problems and fix them.”

“Launch parallel code review and security analysis.”

“Use my architect, developer and reviewer roles to complete this issue.”

“Run the canonical workflow for this task.”"

S6. "Implement a deterministic intent-to-workflow resolution policy."

S7. "Use explicit workflow commands when supplied."

S8. "For natural-language requests, use a discoverable workflow catalog and structured selection criteria."

S9. "If multiple workflows match, apply documented priority rules or request clarification when necessary."

S10. "Do not allow Gentle AI or another extension to silently intercept a request intended for Extensible Workflows."

S11. "Do not activate expensive multi-agent workflows for ordinary questions."

S12. "Preserve normal Pi behavior when workflow orchestration is unnecessary."

S13. "Provide explicit diagnostic information about why a workflow was selected."

S14. "Pi starts reliably with the required extensions."

S15. "No unresolved accidental skill collisions remain."

S16. "The canonical role registry remains authoritative."

S17. "Extensible Workflows can be invoked explicitly and through supported natural-language routing."

S18. "Repeated startup and reload do not introduce duplicate registrations."

S19. "Existing user configuration and credentials are preserved."

## Tasks

- T1 [S1-S3, S15, S19] route: canonical-only project-memory policy, setup ownership, repeatable collision audit, and regression tests; commit: 9d182e6, 61206a8, 84aae5d.
- T2 [S7, S14, S18] route: make model-preflight a default-loadable Pi extension without changing its runtime contract; commit: bac5e67.
- T3 [S4-S13, S17] route: add a deterministic, catalog-backed natural-language workflow intent adapter with explicit-command precedence and ordinary-question guard; commit: 8981788, 5e4212c.
- T4 [S16] route: verify canonical role settings and workflow aliases remain the sole role/model authority; commit: verified, no source change.
- T5 [S14-S19] route: run isolated startup, reload, catalog, workflow, memory, and failover checks; record evidence and limitations; commit: pending.

## Log

L1. User request: "MISSION: Unify Pi Orchestration, Roles, Delegation, Memory and Model Failover". The user authorized implementation, required source/runtime discovery before architectural decisions, asked for minimal compatibility adapters instead of upstream forks, required deterministic workflow routing, permanent collision auditing, regression tests, operational documentation, local changes only, and no push/merge/publish without explicit authorization.
L2. Verified before implementation: `setup_env.sh` invokes `npx skills add ... --agent pi cline` for `project-memory`, while Pi reads `~/.agents/skills` and `~/.pi/agent/skills`; identical physical copies reproduce the startup collision. `link-skills` does not manage the skill because it is absent from the manifest.
L3. Verified before implementation: Pi's repository package registers the `extensions` directory, but the runtime default extension list excludes `model-preflight.mjs`; explicit loading registers its command and hooks, while offline preflight produces empty output. The implementation must preserve the existing preflight behavior and add only the smallest loadability adapter.
L4. Verified from `pi-extensible-workflows`: explicit `/workflow` navigation and catalog/tool APIs are native; registered workflow functions and model aliases are authoritative inside the workflow engine. Natural-language intent recognition is not a native deterministic resolver, so the repository must add an adapter that selects from the discoverable catalog without replacing workflow execution.
L5. Implemented T1-T3. `project-memory` is canonical-only for Pi, setup no longer installs a Pi-local copy, and the linker moved the identical live duplicate to `/root/.pi/backups/link-skills-2026-10-23T19-05-48-766Z/pi/project-memory`. `model-preflight.js` re-exports the tested `.mjs` implementation and is now discovered by Pi. `workflow-intent.mjs` adds deterministic trigger/scoring/clarification guidance and `parallelReviewAndSecurity` runs reviewer/security analysis, developer fixes, and architect verdict.
L6. Verification evidence: collision/linker tests 9/9; Node extension tests 35/35; Bun extension tests 11/11; `bash -n`; `bash check-config.sh`; linker verify; `git diff --check`; and offline Pi startup exit 0 after syncing changed live entrypoints. Offline startup reports expected empty preflight evidence and cannot prove provider-backed inference.
L7. Documentation: `docs/pi-ecosystem-ownership.md` records the responsibility matrix, request pipeline, collision remediation, evidence, limitations, and rollback. No commit, push, merge, release, or credential change was performed.
L8. Current validation: P EXTIL `workflow_catalog`, `parallelReviewAndSecurity`, and `tddDev` executed; Node tests pass 67/67, Bun tests 11/11, and a real symlinked preflight wrapper returned valid JSON with 70 models. The canonical root has 58 readable managed skills. The live Pi runtime is still stale and the live linker reports five missing non-Pi `project-memory` links; external repair remains pending explicit authorization.
L9. The routing and parallel-review implementation is now split into commits `8981788` and `5e4212c`. Native review for the second slice completed and was acknowledged after the provider accepted the exact fresh STATUS binding; push remains pending explicit delivery authorization.
L10. Final verification rerun: Bun extension tests pass 12/12. Node tests pass 84/85; the single non-root setup failure is environmental because `runuser` cannot execute its copied fixture below the root-only `/root` path (exit 126).
