# GPT-6 Luna/Sol and Opus 5.5 routing

## Goal
Add GPT-6 Luna and Sol to the Pi OpenAI Codex catalog using the current 5.6 model shape and live Pi pricing, make GPT-6 Luna xhigh the default, and move Opus from 4.8 to 5.5 xhigh where this repository routes it.

## Scope
- `pi/agent/models.json`: add `gpt-6-luna` and `gpt-6-sol`.
- Pi defaults and routing references that currently point to GPT-5.6 Luna or Claude Opus 4.8.
- Preserve unrelated pre-existing working-tree changes.
- Commit and push only the coherent model-routing changes.

## Pricing evidence
- Pi OpenAI Codex catalog endpoint returned GPT-6 Luna: input 0.1, output 0.5, cacheRead 0.01, cacheWrite 0.125.
- Pi OpenAI Codex catalog endpoint returned GPT-6 Sol: input 2, output 10, cacheRead 0.2, cacheWrite 2.5.

## Acceptance checks
- Edited JSON parses.
- GPT-6 entries retain the 5.6 shape and requested prices.
- Interactive default is GPT-6 Luna at xhigh.
- Opus 4.8 routing references are replaced by Opus 5.5 at xhigh where applicable.
- Focused commit excludes unrelated existing changes.

## Evidence
- Work-unit commit: `361d76d8ce2acd950744355ebf8b00d26623fea7` (`feat(pi): add GPT-6 Luna and Sol routing`).
- Verification: all five JSON files parsed, TypeScript syntax check passed, pricing/routing assertions passed, and `git diff --cached --check` passed before commit.

## Follow-up
- Updated the remaining `reviewer-model` workflow alias to `anthropic/claude-opus-5-5:xhigh`.
- Confirmed `pi/agent/ha-failover.example.json` already routes failover through GPT-6 Luna and Opus 5.5.
