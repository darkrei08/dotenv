# Pi configuration

The parent repository's `setup_env.sh` selectively rsyncs managed files into
`~/.pi/agent` and preserves runtime state such as credentials, sessions, and
installed packages. It does not replace the live directory with a symlink.

The module-owned package entries in `settings.json` (`pi-extensible-workflows`,
`gentle-pi`) are installed and verified by `@darkrei08/setup-ai`'s
`pi-workflows` and `gentle-ai` modules. `npm:gentle-engram` is a plain
`pi-packages.txt` line kept in both files for consistency.

## Model Gateways

### Native providers (default)

This setup targets Claude Pro and ChatGPT Plus, so only models included in those
plans are used (Claude Pro includes Opus, Sonnet and Haiku; Fable runs on paid
usage credits and is not used. ChatGPT Plus includes GPT-6.1 Sol, GPT-6 Sol and
GPT-6 Luna, plus GPT-6 Astra with a small allowance). Sources:
<https://claude.com/pricing>, <https://learn.chatgpt.com/docs/pricing>.

The role mapping follows `vekexasia/dotenv`. Workflows use native providers by default:

| Role alias | Resolves to | Used by |
| --- | --- | --- |
| `cheap-model` | `anthropic/claude-sonnet-5-5:medium` | summarizer, qa, release, sre |
| `scout-model`, `developer-model` | `cheap-model` | scout, developer |
| `tests-expert` | `native-luna` = `openai-codex/gpt-6-luna:high` | tests-expert |
| `researcher-model` | `native-luna:xhigh` | researcher |
| `reviewer-model`, `oracle-model` | `anthropic/claude-opus-5-5:high` | reviewer, oracle, architect, security |

Interactive Pi defaults to `anthropic/claude-sonnet-5-5` at `medium`, as do the
subagents (`subagents.json`, review lenses at `high`). The `advisor` mode uses
`openai-codex/gpt-6-luna` at `high`. GGA pre-commit review uses Claude Sonnet 5.5
at `high` effort through Pi (`.gga` and the `agents/gga-pi/` bridge, see
[`docs/gentle-ai-gga.md`](../../docs/gentle-ai-gga.md)): Sonnet 5.5 is the fast,
low-cost reviewer for every commit, while Opus 5.5 stays reserved for the reviewer
role on high-risk work.

### CLIProxyAPI (opt-in)

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
| `native-luna` (GPT-6 Luna high) | `cliproxy-luna` → `cliproxyapi/gpt-6-luna:high` |
| `native-reviewer-model` (Opus 5.5 high) | `cliproxy-reviewer-model` → `cliproxyapi/claude-opus-5-5:high` |
| `native-sol` (GPT-6.1 Sol medium) | `cliproxy-sol` → `cliproxyapi/gpt-6.1-sol:medium` |
| `native-astra` (GPT-6 Astra high) | `cliproxy-astra` → `cliproxyapi/gpt-6-astra:high` |

`check-config.sh` fails when a native alias, an enabled model or a startup thinking
level has no `cliproxyapi` mirror on the same model and effort, so the two routes
cannot drift apart. The mirrors are not guaranteed until the dynamic catalog is authenticated. Pass one
as the per-agent `model` override to run a workflow through CLIProxyAPI. With one
Pro and one Plus account the gateway adds the Keeper usage dashboard, not extra
models, which is why the native route stays the default.

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

## Credentials and local files

Pi keeps provider credentials under ignored files in `~/.pi/agent/`. This
repository never stores OAuth tokens, API keys, Keeper passwords, or CPA
management keys. The local CPA and Keeper setup is described in
`cliproxyapi/README.md`.

## Context budget and compaction

Pi compacts when the reported context exceeds `contextWindow - reserveTokens`, not at a fixed percentage. With Pi's default `reserveTokens: 16384` and `keepRecentTokens: 20000`, the approximate trigger is 87.50% for a 131,072-token window, 91.81% for 200,000, and 98.36% for 1,000,000. `keepRecentTokens` controls the retained tail after compaction; it does not change the trigger.

Measure the effective limit for the exact `provider/model` before changing settings: use `pi --list-models`, `/session`, or the RPC session stats, and treat a gateway's `/v1/models` catalog as authoritative for that gateway. For long, tool-heavy sessions prefer a measured reserve that leaves room for the verified output budget rather than disabling compaction. The repository's `pi-codex-context` package adds session windows and history tools; it must remain the sole compaction provider for managed sessions.

See the setup-ai [context-budget policy](https://github.com/darkrei08/setup-ai/blob/main/docs/context-budget.md) for the calculation, tuning examples, and verification record.
