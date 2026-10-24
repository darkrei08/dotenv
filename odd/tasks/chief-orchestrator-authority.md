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

## Log

L1. "# MASTER MISSION — PI CHIEF OF CHIEFS\n## Deterministic Multi-Agent Orchestration, Ecosystem Consolidation and Runtime Conflict Elimination\n\nYou are acting as a Principal Agent Systems Architect, Pi.dev Runtime Engineer, Multi-Agent Orchestration Designer and Site Reliability Engineer.\n\nYour mission is to audit, diagnose, refactor, integrate and validate my existing AI development environment so that my personal Pi Herdr Orchestration becomes the authoritative **Chief of Chiefs**.\n\nThis is an engineering implementation mission, not a request for generic architectural advice."

L2. Baseline completed before implementation: live Pi 1.4.0, gentle-pi 4.3.0, pi-extensible-workflows 6.2.2, Herdr 0.9.5, Gentle AI 4.2.0, Engram 3.5.2, GGA 2.10.1; runtime package registration, active Herdr snapshot, repository branches, and configured-vs-runtime ownership were verified.

L3. Confirmed mismatch: `develop-issues.ts` rechecks the reviewed branch but still runs `git merge --ff-only` against `PI_MAIN_PATH` and removes merged worktrees before the parent Master receives an explicit repository-level integration decision.

L4. Issue #82 was created with the bounded acceptance criteria. No provider-backed inference, push, merge, PR creation, or release is part of this work.

L5. Implementation evidence so far: `develop-issues.test.ts` passes 3/3 and `seq-issues.test.ts` passes 2/2 after the child workflow was changed to return `integration-ready` evidence and the Master step was wired through `integrateReviewedIssues`. Full checks and the runtime demonstration are still pending.
