# Exact Vekexasia Pi and CLIProxyAPI integration

## Goal
Align the repository and live Pi profile with the verified Vekexasia workflow models, roles, enabled model catalog, Gentle AI routing, Guardian Angel model, and CLIProxyAPI support.

## Scope
- Use Vekexasia commit `00138582e074ed63309b4136478076314e912af9` as the source for overlapping Pi workflow configuration.
- Set the Pi/GGA model baseline to `gpt-5.6-luna` with `xhigh` effort as upstream does.
- Use CLIProxyAPI workflow aliases exactly as upstream: `cliproxyapi/gpt-6-luna:high` and `cliproxyapi/claude-opus-5-5:high`.
- Add the upstream `light-web-search.ts` extension and CLIProxyAPI provider package configuration.
- Preserve local Gentle AI, Engram, workflow package, and other local packages that are required by this harness unless they conflict with the requested upstream values.
- Never commit `cliproxyapi/config.yaml`, `cliproxyapi/auths/`, Pi `auth.json`, or OAuth credentials.

## Files expected to change
- `pi/agent/settings.json`
- `pi/agent/models.json` only if required to expose the upstream catalog without losing required local behavior
- `pi/agent/subagents.json`
- `pi/agent/pi-extensible-workflows/settings.json`
- `pi/agent/pi-extensible-workflows/roles/developer.md`
- `pi/agent/pi-extensible-workflows/roles/reviewer.md`
- `pi/agent/pi-extensible-workflows/roles/scout.md`
- `pi/agent/pi-extensible-workflows/roles/tests-expert.md`
- `pi/agent/extensions/light-web-search.ts`
- `.codex/config.toml`
- `.gga`
- `cliproxyapi/README.md` and config/compose files only for verified setup drift

## Acceptance checks
- JSON/TOML/YAML configuration parses.
- Standard workflow aliases and roles resolve to the exact upstream model IDs and efforts.
- Pi default and Guardian Angel use `gpt-5.6-luna:xhigh`.
- CLIProxyAPI provider package and `enabledModels` are declared; provider discovery remains dynamic until OAuth.
- Local config remains ignored and private; no credentials enter Git.
- Live managed files match repository files byte-for-byte.
- `pi --list-models` succeeds; CLIProxyAPI discovery is reported separately if OAuth is unavailable.
- The actual pre-commit GGA hook passes before commit.

## Non-goals
- Do not automate browser OAuth or inspect existing provider credentials.
- Do not start Docker while agent work is in progress; validate Compose configuration and leave service startup to the explicit local setup step.
- Do not push the resulting commit without a separate request.

## Tasks
- [x] Align exact upstream model, alias, role, enabled-model, extension, and GGA settings.
- [x] Update and validate CLIProxyAPI repository/local setup without exposing secrets.
- [x] Sync the live Pi profile and provider package.
- [ ] Run checks, GGA, and commit one coherent work unit. Checks and GGA are complete; commit remains pending explicit delivery authorization.

## Current status
- Repository configuration now uses `gpt-5.6-luna` with `xhigh` for Pi, subagent review profiles, and Guardian Angel.
- Standard workflow aliases use the exact upstream CLIProxyAPI targets: `cheap-model=cliproxyapi/gpt-6-luna:high`, `oracle-model=cliproxyapi/claude-opus-5-5:high`, and `reviewer-model=cliproxyapi/claude-opus-5-5:high`; developer/scout/tests/researcher remain chained to `cheap-model`.
- Added the pinned upstream `light-web-search.ts`, then fixed two API-compatibility issues: domain-filter retries remove `-site:` tokens cleanly, and only `allowed_domains` is sent to the Responses API; CLIProxyAPI is attempted before openai-codex.
- Removed `pi-web-access` from the active Pi/package manifests because it conflicts with the tracked `web_search` extension.
- Local `cliproxyapi/config.yaml` was preserved/configured without exposing it; client config is mode 600 and `auths/` is mode 700. Compose validation passed; Docker was not started and OAuth was not run.
- GREEN assertions, JSON/package checks, Debian 13 and Arch container rows, Compose validation, normal Pi startup/list-models, and live/repository byte comparisons passed. CLIProxyAPI model discovery remains empty until provider OAuth/configuration is completed.
- Guardian Angel pre-commit review passed (`STATUS: PASSED`) for the staged candidate. The candidate was then unstaged; no commit or push was made.

## Next steps
1. Complete CLIProxyAPI OAuth manually using `cliproxyapi/README.md`, then restart Pi and select/verify the discovered models.
2. Commit the unstaged candidate only after explicit user authorization.
