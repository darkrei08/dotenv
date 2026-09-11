# Pi configuration

This directory is linked to `~/.pi/agent` by the parent repository's `setup_env.sh`. Running setup replaces any existing target with this symlink.

The workflow and Herdr package entries in `settings.json` still require a checkout at `~/git/personale/pi-workflows`. They remain local paths until that project is packaged or added to this repository.

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
