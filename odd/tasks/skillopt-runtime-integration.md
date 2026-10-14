# SkillOpt Runtime Integration

Feature specification and task ledger for integrating a forked SkillOpt runtime with dotenv and setup-ai.

## Specs

- S1: "no volgio tutto in runtime funzioanne ed completamente integrato"
- S2: "che poss analizzare gli asptti ricorrenti e anche la memoria engram"
- S3: "e che si automigliori anche lui stesso"
- S4: "e che quindi io faccia un fork della repo"
- S5: "e che io possa inviare anceh dei commit di suggeriemnto sul suo repo"

## Architecture

- The personal fork is `/root/git/personale/upstream` with `origin=https://github.com/darkrei08/SkillOpt.git` and `upstream=https://github.com/microsoft/SkillOpt.git`.
- SkillOpt-Sleep remains the runtime engine. dotenv owns project-scoped configuration, task fixtures, Engram ingestion, redaction policy, and adoption review; it must not duplicate the optimizer loop.
- Engram input is an adapter boundary: consume only approved project memories and exported `.engram/chunks/`, never the SQLite database or private provider credentials. Candidate skill and memory changes are staged, validated on held-out tasks, and adopted only through an explicit reviewable work unit.
- setup-ai installs the forked runtime into an isolated environment as an opt-in module, with Bash/PowerShell/Node parity. It must not make SkillOpt a core dependency or silently schedule network/API work.
- Self-improvement is bounded to SkillOpt prompts, heuristics, and configuration fixtures in the fork, and is subject to the same held-out gate and upstream-review workflow as user skills. No self-modifying installer or automatic publication is allowed.

## Tasks

- T1 (S1-S3): Design and implement a runtime SkillOpt service that mines recurring work, consumes approved Engram context, evolves skills and its own optimization prompts/configuration through bounded validation-gated proposals.
- T2 (S1-S2): Integrate the runtime and adapter boundaries into dotenv, preserving canonical skill linking and existing Gentle AI, CodeGraph, and Engram ownership.
- T3 (S1): Integrate cross-platform opt-in installation and lifecycle support into setup-ai with Bash/PowerShell/Node parity.
- T4 (S2-S3): Add redaction, isolation, regression tests, adoption gates, and operational documentation.
- T5 (S4-S5): Create or connect the personal fork, preserve upstream remotes, and prepare reviewable upstream suggestion commits without publishing or opening a PR unless explicitly authorized for that operation.

## Log

- L1: no volgio tutto in runtime funzioanne ed completamente integrato e che poss analizzare gli asptti ricorrenti e anche la memoria engram e che si automigliori anche lui stesso e che quindi io faccia un fork della repo e che io possa inviare anceh dei commit di suggeriemnto sul suo repo
