# Repo-specific directives

## Commit-indexed memory

Every completed code, configuration, documentation, issue, or pull-request commit must receive one repository-memory record before the next work unit starts.

1. Read the exact commit with `git show --stat --format=fuller <full-hash>` and `git show --format= --name-only <full-hash>`.
2. Record the full hash, subject, parents, task/spec identifier, changed paths, verification commands and outcomes, scope, review result, and remaining blockers.
3. Run `aimem save "Commit <full-hash>: <subject>" "<structured evidence>" discovery`, then `aimem sync`.
4. Confirm the record is indexed with `aimem status` or the Engram memory tools before continuing.
5. If recording or indexing fails, stop before the next work unit and report the exact failure.

Never store credentials, tokens, refresh tokens, provider transcripts, secret values, or the contents of `auth.json` or `ha.json`. Memory is evidence and does not authorize push, merge, issue closure, release, or publication.

The full commit hash is the stable index key. For a work-unit commit, include the native review result or explicitly state that review was unavailable or not due.

## Repository memory

`.ai/` Markdown is the durable source of truth. Engram and `.engram/chunks/` are queryable synchronized indexes. Run `aimem sync` after changing `.ai/` memory and commit the source and synchronized chunks with the related work unit where practical.
