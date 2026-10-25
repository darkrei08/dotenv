# Cross-repository delivery cleanup

Feature document for the authorized cross-repository cleanup and delivery audit.

## Specs

S1. "Controlla se abbiamo eliminato file inutili e scadneti ebtest e branch anche cross repo e mergia tutto il necessario"

S2. Preserve dirty, active, unpublished, blocked, or otherwise unproven work; delete only artifacts proven obsolete or already merged.

S3. Merge only verified, reviewable, clean pull requests that are necessary for the current repository state.

## Tasks

- T1 [S1-S3] | dotenv, setup-ai, pi-herdr-orchestration, pi-model-fit, pi-extensible-workflows, pi-ext-roles | inventory branches, worktrees, PRs, tests | commit: this document
- T2 [S1-S3] | pi-model-fit | resolve or preserve open PRs based on current evidence | result: preserved PRs #12/#14 as blocked
- T3 [S1-S3] | all audited repositories | prune only merged clean branches and terminated worktrees | result: removed verified merged refs; preserved dirty worktrees
- T4 [S1-S3] | all audited repositories | review test artifacts and preserve active coverage | result: no obsolete untracked test artifacts deleted
- T5 [S1-S3] | all audited repositories | run final repository and remote verification | result: pending final audit

## Log

L1. "Controlla se abbiamo eliminato file inutili e scadneti ebtest e branch anche cross repo e mergia tutto il necessario"

L2. Inventory evidence: six repositories were checked. Only pi-model-fit PRs #12 and #14 are open. PR #12 is clean but retains stale Claude 5.5/GGA recommendations; PR #14 deletes active tests and overlaps the existing preflight ownership, so neither was merged. No untracked test-like artifacts were found. Dirty or unmerged worktrees and branches were preserved. Verified merged local branches were removed in dotenv, pi-model-fit, and pi-ext-roles; 17 already-contained remote refs were removed in dotenv/setup-ai. The remaining pi-ext-roles purge branch, pi-herdr orchestration branch, pi-model-fit runtime-refresh branch, and other active worktrees remain preserved because they contain unique or unreviewed work.
