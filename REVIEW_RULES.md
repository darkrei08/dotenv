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
defect (the user explicitly authorized issue #70 medium-only policy and claude-opus-4-6-thinking:medium for reviewer and GGA review):

- `pi/agent/models.json`: preserve the `openai-codex` catalog entries for
  `gpt-6-luna` and `gpt-6-sol`. The retired `tuxevil-rotator` provider must not
  return. Do not reintroduce obsolete OpenCode workflow targets.
- `pi/agent/pi-ext-roles/settings.json` (roles and shared role settings; `pi/agent/pi-extensible-workflows/settings.json` keeps only workflow `extensionSettings`): workflow roles use
  CLIProxyAPI first, following the `vekexasia/dotenv` role mapping: `developer-model` resolves to
  `cliproxyapi/claude-sonnet-5-5:medium`, `scout-model` intentionally resolves to the direct
  OpenCode Go `opencode-go/cat-jam-free:medium`, `tests-expert` to `cliproxy-luna`
  (`cliproxyapi/gpt-6-luna:medium`), `researcher-model` to `cliproxy-luna:medium`,
  `summarizer-model` to `cliproxyapi/claude-haiku-5-5:medium`, and `reviewer-model` (also oracle)
  to `cliproxyapi/claude-opus-4-6-thinking:medium` (or `cliproxyapi/claude-opus-5-5:medium` when available). Explicit `gemini-*` aliases and HA groups are allowed
  as alternatives/fallbacks; they do not replace the primary role targets. Native aliases remain
  defined as a manual fallback and native models are hidden from the active picker. Do not
  configure Fable (not included in Claude Pro). Preserve the expanded `skills` list.
- `pi/agent/settings.json`: the Pi/GGA baseline is `defaultProvider:
  cliproxyapi`, `defaultModel: claude-sonnet-5-5`, `defaultThinkingLevel: medium`,
  and `modelThinkingLevels`. `enabledModels` lists only CLIProxyAPI models; native
  catalogs remain defined for manual fallback (Claude and Codex still run through the gateway by default). `pi/agent/subagents.json` follows the same
  Sonnet 5.5 default. `.gga` is the exception: GGA reviews through the Pi bridge in
  `agents/gga-pi/` with the CLIProxyAPI mirror of the workflow `reviewer` role
  (`cliproxyapi/claude-opus-4-6-thinking:medium`), enforced by `check-config.sh`; there is
  no automatic fallback to another model.
- `pi/agent/extensions/light-web-search.ts`: the tracked extension intentionally
  replaces `pi-web-access` so only one `web_search` tool is registered; it uses
  CLIProxyAPI first and openai-codex fallback.
- `pi/agent/AGENTS.md`: the Language directive (Italian to user, English for all
  inter-agent work and artifacts).

## Cross-file config parity

- `pi/agent/settings.json` `packages` and `pi/agent/npm/package.json`
  `dependencies` must stay consistent: an npm package added/removed in one is
  reflected in the other (or justified as pi-managed vs npm-managed).
- Role `extensions` globs in `pi-ext-roles/settings.json` must
  reference packages that are actually installed (settings packages or npm deps).
- `pi-extensible-workflows` must be registered with `!dist/subagents/index.js` in `settings.json`, and `extensionSettings.subagents.enabled` must be `false` in `pi-extensible-workflows/settings.json` to prevent duplicate subagents UI.
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
