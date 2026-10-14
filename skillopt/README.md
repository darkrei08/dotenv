# SkillOpt runtime profile

This directory is the dotenv-owned runtime profile for the personal
[SkillOpt fork](https://github.com/darkrei08/SkillOpt).

The runtime is installed by setup-ai's optional `skillopt-sleep` module into an
isolated Python environment. It harvests recurring work from local agent
sessions, reads only an explicitly configured project `.engram/chunks/` export,
and stages validation-gated skill proposals.

## Safety contract

- Run `aimem sync` before a cycle so the project-scoped Engram chunks are current.
- Keep `auto_adopt` disabled; review staged reports and adopt through a work-unit
  commit.
- Use `gate_mode: "on"`, `gate_no_regression: true`, and `redact_secrets: true`.
- Engram chunks are input context only. The runtime never writes the Engram
  database or chunk source during a sleep cycle.
- Do not send raw transcripts or credentials to upstream providers.

Copy `config.example.json` into the runtime configuration directory and invoke:

```bash
skillopt-sleep dry-run --project "$PWD" --source pi \
  --target-skill-path "$HOME/.agents/skills/skillopt-sleep-learned/SKILL.md" \
  --engram-chunks-dir "$PWD/.engram/chunks"
```

A real cycle writes a proposal to staging. Adoption remains a separate,
reviewed operation.
