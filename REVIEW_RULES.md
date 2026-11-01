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
defect. The current role matrix is derived from `pi-model-fit/scripts/report.mjs`:

- `pi/agent/models.json`: preserve the `openai-codex` catalog entries for
  `gpt-6-luna` and `gpt-6-sol`. The retired `tuxevil-rotator` provider must not
  return. Do not reintroduce obsolete OpenCode workflow targets.
- `pi/agent/pi-ext-roles/settings.json` and `pi/agent/pi-extensible-workflows/settings.json` share the same 16-entry role matrix. Workflow roles use CLIProxyAPI first: developer, tests, debugging, verification, QA, release, and SRE use `cliproxyapi/gpt-5.6-luna:high`; reviewer, oracle, architecture, and security use `cliproxyapi/gpt-6-sol:high`; research, scouting, market research, and marketing use `cliproxyapi/gemini-3.8-flash-high:medium`; and summarization uses `cliproxyapi/gemini-3.5-flash-lite:low`. Native and mirror aliases are retired. Preserve the expanded `skills` list. When a primary route is unavailable in the authenticated catalog, the role may use the first reachable route in its committed HA group at the configured effort; this is the explicit failover path, not a silent alias rewrite.
- `pi/agent/settings.json`: the Pi baseline is `defaultProvider: cliproxyapi`,
  `defaultModel: gpt-5.6-luna`, `defaultThinkingLevel: high`, and matching
  `modelThinkingLevels`. `enabledModels` lists only CLIProxyAPI models. `.gga` remains on the Pi
  bridge with the direct `cliproxyapi/gpt-6-luna:high` route; it must not resolve through a role
  alias. `check-config.sh` requires the route to be enabled and listed in the development HA group.
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
