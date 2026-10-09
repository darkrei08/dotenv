# Compaction evaluation

Evidence for issues #29 and #25 (which compactor, and whether to tune `reserveTokens` / `keepRecentTokens`). Measured on 2026-10-09. Nothing in `~/.pi/agent` was changed.

## What upstream does

| Source | Finding |
| --- | --- |
| `vekexasia/dotenv` `settings.json` at `c419a0c` | Registers `npm:@sting8k/pi-vcc` as the compactor (`overrideDefaultCompaction`, `smartKeepTail`, `continueAfterThresholdCompact`). `compaction.enabled` is `true`. No `reserveTokens` or `keepRecentTokens` anywhere in its Pi config. |
| Its history | `packages/pi-codex-context` was added and registered on 2026-09-15 (`6c0205e`), then removed from `settings.json` and `pi-vcc` restored on 2026-09-17 (`202143e`). The package is still in his tree, unregistered, and is byte-identical to the copy in this repository. |
| `vekexasia/pi-extensible-workflows` | Does not configure compaction. |
| This repository | `pi-codex-context` registered for the main session; `pi-vcc` loaded only for workflow children (`pi-vcc-config.json`, `extensions` glob). |

## Fixture

`docs/research/compaction-fixture.ts` builds a 260-turn synthetic session (about 78k estimated tokens) with 12 planted facts at different depths (preferences, a safety constraint, decisions, an identifier, an error and its fix, a file edit, a commit, a number, an open TODO). It compacts the older span with Pi's default cut policy and checks which facts survive, weighted by importance. Two scenarios: `prose` (facts only in message text) and `tool` (commit, file edit and error carried by real tool calls and results).

Run it with `PI_PKG`, `VCC_PKG` and optionally `NATIVE=1 MODEL=... RUNS=3` (native runs make billable model calls). It runs on a temporary copy of the Pi config (removed on exit) and never opens a live session.

### Results (11 facts fall in the summarized span)

| Method | LLM calls | Time | Summary size | Facts kept in context (weighted) |
| --- | --- | --- | --- | --- |
| Native Pi compaction, `openai-codex/gpt-6-luna:high`, 3 runs per scenario | yes | 9 to 14 s | about 6.3 to 6.8k chars | prose 0.73, 0.85, 0.92; tool 0.92, 0.92, 0.96 |
| `pi-vcc` `compile` | none | about 10 ms | about 3.1k chars | prose 0.31; tool 0.46 |
| `pi-vcc` `compileRanked` | none | n/a | about 4.5k chars | prose 0.31; tool 0.46 |
| `pi-vcc` second pass (previous summary fed back) | none | n/a | about 2.9k chars | no further loss, no gain |
| `pi-vcc` `vcc_recall` on demand | none | n/a | n/a | 1.00 in both scenarios (every fact retrievable if queried) |
| `pi-codex-context` rollover | none | about 5 ms | 178 chars | 0.00 in context by design ("not summarized"); state lives in notes and history tools |

`pi-codex-context`'s own suite passes (39/39) and its replay benchmark handles 99k entries with a 278 ms validation pass.

Reading the table:

- Native summaries keep most facts but vary between runs (0.73 to 0.96) and cost a model call each time. The facts they dropped were mostly file edits, commits, a number, an identifier and one preference, and not always the same ones.
- `pi-vcc` is deterministic and free, keeps few facts inline, and loses the same ones every time (preferences, identifiers, errors, open TODOs). It keeps the facts retrievable, but only if the agent decides to call `vcc_recall`.
- `pi-codex-context` keeps nothing inline. A constraint such as "never run `docker compose down -v`" survives only if it was written to notes or can be found by a history search.
- Which planted facts land in the kept tail (and so skip summarization) also depends on `keepRecentTokens`: in the sweep run by the fixture, 5k keeps none and larger values keep progressively more of the late ones.

## Reserve and keep-recent tuning

`pi-model-fit` carries the vekexasia rule `reserveTokens >= max(maxTokens, 16384)`. For the models used here, `maxTokens` is 128K, so the rule would set a reserve of 128K on windows of 250K to 272K and trigger compaction at about 122K to 144K tokens.

Measured on the author's local Pi session logs: every assistant message under `~/.pi/agent/sessions/**/*.jsonl`, taking `usage.output` for output and `usage.input + cacheRead + cacheWrite` for input context (23,236 turns, aggregate percentiles only). The logs are private, so third parties cannot reproduce this table.

| Model | Turns | Output p99 | Output max | Input context p95 |
| --- | --- | --- | --- | --- |
| `openai-codex/gpt-6-luna` | 7,031 | 6.9k | 22.3k | 222k |
| `anthropic/claude-opus-5-5` | 1,317 | 4.7k | 14.0k | 368k |
| `anthropic/claude-sonnet-5-5` | 627 | 5.6k | 9.7k | 465k |
| `cliproxyapi/claude-sonnet-5-5` | 384 | 4.7k | 7.6k | 500k |

Generated output never exceeded about 29k tokens in any model. A 128K reserve would compact long before the p95 context of the 250K to 272K models (about 222k), i.e. almost continuously. The floor rule is a safe upper bound but is not optimal for this workload. A reserve around 32K (above the largest observed output) would trigger at about 218k to 240k on those windows, and the 16,384 default at about 234k to 256k. Pi also recovers from an overflow or a `length` stop with one compact-and-retry attempt (Pi `compaction.md`), so the default is not unsafe.

## Recommendation

1. Do not change `reserveTokens` or `keepRecentTokens` now. There is no observed overflow to fix, and the vekexasia floor rule would make things worse here. Revisit if overflow recoveries show up in the logs.
2. Compactor: align with vekexasia's current choice, `pi-vcc` as the single summary owner for the main session, only after an end-to-end check with a real agent that it calls `vcc_recall` when it needs older facts. Durable constraints (like destructive-command rules) belong in `AGENTS.md`, not in a summary. Keep `pi-codex-context` in the tree, unregistered, as upstream does.
3. If a higher in-context retention matters more than cost and determinism, native compaction is the stronger summarizer (0.73 to 0.96), at one model call per compaction.

## Limits of this evidence

- One synthetic session, 12 facts, substring probes. It measures survival of planted facts, not task success after compaction.
- Native results are three runs per scenario on one summarizer model; Anthropic models could not be used because the native login is expired.
- The end-to-end behavior of an agent that must decide to recall or read notes was not tested.
- `pi-codex-context` retrievability was covered by its own test suite, not by this fixture.
- Output statistics come from local logs and include thinking tokens only as far as `usage.output` reports them.
