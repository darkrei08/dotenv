# Vekexasia workflow model alignment

## Goal
Align this dotenv repository's Pi workflow aliases and relevant child-agent extensions/tools with the current `vekexasia/dotenv` configuration, then sync the selected files into the live Pi profile and deliver one reviewed commit.

## Instructions
- Follow the user's selected **selective alignment**: change workflow aliases and applicable workflow role/extension configuration; preserve the local GPT-6 Codex default, provider/package setup, custom aliases/skills, and `subagents.json` GGA routing.
- Do not overwrite `models.json`, global `settings.json`, `subagents.json`, modes, or package manifests with upstream copies.
- Preserve local-only `oracle` and `researcher` roles and the issue-ops guidance already present in local role definitions.
- No sibling `pi-workflows` checkout is present under `~/git/personale`; the relevant workflow configuration lives in this dotenv checkout.
- Keep existing unrelated changes out of the commit: `cliproxyapi/README.md` and pre-existing `odd/tasks/*.md` files.
- No inference request or auth-file inspection. The prior CLIProxyAPI targets were checked with model listing only; preserve that absence as historical evidence, not as a claim about the replacement targets.
- Current branch is `feat/gpt6-model-routing`, at `50c9b2fd1f2ef0e742a8a9c11ad322f8cac88cfe` as read from `HEAD`; use one coherent Conventional Commit and do not push unless separately requested.

## Evidence and decisions
- Upstream `vekexasia/dotenv` was fetched at `00138582e074ed63309b4136478076314e912af9` (2026-09-26).
- Upstream workflow aliases: `cheap-model=cliproxyapi/gpt-6-luna:high`; `reviewer-model=cliproxyapi/claude-opus-5-5:high`; other existing shared role aliases already use the same chained targets/efforts.
- Upstream enables the CLIProxyAPI provider extension for workflow children and gives the `scout` role the light web-search extension plus fetch/search-content tools.
- Upstream `models.json` does not define CLIProxyAPI models; the provider is dynamically registered. Keep this repository's custom catalog and retain local issue-ops additions when aligning role tools.
- Local `.gga` review follows `.codex/config.toml` and `defaultModel` (`gpt-6-luna`) with xhigh effort. Workflow aliases are a separate layer; per the selected scope, do not reroute GGA/subagents.
- Initial exploration did not query model availability. A later `pi --list-models cliproxyapi` check exited 0 with `No models matching "cliproxyapi"`; no auth/config inspection or inference request was made.
- Historical model discovery: `pi --list-models` listed `opencode-go/grok-4.6`, `opencode-go/grok-4.7`, `openai-codex/gpt-6-luna`, `opencode-go/gpt-6-luna`, and `anthropic/claude-opus-5-5`; the prior CLIProxyAPI targets were absent. Listing is not proof inference works. The user selected `old-reviewer-model=opencode-go/grok-4.7:high`. The earlier decision to keep both CLIProxyAPI aliases unchanged is superseded by the current decision below.
- Current user decision: do not use CLIProxyAPI. Set `cheap-model=openai-codex/gpt-5.6-luna:high` and `reviewer-model=anthropic/claude-opus-5-5:high`; remove the CLIProxyAPI provider extension entry while retaining `pi-web-access` and all other local settings. Rerun GGA before commit. The absence of the former CLIProxyAPI targets remains historical evidence only.

## TDD and verification
- Strict TDD: active by the user's explicit choice in this session; source: direct user selection.
- Exact TDD runner for the initial alignment passed before the present blocker-resolution pass. The extension allowlist correction and selected legacy alias mapping passed RED/GREEN. A focused documentation assertion must fail before removing the remaining stale reference to `xai/grok-4.5:high` from `MODELS.md`, then pass after. These commands record the prior configuration and are historical, not the acceptance assertions for the current alias decision.
  ```sh
  node -e 'const a=require("node:assert/strict"),f=require("node:fs"),d="pi/agent/pi-extensible-workflows/";const s=require("./"+d+"settings.json");a.equal(s.modelAliases["cheap-model"],"cliproxyapi/gpt-6-luna:high");a.equal(s.modelAliases["reviewer-model"],"cliproxyapi/claude-opus-5-5:high");a.equal(s.modelAliases["old-reviewer-model"],"opencode-go/grok-4.7:high");a.ok(s.extensions.includes("**/pi-cliproxyapi-provider/extensions/index.ts"));a.ok(s.extensions.includes("**/pi-web-access/dist/index.js"));for(const n of ["developer","reviewer","tests-expert"]){const front=f.readFileSync(d+"roles/"+n+".md","utf8").split("---")[1];a.ok(front.split("\n").find(x=>x.startsWith("tools:")).includes("grep"));}const scout=f.readFileSync(d+"roles/scout.md","utf8");a.ok(scout.split("---")[1].includes("**/pi-web-access/dist/index.js"));a.ok(scout.includes("get_search_content"));a.ok(scout.includes("fetch_content"));'
  ```
- Focused documentation assertion (must fail before the stale-history correction and pass after):
  ```sh
  node -e 'const a=require("node:assert/strict"),f=require("node:fs"),t=f.readFileSync("pi/agent/MODELS.md","utf8");a.ok(t.includes("opencode-go/grok-4.7:high"));a.ok(!t.includes("xai/grok-4.5:high"));'
  ```
- Functional checks: parse workflow JSON; observe correction TDD RED then GREEN; run `git -c core.whitespace=cr-at-eol diff --check` to account for tracked CRLF role files; after parent sync, run `bash check-config.sh`; verify the corrected `MODELS.md` claims against `setup_env.sh`, `pi/agent/settings.json`, and `pi/agent/.gitignore`; compare touched source/live hashes. Do not invoke model inference.
- Runtime harness: no inference/runtime workflow invocation because that would incur provider usage; model discovery is the runtime check.

## Tasks
- [x] T1: Resolve the in-scope GGA findings and complete the upstream-aligned workflow alias/role/documentation update; preserve local-only configuration; sync exact touched files to `~/.pi/agent`; verify the candidate, obtain any required native review, and commit one work unit. Do not push unless separately requested. Commit: `8c97948` (`feat(pi): align workflow routing with Vekexasia`).
  - Route: delegated direct writer for the multi-file config/doc edit; parent performs live sync and delivery.
  - Allowed source edit surfaces:
    - `pi/agent/pi-extensible-workflows/settings.json`
    - `pi/agent/pi-extensible-workflows/roles/developer.md`
    - `pi/agent/pi-extensible-workflows/roles/reviewer.md`
    - `pi/agent/pi-extensible-workflows/roles/scout.md`
    - `pi/agent/pi-extensible-workflows/roles/tests-expert.md`
    - `pi/agent/MODELS.md`
  - Planned work-unit commit: `feat(pi): align workflow routing with Vekexasia`
  - Record final checks, commit hash, and any unavailable provider-model evidence here; do not push unless separately requested.

## Current status
- The writer observed RED (exit 1: cheap-model still targeted Codex GPT-6) before edits, then GREEN after the selected config changes; JSON parsing and `git diff --check` passed after a trailing-whitespace correction.
- Historical check of the prior aliases: live `pi --list-models cliproxyapi` verification confirmed neither CLIProxyAPI target was exposed.
- Restored CRLF in the three existing role files; diff stat is now 3 insertions and 2 deletions across those roles. The exact TDD runner passed before and after the cleanup.
- Plain `git diff --check` flags the CR bytes on those newly added CRLF lines as trailing whitespace. Verify the actual whitespace with `git -c core.whitespace=cr-at-eol diff --check`; do not normalize the files or add repository-wide Git settings just to silence the false positive.
- A separate focused verifier confirmed `git -c core.whitespace=cr-at-eol diff --check` has no errors and the role diff is only 3 insertions/2 removals.
- `gentle_review assess` returned `unassessable` (`changedPaths: 0`) because untracked files require explicit declaration. With RDD on, treat this as high risk and run an independent verifier after live sync.
- Synced only the six authorized files (`MODELS.md`, workflow settings, and four shared role files) into `~/.pi/agent`; did not run the broad setup script or modify runtime credentials.
- Independent verification passed: alias/role assertions, JSON parsing, CRLF-aware `git diff --check`, `bash check-config.sh`, and all six source/live `cmp` comparisons.
- Historical model-list result: `pi --list-models cliproxyapi` exited 0 but printed `No models matching "cliproxyapi"`; this applied to the previous targets. No auth file was inspected and no inference was sent. Parent reran the prior TDD assertion runner successfully.
- Historical, superseded decision: the user had chosen to commit/push the upstream aliases despite their absence. The current decision replaces those aliases instead; no auth changes or inference are authorized or needed.
- The strict pre-commit GGA 2.10.1 hook returned `STATUS: FAILED`; `git commit` exited 1, `HEAD` remains `50c9b2fd1f2ef0e742a8a9c11ad322f8cac88cfe`, and the six candidate files remain staged. No push occurred.
- GGA 2.10.1 initially reported: (1) `roles/scout.md` referenced missing `**/light-web-search.ts`; (2) `old-reviewer-model` targets unexposed `xai/grok-4.5`; (3) new workflow aliases target CLIProxyAPI models absent from `pi --list-models`; (4) `MODELS.md` described a symlink setup; (5) its `opencode-fast` and `opencode-deep` values disagreed with settings; (6) it said the file was untracked and needed an allowlist entry, although `pi/agent/.gitignore` already allows it. The worker corrected (1) to the installed `pi-web-access` extension path in the global allowlist and scout role, and corrected (4)–(6) in `MODELS.md`; all were within existing allowed surfaces. The profile package is v0.31.0 and exposes the same tool names by default, while repository lockfile resolves 0.29.0; runtime loading remains unverified. The correction TDD runner failed before edits on the missing global allowlist and passed after; JSON parsing and CRLF-aware diff checks passed. No GGA, pre-commit, sync, model discovery, or runtime test was run.
- A post-writer `gentle_review assess` returned risk `unassessable`, changedPaths 0, because unrelated untracked task files require explicit declaration. RDD is on; its plan treated the candidate as high risk and required writer self-verification plus an independent verifier. The independent verifier completed: correction assertions, JSON parse, staged/unstaged CRLF-aware whitespace checks, and source comparison passed. The verifier confirmed the documentation corrections and exact changed paths.
- At the prior checkpoint, six original candidate files were staged and three writer corrections were unstaged. This follow-up made worktree-only edits to `settings.json`, `MODELS.md`, and this task note; it did not stage, commit, or push. The unrelated modified `cliproxyapi/README.md` and other ODD notes remain outside this change and must be preserved.
- `old-reviewer-model=opencode-go/grok-4.7:high` remains the selected mapping. A prior readback found a stale `xai/grok-4.5` explanation; the current `MODELS.md` claim now identifies `opencode-go/grok-4.7:high`. The earlier decision to preserve CLIProxyAPI targets is superseded below.
- At the latest prior checkpoint, GGA and runtime checks had not been rerun. Runtime loading of `pi-web-access` remains unverified because the live profile is v0.31.0 while the repo lockfile resolves v0.29.0. Native review and delivery remain pending. The changed aliases require a fresh GGA run before any commit.
- Applied the current decision: `cheap-model=openai-codex/gpt-5.6-luna:high`, `reviewer-model=anthropic/claude-opus-5-5:high`; removed only the CLIProxyAPI provider extension entry and retained the web-access extension.
- Corrected the live-sync mapping to strip the repository `pi/agent/` prefix; all six staged blobs now match their intended `/root/.pi/agent` destinations byte-for-byte.
- Final read-only verification passed: staged whitespace, JSON/alias/extension assertions, six source/live comparisons, `pi --list-models`, and the actual `.git/hooks/pre-commit` GGA hook (`STATUS: PASSED`).
- Commit `8c97948` was created successfully; the commit hook reused the six-file GGA cache and reported `CODE REVIEW PASSED (cached)`. No push was performed.
- The earlier GGA audit passed with Codex forced to `gpt-5.6-luna`; static alias and configuration checks passed. A final rerun after the task-note consistency fix failed twice because the provider returned no output, and the normal commit hook failed for the same reason. The native review was explicitly abandoned with `operator_disposition` after repeated provider binding rejection; no native findings were captured.

## Next steps
1. Push `8c97948` only if the user separately requests it.
2. Leave the unrelated README and ODD task artifacts untouched.
