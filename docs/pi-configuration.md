# Pi configuration

How the versioned Pi configuration in `pi/agent` is composed: packages, in-repo extensions, skills, other files, models and providers. For the install command see the [README](../README.md); for what `setup_env.sh` does with these files see the [setup reference](setup-reference.md).

## Composition

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
| `npm:gentle-pi` | Object form excluding `extensions/quiet-tools.ts`, `extensions/pi-pretty.ts`, and `extensions/codegraph-tools.ts`. The first two avoid the visual-shell conflict and the third avoids duplicate `codegraph` registration with `pi-extension-pack`. The manifest line carries the source only. |
| `packages/pi-omplike-advisor` | The manifest writes the same directory as `~/.pi/agent/packages/pi-omplike-advisor`; both resolve to the corresponding live configuration directory. |
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
| `npm:pi-tool-display` | Compact tool-call rendering, diff visualization, output truncation. Its ownership config leaves `read`/`edit` to `tool-fixer` and `grep`/`ls` to `command-artifacts`. |
| `git:github.com/vekexasia/pi-notify@feat/customizable-notifications` | Desktop notifications via OSC 777/99/9 and Windows toast. |
| `npm:@sting8k/pi-vcc` | Deterministic compaction and recall for the main session and workflow children. Its `pi-vcc-config.json` enables the upstream-compatible ownership and tail-retention settings. |
| `pi/agent/packages/pi-omplike-advisor` | In-repo advisor extension: a second, read-only model reviews the main agent's transcript and injects advice; driven by `advisor-system.md` and the `advisor` entry in `modes.json`. |
| `pi/agent/packages/pi-codex-context` | Retained source-only for historical tests and comparison; it is not registered in `settings.json` or `pi-packages.txt`. |

### In-repo extensions

`pi/agent/package.json` declares the package surface: `pi.extensions` is `extensions`, `pi.skills` is `skills`.

| File | Registers | External binary |
| --- | --- | --- |
| `extensions/agent-usage/index.ts` | `/agent-usage [pi\|codex\|claude] [daily\|weekly\|monthly\|session]` command: local token and API-equivalent cost of Pi, Codex and Claude Code from their session logs | `ccusage` |
| `extensions/answer.ts` | `/answer` command: extract the questions from the last assistant message and answer them interactively; reuses `questionnaire.ts` | none |
| `extensions/compact-tools.ts` | When opted in with `PI_ENABLE_COMPACT_TOOLS=1` (off by default), registers `/compact-tools-status` and patches `ToolExecutionComponent.prototype.updateDisplay` for compact `read`/`edit`/`write`/`bash` rendering | none |
| `extensions/deep-think.ts` | `think` tool; `session_start`, `thinking_level_select` handlers | none |
| `extensions/fork-out.ts` | `/fork-out` command: copy the current root-to-leaf path into a new session file and open it in a herdr split | `herdr` |
| `extensions/herdr-nvim-blocked/index.ts` | `tool_execution_start` / `tool_execution_end` handlers: marks the herdr pane blocked while `bin/open-nvim.sh` runs an operator review | `herdr` |
| `extensions/learning-opportunities-auto.ts` | `session_start`, `tool_result`, `before_agent_start` handlers: after a `bash` command matching `git commit`, asks the agent to consider offering the `learning-opportunities` skill, at most twice per session | none |
| `extensions/live-dashboard.ts` | `/live-dashboard` command; `session_start`, `session_shutdown`, `agent_start`, `agent_end`, `model_select`, `turn_end`, `message_end`, `tool_execution_start`, `tool_execution_end` handlers; reports session state to a local dashboard server | none |
| `extensions/model-preflight.js` + `model-preflight.mjs` | The `.js` adapter is the default-loadable Pi entrypoint; the tested `.mjs` implementation registers `/model-preflight`, session-start and TTL refresh of the reusable model availability preflight and blocks routing on stale or unknown evidence | `node`, pi-model-fit `preflight.mjs` |
| `extensions/pi-ext-workflows/*.ts` | Workflow functions registered through `pi-extensible-workflows`: `fetchIssueDetails` (`fetch-issue-details.ts`), `developUntilApproved` (`review-loop.ts`), `devIssuesInBatches` (`seq-issues.ts`), `tddDev` (`tdd.ts`); re-exported by `extensions/piextworkflows.ts` | `gh` / `glab` for issue lookup; the `pi-extensible-workflows` package must be installed |
| `extensions/questionnaire.ts` | The `questionnaire` tool, the unified single/multi-question prompt | none |
| `extensions/show-system-prompt.ts` | `/system-prompt` command: writes the current system prompt to `/tmp/system-prompt.md` | none |
| `extensions/tmux-progress.ts` | `agent_start` / `agent_end` handlers that set the tmux per-window option `@pi_status` | `tmux`, and the format lines documented in the file (not managed by this repository) |
| `extensions/vim-editor.ts` | `alt+m` shortcut: open the current editor buffer in Neovim | `nvim` |

`extensions/herdr-nvim-blocked/index.ts` describes the blocked state as coming from a `herdr:blocked` event in `extensions/herdr-agent-state.ts`, which is not tracked; see [Known gaps](verification.md#known-gaps).

### Skills

| Root | Contents | Ownership |
| --- | --- | --- |
| `pi/agent/skills/` (`~/.pi/agent/skills/`) | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Repository-owned, tracked, Pi-only. Pi also reads the canonical root, so only skills that must not be shared live here. |
| `~/.agents/skills/` | shared skills, one physical copy each | Machine-installed (see [Skill provenance](skills-and-agents.md#skill-provenance)) or linked |
| `agents/skills/phantom-ui/` | `SKILL.md` written here, the MIT standalone build plus its `.d.ts`, upstream `LICENSE`, `VENDORED.md` | Repository-owned, copied into harness roots |

The machine-installed skills are placed by `setup_env.sh` (the first-party `mattpocock/skills` engineering set, `herdr`, `typescript-advanced`, `show-me`, `engineering-excellence`, and `project-memory`) in the canonical `~/.agents/skills` root, which Pi reads directly. `agents/install-agent-extensions.sh` manages `design-taste`, `impeccable`, `ponytail`, and `phantom-ui` separately; see [Skills and other agents](skills-and-agents.md).

### Other Pi files

| Path | Role |
| --- | --- |
| `pi/agent/settings.json` | Effective Pi settings: `defaultProvider`/`defaultModel`/`defaultThinkingLevel`, `modelThinkingLevels`, `compaction`, `theme`, the `packages` list, `hideThinkingBlock`, `showCacheMissNotices`, `tuiMode`. |
| `pi/agent/models.json` | Provider catalog and overrides; see [Providers and credentials](#providers-and-credentials). |
| `pi/agent/modes.json` | `advisor`: provider `cliproxyapi`, modelId `gpt-6-luna`, `thinkingLevel: high`, `autostart: false`; `opencode-max`: provider `opencode-go`, modelId `deepseek-v4.1-flash`, `thinkingLevel: max`, `autostart: false`. |
| `pi/agent/advisor-system.md` | System prompt for `pi-omplike-advisor`, loaded as plain Markdown text by `packages/pi-omplike-advisor/extensions/lib/controller.ts`. |
| `pi/agent/pi-ext-roles/settings.json` | Shared role settings: `modelAliases`, the `skills` allowlist and the `extensions` allowlist. |
| `pi/agent/ha-failover.example.json` | Credentials-free HA groups and ordered fallback entries. |
| `pi/agent/pi-ha-role-groups.json` | Role-to-HA-group bindings used to validate primary coverage. |
| `pi/agent/pi-extensible-workflows/settings.json` | Workflow-only overrides: `extensionSettings` for `herdr` and `trajectory`. |
| `pi/agent/pi-ext-roles/roles/*.md` | `developer`, `oracle`, `researcher`, `reviewer`, `scout`, `summarizer`, `tests-expert`, `architect`, `security`, `qa`, `release`, `sre`. |
| `pi/agent/prompts/` | Prompt templates: `fixissues.md` (drives the `devIssuesInBatches` workflow from `ready-for-agent` issues) and `spawn-pi-pane.md` (spawns a sibling Pi in a herdr pane). |
| `pi/agent/themes/omarchy-system.json` | A shipped theme. `settings.json` selects `dark`, so this theme is available but not active. |
| `pi/agent/AGENTS.md` | Project instructions Pi loads for this repository. |
| `pi/agent/keybindings.json` | Editor keybinding overrides (`ctrl+w`, `alt+d`, ...). |
| `pi/agent/pi-vcc-config.json` | `pi-vcc` settings for the main session and workflow children: `overrideDefaultCompaction`, `smartKeepTail`, `continueAfterThresholdCompact`. |
| `pi/agent/bin/` | `open-nvim.sh` (herdr-gated operator review helper, requires `HERDR_ENV=1` and `HERDR_PANE_ID`), `session-stats.mjs` (session metrics), `cdp` (pointer to the chrome-cdp script). |
| `pi/agent/npm/` | npm manifest and lockfile for the npm-backed packages. |
| `pi/agent/.pii-allowlist` | Regex allowlist for git-shield false positives in this repository. |
| `pi/agent/.gitignore` | Whitelist: `/*`, then explicit `!` entries. A new file must be added there or it is untracked. |

## Models, aliases and effort

Which layer resolves model routing, the precedence rule between them, and how to pick a model and a thinking level from measured cost, speed and quality: `pi/agent/MODELS.md` (791 lines, allowlisted by `!/MODELS.md` in `pi/agent/.gitignore`). The short version is that Pi settings, the provider catalog, workflow aliases, subagent routing, agent frontmatter and modes all stack in a fixed order, and that the most specific layer wins. Read that file before changing routing; do not duplicate its content here.

## Providers and credentials

`pi/agent/settings.json` sets `defaultProvider: cliproxyapi`, `defaultModel: gpt-5.6-luna`, and `defaultThinkingLevel: high`. `modelThinkingLevels` keeps native mirrors and current CLIProxyAPI targets; `enabledModels` lists only catalog-backed CLIProxyAPI picker entries. Compaction is enabled with `compaction.enabled: true`. `pi/agent/subagents.json` uses CLIProxyAPI Claude Sonnet 4.6 by default and Opus 4.6 Thinking for review profiles. GGA uses the configured reviewer HA route (`kilo:cliproxyapi/gpt-6-luna:high`) through Pi (`.gga`, `agents/gga-pi/`); the reviewer role's Claude route remains an independent workflow route, and the reviewer HA group provides the ordered fallbacks. GGA therefore needs no separate Claude or Codex login. See [gentle-ai-gga.md](gentle-ai-gga.md).

`pi/agent/models.json` declares the static `openrouter` and `openai-codex` providers; `npm:@router-for-me/pi-cliproxyapi-provider` adds the dynamic `cliproxyapi` catalog from the local CPA service:

| Provider | What the file adds |
| --- | --- |
| `openrouter` | A `modelOverrides` entry for `deepseek/deepseek-v4.1-flash` with OpenRouter routing restricted to `only: ["deepseek"]` and `allow_fallbacks: false`. |
| `openai-codex` | Five text+image models: `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-6-luna`, `gpt-6-sol`, and `gpt-5.6-terra`, with a 250k context and 128k maximum output. |
| `cliproxyapi` | Dynamic OpenAI-compatible models from CLIProxyAPI. CPA Usage Keeper provides the local usage, cost and quota dashboard. |

Use the CLIProxyAPI stack documented in [`cliproxyapi/README.md`](../cliproxyapi/README.md):

```bash
cd cliproxyapi
docker compose up -d
# CPA management: http://127.0.0.1:8317/management.html
# Keeper dashboard: http://127.0.0.1:8080
```

Pi's footer prints `no subscription usage for this provider` for `cliproxyapi`: gentle-pi only reads plan quota for `openai-codex`, `anthropic` and `nan`. Local usage of all three agents is available without the gateway: `ccusage daily` (or `ccusage pi|codex|claude daily`) in a shell, or `/agent-usage` in Pi. It reads the session logs (`~/.pi/agent/sessions`, `~/.codex`, `~/.claude/projects`) and reports tokens and API-equivalent cost, not plan quota. Gateway quota and cost per account stay in the Keeper dashboard.

Credentials live in `~/.pi/agent/auth.json` and `~/.pi/agent/cliproxyapi.json`, which are git-ignored and preserved by `sync_pi`. Pi selects live CLIProxyAPI targets from its provider catalog. The tracked files do not verify runtime credential contents or how each credential is acquired; this repository does not store or modify them.

Workflow roles follow the current `roleRecommendations` source in
`pi-model-fit/scripts/report.mjs`: developer, QA, release, and SRE use
`cliproxyapi/claude-sonnet-4-6:off`; architect, security, reviewer, and oracle
use `cliproxyapi/claude-opus-4-6-thinking:off` because the gateway exposes no Claude thinking effort; tests use
`cliproxyapi/gpt-5.6-luna:high`; researcher uses the same model at `xhigh`; Scout
uses `cliproxyapi/gemini-3.8-flash-high:medium`; and summarizer uses
`cliproxyapi/gemini-3.5-flash-lite:low`. Native aliases remain manual mirrors, and
OpenCode Go remains a separate direct provider. These assignments describe
configuration only: catalog visibility, entitlement, inference, and quota are
not interchangeable evidence.

The tracked `pi/agent/pi-ha-role-groups.json` binds each role primary to a group
in `ha-failover.example.json`. `pi-ha-bootstrap.mjs` returns fallbacks only when
the current model is present in an explicitly requested group or exactly one
matching group. Unknown or ambiguous models return an empty list; `defaultGroup`
does not disambiguate shared models. The `model-preflight.mjs` extension invokes
the reusable pi-model-fit preflight at session start and through `/model-preflight`, refreshes using the
TTL cache every 15 minutes by default, and blocks agent routing when evidence is
stale, unknown, malformed, or unavailable. Use `/model-preflight apply` after an
explicit refresh request to atomically apply only reachable matrix routes to
`~/.pi/agent/ha.json`; credentials and non-group HA settings are preserved. Set
`PI_MODEL_FIT_ROOT` or `PI_MODEL_PREFLIGHT_SCRIPT` to locate the shared
`preflight.mjs`, `PI_MODEL_PREFLIGHT_CACHE` for the mode-600 cache path,
`PI_MODEL_PREFLIGHT_HA_CONFIG` for the redacted HA config, and
`PI_MODEL_PREFLIGHT_REFRESH_MS` or `PI_MODEL_PREFLIGHT_TIMEOUT_MS` for bounded
refresh settings. No credentials or persistent aliases are changed.

Gemini alternatives remain explicit HA fallbacks; they never silently replace a
primary route. See `pi/agent/MODELS.md` for the full alias and effort table.
