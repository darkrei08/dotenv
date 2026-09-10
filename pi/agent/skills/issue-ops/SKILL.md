---
name: issue-ops
description: Author, label, triage, and close GitHub/GitLab issues and pull requests so an away-from-keyboard agent can execute them unattended. Use when creating or triaging issues, writing bug reports or feature scopes, applying labels, or driving the ready-for-agent workflow and its PRs.
metadata:
  source: "https://github.com/vekexasia/pi-extensible-workflows/issues (observed method)"
---

# Issue Ops

Operating method for issues and pull requests. Goal: every issue is self-contained enough that an away-from-keyboard (AFK) agent can execute it without asking follow-up questions.

## Titles

- Declarative and symptom-specific. State the failure or the outcome.
- Good: "Restart recovery fails when a registered function uses a role missing from the snapshot".
- Bad: "Fix recovery bug", "Improve logging".
- No fluff, no emoji, no trailing punctuation.

## Issue templates

Pick the template that fits. Keep the headings; drop a section only when it is genuinely empty.

### Bug (analysis)

Use when the code path is known.

- `## Summary` one or two sentences.
- `## Location` file:line references.
- `## Reproduction` numbered steps.
- `## Result` observed output; paste the error block verbatim.
- `## Cause` the mechanism; include a short ASCII cause trace when it clarifies.
- `## Impact` who or what is affected, severity, and an explicit data-loss statement.
- `## Suggested fix` concrete direction; say when a design decision is required.
- `## Environment` versions, OS, repo commit, run id.
- `**Priority:** Pn <axis>` for example `P0 install-blocking correctness`.

### Bug (field report)

Use when reproducing from the field before root cause is known.

- `### Reproduction` / `### Result` / `### Diagnosis` / `### Environment`.

### Scope / feature

- `## Summary` / `## Evidence` / `## Proposed scope` (bulleted) / `## Acceptance criteria`.
- Acceptance criteria must list the exact build, test, and lint commands that must pass.

## Labels

- Standard: `bug`, `enhancement`, `documentation`, `question`, `duplicate`, `invalid`, `wontfix`, `good first issue`, `help wanted`.
- `ready-for-agent`: "Fully specified, ready for an AFK agent." Apply only when the admission criteria below hold.
- Optional planning family: `wayfinder:map`, `wayfinder:research`, `wayfinder:grilling`, `wayfinder:prototype`, `wayfinder:task`.

## ready-for-agent admission criteria

Apply `ready-for-agent` only when ALL of these hold:

- Self-contained: no external context is needed to start.
- Exact locations: file paths, and line numbers where known.
- Environment pinned: versions, OS, commit or run id.
- Acceptance criteria present, including the exact verification commands.
- A clear fix direction or a bounded decision, not an open question.

If any item is missing, leave it unlabeled and open a `question` or a `wayfinder:grilling` ticket instead.

## Priority axis

Annotate priority on an explicit axis, never a bare number:

- `P0` blocking correctness or install-blocking.
- `P1` correctness or availability.
- `P2` observability or log correctness.
- `P3` enhancement.

## Lifecycle

1. Open with the right template and a declarative title.
2. Triage: apply labels; promote to `ready-for-agent` only when the admission criteria hold.
3. Execute: AFK agents pick `ready-for-agent` issues. See `prompts/fixissues.md` and the `devIssuesInBatches` workflow, driven by `gh issue list --state open --label ready-for-agent --json number --jq '.[].number'`.
4. PR: one PR per work unit, references the issue (`Fixes #N`), thin surgical diff, mirrors cross-OS or parity constraints where relevant, acceptance criteria pass.
5. Review gate: a human approves. Do not self-merge unless told.
6. Close: after approval, close as COMPLETED. Ask before closing when unsure.

## Pull request rules

- Title mirrors the issue outcome.
- Body states what changed, why, how it was verified (exact commands), and the issue link.
- Keep the diff reviewable; split oversized work into chained PRs.
- Do not commit or push unless the user asked; never bypass hooks with `--no-verify`.

## Anti-patterns

- Vague titles, missing acceptance criteria, no environment block.
- `ready-for-agent` on an underspecified ticket.
- Fabricated standards or citations. Verify every claim from source.
- Out-of-scope changes bundled into an unrelated PR.
