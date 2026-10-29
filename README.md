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

For shell and LLM access to Pi High Availability, use `pi-ha status --json`,
`pi-ha group <name> <provider/model-id>...`, or `pi-ha use <name>`. The `/ha`
command remains a Pi slash command and is not a Bash executable.

## SkillOpt-Sleep for Pi

`setup_env.sh` uses the local SkillOpt fork at
`$SKILLOPT_SLEEP_REPO` (default: `$HOME/git/personale/upstream`) when its
Codex installer is present. It installs the `skillopt-sleep` skill into the
canonical user skill root without cloning or downloading another checkout. The
existing `skillopt-sleep` selector in
`pi/agent/pi-ext-roles/settings.json` is what makes the skill available to Pi;
this setup does not add a second selector.

The safe first checks are read-only and use the deterministic mock backend:

```bash
export SKILLOPT_SLEEP_REPO="${SKILLOPT_SLEEP_REPO:-$HOME/git/personale/upstream}"
bash "$SKILLOPT_SLEEP_REPO/plugins/run-sleep.sh" status --project "$(pwd)"
bash "$SKILLOPT_SLEEP_REPO/plugins/run-sleep.sh" dry-run --project "$(pwd)" \
  --source pi --target-skill-path "$HOME/.agents/skills/skillopt-sleep/SKILL.md" \
  --backend mock --max-sessions 5 --max-tasks 3 --json
```

Harvesting and review/adoption are separate: inspect the staged report and
proposed edits before running `adopt`; do not treat harvesting as permission to
change live skills. A real `--source pi --backend pi` run is different: it can
send transcript-derived text and prompts to the provider configured in Pi, so
check that provider's retention and privacy policy first. This integration does
not run such a cycle or auto-adopt proposals.

## What gets installed and where it is configured

| Area | What you get | Configured in |
| --- | --- | --- |
| Pi | Pi CLI, community packages, in-repo extensions, prompts, themes. `~/.pi/agent` is a real directory filled by a selective `rsync`; credentials and sessions are kept. | `pi/agent/settings.json`, `pi/agent/pi-packages.txt`, `pi/agent/extensions/`; [docs/pi-configuration.md](docs/pi-configuration.md) |
| Models and roles | ChatGPT Plus/Codex, Claude, and Gemini subscriptions exposed through CLIProxyAPI, plus workflow aliases and 12 workflow roles. | `pi/agent/pi-extensible-workflows/`, `pi/agent/models.json`; [pi/agent/MODELS.md](pi/agent/MODELS.md) |
| Workflows | `pi-extensible-workflows`, installed by `@darkrei08/setup-ai` (`pi-workflows` module), not by `setup_env.sh`; in-repo workflow functions. | `pi/agent/extensions/pi-ext-workflows/`; [docs/pi-configuration.md](docs/pi-configuration.md) |
| Compaction | `@sting8k/pi-vcc` is the sole compaction owner for the main session and workflow children; `pi-codex-context` is source-only. | `pi/agent/settings.json`, `pi/agent/pi-vcc-config.json`; [docs/compaction-evaluation.md](docs/compaction-evaluation.md) |
| Commit review gate | GGA reviews staged files through Pi. Gentle AI and gentle-pi. | `.gga`, `agents/gga-pi/`; [docs/gentle-ai-gga.md](docs/gentle-ai-gga.md) |
| Local usage | `ccusage` and the `/agent-usage` command. | `pi/agent/extensions/agent-usage/`, `setup_env.sh` |
| Skills | Shared skills installed once and linked into every agent. | `agents/skills.manifest.json`, `agents/link-skills.mjs`; [docs/skills-and-agents.md](docs/skills-and-agents.md) |
| Other agent CLIs | `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor-agent`. | `setup_env.sh`, `agents/install-agent-extensions.sh`; [docs/skills-and-agents.md](docs/skills-and-agents.md) |
| CLI-Anything | `cli-hub` in an isolated virtualenv, the global Pi extension, and `pi-ha` for LLM-readable HA groups. | `setup_env.sh`, `pi/agent/bin/pi-ha`; [docs/setup-reference.md](docs/setup-reference.md) |
| Editor and terminal | Neovim (>= 0.12), tmux, WezTerm (WSL), shell additions, `lazygit`, `zellij`, Go. | `nvim/`, `.tmux.conf`, `.wezterm.lua`, `.local/bin/`; [docs/setup-reference.md](docs/setup-reference.md) |
| Herdr | Config and the Pi integration when `herdr` is installed (the binary itself is not). Agent notifications plugin. | `herdr/config.toml`, `herdr/plugins/agent-notify/`; [docs/herdr-notifications.md](docs/herdr-notifications.md) |
| CLIProxyAPI (optional) | Local gateway and usage dashboard, Docker Compose. | `cliproxyapi/` |

## Models and routing

- **Workflow roles use a provider-diverse authenticated CLIProxyAPI catalog.** Pi Ext Roles is authoritative: each role selects an alias, and the alias map supplies the exact provider/model ID plus separate effort. Developer and tests use GPT-5.6 Luna at high effort; reviewer and security use Claude Opus 4.6 Thinking with effort off; oracle, architect, researcher, market researcher, and marketing strategist use Gemini 3.8 Flash at medium effort because Gemini high effort timed out before model output in the Herdr workflow transport; QA, release, SRE, debugger, and verifier use Claude Sonnet 4.6 with effort off; Scout uses Gemini 3.8 Flash at medium effort; summarizer uses Gemini 3.5 Flash Lite at low effort. Native aliases remain manual mirrors and are hidden from the active picker.
- **Pi preflight gates routing.** The repository-owned `model-preflight.mjs` extension invokes the reusable pi-model-fit preflight at session start, via `/model-preflight`, and periodically using a bounded TTL cache. It fails closed on stale or unknown evidence and keeps catalog visibility, entitlement, inference, and quota separate. It never changes credentials or persistent aliases.
- **OpenCode uses DeepSeek V4.1 Flash by default.** The live OpenCode catalog currently exposes it as `opencode/deepseek-v4.1-flash-free`; the top-level setting uses its `#low` variant so delegating agents inherit the free model without starting at a high reasoning budget. Pi's separate `opencode-max` mode remains `opencode-go/deepseek-v4.1-flash` at max effort, and the global Pi default remains CLIProxyAPI.
- **GGA reviews through the CLIProxyAPI HA reviewer group** using the Pi Ext Roles alias `kilo:reviewer-model`, which resolves to `cliproxyapi/claude-opus-4-6-thinking:off`. The bridge preserves the configured Gemini cross-provider fallback; availability, entitlement, and quota still require runtime evidence.
- **Usage:** `setup_env.sh` installs `ccusage`. `ccusage daily` or `/agent-usage` in Pi shows local tokens and API-equivalent cost from the session logs. Pi's footer message `no subscription usage for this provider` is expected: gentle-pi only reads plan quota for `openai-codex`, `anthropic` and `nan`, not `cliproxyapi`.
- **Role-scoped extension pack:** `gwelinder/pi-extension-pack` is registered once, but role frontmatter selects only the resources each child needs. Coding and test roles receive `bash-fixer`, `tool-fixer`, `codegraph` and `dcg-guard;` research roles receive `codegraph`, `exa` and `rich-fetch`; review/security roles receive `codegraph` with `dcg-guard` where shell execution is allowed. Parent-only memory, routing, telemetry and update resources are not exposed to generic children. Herdr worktrees keep their existing isolated ownership model.

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
