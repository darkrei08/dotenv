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

The role mapping follows the current `roleRecommendations` source in
`pi-model-fit/scripts/report.mjs`. Catalog visibility is recorded separately
from entitlement, inference, and quota; the configured routes below are not a
claim that a live gateway can use them:

| Role alias | Resolves to | Effort | Used by |
| --- | --- | --- | --- |
| `developer-model` | `cliproxyapi/claude-sonnet-4-6` | off | developer |
| `architect-model` | `cliproxyapi/claude-opus-4-6-thinking` | off | architect |
| `security-model` | `cliproxyapi/claude-opus-4-6-thinking` | off | security |
| `debugger-model`, `verifier-model` | `cliproxyapi/claude-sonnet-4-6` | off | debugger, verifier |
| `market-researcher-model`, `marketing-strategist-model` | `cliproxyapi/gpt-5.6-luna` | xhigh | market-researcher, marketing-strategist |
| `qa-model`, `release-model`, `sre-model` | `cliproxyapi/claude-sonnet-4-6` | off | qa, release, sre |
| `tests-expert` | `cliproxyapi/gpt-5.6-luna` | high | tests-expert |
| `researcher-model` | `cliproxyapi/gpt-5.6-luna` | xhigh | researcher |
| `scout-model` | `cliproxyapi/gemini-3.8-flash-high` | medium | scout |
| `summarizer-model` | `cliproxyapi/gemini-3.5-flash-lite` | low | summarizer |
| `reviewer-model`, `oracle-model` | `cliproxyapi/claude-opus-4-6-thinking` | off | reviewer, oracle |

The role pack also includes read-only `debugger`, `verifier`, `market-researcher`, and `marketing-strategist` contracts. They use role-based aliases and are available to P-workflow callers without changing existing workflow behavior.

Optional Gemini alternatives are available as explicit aliases, without replacing the
primary role assignments:

| Alternative alias | Model:effort | Intended use |
| --- | --- | --- |
| `gemini-scout-model` | `cliproxyapi/gemini-3.8-flash-high:medium` | fast scouting |
| `gemini-summarizer-model` | `cliproxyapi/gemini-3.5-flash-lite:low` | low-cost summarization |
| `gemini-researcher-model` | `cliproxyapi/gemini-3.8-flash-high:high` | long research fallback |
| `gemini-developer-model`, `gemini-tests-model` | `cliproxyapi/gemini-3.8-flash-high:high` | experimental coding/testing fallback |

Managed role aliases, subagent review profiles, optional modes and GGA use the
configured effort for their route. GGA uses the dedicated CLIProxyAPI reviewer
HA route (`.gga` and the `agents/gga-pi/` bridge; see
[`docs/gentle-ai-gga.md`](../../docs/gentle-ai-gga.md)). An unavailable review
model remains a blocker, not permission to bypass the gate or choose another one.

Verify this matrix with `node --test tests/medium-effort-policy.test.mjs` and
`bash tests/role-tool-policy.sh` from the repository root. Existing sessions
retain their recorded thinking level; changing configuration is not proof that
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
| `native-cheap-model` (GPT-5.6 Luna medium) | `cliproxy-cheap-model` → `cliproxyapi/gpt-5.6-luna:medium` |
| `native-luna` (GPT-5.6 Luna high) | `cliproxy-luna` → `cliproxyapi/gpt-5.6-luna:high` |
| `native-reviewer-model` (native Opus 4.6 high) | `cliproxy-reviewer-model` → `cliproxyapi/claude-opus-4-6-thinking:off` |
| `native-sol` (GPT-6 Sol high) | `cliproxy-sol` → `cliproxyapi/gpt-6-sol:high` |
| `native-astra` (GPT-6 Astra medium) | `cliproxy-astra` → `cliproxyapi/gpt-6-astra:medium` |

`check-config.sh` fails when a native alias, an enabled model or a startup thinking
level has no `cliproxyapi` mirror for the same model and configured route, so the two
routes cannot drift apart by model identifier. The mirrors are not guaranteed until the dynamic catalog is authenticated. Pass one
as the per-agent `model` override to run a workflow through CLIProxyAPI. With one
Pro and one Plus account the gateway adds the Keeper usage dashboard, not extra
models, which is why Codex stays on its native login.

The optional Gemini aliases are explicit alternatives, not automatic role replacements.
For automatic quota/capacity fallback, `~/.pi/agent/ha.json` contains `development`,
`scout`, `fast`, `research`, `summary`, and `testing` groups. Select one with
`/ha-group <name> <model-id>...`; the repository template is
`pi/agent/ha-failover.example.json`. The default development chain ends with
`cliproxyapi/gpt-6-astra` after the existing GPT and Claude entries.

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

Workflow agents inherit Pi's built-in `codemode`, `tool-search`, and `mcp` extensions from `pi/agent/pi-ext-roles/settings.json`. Root `settings.json` activates `tool_search` through additive `defaultTools: ["+tool_search"]`; the role-level allowlist keeps it available without widening any child beyond its explicit tools. A workflow call can still narrow this ceiling with an explicit tool allowlist; do not start a child with `!*` unless it also includes `tool_search` when MCP access is intended. The researcher role contains no selectors for absent tools such as `replace`, `insert`, or `undo_last_change`.

## Credentials and local files

Pi keeps provider credentials under ignored files in `~/.pi/agent/`. This
repository never stores OAuth tokens, API keys, Keeper passwords, or CPA
management keys. The local CPA and Keeper setup is described in
`cliproxyapi/README.md`.

## Subagent Ownership

PiWorkflow owns standalone subagent execution in this profile. Its package entry loads `dist/subagents/index.js`, and `pi-extensible-workflows/settings.json` enables the subagent runtime.

Gentle AI remains responsible for persona, task framing, ODD guidance, and review policy. Its `gentle-agents.ts` extension stays excluded so it does not create a second standalone-agent scheduler. GGA remains the commit-time quality gate invoked by the repository pre-commit hook through `agents/gga-pi/run-gga.sh`.

## Context budget and compaction

Pi compacts when the reported context exceeds `contextWindow - reserveTokens`, not at a fixed percentage. With Pi's default `reserveTokens: 16384` and `keepRecentTokens: 20000`, the approximate trigger is 87.50% for a 131,072-token window, 91.81% for 200,000, and 98.36% for 1,000,000. `keepRecentTokens` controls the retained tail after compaction; it does not change the trigger.

Measure the effective limit for the exact `provider/model` before changing settings: use `pi --list-models`, `/session`, or the RPC session stats, and treat a gateway's `/v1/models` catalog as authoritative for that gateway. For long, tool-heavy sessions prefer a measured reserve that leaves room for the verified output budget rather than disabling compaction. `npm:@sting8k/pi-vcc` is the sole compaction provider for managed sessions and workflow children; the retained `pi-codex-context` source is not registered.

For model selection, keep `contextWindow >= 200K` for repository-wide scout work and `>= 272K` for researcher work. Keep `maxTokens >= 32K` for developer, tests-expert, reviewer, and oracle roles; scout has a 16K minimum, and summarizer has an 8K minimum. Gateway-registered limits are authoritative when the provider is dynamic; an absent gateway catalog is reported as unverified rather than guessed.

Run `pi-token-budget.mjs --json` for an LLM-readable report of compaction arithmetic, static model limits, role requirements, and gateway-dynamic entries marked unverified. Add `--strict` when unverified gateway limits should fail the check.

See the setup-ai [context-budget policy](https://github.com/darkrei08/setup-ai/blob/main/docs/context-budget.md) for the calculation, tuning examples, and verification record.

## Command Artifacts and Pagination

The repository-owned `command-artifacts.ts` extension loads automatically from `pi/agent/extensions/` (rsynced to `~/.pi/agent/extensions/` by `setup_env.sh`). It registers content-addressed Pi `ls` and `grep` tool handlers to preserve complete, deterministic results without loss:

- **Bounded preview and pagination**: When results exceed configured entry/match limits (default 500 for `ls`, 100 for `grep`) or the 50KB byte limit, the tool emits a bounded preview accompanied by exact pagination instructions (`offset` and `limit`).
- **Authoritative artifact**: The full, untruncated result is preserved in a local, content-addressed file under `/tmp/pi-command-artifacts/` (mode `0600`, outside tracked source). The artifact path is the authoritative complete result; models paginate through it using the built-in `read` tool: `read(path="/tmp/pi-command-artifacts/...", offset=N, limit=M)`.
- **Shell fallback**: `bash` remains the fallback for arbitrary shell commands, pipelines, and commands that require shell execution semantics.
- **Safe secrets behavior**: Credential and sensitive files (`.env`, `auth.json`, `ha.json`, `*credential*`, `*secret*`, `.ssh/`, `.aws/`, `.gnupg/`) are rejected on direct search and automatically excluded from directory searches by default.
