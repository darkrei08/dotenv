## Agent skills

### Issue tracker

Issues live on GitHub Issues and are managed with `gh`; pull requests are not a triage request surface by default. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository: read `GLOSSARY.md` when present and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### Commit-indexed memory

After every completed code, configuration, documentation, issue, or PR commit, record the exact commit in repository memory before starting the next work unit:

1. Capture the full hash, subject, parents, changed paths, verification commands and their outcomes, scope, and remaining blockers with `git show --stat --format=fuller <hash>` and `git show --format= --name-only <hash>`.
2. Redact credentials and never copy `auth.json`, `ha.json`, tokens, provider transcripts, or secret values into memory.
3. Run `aimem save "Commit <full-hash>: <subject>" "<structured evidence>" discovery` and then `aimem sync`.
4. Confirm the record is indexed with `aimem status` or the Engram memory tools. If recording fails, stop before the next work unit and report the exact failure.

The full hash is the stable index key. Memory records are evidence, not delivery authorization: do not push, merge, close, or publish unless separately authorized. When the commit is a work-unit commit, include its task/spec identifier and native review or unavailable-review result.
