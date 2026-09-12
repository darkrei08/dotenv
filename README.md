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

The same script installs the shared design skills, from the distributions upstream owns:

- `design-taste` (<https://github.com/h3nryprod01/design-taste>) with the agent-skills CLI
  (`npx skills add`), for every agent CLI on `PATH`. It is a single skill that already merges the
  anti-slop and pre-flight material from impeccable, emilkowalski's motion craft and taste-skill;
  its license is mixed (MIT plus Apache-2.0 for the impeccable-derived references), and the
  upstream `NOTICE` travels with it.
- `impeccable` (<https://github.com/pbakaus/impeccable>) with its own installer
  (`npx impeccable install --providers=... --scope=global`), for every harness of its list that is
  present, and its engine binary in `~/.impeccable/bin`. It writes its provider-native hook manifest
  for the directory it runs in, so the script runs it in a scratch directory: a global install must
  not leave a hook manifest behind, and project hooks belong to `npx impeccable install` run inside
  that project.
- `phantom-ui` is different: it is a component library with no upstream skill to install, so this
  repository vendors it. `agents/skills/phantom-ui/` holds a `SKILL.md` written here, the MIT
  standalone build of `@aejkatappaja/phantom-ui` (`phantom-ui.standalone.js` plus its `.d.ts`) and
  the upstream `LICENSE`; `VENDORED.md` records the exact version, integrity and the refresh
  procedure. The script copies that directory into every agent skills root that exists, globally,
  and leaves a copy that already matches alone.

Because the upstream skills CLI only copies into an agent's own directory for the agents it
supports, `design-taste` may end up in the shared `~/.agents/skills` root while `phantom-ui` is
copied into each agent root by this script. `@darkrei08/setup-ai` accepts the shared root for
every agent and warns when the per-agent copy was skipped, so neither case reads as a failure.

For the workflow agents of `pi-extensible-workflows`, the skills allowlist in
`pi/agent/pi-extensible-workflows/settings.json` names `impeccable`, `design-taste` and
`phantom-ui`, next to `engineering-excellence`, `ponytail*` and `image-generation`. Workflow agent
sessions load only what that file allows, so a skill installed on the machine is not enough on
its own; the same file is where the `modelAliases` the workflows resolve live.

Subagents inherit `ponytail` in two different ways. A pi child process (the subagent runners spawn `pi` again) reads the same packages from `settings.json`, so the extension injects the ruleset with no extra configuration. Workflow agent sessions instead load only the extensions allowlisted in `pi/agent/pi-extensible-workflows/settings.json`, which is why `**/ponytail/**` is listed there; the always-on ruleset comes from that extension, while the `/ponytail-review` style commands additionally need the `ponytail*` skill names in that file's `skills` allowlist. ponytail's `PONYTAIL_SUBAGENT_MATCHER` narrowing is implemented for its Claude Code and Qoder subagent hooks only, so pi subagents cannot be filtered by agent type.
