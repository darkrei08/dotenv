# REVIEW_RULES.md - dotenv (Pi config + installer)

Review changes against THESE rules, not generic style conventions. This repo is
a personal dotfiles / Pi-agent-config repo, forked from `vekexasia/dotenv`. It
carries user integrations that must survive every upstream sync.

## What this repo is

- `setup_env.sh` - Linux/WSL provisioning + Pi config install. Bash.
- `pi/agent/**` - the versioned Pi agent config (settings, models, modes,
  workflow roles/aliases, extensions, packages, AGENTS.md).
- `nvim/`, `herdr/`, `.tmux.conf`, `.wezterm.lua` - editor/terminal dotfiles.

## Must-not-break user integrations (highest priority)

A change that drops or alters any of these without an explicit instruction is a
defect:

- `pi/agent/models.json`: the `tuxevil-rotator` provider block (Gemini via the
  rotator gateway).
- `pi/agent/pi-extensible-workflows/settings.json`: the `gemini-*` and
  `opencode-*` model aliases, and the expanded `skills` list.
- `pi/agent/settings.json`: `defaultProvider: opencode-go`, `modelThinkingLevels`,
  and the `pi-cockpit-tools-sync` package.
- `pi/agent/modes.json`: the `opencode-max` mode.
- `pi/agent/AGENTS.md`: the Language directive (Italian to user, English for all
  inter-agent work and artifacts).

## Cross-file config parity

- `pi/agent/settings.json` `packages` and `pi/agent/npm/package.json`
  `dependencies` must stay consistent: an npm package added/removed in one is
  reflected in the other (or justified as pi-managed vs npm-managed).
- Workflow `extensions` globs in `pi-extensible-workflows/settings.json` must
  reference packages that are actually installed (settings packages or npm deps).
- Model aliases must dereference a provider/model that exists in `models.json`
  or a known built-in provider.

## JSON

- Every edited `.json` must be valid (parseable). No trailing commas, no stray
  tabs/whitespace glitches.

## Bash (`setup_env.sh`)

- Keep `set -euo pipefail`. Quote expansions.
- Installs must be idempotent and safe to re-run.
- NEVER `rm -rf` or destroy live Pi runtime state: `~/.pi/agent/auth.json`,
  `sessions/`, `agents/`, `chains/`, caches. `sync_pi` must preserve them
  (selective rsync allowlist, not a symlink to the repo).
- Business logic that can silently break the install (config copy, version
  resolution, path handling) must be verified in-script after it runs.
- `bash -n setup_env.sh` must pass.

## Secrets

- No credentials or runtime state committed: `auth.json`, `models-store.json`,
  `sessions/`, caches must stay git-ignored, never added.

## General

- No dead code, no error hiding (`|| true`) unless explicitly optional + logged.
- Keep diffs small and reviewable; explain non-obvious logic briefly.
- Preserve upstream (vekexasia) improvements when syncing, but never at the cost
  of the user integrations listed above.
