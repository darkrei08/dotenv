# Pi workflow and Herdr visual-shell audit

Date: 2026-10-18
Scope: `dotenv`, `pi-extensible-workflows`, `pi-atelier`, and `pi-diff-panel`.

## Executive decision

Keep the current CLIProxyAPI-first model policy. Do not add free OpenCode routes to workflow defaults, role aliases, HA groups, or GGA. Analyze the visual extensions separately from orchestration and model routing.

Recommended order:

1. Align the local workflow package and role-extension boundary with upstream `pi-extensible-workflows` 6.2.2.
2. Do a read-only TUI smoke test of Pi Atelier in an isolated profile.
3. Do not install Pi Diff Panel into the shared profile until its polling and keybinding behavior are changed or explicitly accepted.
4. Do not allow either visual extension in headless workflow subagents.

## 1. Verified upstream state

### `pi-extensible-workflows`

- Current `main` and `v6.2.2` resolve to `48eb64692516566f2a600dd7f304952ef034742f`.
- Recent commits include:
  - `6a75c52`: suppress trajectory clock-only updates and reuse publisher encodings.
  - `626c953`: bound trajectory frame copying and defer backpressured state encoding.
  - `a6ae482`: freeze final workflow tool results.
  - `1e4ea8f`: enforce evidence lifecycle and integrity.
  - `309d670`: simplify and validate the evidence API.
- Local installed package: `6.2.2`.
- The workflow contract provides durable orchestration, registered functions, aliases, budgets, checkpoints, worktrees, retries/resume, shell operations, trajectory output, and model selection. It does not prove provider entitlement or inference health.

### `pi-atelier`

- `main` and release `v0.16.0` resolve to `3b42825eb08f062db76b72a6ab988e47261866ea`.
- Latest release commits add responsive sidebar rows, progress bars, context-meter polish, and subagent-cost visualization.
- Requirements from its package/README: Pi >= 0.84.0, Node >= 22.19.0, interactive TUI.
- It provides a status rail, activity sidebar, `/atelier`, configurable F6 shortcut, and a `registerSidebarPanel` seam for other extensions.
- It uses Pi's custom footer/editor surfaces; its README warns that only one custom footer and one custom editor are visible, with load order deciding which extension wins.

### `pi-diff-panel`

- `main` and release `v0.1.1` resolve to `e7f9cbffa83bdef61aaa1f59e6b3c7c380c55e39`.
- Recent implementation commits include `c39ccce` (bottom panel), `dac1f70` (configurable position/key/autoShow, default `ctrl+\\`), and `2779cb8` (git-repository guard and command completions).
- It is a Pi extension with no pinned engine requirement. It exposes `/diff-panel`, `/diff`, configurable bottom/left/right placement, and a default two-second refresh interval plus refresh after `agent_end`.
- It reads the current Pi working directory and shows staged, unstaged, and untracked changes. It is not documented as a workflow-worktree-aware viewer.

## 2. Local model and workflow alignment

- The local installed workflow package is 6.2.2.
- The tracked Pi baseline is `defaultProvider: cliproxyapi`, `defaultModel: gpt-5.6-luna`, and `defaultThinkingLevel: high`.
- Tracked role/alias policy remains CLIProxyAPI-first: Claude Sonnet for development/QA/release/SRE, Claude Opus for review/oracle/architecture/security, GPT-5.6 Luna for research/tests (`xhigh` for research and `high` for tests), Gemini Flash for scout, and Haiku for summarization where the exact route is listed.
- `pi --list-models` showed the configured CLIProxyAPI routes; subscription entitlement, quota, and inference success remain separate evidence gates.
- Free OpenCode models are not suitable as defaults here: they cross the intended plan boundary, have separate availability/quota semantics, and were not authorized for substitution. Direct `opencode-go/*` and `cliproxyapi/go/*` are different routes.
- A configuration gap requires a separate implementation decision: the repository tracks `pi/agent/pi-ext-roles/` and calls roles from workflow code, but `npm:@piewf/pi-ext-roles` is not present in tracked `pi/agent/settings.json` or `pi-packages.txt`. The package exists in the live Pi installation (`0.2.1`). This is a potential role-resolution drift, not yet a proven runtime failure.

## 3. Overlap and integration boundaries

| Concern | P Workflow Extensible | Gentle AI / gentle-pi | Herdr and shells | Atelier | Diff Panel | GGA |
|---|---|---|---|---|---|---|
| Orchestration | Durable runs, agents, worktrees, budgets, retries | ODD routing, delegation discipline | Pane/session lifecycle | None | None | None |
| Model routing | Alias/model selection at workflow boundaries | Runtime persona/role policy | Must not override provider policy | Telemetry only | None | Its own review bridge/model |
| TUI ownership | Workflow widgets/trajectory where enabled | Footer/editor/status surfaces | Terminal panes and shell keymaps | Footer/editor/sidebar | Widget/overlay/panel | Staged-file review output |
| Git visibility | Worktree-aware execution context | Change/review workflow | Worktree/pane context | Read-only workspace status | Current `ctx.cwd` polling | Index/staged candidate |
| Review/gates | Workflow reviewer loops and evidence | Native review/RDD and ODD checks | Operational shell controls | No review authority | No review authority | Pre-commit/CI review |

The main overlap is presentation and input ownership, not model capability. Keep Gentle Shell as the owner of shared footer/editor/status surfaces. Keep workflow execution headless for subagents. Keep GGA independent as a staged Git gate.

## 4. Adoption assessment

### Pi Atelier

**Potential fit: isolated interactive profile only.** Its sidebar-panel API is the cleanest integration seam, and it is read-only with no external runtime network dependency. However, it can compete for Pi's custom footer/editor surfaces and its default F6 is already a terminal-level mapping in this environment. A safe trial would use `/atelier` or an explicitly remapped shortcut, a separate Pi profile, and no changes to shared Gentle configuration.

### Pi Diff Panel

**Potential fit: deferred.** It provides useful branch/diff visibility, but its default `ctrl+\\` is unsafe as a universal POSIX choice and its two-second Git polling overlaps with automated workflow merges, GGA staging, and worktree operations. It also reads `ctx.cwd`, so it should not be treated as a complete view of parallel workflow worktrees. Prefer the existing Gentle change viewer unless a future version offers event-driven refresh, explicit worktree selection, and a safe default key.

## 5. Required follow-up before integration

1. Verify the tracked/live `@piewf/pi-ext-roles` package boundary and run a headless role-resolution smoke; do not silently change defaults.
2. Run Pi Atelier in an isolated interactive profile; test footer/editor coexistence, F6 interception, terminal resize, and subagent/headless exclusion.
3. Do not install Diff Panel in the shared profile yet. If tested, use a temporary profile, `autoShow: false`, a non-control key, and observe Git behavior during worktree/GGA operations.
4. If either extension is adopted, document package allowlisting and prevent loading in headless subagents.
5. Keep all model recommendations fully qualified as `cliproxyapi/<model>:<effort>` and preserve the no-free-OpenCode-default rule.

## Sources and verification

- https://github.com/vekexasia/pi-extensible-workflows/commits/main
- https://github.com/vekexasia/pi-extensible-workflows/blob/main/CHANGELOG.md
- https://github.com/michaelmjhhhh/pi-atelier
- https://github.com/hazrid93/pi-diff-panel
- Local `pi/agent/settings.json`, `pi/agent/pi-packages.txt`, `check-config.sh`, `pi/agent/extensions/pi-ext-workflows/`, and `reports/2026-10-19.md`.

### Not run

- No package installation.
- No live TUI/browser visual smoke test.
- No workflow inference benchmark.
- No changes to aliases, defaults, provider credentials, GGA, or Herdr runtime configuration.
