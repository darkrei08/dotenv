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

- `pi/agent/models.json`: preserve the `openai-codex` catalog entries for
  `gpt-6-luna` and `gpt-6-sol`. The `tuxevil-rotator` provider and
  `rotator-gemini-*` aliases are retired; do not reintroduce them.
  Do not reintroduce obsolete OpenCode workflow targets.
- `pi/agent/pi-extensible-workflows/settings.json`: native providers are the
  working default and follow the `vekexasia/dotenv` role mapping on Claude Pro
  and ChatGPT Plus models: `cheap-model` (also scout and developer) resolves to
  `anthropic/claude-sonnet-5-5:medium`, `tests-expert` and `researcher-model`
  to `native-luna` (`openai-codex/gpt-6-luna:high`), and `reviewer-model`
  (also oracle) to `anthropic/claude-opus-5-5:high`. Every native alias has a
  `cliproxy-*` mirror; no gateway alias may become a default or let an
  unavailable gateway model block native workflows. Do not
  configure Fable (not included in Claude Pro). Preserve the expanded `skills`
  list.
- `pi/agent/settings.json`: the Pi/GGA baseline is `defaultProvider:
  anthropic`, `defaultModel: claude-sonnet-5-5`, `defaultThinkingLevel: medium`,
  and `modelThinkingLevels`. `enabledModels` lists only Anthropic, OpenAI Codex
  and their CLIProxyAPI mirrors. `.gga` (GGA reviewing through the Pi bridge in
  `agents/gga-pi/`, Sonnet 5.5 at `high` effort) and `pi/agent/subagents.json`
  follow the same Sonnet 5.5 default.
- `pi/agent/extensions/light-web-search.ts`: the tracked extension intentionally
  replaces `pi-web-access` so only one `web_search` tool is registered; it uses
  CLIProxyAPI first and openai-codex fallback.
- `pi/agent/AGENTS.md`: the Language directive (Italian to user, English for all
  inter-agent work and artifacts).

## Cross-file config parity

- `pi/agent/settings.json` `packages` and `pi/agent/npm/package.json`
  `dependencies` must stay consistent: an npm package added/removed in one is
  reflected in the other (or justified as pi-managed vs npm-managed).
- Workflow `extensions` globs in `pi-extensible-workflows/settings.json` must
  reference packages that are actually installed (settings packages or npm deps).
- Standard model aliases must dereference an available built-in provider;
  explicit CLIProxyAPI aliases may target the dynamic catalog and are validated
  when the provider is authenticated.

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
