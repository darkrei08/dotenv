# Models, aliases, and thinking effort

This file explains how Pi decides which model and which thinking level an agent
uses, how to point that at your own providers, and how to choose a model and an
effort level from measured cost, speed, and quality instead of vibes.

It assumes you cloned this dotfiles repository and that its `pi/agent` directory
is (or will be) linked to `~/.pi/agent`. See `README.md` for the link and for the
gateway notes, `pi-packages.txt` for the packages that install with it, and
`../../agents/LINKING.md` for how shared skills are linked across harnesses.

This file is new and `pi/agent/.gitignore` allowlists files explicitly, so it is
currently untracked. Add `!/MODELS.md` to that allowlist if you want it committed.

Read time is about 30 minutes. Part 1 is the mechanism; Part 2 is the metric
work. Every number in Part 2 carries a source and a read date. Anything I could
not verify is marked **UNVERIFIED**.

---

## Part 1: the mechanisms

There are six places a model or thinking level can be set. They are not
alternatives; they stack in a fixed order. Users get this wrong by editing the
one file that does not win.

| # | Layer | File | Keys | Used by |
|---|-------|------|------|---------|
| 1 | Pi settings | `~/.pi/agent/settings.json`, project `.pi/settings.json` | `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, `modelThinkingLevels`, `enabledModels` | The interactive session, `/model`, Ctrl+P cycling |
| 2 | Provider and model catalog | `~/.pi/agent/models.json` | `providers.<id>`, `providers.<id>.models[]`, `providers.<id>.modelOverrides` | The model picker and the runtime; this is how a custom or gateway provider becomes usable |
| 3 | Workflow aliases | `~/.pi/agent/pi-extensible-workflows/settings.json`, project `.pi/pi-extensible-workflows/settings.json` | `modelAliases` | Workflow `agent()` calls and workflow role files only |
| 4 | Subagent routing | `~/.pi/agent/subagents.json`, project `.pi/subagents.json` | `default_model`, `default_effort`, `model_profiles` | SDD and subagent phase agents (gentle-pi) |
| 5 | Agent and role definitions | `~/.pi/agent/agents/*.md`, `~/.pi/agent/pi-extensible-workflows/roles/*.md` | frontmatter `model:`, `thinking:` | One agent, as its own default |
| 6 | Modes | `~/.pi/agent/modes.json` | `modes.<name>.{provider,modelId,thinkingLevel,autostart}` | A named mode such as `advisor` |

### Precedence, in one line

For an SDD or subagent agent: `subagents.json model_profiles[agent]` beats the
agent file's frontmatter `model:` / `thinking:`, which beats
`subagents.json default_model` / `default_effort`, which beats the runtime
default.

Effort resolves the same way, independently of the model. You can pin the model
from one layer and the effort from another.

This is implemented in `~/.pi/agent/npm/node_modules/gentle-pi/lib/agents-config.ts`:

- `resolveAgentProfile()` picks model and thinking from the ordered candidate
  list `profile` then `definition` then `default` (lines 300 to 313).
- `parseAgentsConfig()` merges project over global field by field and merges
  `model_profiles` per agent, so a project can change one effort without
  repeating the model (`parseProfiles()` and `mergeProfiles()`, lines 243 to 262).

### The trap: workflow aliases are not SDD aliases

`modelAliases` in `pi-extensible-workflows/settings.json` are read by the
workflow layer. A workflow role file such as
`~/.pi/agent/pi-extensible-workflows/roles/scout.md` can say `model: scout-model`
and it resolves, because the workflow executor resolves role `model:` values
through `modelAliases` at launch (see `docs/llm.md` lines 103 to 109 in the
`pi-extensible-workflows` package, and `resolveModelReference()` in
`packages/core/src/utils.ts`).

The SDD layer does not read that map. `agents-config.ts` parses a `model:` value
with `parseModelRef()`, which only splits `provider/model` on the first slash
(lines 153 to 162). A bare `scout-model` becomes the model id `scout-model` with
no provider, and the agent fails to launch. If you want an alias in the SDD
layer, name the concrete `provider/model` in `subagents.json`.

The reverse also holds: a `model_profiles` entry does not steer workflow role
agents, because those are launched by the workflow package, not by gentle-pi.

### Copy-paste examples

**Change one SDD agent's model and effort.** Project file `.pi/subagents.json`
wins per field, so this overrides only `sdd-init` and leaves the rest alone:

```json
{
  "model_profiles": {
    "sdd-init": { "model": "mygateway/my-coder", "effort": "high" }
  }
}
```

The same entry in `~/.pi/agent/subagents.json` makes it global. A profile
accepts `effort` or `thinking`. It does **not** read `thinking_level`; only
top-level defaults and agent frontmatter accept that spelling.

**Change one workflow role's model.** Edit the role frontmatter in
`~/.pi/agent/pi-extensible-workflows/roles/scout.md`:

```yaml
---
model: mygateway/my-coder:medium
tools: ["!*", read, find, bash]
---
```

Or override per call inside a workflow with `agent(prompt, { role: "scout",
model: "mygateway/my-coder:medium" })`. A call-level value wins over the role
file.

**Change the global default for the interactive session.** In
`~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "mygateway",
  "defaultModel": "my-coder",
  "defaultThinkingLevel": "medium",
  "modelThinkingLevels": { "mygateway/my-coder": "high" },
  "enabledModels": ["my-coder", "deepseek-*"]
}
```

`enabledModels` takes model patterns and controls what Ctrl+P cycles through
(`docs/settings.md` line 262). `modelThinkingLevels` keys are
`provider/modelId` and only affect the startup level for that model
(`docs/settings.md` line 33).

**Put everything on your own gateway.** Four config edits, then verify.

1. Declare the provider in `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "mygateway": {
      "baseUrl": "https://gateway.example.com/v1",
      "api": "openai-completions",
      "apiKey": "$MY_GATEWAY_KEY",
      "models": [
        {
          "id": "my-coder",
          "name": "My Coder",
          "reasoning": true,
          "thinkingLevelMap": {
            "minimal": null,
            "low": "low",
            "medium": "medium",
            "high": "high",
            "xhigh": null,
            "max": null
          },
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 32000,
          "cost": { "input": 0.5, "output": 1.5, "cacheRead": 0.05, "cacheWrite": 0.6 }
        }
      ]
    }
  }
}
```

2. Point the session defaults at it (the `settings.json` example above).

3. Point the SDD layer at it in `~/.pi/agent/subagents.json`:

```json
{
  "default_model": "mygateway/my-coder",
  "default_effort": "medium",
  "model_profiles": {}
}
```

4. If you use workflow roles, repoint the aliases in
`~/.pi/agent/pi-extensible-workflows/settings.json`:

```json
{
  "modelAliases": {
    "cheap-model": "mygateway/my-coder:low",
    "developer-model": "cheap-model:high",
    "reviewer-model": "mygateway/reviewer:high"
  }
}
```

5. Verify the catalog before trusting any of it:

```bash
pi --list-models "my-coder"
```

`pi --list-models` prints provider, model, context, max-out, thinking, and
images for every model Pi considers available. If your model is absent, the
provider is unreachable or unauthenticated and every alias that points at it
fails at launch, not at config load.

Alias rules, from `docs/llm.md` line 107: names are case-sensitive and must
match `[A-Za-z][A-Za-z0-9_-]*`; a value is a concrete `provider/model` or
another alias, optionally with `:thinking`; unknown targets and cycles fail
before execution; an alias's own suffix overrides the target's suffix. Chaining
is supported. `developer-model` above resolves to `my-coder:high`.

### What raising the thinking level buys, and what it costs

Pi thinking levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.

Raising the level makes the model spend more reasoning tokens before it answers.
Those tokens are billed at the model's output rate. Verified against a real
session record on this machine: one `claude-opus-4-8` message recorded
`output: 233`, `reasoning: 75`, and `cost.output: 0.005825`, which is exactly
`233 * $25 / 1e6`. The 75 reasoning tokens are inside the 233 billed output
tokens. The same record shows `cacheWrite: 34965` and `cost.cacheWrite:
0.21853125` = `34965 * $6.25 / 1e6`.

What it buys is accuracy on hard, multi-step work, with sharply diminishing
returns. Terminal-Bench 4.0 ran the same agent (Codex) against the same model
(GPT-6 Astra) at five effort levels, 330 trials each (read 2026-09-13 from
https://www.tbench.ai/leaderboard):

| Effort | Accuracy | Total cost (330 trials) | Cost per trial | Cost per success | Avg trial |
|---|---|---|---|---|---|
| low | 50.61% | $1,557.30 | $4.72 | $9.32 | 1684 s |
| medium | 54.24% | $1,914.80 | $5.80 | $10.70 | 1886 s |
| high | 57.88% | $2,269.42 | $6.88 | $11.88 | 2114 s |
| xhigh | 57.88% | $2,350.51 | $7.12 | $12.31 | 2209 s |
| max | 58.18% | $3,267.18 | $9.90 | $17.02 | 2796 s |

Read that as a curve: low to high adds 7.27 points of accuracy for 46 percent
more cost per trial. high to max adds 0.30 points for 44 percent more cost per
trial and 32 percent more wall clock. The cost knee is around medium to high.
Effort above `high` is for genuinely long-horizon work, not for routine edits.

Two caveats that bite in practice:

- `thinkingLevelMap` on a model declares which levels it supports. A `null`
  entry means the level is hidden or clamped away (`docs/models.md` lines 261
  to 298). The `tuxevil-rotator` Gemini models in this repository encode the
  effort in the model id itself (`gemini-3.8-flash-low`, `-medium`, `-high`),
  so on that provider you pick the variant and cannot also pick a level.
- gentle-pi's validator knows only `off` through `xhigh`
  (`THINKING_LEVEL` in `agents-config.ts` lines 16 to 23). It has no `max`.
  `effort: "max"` in `subagents.json` is silently dropped to no override, and
  `thinking: max` in agent frontmatter is treated as invalid and can stop that
  agent from loading. Use `xhigh` there, or `max` only in Pi-native settings
  and `/thinking`.
- The OpenCode Go DeepSeek models do not expose `xhigh`: `deepseek-v4.1-flash` and
  `deepseek-v4-pro` list `high` and `max`, `deepseek-v4-flash` also lists `low`. Pi
  resolves a request for a level the model does not expose to the model's top level, so
  `:xhigh` and `:max` reach the provider as the same effort (verified: the session
  record says `thinking: max` for a `:xhigh` request). Write `max` in Pi-native places
  (`settings.json`, `modes.json`, `--model`, workflow aliases) rather than adding a
  `modelOverrides` entry that maps `xhigh` to `max`: that would give one provider value
  two labels and leave the next reader guessing which one is real. The `xhigh` token
  above stays necessary only in the gentle-pi layer, where it is the highest accepted
  level and the clamp is the intended mechanism.

### OpenCode Go: what each model actually accepts (verified 2026-09-13)

Method: every request ran on the OpenCode Go subscription (the same call without
`auth.json` stops with `Use /login to log into a provider`), and the outgoing payload was
read through a `before_provider_request` hook, so the table reports what Pi **sent**, not
what the catalog promises. Pi's rule for a level a model does not expose is the nearest
exposed level above it, otherwise the model's top level. No row returned an error except
where noted.

| Group | Models | What reaches the provider |
|---|---|---|
| Full ladder | `gpt-5.6-luna` | `low`, `medium`, `high`, `xhigh`, `max`, each sent unchanged |
| Effort: high + max | `deepseek-v4.1-flash`, `deepseek-v4-pro`, `glm-5.2` | `high`, `max`; `minimal`/`low`/`medium` land on `high`, `xhigh` on `max` |
| Effort: low + high + max | `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`, `glm-5.3`, `glm-5.3-flash` | `low`, `high`, `max` |
| Effort: top is xhigh | `grok-4.6`, `muse-spark-1.2-contributor`, `muse-spark-1.3-contributor` | `low` .. `xhigh` (`grok-4.6` also `medium`); `max` clamps down to `xhigh` |
| Effort: xhigh unmapped | `qwen3.8-max` | `low`, `medium`, `xhigh`; `high` clamps **up** to `xhigh` |
| Effort: high only | `hy3`, `hy4-preview` | `off` sends `none`, plus `low`, `high`; `max` clamps down to `high` |
| Effort: max only | `kimi-k3` | `max`; `high` clamps up to `max` |
| Default ladder | `glm-5.1`, `kimi-k2.7-code`, `longcat-2.0`, `mimo-v2.5`, `mimo-v2.5-pro`, `qwen3.6-plus`, `qwen3.7-max`, `qwen3.7-plus` | `off` .. `high`; `max` clamps **down** to `high` |
| Thinking budget, no effort value | `minimax-m3`, `qwen3.8-flash` | `thinking: {enabled, 16384 tokens}` for every level; the chosen level changes nothing on the wire |
| Thinking on/off only | `kimi-k2.6`, `minimax-m2.7` | `thinking: {type: enabled}`; `minimax-m2.7` answered `500 Internal server error` on this run |

Consequences for this repository: `:max` is the real top level of the DeepSeek pair, and
`xhigh` is a level of its own only on `gpt-5.6-luna`, `grok-4.6`, `muse-spark-*` and
`qwen3.8-max`. Everywhere else `xhigh` is a request Pi resolves to another value, which is
why `max` is written in the configuration. Levels inside a group that the rule derives
(for example `minimal` on `deepseek-v4-flash`) are not measured one by one; every group's
boundary value was.

### Troubleshooting

**An agent fails to launch and names a model you never configured.** A
frontmatter `model:` that left the catalog. Real case in this repository:
`~/.pi/agent/agents/sdd-init.md` pinned `openai-codex/gpt-5.3-codex`. The
catalog has only `gpt-5.3-codex-spark`:

```bash
pi --list-models "gpt-5.3"
# provider      model                context  max-out  thinking  images
# openai-codex  gpt-5.3-codex-spark  128K     128K     yes       no
```

The phase could never start. The fix is a `model_profiles` entry in
`subagents.json`, not editing `agents/sdd-init.md`, because the agent files are
managed assets: they are hash-tracked and restored on update, so an edit there
comes back.

**An alias works in a workflow but not in SDD.** That is the trap above. The
workflow resolver and the SDD resolver are different code paths.

**Every alias pointing at one provider fails at once.** The provider is not
running. The `tuxevil-rotator` aliases point at `http://localhost:51200/v1`. On
2026-09-13 that gateway was down:

```bash
curl -sS -m 6 http://localhost:51200/v1/models -H 'Authorization: Bearer tuxevil'
# curl: (7) Failed to connect to localhost:51200
```

The failure surfaces as a launch error per agent, not as a startup warning, so
it looks like a model problem when it is a process problem. Start the gateway
before blaming the alias. The same applies to any local proxy or rotator.

Since 2026-09-13 two things start that gateway for you, so a down gateway is
now the exception: `setup-ai`'s `rotator` module starts it in the background (and
registers a `systemd --user` unit or a logon scheduled task), and the
`rotator-autostart` Pi extension in `pi/agent/extensions/` starts it on session
start when the port is dead. Concurrent sessions coordinate through one start
claim, so opening several Pi instances produces one start, not one per session.
A start that never comes up is reported once per session with a warning naming
`~/.tuxevil-rotator/gateway.log`, which is where the detached process writes; when
systemd owns the gateway, its output is in `journalctl --user -u tuxevil-rotator`.
Login is still yours: without an account the gateway listens but has nothing to
route, so run `tuxevil-rotator login` once.

**An alias resolves to a real model but the provider still rejects it.** The
target can be in the catalog and still be unusable at the provider. On this
machine `reviewer-model` resolves to `anthropic/claude-fable-5-1:high` and that
model is in the catalog, but the provider rejects the request behind a Claude
Code version gate. Reported on this machine; I did not reproduce the rejection
here, so treat the cause as **UNVERIFIED** and the symptom as real.

**`allowScripts` approvals drift after an update.** Pi's npm root pins
`allowScripts` per package version. Updating a package re-blocks its install
scripts, and approving again does not re-run the postinstall that already
happened; a rebuild is required. When a package's tools stop appearing after an
update, check this before editing model config.

### Aliases currently configured in this repository

From `pi-extensible-workflows/settings.json`, with status checked on this machine
on 2026-09-13.

| Alias | Target | Status |
|---|---|---|
| `cheap-model` | `openai-codex/gpt-5.6-luna:high` | Works |
| `developer-model` | `cheap-model:xhigh` | Works (resolves to luna:xhigh) |
| `oracle-model` | `cheap-model:xhigh` | Works |
| `researcher-model` | `cheap-model:xhigh` | Works |
| `scout-model` | `cheap-model` | Works |
| `tests-expert` | `cheap-model` | Works |
| `reviewer-model` | `anthropic/claude-fable-5-1:high` | Target exists; provider rejects it here (Claude Code version gate). **UNVERIFIED** cause |
| `old-reviewer-model` | `xai/grok-4.5:high` | Unusable here: no `xai` provider or credential is configured, and `grok-4.5` is not in the catalog (only `opencode-go/grok-4.6`) |
| `gemini-flash-low|medium|high` | `tuxevil-rotator/gemini-3.8-flash-*` | Unusable while the local gateway is down (verified down 2026-09-13) |
| `gemini-pro-low|high` | `tuxevil-rotator/gemini-3.1-pro-*` | Same |
| `opencode-fast` | `opencode-go/deepseek-v4.1-flash:low` | Works |
| `opencode-balanced` | `opencode-go/deepseek-v4.1-flash:high` | Works |
| `opencode-deep` | `opencode-go/deepseek-v4-pro:xhigh` | Works |

The workflow package also ships dynamic aliases with these names
(`docs/llm.md` line 19). Static entries in `settings.json` shadow the dynamic
ones, which is why this repository's versions win.

---

## Part 2: choosing by metrics

The goal is cost per completed task, not cost per token. A model that looks cheap
per token can cost more per finished unit of work because it takes more turns,
runs longer, and gets it wrong more often.

### 2.1 Cost: what a token actually costs

Prices are per million tokens. There are four rates, not two: input, output,
cache read, and cache write. On long agent sessions the cache rates dominate,
because every turn re-sends the growing conversation and most of it is cached.

What Pi will bill you is the `cost` block of the model entry it loaded. These are
from Pi's own cached catalogs in `~/.pi/agent/models-store.json` (catalog
`checkedAt` 2026-09-13), in USD per million tokens:

| Pi provider / model | input | output | cache read | cache write |
|---|---|---|---|---|
| `openai-codex/gpt-5.6-luna` (built-in) | 0.20 | 1.20 | 0.02 | 0.25 |
| `openai-codex/gpt-5.6-luna` (this repo's `models.json` override) | 1.00 | 6.00 | 0.10 | 1.25 |
| `openai-codex/gpt-5.6-terra` | 2.00 | 12.00 | 0.20 | 2.50 |
| `openai-codex/gpt-5.6-sol` | 5.00 | 30.00 | 0.50 | 6.25 |
| `openai-codex/gpt-5.3-codex-spark` | 1.75 | 14.00 | 0.175 | 0 |
| `anthropic/claude-fable-5` | 10.00 | 50.00 | 1.00 | 12.50 |
| `anthropic/claude-fable-5-1` | 10.00 | 50.00 | 0.25 | 12.50 |
| `opencode-go/deepseek-v4.1-flash` | 0.15 | 0.60 | 0.003 | 0 |
| `opencode-go/deepseek-v4-pro` | 0.66 | 1.98 | 0.022 | 0 |
| `opencode-go/glm-5.3` | 1.40 | 4.40 | 0.26 | 0 |
| `opencode-go/grok-4.6` | 2.00 | 6.00 | 0.50 | 0 |
| `tuxevil-rotator/gemini-*` | 0 | 0 | 0 | 0 |

Two things to take from that table.

First, **a model id is not a price**. `gpt-5.6-luna` costs $0.20/$1.20 in Pi's
Codex catalog and $1.00/$6.00 after this repository's `models.json` override,
which is a 5x change in what your session accounting reports. `models.json`
custom entries replace a built-in model entry with the same id (Pi
`docs/models.md`, "Merge semantics"). If your `cost` block disagrees with your
provider's pricing page, your measured costs are wrong even though your token
counts are right.

Second, **the gateway models record $0**. The `tuxevil-rotator` entries in
`models.json` declare no `cost` block, so Pi defaults every rate to zero and the
session accounting is free money that never existed. If you route through a
gateway and want honest cost numbers, fill in the `cost` block from the
gateway's own rates, or read the gateway's metering.

For a public cross-check, OpenRouter publishes live per-endpoint pricing. Same
model ids, first-party endpoint, USD per million (read 2026-09-13 from
`https://openrouter.ai/api/v1/models/<author>/<slug>/endpoints`):

| Model id | input | output | cache read | cache write |
|---|---|---|---|---|
| `openai/gpt-5.6-luna` (OpenAI flex) | 0.10 | 0.60 | 0.01 | 0.125 |
| `openai/gpt-5.6-terra` (OpenAI flex) | 1.00 | 6.00 | 0.10 | 1.25 |
| `openai/gpt-5.6-sol` (OpenAI flex) | 1.00 | 5.00 | 0.10 | 1.25 |
| `deepseek/deepseek-v4.1-flash` (DeepSeek) | 0.15 | 0.60 | 0.003 | n/a |
| `anthropic/claude-fable-5.1` (Anthropic) | 10.00 | 50.00 | 0.25 | 12.50 |
| `x-ai/grok-4.5` (xAI) | 2.00 | 6.00 | 0.30 | n/a |
| `google/gemini-3.8-flash` (Google) | 0.75 | 3.75 | 0.075 | 0.042 |

The same OpenRouter model page (`https://openrouter.ai/openai/gpt-5.6-luna`)
shows the OpenAI flex endpoint at 0.10/0.60, an Azure endpoint at 0.20/1.20, and
an OpenAI `fast` endpoint at 0.40/2.40. Pi's Codex catalog value of 0.20/1.20
matches the Azure row. Pick the endpoint you actually use; do not compare a
flex price against a standard price.

Prices change. Treat every figure above as "read on 2026-09-13" and re-check
before you make a decision worth real money.

### 2.2 Why cache read and cache write dominate

Cache-read is typically 5 to 20 percent of the input rate, and in an agent loop
the cached input is most of every request. Terminal-Bench reports the actual
token counts. For one model, GPT-5.6 Luna, over 330 trials (read 2026-09-13 from
https://www.tbench.ai/leaderboard):

- cached input: 11,305,212,851 tokens
- uncached input: 11,496,180,968 tokens
- output: 61,282,672 tokens

Cached and uncached input are nearly equal, and both dwarf output by roughly
190x. At Pi's catalog rate for luna (0.02 cached vs 0.20 uncached per million),
the cached half of that input costs about 1/10th of what it would uncached.
If a provider does not cache, or your prompt changes every turn so nothing hits
the cache, your effective input price is not the headline input price.

SWE-rebench reports the cached share directly per model, and it runs 84.7 to
97.0 percent on every entry I read (read 2026-09-13 from
https://swe-rebench.com/):

| Model | Cached share | Cost per problem | Resolved rate |
|---|---|---|---|
| GPT-5.6 Sol [medium] | 84.7% | $0.85 | 62.3% |
| GPT-5.6 Luna [medium] | 85.2% | $0.11 | 43.6% |
| MiniMax M3 | 97.0% | $0.95 | 47.2% |
| Opus 5 [high] | 95.7% | $3.47 | 63.4% |
| Fable 5 [high] | 94.9% | $4.40 | 64.5% |

Practical consequences:

- Cache writes cost more than cache reads. A cache write rate is usually
  around or above the input rate. Long system prompts, large skills, and big
  context files are written once per session and read many times, which is
  exactly when caching pays.
- Switching models mid-session invalidates the cache. Pi detects this and
  prints a "Cache miss after model switch" notice when `showCacheMissNotices` is
  on. That notice is a bill, not a warning.
- Going idle past the provider's cache TTL re-bills the prefix. Pi prints
  "Cache miss after Nm idle" for the same reason.

### 2.3 Why a cheaper model can cost more per completed task

Cost per task is `price x tokens`, but cost per **completed** task is
`price x tokens / success rate`, and success rate moves a lot between models.

Terminal-Bench 4.0, 330 trials each, same harness where noted (read 2026-09-13
from https://www.tbench.ai/leaderboard). "Cost per success" is total cost
divided by the number of successful trials:

| Agent | Model | Accuracy | Cost/trial | Cost/success |
|---|---|---|---|---|
| Codex | GPT-5.6 Luna (max) | 17.27% | $1.05 | $6.08 |
| Codex | GPT-5.6 Terra (max) | 21.52% | $5.25 | $24.41 |
| Codex | GPT-5.6 Sol (max) | 37.27% | $7.70 | $20.67 |
| Claude Code | Fable 5.1 (max) | 57.88% | $18.92 | $32.69 |
| Claude Code | Fable 5 (max) | 44.55% | $22.02 | $49.42 |
| Claude Code | Opus 5 (max) | 51.82% | $18.09 | $34.91 |
| Claude Code | Opus 4.8 (max) | 23.64% | $19.64 | $83.08 |
| Claude Code | Sonnet 5 (max) | 12.42% | $29.10 | $234.32 |
| Claude Code | GLM-5.3 (max) | 41.82% | $8.27 | $19.76 |
| mini-SWE-agent | Gemini 3.8 Flash (high) | 19.09% | $5.54 | $29.03 |

Terra is cheaper per trial than Sol ($5.25 vs $7.70) and more expensive per
success ($24.41 vs $20.67). Sonnet 5 is the most expensive per trial and by far
the most expensive per success, because it resolves 12.42 percent. Fable 5.1 is
both cheaper and better than Fable 5, which is what a version bump should look
like. Luna is cheap per success on this benchmark because its accuracy, while
low, is not low enough to erase its price advantage.

SWE-rebench shows the same shape, computed the same way:

| Model | Resolved rate | Pass@5 | Cost/problem | Cost/success |
|---|---|---|---|---|
| GPT-5.6 Sol [medium] | 62.3% | 79.3% | $0.85 | $1.36 |
| GLM-5.2 [high] | 62.9% | 81.1% | $1.40 | $2.23 |
| Grok 4.5 [high] | 63.8% | 77.5% | $1.47 | $2.30 |
| GPT-5.6 Luna [medium] | 43.6% | 59.5% | $0.11 | $0.25 |
| DeepSeek-V4 Pro [high] | 40.2% | 64.0% | $0.15 | $0.37 |
| MiniMax M3 | 47.2% | 69.4% | $0.95 | $2.01 |
| Sonnet 5 [high] | 56.8% | 74.8% | $1.43 | $2.52 |
| Opus 5 [high] | 63.4% | 74.8% | $3.47 | $5.47 |
| Fable 5 [high] | 64.5% | 78.4% | $4.40 | $6.82 |

These two leaderboards disagree about which model is cheapest per success
because they measure different task distributions and different harnesses.
That is the point: neither number is your number. Use them to pick a shortlist,
then measure on your own work.

One more caveat before you trust any leaderboard ranking: the same model appears
under different agents. On Terminal-Bench, `GPT-5.6 Sol` scores 37.27 percent
under Codex and `Gemini 3.8 Flash` scores 19.09 percent under mini-SWE-agent.
The harness and the tool loop are part of the result.

### 2.4 Speed: what to measure

Throughput and latency are different things, and the one that matters for an
agent is neither exactly.

- Output speed: output tokens per second after the first token.
- Time to first token (TTFT): seconds until anything appears. For reasoning
  models this is the first reasoning token.
- Task latency: wall-clock seconds to finish one task, including every turn,
  tool call, retry, and reasoning token.

Artificial Analysis defines output speed and TTFT these ways on its methodology
page (https://artificialanalysis.ai/methodology, read 2026-09-13). OpenRouter
shows per-provider "Throughput ... tok/s P50, best across providers", latency,
and TTFT on each model page. For `openai/gpt-5.6-luna` it reports 133 tok/s P50
(read 2026-09-13 from https://openrouter.ai/openai/gpt-5.6-luna).

Task latency is the number a human feels, and a fast model can lose it. On
Terminal-Bench, GPT-5.6 Luna averaged 4088 seconds per trial while GPT-5.6 Sol
averaged 2388 seconds, even though Luna is the cheaper and higher-throughput
model. Luna took more turns and more tokens to reach a worse answer. A model
that writes quickly and reasons badly is not fast.

Where to get comparable speed numbers:

- Artificial Analysis, https://artificialanalysis.ai/leaderboards/models:
  output speed, TTFT, total response time, and price, per model and provider.
- OpenRouter model pages, for example
  https://openrouter.ai/openai/gpt-5.6-luna: P50 throughput, latency, TTFT, and
  uptime per serving provider.
- Terminal-Bench, https://www.tbench.ai/leaderboard: average trial duration
  alongside accuracy and total cost, which lets you compute speed per solved
  task rather than per token.
- Provider status pages, for uptime. OpenRouter's endpoint API also exposes
  `uptime_last_1d` per provider; the same model varied from 47 percent to 100
  percent uptime across providers depending on the endpoint.

### 2.5 Quality: which benchmarks matter for agentic coding

Relevant to an agent that reads a repo, edits files, runs commands, and has to
finish:

| Benchmark | What it measures | Why it is relevant |
|---|---|---|
| Terminal-Bench 4.0, https://www.tbench.ai/leaderboard | End-to-end terminal tasks solved by an agent | Closest public proxy for an agent loop: it reports accuracy, token mix, cost, and trial duration together |
| SWE-rebench, https://swe-rebench.com/ | Resolve rate on real GitHub issues, continuously refreshed | Reports Resolved Rate, Pass@5, Cost per Problem, and Tokens per Problem, including cached share |
| SWE-bench, https://www.swebench.com/ | Resolve rate on Python issue fixing | Long-standing reference, but check the date; the copy I read on 2026-09-13 still led with Claude 3.7 era results, so it is not the live frontier source |
| SWE-bench Pro (Scale), https://scale.com/leaderboard/swe_bench_pro_public | Harder multi-language issue fixing | Reports how hard the task set is: "top models score around 23% on the SWE-Bench Pro public set, compared to 70%+ on SWE-Bench Verified" (read 2026-09-13) |
| METR time-horizon work, https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/ | Length of task an agent can complete at a given reliability | Directly relevant to how much thinking effort and how much supervision a task needs |
| tau-bench / tau2-bench, https://www.tau-bench.com/ and https://github.com/sierra-research/tau2-bench | Tool use against a simulated user | Relevant to tool-call correctness, less so to code edits |

Misleading for agentic coding work:

- Human-preference chat arenas such as LMArena,
  https://lmarena.ai/leaderboard. They rank single-turn conversational
  preference, not multi-turn repo work. A model can be beloved in chat and
  unable to hold a 30-turn edit loop.
- Synthetic single-function code generation such as LiveCodeBench,
  https://livecodebench.github.io/, and the code contests inside LiveBench,
  https://livebench.ai/. A model that writes a correct function in one shot is
  not thereby able to find the right file, read the surrounding contract, edit
  without breaking callers, and run the test. Easy one-shot benchmarks also
  saturate, which hides differences that matter.
- Edit-format benchmarks such as the Aider polyglot leaderboard,
  https://aider.chat/docs/leaderboards/. Useful for "can it produce a valid
  diff", which is a real failure mode, but it holds the context, tools, and
  plan fixed by design, so it does not measure the agent loop.
- Any leaderboard whose top entry is stale. SWE-bench Verified fell into this:
  the public page I read still referenced 2024-era systems while the models in
  Pi's catalog are a different generation.
- Mixing agents with models. If two rows on one leaderboard were produced by
  different harnesses, the ranking compares harnesses as much as models.

Also useful context: Epoch AI's benchmarking dashboard,
https://epoch.ai/data/ai-benchmarking-dashboard, aggregates many
capability benchmarks across labs and is a good index for what exists and which
of them have saturated. OpenRouter's rankings,
https://openrouter.ai/rankings, show what people actually route through that
gateway by token volume, which is a weak but real popularity signal.

### 2.6 Workload to effort and tier

This table is a starting policy derived from the effort sweep in section 1 and
the cost-per-success tables above. Adjust it with your own measurements from
section 2.7.

| Workload | Effort | Model tier | Reasoning |
|---|---|---|---|
| Mechanical edits (rename, apply a given diff, format) | `off` or `minimal` | Cheapest that follows instructions | The plan is already decided. Extra reasoning tokens add cost without changing the output. Use a small model and cache-heavy context |
| Mechanical summarization | `off` or `minimal` | Cheapest, large cache window | Compression, not reasoning. Cost is dominated by cache reads and input size, so prefer the cheapest input/cache-read rate with a large enough context |
| Structured writing (specs, docs, PR descriptions) | `medium` | Mid tier | The cost knee for effort is around medium to high. Language quality and instruction adherence matter more than long chains of thought |
| Architecture decisions | `high` or `xhigh` | High tier, strong provider | The expensive mistake is the decision, not the tokens. Stop at high or xhigh: the sweep shows high to max adds 0.30 points for 44 percent more cost per trial |
| Adversarial review | `high` | High tier, different provider from the author | Use a different model family than the one that wrote the change so the reviewer does not share its blind spots. Fable 5.1 leads both Terminal-Bench (57.88%) and SWE-rebench (64.5%) but costs $32.69 and $6.82 per success, which is worth it when the diff is expensive to get wrong |
| Long-horizon autonomous work (many turns, many tools) | `high` to `max` | Strong tier, watch the clock | This is the only case that justifies the top of the effort range. Budget for the wall clock: top entries on Terminal-Bench averaged 3900 to 6500 seconds per trial |

### 2.7 Measure on your own machine

Benchmarks narrow the field. Your tasks decide. Pi already records everything
you need; you just have to read it.

**What to record per task.** Fix one row per task run:

| Field | Where it comes from |
|---|---|
| Task id and one-line description | You |
| Provider and model | `message.provider`, `message.model` in the session file; `setup.model` in a subagent run |
| Thinking level | `setup.model.thinking` in a subagent run; the footer or `/session` in the interactive session |
| Input tokens | `usage.input` |
| Output tokens (includes reasoning) | `usage.output` |
| Cache read tokens | `usage.cacheRead` |
| Cache write tokens | `usage.cacheWrite` |
| Cost | `usage.cost.total` |
| Wall clock | Run start to finish, or `avg_trial_duration_sec`-style timing you keep yourself |
| Outcome | Merged / needed one fix / needed rewrite / failed. This is the divisor that turns cost into cost per success |
| Turns or tool calls | Session transcript length, or the subagent attempt tool-call count |

**Where Pi records it.** Every assistant message in a session file under
`~/.pi/agent/sessions/**.jsonl` carries a `usage` object. A real record from this
machine:

```json
{"input":2,"output":233,"cacheRead":0,"cacheWrite":34965,"totalTokens":35200,
 "cost":{"input":0.00001,"output":0.005825,"cacheRead":0,
         "cacheWrite":0.21853125,"total":0.22436625000000002},"reasoning":75}
```

The formula Pi applies is `input*rate_in + output*rate_out + cacheRead*rate_read
+ cacheWrite*rate_write`, all per million, using the model entry's `cost` block.

**Aggregate across sessions** with the script in this repository:

```bash
node ~/.pi/agent/bin/session-stats.mjs 2026-09-13T00:00:00Z 2026-09-14T00:00:00Z
```

It prints a "By provider" and a "By model" table with sessions, usage records,
input, output, cached input, and spend in USD. It also reports how many records
were missing cost data, which is how you catch a gateway model declared with no
`cost` block.

**Per-subagent accounting** lives in `~/.pi/agent/subagents/<runId>/status.json`.
Each attempt carries `accounting: { input, output, cacheRead, cacheWrite, cost }`
and `setup.model: { provider, model, thinking }`. That is the exact pairing you
need to compare two candidates on the same task:

```bash
node -e '
const s=require(process.argv[1]);
for(const a of s.attemptDetails)
  console.log(s.setup?.model ?? "?", JSON.stringify(a.accounting));
' ~/.pi/agent/subagents/<runId>/status.json
```

**Per-workflow accounting** lives in the run directory under
`~/.pi/workflows/projects/<project>/sessions/<sessionId>/runs/<runId>/`. The
`summary.json` file exposes `usage` (`tokens`, `costUsd`, `durationMs`,
`agentLaunches`) and one entry per agent with its attempts. The full agent
record and per-attempt cost use the `AgentAccounting` shape
(`input`, `output`, `cacheRead`, `cacheWrite`, `cost`).

### 2.8 How to run a fair comparison

1. Fix the task set. Same prompts, same starting commit, same tools, same
   skills, same context files. If the only variable is the model, you can
   attribute the difference.
2. Run at least 10 tasks per candidate, 20 or more if you can afford it. Below
   that you are measuring luck.
3. Run each candidate in a fresh session. Switching models mid-session
   invalidates the prompt cache and re-bills the prefix, which corrupts the
   cost comparison.
4. Compute cost per success, not cost per token:
   `sum(cost over all runs) / count(successful runs)`. Report it next to the
   success rate; either number alone is misleading.
5. Alternate the order (A then B, then B then A) and shuffle tasks. Cache warmth,
   provider load, and time of day all move the numbers.
6. Report the median and the spread, not just the mean. One outlier can dominate
   a ten-run average.
7. Keep the outcome bar constant. "Merged without further edits by a human" is a
   different bar from "produced a plausible diff". Pick one and apply it to both
   candidates.

**The lucky-run trap.** Terminal-Bench ran 330 trials per entry and still
reports 95 percent confidence intervals of roughly 0.6 to 3.8 points on the
accuracy figures above. A single 5-task comparison has an interval many times
wider than the differences most people are trying to detect. If candidate A wins
one task and candidate B wins the next, you have learned nothing. Decide from
the aggregate, and treat any difference smaller than a few points as unresolved
until you have more runs.

**Reading the result.** The useful comparison is rarely "which model is
smartest". It is a point on a curve: for this task mix, which model and effort
gives the lowest cost per success inside my wall-clock budget. A mid-tier model
at `medium` frequently beats a top-tier model at `max` on that metric, and the
effort sweep in section 1 is the clearest evidence for it.

---

## Sources cited

Mechanism claims were checked against these files on 2026-09-13:

- `~/.pi/agent/settings.json`, `~/.pi/agent/models.json`,
  `~/.pi/agent/pi-extensible-workflows/settings.json`,
  `~/.pi/agent/subagents.json`, `~/.pi/agent/modes.json`
- `~/.pi/agent/models-store.json` (Pi's cached provider catalogs, `checkedAt`
  2026-09-13)
- `~/.pi/agent/npm/node_modules/gentle-pi/lib/agents-config.ts`
- `~/.pi/agent/agents/sdd-init.md`, `~/.pi/agent/pi-extensible-workflows/roles/*.md`
- `~/.pi/agent/sessions/*.jsonl` (real usage record),
  `~/.pi/agent/subagents/<runId>/status.json`
- `pi-extensible-workflows` package: `docs/llm.md`,
  `packages/core/src/utils.ts`, `packages/core/src/types.ts`,
  `packages/core/src/store.ts`, `packages/core/src/validation.ts`,
  `packages/core/src/validation.ts` (workflow settings paths)
- Pi package docs:
  `node_modules/@earendil-works/pi-coding-agent/docs/models.md`,
  `docs/settings.md`, `docs/usage.md`

Web sources, all read 2026-09-13:

- https://www.tbench.ai/leaderboard (Terminal-Bench 4.0)
- https://swe-rebench.com/ (SWE-rebench)
- https://scale.com/leaderboard/swe_bench_pro_public (SWE-bench Pro)
- https://www.swebench.com/ (SWE-bench)
- https://artificialanalysis.ai/leaderboards/models and
  https://artificialanalysis.ai/methodology (Artificial Analysis)
- https://openrouter.ai/api/v1/models and
  https://openrouter.ai/api/v1/models/<author>/<slug>/endpoints (OpenRouter
  pricing), https://openrouter.ai/openai/gpt-5.6-luna (throughput and latency),
  https://openrouter.ai/rankings (token-volume ranking)
- https://lmarena.ai/leaderboard (LMArena)
- https://livebench.ai/ (LiveBench)
- https://livecodebench.github.io/ (LiveCodeBench)
- https://epoch.ai/data/ai-benchmarking-dashboard (Epoch AI)
- https://aider.chat/docs/leaderboards/ (Aider polyglot)
- https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/
  (METR)
- https://www.tau-bench.com/ and https://github.com/sierra-research/tau2-bench
  (tau-bench)

## Claims marked UNVERIFIED

1. `reviewer-model` failing due to a Claude Code version gate. The target
   `anthropic/claude-fable-5-1` is in the catalog; I did not run the alias, so
   the provider-side cause is reported, not reproduced.
2. `old-reviewer-model` -> `xai/grok-4.5:high`. I verified there is no `xai`
   provider or credential on this machine and that `grok-4.5` is absent from the
   catalog, but I did not execute the alias.
3. That the `models.json` cost override for `openai-codex/gpt-5.6-luna` changes
   recorded cost at runtime. The two files disagree (0.20/1.20 versus
   1.00/6.00) and the documented merge semantics say the custom entry replaces
   the built-in, but I did not make a billed call to confirm which value Pi
   applies.
4. Whether gentle-pi rejects `effort: "max"` at runtime. Verified by reading
   `agents-config.ts` (its `THINKING_LEVEL` list stops at `xhigh`); not exercised
   with a live run.
5. Artificial Analysis intelligence-index scores and any per-model speed figure
   other than the OpenRouter 133 tok/s P50 for `openai/gpt-5.6-luna`. Its data
   API requires a key, so I cite the site as a source rather than quote numbers I
   could not read.
