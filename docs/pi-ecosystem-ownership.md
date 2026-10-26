# Pi ecosystem ownership and activation

This repository now uses one owner per responsibility. The changes fix the reproduced `project-memory` collision and make the model preflight and workflow intent adapter load through Pi's default extension directory without replacing native workflow execution.

## Quick path

1. Run `bash check-config.sh` after setup or upgrade.
2. Run `node agents/link-skills.mjs --verify` to audit shared skills.
3. If the audit reports a Pi-local duplicate, review `node agents/link-skills.mjs --only pi`, then apply it with `--apply`; identical copies are backed up, never deleted.
4. Use `/workflow` for explicit execution. Natural-language requests receive deterministic workflow guidance; ordinary questions remain ordinary Pi turns.

## Responsibility matrix

| Responsibility | Authoritative owner | Adapter or evidence |
| --- | --- | --- |
| Interactive session, tools, model calls, extension lifecycle | Pi 1.4.0 | `pi/agent/settings.json`, `pi/agent/package.json` |
| Workflow execution state, graph, retries, worktrees, catalog | `pi-extensible-workflows` | Native `/workflow`, `workflow_catalog`, and registered functions |
| Role identity, instructions, tools, aliases, and role-level policy | `@piewf/pi-ext-roles` and `pi/agent/pi-ext-roles/` | Role files and `pi-ext-roles/settings.json`; workflow functions pass roles through native agent options |
| Model discovery and operational availability | pi-model-fit plus CLIProxyAPI provider | `model-preflight.mjs` consumes the validated report; the `.js` adapter makes it loadable by Pi |
| Delegation and worker lifecycle | pi-extensible-workflows | Herdsman/Herdr integrations remain adapters; they do not own workflow state |
| Repository integration policy and final decision | Pi Herdr Orchestrator Master | The Master reconciles reviewed branch evidence, Git state, liveness, retry/escalation, fast-forward, and cleanup; PiWorkflow exposes `integrateReviewedIssues` as the bounded execution adapter |
| Commit-time review gate | GGA v2.10.1 | `.gga` and `agents/gga-pi/bin/kilo`; GGA is separate from native RDD review |
| Native change review | Gentle AI / Gentle Pi review authority | Review mode and reviewer lenses are separate from GGA and do not authorize delivery |
| Persistent memory backend | Engram / `gentle-engram` | Project-memory is the repository-memory contract, not a second backend |
| Shared skill files | `~/.agents/skills` | `agents/skills.manifest.json` and `agents/link-skills.mjs`; Pi reads the canonical root |
| Natural-language workflow intent | `workflow-intent.mjs` | Deterministic trigger and score rules add request-scoped guidance only; native workflow dispatch remains authoritative |

## Request pipeline

```text
user prompt
  -> Pi input and before_agent_start
  -> workflow-intent.mjs (only when a workflow trigger is present)
  -> deterministic catalog match or clarification guidance
  -> model calls native workflow tools / /workflow
  -> pi-extensible-workflows resolves roles and executes the graph
  -> reviewed branch evidence returns to the Master
  -> the Master invokes the bounded integration adapter after rechecking Git state and ownership
  -> canonical model aliases and preflight guard model availability
  -> GGA or native review validates the relevant change boundary
  -> Engram/project-memory persists the appropriate project or session record
```

Explicit `/workflow` commands pass through unchanged. Natural-language matching is intentionally conservative: it requires a workflow signal, ranks only catalog functions with declared rules, and does nothing for ordinary questions. Equal top scores produce clarification guidance instead of silently selecting a workflow.

The built-in `parallelReviewAndSecurity` function runs reviewer and security analysis in parallel, sends both findings to the canonical developer role for the smallest safe fix, and asks the architect role for a final verdict. It is registered by `pi/agent/extensions/piextworkflows.ts`.

Issue development follows the same boundary: `developIssues` prepares isolated, reviewed branches and returns integration-ready evidence; the Master calls `integrateReviewedIssues` before any main-worktree fast-forward or merged-worktree cleanup. A child workflow cannot treat a passing review as implicit repository-level authority.

## Governed child briefs and knowledge loop (TeamAI-derived architecture)

To prevent scheduler split-brain and runtime bloat, governance and knowledge loop patterns are decoupled across distinct authorities:

| Component | Responsibility & Ownership |
| --- | --- |
| Child agent governance (`GovernedChildBrief`) | `pi-extensible-workflows` core owns execution governance; child agents declare task instructions, `changes` policies (`none` \| `commit` \| `keep`), tool ceilings, structured outputs, and content-addressed evidence offloading. Mutating tools are stripped automatically when `changes: "none"`. |
| Human-in-the-Loop gates | `workflow_respond` and `checkpoint()` support structured `choice` and `feedback` payloads alongside boolean approvals, persisting operator decisions in the run journal. |
| Role specification | `@piewf/pi-ext-roles` owns role files, discovery, frontmatter, and instructions. The workflow core remains role-agnostic. |
| Knowledge loop & offline optimization | Engram owns associative memory storage (`.engram/chunks/`); SkillOpt owns offline reflective optimization (`skillopt_sleep`) without modifying running workflows. SkillOpt decompresses `.jsonl.gz` chunks to inspect past evidence safely behind held-out gates. |

## Collision ownership

Shared skills, including `project-memory`, are installed once into `~/.agents/skills`. All shared `npx skills add` calls in `setup_env.sh` target only the `cline` canonical materialization and never ask the skills installer to create a Pi-local copy. The manifest marks the skill as managed, while Pi's `readsCanonical: true` policy prevents a second Pi-root registration.

`check-config.sh` fails when a managed skill is physically present below `~/.pi/agent/skills`. The linker is the remediation authority:

```bash
node agents/link-skills.mjs --only pi --skill project-memory
node agents/link-skills.mjs --apply --only pi --skill project-memory
node agents/link-skills.mjs --verify --only pi --skill project-memory
```

The live duplicate found during this change was moved to:

```text
/root/.pi/backups/link-skills-2026-10-23T19-05-48-766Z/pi/project-memory
```

The changed live extension entrypoints were synced from the repository after backing up the previous workflow barrel at:

```text
/root/.pi/backups/dotenv-pi-activation-20261023T190800/piextworkflows.ts
```

## Verification evidence

Repository and isolated checks passed:

- `node --test agents/*.test.mjs pi/agent/extensions/*.test.mjs tests/medium-effort-policy.test.mjs` — 84/85 passed; the non-root setup test could not execute its copied fixture under `/root` through `runuser` (exit 126).
- `bun test pi/agent/extensions/**/*.test.ts` — 12/12.
- `bash -n setup_env.sh check-config.sh`, Node syntax checks, and `git diff --check`.
- `bash check-config.sh`.
- Debian 13 and Arch latest containers with `diffutils` — final focused rows pass after the canonical-conflict and harness-presence fixes.
- A real symlinked `pi-model-fit` launcher through `runPreflightCommand` — valid JSON, probe `ok`, 70 models.
- Canonical skill integrity scan — 58 managed skills readable from `~/.agents/skills`.
- P EXTIL `workflow_catalog`, `parallelReviewAndSecurity`, and `tddDev` executions completed with bounded reports and tests.

The source-level adapter fixes the reproduced empty-stdout/import URL failure. The live linker audit currently reports five missing non-Pi `project-memory` links (`claude`, `codex`, `opencode`, `gemini`, `antigravity`); the isolated linker tests cover apply, verify, locking, conflicts, and backup behavior. The routing work is split across `8981788` and `5e4212c`; both slices received acknowledged native review evidence.

## Limits and rollback

The current live Pi process still has the pre-fix extension: `PI_OFFLINE=1 pi --print --no-tools --no-session ...` exits 0 and prints `READY`, but emits `model preflight unavailable: invalid model preflight output: Unexpected end of JSON input` before the prompt. Syncing the repository-owned extension to `~/.pi/agent` and applying the five non-Pi skill links requires explicit authorization to write outside this repository.

Provider-backed inference, entitlement, and live workflow execution remain unproven. Offline Pi cannot validate provider inference, and source-level routing tests use isolated fakes. Do not treat catalog visibility or these tests as proof of provider quota, authentication, or remote inference.

To roll back the repository change, restore the tracked files from Git without deleting live state. To roll back the live sync, restore the backed-up `piextworkflows.ts` and remove only the newly synced repository-owned entrypoints after stopping Pi. To restore the old project-memory copy for investigation, copy it from the linker backup; do not put both copies back into active Pi discovery paths.

Commits `8981788` and `5e4212c` are present locally. Final verification records the environment-specific Node failure above; no push, merge, release, or provider configuration change was performed.
