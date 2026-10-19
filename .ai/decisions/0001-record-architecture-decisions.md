# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** <YYYY-MM-DD>
- **Supersedes:** —
- **Superseded-by:** —

## Context

This project needs a durable, machine-independent record of the significant
technical decisions it makes, so that a new machine, a fresh clone, or a new
agent can understand *why* the code is the way it is — not just *what* it does.

## Decision

We keep Architecture Decision Records (ADRs) as numbered Markdown files in
`.ai/decisions/`. Each ADR is immutable once `Accepted`. To change a decision we
add a new ADR that sets `Supersedes:` to the old number and flips the old ADR's
status to `Superseded`.

ADRs are the human source of truth. Engram holds a queryable copy but never
overrides an ADR on conflict.

## Consequences

- The rationale behind the architecture survives environment loss.
- Reviewers and agents can trace decisions without archaeology through git log.
- A small discipline cost: significant decisions must be written down.

<!--
Copy this file to NNNN-title.md for each new decision. Keep it short:
Context (forces at play) → Decision (what we chose) → Consequences (trade-offs).
-->
