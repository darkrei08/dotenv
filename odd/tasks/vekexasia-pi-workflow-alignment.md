# Vekexasia Pi workflow alignment and CLIProxyAPI setup

## Goal
Keep only compatible Pi workflow updates from Vekexasia, configure a localhost-only CLIProxyAPI Compose service and Pi provider, and document setup without replacing existing model routing.

## Why
The user asked whether changes were pushed, what model/alias fixes were applied, and now explicitly requested CLIProxyAPI configuration plus Compose and README documentation. The prior "guide only" choice is superseded for this setup.

## Scope and constraints
- Canonical repository: `darkrei08/dotenv`.
- Completed T1: update active `npm:pi-extensible-workflows` to 5.17.0 and correct only the Pi built-in edit tools in the canonical `developer` and `tests-expert` roles (`replace`/`undo_last_change` -> `edit`/`write`), mirroring the roles live.
- Preserve the current default provider/model and all existing static workflow aliases. No model/alias changes from Vekexasia were applied; the CLIProxyAPI Pi provider discovers models dynamically after upstream authentication.
- Add a localhost-bound CLIProxyAPI Compose service, tracked credentials-free config template, Pi provider package declaration, and focused README instructions. Do not commit API keys, OAuth auth files, logs, or runtime config.
- Do not copy existing Pi credentials into CLIProxyAPI or initiate upstream OAuth; provider authentication remains an explicit user step.
- Preserve existing branch and unrelated working-tree state, including `odd/tasks/gga-dotenv-default-and-init.md`.
- The user explicitly authorized committing and pushing the existing feature branch, but GGA blocked the first attempt on stale docs/rules. The user then authorized updating `README.md` and `REVIEW_RULES.md` to match the already-tracked Codex/GPT-6 configuration; this expands the native-review candidate. Keep both `odd/tasks/*.md` task notes out of the commit; never force-push, publish to npm, run OAuth, copy Pi credentials, or invoke OCR.

## Findings
- Existing Pi default is `openai-codex/gpt-6-luna`; `pi/agent/models.json` contains five `openai-codex` models and five `tuxevil-rotator` Gemini variants. Workflow aliases are in `pi/agent/pi-extensible-workflows/settings.json`; no alias was changed for this task.
- Before delivery, the feature branch had two pre-existing commits ahead of origin; the authorized push published those together with the new CLIProxyAPI commit.
- CLIProxyAPI uses port 8317 for the API and port 1455 for Codex OAuth callback. Docker host bindings must remain on `127.0.0.1`; OAuth credentials and client API keys stay in ignored local files.
- CLIProxyAPI upstream config distinguishes client `api-keys` from provider credentials stored in its auth directory.

## Tasks
- [x] T1: Upgrade workflow package and correct stale Pi role tool names.
- [x] T2: Add Compose/config template, declare the Pi CLIProxyAPI provider, protect local runtime credentials, and document install/configuration in the repository README.
- [x] T3: Create ignored local configuration, install the provider package, start and verify the localhost service; leave upstream OAuth/model selection to the user.
- [x] T4: Correct the stale README provider/default documentation and REVIEW_RULES default-provider invariant; obtain native review approval for the expanded candidate.
- [x] T5: Run GGA pre-commit and commit the expanded, approved candidate as `50c9b2fd1f2ef0e742a8a9c11ad322f8cac88cfe` (`feat(cliproxyapi): add local Pi provider setup`).
- [x] T6: Pushed `feat/gpt6-model-routing` to `origin` without force; `ls-remote` verified remote ref `50c9b2fd1f2ef0e742a8a9c11ad322f8cac88cfe`.

## Acceptance checks
- `npm:pi-extensible-workflows` is installed at 5.17.0 and both canonical role files match their live mirrors with `edit`/`write`.
- Compose publishes only `127.0.0.1:8317` and `127.0.0.1:1455`; tracked config contains no real keys or provider credentials.
- Pi declares `npm:@router-for-me/pi-cliproxyapi-provider` in both `settings.json` and `pi-packages.txt` without changing defaults, `models.json`, or workflow aliases.
- Compose configuration validates and service health/API behavior is checked; current model catalog may remain empty until the user authenticates an upstream provider.
- Keep both task notes and all other unrelated changes out of the commit. Commit only the ten reviewed source paths; push `feat/gpt6-model-routing` without force.

## Verification record
- T1 package version, `pi list`, role source/live `cmp`, tool lists, `git diff --check`, and scoped native review approval/acknowledgement were verified.
- Native ASSESS for T1 reported `unassessable` because repository-local untracked files were not declared; independently rechecked the exact reviewed tracked diff and acceptance commands.
- T2 verification passed: Pi settings JSON parses and both settings/manifest declare the provider package; Compose renders the official image, only loopback ports 8317/1455, a read-only config mount and persistent auth mount; `git diff --check` passes. The template contains only placeholders, runtime secret/auth files are ignored and absent, and defaults/catalog/aliases match HEAD. No container was started during this validation.
- T3 final verification on the Linux host used Docker Compose 2.26.1; Compose/API/package checks passed. Windows/macOS runtimes were unavailable.
- Native review approved and acknowledged. Non-blocking advisories: Compose uses the mutable `eceasy/cli-proxy-api:latest` image tag, and the npm provider package is unpinned. Native ASSESS returned `unassessable` because untracked files require explicit declaration; independent verification of the exact candidate and runtime passed.
- T3 complete: provider package is installed in the live Pi profile; ignored local client config and Pi provider config use mode 0600; auth directory mode is 0700; Compose service is running with only loopback ports. Authenticated `/v1/models` returned HTTP 200 and zero models because no upstream account has been authenticated. No OAuth or inference was run. The pre-existing `~/.pi/agent/auth.json` is mode 0644; its contents were not inspected or changed, and the README advises restricting it before interactive login.
- Delivery: the repository hook was absent, so `gga install` installed `.git/hooks/pre-commit`. The first GGA run blocked on stale README/rules; the user authorized those corrections. Native review lineage `review-143870247f868f78` approved and was acknowledged for the exact ten-path candidate after one explicitly acknowledged reliability reviewer run; only advisory is the mutable `eceasy/cli-proxy-api:latest` tag. The second strict GGA 2.10.1 hook run passed (JSON parsing, diff check, protected integrations/defaults, package parity, secret/runtime ignore rules, `bash check-config.sh`). Commit `50c9b2fd1f2ef0e742a8a9c11ad322f8cac88cfe` succeeded with exactly those ten paths. Push succeeded without force; `git ls-remote origin refs/heads/feat/gpt6-model-routing` returned the same hash, and the tracking ref is now synchronized. This push included two pre-existing commits as instructed. Both task notes remain excluded.
