# dotenv

Linux/WSL dotfiles plus a ready-to-use configuration for the Pi coding agent and the other AI coding CLIs. This checkout is the source of truth: `./setup_env.sh` installs the tools and overwrites managed configuration from here.

Remotes: `origin` is `darkrei08/dotenv` (the fork this machine works in), `upstream` is `vekexasia/dotenv`. How the two differ: [docs/upstream-comparison.md](docs/upstream-comparison.md).

## Quick start

```bash
git clone https://github.com/darkrei08/dotenv.git ~/git/personale/dotenv
~/git/personale/dotenv/setup_env.sh
bash ~/git/personale/dotenv/check-config.sh   # config invariants
gh auth login && glab auth login              # manual, never automated
```

Before you run it:

- **OS:** Arch/Omarchy or Debian/Ubuntu families, on Linux or WSL2. Anything else exits 1.
- **Node.js >= 22.19 with `npm` and `npx` must already be on `PATH`.** The script does not install Node.
- **`sudo`** is used for system packages, Go and Neovim.
- The script is safe to re-run. It never commits or pushes, and it preserves Pi credentials and sessions.

Optional: the localhost-only CLIProxyAPI gateway and usage dashboard ([setup guide](cliproxyapi/README.md)).

## What gets installed and where it is configured

| Area | What you get | Configured in |
| --- | --- | --- |
| Pi | Pi CLI, community packages, in-repo extensions, prompts, themes. `~/.pi/agent` is a real directory filled by a selective `rsync`; credentials and sessions are kept. | `pi/agent/settings.json`, `pi/agent/pi-packages.txt`, `pi/agent/extensions/`; [docs/pi-configuration.md](docs/pi-configuration.md) |
| Models and roles | Claude Pro and ChatGPT Plus models, workflow aliases and 12 workflow roles. | `pi/agent/pi-extensible-workflows/`, `pi/agent/models.json`; [pi/agent/MODELS.md](pi/agent/MODELS.md) |
| Workflows | `pi-extensible-workflows`, installed by `@darkrei08/setup-ai` (`pi-workflows` module), not by `setup_env.sh`; in-repo workflow functions. | `pi/agent/extensions/pi-ext-workflows/`; [docs/pi-configuration.md](docs/pi-configuration.md) |
| Commit review gate | GGA reviews staged files through Pi. Gentle AI and gentle-pi. | `.gga`, `agents/gga-pi/`; [docs/gentle-ai-gga.md](docs/gentle-ai-gga.md) |
| Local usage | `ccusage` and the `/agent-usage` command. | `pi/agent/extensions/agent-usage/`, `setup_env.sh` |
| Skills | Shared skills installed once and linked into every agent. | `agents/skills.manifest.json`, `agents/link-skills.mjs`; [docs/skills-and-agents.md](docs/skills-and-agents.md) |
| Other agent CLIs | `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor-agent`. | `setup_env.sh`, `agents/install-agent-extensions.sh`; [docs/skills-and-agents.md](docs/skills-and-agents.md) |
| Editor and terminal | Neovim (>= 0.12), tmux, WezTerm (WSL), shell additions, `lazygit`, `zellij`, Go. | `nvim/`, `.tmux.conf`, `.wezterm.lua`, `.local/bin/`; [docs/setup-reference.md](docs/setup-reference.md) |
| Herdr | Config and the Pi integration when `herdr` is installed (the binary itself is not). Agent notifications plugin. | `herdr/config.toml`, `herdr/plugins/agent-notify/`; [docs/herdr-notifications.md](docs/herdr-notifications.md) |
| CLIProxyAPI (optional) | Local gateway and usage dashboard, Docker Compose. | `cliproxyapi/` |

## Models and routing

- **Claude goes through CLIProxyAPI.** The Anthropic login is not used. `pi/agent/settings.json` sets `defaultProvider: cliproxyapi`, and the workflow aliases `cheap-model` and `reviewer-model` resolve to `cliproxy-*` aliases (Sonnet 5.5 medium and Opus 5.5 high). The `native-*` Claude aliases stay as the mirror reference.
- **Codex stays native.** `tests-expert` and `researcher-model` use `openai-codex/gpt-6-luna`.
- **GGA reviews with `kilo:cliproxyapi/claude-opus-5-5:high`**, the CLIProxyAPI mirror of the workflow `reviewer` role. It runs through Pi, so it needs no separate Claude or Codex login.
- **Usage:** `setup_env.sh` installs `ccusage`. `ccusage daily` or `/agent-usage` in Pi shows local tokens and API-equivalent cost from the session logs. Pi's footer message `no subscription usage for this provider` is expected: gentle-pi only reads plan quota for `openai-codex`, `anthropic` and `nan`, not `cliproxyapi`.

Alias tables, plan limits and effort levels: [pi/agent/MODELS.md](pi/agent/MODELS.md) and [pi/agent/README.md](pi/agent/README.md). Providers, credentials and the full alias mapping: [docs/pi-configuration.md](docs/pi-configuration.md#providers-and-credentials).

## Documentation

| Page | Covers |
| --- | --- |
| [docs/setup-reference.md](docs/setup-reference.md) | Requirements, what `setup_env.sh` touches, its steps in order, managed targets, external binaries. |
| [docs/pi-configuration.md](docs/pi-configuration.md) | Pi packages, in-repo extensions, skills roots, other Pi files, providers and credentials. |
| [docs/skills-and-agents.md](docs/skills-and-agents.md) | One-copy skills layout, linker commands, skill provenance, non-Pi agents. |
| [docs/herdr-notifications.md](docs/herdr-notifications.md) | The `agent-notify` Herdr plugin. |
| [docs/gentle-ai-gga.md](docs/gentle-ai-gga.md) | Gentle AI, gentle-pi, GGA and the reviewer model. |
| [docs/verification.md](docs/verification.md) | Post-install checks and known gaps. |
| [docs/upstream-comparison.md](docs/upstream-comparison.md) | What `vekexasia/dotenv` and `pi-extensible-workflows` install versus this repository. |
| [docs/resource-discipline.md](docs/resource-discipline.md) | Memory budget for several Pi sessions. |
| [agents/LINKING.md](agents/LINKING.md) | Skill linker actions and conflict procedure. |
