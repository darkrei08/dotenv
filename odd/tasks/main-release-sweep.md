# Main release sweep

## Goal
Audit all pending commits and GitHub work in `dotenv`, correct only evidence-backed blockers, publish a stable result to `main`, and clean up resolved branches/issues without mutating unresolved decision work.

## Scope
- Current branch `feat/gpt6-model-routing` compared with `origin/main`.
- Safe release fixes: stable-tag selection in `.github/workflows/auto-release.yml`, installer repair for a missing `gga`, and ignored CLIProxyAPI JSON runtime state.
- Verify the existing Pi/CLIProxyAPI integration and all relevant repository checks before delivery.
- Make all currently tracked coding-agent CLI targets required: Pi, gentle-ai/GGA, agy, codex, Claude Code, Gemini, Copilot, OpenCode, and Cursor. Keep ai-memory-kit fallback behavior as explicitly chosen by the user.
- Analyze GitHub issues individually; close only issues whose acceptance criteria are verified. Keep #25 and #29 open until their explicit compaction-policy decisions have evidence.
- No OAuth, credential inspection, force-push, or arbitrary dependency pinning. Use disposable containers for the required Linux platform matrix; do not run full host provisioning.

## Constraints
- Use Pi workflow agents for audit, implementation, verification, and issue analysis.
- Keep source artifacts in English; preserve existing unrelated untracked ODD task files.
- Publish only after GGA/checks pass and remote state is re-read.

## Tasks
- [x] T1: Audit current branch, pending commits, branches, open issues, and pull requests with read-only Pi workflow agents.
  - Evidence: workflow runs `7051b1a9-50da-4a4b-b46c-2a5131a3127f` and `c553dd50-f0e7-4d01-9fa8-5eb356d8f258`.
- [x] T2: Apply the smallest evidence-backed release fixes in one work unit: stable tag filtering, retryable `gga` installation with guaranteed temp cleanup, and CLIProxyAPI JSON ignore coverage.
  - Route: delegated Pi workflow developer writer; initial run `4a775514-59c0-486c-9983-51cb4c69834b`; review correction run `bc6145e8-c296-4122-8553-5ca520aedda1`.
  - Evidence: only `.github/workflows/auto-release.yml`, `setup_env.sh`, and `.gitignore` changed. The exact-stable tag filter now propagates `git tag` failures via `pipefail`; the GGA install clone is in a subshell with EXIT cleanup; runtime JSON ignore is scoped to `cliproxyapi/`.
- [x] T3: Make all tracked coding-agent CLI targets required in `setup_env.sh`, using verified official Linux install paths and explicit post-install checks, then verify the exact candidate and commit the work unit.
  - Implemented guarded non-force cleanup for isolated temp/managed tool directories and fail-closed handling for manifest-declared Pi package failures via workflow `8e078547-7811-45f7-a140-b6e17f549b62`; `bash -n`, focused `git diff --check`, and no-`rm -rf` scan passed.
  - GGA `2.10.1` exact staged candidate run `c6ecc84d-8ff3-4386-bc2e-6ecf13f7f294` still failed on existing findings: unlogged `|| true` in Neovim detection, intentionally documented unpinned ai-memory-kit fallback, and missing post-install checks for `gentle-ai`, `agy`, `codex`.
  - Read-only challenge `033e5511-1534-4399-916d-0d2d256111c6` found the Neovim logging issue consistent with `REVIEW_RULES.md`; user chose to keep the documented ai-memory-kit fallback and require all tracked coding-agent targets.
  - Inventory workflow `c0ec7d98-9648-42f1-830c-18c73c66ec49` completed (not stalled): Pi installs only on Arch; Claude Code is only detected; Gemini/Copilot/OpenCode/Cursor are plugin-only targets. User selected making all targets required.
  - Official install evidence: Anthropic Claude Code `https://docs.anthropic.com/en/docs/claude-code/getting-started` (`https://claude.ai/install.sh`); Pi `https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md` (npm, Node 22.19+); Gemini `https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/installation.mdx` (npm, Node 20+); GitHub Copilot `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli` (`https://gh.io/copilot-install`); OpenCode stable `https://opencode.ai/en/docs` (`https://opencode.ai/install`, not v2); Cursor Agent `https://docs.cursor.com/en/cli/installation` (`https://cursor.com/install`, binary `cursor-agent`).
  - Authorized edit surfaces: `setup_env.sh` and `README.md`; configured workflow developer alias is unavailable, so workflow delegated via verified built-in Luna fallback.
  - Current implementation: requires Node/npm/npx and Node >=22.19; installs Pi on all supported distros; installs and checks all ten CLI commands. Gemini uses the official `@google/gemini-cli` package. `gentle-ai` uses `GOBIN="$HOME/.local/bin" go install github.com/gentleman-programming/gentle-ai/v2/cmd/gentle-ai@latest` to avoid the GitHub release API rate limit. Neovim detection logs missing state, updates old Arch/Omarchy packages, and verifies >=0.12.0 afterward. README line references were synchronized with current source.
- [x] T4: Complete the Linux distro verification matrix, rerun GGA on the exact candidate, obtain native review approval, and commit.
  - Previous matrix `c0458406-2514-4282-9718-099ec84a8114` passed Debian 13, Ubuntu 24.04, and Arch before the latest changes; rerun after T3. Windows/full setup_env and actual GitHub Actions remain untested.
  - Latest read-only verifier task `mujn4cen-4-hhhd`: `bash -n setup_env.sh`, `git diff --check`, `bash check-config.sh`, `node --test agents/link-skills.test.mjs` (3/3), and `gga run --no-cache` passed. GGA reported `STATUS: PASSED` for README.md and setup_env.sh; ShellCheck unavailable.
  - Actual CLI install blocks (not full setup_env.sh) passed in disposable Debian 13 `sha256:9cc080028c43b27d2074d63a5f9caf7166d731494965616c1a6d2827a004585c`, Ubuntu 24.04 `sha256:008173c23f95b170204355c12626cb5a965d779a7e1283b09e9cffbb1bf33ca3`, and Arch `sha256:f3691b4dde62ba4c4b6f0ae2c1fbf28e8c0c8c4b9a35c7e06dc1f70e21aa29f6`. Node 22.19.0; Pi and all required CLI commands verified on each. The official Go module installer succeeded; GGA installed to `/usr/local/bin/gga` and its hook was created only in a temporary repo. Test containers removed; no authentication/OAuth.
  - Negative required-command guard passed (omitting `cursor-agent` exits 1); Arch old-Neovim mock updated 0.11.3 to 0.12.0 and passed. Host/container command exit codes for successful rows are not separately recorded by the verifier, but each command returned successfully.
  - Native review and commit are held until the separate issue #30 session confirms its `setup_env.sh` worktree/branch is isolated or complete. No commit/push has occurred.
  - User then explicitly ordered completion and publication. Native review `review-eff4bd1746d567a1` (target `sha256:d4d8763c...`, tree `ebc3eac8`, untracked excluded) approved with 4 lenses and was acknowledged (authority burned). Non-blocking advisories: R1 remote installer at `setup_env.sh:428-429`, R4-001 at `setup_env.sh:388`.
  - Re-verification (gentle-ai-verify): `bash -n`, `git diff --cached --check`, `bash check-config.sh`, `node --test agents/link-skills.test.mjs` (3/3) exit 0. `gga run --no-cache` exit 1: Codex provider returns no output; direct `codex exec` shows `You've hit your usage limit ... try again at 2:20 PM`. The GGA pre-commit hook blocked `git commit` for the same reason; no commit created.
  - Commit `c60e434` created at 14:21 after the Codex limit reset; GGA pre-commit hook reported `CODE REVIEW PASSED`.
- [x] T5: Publish the verified feature branch to `main` without force, verify remote `main`, then delete the resolved feature branch locally and remotely.
  - Fast-forward pushes: `origin/feat/gpt6-model-routing` and `origin/main` both at `c60e434`. Auto-release run `36318957680` succeeded; release `v0.4.2` (Latest) points at `c60e434`.
  - Feature branch NOT deleted: issue #30 review branch `review/issue30` is based on `origin/feat/gpt6-model-routing`; delete after #30 is ported.
- [x] T6: Analyze each issue separately and close only when acceptance criteria are verified; #25/#29 stay open unless evidence and decision requirements are satisfied.
  - Closed #17 (gentle-bar.ts absent on main, stale-copy removal in setup_env.sh, `check-config.sh` exit 0) and #24 (cliproxyapi/README.md Gemini CLI accounts section meets all acceptance criteria). #25/#29 open (decision tickets); #30 open, owned by coordinator session and notified to port onto `c60e434`.

## Acceptance checks
- Release workflow ignores prerelease tags when calculating the next stable patch tag.
- Installer installs and verifies every agreed coding-agent CLI target (`pi`, `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor`) on supported Linux distributions, without performing OAuth/login.
- CLIProxyAPI JSON runtime state cannot be accidentally tracked.
- `bash -n setup_env.sh`, `bash check-config.sh`, JSON/config checks, repository tests, and GGA pass for the candidate.
- `main` remote SHA equals the merged local commit; deleted feature branch is absent from local and remote refs.
- Issue closure comments contain only verified evidence; unresolved decision issues remain open.

## Current status
- Current branch: `feat/gpt6-model-routing` at `43e82279d1e4ae314ec0f513e5a0b8861ff298c1`, 12 commits ahead of `origin/main`.
- No open pull requests; open issues are #17, #24, #25, and #29.
- Existing feature branch is intentionally mixed and now includes the release fixes; it still requires native review before main publication.
- Workflow agents reported #17 already fixed by removal of the stale extension; #24 documentation is not yet fully compliant with its current text/link criteria; #25/#29 remain decision work.
- T4 baseline before the latest setup_env corrections: Debian 13, Ubuntu 24.04, and `archlinux:latest` extracted-block checks passed; Debian forced-clone failure exited 1 with expected error and cleaned the temp directory; `bash -n`, `check-config.sh`, 3 Node tests, JSON parse, diff check, mixed-tag fixture, fake-git exit 42 pipefail check, and independent review passed. Windows, full `setup_env.sh`, and live GitHub Actions were not run.
- Current staged paths are exactly `.github/workflows/auto-release.yml`, `.gitignore`, `README.md`, and `setup_env.sh`; five unrelated `odd/tasks/*.md` files remain untracked and unstaged.
- First staged GGA run `2612b702-ed67-46f2-9933-5847c69ce63a` failed on recursive-force cleanup and nonfatal Pi package-install warning; those two were corrected. Second staged GGA run `c6ecc84d-8ff3-4386-bc2e-6ecf13f7f294` still failed on pre-existing Neovim `|| true`, unpinned ai-memory-kit fallback, and missing CLI post-install checks. Read-only assessment `033e5511-1534-4399-916d-0d2d256111c6` classified the first as a repo-policy issue and the others as policy choices; the user chose to preserve the fallback and require every tracked CLI target.
- The configured `developer-model`/`tests-expert` workflow aliases resolve to an unavailable CLIProxyAPI model. Bounded implementation, GGA verification, read-only GGA challenge, and CLI inventory used built-in `openai-codex/gpt-5.6-luna:xhigh`; no credential or OAuth inspection was performed.
- Latest workflow `c0ec7d98-9648-42f1-830c-18c73c66ec49` completed successfully and was delivered; it was not stalled and did not need a rerun.
- Coordination: user assigned this session ownership of the release/`main` publication. Session `01a0de17…` was asked to stop overlapping release work and continue only Claude root mode/#30 in an isolated worktree; two status requests were accepted for delivery, but no read/completion receipt has arrived. Herdr currently shows this session at `wC:t1`, an idle shell at `wC:t2`, an idle Pi in `setup-ai` at `w4:t8` (other tabs include issue work but no Pi agents reported there), and a working repository-orchestrator Pi at `wH:t2`. Session `01a0de17…` does not map to any reported Herdr Pi pane. No current shared-tree #30 changes are visible.

## Next step
The CLI implementation, GGA, and actual Linux installer matrix now pass. Wait for confirmation that the separate #30 `setup_env.sh` work is isolated/complete before native review and commit; then re-read remote state, obtain review approval, commit the release work unit, publish to `main`, and close only issues whose post-merge acceptance criteria are verified. Windows/macOS, full setup_env, and live GitHub Actions remain untested.
