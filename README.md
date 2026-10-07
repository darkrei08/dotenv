# dotenv

Personal Linux/WSL dotfiles plus a ready-to-use configuration for the Pi coding agent and the other AI coding CLIs. This checkout is the source of truth: `./setup_env.sh` installs the required tools and overwrites managed configuration from here.

What it gives you:

- **Models and roles** tuned for Claude Pro and ChatGPT Plus, with the role mapping of `vekexasia/dotenv`: Sonnet 5.5 as the daily driver, Opus 5.5 for review, GPT-6 Luna for tests and research. Native providers are the default and CLIProxyAPI mirrors the same models. See [`pi/agent/MODELS.md`](pi/agent/MODELS.md).
- **A commit review gate**: GGA reviews staged files through Pi with Sonnet 5.5 at high effort. See [`docs/gentle-ai-gga.md`](docs/gentle-ai-gga.md), which also covers Gentle AI and gentle-pi for Pi and the other agents.
- **Shared skills** installed once and linked into every agent ([`agents/LINKING.md`](agents/LINKING.md)).
- **An optional localhost-only CLIProxyAPI + usage dashboard** ([setup guide](cliproxyapi/README.md)).

Remotes: `origin` is `darkrei08/dotenv` (the fork this machine works in), `upstream` is `vekexasia/dotenv`.

## Requirements

| Requirement | Detail |
| --- | --- |
| OS | Linux or WSL2. `setup_env.sh` reads `/etc/os-release` and exits 1 on anything outside the Arch (`omarchy`, `arch`) and Debian (`debian`, `ubuntu`) families (lines 13-24). |
| WSL | Detected from `/proc/version` (line 6). WSL adds `wl-clipboard`, `imagemagick`, the clipboard helpers in `.local/bin` and the Windows `.wezterm.lua` copy. |
| Privileges | `sudo` for `apt-get`, `pacman`, installing `go` under `/usr/local`, and the Neovim tarball. `omarchy pkg add` is used instead of `pacman` when `omarchy` is on `PATH` (lines 40-55). |
| Runtime | A POSIX shell plus `bash`. Neovim 0.12.0 or newer is required; the script installs it when missing or older (lines 299-331). |
| Node.js / npm | `node`, `npm`, and `npx` must already be on `PATH`; Node.js >=22.19.0 is required for Pi and Copilot (the script checks this early and does not install Node). |
| Python | `python3` and `python3-venv` (Debian installs `python3-venv` explicitly) for the `gigatoken` virtualenv. |
| Network | Distribution mirrors, `https://go.dev/dl/`, the Go module proxy, `api.github.com`, GitHub release assets, `https://github.com/HKUDS/CLI-Anything.git`, `https://github.com/Gentleman-Programming/gentleman-guardian-angel.git`, the npm registry and `npx skills`, `https://raw.githubusercontent.com/darkrei08/ai-memory-kit/`, `https://antigravity.google/cli/install.sh`, `https://chatgpt.com/codex/install.sh`, `https://claude.ai/install.sh`, and `https://cursor.com/install`. |
| Git identity | `gh` and `glab` are installed but not authenticated; `gh auth login` and `glab auth login` remain manual. |

External binaries required at runtime are listed in [External binaries and runtime dependencies](#external-binaries-and-runtime-dependencies).

## Install

```bash
git clone https://github.com/darkrei08/dotenv.git ~/git/personale/dotenv
~/git/personale/dotenv/setup_env.sh
```

The script is meant to be re-run. What it touches:

| Target | Behaviour |
| --- | --- |
| `~/.pi/agent` | A real directory populated by selective rsync of versioned items from `pi/agent`; a leftover symlink is removed, and an existing non-directory target is backed up (lines 196-238). Runtime state is preserved. |
| `~/.config/nvim` | `rsync -a --delete` from `nvim/`, excluding `node_modules/` (line 334). Anything else in the target that is not in the repository is deleted. |
| `~/.config/herdr/config.toml`, `~/.tmux.conf` | Overwritten with `install -Dm644` (lines 335, 339). |
| `~/.local/bin` | Overwritten with `rsync -a` on WSL only (line 343). |
| `$USERPROFILE/.wezterm.lua` | Overwritten on WSL when `powershell.exe` and `wslpath` are available (lines 344-346). |
| `~/.bashrc` | Appended only, one line at a time, and only when the exact line is absent (`append_once`, lines 114-118 and 272-282). Nothing is rewritten. |

Nothing is committed or pushed by the script. `gh` and `glab` stay unauthenticated.

## What `setup_env.sh` does

| Lines | Section |
| --- | --- |
| 4-11 | Resolve `REPO_DIR` from `BASH_SOURCE`, detect WSL, source `/etc/os-release`. |
| 13-24 | Gate on the distribution family, or exit 1. |
| 26-38 | Create the local binary directories, extend `PATH`, and require Node.js >=22.19 plus npm/npx. |
| 40-55 | `install_package`: skip when the command already exists, otherwise `omarchy pkg add`, `pacman -S --needed --noconfirm`, or `apt-get install -y`. |
| 61-112 | `install_release`: download the newest GitHub release asset matching a jq regex, extract, and install the binary to `~/.bin`. |
| 114-118 | `append_once`: append a line to `~/.bashrc` only when absent. |
| 120-187 | Install and verify the pinned CLI-Anything Pi extension assets. |
| 189-238 | `sync_pi`, selectively copy the versioned Pi configuration into `~/.pi/agent` without replacing runtime state; see below. |
| 240-253 | Package list per family (`make`, `gcc`, `g++`, `ripgrep`, `git`, `curl`, `xclip`, `jq`, `tree`, `htop`, `fd`/`fd-find`, `rsync`, `fzf`, `bat`/`batcat`, `gh`, `glab`, `python3`, `python3-venv`). |
| 255-257 | Install every package with `install_package`. |
| 259-262 | WSL: `wl-clipboard` and `imagemagick`. |
| 264-271 | Symlink `batcat` to `~/.bin/bat` when needed and install `lazygit` and `zellij` (package on Arch, GitHub release otherwise). |
| 272-282 | Append the shell additions to `~/.bashrc`: `PATH` entries, `fzf --bash`, `BAT_THEME`, `SUDO_EDITOR=nvim`, aliases, and fzf preview options. |
| 284-297 | Install Go: the distribution package on Arch, otherwise `go1.24.4.linux-amd64` into `/usr/local`. |
| 299-331 | Require Neovim >= 0.12.0, updating the distribution package (Arch) or installing the `nvim-linux-x86_64` release tarball into `/opt`, then verify the installed version. |
| 333-339 | Sync `nvim/` into `~/.config/nvim`, install `herdr/config.toml` and `.tmux.conf`. On the host named `devbox`, insert `copy_on_select = false` under `[ui]` in the herdr config. |
| 341-348 | WSL: sync `.local/bin/`, and copy `.wezterm.lua` to the Windows profile directory. |
| 350-354 | Create `~/.local/share/nvim/gigatoken-venv` and `pip install gigatoken` when the venv is absent. |
| 356-367 | **Pi:** on Arch/Omarchy, delete a mise-managed `~/.local/bin/pi` shim that leaks mise output into Pi's stdout and remove its global mise selection; install `@earendil-works/pi-coding-agent` with npm when `pi` is missing on every supported distro. |
| 369-370 | `sync_pi` and install the CLI-Anything Pi extension. |
| 372-393 | Apply each non-comment entry in `pi/agent/pi-packages.txt` with `pi install`; skip `pi-extensible-workflows`, which is owned by setup-ai. |
| 394-420 | **Pi skills:** when `SETUP_AI_SKIP_SKILLS` is not `1`, run the shared `npx skills add ... --global --agent pi --copy --yes` commands for `herdrdev/herdr`, `mattpocock/skills` (`triage grill-me grilling wayfinder domain-modeling prototype research`), `pedronauck/skills` (`typescript-advanced`), `humanlayer/skills` (`show-me`), and `micio86dev/Engineering-Excellence` (`engineering-excellence`). The `darkrei08/ai-memory-kit#v0.1.0` `project-memory` install has an unpinned fallback, and its CLI installer runs with `--no-skill`. |
| 422-452 | Install missing AI CLIs and verify all ten required commands: `gentle-ai` via its official Go module, then (as root only) `agents/ensure-claude-root-mode.sh` sets `permissions.defaultMode` to `default` in `~/.claude/settings.json`, `gga` via clone/install, native installers for `agy`, `codex`, `claude`, `cursor-agent`, and npm packages for `gemini`, `copilot`, and stable `opencode`. |
| 453-458 | When `herdr` is on `PATH`, install `bun` into `/usr/local` if absent and run `herdr integration install pi`; then run `pi update --extensions`. |
| 459-476 | `npm ci` in `~/.config/nvim`, `@typescript/native-preview`, `tree-sitter-cli` with install scripts forced on, then headless Neovim: `Lazy! restore`, `MasonInstall markdownlint`, and the tree-sitter parser install. |
| 478-479 | Fail if the managed Pi alias or extension configuration has drifted. |

The Pi block in full:

- **The `~/.pi/agent` configuration.** `sync_pi` (lines 196-238) removes a leftover symlink, creates a real directory, and selectively rsyncs the versioned allowlist from `$REPO_DIR/pi/agent`. It preserves runtime state such as `auth.json`, `sessions/`, `agents/`, `chains/`, `npm/node_modules`, and caches. The `extensions/` copy excludes `piextworkflows.ts` and `pi-ext-workflows/` (lines 224-229), which setup-ai's `pi-workflows` module owns; it verifies `pi-extensible-workflows/roles` and `settings.json` (lines 231-238).
- **Package installs.** The Pi CLI itself comes from npm (`@earendil-works/pi-coding-agent`, lines 365-367), `setup_env.sh` applies `pi/agent/pi-packages.txt` with `pi install` (lines 372-393), and the skill packages come from the guarded `npx skills add` blocks (lines 394-420). `@darkrei08/setup-ai`'s `pi-packages` module also consumes the manifest when orchestrated (see [Pi configuration composition](#pi-configuration-composition)).
- **`pi` commands.** `pi install` applies each manifest entry (lines 388-391), and `pi update --extensions` runs at line 458 when `pi` is on `PATH`.

## Managed configuration

| Repository path | Target | Mechanism |
| --- | --- | --- |
| `pi/agent` | `~/.pi/agent` | Selective `rsync` of the versioned allowlist; a leftover symlink is removed, non-directory targets are backed up, and runtime state is preserved (`sync_pi`, lines 196-238) |
| `nvim/` | `~/.config/nvim/` | `rsync -a --delete --exclude=node_modules/` (line 334) |
| `herdr/config.toml` | `~/.config/herdr/config.toml` | `install -Dm644`, plus a `sed` insert on the `devbox` host (lines 335-338) |
| `herdr/plugins/agent-notify/` | herdr plugin registry (per user, global to all sessions) | `herdr plugin link` when `herdr` is on `PATH`, inside the same `command -v herdr` block as `herdr integration install pi` |
| `.tmux.conf` | `~/.tmux.conf` | `install -Dm644` (line 339) |
| `.local/bin/` | `~/.local/bin/` | `rsync -a`, WSL only (line 343) |
| `.wezterm.lua` | `$USERPROFILE/.wezterm.lua` | `install -Dm644`, WSL only, when `powershell.exe` and `wslpath` exist (lines 344-346) |
| Shell additions (no file) | `~/.bashrc` | `append_once`, exact-match guarded (function at lines 114-118; calls at lines 272-282) |
| `agents/skills/phantom-ui` | every existing agent skills root | `agents/install-agent-extensions.sh` (not run by `setup_env.sh`) |

The allowlisted versioned items under `pi/agent` are copied to `~/.pi/agent/...` on a machine set up this way; runtime state remains in the live directory, and the repository paths remain `pi/agent/...`.

## Pi configuration composition

`setup_env.sh` selectively copies the versioned Pi configuration from `pi/agent` into `~/.pi/agent` while preserving runtime state, so the paths below refer to corresponding repository and live configuration rather than the same files.

### Packages

`pi/agent/pi-packages.txt` is the declarative list, one source per line, with `#` comments and blank lines ignored. It is consumed by `@darkrei08/setup-ai`'s `pi-packages` module, which resolves `~/.pi/agent/pi-packages.txt` (an explicit `PI_PACKAGES_FILE` wins), runs `pi install` once per line and then verifies each source landed in `~/.pi/agent/settings.json`:

```bash
bash setup-ai.sh --only pi-packages   # from the @darkrei08/setup-ai checkout
```

`pi/agent/settings.json` is the effective state the Pi runtime reads, and `sync_pi` restores it on every run, so it is authoritative on a machine set up this way. The two are kept in sync by hand; the differences are deliberate:

| `settings.json` entry | Why it is not a plain `pi-packages.txt` line |
| --- | --- |
| `git:github.com/vekexasia/pi-high-availability` | Plain source; all extensions enabled, including `extensions/index.ts`. Failover config is read from `~/.pi/agent/ha.json` (real file holds credentials and is git-ignored; `ha-failover.example.json` is the tracked, credentials-free template). |
| `npm:gentle-pi` | Object form excluding `extensions/quiet-tools.ts` and `extensions/pi-pretty.ts`, the same two exclusions `setup-ai`'s `handle_quiet_tools_conflict` applies at runtime. `npm:pi-tool-display` registers `read`/`bash`/`find`/`grep`/`ls`, and both of those gentle-pi files register the same built-in tool names, which makes `pi` abort at startup with `Tool "read" conflicts with ...`. The manifest line carries the source only. |
| `packages/pi-omplike-advisor` | The manifest writes the same directory as `~/.pi/agent/packages/pi-omplike-advisor`; both resolve to the corresponding live configuration directory. |
| `packages/pi-codex-context` | The manifest writes the same directory as `~/.pi/agent/packages/pi-codex-context`; it provides session context management and compaction, with known limitations listed in its `TODO.md`. |
| `npm:pi-extensible-workflows`, `npm:gentle-pi` | `setup-ai`'s `pi-workflows` module installs the first (published release or patched local build) and its `gentle-ai` module runs `pi install` for the second and verifies it, so they stay out of the manifest. `settings.json` must still carry them: `sync_pi` rsyncs that file over `~/.pi/agent` on every run, so an entry only a module added is dropped by the next run and the module's own readback verification then fails. |
| `npm:@router-for-me/pi-cliproxyapi-provider` | Object form copied from the Vekexasia upstream: it loads the provider and excludes `extensions/tps.ts`, the package's optional TUI elapsed-time/TPS footer helper, which its README documents as separately disableable. The manifest line carries the source only. |

`pi/agent/npm/package.json` and `package-lock.json` are the tracked manifest and lockfile for the npm-backed entries; `npm/node_modules` is git-ignored and is preserved by `sync_pi`. The two module-owned packages above are deliberately absent from them: the `pi-workflows` and `gentle-ai` modules choose and verify their versions (the workflow module can install a patched local build), so pinning a published version here would duplicate that ownership. `npm:gentle-engram` and `npm:@router-for-me/pi-cliproxyapi-provider` are plain `pi-packages.txt` lines: `pi install` records them in the live `~/.pi/agent/npm/package.json`, and they are not repinned here.

Third-party packages:

| Package | Contributes |
| --- | --- |
| `npm:@router-for-me/pi-cliproxyapi-provider` | Dynamic `cliproxyapi` provider: discovers models from the local CLIProxyAPI service; `extensions/tps.ts` is excluded (see above). |
| `pi/agent/extensions/light-web-search.ts` | Tracked `web_search` replacement for `pi-web-access`; tries CLIProxyAPI first and falls back to openai-codex, avoiding duplicate `web_search` registration. |
| `git:github.com/vekexasia/chrome-cdp-skill@feat/cdp-ws-url` | `pi-chrome-cdp`: drives the user's already-open Chrome session; `bin/cdp` points at its `scripts/cdp.mjs`. |
| `git:github.com/vekexasia/pi-high-availability` | Automatic failover when a quota or capacity is exhausted. Enabled with `extensions/index.ts`; reads `~/.pi/agent/ha.json` (credentials, git-ignored; see `ha-failover.example.json`). |
| `npm:pi-btw` | `/btw` parallel side conversations. |
| `git:github.com/gotgenes/pi-anthropic-auth` | Anthropic authentication extension; it replaces `pi-anthropic-oauth`. |
| `git:github.com/vekexasia/pi-codex-image@fix-codex-image-generation-output` | Codex-style `image_generation` and `view_image` tools with dynamic model routing. |
| `npm:pi-vim` | Vim-style modal editing in the TUI editor. |
| `npm:pi-markdown-preview` | Rendered markdown and LaTeX preview, terminal/browser/PDF. |
| `npm:@narumitw/pi-goal` | Autonomous single-objective `/goal` completion. |
| `git:github.com/DietrichGebert/ponytail` | Lazy-senior-dev ruleset: injects the rules each turn and registers the `/ponytail*` commands. Installed for the other agent CLIs by `agents/install-agent-extensions.sh`. |
| `npm:pi-tool-display` | Compact tool-call rendering, diff visualization, output truncation. |
| `git:github.com/vekexasia/pi-notify@feat/customizable-notifications` | Desktop notifications via OSC 777/99/9 and Windows toast. |
| `npm dependency: @sting8k/pi-vcc` | Loaded for workflow children through the `pi-extensible-workflows` extensions glob; it is not a Pi package because its second `session_before_compact` provider conflicts with `pi-codex-context`, which requires sole compaction ownership. |
| `pi/agent/packages/pi-omplike-advisor` | In-repo advisor extension: a second, read-only model reviews the main agent's transcript and injects advice; driven by `advisor-system.md` and the `advisor` entry in `modes.json`. |
| `pi/agent/packages/pi-codex-context` | In-repo session context-management and compaction provider; its `TODO.md` lists known limitations. |

### In-repo extensions

`pi/agent/package.json` declares the package surface: `pi.extensions` is `extensions`, `pi.skills` is `skills`.

| File | Registers | External binary |
| --- | --- | --- |
| `extensions/answer.ts` | `/answer` command: extract the questions from the last assistant message and answer them interactively; reuses `questionnaire.ts` | none |
| `extensions/compact-tools.ts` | When opted in with `PI_ENABLE_COMPACT_TOOLS=1` (off by default), registers `/compact-tools-status` and patches `ToolExecutionComponent.prototype.updateDisplay` for compact `read`/`edit`/`write`/`bash` rendering | none |
| `extensions/deep-think.ts` | `think` tool; `session_start`, `thinking_level_select` handlers | none |
| `extensions/fork-out.ts` | `/fork-out` command: copy the current root-to-leaf path into a new session file and open it in a herdr split | `herdr` |
| `extensions/herdr-nvim-blocked/index.ts` | `tool_execution_start` / `tool_execution_end` handlers: marks the herdr pane blocked while `bin/open-nvim.sh` runs an operator review | `herdr` |
| `extensions/learning-opportunities-auto.ts` | `session_start`, `tool_result`, `before_agent_start` handlers: after a `bash` command matching `git commit`, asks the agent to consider offering the `learning-opportunities` skill, at most twice per session | none |
| `extensions/live-dashboard.ts` | `/live-dashboard` command; `session_start`, `session_shutdown`, `agent_start`, `agent_end`, `model_select`, `turn_end`, `message_end`, `tool_execution_start`, `tool_execution_end` handlers; reports session state to a local dashboard server | none |
| `extensions/pi-ext-workflows/*.ts` | Workflow functions registered through `pi-extensible-workflows`: `fetchIssueDetails` (`fetch-issue-details.ts`), `developUntilApproved` (`review-loop.ts`), `devIssuesInBatches` (`seq-issues.ts`), `tddDev` (`tdd.ts`); re-exported by `extensions/piextworkflows.ts` | `gh` / `glab` for issue lookup; the `pi-extensible-workflows` package must be installed |
| `extensions/questionnaire.ts` | The `questionnaire` tool, the unified single/multi-question prompt | none |
| `extensions/show-system-prompt.ts` | `/system-prompt` command: writes the current system prompt to `/tmp/system-prompt.md` | none |
| `extensions/tmux-progress.ts` | `agent_start` / `agent_end` handlers that set the tmux per-window option `@pi_status` | `tmux`, and the format lines documented in the file (not managed by this repository) |
| `extensions/rotator-autostart/index.ts` | Opt-in `session_start` gateway probe/start when `TUXEVIL_ROTATOR_AUTOSTART=1` | `tuxevil-rotator` |
| `extensions/vim-editor.ts` | `alt+m` shortcut: open the current editor buffer in Neovim | `nvim` |

`extensions/herdr-nvim-blocked/index.ts` describes the blocked state as coming from a `herdr:blocked` event in `extensions/herdr-agent-state.ts`, which is not tracked; see [Known gaps](#known-gaps).

### Skills

| Root | Contents | Ownership |
| --- | --- | --- |
| `pi/agent/skills/` (`~/.pi/agent/skills/`) | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Repository-owned, tracked, Pi-only. Pi also reads the canonical root, so only skills that must not be shared live here. |
| `~/.agents/skills/` | shared skills, one physical copy each | Machine-installed (see below) or linked |
| `agents/skills/phantom-ui/` | `SKILL.md` written here, the MIT standalone build plus its `.d.ts`, upstream `LICENSE`, `VENDORED.md` | Repository-owned, copied into harness roots |

The machine-installed skills are placed by `setup_env.sh` lines 401-420 (`herdr`, `triage`, `grill-me`, `grilling`, `wayfinder`, `domain-modeling`, `prototype`, `research`, `typescript-advanced`, `show-me`, `engineering-excellence`, `project-memory`) and by `agents/install-agent-extensions.sh` (`design-taste`, `impeccable`, `ponytail`, `phantom-ui`). They are read from the harness root that installed them, or from `~/.agents/skills` when that is the canonical root; see the next section.

### Other Pi files

| Path | Role |
| --- | --- |
| `pi/agent/settings.json` | Effective Pi settings: `defaultProvider`/`defaultModel`/`defaultThinkingLevel`, `modelThinkingLevels`, `compaction`, `theme`, the `packages` list, `hideThinkingBlock`, `showCacheMissNotices`, `tuiMode`. |
| `pi/agent/models.json` | Provider catalog and overrides; see [Providers and credentials](#providers-and-credentials). |
| `pi/agent/modes.json` | `advisor`: provider `openai-codex`, modelId `gpt-6-luna`, `thinkingLevel: high`, `autostart: false`; `opencode-max`: provider `opencode-go`, modelId `deepseek-v4.1-flash`, `thinkingLevel: max`, `autostart: false`. |
| `pi/agent/advisor-system.md` | System prompt for `pi-omplike-advisor`, loaded as plain Markdown text by `packages/pi-omplike-advisor/extensions/lib/controller.ts`. |
| `pi/agent/pi-extensible-workflows/settings.json` | `modelAliases`, the workflow `skills` allowlist, the workflow `extensions` allowlist, and `extensionSettings` for `herdr` and `trajectory`. |
| `pi/agent/pi-extensible-workflows/roles/*.md` | `developer`, `oracle`, `researcher`, `reviewer`, `scout`, `summarizer`, `tests-expert`, `architect`, `security`, `qa`, `release`, `sre`. |
| `pi/agent/prompts/` | Prompt templates: `fixissues.md` (drives the `devIssuesInBatches` workflow from `ready-for-agent` issues) and `spawn-pi-pane.md` (spawns a sibling Pi in a herdr pane). |
| `pi/agent/themes/omarchy-system.json` | A shipped theme. `settings.json` selects `dark`, so this theme is available but not active. |
| `pi/agent/AGENTS.md` | Project instructions Pi loads for this repository. |
| `pi/agent/keybindings.json` | Editor keybinding overrides (`ctrl+w`, `alt+d`, ...). |
| `pi/agent/pi-vcc-config.json` | `pi-vcc` settings retained for workflow children: `overrideDefaultCompaction`, `smartKeepTail`, `continueAfterThresholdCompact`. |
| `pi/agent/bin/` | `open-nvim.sh` (herdr-gated operator review helper, requires `HERDR_ENV=1` and `HERDR_PANE_ID`), `session-stats.mjs` (session metrics), `cdp` (pointer to the chrome-cdp script). |
| `pi/agent/npm/` | npm manifest and lockfile for the npm-backed packages. |
| `pi/agent/.pii-allowlist` | Regex allowlist for git-shield false positives in this repository. |
| `pi/agent/.gitignore` | Whitelist: `/*`, then explicit `!` entries. A new file must be added there or it is untracked. |

## Skills and packages layout: one physical copy

There is exactly one physical copy of each shared skill. `~/.agents/skills` is the canonical root; every other harness root holds a directory junction (Windows) or symlink (POSIX) per skill:

| Root | Mechanism |
| --- | --- |
| `~/.agents/skills` | Canonical root, real files |
| `~/.claude/skills` | Junction / symlink |
| `~/.codex/skills` | Junction / symlink |
| `~/.config/opencode/skills` | Junction / symlink |
| `~/.gemini/skills` | Junction / symlink |
| `~/.gemini/antigravity-cli/skills` | Junction / symlink |
| `~/.pi/agent/skills` | Exception: holds only Pi-specific skills, because Pi reads the canonical root as well. A shared skill here would be listed twice. |

`agents/link-skills.mjs` reconciles the tree, driven by `agents/skills.manifest.json`, which declares the canonical root, the harness roots and each skill's policy:

| Policy | Meaning |
| --- | --- |
| `{ "default": true }` | Link the skill into every harness root. |
| `{ "default": true, "except": ["codex"] }` | Skip the named harnesses. |
| `{ "default": false }` | Link nowhere; canonical only. |
| `{ "managed": false, "reason": "..." }` | Leave the skill alone entirely (`impeccable`). |
| `"readsCanonical": true` | The harness never gets links, and a shared skill in its root is dropped. Only `pi` sets this. |

Commands, with the exact flags the script accepts:

```bash
node agents/link-skills.mjs              # dry run: report what --apply would do
node agents/link-skills.mjs --apply      # reconcile the tree
node agents/link-skills.mjs --verify     # check the layout, change nothing
node agents/link-skills.mjs --only pi    # restrict to one harness
node agents/link-skills.mjs --root <dir> # canonical root override
node agents/link-skills.mjs --backup-dir <dir>
```

Dry-run is the default; only `--apply` mutates. Exit status is `0` when there is nothing to do or everything is in place, `1` when at least one conflict was reported, and `2` for a bad invocation. Backups default to `~/.pi/backups/link-skills-<timestamp>/<harness>/<skill>`, a new directory per run. The linker never deletes anything.

The rule for agents working in this repository:

1. Install a skill **once**, from its upstream installer or by hand, into `~/.agents/skills/<name>/` with a `SKILL.md`.
2. Add it to `agents/skills.manifest.json`, listing under `except` the harnesses that must not receive it.
3. Run `node agents/link-skills.mjs` to review, then `--apply`.
4. Confirm with `node agents/link-skills.mjs --verify`.

Never copy the same skill into two roots, and never edit a linked skill in place: the link points at the canonical copy, so the edit is the canonical edit, but the duplicate you also copied elsewhere will drift. `agents/install-agent-extensions.sh` copies the skills this repository ships (`phantom-ui`) into every harness root; that is compatible, and the next `--apply` sees an identical copy and folds it back into a link.

`agents/LINKING.md` documents the actions (`link`, `already-linked`, `replace-copy-with-link`, `drop-copy`, `drop-link`, `fold-in`, `conflict`, `skip`), the conflict procedure, and the two unmanaged cases: `_shared/` is a support directory with no `SKILL.md` and a per-runtime copy per harness, and `impeccable` is installed per provider by its own installer, so each harness copy legitimately differs.

## Models, aliases and effort

Which layer resolves model routing, the precedence rule between them, and how to pick a model and a thinking level from measured cost, speed and quality: `pi/agent/MODELS.md` (791 lines, allowlisted by `!/MODELS.md` in `pi/agent/.gitignore`). The short version is that Pi settings, the provider catalog, workflow aliases, subagent routing, agent frontmatter and modes all stack in a fixed order, and that the most specific layer wins. Read that file before changing routing; do not duplicate its content here.

## Providers and credentials

`pi/agent/settings.json` sets `defaultProvider: anthropic`, `defaultModel: claude-sonnet-5-5`, and `defaultThinkingLevel: medium`. `modelThinkingLevels` sets Sonnet 5.5 and GPT-6.1 Sol to `medium` and Opus 5.5 and GPT-6 Luna to `high`; `enabledModels` lists only Claude Pro and ChatGPT Plus models and their CLIProxyAPI mirrors. Compaction is enabled with `compaction.enabled: true`. `pi/agent/subagents.json` and the GGA pre-commit reviewer use the same Sonnet 5.5 default: GGA reviews through Pi (`.gga`, `agents/gga-pi/`), so it needs no separate Claude or Codex login. See [docs/gentle-ai-gga.md](docs/gentle-ai-gga.md).

`pi/agent/models.json` declares the static `openrouter`, `openai-codex`, and opt-in `tuxevil-rotator` providers; `npm:@router-for-me/pi-cliproxyapi-provider` adds the dynamic `cliproxyapi` catalog from the local CPA service:

| Provider | What the file adds |
| --- | --- |
| `openrouter` | A `modelOverrides` entry for `deepseek/deepseek-v4.1-flash` with OpenRouter routing restricted to `only: ["deepseek"]` and `allow_fallbacks: false`. |
| `openai-codex` | Five text+image models: `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-6-luna`, `gpt-6-sol`, and `gpt-5.6-terra`, with a 250k context and 128k maximum output. |
| `cliproxyapi` | Dynamic OpenAI-compatible models from CLIProxyAPI. CPA Usage Keeper provides the local usage, cost and quota dashboard. |
| `tuxevil-rotator` | Opt-in local OpenAI-compatible Gemini gateway at `localhost:51200`; autostart requires `TUXEVIL_ROTATOR_AUTOSTART=1`. |

Use the CLIProxyAPI stack documented in [`cliproxyapi/README.md`](cliproxyapi/README.md):

```bash
cd cliproxyapi
docker compose up -d
# CPA management: http://127.0.0.1:8317/management.html
# Keeper dashboard: http://127.0.0.1:8080
```

Credentials live in `~/.pi/agent/auth.json` and `~/.pi/agent/cliproxyapi.json`, which are git-ignored and preserved by `sync_pi`. Pi selects live CLIProxyAPI targets from its provider catalog. The tracked files do not verify runtime credential contents or how each credential is acquired; this repository does not store or modify them.

Standard workflow aliases use native providers by default and follow the `vekexasia/dotenv` role mapping on Claude Pro and ChatGPT Plus models: `cheap-model`, scout and developer use `anthropic/claude-sonnet-5-5:medium`; tests and research use `openai-codex/gpt-6-luna`; reviewer and Oracle use `anthropic/claude-opus-5-5:high`. Each native alias has a `cliproxy-*` mirror that targets the same model through CLIProxyAPI and can be supplied as a per-agent `model` override after the dynamic catalog is authenticated. See `pi/agent/MODELS.md` for plan limits, effort levels and the GGA reviewer choice.

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
| `gentle-ai`, `gga`, `agy`, `codex`, `claude`, `gemini`, `copilot`, `opencode`, `cursor-agent` | Required coding-agent CLIs installed by `setup_env.sh` | Setup fails its final required-command verification if any is unavailable. |
| `nvim` (>= 0.12.0) | `extensions/vim-editor.ts` (`alt+m`) | The shortcut fails to spawn the editor. |
| `herdr` | `extensions/fork-out.ts`, `extensions/herdr-nvim-blocked/index.ts`, `bin/open-nvim.sh`, the `herdr-devbox` alias | `/fork-out` and the blocked-pane marker cannot report; `open-nvim.sh` exits 1 outside herdr. |
| `tmux` | `extensions/tmux-progress.ts` | No tab progress; the extension is otherwise inert. |
| `gh`, `glab` | `pi/agent/extensions/pi-ext-workflows/*`, `prompts/fixissues.md` | Issue workflows cannot list or close issues. Both need `auth login`. |
| `fzf`, `bat`, `tree`, `rg`, `fd` | Shell additions, fzf previews, general tooling | Previews and aliases degrade; `bat` is symlinked from `batcat` on Debian. |
| `python3` | The `gigatoken` virtualenv | The venv is not created. |
| `go` | Go development | Installed by the script when missing (1.24.4). |
| `aimem` | The ai-memory-kit CLI | Installed by the script when missing; the `project-memory` skill still installs. |
| `curl`/`wget` + a shell | `install-agent-extensions.sh` `npx` steps | `design-taste` and `impeccable` are skipped with a `SKIP` line. |

## Skill provenance

| Upstream | Skills | Installer |
| --- | --- | --- |
| `herdrdev/herdr` | `herdr` | `npx skills add ... --global --agent pi --copy --yes` (`setup_env.sh` line 402) |
| `mattpocock/skills` | `triage`, `grill-me`, `grilling`, `wayfinder`, `domain-modeling`, `prototype`, `research` | `npx skills@latest add` (line 403) |
| `pedronauck/skills` | `typescript-advanced` | `npx skills add` (line 404) |
| `humanlayer/skills` | `show-me` | `npx skills add` (line 405) |
| `micio86dev/Engineering-Excellence` | `engineering-excellence` | `npx skills@latest add` (line 406) |
| `darkrei08/ai-memory-kit` (tag `v0.1.0`) | `project-memory` | `npx skills add "...#v0.1.0"` with an unpinned fallback (lines 414-415); the `aimem` CLI installer runs with `--no-skill` (lines 418-420) |
| `h3nryprod01/design-taste` | `design-taste` | `npx skills@latest add ... --global --agent <agent> --copy --yes`, per detected CLI, in `install-agent-extensions.sh` |
| `pbakaus/impeccable` | `impeccable` | `npx impeccable install --providers=... --scope=global`, run in a scratch directory; engine binary lands in `~/.impeccable/bin` |
| `DietrichGebert/ponytail` | `ponytail` (plus its commands) | Per-host plugin installers in `install-agent-extensions.sh`; for Pi, `git:github.com/DietrichGebert/ponytail` in `pi-packages.txt` |
| this repository | `phantom-ui` (`agents/skills/phantom-ui`, MIT build, provenance in `VENDORED.md`) | `agents/install-agent-extensions.sh` copies it into every existing harness root |
| this repository | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Tracked directly under `pi/agent/skills/`, Pi-only |
| `pi` examples | `questionnaire` tool | Copied into `pi/agent/extensions/questionnaire.ts` |

## Herdr agent notifications

`herdr/plugins/agent-notify/` is a herdr plugin registered with `herdr plugin link`. There is no build step; runtime needs `node` on `PATH` plus a notification backend: `notify-send` from `libnotify` on Linux (installed by `setup_env.sh`), `osascript` on macOS, and nothing extra for the Windows toast.

- **Why it exists.** herdr's own popups (`[ui.toast]`) are skipped for panes in the active tab of the focused workspace, and a sound is not visible evidence, so an agent asking for input in a pane you are not looking at stays silent once sound is muted.
- **What it does.** The `pane.agent_status_changed` hook notifies on `blocked` (critical urgency through the native Linux `notify-send` backend only) and on `done`, for every tab, without suppression. The notification title is `<emoji> <agent> <reason> · <workspace> / <tab>` when labels are available. Notifications are plain text because the desktop daemon renders the freedesktop markup subset literally; the emoji carries the category. Repeats of the same pane and status are dropped through a small file under `HERDR_PLUGIN_STATE_DIR`. A notification that fails to reach the desktop is reported as a hook failure and does not suppress a later retry for the same status. herdr keeps its own sound and in-app toast; the plugin only adds the OS notification.
- **Pending question.** For a blocked pi pane the hook reads `herdr agent get <pane_id>` to locate the pi session JSONL and extracts the last pending `questionnaire` / `ask_user_choice` call, so the body carries the real question, up to four options with their descriptions, the recommendation, and the pane id. A multi-question request shows the first question plus a marker naming how many more questions there are. A question already answered in the session is not replayed. It degrades to the plain agent/reason line whenever that lookup fails or the pane is not a pi session.
- **Backends.** `notify-send` on Linux, `osascript`'s `display notification` on macOS, and a WinRT toast through Windows PowerShell on Windows (silent, because herdr plays its own sound). On WSL, the Windows toast is used through `powershell.exe` because `notify-send` inside WSL usually has no notification daemon.
- **Pi panes.** A pi pane only reports `blocked` to herdr through herdr's own Pi integration, which `setup_env.sh` installs with `herdr integration install pi`; without it a pi pane reports only `working`/`idle` from herdr's screen rules, so no request notification can fire. The integration loads at pi startup, so running pi sessions need a restart after it is installed.
- **Checks.** `node herdr/plugins/agent-notify/notify.mjs --self-test` covers the pure logic, and `herdr plugin action invoke agent-notify.test` sends one real notification through the OS backend.

## Non-Pi agents

`agents/install-agent-extensions.sh` targets every agent CLI it finds on `PATH` and logs a skip for the ones that are absent:

| Agent | How it is configured |
| --- | --- |
| Codex CLI | `codex plugin marketplace add DietrichGebert/ponytail`, then `codex plugin add ponytail@ponytail` |
| Antigravity CLI (`agy`) or Gemini CLI | `agy plugin install <ponytail URL>`, falling back to `gemini extensions install <ponytail URL>` |
| Copilot CLI | `copilot plugin marketplace add ...` then `copilot plugin install ponytail@ponytail` |
| OpenCode | adds `@dietrichgebert/ponytail` to the `plugin` array of `~/.config/opencode/opencode.json` through a small Node edit that refuses to rewrite a config that is not plain JSON |
| Claude Code | Not scriptable: the script prints the two interactive `/plugin` commands as a manual step |
| pi | Not handled here; Pi installs ponytail from `pi/agent/pi-packages.txt` |

The same script installs `design-taste` and `impeccable` through their upstream installers, and copies `phantom-ui` into each existing harness skills root (`claude-code`, `codex`, `gemini-cli`, `cursor`, `antigravity`, `opencode`, `pi`, plus `~/.agents/skills`). One failing host is logged and does not stop the run; the exit status is 1 when an attempted step failed. Skills themselves are single-sourced and junctioned as described above.

Other harnesses this repository configures indirectly: `~/.codex`, `~/.claude`, `~/.gemini`, `~/.config/opencode` are only written by the skills installer and the linker; the one exception is that `setup_env.sh`, when run as root, sets `permissions.defaultMode` to `default` in `~/.claude/settings.json` and preserves every other setting.

## Verification

Run these on the machine, after `setup_env.sh`:

```bash
# This checkout's own config invariants: settings.json parses, carries the
# module-owned packages and gentle-pi exclusions, enforces native/default and
# explicit CLIProxyAPI aliases plus enabledModels, has no ../../ path, and
# setup_env.sh never writes GENTLE_PI_QUIET_TOOLS=0
bash check-config.sh

# The versioned Pi configuration was copied into the live config
test -f ~/.pi/agent/pi-extensible-workflows/settings.json
test -d ~/.pi/agent/pi-extensible-workflows/roles

# Pi's effective settings and packages
node -e "const s=require(process.env.HOME+'/.pi/agent/settings.json');console.log(s.defaultProvider, s.defaultModel, s.packages.length)"
cat ~/.pi/agent/pi-packages.txt

# The declared packages are the installed ones
pi --version
# For each source in pi-packages.txt, check it appears in ~/.pi/agent/settings.json

# The managed non-Pi configuration
grep -c 'export BAT_THEME' ~/.bashrc
cmp ~/.tmux.conf <repo>/.tmux.conf && echo tmux ok
nvim --version | head -1                      # >= NVIM v0.12.0

# The single-copy skills layout
node agents/link-skills.mjs --verify          # expect: verify: OK
ls -l ~/.claude/skills ~/.codex/skills        # entries are junctions/symlinks

# The local CPA + Keeper stack
CPA_KEY='paste-the-local-api-key-here'
curl -fsS -H "Authorization: Bearer ${CPA_KEY}" \
  'http://127.0.0.1:8317/v1/models?client_version=pi'
unset CPA_KEY
# Open http://127.0.0.1:8080 for CPA Usage Keeper
```

`setup_env.sh` has no `--dry-run`; `agents/link-skills.mjs` is dry-run by default.

## Known gaps

- `pi/agent/extensions/herdr-agent-state.ts` is produced by `herdr integration install pi` (already run by `setup_env.sh`), is machine-local, and is ignored by `pi/agent/.gitignore`. It is present on this machine. A pi session started before the integration was installed does not load it and must be restarted.
- `pi/agent/package.json` declares `"pi-extensible-workflows": "file:../../../pi-workflows/packages/core"`. From `pi/agent` that resolves to `<repo>/../pi-workflows/packages/core`, which does not exist in this layout. Not verified: whether anything ever installs it.
- `setup_env.sh` installs the Pi CLI with npm when it is missing on every supported distro; only the mise Pi shim cleanup is Arch/Omarchy-specific. The package application and later `pi update --extensions` remain guarded by `command -v pi`.
- `pi/agent/settings.json` ships theme `dark`; `themes/omarchy-system.json` is not selected by any setting here. Unverified: whether it is meant to be activated on Omarchy.
- `pi/agent/npm/node_modules` is git-ignored, preserved by `sync_pi`, and not populated by a direct `npm install` in `setup_env.sh`. Unverified: which step is expected to populate it.
- `agents/link-skills.mjs` junction discovery is verified for Pi only. For the other harnesses the manifest records the expected root; a harness that ignores junctions in its own directory is not detected. Run `--verify` and start each harness once after `--apply`.
- `sync_pi` copies the versioned allowlist with `rsync -a` and never prunes, so a file deleted from the repository (for example the removed `extensions/hashline-tool-display-bridge.ts` and `extensions/pi-tool-display/config.json`) keeps loading from `~/.pi/agent/` on a machine already on the real-directory model until it is removed by hand. The symlink -> real-directory migration itself produces a clean copy; only later deletions are affected.
