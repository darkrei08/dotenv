# Development process directives (routing and config)

Process rules for agents working on Pi routing, gateway and config surfaces in
this repository and in the repos it feeds (`pi-extensible-workflows`, `pi-model-fit`,
the CLIProxyAPI stack, the GGA review gate). Each directive is written as rule,
the failure it prevents, and the check that proves it still holds. The rules exist
because each one was paid for by a concrete incident, named inline.

Read this before changing `pi/agent/ha-failover.example.json`,
`pi/agent/pi-ext-roles/settings.json`, `pi/agent/pi-ha-role-groups.json`,
`check-config.sh`, `REVIEW_RULES.md`, or any skill in `~/.agents/skills`.

## Provenance

Evidence was read, not assumed, at these revisions:

| Source | Revision |
| --- | --- |
| `dotenv` (this repo) | `fdc303b` on `feat/pi-unified-ui-20261026` |
| `dotenv` worktree `.worktrees/model-alias-matrix-sync` | `3b178b3` on `fix/model-alias-matrix-sync` (`7cea380`, `51f559b`, `34f1b15`, `3b178b3`) |
| `pi-model-fit` | `e9e7e3e` on `main`; `.worktrees/docs-free-go-model-fit/odd/tasks/model-routing-wayfinder.md` on `feat/model-routing-wayfinder` |
| `gentleman-guardian-angel` | `f7ad38a` on `feat/pi-provider` |
| `cliproxy-stack` | `cbb28fc` (`3ad72e9` is the frame-ancestors fix) |
| `cpa-usage-keeper` | `be7f27ad` |

`pi-model-fit/reports/2026-10-31-*.md` does not exist; the newest dated report is
`pi-model-fit/reports/2026-10-26.md`. Where an incident has no committed artifact,
the directive says so instead of inventing a citation.

## Directives

### D1. HA group entries are bare `provider/model` ids; effort lives in the alias

**Rule.** Every entry in `pi/agent/ha-failover.example.json` is
`{"id": "<provider>/<model>"}`. No `:off`, `:high`, `:xhigh` suffix. Effort belongs
only to alias targets in `pi/agent/pi-ext-roles/settings.json`, and failover inherits
the session thinking level. Alias names stay 1:1 with the pi-ext-roles role aliases.

**Failure prevented.** The HA extension resolves an entry id by exact registry id.
A suffixed entry never matches, is skipped, and the failover chain silently becomes
a no-op — the worst possible shape of bug, because routing still "works" while
resilience is gone. Fixed in `3b178b3` ("the HA extension resolves an entry id by
exact registry id, so a `:effort` suffix never matches and the entry is skipped").

**How to verify.** `node --test tests/model-alias-matrix.test.mjs` on
`fix/model-alias-matrix-sync` (`3b178b3`), case "HA entries are bare provider/model
ids" — the file does not exist on the current `feat/pi-unified-ui-20261026` line, where
only `tests/medium-effort-policy.test.mjs` and `tests/role-tool-policy.sh` are tracked.
`bash check-config.sh` covers role-primaries-in-group coverage at `check-config.sh:408`.
A one-liner that must print nothing:
`jq -r '.groups[].entries[].id' pi/agent/ha-failover.example.json | grep ':'`.

### D2. Provider-to-gateway policy is fixed: gateway for OpenAI/Gemini/Claude, DeepSeek only on OpenCode Go

**Rule.** `cliproxyapi` serves the OpenAI/Codex, Antigravity (Gemini) and Claude
subscriptions. `opencode-go` carries DeepSeek models only. Native catalogs
(`openai-codex`, `anthropic`) remain defined as manual fallbacks and stay out of
`enabledModels`. A new provider is added by policy change, not by pointing one alias
at it.

**Failure prevented.** `7cea380` found legacy aliases preferring `tuxevil-rotator`, a
provider absent from the catalog, and `old-reviewer-model` pointing at an OpenCode Go
Grok route; `3b178b3` then removed the failover-only `opencode-go/gpt-6-luna` route on
the same ground. Aliases that name an unlisted provider fail at launch, not at config
load, so the defect only surfaces under load.

**How to verify.** On `3b178b3`, `node --test tests/model-alias-matrix.test.mjs`
cases "only the approved providers are routed to" and "OpenCode Go routes carry
DeepSeek models only" (`allowedProviders` is the policy in code); `bash check-config.sh`;
`pi --list-models` for the provider actually being routed to.

### D3. No route is promoted on catalog evidence alone

**Rule.** Keep these states separate and record which one you hold:
catalog-listed, Pi-listed, entitled, inference-verified, quota-verified. A route may
become a primary or a failover member only after a bounded probe shows it answers;
when an existing primary stops answering, the commit that adds reachable routes behind
it also records the probe results.

**Failure prevented.** `34f1b15`: three canonical primaries were simultaneously
unusable (the Codex account behind `gpt-5.6-luna` quota-exhausted; the gateway answered
both Claude routes with the same ChatGPT usage-limit error), so reviewer, security and
the Sonnet roles had no reachable fallback and delegated workers died at the first
token.

**How to verify.** `node scripts/preflight.mjs --json --refresh` in `pi-model-fit`
emits `reachable` / `unavailable` / `unknown` per route and must not be read as a
catalog check; `pi-model-fit/references/subscription-gateway-evidence.md` defines the
permitted use of each state; `bash check-config.sh` fails when a role primary has no
group.

### D4. Send a descriptive User-Agent, and classify an error before naming its cause

**Rule.** Every outbound HTTP call to a model or gateway API sends `user-agent` and
`accept` headers. When a call fails, record the status code, the error class and the
body marker before writing any conclusion. A `403` carrying Cloudflare `1010`, or an
`insufficient_quota` body returned to a client with no User-Agent, is a client-policy
rejection: re-probe with a compliant header set before recording "quota exhausted"
anywhere.

**Failure prevented.** OpenCode Go rejects clients that send no User-Agent, and reports
that rejection as `insufficient_quota` plus Cloudflare `1010`. Read literally, the body
says the account has no quota, which invites retiring a working provider, re-routing
every role, and filing a false quota claim in a report. This incident was observed in
session; the only committed artifact is the importing rule in
`pi-model-fit/references/subscription-gateway-evidence.md` step 4 ("record
success/failure, latency, timeout/error class ...") — there is no dated report for it.

**How to verify.** `pi-model-fit/scripts/sources.mjs:16` already sets
`USER_AGENT = "pi-model-fit/1.0 (+https://github.com/darkrei08/pi-model-fit)"`; the
same header discipline applies to every new probe. Any evidence line that marks a route
quota-unavailable must carry the status code and marker that produced it.

### D5. A URL a browser loads must be reachable from the browser, not from the server

**Rule.** For embedded panels, distinguish the container-to-container address from the
browser-facing origin. `keeper_url` is loaded by the browser (`<keeper_url>?embed=cpamc`),
so it must be an origin the client can resolve and reach, and the embedded app's CSP must
name the embedding origin — CPA Usage Keeper derives `frame-ancestors` from a single
`CPA_PUBLIC_URL`.

**Failure prevented.** `cliproxy-stack` `3ad72e9`: the panel embedded Keeper in an
iframe while Keeper answered `frame-ancestors 'self'`, so the browser refused to render
the frame; the panel waited out an eight-second handshake and showed "CPA Usage Keeper
is not available". The version text in that message is static, which sends the reader
hunting a version problem that does not exist. An internal compose hostname such as
`http://cpa-usage-keeper:8080` in `keeper_url` produces the same symptom.

**How to verify.** From a client machine, not the host shell:
`curl -sI http://<keeper-host>:8080/ | grep -i content-security-policy` must list the
panel origin in `frame-ancestors`; then open the panel from a second device.
`cliproxy-stack/README.md` documents both the reachability requirement and the failure
message.

### D6. One writer per config file; tracked copies are projections

**Rule.** Live `~/.pi/agent` is written only by `setup_env.sh` and the module install
flows. Tracked files under `pi/agent/` are projections of that authority: a projection
edit and its source change land in the same commit, and no second system owns the same
entries (the module-owned packages are enumerated in `docs/pi-configuration.md`).
Checkers compare the projection against its source instead of restating literals.

**Failure prevented.** `7cea380`: the tracked `pi-ext-roles` copy was four roles behind
live and carried pre-diversification specs, and `ha-failover.example.json` had drifted
behind `ha.json` (development had lost the Luna primary). Whoever read the repository
believed the wrong matrix — including the pre-commit reviewer, which then rejected the
corrected labels.

**How to verify.** `bash check-config.sh` must exit 0; its live comparison is at
`check-config.sh:244` (`{modelAliases, tools, extensions}` of the tracked copy versus
`~/.pi/agent/pi-ext-roles/settings.json`). Note that it currently exits 1 on
`fdc303b` and on `3b178b3` for exactly this drift — the checker is doing its job.

### D7. A fork records its upstream base, its reason, and its pin; rebase on a cadence

**Rule.** Every local fork states in the document that consumes it: the upstream
repository, the base commit or tag, why the fork exists, and the pin the consumer uses.
Refresh the base on a fixed cadence and before any release. A fork that diverges in the
storage layer is a standing rebase cost and must be described as one.

**Failure prevented.** `cpa-usage-keeper` is a fork kept because it is the only variant
with PostgreSQL support while upstream writes usage to SQLite
(`cliproxy-stack/README.md` line 12). Every upstream release is therefore a manual
rebase of the persistence layer, not a merge — a cost that is invisible unless written
down, and one that silently turns into a stale local image.

**How to verify.** The pin is visible in the consuming config, as with
`pi-herdr-orchestration` pinned to commit `e8e52d3a358f036f5cb2bcb517b0abe572d3d216` in
`docs/pi-configuration.md`; the delta is countable with
`git -C cpa-usage-keeper log --oneline <upstream-base>..HEAD | wc -l`, and that number
belongs in the document that states the reason.

### D8. Know what a diff-only reviewer may and may not be asked to verify

**Rule.** The pre-commit gate (`agents/gga-pi/profiles/reviewer.gga`, `RULES_FILE="AGENTS.md"`)
sees a diff plus the rules file and nothing else. Ask it for: JSON/shell parse validity,
internal consistency between files present in the diff, contradictions against the rules
file, dead code and silent error handling in the diff, secrets. Do **not** ask it for:
live runtime state, whether a route answers today, whether a test passes in another
worktree, what an installed copy under `~/.agents/skills` says, or a fact that exists only
outside the diff. When a rule needs a source the diff cannot show, the rules file must
carry that source.

**Failure prevented.** In `7cea380`, the reviewer blocked the corrected model labels
because `REVIEW_RULES.md`, `pi/agent/MODELS.md` and `docs/pi-configuration.md` still
described the pre-diversification matrix — the rule file was stale, so the correct answer
looked wrong. The same mechanism blocks `pi-model-fit/references/rubric.md`: its Output
Rules require a source URL and read date per row, the role table has no per-row sources,
and a diff-only reviewer cannot accept an edit it cannot verify from the diff.

**How to verify.** Every blocker must quote a file that is in the diff or is the rules
file; a blocker that rests only on outside-diff state is a rules defect, fixed in the same
commit by making the rule self-contained. Before editing a sourced table, add the source
column first, in its own commit.

### D9. Tests assert invariants, never one literal chain

**Rule.** A routing test derives its expectation from the configuration (resolve the
role, resolve the alias, look the group up) and its failure message names the role or
route. A literal chain copied from today's config is a second source of truth and is not
allowed in a test.

**Failure prevented.** Verified today, in two trees:
`pi/agent/extensions/pi-ha-bootstrap.test.mjs:9` asserts the literal development chain
`[cliproxyapi/claude-sonnet-4-6:off, cliproxyapi/gemini-3.8-flash-high:medium]`, so it
goes red (2 of 3 cases) in `.worktrees/model-alias-matrix-sync` once HA ids are bare
(assertion D1), while passing on `fdc303b` where the suffixed ids still match.
`pi/agent/extensions/pi-ha-role-groups/bind.test.mjs` is red in both trees on
"bootstrap returns configured fallbacks": it names `oracle` on `fdc303b` and `qa` on
`3b178b3`. Two red HA tests with hardcoded chains, and a reader cannot tell from the
red state which one is the defect.

**How to verify.** `node --test pi/agent/extensions/pi-ha-bootstrap.test.mjs
pi/agent/extensions/pi-ha-role-groups/bind.test.mjs` must be green in the tree you are
committing to. Green in a sibling worktree proves nothing about this one.

## D10 - Dispatch contract: PiWorkflow through its pi-extensible-workflows extension, roles from pi-ext-roles

**Rule.** `pi-extensible-workflows` is the PiWorkflow execution engine in this fleet: the `workflow` tool, with `agent`, `parallel`, `pipeline` and `prompt`, is PiWorkflow. Naming it is therefore not a second scheduler, and no other scheduler may be introduced. Every delegated unit runs as a workflow agent configured by `role` (from `pi-ext-roles`) plus `skills`; mailbox and evidence go through the pi-herdr-orchestration package, and inspectable transport goes through `@piewf/herdr`, as that package's own rules require. Pi's built-in subagent tool is not part of the dispatch path. Passing an explicit `model` is an exception that must be justified in the brief and repeated in the report, because it overrides the role's canonical route and its failover group.

**Failure prevented.** Two dispatchers with two configuration surfaces: a built-in subagent runs with its own defaults, ignores the role matrix, and produces work whose model, skills and tools cannot be reproduced from the repository. When that happens a failure cannot be attributed to a role, an alias or a matrix entry, so the routing policy stops being enforceable.

**How to verify.** A run is compliant when its launch source contains `parallel` or `pipeline` over `agent`, every agent carries a `role`, no agent passes `model` without a stated reason, and the run is driven by the `workflow` tool rather than the built-in subagent tool. Reproduce by re-running the same source: same roles, same selectors, same order.

## D12 - Context budget: 150K delegation threshold, 256K ceiling, compaction as fallback

**Rule.** Four verifiable bounds govern session context budgets across all models and roles: (a) 256K is the absolute context ceiling for this fleet, DeepSeek included, because 1M is the model maximum and not a budget to spend; (b) 150K is the delegation threshold, above which work moves to a workflow or a fresh session with an Engram handoff; (c) compaction is the last net and not the plan, which is why reserveTokens is 32768; (d) measure one thing at the end of every turn, the parent context tokens, and if it is above 150K the next turn starts by delegating.

**Failure prevented.** Reasoning degradation, context overrun, and token exhaustion from unbounded single-session accretion. Models advertising large theoretical windows suffer latency spikes and instruction drift under deep context; treating compaction as normal operating workflow drops critical task details and prior decisions, while a tight reserve risks turn failure when generating near limits.

**How to verify.** Check session context tokens at the end of each turn (`get_session_stats.contextUsage.tokens` or session status): if parent context tokens exceed 150K, verify the next action is a workflow dispatch or a fresh session handoff via Engram rather than additional inline tools. Verify that no session in the fleet exceeds 256K tokens, and verify that `jq .compaction.reserveTokens ~/.pi/agent/settings.json` reports 32768.

## Skill consolidation proposal

Scope: the skills that touch routing, config and the gates around them. Verdicts are
conservative — a merge is proposed only where the surviving text already exists at a
named path, and retirement only where the content is demonstrably superseded.

Source of the allowlist: `/root/.pi/agent/pi-ext-roles/settings.json` (`skills`), plus
the routing-relevant entries under `/root/.agents/skills` and `/root/.pi/agent/skills`.

| Skill | Location | Verdict | Reason |
| --- | --- | --- | --- |
| `engineering-excellence` | `~/.agents/skills/engineering-excellence/SKILL.md` | keep (merge target) | Already owns the standards layer (`references/architecture.md`, `references/testing.md`, `references/code-review.md`); it is the only skill with a reference per concern, so it is the consolidation point. |
| `pi-model-fit` | `~/.agents/skills/pi-model-fit/SKILL.md` | keep | Sole owner of route evidence states and the probe protocol (`references/subscription-gateway-evidence.md`); nothing else may absorb it without losing the evidence gates in D3/D4. |
| `pi-extensible-workflows` | `~/.pi/agent/npm/node_modules/pi-extensible-workflows/skills/pi-extensible-workflows/SKILL.md` | keep | Defines how workflow runs resolve `modelAliases`; the alias chain semantics in D1 depend on it. |
| `pi-herdr-orchestrator` | `~/.agents/skills/pi-herdr-orchestrator/SKILL.md` | keep | Owns dispatch, worktrees and `references/routing.md`; the single Pi-visible copy is deliberate (`docs/pi-configuration.md`, skill-name collision note). |
| `herdr` | `~/.agents/skills/herdr/SKILL.md` | keep | Terminal control surface only; no overlap with routing policy. |
| `skillopt-sleep` | `~/.agents/skills/skillopt-sleep/SKILL.md` | keep | The engine driver for the SkillOpt section below; retiring it removes the only mechanism that consumes these signals. |
| `skill-creator` | `~/.agents/skills/skill-creator/SKILL.md` | merge into `writing-for-agents` | Creation contract overlaps `writing-for-agents/SKILL-MECHANICS.md` (frontmatter, invocation, router skills); the duplicated style guide is the seam. Staged, not immediate: the 104-line creation contract is not yet fully covered there. |
| `skill-improver` | `~/.agents/skills/skill-improver/SKILL.md` | keep | Discounts itself as the audit/upgrade contract and points at `references/skill-style-guide.md`; it is the surviving holder of the style rules. |
| `skill-creator/references/skill-style-guide.md` | `~/.agents/skills/skill-creator/references/skill-style-guide.md` | retire (file, not skill) | Byte-identical to `skill-improver/references/skill-style-guide.md` (verified with `diff -q`); one copy is enough. Surviving text: `~/.agents/skills/skill-improver/references/skill-style-guide.md`. |
| `skill-registry` | `~/.agents/skills/skill-registry/SKILL.md` | keep | It is the generator contract for `.atl/skill-registry.md` (for example `pi-model-fit/.atl/skill-registry.md`); `skill-improver` reads that index, so the skill is load-bearing. |
| `code-review` | `~/.agents/skills/code-review/SKILL.md` | keep, overlap noted | The two-axis (Standards + Spec) sub-agent procedure is not in `engineering-excellence/references/code-review.md`; merging now would drop the procedure. Revisit only after that reference holds it. |
| `tdd` | `~/.agents/skills/tdd/SKILL.md` | keep, overlap noted | `engineering-excellence/references/tdd.md` states the policy; `tdd/tests.md` and `tdd/mocking.md` carry the loop detail. D9 needs the detail, so no merge yet. |
| `work-unit-commits` | `~/.agents/skills/work-unit-commits/SKILL.md` | keep | Defines the ≤400-line reviewable slice that `AGENTS.md` already requires; D6's "same commit" rule depends on it. |
| `writing-for-agents` | `~/.agents/skills/writing-for-agents/SKILL.md` | keep | Owner of skill/document writing mechanics (`SKILL-MECHANICS.md`); D8's rules-file rule is an application of it. |
| `project-memory` | `~/.agents/skills/project-memory/SKILL.md` | keep | Repository memory under `.ai/`; no routing overlap. |
| `research` | `~/.agents/skills/research/SKILL.md` | keep | Background research delegation; `pi-model-fit` step 5 depends on that split. |
| `cognitive-doc-design` | `~/.agents/skills/cognitive-doc-design/SKILL.md` | keep | Governs this document's shape; no other skill covers doc cognitive load. |
| `wayfinder` | `~/.agents/skills/wayfinder/SKILL.md` | keep | Owns the decision-ticket map that produced `pi-model-fit/odd/tasks/model-routing-wayfinder.md`; explicitly non-invocable by model, so it cannot collide. |
| `judgment-day` | `~/.agents/skills/judgment-day/SKILL.md` | keep | Adversarial dual review; `pi-model-fit/SKILL.md` names it as the two-view logic. |
| `typescript-advanced` | `~/.agents/skills/typescript-advanced/SKILL.md` | keep | Compile-time contracts only; orthogonal to routing policy. |
| `tigerstyle` | `~/.pi/agent/skills/tigerstyle/SKILL.md` | keep | Safety/ownership discipline for runtime code; the HA and bootstrap `.mjs` changes are its scope. |
| `gentle-ai` | `~/.pi/agent/skills/gentle-ai/SKILL.md` | keep | ODD/task-tracking layer; no standards overlap. |
| `ponytail` | `~/.pi/agent/git/github.com/DietrichGebert/ponytail/skills/ponytail/SKILL.md` | keep | Injected ruleset from a git-package install (`docs/pi-configuration.md`), not a knowledge skill; merging it would change every turn's behaviour. |
| `impeccable` | `~/.agents/skills/impeccable` | keep | Upstream distribution with its own installer (`agents/install-agent-extensions.sh`); not ours to merge. |
| `phantom-ui` | `~/.agents/skills/phantom-ui` | keep | Vendored standalone build plus `VENDORED.md`; merging would break the vendor boundary. |

Deliberately **not** recommended: retiring any whole skill. Nothing in this evidence
set shows a skill fully superseded — `skill-creator` is partly covered, `code-review`
and `tdd` overlap but carry procedure text that exists nowhere else. The only
retirement here is the duplicate style-guide file.

## SkillOpt input

Consumable by `skillopt/config.example.json` (`gate_mode: "on"`,
`gate_no_regression: true`, `auto_adopt: false`, `redact_secrets: true`). Candidate
tasks are phrased so a single skill edit is the only variable.

**Candidate tasks**

1. `pi-model-fit`: add the D4 classification step to the route-health bullet in
   `SKILL.md` and to `references/subscription-gateway-evidence.md` (a UA-less 403 is
   not a quota fact).
2. `pi-model-fit`: add the pre-edit provenance rule to `references/rubric.md` — a
   sourced table is extended by adding the source column first (D8).
3. `skill-improver`: fold the diff-only reviewer scope (D8) into the audit checklist,
   since a rules file is what the reviewer reads.
4. `pi-herdr-orchestrator`: add the "green in another worktree proves nothing" clause
   (D9) to the quality reference it uses for validation.
5. `engineering-excellence`: add a one-paragraph "one writer per generated config"
   rule (D6) to `references/architecture.md`.

**Observable signal that an edit helped** (all mechanical, no self-assessment):

- A test that flips red → green: `node --test tests/model-alias-matrix.test.mjs`
  (6/6 on `3b178b3`) and
  `node --test pi/agent/extensions/pi-ha-bootstrap.test.mjs pi/agent/extensions/pi-ha-role-groups/bind.test.mjs`
  — currently 3 distinct red cases (2 in the bootstrap file, 1 in the role-group file;
  4 red reports across the two trees).
- A repeated false blocker that stops appearing: GGA output no longer rejects a
  correct label change on the strength of a stale rules file (the `7cea380` pattern),
  counted over consecutive commits on the same branch.
- `bash check-config.sh` exit 1 → 0 on drift that the edit caused to be detected and
  repaired, never by relaxing the check.
- A rule that a fresh reader can apply without opening a second file: measure by
  asking a reviewer to quote the rule alone and produce the correct verdict.

**Held-out check.** Withhold two incidents from this document's set when assembling the
training input — suggested: D5 (keeper `frame-ancestors`) and D7 (fork rebase cost) —
then replay them against the edited skills in a mock run: the skill must reach the
correct verdict with no access to this file. Gate settings as in
`skillopt/config.example.json`; a proposal that fails a held-out case is not adopted,
regardless of how well it scores on the visible ones.

## Open gaps

- **Runtime behaviour of the new provider route.** Whether
  `opencode-go/deepseek-v4.1-flash` answers end to end after the default switch is not
  verified here. It needs a live `pi --list-models opencode-go` and a bare
  `pi --mode json -p` run; `pi-model-fit/odd/tasks/model-routing-wayfinder.md` on
  `feat/model-routing-wayfinder` (under `.worktrees/docs-free-go-model-fit`; L7, L8)
  records the earlier evidence, and the route is paid on the Go plan.
- **Postgres CI test.** `cpa-usage-keeper` runs `go test ./cmd/... ./internal/...` at
  `.github/workflows/ci.yml:138` with no `services:` block in any workflow, so
  PostgreSQL compatibility is proved only by `make verify-docker` building an image
  (`Makefile:15`), not by a test. The fork's persistence path (D7) is therefore
  unguarded in CI.
- **Live HA failover under real quota errors.** The chains are asserted structurally
  (D1/D3) and the failover code is unit-tested with a fake failing `pi`
  (`agents/gga-pi.test.mjs`, 9/9 green; `spec/unit/providers_pi_spec.sh`, 19/19 green),
  but no test exhausts a real route. Failover on a live quota error remains unproven.
- **`pi-model-fit/references/rubric.md` provenance.** Blocked by design until a per-row
  source column exists; the file's own Output Rules require one per row. Not attempted
  here.
- **Live-versus-tracked drift.** `bash check-config.sh` exits 1 on `fdc303b` and on
  `3b178b3`. The drift is real and out of scope for a documentation commit; D6 gives the
  repair rule.
- **Allowlist entries with no installed skill.** `/root/.pi/agent/pi-ext-roles/settings.json`
  lists `image-generation` and `design-taste`; no such directory exists under
  `~/.agents/skills`, `~/.pi/agent/skills` or `~/.pi/agent/npm/node_modules`, and
  `agents/install-agent-extensions.sh:58` installs `h3nryprod01/design-taste`, whose
  installed skill here is named `design-taste-frontend`. Whether that is an upstream
  rename or drift is unverified; do not "fix" the allowlist until it is known.

## Verification log

Commands run for this document, with results:

| Check | Result |
| --- | --- |
| `node --test tests/model-alias-matrix.test.mjs` (`3b178b3`) | 6/6 pass |
| `node --test tests/medium-effort-policy.test.mjs` (`3b178b3`) | 3/3 pass |
| `node --test pi/agent/extensions/pi-ha-bootstrap.test.mjs` (`3b178b3`) | 1 pass, 2 fail — hardcoded suffixed chain |
| `node --test pi/agent/extensions/pi-ha-role-groups/bind.test.mjs` (`3b178b3`) | 1 pass, 1 fail — "qa must have a bootstrap fallback" |
| `node --test pi/agent/extensions/pi-ha-role-groups/bind.test.mjs` (`fdc303b`) | 1 pass, 1 fail — "oracle must have a bootstrap fallback" |
| `node --test pi/agent/extensions/pi-ha-bootstrap.test.mjs` (`fdc303b`) | 3/3 pass — suffixed ids still match there |
| `node --test agents/gga-pi.test.mjs` (`fdc303b`) | 9/9 pass |
| `shellspec spec/unit/providers_pi_spec.sh` (`f7ad38a`) | 19/19 pass |
| `bash check-config.sh` (`fdc303b`) | exit 1 — tracked `pi-ext-roles` differs from live |
| `bash check-config.sh` (`3b178b3`) | exit 1 — tracked `settings.json` package entries differ from live |
