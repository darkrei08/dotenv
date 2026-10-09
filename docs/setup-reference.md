# Setup reference

What `setup_env.sh` requires, what it changes on the machine and what each step does. For the install command, see the [README](../README.md).

## Requirements

| Requirement | Detail |
| --- | --- |
| OS | Linux or WSL2. `setup_env.sh` reads `/etc/os-release` and exits 1 on anything outside the Arch (`omarchy`, `arch`) and Debian (`debian`, `ubuntu`) families. |
| WSL | Detected from `/proc/version`. WSL adds `wl-clipboard`, `imagemagick`, the clipboard helpers in `.local/bin` and the Windows `.wezterm.lua` copy. |
| Privileges | `sudo` for `apt-get`, `pacman`, installing `go` under `/usr/local`, and the Neovim tarball. `omarchy pkg add` is used instead of `pacman` when `omarchy` is on `PATH`. |
| Runtime | A POSIX shell plus `bash`. Neovim 0.12.0 or newer is required; the script installs it when missing or older. |
| Node.js / npm | `node`, `npm`, and `npx` must already be on `PATH`; Node.js >=22.19.0 is required for Pi and Copilot (the script checks this early and does not install Node). |
| Python | `python3` and `python3-venv` (Debian installs `python3-venv` explicitly) for the `gigatoken` virtualenv. |
| Network | Distribution mirrors, `https://go.dev/dl/`, the Go module proxy, `api.github.com`, GitHub release assets, `https://github.com/HKUDS/CLI-Anything.git`, `https://github.com/Gentleman-Programming/gentleman-guardian-angel.git`, the npm registry and `npx skills`, `https://raw.githubusercontent.com/darkrei08/ai-memory-kit/`, `https://antigravity.google/cli/install.sh`, `https://chatgpt.com/codex/install.sh`, `https://claude.ai/install.sh`, and `https://cursor.com/install`. |
| Git identity | `gh` and `glab` are installed but not authenticated; `gh auth login` and `glab auth login` remain manual. |

External binaries required at runtime are listed in [External binaries and runtime dependencies](#external-binaries-and-runtime-dependencies).

## What it touches

The script is meant to be re-run. What it touches:

| Target | Behaviour |
| --- | --- |
| `~/.pi/agent` | A real directory populated by selective rsync of versioned items from `pi/agent`; a leftover symlink is removed, and an existing non-directory target is backed up. Runtime state is preserved. |
| `~/.config/nvim` | `rsync -a --delete` from `nvim/`, excluding `node_modules/`. Anything else in the target that is not in the repository is deleted. |
| `~/.config/herdr/config.toml`, `~/.tmux.conf` | Overwritten with `install -Dm644`. |
| `~/.local/bin` | Overwritten with `rsync -a` on WSL only. |
| `$USERPROFILE/.wezterm.lua` | Overwritten on WSL when `powershell.exe` and `wslpath` are available. |
| `~/.bashrc` | Appended only, one line at a time, and only when the exact line is absent (`append_once`). Nothing is rewritten. |

Nothing is committed or pushed by the script. `gh` and `glab` stay unauthenticated.

## Steps

`setup_env.sh` runs under `set -euo pipefail` and is idempotent. In order:

1. **Bootstrap.** Resolve the repository directory from `BASH_SOURCE`, detect WSL from `/proc/version`, source `/etc/os-release` and exit 1 outside the supported families. Create `~/.bin` and `~/.local/bin`, extend `PATH`, and require Node.js >= 22.19 with `npm` and `npx` (Node.js is not installed by the script).
2. **Helpers.** `install_package` skips a command that already exists, otherwise uses `omarchy pkg add`, `pacman -S --needed --noconfirm` or `apt-get install -y`. `install_release` downloads the newest GitHub release asset that matches a jq regex into `~/.bin`. `append_once` adds a line to `~/.bashrc` only when it is absent.
3. **System packages.** `make`, `gcc`, `g++`, `ripgrep`, `git`, `curl`, `xclip`, `jq`, `tree`, `htop`, `fd`/`fd-find`, `rsync`, `fzf`, `bat`/`batcat`, `gh`, `glab`, `python3`, `python3-venv`. On WSL also `wl-clipboard` and `imagemagick`. `batcat` is symlinked to `~/.bin/bat` when needed; `lazygit` and `zellij` come from the distribution on Arch and from GitHub releases elsewhere.
4. **Shell additions.** Append `PATH` entries, `fzf --bash`, `BAT_THEME`, `SUDO_EDITOR=nvim`, aliases and fzf preview options to `~/.bashrc`.
5. **Go and Neovim.** Install Go (distribution package on Arch, otherwise the `go1.24.4.linux-amd64` tarball into `/usr/local`). Require Neovim >= 0.12.0: update the distribution package on Arch, otherwise install the `nvim-linux-x86_64` release tarball into `/opt`, then verify the version.
6. **Dotfiles.** Sync `nvim/` into `~/.config/nvim`, install `herdr/config.toml` and `.tmux.conf`. On the host named `devbox`, insert `copy_on_select = false` under `[ui]` in the Herdr config. On WSL, also sync `.local/bin/` and copy `.wezterm.lua` into the Windows profile.
7. **Neovim helper.** Create `~/.local/share/nvim/gigatoken-venv` and `pip install gigatoken` when the venv is absent.
8. **Pi.** On Arch/Omarchy, delete a mise-managed `~/.local/bin/pi` shim that leaks mise output into Pi's stdout and remove its global mise selection. On every supported distribution, install `@earendil-works/pi-coding-agent` with npm when `pi` is missing. Then run `sync_pi`, install and verify the pinned CLI-Anything Pi extension, and apply each non-comment entry of `pi/agent/pi-packages.txt` with `pi install`, skipping `pi-extensible-workflows` (owned by setup-ai).
9. **Shared skills.** Unless `SETUP_AI_SKIP_SKILLS=1`, install the skills listed in [Skill provenance](skills-and-agents.md#skill-provenance) with `npx skills add ... --global --agent pi cline --yes`, so skills-cli keeps one canonical copy under `~/.agents/skills`. The pinned `darkrei08/ai-memory-kit#v0.1.0` `project-memory` install fails closed if the tag cannot be fetched, and its CLI installer runs with `--no-skill`.
10. **AI CLIs.** Install the missing ones and verify that all of `pi`, `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor-agent` and `ccusage` exist: `gentle-ai` through its official Go module, `gga` by clone and install, native installers for `agy`, `codex`, `claude` and `cursor-agent`, npm packages for `gemini`, `copilot`, stable `opencode` and `ccusage`. When run as root, `agents/ensure-claude-root-mode.sh` sets `permissions.defaultMode` to `default` in `~/.claude/settings.json`.
11. **Herdr integration.** When `herdr` is on `PATH`: install `bun` into `/usr/local` if absent, run `herdr integration install pi` and `herdr plugin link herdr/plugins/agent-notify`. Then run `pi update --extensions` when `pi` exists.
12. **Neovim tooling.** `npm ci` in `~/.config/nvim`, install `@typescript/native-preview` and `tree-sitter-cli`, then headless Neovim: `Lazy! restore`, `MasonInstall markdownlint` and the tree-sitter parser install.
13. **Drift check.** Fail if the managed Pi alias or extension configuration has drifted from the versioned copy.

The exact order and flags are in `setup_env.sh`; this list is prose on purpose, because line numbers change on every edit.

### The Pi block in detail

- **The `~/.pi/agent` configuration.** `sync_pi` removes a leftover symlink, creates a real directory, and selectively rsyncs the versioned allowlist from `$REPO_DIR/pi/agent`. It preserves runtime state such as `auth.json`, `sessions/`, `agents/`, `chains/`, `npm/node_modules`, and caches. The `extensions/` copy excludes `piextworkflows.ts` and `pi-ext-workflows/`, which setup-ai's `pi-workflows` module owns; it verifies `pi-extensible-workflows/roles` and `settings.json`.
- **Package installs.** The Pi CLI itself comes from npm (`@earendil-works/pi-coding-agent`), `setup_env.sh` applies `pi/agent/pi-packages.txt` with `pi install`, and the skill packages come from the guarded `npx skills add` blocks. `@darkrei08/setup-ai`'s `pi-packages` module also consumes the manifest when orchestrated (see [Pi configuration](pi-configuration.md)).
- **`pi` commands.** `pi install` applies each manifest entry, and `pi update --extensions` runs near the end of the script when `pi` is on `PATH`.

## Managed configuration

| Repository path | Target | Mechanism |
| --- | --- | --- |
| `pi/agent` | `~/.pi/agent` | Selective `rsync` of the versioned allowlist; a leftover symlink is removed, non-directory targets are backed up, and runtime state is preserved (`sync_pi`) |
| `nvim/` | `~/.config/nvim/` | `rsync -a --delete --exclude=node_modules/` |
| `herdr/config.toml` | `~/.config/herdr/config.toml` | `install -Dm644`, plus a `sed` insert on the `devbox` host |
| `herdr/plugins/agent-notify/` | herdr plugin registry (per user, global to all sessions) | `herdr plugin link` when `herdr` is on `PATH`, inside the same `command -v herdr` block as `herdr integration install pi` |
| `.tmux.conf` | `~/.tmux.conf` | `install -Dm644` |
| `.local/bin/` | `~/.local/bin/` | `rsync -a`, WSL only |
| `.wezterm.lua` | `$USERPROFILE/.wezterm.lua` | `install -Dm644`, WSL only, when `powershell.exe` and `wslpath` exist |
| Shell additions (no file) | `~/.bashrc` | `append_once`, exact-match guarded (`append_once` in `setup_env.sh`) |
| `agents/skills/phantom-ui` | every existing agent skills root | `agents/install-agent-extensions.sh` (not run by `setup_env.sh`) |

The allowlisted versioned items under `pi/agent` are copied to `~/.pi/agent/...` on a machine set up this way; runtime state remains in the live directory, and the repository paths remain `pi/agent/...`.

## External binaries and runtime dependencies

| Binary | Needed by | What breaks without it |
| --- | --- | --- |
| `bash` | `setup_env.sh`, `agents/*.sh`, `pi/agent/bin/open-nvim.sh` | Nothing runs. |
| `git`, `curl`, `jq` | `setup_env.sh` release downloads, the skills CLI, various extensions | `install_release` fails on the jq parse; downloads fail. |
| `rsync` | `setup_env.sh` nvim and WSL `.local/bin` sync | Config sync fails (the script runs under `set -e`). |
| `sudo` | `apt-get`, `pacman`, installing Go and Neovim into system paths | Package and runtime installs fail on Debian/Arch. |
| `npm` / `npx` | Pi and the other npm-backed CLI installs, all `npx skills add` lines, Neovim tooling, `agents/link-skills.mjs` (Node) | Setup cannot install the required CLIs or skills. |
| `node` (>= 22.19.0) | `setup_env.sh`, `agents/link-skills.mjs`, `pi/agent/bin/session-stats.mjs`, the OpenCode plugin edit in `install-agent-extensions.sh` | Setup exits before provisioning; Node-based tools cannot run. |
| `pi` | `pi install` for manifest entries, `pi update --extensions`, every Pi session | Setup fails its required-CLI verification and Pi cannot run. |
| `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor-agent`, `ccusage` | Required coding-agent CLIs (and the local usage reader `ccusage`) installed by `setup_env.sh` | Setup fails its final required-command verification if any is unavailable. |
| `nvim` (>= 0.12.0) | `extensions/vim-editor.ts` (`alt+m`) | The shortcut fails to spawn the editor. |
| `herdr` | `extensions/fork-out.ts`, `extensions/herdr-nvim-blocked/index.ts`, `bin/open-nvim.sh`, the `herdr-devbox` alias | `/fork-out` and the blocked-pane marker cannot report; `open-nvim.sh` exits 1 outside herdr. |
| `tmux` | `extensions/tmux-progress.ts` | No tab progress; the extension is otherwise inert. |
| `gh`, `glab` | `pi/agent/extensions/pi-ext-workflows/*`, `prompts/fixissues.md` | Issue workflows cannot list or close issues. Both need `auth login`. |
| `fzf`, `bat`, `tree`, `rg`, `fd` | Shell additions, fzf previews, general tooling | Previews and aliases degrade; `bat` is symlinked from `batcat` on Debian. |
| `python3` | The `gigatoken` virtualenv | The venv is not created. |
| `go` | Go development | Installed by the script when missing (1.24.4). |
| `aimem` | The ai-memory-kit CLI | Installed by the script when missing; the `project-memory` skill still installs. |
| `curl`/`wget` + a shell | `install-agent-extensions.sh` `npx` steps | `design-taste` and `impeccable` are skipped with a `SKIP` line. |
