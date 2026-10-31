# Model Identifier and Thinking Level Disambiguation Glossary

This glossary establishes the definitive rules for distinguishing model identifiers from runtime thinking levels across the Pi fleet (`pi-extensible-workflows`, `pi-ext-roles`, and `ha.json`).

This document complies with `REVIEW_RULES.md` and Directive D11. Canonical routing targets, primary roles, and failover chains remain strictly governed by `REVIEW_RULES.md` and `ha.json`. This glossary provides the syntactic and operational disambiguation standard for how routes are parsed, configured, and reported to human operators.

## Core Invariants

1. **Model identifier is an opaque catalog name:** An identifier is the provider's registered catalog name (e.g., `gemini-3.8-flash-high`, `claude-opus-4-6-thinking`). It may contain level-like tokens (`flash`, `lite`, `high`, `thinking`), but these carry **zero routing or thinking meaning**; they are strictly parts of the vendor's naming scheme.
2. **Thinking level is a separate field:** The thinking level is an independent runtime parameter configuring reasoning/chain-of-thought effort from the closed enum `['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']`. It appears **exactly once per role**. In role aliases (`pi/agent/pi-ext-roles/settings.json`), it is specified via the trailing `:thinking` suffix. In reports, handoffs, and API contracts, it must always be expressed as a distinct field.
3. **Failover matrix holds bare identifiers only:** The HA failover matrix (`ha.json`, `ha-failover.example.json`) contains **bare identifiers only** (`provider/model`, e.g., `cliproxyapi/claude-sonnet-4-6`). It never includes an `:effort` suffix. The HA extension resolves entries by exact catalog ID, and failover automatically inherits the active session's thinking level (Directive D1).

## Parsing Rule

The reference parser (`parseModelReference` in `pi-extensible-workflows/src/utils.ts`) resolves model specifications (`provider/reference`) by isolating the **last colon (`:`)**:

1. If the substring after the last `:` belongs to the closed enum `['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']`, that suffix is parsed as the runtime `thinking` parameter.
2. Everything preceding the last `:` (after `provider/`) is the literal catalog model identifier (`model`). Any word such as `high`, `lite`, `flash`, or `thinking` appearing before the final colon is strictly part of the model's catalog name.
3. If no `:` is present, the entire reference is the model identifier and thinking level remains `undefined`.

## 16-Role Alias Disambiguation Matrix (`pi-ext-roles/settings.json`)

### Authoritative Baselines vs. Diversified Alias Targets

In accordance with `REVIEW_RULES.md`:
- **Authoritative primary targets (`REVIEW_RULES.md`):** Developer, QA, release, and SRE use `cliproxyapi/claude-sonnet-4-6:off`; reviewer, oracle, architect, and security use `cliproxyapi/claude-opus-4-6-thinking:off`; tests uses `cliproxyapi/gpt-5.6-luna:high`; research uses `cliproxyapi/gpt-5.6-luna:xhigh`; scouting uses `cliproxyapi/gemini-3.8-flash-high:medium`; summarization uses `cliproxyapi/gemini-3.5-flash-lite:low`.
- **Diversified alias targets (`pi/agent/pi-ext-roles/settings.json`):** The 16 aliases below (`architect-model`, `developer-model`, `tests-expert`, etc.) represent the alternative/diversified role aliases and failover targets provisioned in `settings.json`. As specified in `REVIEW_RULES.md`, alternative aliases and HA groups do not replace primary role targets. This table analyzes their syntactic structure to prevent confusion between vendor catalog naming tokens and runtime thinking parameters.

| Role | Alias Key (`settings.json`) | Exact Model Identifier | Level-like Token | Token Meaning | Thinking Level | Operational Sentence |
|---|---|---|---|---|---|---|
| **architect** | `architect-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = vendor speed class; `high` = Google capability tier | `medium` | The architect role's `architect-model` alias executes `gemini-3.8-flash-high` at thinking level `medium`, requesting medium reasoning on the Flash-High variant (primary baseline remains Claude Opus Thinking per `REVIEW_RULES.md`). |
| **debugger** | `debugger-model` | `claude-sonnet-4-6` | *none* | N/A | `off` | The debugger role's `debugger-model` alias executes `claude-sonnet-4-6` at thinking level `off`, requesting direct response without CoT. *(In report analysis: model identifier `deepseek-v4.1-flash` [where `flash` is part of the vendor name], thinking level `high`)* |
| **developer** | `developer-model` | `gpt-5.6-luna` | *none* | N/A | `high` | The developer role's `developer-model` alias executes `gpt-5.6-luna` at thinking level `high`, requesting maximum standard reasoning effort (primary baseline remains Claude Sonnet per `REVIEW_RULES.md`). |
| **market-researcher** | `market-researcher-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = speed; `high` = Google tier | `medium` | The market-researcher role executes `gemini-3.8-flash-high` at thinking level `medium`, requesting medium reasoning on the Flash-High model. |
| **marketing-strategist** | `marketing-strategist-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = speed; `high` = Google tier | `medium` | The marketing-strategist role executes `gemini-3.8-flash-high` at thinking level `medium`, requesting synthesis with medium reasoning. |
| **oracle** | `oracle-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = speed; `high` = Google tier | `medium` | The oracle role's `oracle-model` alias executes `gemini-3.8-flash-high` at thinking level `medium`, requesting analysis and verification with medium reasoning (primary baseline remains Claude Opus Thinking per `REVIEW_RULES.md`). |
| **qa** | `qa-model` | `claude-sonnet-4-6` | *none* | N/A | `off` | The qa role executes `claude-sonnet-4-6` at thinking level `off`, requesting deterministic validation without chain of thought. |
| **release** | `release-model` | `claude-sonnet-4-6` | *none* | N/A | `off` | The release role executes `claude-sonnet-4-6` at thinking level `off`, requesting format checks without thinking overhead. |
| **researcher** | `researcher-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = speed; `high` = Google tier | `medium` | The researcher role's `researcher-model` alias executes `gemini-3.8-flash-high` at thinking level `medium`, requesting deep research with balanced reasoning (primary research baseline remains Luna at `xhigh` per `REVIEW_RULES.md`). |
| **reviewer** | `reviewer-model` | `claude-opus-4-6-thinking` | `thinking` | Gateway variant routing to upstream extended thinking | `off` | The reviewer role executes `claude-opus-4-6-thinking` at thinking level `off`, requesting the Opus-Thinking endpoint without additional client budget. |
| **scout** | `scout-model` | `gemini-3.8-flash-high` | `flash`, `high` | `flash` = speed; `high` = Google tier | `medium` | The scout role executes `gemini-3.8-flash-high` at thinking level `medium`, requesting rapid exploration with intermediate reasoning (matches scouting baseline in `REVIEW_RULES.md`). |
| **security** | `security-model` | `claude-opus-4-6-thinking` | `thinking` | Gateway variant with extended thinking | `off` | The security role executes `claude-opus-4-6-thinking` at thinking level `off`, requesting vulnerability analysis without client thinking parameters. |
| **sre** | `sre-model` | `claude-sonnet-4-6` | *none* | N/A | `off` | The sre role executes `claude-sonnet-4-6` at thinking level `off`, requesting direct log analysis without thinking. |
| **summarizer** | `summarizer-model` | `gemini-3.5-flash-lite` | `flash`, `lite` | `flash` = speed; `lite` = Google economical size class | `low` | The summarizer role executes `gemini-3.5-flash-lite` at thinking level `low`, requesting compression with minimal analytical effort (matches summarization baseline in `REVIEW_RULES.md`). |
| **tests-expert** | `tests-expert` | `gpt-5.6-luna` | *none* | N/A | `high` | The tests-expert role executes `cliproxyapi/gpt-5.6-luna` at thinking level `high`, requesting test generation with maximum reasoning (matches tests baseline in `REVIEW_RULES.md`). |
| **verifier** | `verifier-model` | `claude-sonnet-4-6` | *none* | N/A | `off` | The verifier role executes `claude-sonnet-4-6` at thinking level `off`, requesting criteria verification without CoT chain. |

## Collision List: Identifiers in Use with Level-like Tokens

These active model identifiers contain substrings that resemble reasoning effort or speed classes:

- `gemini-3.8-flash-high` (`flash`, `high`): Vendor tokens for low-latency engine and upper capability tier.
- `gemini-3.5-flash-lite` (`flash`, `lite`): Vendor tokens for low-latency engine and lightweight economical tier.
- `claude-opus-4-6-thinking` (`thinking`): Gateway variant identifier pointing to upstream extended thinking routing.
- `deepseek-v4.1-flash` (`flash`): Listed in `ha-failover.example.json` and evaluated during the 2026-10-31 routing analysis session for `debugger` failover (note: per `docs/dev-process-directives.md` provenance, committed reports end at 2026-10-26 and live runtime behavior remains an open gap pending active probe per D3); vendor token for accelerated inference.

## Worked Example: Reading an Alias Out Loud

Consider the alias string configured for the `reviewer` role:

```text
cliproxyapi/claude-opus-4-6-thinking:off
```

Deconstructing the alias field by field:

1. **Provider Prefix:** `cliproxyapi`
   - Identifies the routing provider/gateway endpoint.
2. **Provider Separator:** `/`
   - Delimits provider name from model reference.
3. **Exact Model Identifier:** `claude-opus-4-6-thinking`
   - The literal catalog identifier. The substring `thinking` is an intrinsic token of the model identifier (designating the upstream variant), **not** a client thinking parameter.
4. **Thinking Separator:** `:`
   - Delimits the model identifier from the runtime thinking parameter.
5. **Runtime Thinking Level:** `off`
   - The operational thinking level passed to the client turn, disabling additional client reasoning budget.

**Read out loud:**
> "Role **reviewer** executes on provider **cliproxyapi** using model identifier **claude-opus-4-6-thinking** with runtime thinking level **off**."

Similarly, for the `architect-model` alias `cliproxyapi/gemini-3.8-flash-high:medium`:
- Provider: `cliproxyapi`
- Model Identifier: `gemini-3.8-flash-high` (where `flash` and `high` are vendor tier names, not routing instructions)
- Thinking Level: `medium`
- **Read out loud:**
> "Role **architect** executes on provider **cliproxyapi** using model identifier **gemini-3.8-flash-high** with runtime thinking level **medium**."
