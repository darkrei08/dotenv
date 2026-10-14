---
name: skillopt-sleep
description: Use when the user asks SkillOpt-Sleep to inspect recurring local work, run a dry-run or gated sleep cycle, review staged proposals, or improve a selected skill from redacted session and Engram evidence.
---

# SkillOpt-Sleep

Use the installed SkillOpt-Sleep runtime as an opt-in, validation-gated proposal engine. It harvests the selected local source, mines recurring tasks, replays them through the configured backend, and stages candidate skill or memory changes. It does not directly mutate live skills during `dry-run` or `run`.

## Safety boundary

- Run `aimem sync` before reading project Engram exports.
- Use only the project `.engram/chunks/` export; never read the Engram database or credentials.
- Keep `gate_mode: "on"`, `gate_no_regression: true`, `redact_secrets: true`, and `auto_adopt: false`.
- Start with the deterministic mock backend and `dry-run`.
- Treat staged output as a proposal. Adoption requires a separate human-reviewed work-unit commit.

## Commands

Set `SKILLOPT_SLEEP_REPO` to the installed SkillOpt checkout when the runtime is not on `PATH`:

```bash
python -m skillopt_sleep status --project "$PWD"
python -m skillopt_sleep dry-run --project "$PWD" --source pi \
  --backend mock \
  --target-skill-path "$HOME/.agents/skills/skillopt-sleep-learned/SKILL.md" \
  --engram-chunks-dir "$PWD/.engram/chunks" --json
```

Use `--source pi`, `codex`, `claude`, or `opencode` only when that source is installed and the user authorized reading its redacted local session data. Never pass `--auto-adopt` implicitly. Read the generated `report.md` before discussing a staged proposal.

## Verification

Report the baseline and candidate scores, gate decision, task/session counts, staging path, and exact proposed files. A successful dry-run is not adoption and is not evidence that a live provider run is safe.
