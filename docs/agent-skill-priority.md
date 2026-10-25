# Agent skill priority index

This index defines when commonly used skills should be loaded. It is a routing aid, not a second ownership system.

## Ownership

| Concern | Owner | Do not duplicate |
| --- | --- | --- |
| Durable workflows, phases, budgets, retries, worktrees, and results | `pi-extensible-workflows` | Gentle AI workflow execution |
| Role prompts, role model aliases, tools, and effort defaults | `@piewf/pi-ext-roles` | Per-workflow model selection logic |
| Model inventory, route evidence, context budgets, and failover refresh | `pi-model-fit` | Credentials, billing claims, or workflow orchestration |
| Pane lifecycle, liveness, and external session control | `pi-herdr-orchestrator` / Herdr | Workflow state and retry ownership |
| Project memory and durable decisions | Engram / `project-memory` | Provider routing and code changes |
| Commit-time review gate | GGA | Native workflow review or model-fit selection |
| Gentle AI compatibility | Future adapter layer only | A second runtime, duplicate subagents, or Gentle Review |

## Priority tiers

### P0: load for repository work

- `engineering-excellence`: implementation and verification baseline.
- `project-memory`: repository decisions, discoveries, and handoffs.
- `writing-for-agents`: changes to `AGENTS.md`, skills, directives, or agent-facing docs.
- `work-unit-commits`: implementation boundaries and coherent delivery slices.

### P1: load by task trigger

- `pi-model-fit`: provider/model/effort selection, catalog discovery, context budgets, GGA reviewer routing, or failover.
- `pi-herdr-orchestrator`: multiple sessions, panes, worktrees, liveness, backlog orchestration, or cross-repository integration.
- `pi-extensible-workflows`: workflow design, registered functions, recovery, replay, worktrees, or multi-agent orchestration.
- `tdd`: a new behavior, bug fix, regression test, or integration test.
- `diagnosing-bugs`: a reported failure, regression, timeout, or unexplained runtime behavior.
- `code-review`: review of a branch, PR, candidate diff, or connected call path.
- `tigerstyle`: reliability-sensitive runtime, async ownership, resource bounds, or validation changes.

### P2: load for specialized work

- `research`: evidence gathering against external or primary sources.
- `domain-modeling`: glossary, terminology, ADR, or bounded domain decisions.
- `cognitive-doc-design`: README, architecture, onboarding, or review-facing documentation.
- `skill-creator`, `skill-improver`, `skill-registry`: skill lifecycle work only.
- `container-test-matrix`: scripts, installers, packaging, CLI entrypoints, or OS-dependent behavior.
- `issue-ops`, `pr`, `chained-pr`: issue and pull-request work only.

### P3: load only for the requested product surface

- `impeccable`, `design-taste-frontend`, `phantom-ui`, `heroui-react`, and `apple-design`: frontend or interaction work.
- `image-generation`: generated or edited bitmap assets.
- `go-testing`, `typescript-advanced`, `email-html-mjml`, and other stack-specific skills: only when the changed surface matches.

## Selection rules

1. Start with the smallest tier that matches the request.
2. Add the task-triggered P1 skill before changing shared routing, workflow, auth, database, or agent-pipeline code.
3. Use `pi-model-fit` for evidence and recommendations; keep actual orchestration in PiWorkflow and keep credentials untouched.
4. Use a role that matches the work, then add only the skill needed for that role's task. Do not load every P1 skill for an ordinary question.
5. Keep Gentle AI compatibility limited to prompts, task framing, memory conventions, and optional adapters until a separate issue proves a runtime need. PiWorkflow remains the sole workflow executor.
6. A skill is globally installed only after it exists in the canonical `~/.agents/skills` root, is declared in `agents/skills.manifest.json`, and passes the linker verification.

## Current global enablement

- `pi-extensible-workflows` is installed and active at version 6.3.0.
- `@piewf/pi-ext-roles`, Herdr, Engram, and the CLIProxyAPI provider are installed in the global Pi profile.
- `pi-model-fit` is installed in the canonical shared skill root and is declared for the supported agent roots.
- The existing model-preflight extension remains the automatic session-start owner. The separate runtime-model-refresh extension stays on-demand until duplicate refresh ownership is explicitly removed.
- Standalone workflow subagents remain disabled in this profile to avoid a second execution surface.

## Verification contract

Every model or failover decision records:

- exact `provider/model:effort` route;
- Pi-listed, entitlement, inference, and quota evidence separately;
- context window, max output, and compaction reserve;
- primary and ordered fallback routes;
- unavailable or unknown routes and the command that proves the state.

Catalog visibility alone never authorizes a default, a failover route, or an inference claim.

## PiWorkflow agent loadouts

PiWorkflow is the execution owner. Agents receive only the role skills needed for their contract; they do not create a second scheduler.

| Role | Required skills | Purpose |
| --- | --- | --- |
| `scout` | `pi-herdr-orchestrator`, `engineering-excellence` | Bounded discovery and capability evidence |
| `developer` | `engineering-excellence`, `pi-extensible-workflows`, `pi-herdr-orchestrator`, `project-memory`, `tdd`, `work-unit-commits` | Isolated implementation, tests, and mailbox handoff |
| `architect` | `engineering-excellence`, `pi-extensible-workflows`, `pi-herdr-orchestrator` | Boundaries, dependency graph, and dispatch design |
| `researcher` | `research`, `pi-model-fit`, `pi-herdr-orchestrator`, `engineering-excellence` | Official-source research and route evidence |
| `reviewer` | `engineering-excellence`, `code-review`, `pi-herdr-orchestrator` | Independent findings and evidence-based review |

The registered `git:github.com/darkrei08/pi-herdr-orchestration@e8e52d3a358f036f5cb2bcb517b0abe572d3d216` package (the immutable commit behind v1.2.6) is the intended source of the native `orch_report`, `orch_status`, `orch_ask`, `orch_reply`, and `orch_evidence` tools. Use them as the mailbox/evidence boundary from PiWorkflow; use `@piewf/herdr` only for inspectable session transport. Herdr pane labels are presentation, not authority. The local extension fix for Pi 1.4's `registerCommand(name, options)` contract passes the package tests and a temporary RPC loader smoke; the pinned global tag needs a release/update before claiming the live global `/orch` command.

## Gentle AI compatibility boundary

`gentle-pi` is registered with its presentation, codegraph, and standalone-agent extensions excluded. Gentle AI may provide task framing and ODD-compatible prompts, while PiWorkflow remains the only workflow/subagent executor. This avoids duplicate scheduler and subagent ownership. `extensionSettings.herdr.enableFullyInspectableMode` is enabled in the canonical workflow settings so PiWorkflow can expose its runs through Herdr when the runtime is available.

## Official model-fit source precedence

Refresh evidence in this order:

1. Pi runtime catalog: `pi --list-models` and `https://pi.dev/docs/latest/models`.
2. Local CLIProxyAPI catalog when the gateway is available: `GET http://127.0.0.1:8317/v1/models` and the official quick start at `https://help.router-for.me/introduction/quick-start.html`.
3. Public metadata cross-checks: `https://models.dev/api.json` and LiteLLM's official catalog source.

Record `Pi-listed`, `catalog-listed`, `entitled`, `inference-verified`, `effort-verified`, and `quota-verified` separately. The 2026-10-25 refresh found 71 Pi-listed models and 7 ready catalog-derived HA groups; it did not prove entitlement, inference, effort support, or quota. Active aliases therefore remain unchanged until a credential-safe probe verifies those facts.
