# dotenv

Personal Linux/WSL dotfiles plus the Pi coding-agent configuration that ships with them. This checkout is the source of truth: `./setup_env.sh` installs the required tools and overwrites managed configuration from here.

Remotes: `origin` is `darkrei08/dotenv` (the fork this machine works in), `upstream` is `vekexasia/dotenv`.

## Requirements

| Requirement | Detail |
| --- | --- |
| OS | Linux or WSL2. `setup_env.sh` reads `/etc/os-release` and exits 1 on anything outside the Arch (`omarchy`, `arch`) and Debian (`debian`, `ubuntu`) families (lines 13-24). |
| WSL | Detected from `/proc/version` (line 6). WSL adds `wl-clipboard`, `imagemagick`, the clipboard helpers in `.local/bin` and the Windows `.wezterm.lua` copy. |
| Privileges | `sudo` for `apt-get`, `pacman`, installing `go` under `/usr/local`, and the Neovim tarball. `omarchy pkg add` is used instead of `pacman` when `omarchy` is on `PATH` (lines 29-36). |
| Runtime | A POSIX shell plus `bash`. Neovim 0.12.0 or newer is required (line 142); the script installs it when missing or older. |
| Node.js / npm | `npx` for the skills installers and `npm` for the globally installed Pi CLI and Neovim tooling. Both must already be present; the script does not install Node. |
| Python | `python3` and `python3-venv` (Debian installs `python3-venv` explicitly) for the `gigatoken` virtualenv. |
| Network | Distribution mirrors, `https://go.dev/dl/`, `api.github.com` and GitHub release assets (lazygit, zellij, Neovim), the npm registry, `npx skills`, and each AI CLI's own `curl ... | bash` installer. |
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
| `~/.pi/agent` | If it is not already the symlink to `pi/agent`, an existing file, directory or link is moved to `~/.pi/agent.backup.<epoch>` and the symlink is created (lines 63-78). |
| `~/.config/nvim` | `rsync -a --delete` from `nvim/`, excluding `node_modules/` (line 157). Anything else in the target that is not in the repository is deleted. |
| `~/.config/herdr/config.toml`, `~/.tmux.conf` | Overwritten with `install -Dm644` (lines 158, 162). |
| `~/.local/bin` | Overwritten with `rsync -a` on WSL only (line 165). |
| `$USERPROFILE/.wezterm.lua` | Overwritten on WSL when `powershell.exe` and `wslpath` are available (lines 167-170). |
| `~/.bashrc` | Appended only, one line at a time, and only when the exact line is absent (`append_once`, lines 57-61). Nothing is rewritten. |

Nothing is committed or pushed by the script. `gh` and `glab` stay unauthenticated.

## What `setup_env.sh` does

| Lines | Section |
| --- | --- |
| 4-11 | Resolve `REPO_DIR` from `BASH_SOURCE`, detect WSL, source `/etc/os-release`. |
| 13-24 | Gate on the distribution family, or exit 1. |
| 26-41 | `install_package`: skip when the command already exists, otherwise `omarchy pkg add`, `pacman -S --needed --noconfirm`, or `apt-get install -y`. |
| 43-55 | `install_release`: download the newest GitHub release asset matching a jq regex, extract, and install the binary to `~/.bin`. |
| 57-61 | `append_once`: append a line to `~/.bashrc` only when absent. |
| 63-78 | `sync_pi`, the Pi link: see below. |
| 80-93 | Package list per family (`make`, `gcc`, `g++`, `ripgrep`, `git`, `curl`, `xclip`, `jq`, `tree`, `htop`, `fd`/`fd-find`, `rsync`, `fzf`, `bat`/`batcat`, `gh`, `glab`, `python3`, `python3-venv`). |
| 95-97 | Install every package with `install_package`. |
| 99-102 | WSL: `wl-clipboard` and `imagemagick`. |
| 104-113 | Create `~/.bin` and `~/.local/bin`, extend `PATH`, symlink `batcat` to `~/.bin/bat` when `bat` is missing, install `lazygit` and `zellij` (package on Arch, GitHub release otherwise). |
| 114-125 | Append the shell additions to `~/.bashrc`: `PATH` entries, `fzf --bash`, `BAT_THEME`, `PI_ANTHROPIC_OAUTH_REWRITE_MODE=technical-safe`, `SUDO_EDITOR=nvim`, `ll`, `herdr-devbox`, and the fzf preview options. |
| 127-138 | Install Go: the distribution package on Arch, otherwise `go1.24.4.linux-amd64` into `/usr/local`. |
| 140-154 | Require Neovim >= 0.12.0, installing the distribution package (Arch) or the `nvim-linux-x86_64` release tarball into `/opt`. |
| 156-162 | Sync `nvim/` into `~/.config/nvim`, install `herdr/config.toml` and `.tmux.conf`. On the host named `devbox`, insert `copy_on_select = false` under `[ui]` in the herdr config. |
| 164-171 | WSL: sync `.local/bin/`, and copy `.wezterm.lua` to the Windows profile directory. |
| 173-177 | Create `~/.local/share/nvim/gigatoken-venv` and `pip install gigatoken` when the venv is absent. |
| 179-188 | **Pi, Arch only:** delete a mise-managed `~/.local/bin/pi` shim that leaks mise output into Pi's stdout, `mise unuse -g pi` / `mise uninstall --all pi`, then `npm install -g --ignore-scripts --prefix "$HOME/.local" @earendil-works/pi-coding-agent`. On Debian/Ubuntu this block is skipped, so `pi` must already be installed. |
| 190 | `sync_pi`. |
| 191-204 | **Pi skills:** `npx skills add ... --global --agent pi --copy --yes` for `herdrdev/herdr`, `mattpocock/skills` (`triage grill-me grilling wayfinder domain-modeling prototype research`), `pedronauck/skills` (`typescript-advanced`), `humanlayer/skills` (`show-me`), `micio86dev/Engineering-Excellence` (`engineering-excellence`), and `darkrei08/ai-memory-kit#v0.1.0` (`project-memory`, with a fallback to the unpinned branch). Then the ai-memory-kit CLI installer runs with `--no-skill`, so the skill is not installed twice. |
| 206-214 | AI CLIs, each installed only when missing, through its own installer: `gentle-ai`, `agy` (Antigravity), `codex`. When `herdr` is on `PATH`: install `bun` into `/usr/local` if absent, `herdr plugin install plannotator/herdr-annotate/lite`, `herdr integration install pi`. |
| 215 | `pi update --extensions` when `pi` is on `PATH`. |
| 216-233 | `npm ci` in `~/.config/nvim`, `@typescript/native-preview`, `tree-sitter-cli` with install scripts forced on, then headless Neovim: `Lazy! restore`, `MasonInstall markdownlint`, and the tree-sitter parser install. |

The Pi block in full:

- **The `~/.pi/agent` link.** `sync_pi` (lines 63-78) returns immediately when the target is already a symlink resolving to `$REPO_DIR/pi/agent`. Otherwise an existing target is moved to `~/.pi/agent.backup.$(date +%s)` and `ln -s "$REPO_DIR/pi/agent" "$HOME/.pi/agent"` runs. This is the only mechanism that puts the repository's Pi configuration in place, and it is a symlink, not a copy.
- **Package installs.** The Pi CLI itself comes from npm (`@earendil-works/pi-coding-agent`, line 187), and the skill packages come from `npx skills add` (lines 191-204). The repository does **not** run `pi install`; that is `@darkrei08/setup-ai`'s `pi-packages` module, driven by `pi/agent/pi-packages.txt` (see [Pi configuration composition](#pi-configuration-composition)).
- **`pi` commands.** Exactly one: `pi update --extensions` (line 215), guarded by `command -v pi`.

## Managed configuration

| Repository path | Target | Mechanism |
| --- | --- | --- |
| `pi/agent` | `~/.pi/agent` | Symlink; existing target backed up first (`sync_pi`, lines 63-78) |
| `nvim/` | `~/.config/nvim/` | `rsync -a --delete --exclude=node_modules/` (line 157) |
| `herdr/config.toml` | `~/.config/herdr/config.toml` | `install -Dm644`, plus a `sed` insert on the `devbox` host (lines 158-161) |
| `.tmux.conf` | `~/.tmux.conf` | `install -Dm644` (line 162) |
| `.local/bin/` | `~/.local/bin/` | `rsync -a`, WSL only (line 165) |
| `.wezterm.lua` | `$USERPROFILE/.wezterm.lua` | `install -Dm644`, WSL only, when `powershell.exe` and `wslpath` exist (lines 167-170) |
| Shell additions (no file) | `~/.bashrc` | `append_once`, exact-match guarded (lines 114-125) |
| `agents/skills/phantom-ui` | every existing agent skills root | `agents/install-agent-extensions.sh` (not run by `setup_env.sh`) |

Everything under `pi/agent` is therefore at `~/.pi/agent/...` on a machine set up this way, and at `pi/agent/...` in the repository.

## Pi configuration composition

`~/.pi/agent` is a symlink to `pi/agent` in this checkout, so all paths below are the same files.

### Packages

`pi/agent/pi-packages.txt` is the declarative list, one source per line, with `#` comments and blank lines ignored. It is consumed by `@darkrei08/setup-ai`'s `pi-packages` module, which resolves `~/.pi/agent/pi-packages.txt` (an explicit `PI_PACKAGES_FILE` wins), runs `pi install` once per line and then verifies each source landed in `~/.pi/agent/settings.json`:

```bash
bash setup-ai.sh --only pi-packages   # from the @darkrei08/setup-ai checkout
```

`pi/agent/settings.json` is the effective state the Pi runtime reads. The two are kept in sync by hand; the differences are deliberate:

| `settings.json` entry | Why it is not a plain `pi-packages.txt` line |
| --- | --- |
| `git:github.com/vekexasia/pi-high-availability` | Object form with `"extensions": ["-extensions/index.ts"]` to exclude that file. The manifest line carries the source only. |
| `packages/pi-omplike-advisor` | The manifest writes the same directory as `~/.pi/agent/packages/pi-omplike-advisor`; both resolve under the link. |
| `../../git/personale/pi-workflows` and `.../packages/extensions/herdr` | Absolute-ish local paths outside this checkout. `setup-ai`'s `pi-workflows` module owns that package; see [Known gaps](#known-gaps). |
| `github:darkrei08/pi-cockpit-tools-sync` | Pi parses a bare `github:` source as a local path, so a manifest line cannot recreate it. |

`pi/agent/npm/package.json` and `package-lock.json` are the tracked manifest and lockfile for the npm-backed entries; `npm/node_modules` is git-ignored and is not created by `setup_env.sh`.

Third-party packages:

| Package | Contributes |
| --- | --- |
| `npm:pi-web-access` | Web search, URL fetching, GitHub cloning, PDF/YouTube/local video analysis; multiple search backends. |
| `git:github.com/vekexasia/chrome-cdp-skill@feat/cdp-ws-url` | `pi-chrome-cdp`: drives the user's already-open Chrome session; `bin/cdp` points at its `scripts/cdp.mjs`. |
| `npm:visual-explainer` | Skill that generates HTML pages for diagrams, diff reviews, plan reviews and data tables. |
| `git:github.com/vekexasia/pi-high-availability` | Automatic failover when a quota or capacity is exhausted. `extensions/index.ts` is excluded by `settings.json`. |
| `npm:pi-btw` | `/btw` parallel side conversations. |
| `npm:pi-anthropic-oauth` | Claude Pro/Max OAuth login; `PI_ANTHROPIC_OAUTH_REWRITE_MODE` is set in `~/.bashrc`. |
| `git:github.com/vekexasia/pi-codex-image@fix-codex-image-generation-output` | Codex-style `image_generation` and `view_image` tools with dynamic model routing. |
| `npm:pi-vim` | Vim-style modal editing in the TUI editor. |
| `npm:pi-markdown-preview` | Rendered markdown and LaTeX preview, terminal/browser/PDF. |
| `npm:@narumitw/pi-goal` | Autonomous single-objective `/goal` completion. |
| `git:github.com/DietrichGebert/ponytail` | Lazy-senior-dev ruleset: injects the rules each turn and registers the `/ponytail*` commands. Installed for the other agent CLIs by `agents/install-agent-extensions.sh`. |
| `npm:pi-tool-display` | Compact tool-call rendering, diff visualization, output truncation. |
| `git:github.com/YuGiMob/pi-hashline-edit-pro` | Hash-anchored `read`/`replace`/`insert`/`grep` tools; stale anchors are rejected. |
| `git:github.com/vekexasia/pi-notify@feat/customizable-notifications` | Desktop notifications via OSC 777/99/9 and Windows toast. |
| `npm:@sting8k/pi-vcc` | Conversation compactor with structured summaries and no LLM calls; configured by `pi-vcc-config.json`. |
| `npm:pi-orcarouter` | Package registered in `settings.json`; no description in its `package.json`. |
| `npm:@plannotator/pi-extension` | Interactive plan review with annotations, message annotation, code/PR review. |
| `npm:@benvargas/pi-openai-fast` | OpenAI fast-mode toggle (priority service tier); settings in `extensions/pi-openai-fast.json`. |
| `pi/agent/packages/pi-omplike-advisor` | In-repo advisor extension: a second, read-only model reviews the main agent's transcript and injects advice; driven by `advisor-system.md` and the `advisor` entry in `modes.json`. |
| `github:darkrei08/pi-cockpit-tools-sync` | Cockpit account sync: `/cockpit-sync`, `/cockpit-provision`, `/cockpit-proxy`. Reads local cockpit-tools markers; stores no tokens here. |

### In-repo extensions

`pi/agent/package.json` declares the package surface: `pi.extensions` is `extensions`, `pi.skills` is `skills`.

| File | Registers | External binary |
| --- | --- | --- |
| `extensions/answer.ts` | `/answer` command: extract the questions from the last assistant message and answer them interactively; reuses `questionnaire.ts` | none |
| `extensions/compact-tools.ts` | `/compact-tools-status` command; `session_start` handler; patches `ToolExecutionComponent.prototype.updateDisplay` for compact `read`/`edit` rendering | none |
| `extensions/deep-think.ts` | `think` tool; `session_start`, `thinking_level_select` handlers | none |
| `extensions/gentle-bar.ts` | Owns the footer: renders the gentle-pi shell bar (cwd/branch/±dirty, model · effort, ctx gauge, cost, OpenCode Go plan windows) with coloured tool and capability flags; `session_start`, `session_switch`, `session_branch`, `model_select`, `agent_start`, `agent_end`, `tool_execution_end`, `resources_discover`, `input` handlers | `git` |
| `extensions/fork-out.ts` | `/fork-out` command: copy the current root-to-leaf path into a new session file and open it in a herdr split | `herdr` |
| `extensions/hashline-tool-display-bridge.ts` | Wraps `pi.registerTool` so every later tool definition is decorated in place with `pi-tool-display`'s `decorateTool` API; registers no tool, command or event of its own | none |
| `extensions/herdr-nvim-blocked/index.ts` | `tool_execution_start` / `tool_execution_end` handlers: marks the herdr pane blocked while `bin/open-nvim.sh` runs an operator review | `herdr` |
| `extensions/learning-opportunities-auto.ts` | `session_start`, `tool_result`, `before_agent_start` handlers: after a `bash` command matching `git commit`, asks the agent to consider offering the `learning-opportunities` skill, at most twice per session | none |
| `extensions/live-dashboard.ts` | `/live-dashboard` command; `session_start`, `session_shutdown`, `agent_start`, `agent_end`, `model_select`, `turn_end`, `message_end`, `tool_execution_start`, `tool_execution_end` handlers; reports session state to a local dashboard server | none |
| `extensions/pi-ext-workflows/*.ts` | Workflow functions registered through `pi-extensible-workflows`: `fetchIssueDetails` (`fetch-issue-details.ts`), `developUntilApproved` (`review-loop.ts`), `devIssuesInBatches` (`seq-issues.ts`), `tddDev` (`tdd.ts`); re-exported by `extensions/piextworkflows.ts` | `gh` / `glab` for issue lookup; the `pi-extensible-workflows` package must be installed |
| `extensions/questionnaire.ts` | The `questionnaire` tool, the unified single/multi-question prompt | none |
| `extensions/show-system-prompt.ts` | `/system-prompt` command: writes the current system prompt to `/tmp/system-prompt.md` | none |
| `extensions/tmux-progress.ts` | `agent_start` / `agent_end` handlers that set the tmux per-window option `@pi_status` | `tmux`, and the format lines documented in the file (not managed by this repository) |
| `extensions/vim-editor.ts` | `alt+m` shortcut: open the current editor buffer in Neovim | `nvim` |
| `extensions/pi-tool-display/config.json` | Config for `pi-tool-display`: `registerToolOverrides` turns off its renderer for `read` and `grep` | none |

`extensions/herdr-nvim-blocked/index.ts` describes the blocked state as coming from a `herdr:blocked` event in `extensions/herdr-agent-state.ts`, which is not tracked; see [Known gaps](#known-gaps).

### Skills

| Root | Contents | Ownership |
| --- | --- | --- |
| `pi/agent/skills/` (`~/.pi/agent/skills/`) | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Repository-owned, tracked, Pi-only. Pi also reads the canonical root, so only skills that must not be shared live here. |
| `~/.agents/skills/` | shared skills, one physical copy each | Machine-installed (see below) or linked |
| `agents/skills/phantom-ui/` | `SKILL.md` written here, the MIT standalone build plus its `.d.ts`, upstream `LICENSE`, `VENDORED.md` | Repository-owned, copied into harness roots |

The machine-installed skills are placed by `setup_env.sh` lines 191-204 (`herdr`, `triage`, `grill-me`, `grilling`, `wayfinder`, `domain-modeling`, `prototype`, `research`, `typescript-advanced`, `show-me`, `engineering-excellence`, `project-memory`) and by `agents/install-agent-extensions.sh` (`design-taste`, `impeccable`, `ponytail`, `phantom-ui`). They are read from the harness root that installed them, or from `~/.agents/skills` when that is the canonical root; see the next section.

### Other Pi files

| Path | Role |
| --- | --- |
| `pi/agent/settings.json` | Effective Pi settings: `defaultProvider`/`defaultModel`/`defaultThinkingLevel`, `theme`, the `packages` list, `hideThinkingBlock`, `showCacheMissNotices`, `tuiMode`. |
| `pi/agent/models.json` | Provider catalog and overrides; see [Providers and credentials](#providers-and-credentials). |
| `pi/agent/modes.json` | One mode, `advisor`: provider `openrouter`, model `deepseek/deepseek-v4-flash-0731`, `thinkingLevel: xhigh`, `autostart: true`. |
| `pi/agent/advisor-system.md` | System prompt for `pi-omplike-advisor`, loaded as plain Markdown text by `packages/pi-omplike-advisor/extensions/lib/controller.ts`. |
| `pi/agent/pi-extensible-workflows/settings.json` | `modelAliases`, the workflow `skills` allowlist, the workflow `extensions` allowlist, and `extensionSettings` for `herdr` and `trajectory`. |
| `pi/agent/pi-extensible-workflows/roles/*.md` | `developer`, `oracle`, `researcher`, `reviewer`, `scout`, `summarizer`, `tests-expert`. |
| `pi/agent/prompts/` | Prompt templates: `fixissues.md` (drives the `devIssuesInBatches` workflow from `ready-for-agent` issues) and `spawn-pi-pane.md` (spawns a sibling Pi in a herdr pane). |
| `pi/agent/themes/omarchy-system.json` | A shipped theme. `settings.json` selects `dark`, so this theme is available but not active. |
| `pi/agent/AGENTS.md` | Project instructions Pi loads for this repository. |
| `pi/agent/keybindings.json` | Editor keybinding overrides (`ctrl+w`, `alt+d`, ...). |
| `pi/agent/pi-vcc-config.json` | `pi-vcc` settings: `overrideDefaultCompaction`, `smartKeepTail`, `continueAfterThresholdCompact`. |
| `pi/agent/extensions/pi-openai-fast.json` | `pi-openai-fast` settings. |
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

Which layer resolves model routing, the precedence rule between them, and how to pick a model and a thinking level from measured cost, speed and quality: `pi/agent/MODELS.md` (740 lines). The short version is that Pi settings, the provider catalog, workflow aliases, subagent routing, agent frontmatter and modes all stack in a fixed order, and that the most specific layer wins. Read that file before changing routing; do not duplicate its content here. The file exists in this working tree but is not tracked by git; see [Known gaps](#known-gaps).

## Providers and credentials

`pi/agent/settings.json` sets `defaultProvider: anthropic`, `defaultModel: claude-opus-4-8`, `defaultThinkingLevel: xhigh`. There is no `enabledModels` or `modelThinkingLevels` key.

`pi/agent/models.json` declares three providers:

| Provider | What the file adds |
| --- | --- |
| `openrouter` | A `modelOverrides` entry for `deepseek/deepseek-v4-flash-0731`: pin to the `deepinfra` provider, no fallbacks, `fp4` quantizations. This is the model the `advisor` mode uses. |
| `openai-codex` | Three models: `gpt-5.6-luna` (cost 1/6 per million, 250k context, 128k max output), `gpt-5.6-sol` (5/30), `gpt-5.6-terra` (2.5/15). All text+image, `openai-codex-responses` API. |
| `tuxevil-rotator` | The local Gemini gateway: `baseUrl` `http://localhost:51200/v1`, `api: openai-completions`, `apiKey: tuxevil` (documented non-secret open-mode key). Five models, one per thinking effort: `gemini-3.8-flash-low`, `gemini-3.8-flash-medium`, `gemini-3.8-flash-high`, `gemini-3.1-pro-low`, `gemini-3.1-pro-high`, each 1,000,000-token context and 65,536 max output, text+image. Each `thinkingLevelMap` maps exactly one effort level and nulls the rest. |

Install, authenticate and start the local gateway before using those models:

```bash
npm install -g tuxevil-rotator
tuxevil-rotator login
tuxevil-rotator start
curl http://localhost:51200/v1/models -H 'Authorization: Bearer tuxevil'
```

Credentials live in `~/.pi/agent/auth.json`, which is git-ignored (`/auth.json` in `pi/agent/.gitignore`). On the machine this was written on it holds entries for `anthropic`, `openai-codex`, `google-antigravity` and `opencode-go`; `openrouter` is referenced by the aliases and the advisor mode but has no entry there, so its key arrives by another route that this repository does not manage. The gateway's account rotation happens inside `tuxevil-rotator`; Pi only selects the provider/model target configured in `models.json`. This repository does not store or modify any of these credentials.

Short names such as `gemini-flash-low` are workflow-scoped aliases in `pi/agent/pi-extensible-workflows/settings.json`, not global aliases, so they resolve in workflow role/model settings and not on the Pi CLI or in the `/model` picker.

## External binaries and runtime dependencies

| Binary | Needed by | What breaks without it |
| --- | --- | --- |
| `bash` | `setup_env.sh`, `agents/*.sh`, `pi/agent/bin/open-nvim.sh` | Nothing runs. |
| `git`, `curl`, `jq` | `setup_env.sh` release downloads, the skills CLI, various extensions | `install_release` fails on the jq parse; downloads fail. |
| `rsync` | `setup_env.sh` nvim and WSL `.local/bin` sync | Config sync fails (the script runs under `set -e`). |
| `sudo` | `apt-get`, `pacman`, installing Go and Neovim into system paths | Package and runtime installs fail on Debian/Arch. |
| `npm` / `npx` | Pi CLI install, all `npx skills add` lines, Neovim tooling, `agents/link-skills.mjs` (Node) | Pi is not installed and no skill is installed. |
| `node` | `agents/link-skills.mjs`, `pi/agent/bin/session-stats.mjs`, the OpenCode plugin edit in `install-agent-extensions.sh` | Skill linking is unavailable; the script reports `node is missing`. |
| `pi` | `pi update --extensions`, every Pi session | The command is guarded by `command -v pi`, so setup silently skips it. |
| `nvim` (>= 0.12.0) | `extensions/vim-editor.ts` (`alt+m`) | The shortcut fails to spawn the editor. |
| `herdr` | `extensions/fork-out.ts`, `extensions/herdr-nvim-blocked/index.ts`, `bin/open-nvim.sh`, the `herdr-devbox` alias | `/fork-out` and the blocked-pane marker cannot report; `open-nvim.sh` exits 1 outside herdr. |
| `tmux` | `extensions/tmux-progress.ts` | No tab progress; the extension is otherwise inert. |
| `gh`, `glab` | `pi/agent/extensions/pi-ext-workflows/*`, `prompts/fixissues.md` | Issue workflows cannot list or close issues. Both need `auth login`. |
| `fzf`, `bat`, `tree`, `rg`, `fd` | Shell additions, fzf previews, general tooling | Previews and aliases degrade; `bat` is symlinked from `batcat` on Debian. |
| `python3` | The `gigatoken` virtualenv | The venv is not created. |
| `go` | Go development | Installed by the script when missing (1.24.4). |
| `aimem` | The ai-memory-kit CLI | Installed by the script when missing; the `project-memory` skill still installs. |
| `tuxevil-rotator` | The `tuxevil-rotator` provider in `models.json` | Those five models are unreachable. |
| `curl`/`wget` + a shell | `install-agent-extensions.sh` `npx` steps | `design-taste` and `impeccable` are skipped with a `SKIP` line. |

## Skill provenance

| Upstream | Skills | Installer |
| --- | --- | --- |
| `herdrdev/herdr` | `herdr` | `npx skills add ... --global --agent pi --copy --yes` (`setup_env.sh` line 191) |
| `mattpocock/skills` | `triage`, `grill-me`, `grilling`, `wayfinder`, `domain-modeling`, `prototype`, `research` | `npx skills@latest add` (line 192) |
| `pedronauck/skills` | `typescript-advanced` | `npx skills add` (line 193) |
| `humanlayer/skills` | `show-me` | `npx skills add` (line 194) |
| `micio86dev/Engineering-Excellence` | `engineering-excellence` | `npx skills@latest add` (line 195) |
| `darkrei08/ai-memory-kit` (tag `v0.1.0`) | `project-memory` | `npx skills add "...#v0.1.0"` with an unpinned fallback (line 202); the `aimem` CLI installer runs with `--no-skill` (line 204) |
| `h3nryprod01/design-taste` | `design-taste` | `npx skills@latest add ... --global --agent <agent> --copy --yes`, per detected CLI, in `install-agent-extensions.sh` |
| `pbakaus/impeccable` | `impeccable` | `npx impeccable install --providers=... --scope=global`, run in a scratch directory; engine binary lands in `~/.impeccable/bin` |
| `DietrichGebert/ponytail` | `ponytail` (plus its commands) | Per-host plugin installers in `install-agent-extensions.sh`; for Pi, `git:github.com/DietrichGebert/ponytail` in `pi-packages.txt` |
| this repository | `phantom-ui` (`agents/skills/phantom-ui`, MIT build, provenance in `VENDORED.md`) | `agents/install-agent-extensions.sh` copies it into every existing harness root |
| this repository | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Tracked directly under `pi/agent/skills/`, Pi-only |
| `pi` examples | `questionnaire` tool | Copied into `pi/agent/extensions/questionnaire.ts` |

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

Other harnesses this repository configures indirectly: `~/.codex`, `~/.claude`, `~/.gemini`, `~/.config/opencode` are only written by the skills installer and the linker, never by `setup_env.sh`.

## Verification

Run these on the machine, after `setup_env.sh`:

```bash
# The Pi configuration is linked, not copied
readlink -f ~/.pi/agent                       # -> <repo>/pi/agent

# Pi's effective settings and packages
node -e "const s=require(process.env.HOME+'/pi/agent/settings.json');console.log(s.defaultProvider, s.defaultModel, s.packages.length)"
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

# The local Gemini gateway, when configured
curl http://localhost:51200/v1/models -H 'Authorization: Bearer tuxevil'
```

`setup_env.sh` has no `--dry-run`; `agents/link-skills.mjs` is dry-run by default.

## Known gaps

- `pi/agent/extensions/herdr-agent-state.ts` is ignored by `pi/agent/.gitignore` (`/extensions/herdr-agent-state.ts`) and is absent from this checkout, so a fresh clone does not have it. `extensions/herdr-nvim-blocked/index.ts` documents the blocked state as coming from that file's `herdr:blocked` event, so the visible state has no in-repo producer. Not verified: whether the ignore rule is intentional or the file is simply never committed.
- `pi/agent/package.json` declares `"pi-extensible-workflows": "file:../../../pi-workflows/packages/core"`. From `pi/agent` that resolves to `<repo>/../pi-workflows/packages/core`, which does not exist in this layout. Not verified: whether anything ever installs it.
- `pi/agent/settings.json` contains two entries pointing at `../../git/personale/pi-workflows` (the package itself and `packages/extensions/herdr`). A machine that calls that checkout `pi-extensible-workflows` has no `pi-workflows` directory, so both paths dangle. Unverified: the correct replacement path on such a machine.
- `setup_env.sh` installs the Pi CLI only on Arch (lines 179-188). On Debian/Ubuntu the block is skipped and `pi` must already be present; the later `pi update --extensions` line is guarded, so the omission is silent.
- `setup_env.sh` never runs `pi install`; the package set is applied by `@darkrei08/setup-ai`'s `pi-packages` module, which is a different repository. A fresh clone plus `setup_env.sh` alone does not converge on the package list.
- `pi/agent/settings.json` ships theme `dark`; `themes/omarchy-system.json` is not selected by any setting here. Unverified: whether it is meant to be activated on Omarchy.
- `pi/agent/npm/node_modules` is git-ignored and nothing in this repository installs it. Unverified: which step is expected to populate it.
- `pi-orcarouter` has no description in its `package.json`, so its contribution is not documented here.
- `openrouter` is referenced by `modelAliases` and the `advisor` mode but has no entry in the authoring machine's `auth.json`; where that key comes from is unverified.
- `agents/link-skills.mjs` junction discovery is verified for Pi only. For the other harnesses the manifest records the expected root; a harness that ignores junctions in its own directory is not detected. Run `--verify` and start each harness once after `--apply`.
- Several files this README documents are untracked in the working tree, so a fresh clone does not have them: `agents/LINKING.md`, `agents/link-skills.mjs`, `agents/skills.manifest.json` (the whole [single-copy layout](#skills-and-packages-layout-one-physical-copy) mechanism), `pi/agent/MODELS.md` (740 lines, allowlisted by `!/MODELS.md` in `pi/agent/.gitignore`), and the `oracle` and `researcher` role files under `pi/agent/pi-extensible-workflows/roles/`. Unverified: whether that is an in-progress state or a deliberate omission.
