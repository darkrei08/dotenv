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
- `pi/agent/pi-ext-roles/settings.json` (roles and shared role settings; `pi/agent/pi-extensible-workflows/settings.json` keeps only workflow `extensionSettings`): the user-approved 2026-11-22 subscription-aware matrix is authoritative. `developer`, `tests-expert` and `scout` use the direct `opencode-go/deepseek-v4.1-flash:high` route because it publishes 384K output and clears the 32K code floor. `architect`, `debugger`, `release` and `sre` use `opencode-go/deepseek-v4-pro:high`. `reviewer`, `oracle`, `security` and `verifier` use `cliproxyapi/gemini-4-hydrogen-xhigh`: user-confirmed, opposite-provider, with entitlement/quota UNVERIFIED after two timed-out probes. Remaining authoring, research and design roles use `cliproxyapi/go/deepseek-v4.1-flash:high`; summaries and writing use `cliproxyapi/go/deepseek-v4.1-flash:low`. Provider-family compatibility aliases are not active. Preserve the expanded `skills` list. The four verified free OpenCode routes (`beam-free`, `hy4-flash-free`, `iceman-contributor-free`, `longcat-2.5-free`) are trailing HA fallbacks only: never automatic primaries, and never members of the `reviewer` group. When a primary route is unavailable in the authenticated catalog, the role may use the first reachable route in its committed HA group at the configured effort; this is the explicit failover path, not a silent alias rewrite.
- `pi/agent/settings.json`: the Pi baseline is `defaultProvider: cliproxyapi`, `defaultModel: gpt-5.6-luna`, `defaultThinkingLevel: high`, and matching `modelThinkingLevels`. `enabledModels` keeps native mirrors and current CLIProxyAPI targets; native catalogs remain defined for manual fallback. `.gga` remains on the Pi bridge with `cliproxyapi/gpt-6-sol:high` as the reviewer HA fallback until the Gemini primary is live-verified. `check-config.sh` requires that route to be enabled and listed in the reviewer HA group.
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
