# Pi configuration

The parent repository's `setup_env.sh` selectively synchronizes this directory into `~/.pi/agent`, preserving runtime state such as credentials, sessions, and installed packages. It removes a legacy symlink before creating the managed directory.

The module-owned package entries in `settings.json` (`pi-extensible-workflows`, `gentle-pi`, `pi-mcp-adapter`) are installed and verified by `@darkrei08/setup-ai`'s `pi-workflows` and `gentle-ai` modules, which keep ownership of them instead of listing them in `pi-packages.txt`. They are registered here because `setup_env.sh`'s `sync_pi` rsyncs this file over `~/.pi/agent` on every run and would otherwise undo what a module added. `npm:gentle-engram` is a plain `pi-packages.txt` line, kept in both files for consistency.

## Tuxevil Gemini gateway

The `tuxevil-rotator` provider sends Pi's OpenAI-compatible requests to `http://localhost:51200/v1` with the documented non-secret open-mode key `tuxevil`. The configured Gemini variants (Flash 3.8 and Pro 3.1, one model per thinking effort) share the documented 1,000,000-token context and 65,536-token output limits and accept text and image input. The gateway exposes Flash at low/medium/high and Pro at low/high only.

Install, authenticate, and start the local gateway before using the aliases:

```bash
npm install -g tuxevil-rotator
tuxevil-rotator login
tuxevil-rotator start
```

Verify the gateway and its model catalog locally:

```bash
curl http://localhost:51200/v1/models \
  -H 'Authorization: Bearer tuxevil'
```

The configured Gemini IDs are exposed by `/v1/models`: the Flash effort variants `gemini-3.8-flash-low`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-high`, and the Pro effort variants `gemini-3.1-pro-low`, `gemini-3.1-pro-high`. Re-check `/v1/models` when the gateway catalog changes; the effort set mirrors what the gateway exposes. Account rotation happens inside `tuxevil-rotator`; Pi only selects the exact provider/model target configured here.

Select a variant. For the Pi CLI and the native `/model` picker, use the full `provider/model` target (an optional thinking suffix maps to the configured level):

```bash
pi --model tuxevil-rotator/gemini-3.8-flash-low
pi --model tuxevil-rotator/gemini-3.8-flash-high
pi --model tuxevil-rotator/gemini-3.1-pro-low
pi --model tuxevil-rotator/gemini-3.1-pro-high
```

The short `gemini-flash-low`, `gemini-flash-medium`, `gemini-flash-high`, `gemini-pro-low`, and `gemini-pro-high` names are **workflow-scoped aliases** defined in `pi-extensible-workflows/settings.json`. They resolve only where the workflow extension accepts model aliases (workflow role/model settings), not on the Pi CLI or in the native `/model` picker, until a global alias mechanism is verified. Selecting a model does not change the active workflow role. Existing `cheap-model` and role aliases remain unchanged.

`cockpit-tools` is separate: it is the GUI/account manager and Codex sidecar, not the Gemini gateway. Use `tuxevil-rotator` for the Gemini-compatible endpoint above. `~/.pi/agent/auth.json` and tuxevil account tokens remain local and untracked; this repository does not store or modify them.

## Cockpit account sync extension

`settings.json` installs `github:darkrei08/pi-cockpit-tools-sync` as a Pi extension. When setup-ai provisions the optional rotator module, it installs the same extension with `pi install`. The extension reads local cockpit-tools account markers and provides:

- `/cockpit-sync`: sync the active cockpit account to Pi auth.
- `/cockpit-provision`: provision cockpit accounts into a local rotator.
- `/cockpit-proxy`: inspect or manage the local proxy.

It does not commit tokens; OAuth data remains in the user profile and is never stored in this repository.

## Context budget and compaction

Pi compacts when the reported context exceeds `contextWindow - reserveTokens`, not at a fixed percentage. With Pi's default `reserveTokens: 16384` and `keepRecentTokens: 20000`, the approximate trigger is 87.50% for a 131,072-token window, 91.81% for 200,000, and 98.36% for 1,000,000. `keepRecentTokens` controls the retained tail after compaction; it does not change the trigger.

Measure the effective limit for the exact `provider/model` before changing settings: use `pi --list-models`, `/session`, or the RPC session stats, and treat a gateway's `/v1/models` catalog as authoritative for that gateway. For long, tool-heavy sessions prefer a measured reserve that leaves room for the verified output budget rather than disabling compaction. The repository's `pi-codex-context` package adds session windows and history tools; it must remain the sole compaction provider for managed sessions.

See the setup-ai [context-budget policy](https://github.com/darkrei08/setup-ai/blob/main/docs/context-budget.md) for the calculation, tuning examples, and verification record.
