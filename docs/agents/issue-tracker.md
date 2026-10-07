# Issue tracker: GitHub

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI for tracker operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`.
- Read: `gh issue view <number> --comments` and inspect labels.
- List: `gh issue list --state open` with label/state filters.
- Comment: `gh issue comment <number> --body "..."`.
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; run commands from this checkout.

## Pull requests as a triage surface

No. External pull requests are not included in triage discovery by default. Handle PRs with the normal `gh pr` commands when explicitly requested.

## Wayfinding

Wayfinding maps are GitHub issues labelled `wayfinder:map`; decision tickets are child issues labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`. Use native GitHub sub-issues and dependencies when available. If a feature is unavailable, record parent/blocker links in the issue body.
