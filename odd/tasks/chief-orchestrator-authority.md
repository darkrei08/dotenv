# Chief orchestrator authority boundary

Feature document for issue #82 in `darkrei08/dotenv`.
Repository baseline: branch `fix/chief-orchestrator-authority` from `origin/main` at `83c8f1e`.

## Specs

S1. "The desired outcome is not the largest possible collection of extensions. The desired outcome is **one coherent, stable, efficient and observable AI engineering organization in which every component has a defined responsibility and every agent follows a verifiable chain of command.**"

S2. "My Pi Herdr Orchestration must own the high-level orchestration policy."

S3. "PiWorkflow must execute selected workflows."

S4. "The Master Chief remains authoritative over project planning."

S5. "Do not create another independent orchestration framework."

S6. "The Master must collect evidence and produce a consolidated completion report."

S7. "Do not report the architecture as working merely because the configuration files look correct."

## Tasks

- T1 [S1-S7] | #82 | route: keep issue development/review in native PiWorkflow but return integration-ready evidence before any main-worktree fast-forward or worktree removal; add Master-owned integration and cleanup checks; commit: pending
- T2 [S1-S7] | #82 | route: update ownership documentation and focused tests to prove the authority boundary and preserved failure evidence; commit: pending
- T3 [S1-S7] | #82 | route: run focused tests, configuration checks, syntax/whitespace checks, and a bounded non-provider demonstration; commit: pending
- T4 [S1-S7] | #83 | route: restore deleted safety/regression suites, preserve main configuration gates and Master authority tests, pin the orchestration dependency, and record verification/deployment limits; commit: pending

## Log

L1. "# MASTER MISSION — PI CHIEF OF CHIEFS\n## Deterministic Multi-Agent Orchestration, Ecosystem Consolidation and Runtime Conflict Elimination\n\nYou are acting as a Principal Agent Systems Architect, Pi.dev Runtime Engineer, Multi-Agent Orchestration Designer and Site Reliability Engineer.\n\nYour mission is to audit, diagnose, refactor, integrate and validate my existing AI development environment so that my personal Pi Herdr Orchestration becomes the authoritative **Chief of Chiefs**.\n\nThis is an engineering implementation mission, not a request for generic architectural advice."

L2. Baseline completed before implementation: live Pi 1.4.0, gentle-pi 4.3.0, pi-extensible-workflows 6.2.2, Herdr 0.9.5, Gentle AI 4.2.0, Engram 3.5.2, GGA 2.10.1; runtime package registration, active Herdr snapshot, repository branches, and configured-vs-runtime ownership were verified.

L3. Confirmed mismatch: `develop-issues.ts` rechecks the reviewed branch but still runs `git merge --ff-only` against `PI_MAIN_PATH` and removes merged worktrees before the parent Master receives an explicit repository-level integration decision.

L4. Issue #82 was created with the bounded acceptance criteria. No provider-backed inference, push, merge, PR creation, or release is part of this work.

L5. Implementation evidence so far: `develop-issues.test.ts` passes 3/3 and `seq-issues.test.ts` passes 2/2 after the child workflow was changed to return `integration-ready` evidence and the Master step was wired through `integrateReviewedIssues`. Full checks and the runtime demonstration are still pending.

L6. PR #83 remediation: restored all 20 deleted test/support files from `origin/main`, except the two authority-boundary workflow suites restored from `837a2e1`. Updated restored HA tests to request the bound group explicitly and verify ambiguous models fail closed. Restored main's dedicated GGA route and robust hook detection in `check-config.sh`; kept all other integrity gates. `git ls-remote https://github.com/darkrei08/pi-herdr-orchestration.git 'refs/tags/v1.2.6*'` resolved the annotated tag to commit `e8e52d3a358f036f5cb2bcb517b0abe572d3d216`; settings, package manifest, checker and ownership docs now use that immutable commit. A new regression rejects mutable package registration. Red: the missing medium-policy suite, then its restored GGA assertion, and the pin assertion failed before the fixes.

L7. Local verification on Linux x86_64, Node 22.23.3 and Bun 1.4.2: `node --test agents/*.test.mjs tests/medium-effort-policy.test.mjs pi/agent/extensions/model-preflight.test.mjs pi/agent/extensions/pi-ha-bootstrap.test.mjs pi/agent/extensions/pi-ha-role-groups/bind.test.mjs pi/agent/extensions/workflow-intent.test.mjs pi/agent/packages/pi-codex-context/test/context-management.test.mjs` passed 129/129 (exit 0). `bun test pi/agent/extensions/pi-ext-workflows/{develop-issues,seq-issues,parallel-review}.test.ts` passed 11/11, and `bun test pi/agent/extensions/{agent-usage/index,command-artifacts,herdr-nvim-blocked/index}.test.ts` passed 20/20. `bash tests/role-tool-policy.sh`, `PI_CODING_AGENT_DIR="$PWD/pi/agent" bash check-config.sh` and `git diff --check` passed. Workflow tests use mocked shell/agent boundaries; no provider-backed or live integration demonstration was performed.

L8. Container verification, host Linux x86_64: every row used `docker run --rm -v "$PWD:/w:ro" -w /w IMAGE sh -ceu 'INSTALL; PI_CODING_AGENT_DIR=/w/pi/agent bash check-config.sh; node --test tests/medium-effort-policy.test.mjs; bash tests/role-tool-policy.sh'`. `node:22.23.3-bookworm`: INSTALL=`apt-get update -qq >/dev/null; apt-get install -y -qq jq >/dev/null`; exit 0. `archlinux:latest`: INSTALL=`pacman -Sy --noconfirm --needed nodejs npm jq git diffutils >/tmp/packages.log 2>&1`; exit 0. `ubuntu:24.04`: INSTALL=`apt-get update -qq >/dev/null; apt-get install -y -qq jq git >/dev/null`, with additional `-v "$(command -v node):/usr/local/bin/node:ro"`; exit 0. All three printed `config check passed`, 3 policy tests passed, and `PASS: role tool allowlists, model aliases, and MCP discovery policy`. The first Arch attempt lacked diffutils and failed; the dependency-complete retry passed. Logs: `/tmp/pr83-container-{debian,arch,ubuntu}.log`. No containers were retained. ID_LIKE-only derivatives, the full installer, Windows and macOS were not exercised.

L9. Remaining limits: no commit, push, merge, rebase or live `setup_env.sh` run. The documented post-merge synchronization is required, but the immutable v1.2.6 commit still has the previously recorded Pi 1.4 `/orch` loader incompatibility; pinning prevents tag drift, not that runtime defect. The restored advisor suite cannot run against the installed wrapper/layout: the default command cannot find `/root/.pi/agent/bin/core/extensions/loader.js`; `PI_DIST=/root/.pi/agent/install/releases/1.4.0/node_modules/@earendil-works/pi-coding-agent/dist node --test pi/agent/packages/pi-omplike-advisor/extensions/advisor.test.mjs` still fails in its existing package-root discovery (`advisor.test.mjs:60`, undefined NM). No installed software was modified. Merge-conflict resolution in history and live deployment remain pending.
