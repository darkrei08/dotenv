# Pi-Agent preflight, HA matrix, and role routing
Issue links: darkrei08/dotenv#69, #65, #61
Scope: integrate the repository-owned Pi preflight boundary, reconcile the canonical pi-model-fit role/HA matrix, and remove the approved selector warnings without touching credentials, installed packages, live Pi state, or PiWorkflow core.

## Specs
S1. "Implement the smallest coherent, issue-linked change in this isolated worktree."
S2. "Treat pi-model-fit's roleRecommendations in scripts/report.mjs as the current canonical recommendation source; do not copy stale generated report prose blindly."
S3. "Keep catalog visibility, entitlement, inference, and quota separate; never invent availability or credentials."
S4. "Do not edit installed packages, auth files, live ~/.pi/agent state, or PiWorkflow core."
S5. "Reuse the existing pi-model-fit preflight contract and the staged candidate in /root/.herdr/worktrees/dotenv/model-availability-preflight only as read-only evidence; do not modify that worktree."
S6. "Integrate a repository-owned Pi extension/launcher that invokes the reusable pi-model-fit preflight at session start, exposes a bounded refresh command, refreshes periodically with a TTL, and fails closed before agent routing when evidence is stale/unknown. Register it in canonical settings and document the environment/config contract."
S7. "Reconcile role aliases and role assignments with the current canonical recommendations and the tracked HA failover groups, preserving native/gateway mirror rules and explicit unknown/unavailable states."
S8. "Ensure every configured role primary is covered by its bound HA group and that bootstrap fallback remains empty for unknown models but non-empty for configured primaries; add or update deterministic public-interface tests."
S9. "Fix issue #61 tool_search/default-tools and researcher invalid selector warnings without widening child capabilities."
S10. "Update check-config.sh and focused docs. Keep changes thin and issue-linked."
S11. "Use test-first where meaningful: observe RED for new behavior, then GREEN. Run the exact focused tests and config checks. Do not commit or push; return changed files, test commands/results, unresolved blockers, and the canonical role/model/effort table."

## Tasks
- T1 [S6] Add the repository-owned preflight extension/launcher, bounded refresh command, TTL refresh, fail-closed routing gate, tests, and settings registration. Route: implementation; commit: none.
- T2 [S7,S8] Reconcile role aliases/assignments and HA role-group/bootstrap coverage from the canonical roleRecommendations source; preserve native/gateway mirrors and unknown/unavailable states. Route: configuration and deterministic public-interface tests; commit: none.
- T3 [S9] Activate root `defaultTools` for `tool_search` and remove only invalid researcher selectors; preserve child capability ceilings. Route: configuration and focused tests; commit: none.
- T4 [S10,S11] Update check-config and focused docs, then run exact verification and record evidence/blockers. Route: verification; commit: none.

## Log
L1. User request verbatim: "Implement the smallest coherent, issue-linked change in this isolated worktree.\n\nRead the repository AGENTS.md and the complete feature/task documents under odd/tasks until ## Log before editing. The authorized scope is dotenv issues #69, #65, and #61 plus the user's latest request to apply the latest canonical role/alias matrix and HA failover matrix with periodic Pi-Agent preflight for Pi Extensible Workflow.\n\nEvidence rules:\n- Treat pi-model-fit's roleRecommendations in scripts/report.mjs as the current canonical recommendation source; do not copy stale generated report prose blindly.\n- Keep catalog visibility, entitlement, inference, and quota separate; never invent availability or credentials.\n- Do not edit installed packages, auth files, live ~/.pi/agent state, or PiWorkflow core.\n- Reuse the existing pi-model-fit preflight contract and the staged candidate in /root/.herdr/worktrees/dotenv/model-availability-preflight only as read-only evidence; do not modify that worktree.\n\nImplementation requirements:\n1. Integrate a repository-owned Pi extension/launcher that invokes the reusable pi-model-fit preflight at session start, exposes a bounded refresh command, refreshes periodically with a TTL, and fails closed before agent routing when evidence is stale/unknown. Register it in canonical settings and document the environment/config contract.\n2. Reconcile role aliases and role assignments with the current canonical recommendations and the tracked HA failover groups, preserving native/gateway mirror rules and explicit unknown/unavailable states.\n3. Ensure every configured role primary is covered by its bound HA group and that bootstrap fallback remains empty for unknown models but non-empty for configured primaries; add or update deterministic public-interface tests.\n4. Fix issue #61 tool_search/default-tools and researcher invalid selector warnings without widening child capabilities.\n5. Update check-config.sh and focused docs. Keep changes thin and issue-linked.\n\nUse test-first where meaningful: observe RED for new behavior, then GREEN. Run the exact focused tests and config checks. Do not commit or push; return changed files, test commands/results, unresolved blockers, and the canonical role/model/effort table."

L2. Verification evidence: `node --test pi/agent/extensions/model-preflight.test.mjs pi/agent/extensions/pi-ha-role-groups/bind.test.mjs tests/medium-effort-policy.test.mjs` passed 10/10; `bash tests/role-tool-policy.sh` passed; `bash -n check-config.sh setup_env.sh`, `node --check` on new `.mjs` files, JSON parsing through the focused checker, and `git diff --check` passed.
L3. The new `pi-ha-role-groups.json` is both unignored by `pi/agent/.gitignore` and included in `setup_env.sh`'s selective `sync_pi` allowlist. The live `bash check-config.sh` check was intentionally not repaired: it fails only because `~/.pi/agent/pi-ext-roles/settings.json` is stale versus the canonical worktree settings, outside the authorized live-state scope.
L4. Docs now list the tracked HA mapping and `model-preflight.mjs`; no credentials, installed packages, live Pi state, or PiWorkflow core were edited.
L5. Final focused checks still pass after the doc update: 10/10 Node tests, role-tool policy, JSON parsing, Bash syntax, and `git diff --check`. Native review inspection reached a provider-owned consent gate for this medium-risk candidate; no review lineage was created and no review was run.
L6. Repair request verbatim: "Repair the existing implementation commit e1836a0 in this isolated worktree. Start by cherry-picking e1836a0, then read AGENTS.md and the relevant issue/task documents through ## Log.

Fix every blocking finding from the prior review:
- Enforce freshness after every preflight refresh and fail closed on stale/unknown output, including concurrent refreshes.
- Bound malformed/non-finite PI_MODEL_PREFLIGHT_REFRESH_MS to a safe default, never a 1ms timer.
- Add the required public test file pi/agent/extensions/pi-ha-bootstrap.test.mjs and make the exact issue #65 command pass.
- Reconcile REVIEW_RULES.md with the canonical role matrix derived from pi-model-fit/scripts/report.mjs and the user's latest request; do not leave old Opus4.6/GPT6.1/medium policy literals.
- Make runtime preflight use the tracked credentials-free HA matrix by default or explicitly validate the live matrix against it; preserve credentials and fail closed.
- Add deterministic tests for the above. Run focused tests and config checks.
- Do not modify installed packages, auth files, live ~/.pi/agent state, or PiWorkflow core. Do not merge or push.

Also inspect the diff for unnecessary changes and trim speculative edits. Commit the repaired coherent work unit and return the commit SHA, changed files, exact test results, and any checks that remain unavailable."
