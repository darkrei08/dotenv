# Cross-repository skill overlap and open PR cleanup

Feature document for the authorized cleanup of duplicated shared skills and currently open pull requests.

## Specs

S1. "cinsono sovrapposizioni di skill duolocate e sistema anche le pr ancora aperte"

S2. Preserve active, dirty, unpublished, blocked, or otherwise unproven work; move redundant runtime skill entries to timestamped backups rather than deleting user data.

S3. Prevent setup from recreating shared skills in Pi's canonical-reading local root.

S4. Resolve each open PR from current evidence: repair and verify fixable work, close only superseded or obsolete work, and preserve blocked work with an explicit reason.

## Tasks

- T1 [S1-S4] | dotenv and global skill roots | inventory duplicate skill entries, manifests, setup commands, branches, worktrees, PRs, reviews, and checks | route: master/scout | commit: this document
- T2 [S1-S3] | dotenv | remove confirmed redundant Pi-local shared-skill links/copies with backups and prevent recreation in setup | route: developer | commit: 561c0cf
- T3 [S1-S4] | pi-model-fit | repair or close PR #12 and #14 without removing active tests or duplicating dotenv preflight ownership | route: developer | result: closed #12 as superseded and #14 as obsolete
- T4 [S1-S4] | pi-extensible-workflows | rebase/fix PR #293 where reviewable, close superseded PR #308 if #316 is the successor, and fix or preserve #316 from CI evidence | route: developer/reviewer | result: preserved #293/#316; #308 is superseded but cannot be closed with current GitHub permissions
- T5 [S1-S4] | all affected repositories | run targeted and repository checks, reconcile GitHub state, update the ledger, and persist evidence | route: master | commit: 561c0cf

## Log

L1. "cinsono sovrapposizioni di skill duolocate e sistema anche le pr ancora aperte 🧠 save “Complete cross-repository cleanup audit” …"

L2. Current evidence: the canonical skill root is `/root/.agents/skills`; Pi reads it directly and should keep only Pi-specific skills under `/root/.pi/agent/skills`. Eleven shared skills currently have same-target Pi-local symlinks, and `multi-repo-product-workflow/skills/` is a nested self-copy artifact. The setup installer still passes `--agent pi cline` for shared skill installs, which can recreate the overlap; `project-memory` already uses only `--agent cline`.

L3. Current open PR evidence: pi-model-fit #12 (clean docs branch with stale route recommendations), #14 (runtime refresh branch deleting active tests and duplicating dotenv preflight ownership); pi-extensible-workflows #293 (conflicting, changes requested, based on older v5.x), #308 (conflicting large Archify branch with #316 as narrowed successor), and #316 (draft successor with a failing check). No open PRs were found in dotenv, setup-ai, pi-herdr-orchestration, or pi-ext-roles.

L4. Skill cleanup result: `setup_env.sh` now targets only `--agent cline` for shared installs; focused tests, syntax/config/linker checks, and Debian 13, Ubuntu 24.04, and Arch latest container rows passed. Eleven redundant Pi-local shared-skill symlinks and the nested `multi-repo-product-workflow` self-copy were moved, not deleted, to `/root/.pi/backups/link-skills-20261025T215500Z`.

L5. PR resolution result: darkrei08/pi-model-fit #12 and #14 were closed with explicit supersession/ownership comments. vekexasia/pi-extensible-workflows #308 is superseded by #316 but the current GitHub token cannot execute `ClosePullRequest`; #293 remains open with changes requested and conflicts, while #316 remains draft with failing CI and unresolved heap acceptance. No unproven PR was merged.

L6. Final verification: commit `561c0cf` passed the independent GGA gate. Host checks passed: `bash -n setup_env.sh check-config.sh`, 26 focused Node tests, linker verification, `bash check-config.sh`, and `git diff --check`. The installer assertion also passed in Debian 13, Ubuntu 24.04, Fedora latest, Arch latest, openSUSE Tumbleweed, and Alpine latest containers. Windows/macOS, full installer execution, live npx downloads, provider inference, and closing upstream PR #308 were not verified or permitted.
