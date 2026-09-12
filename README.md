# dotenv

Personal Linux/WSL configuration. This checkout is the source of truth: run `./setup_env.sh` to install required tools and overwrite managed configuration from this repository. Omarchy/Arch uses `omarchy pkg add`; Debian/Ubuntu uses `apt-get`.

## Install

```bash
git clone https://github.com/vekexasia/dotenv.git ~/git/personale/dotenv
~/git/personale/dotenv/setup_env.sh
```

Managed: Neovim, tmux, WezTerm (WSL), Herdr configuration, clipboard helpers, Pi, and shell additions. Pi configuration is linked from this checkout; an existing `~/.pi/agent` directory is backed up before linking.

`gh` and `glab` are installed but still require `gh auth login` and `glab auth login`.

Herdr itself is not installed. Its configuration is managed, and Pi integration is refreshed when Herdr is present.

## Agent extensions

Pi packages are declared instead of hand-edited: `pi/agent/pi-packages.txt` lists one source per line, with blank lines and `#` comments ignored. `@darkrei08/setup-ai`'s `pi-packages` module resolves that exact path while `~/.pi/agent` is this checkout, installs every line with `pi install`, and verifies each one in `settings.json`, so a fresh clone converges on the same set:

```bash
bash setup-ai.sh --only pi-packages   # from the @darkrei08/setup-ai checkout
```

`pi-extensible-workflows` is intentionally absent from the manifest, because setup-ai's `pi-workflows` module owns that package (published release or patched local build). The package entries that are still local checkouts outside this repository are listed in `pi/agent/README.md`.

The non-Pi agents get the same `ponytail` ruleset from `agents/install-agent-extensions.sh`:

```bash
bash agents/install-agent-extensions.sh
```

It installs `ponytail` for every agent CLI it finds on `PATH` (Codex, Antigravity `agy` or Gemini CLI, Copilot CLI, OpenCode), logs and skips the ones that are absent, and is safe to re-run. Claude Code is not scriptable, because its install is two interactive `/plugin` commands, so the script prints them as a manual step.

Subagents inherit `ponytail` in two different ways. A pi child process (the subagent runners spawn `pi` again) reads the same packages from `settings.json`, so the extension injects the ruleset with no extra configuration. Workflow agent sessions instead load only the extensions allowlisted in `pi/agent/pi-extensible-workflows/settings.json`, which is why `**/ponytail/**` is listed there; the always-on ruleset comes from that extension, while the `/ponytail-review` style commands additionally need the `ponytail*` skill names in that file's `skills` allowlist. ponytail's `PONYTAIL_SUBAGENT_MATCHER` narrowing is implemented for its Claude Code and Qoder subagent hooks only, so pi subagents cannot be filtered by agent type.
