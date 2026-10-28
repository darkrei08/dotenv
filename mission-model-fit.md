# Mission Directive: Pi-Model-Fit Analysis, Role Alias Consolidation, and Guardian Angel Reviewer Alignment

## Context & Authority
You are el Gentleman running in a dedicated Pi Agent session. The user has authorized executing PiWorkflow with the recently landed GovernedChildBrief capabilities to analyze pi-model-fit, review model fitness for pi-ext-roles, consolidate aliases in pi-extensible-workflows, and align Guardian Angel with the reviewer role.

## 1. PiWorkflow Analysis of pi-model-fit
- Target directory: `/root/git/personale/pi-model-fit`.
- Launch a PiWorkflow run (via `workflow` tool or registered starter) to analyze open issues (especially Issue #13: "Add runtime model refresh extension for pi-model-fit") and any open PRs on `darkrei08/pi-model-fit` and `vekexasia/pi-model-fit`.
- Synthesize actionable implementation findings and required tests.

## 2. Evaluate State-of-the-Art Models for pi-ext-roles
- Review `/root/git/personale/pi-ext-roles/roles/` and `/root/git/personale/pi-model-fit/reports/`.
- Evaluate the best current model recommendations for the canonical roles:
  - `reviewer-model` (Opus 4.6 / GPT-6 Luna / Claude 3.7 Sonnet)
  - `developer-model`
  - `scout-model`
  - `oracle-model`
  - `architect-model`
  - `researcher-model`
  - `verifier-model`

## 3. Consolidate Model Aliases in darkrei08/pi-extensible-workflows
- Inspect model aliases in `/root/git/personale/pi-extensible-workflows` (`packages/core/starter/index.ts` and settings).
- Remove redundant/duplicate aliases (e.g. `cheap-model`, `cheap-model-ant`, `claude-developer-model`, `old-reviewer-model`, `opencode-*`) so they align cleanly with the canonical roles of `pi-ext-roles`.
- Verify with `npm run build && npm run lint && npm test --workspace=packages/core` under isolated `$HOME`.

## 4. Align Guardian Angel (GGA) Reviewer Configuration
- Inspect `/root/git/personale/dotenv/.gga` and `agents/gga-pi/run-gga.sh`.
- Ensure GGA uses the canonical reviewer model matching `reviewer-model` in `pi-ext-roles`, with verified fallback/failover provider settings.
- Verify that `bash check-config.sh` and GGA code review pass.
