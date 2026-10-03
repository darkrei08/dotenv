# Issue #30: port root Claude mode fix onto release v0.4.2

## Goal
Port the corrected issue #30 fix (review/issue30 at 246268b) onto `c60e434` (v0.4.2), verify it, review it natively, publish to `main`, and close #30.

## Scope
- Source: commits `e141876` and `246268b` from `/tmp/dotenv-review-issue30-e141876`.
- Files: `agents/ensure-claude-root-mode.sh`, `agents/setup-env.test.mjs`, one call in `setup_env.sh` right after the gentle-ai install.
- User decision: port, fresh native review, publish; old lineage `review-c38713ea6c66743e` is left untouched.

## Tasks
- [x] T1: Branch `fix/claude-root-mode-30` from `c60e434`, apply both commits without committing, resolve the `setup_env.sh` placement.
  - `git cherry-pick --no-commit e141876 246268b`; the only conflict was the gentle-ai install line, resolved by keeping the v0.4.2 Go-module install and adding the helper call right after it (`setup_env.sh:424`).
  - README synced: AI CLI row 422-452 describes the root-only helper, later anchors shifted by one (453-458, 459-476, line 458), and the `~/.claude` statement now documents the root-only `defaultMode` exception.
  - Staged: `README.md`, `agents/ensure-claude-root-mode.sh`, `agents/setup-env.test.mjs`, `setup_env.sh`. `bash -n` and `git diff --cached --check` pass.
- [x] T2: Verify: `bash -n`, `bash check-config.sh`, `node --test agents/setup-env.test.mjs`, Debian 13 + Arch containers, GGA.
  - Host: `bash -n` (both scripts), `git diff --cached --check`, `bash check-config.sh`, `node --test agents/link-skills.test.mjs` 3/3 all exit 0. `node --test agents/setup-env.test.mjs` 6/6 from a scratch copy of the index tree; run in place under `/root` the non-root case fails with Permission denied (environment only: `/root` is not readable by the test's non-root user).
  - Containers (`--rm`, repo `:ro`): Debian 13 `sha256:9cc080028c43b27d2074d63a5f9caf7166d731494965616c1a6d2827a004585c` (NodeSource Node v22.23.3, jq 1.7) and Arch `sha256:f3691b4dde62ba4c4b6f0ae2c1fbf28e8c0c8c4b9a35c7e06dc1f70e21aa29f6` (Node v26.10.0, jq 1.8.2): 6/6 tests and `bash -n` pass, exit 0.
  - An earlier staging raced with the README edit (empty staged blob); it was re-staged. GGA then found a stale anchor (`477-478` should be `478-479`); fixed. Final `gga run --no-cache`: `STATUS: PASSED`, exit 0. Staged diff: 4 files, +168/-6.
- [x] T3: Fresh native review, then work-unit commit.
  - Fresh native review approved and acknowledged: lineage `review-f5bc61d2f71d124d`; approved candidate was committed as `076a077f0402d5bf97fc92a902a3a5c0b9d00298` (`fix(setup): persist root-safe Claude permission mode`).
- [x] T4: Fast-forward `main`, verify the auto-release, close #30 with evidence.
  - `origin/main` equals `076a077f0402d5bf97fc92a902a3a5c0b9d00298`; auto-release workflow `36323863264` succeeded and published `v0.4.3` at that commit; #30 is closed with the acceptance-value deviation documented in a comment.

## Acceptance checks
- As root, setup leaves `~/.claude/settings.json` with `permissions.defaultMode == "default"`, preserving other keys; non-root is a no-op.
- All checks above pass; `main` equals the pushed commit; #30 closed with evidence.
