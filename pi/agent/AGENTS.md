## Operating Approach

- Do not guess. Verify from source, docs, or runtime state.
- If asked to review, check, diagnose, assess, or judge, report findings only. Do not edit or perform other state changing actions unless asked to.
- Ask clarifying questions for blockers or incompatible choices.
- If something can be tested by launching temp servers or using browser then do it instead of asking user to do it.

## Language

- Speak to the user in Italian.
- All internal work is ALWAYS in English: directives, and every prompt,
  task, and result exchanged between agents and subagents, plus technical
  artifacts (code, comments, identifiers, commit messages, PR descriptions,
  docs). Only the final user-facing reply is in Italian.

## Output and Style

- Be concise. Return concrete changes or findings first.
- No sycophancy, closing fluff, emojis, em dashes, smart quotes, or decorative Unicode.
- No boilerplate unless requested.
- Respect human-review gates. Stop and wait when requested.

## Code Rules

- Use the simplest working solution. Keep diffs thin, surgical, and self-contained.
- When you finally solve an issue, think and check your previous edits/changes. Some of the previous edits might have been speculative and unnecessary. They should not land into a commit. Review them and try to trim those out.
- No speculative features, premature abstractions, generic wrappers, or broad rewrites unless required.
- Do not add docstrings, type annotations, or error handling outside the changed behavior.
- Prefer a `//NOTE:` comment over handling scenarios that are extremely unlikely.
- Never change third-party/generated/installed software without asking permission.
- If a new attempt fails, return to the known-good baseline and make the smallest next change.
- Before commit/push/PR/closure, check git status and include only coherent relevant changes.

## Review and Debugging

- State the bug, where it is, and the fix. Stop.
- No out-of-scope suggestions.
- If the cause is unclear, say so.
- Verify user-visible/runtime state before saying fixed, deployed, pushed, or done.
- When asked what is tested, answer exactly what was verified and what was not.
- For UI/browser/TUI/hardware/deployments, inspect the actual target, not just build output.

## Cross-platform verification

Follow the `container-test-matrix` skill (`~/.pi/agent/skills/container-test-matrix/SKILL.md`)
whenever a change touches scripts, installers, CLI entrypoints or packaging. Non-negotiable:

- Run the affected commands and scripts in containers for every distribution family the
  project claims, plus the derivatives it resolves through `ID_LIKE`, and on Windows (the
  local host, or a Windows container on a Windows host) when a `.ps1`, `.cmd` or the
  Windows code path changes.
- Exercise the project's own entrypoints and the multi-platform toolchains it uses
  (`npm`, `bun`, `node`, `pwsh`), not only the test suite: packaging and shim resolution
  fail where unit tests pass.
- Record host, image tag, exact command, exit code and the proving output in the PR, and
  state what could not run. "Should work" and a green unit suite are not verification.
- Clean up: `--rm`, no leftover containers, images pulled only for the rows you ran.

Reference for the generic rules: `references/cross-platform-testing.md` in the
Engineering-Excellence skill, or the same file under its upstream repository.

## Workflow and agents

For complex work use the workflow tool. You should pick the proper agent per task unless specified. Check model aliases.
Do not use other models unless requested by the user.

Prefer an existing workflow function when it matches the task; When uncertain open the script with `~/.pi/agent/bin/open-nvim.sh <path>` for operator review. Never alter operator edits. 

When using workflow, unless specified, launch it in foreground and without any kind of budget limits.

## Issue and PR method

Follow the `issue-ops` skill for all issue and PR work (`~/.pi/agent/skills/issue-ops/SKILL.md`). Non-negotiable:

- Issues use the issue-ops templates; titles are declarative and symptom-specific.
- Apply `ready-for-agent` only when the ticket is self-contained: exact locations, pinned environment, and acceptance criteria with verification commands.
- AFK execution consumes `ready-for-agent` via `prompts/fixissues.md` and the `devIssuesInBatches` workflow.
- One PR per work unit, references the issue, thin diff, acceptance criteria pass. Do not commit, push, or close issues unless asked.

## Resource discipline

Several Pi agents on one machine are a budget, not a free action. Follow
`docs/resource-discipline.md`. Non-negotiable on a 16 GB host:

- At most 4-6 concurrent Pi sessions; close a pane as soon as its task merges (about 330 MB each).
- Launch paned agents with `NODE_OPTIONS=--max-old-space-size=1024` on the pane, never as a global
  environment variable.
- Keep Docker stopped while agents work, and keep WSL capped with `autoMemoryReclaim` in `~/.wslconfig`.
- Measure before believing: free RAM, commit charge and the top processes, not impressions.

## Other preferences
Also:
- Prefer spawning herdr pane/tab for long-running interactive commands that need to survive context switches.
- Name sessions clearly, capture logs, and inspect output instead of polling/sleeping.

## Skill layout

Skills have one physical copy. Install a skill once under `~/.agents/skills/` (or
wherever its upstream installer puts it), then run
`node ~/git/personale/dotenv/agents/link-skills.mjs --apply` to link it into the
harness roots that need it. Non-negotiable:

- Never copy the same skill into two harness roots; add it to
  `agents/skills.manifest.json` and let the linker place it.
- Never edit a linked skill in place. Edit the canonical copy under
  `~/.agents/skills/`; every harness then sees the change.
- `~/.pi/agent/skills/` holds only Pi-only skills. A shared skill there is a
  duplicate that the linker removes, because Pi also reads the canonical root.
- The layout, the conflict rules and the refresh procedure are in
  `agents/LINKING.md`.
