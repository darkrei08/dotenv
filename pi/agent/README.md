# Pi configuration

The parent repository's `setup_env.sh` selectively rsyncs managed files into
`~/.pi/agent` and preserves runtime state such as credentials, sessions, and
installed packages. It does not replace the live directory with a symlink.

The module-owned package entries in `settings.json` (`pi-extensible-workflows`,
`gentle-pi`) are installed and verified by `@darkrei08/setup-ai`'s
`pi-workflows` and `gentle-ai` modules. `npm:gentle-engram` is a plain
`pi-packages.txt` line kept in both files for consistency.

## Model Gateways

### Providers

Use `pi-model-fit` before selecting a route. Check the exact provider/model,
supported thinking levels, authenticated plan and applicable quota separately.
A catalog entry or a native-provider subscription does not prove access through
CLIProxyAPI. When entitlement or quota is unknown, keep the existing route
provisional; do not silently substitute a provider or model. The tables below
describe configured assignments, not verified availability or plan limits.

The role mapping follows `vekexasia/dotenv`. Claude roles go through CLIProxyAPI, while Scout uses OpenCode Go directly:

| Role alias | Resolves to | Used by |
| --- | --- | --- |
| `cheap-model` | `cliproxyapi/claude-sonnet-5-5:medium` | qa, release, sre |
| `scout-model` | `opencode-go/cat-jam-free:medium` | scout |
| `summarizer-model` | `cliproxyapi/claude-haiku-5-5:medium` | summarizer |
| `developer-model` | `cheap-model` | developer |
| `tests-expert` | `cliproxyapi/gpt-6-luna:medium` | tests-expert |
| `researcher-model` | `cliproxyapi/gpt-6-luna:medium` | researcher |
| `reviewer-model`, `oracle-model` | `cliproxyapi/claude-opus-4-6-thinking:medium` | reviewer, oracle, architect, security |

Optional Gemini alternatives are available as explicit aliases, without replacing the
primary role assignments:

| Alternative alias | Model:effort | Intended use |
| --- | --- | --- |
| `gemini-scout-model` | `cliproxyapi/gemini-3.8-flash-high:medium` | fast scouting |
| `gemini-summarizer-model` | `cliproxyapi/gemini-3.5-flash-lite:medium` | low-cost summarization |
| `gemini-researcher-model` | `cliproxyapi/gemini-pro-agent:medium` | long research fallback |
| `gemini-developer-model`, `gemini-tests-model` | `cliproxyapi/gemini-3.8-flash-high:medium` | experimental coding/testing fallback |

Managed role aliases, subagent review profiles, optional modes and GGA use
`medium` effort. This policy changes no provider/model identifiers or role tool
permissions. GGA retains the CLIProxyAPI mirror of the reviewer role
(`.gga` and the `agents/gga-pi/` bridge; see
[`docs/gentle-ai-gga.md`](../../docs/gentle-ai-gga.md)). An unavailable review
model remains a blocker, not permission to bypass the gate or choose another one.

Verify this policy with `node --test tests/medium-effort-policy.test.mjs` and
`bash tests/role-tool-policy.sh` from the repository root. Existing sessions
retain their recorded thinking level: use `/thinking medium` in an idle session
and verify the confirmation before assigning new work. New workflow calls
should specify `:medium` explicitly; changing configuration is not proof that
an already-running agent or review has changed effort.

### CLIProxyAPI

[CLIProxyAPI + CPA Usage Keeper](../../cliproxyapi/README.md) manages OAuth provider accounts and dynamically exposes models to Pi.

- CPA management: `http://127.0.0.1:8317/management.html`
- Keeper dashboard: `http://127.0.0.1:8080`

After authenticating an account in CPA:
- run `/cliproxyapi-refresh` after account or routing changes;
- use `/fast` for priority processing and `/pause` or `/continue` to control requests;
- select a live `cliproxyapi/...` model from `/model` or use the explicit workflow aliases.

Every native alias has a CLIProxyAPI mirror that targets the same model through the gateway:

| Native | CLIProxyAPI |
| --- | --- |
| `native-cheap-model` (Sonnet 5.5 medium) | `cliproxy-cheap-model` → `cliproxyapi/claude-sonnet-5-5:medium` |
| `native-luna` (GPT-6 Luna medium) | `cliproxy-luna` → `cliproxyapi/gpt-6-luna:medium` |
| `native-reviewer-model` (Opus 4.6 medium) | `cliproxy-reviewer-model` → `cliproxyapi/claude-opus-4-6-thinking:medium` |
| `native-sol` (GPT-6.1 Sol medium) | `cliproxy-sol` → `cliproxyapi/gpt-6.1-sol:medium` |
| `native-astra` (GPT-6 Astra medium) | `cliproxy-astra` → `cliproxyapi/gpt-6-astra:medium` |

`check-config.sh` fails when a native alias, an enabled model or a startup thinking
level has no `cliproxyapi` mirror on the same model and effort, so the two routes
cannot drift apart. The mirrors are not guaranteed until the dynamic catalog is authenticated. Pass one
as the per-agent `model` override to run a workflow through CLIProxyAPI. With one
Pro and one Plus account the gateway adds the Keeper usage dashboard, not extra
models, which is why Codex stays on its native login.

The optional Gemini aliases are explicit alternatives, not automatic role replacements.
For automatic quota/capacity fallback, `~/.pi/agent/ha.json` contains `development`,
`scout`, `fast`, `research`, `summary`, and `testing` groups. Select one with
`/ha-group <name> <model-id>...`; the repository template is
`pi/agent/ha-failover.example.json`. The default development chain ends with
`cliproxyapi/gemini-pro-agent` after the existing GPT and Claude entries.

### Gemini

The standalone `tuxevil-rotator` gateway was retired. Gemini models, when wanted, come
through CLIProxyAPI: authenticate a Google account with the `-antigravity-login`
flow in [`cliproxyapi/README.md`](../../cliproxyapi/README.md) and pass the model the
dynamic `cliproxyapi` catalog lists as a per-agent `model` override. Check the catalog
first; the available Gemini IDs depend on the authenticated account. Using such an
account through a proxy may violate the provider's terms of service.

## MCP

Pi's built-in MCP reads `~/.pi/agent/mcp.json` on Pi 0.99.0 and later. Gentle
AI 4.0.0 retires `pi-mcp-adapter` on sync, and an installed adapter replaces
Pi's built-in MCP, so neither `npm:pi-mcp-adapter` nor `-builtin:mcp` belongs
in `settings.json`. Verify the configured servers with:

```bash
pi mcp list
```

Workflow agents inherit Pi's built-in `codemode`, `tool-search`, and `mcp` extensions from `pi/agent/pi-ext-roles/settings.json`. The shared `tool_search` allowance keeps the configured local MCP servers discoverable without preloading every MCP tool into every child session. A workflow call can still narrow this ceiling with an explicit tool allowlist; do not start a child with `!*` unless it also includes `tool_search` when MCP access is intended.

## Credentials and local files

Pi keeps provider credentials under ignored files in `~/.pi/agent/`. This
repository never stores OAuth tokens, API keys, Keeper passwords, or CPA
management keys. The local CPA and Keeper setup is described in
`cliproxyapi/README.md`.

## Context budget and compaction

Pi compacts when the reported context exceeds `contextWindow - reserveTokens`, not at a fixed percentage. With Pi's default `reserveTokens: 16384` and `keepRecentTokens: 20000`, the approximate trigger is 87.50% for a 131,072-token window, 91.81% for 200,000, and 98.36% for 1,000,000. `keepRecentTokens` controls the retained tail after compaction; it does not change the trigger.

Measure the effective limit for the exact `provider/model` before changing settings: use `pi --list-models`, `/session`, or the RPC session stats, and treat a gateway's `/v1/models` catalog as authoritative for that gateway. For long, tool-heavy sessions prefer a measured reserve that leaves room for the verified output budget rather than disabling compaction. The repository's `pi-codex-context` package adds session windows and history tools; it must remain the sole compaction provider for managed sessions.

For model selection, keep `contextWindow >= 200K` for repository-wide scout work and `>= 272K` for researcher work. Keep `maxTokens >= 32K` for developer, tests-expert, reviewer, and oracle roles; scout has a 16K minimum, and summarizer has an 8K minimum. Gateway-registered limits are authoritative when the provider is dynamic; an absent gateway catalog is reported as unverified rather than guessed.

Run `pi-token-budget.mjs --json` for an LLM-readable report of compaction arithmetic, static model limits, role requirements, and gateway-dynamic entries marked unverified. Add `--strict` when unverified gateway limits should fail the check.

See the setup-ai [context-budget policy](https://github.com/darkrei08/setup-ai/blob/main/docs/context-budget.md) for the calculation, tuning examples, and verification record.
