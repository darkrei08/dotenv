# Align GGA with the Pi default and initialize its hook

## Goal
Use the dotenv repository's Pi default Codex model for GGA reviews and install the repository's GGA hook when setup-ai runs the dotenv setup.

## Scope
- Update the dotenv Codex project config and keep its documented model in sync with `pi/agent/settings.json`.
- Make `setup_env.sh` install the GGA hook in this repository after the CLI is available; retain the tracked `.gga` instead of regenerating it.
- Rely on setup-ai's existing dotenv module, which clones this repository and runs `setup_env.sh`; do not modify upstream GGA or add a global wrapper.
- GGA 2.10.1 cannot follow a Pi session's later `/model` selection. This task aligns the configured default only.

## Tasks
- [x] Align dotenv's Codex review model with Pi's default and add a check for drift.
- [x] Install the GGA pre-commit hook from dotenv setup and verify safe repeated runs.
- [x] Verify the setup-ai-to-dotenv path and run the required shell/configuration checks and supported-container tests.

## Acceptance checks
- `gpt-6-luna` is the value in both Pi's `defaultModel` and `.codex/config.toml`.
- The check-config command fails if those defaults diverge.
- Running dotenv setup installs the GGA hook in `REPO_DIR` without replacing the tracked `.gga` config.
- Existing setup-ai dotenv orchestration reaches the updated setup script.
- Bash syntax/configuration checks pass; run supported Debian and Arch container checks and record any unavailable platform rows.
- No GGA upstream files, releases, or issue state are changed.

## Evidence
- `bash check-config.sh` and both Bash syntax checks passed; a temporary `drift-test-model` was rejected by the drift guard.
- GGA 2.10.1 hook smoke passed twice in a temporary repository: existing hook preserved, no duplicate block on the second install.
- Debian 13 and Arch containers passed the config, syntax, and isolated GGA hook checks. Ubuntu/Omarchy derivatives, Windows, macOS, and full provisioning were not run.
- setup-ai's existing `mod_dotenv` flow clones the repo and invokes `setup_env.sh`.
- Native review lineage `review-030630b79afec014` approved and acknowledged.
- Committed the four reviewed files as `4b11386` (`fix(gga): align dotenv review model and install hook`) and pushed `feat/gpt6-model-routing` to origin; `ls-remote` confirmed `4b11386e7fe10d2ae1263ec9f3e8671bff470175`.
