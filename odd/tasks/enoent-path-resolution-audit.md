# ENOENT path-resolution audit

Feature document for the repository-path discovery and stale-source-reference fix.
Owner: parent session. Scope: role prompts and regression checks in this repository; external repositories are read-only evidence.

## Specs

1. **S1**: "Do not create an empty `configuration.ts` file just to silence ENOENT. Do not invent replacement paths. Discover the actual implementation and correct the source of the stale reference."
2. **S2**: The observed failure is exactly: `read ~/git/personale/pi-extensible-workflows/packages/core/src/configuration.ts:1-440` followed by `ENOENT: no such file or directory, access '/root/git/personale/pi-extensible-workflows/packages/core/src/configuration.ts'` and `Similar files: packages/core/src/io.ts`.
3. **S3**: "Implement a reliable discovery-first workflow." It must identify the repository, verify its root, discover candidate files, resolve the requested symbol or functionality, verify the selected file exists, read the relevant source range, and continue the task.
4. **S4**: "Never infer source paths solely from expected naming conventions." If a requested path is missing, search bounded candidate paths, inspect repository history, identify the relevant module by exported symbols, explain the mismatch, and continue with the verified implementation.
5. **S5**: Preserve existing local changes, avoid unrelated refactoring, and do not expose secrets.
6. **S6**: Acceptance requires that "Agents do not repeatedly read nonexistent files" and that the original ENOENT failure is explained, stale references are corrected, repository discovery works reliably, regression tests pass, and no unrelated configuration is damaged.

## Tasks

- T1 [S1-S6] Trace the failed read, repository/worktree state, source history, and prompt/config ownership. Route: parent read-only audit. Status: done. Commit: not created; user did not request a commit.
- T2 [S3-S6] Add discovery-first guidance to the responsible tests role and a focused policy regression assertion. Route: `pi/agent/pi-ext-roles/roles/tests-expert.md`, `tests/role-tool-policy.sh`. Status: done. Commit: not created; user did not request a commit.
- T3 [S1-S6] Run focused, package, configuration, and cross-scope checks; record failures and limits. Route: repository commands. Status: blocked by the unrelated target npm compatibility failure documented in L8. Commit: not created; user did not request a commit.
- T4 [S1-S6] Audit orchestration/path consumers and close with evidence. Route: external repositories read-only; current repository docs/task log. Status: done with the L1-L8 evidence record. Commit: not created; user did not request a commit.
- T5 [S6] Classify the target package-suite failure without changing the external repository. Route: isolated target reproduction and npm output inspection. Status: done; npm 12.2.1 returns an object while the test assumes an array. Commit: not created; user did not request a commit.

## Log

L1. User request verbatim: "MISSION — Fix ENOENT Errors, Audit Repository Path Resolution and Validate the Entire Pi Orchestration Stack"
L2. User provided the exact missing path and explicitly prohibited creating an empty compatibility file or inventing a replacement.
L3. Discovery evidence: the active worktree is `/root/.herdr/worktrees/dotenv/worktree-issue-noskill-found`; the actual target repository is `/root/git/personale/pi-extensible-workflows`; `packages/core/src/configuration.ts` has no tracked or historical entry, while `packages/core/test/configuration.test.ts` exists and imports the implementation from `../src/index.js`.
L4. Discovery evidence: the failed read was issued by the pi-ext-roles session's tests-expert agent after reading package manifests and before reading the existing configuration test. The role prompt did not require existence validation or discovery before reading a presumed source path.
L5. Verification evidence: the focused role policy, configuration, medium-effort, syntax, and diff checks passed. The target path matrix passed, and `npm run build --workspace=packages/core` passed from `/root/git/personale/pi-extensible-workflows`. The first build attempt failed only because it ran from this dotenv worktree without a target `package.json`; rerunning from the verified Git root passed.
L6. Orchestration audit: the current repository has no remaining stale `configuration.ts` consumer; the target repository uses `packages/core/src/paths.ts` as its filesystem identity source and contains `packages/core/test/configuration.test.ts` but no `packages/core/src/configuration.ts` in tracked or historical refs. No source file, compatibility stub, or target repository file was created.
L7. Final local and platform checks: role policy, configuration, medium-effort tests, syntax checks, and `git diff --check` passed. The changed shell policy ran successfully in Debian 13, Fedora 42, and Alpine 3.22/Node 22 containers. Windows and macOS were unavailable on the Linux host.
L8. Target-suite limitation: core lint and build passed, but `npm run test --workspace=packages/core` exits 123 in the pre-existing `dist/test/workflow-evals.test.js` assertion `does not publish the eval harness, cases, or fixtures`. Under the installed npm, isolated `npm pack --dry-run --json --ignore-scripts` returns a JSON object with a `files` array, while the test assumes the older array-of-reports shape and reads `reports[0]`, yielding an empty result. The failure reproduces in the untouched target repository and is unrelated to this dotenv worktree change; no target files were modified.
