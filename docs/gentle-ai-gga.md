# Gentle AI, gentle-pi and GGA in this repository

This guide explains what each piece does, how this repository wires it, how to set
it up for Pi and for the other coding agents, and which model reviews your commits
and why. Facts about the tools cite their documentation; facts about this checkout
cite the file that holds them. Installed here: `gentle-ai 4.0.0`, `gga v2.10.1`.

## The pieces

| Piece | What it is | Source |
| --- | --- | --- |
| Gentle AI (`gentle-ai`) | An ecosystem configurator. It equips the agents you already have with memory (Engram), skills, MCP servers, model routing, a persona and bounded native review. It does not install an agent for you. | [README](https://github.com/Gentleman-Programming/gentle-ai/blob/main/README.md), [usage](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/usage.md) |
| gentle-pi (Gentle Shell) | The Pi package that owns Pi's runtime prompts, persona, model assignments, delegation and ODD behavior. Gentle AI provisions it but does not own it. | [Pi integration](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/pi.md), [npm](https://www.npmjs.com/package/gentle-pi) |
| GGA (`gga`) | Gentleman Guardian Angel: a pure-Bash pre-commit hook that sends staged files and your rules to an AI provider and blocks the commit on `STATUS: FAILED`. | [README](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/README.md), [configuration](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/configuration.md) |
| Native review (RDD) | Gentle AI's receipt-driven review of a frozen change candidate, run by reviewer subagents. Separate from GGA, and controlled by `gentle-ai review mode`. | [Pi integration, Review and checks](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/pi.md) |

Since v4.0.0 the SDD component is retired in favor of ODD, the single development
workflow ([components](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/components.md)).
The upstream docs track `main`; the v4.0.0 docs are at
<https://github.com/Gentleman-Programming/gentle-ai/tree/v4.0.0/docs>.

## What `setup_env.sh` does here

- Installs `gentle-ai` through its official Go module and `gga` by cloning and
  running its installer (see the AI CLI row in `README.md`).
- Registers `npm:gentle-pi` and `npm:gentle-engram` as Pi packages in
  `pi/agent/settings.json`, with `check-config.sh` asserting both are present.
- Leaves per-repository GGA setup to you, as Gentle AI does: the `gga` component
  installs the binary only, and `gga init` / `gga install` stay an explicit
  decision per repository ([components](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/components.md)).

## Set up Gentle AI

### For Pi

Install Pi first and make sure `pi` is on `PATH`, then run
([Pi integration](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/pi.md)):

```bash
gentle-ai install --agent pi
pi
```

This runs `pi install` for `gentle-pi`, `gentle-engram`, `pi-web-access` and
`pi-btw`, and initializes Pi Engram. Gentle AI does not write Pi's system prompt;
`gentle-pi` does. Pi's own models and effort are set in this repository, not by
Gentle AI: see [`pi/agent/MODELS.md`](../pi/agent/MODELS.md). `PI_CODING_AGENT_DIR`
redirects the files Gentle AI writes into an isolated Pi home.

### For other agents

Agent IDs ([supported agents](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/agents.md)):
`claude-code`, `opencode`, `kilocode`, `gemini-cli`, `cursor`, `vscode-copilot`,
`codex`, `windsurf`, `antigravity`, `kimi`, `qwen-code`, `kiro-ide`, `openclaw`,
`trae-ide`, `pi`, `hermes`, `conductor`.

```bash
# Preview, then apply (usage: install)
gentle-ai install --dry-run --agent claude-code,opencode,codex --preset full-gentleman
gentle-ai install --agent claude-code,opencode,codex --preset full-gentleman

# Keep the stack inside one project instead of the global agent config
gentle-ai install --agent claude-code --scope=workspace
```

Presets ([components](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/components.md)):

| Preset | ID | Includes |
| --- | --- | --- |
| Dev Stack + Polish | `full-gentleman` | Engram, skills, Context7, GGA, permissions, theme |
| Dev Stack | `ecosystem-only` | Engram, skills, Context7, GGA |
| Memory Only | `minimal` | Engram |
| Custom | `custom` | You pick components and skills; existing persona stays unmanaged |

After upgrading the binary, refresh managed assets. `sync` only touches the agents
recorded in `~/.gentle-ai/state.json`, so preview first
([usage: sync](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/usage.md)):

```bash
gentle-ai sync --dry-run
gentle-ai sync
gentle-ai doctor        # read-only diagnostics
```

Models for the agents Gentle AI manages are client-specific. Use the TUI
**Configure Models** screen for the roles a client exposes
([agents](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/agents.md)).

## GGA: the commit review gate

### How the gate is wired

1. `.gga` holds the provider, file patterns and rules file. This repository reviews
   against `REVIEW_RULES.md`, with `STRICT_MODE="true"` so an unparseable verdict
   blocks the commit instead of passing it.
2. The pre-commit hook starts GGA through `agents/gga-pi/run-gga.sh`. After
   `gga install` writes the hook, replace its `gga run || exit 1` line with this
   block. It falls back to plain `gga run` in a worktree on a branch without the
   bridge, so other worktrees of the clone keep their gate:

   ```bash
   gga_pi="$(git rev-parse --show-toplevel)/agents/gga-pi/run-gga.sh"
   if [ -x "$gga_pi" ]; then "$gga_pi" run || exit 1; else gga run || exit 1; fi
   ```

   The hook lives in the clone's common git directory
   (`git rev-parse --git-common-dir`), not in the repository.

3. Config priority is the `GGA_PROVIDER` / `GGA_TIMEOUT` environment, then `.gga`,
   then `~/.config/gga/config`
   ([configuration](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/configuration.md)).

### Why GGA reviews through Pi

GGA ships providers for Claude, Gemini, Codex, OpenCode, Cursor, Kilo, Kiro, Ollama,
LM Studio, GitHub Models and MiniMax, and has no Pi provider, in the installed
v2.10.1 and on upstream `main`
([providers](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/providers.md)).
Calling the Claude or Codex CLIs directly needs a second login each and a second
quota. Pi already holds your Claude Pro and ChatGPT Plus logins, so the review goes
through `pi --print`.

GGA's `kilo` provider runs `kilo run --auto --model <m>` with the prompt on stdin.
`agents/gga-pi/bin/kilo` stands in for that binary and answers with a review-only
`pi --print` call (no tools, extensions, skills, MCP or project context). It is on
`PATH` only when GGA is started through `agents/gga-pi/run-gga.sh`, so it never
shadows a real Kilo install. Pi accepts `provider/model:effort` and reads the prompt
from stdin, which is why the value after `kilo:` is a Pi model pattern:

```bash
PROVIDER="kilo:anthropic/claude-sonnet-5-5:high"
```

If GGA says "Kilo CLI not found", it was started without the wrapper: use
`agents/gga-pi/run-gga.sh run` instead of `gga run`, or fix the hook block above.

### Which model, and at what effort

The default is Claude Sonnet 5.5 at `high`.

- It is built for the review pass that runs on every change: CodeRabbit measured
  about 5.5 minutes and $0.47 per review, 6 of 13 hard known bugs caught at 41%
  precision, and found thinking on beats thinking off at a small cost
  ([CodeRabbit, Sonnet 5.5 review](https://www.coderabbit.ai/blog/sonnet-5-5-model-review)).
- Opus 5.5 caught 8 of 13 at standard effort (66.7% precision) and 10 of 13 at max
  (52% precision) on the same cases, so it is stronger on the hardest changes and
  costs twice the list price (same source).
- Reasoning curves show low to medium to high as the useful steps and xhigh as much
  costlier for a small gain ([Stet, reasoning curve](https://www.stet.sh/blog/gpt-55-codex-graphql-reasoning-curve)).
  Sonnet 5.5 takes `low`, `medium`, `high`, `xhigh` and `max` (CodeRabbit, above);
  Anthropic documents the effort parameter at
  <https://platform.claude.com/docs/en/build-with-claude/effort>.

The benchmark has 13 cases, so read it as a direction, not a verdict.

| Need | `PROVIDER` | Notes |
| --- | --- | --- |
| Default, every commit | `kilo:anthropic/claude-sonnet-5-5:high` | Claude Pro |
| High-risk change | `kilo:anthropic/claude-opus-5-5:high` | Opus, stronger and slower, same Pro quota |
| Claude quota spent | `kilo:openai-codex/gpt-6.1-sol:high` | ChatGPT Plus, 15-160 messages per 5 hours ([pricing](https://learn.chatgpt.com/docs/pricing)) |
| Cheapest and fastest | `kilo:openai-codex/gpt-6-luna:high` | Fastest output, lower intelligence index ([Artificial Analysis](https://artificialanalysis.ai/models/releases/comparisons/claude-sonnet-5-5-vs-gpt-6-luna)) |
| Through CLIProxyAPI | `kilo:cliproxyapi/claude-sonnet-5-5:high` | Same models, needs the gateway running |

One-off override, without editing `.gga`:

```bash
GGA_PROVIDER=kilo:anthropic/claude-opus-5-5:high git commit
```

`check-config.sh` asserts that the `.gga` provider is the Pi bridge for Pi's default
model, so the review model and the interactive model cannot drift apart silently.

### Use GGA with other agents

Outside Pi, pick the provider that matches the agent you use
([providers](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/providers.md)):

| Agent | `PROVIDER` | Model and effort |
| --- | --- | --- |
| Claude Code | `claude` | `model` and `effortLevel` in `.claude/settings.json`, or `claude --effort` |
| Codex | `codex` | `model` and `model_reasoning_effort` in `.codex/config.toml` |
| OpenCode | `opencode:<provider/model>` | `OPENCODE_VARIANT` for effort ([commands](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/commands.md)) |
| Cursor | `cursor:<model>` | The model named in the provider value |
| Gemini CLI | `gemini` | Configured in the Gemini CLI itself |

Set up a new repository with `gga init`, edit `.gga`, then `gga install`
([commands](https://github.com/Gentleman-Programming/gentleman-guardian-angel/blob/main/docs/commands.md)).
Run `gga run --no-cache` to force a full review, and `gga run --ci` or
`gga run --pr-mode` in CI.

### Native review is a separate gate

Gentle AI's receipt-driven review does not use `.gga`. Its reviewer lenses take their
models from `pi/agent/subagents.json` (`review-risk`, `review-resilience`,
`review-readability`, `review-reliability`), set here to Sonnet 5.5 at `high`.
Check or switch it with `gentle-ai review mode status|enable|disable`. Evidence from
a review never authorizes a commit or push; repository policy still decides
delivery ([Pi integration](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/pi.md)).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Kilo CLI not found` | GGA started without the wrapper. Use `agents/gga-pi/run-gga.sh run`, or fix the hook block above. |
| `gga-pi: pi is not on PATH` | Pi is not installed for this shell. Install it, then retry. |
| `provider returned no output` | The `pi` call failed. Run the model by hand: `echo hi \| pi --print --no-tools --model anthropic/claude-sonnet-5-5:high`, and run `/login` inside Pi if the provider is signed out. |
| Quota or rate-limit error | Switch with `GGA_PROVIDER=kilo:openai-codex/gpt-6.1-sol:high` until the Claude window resets. |
| Verdict not parsed | `STRICT_MODE` blocks ambiguous answers by design. Re-run once; if it repeats, raise `TIMEOUT` or reduce the staged set. |

## Verify

```bash
bash check-config.sh                 # model, alias and GGA bridge invariants
node --test agents/gga-pi.test.mjs   # bridge behavior with a fake pi
agents/gga-pi/run-gga.sh run         # a real review of the staged files
```

The bridge tests run against a fake `pi`. Not verified: running the bridge on
Windows or macOS, and the CLIProxyAPI model IDs, which depend on an authenticated
gateway catalog.
