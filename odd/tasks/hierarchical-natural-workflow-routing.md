# Hierarchical natural-language workflow routing

Feature document for the authorized remediation of the remaining orchestration FAIL/BLOCKED findings.
Repository: `darkrei08/dotenv`; related repository: `darkrei08/pi-herdr-orchestration`.

## Specs

S1. "Benissimo procedi con tutte le sezioni blocked tutte le sezioni fail Procedere appunto a modificare e a commentare e a pushare ai file modificati, eseguire l'audit avversariale completo e test funzionale al conclusivo e poi implementare il routing linguaggio naturale automatico e il ritorno gerarchico dei risultati esegui una funzione step by step seguendo appunto un wavefender autonomo per committare in ticket le specifiche da voler implementare per i singoli repo e per le singole estensioni P agent"

S2. "Natural-language workflow requests stop at guidance instead of dispatching"

S3. "Sequential issue batches do not propagate a master-level result"

S4. "Run bounded orchestration smoke"

S5. "execute the full adversarial audit and final functional test"

## Tasks

- T1 [S2] | #75 | route: transform unambiguous natural-language requests into native workflow dispatch while preserving explicit-command and fail-closed guards | commit: 8981788
- T2 [S3] | #76 | route: add validated master/chief result synthesis and upward propagation after sequential issue batches | commit: 8981788
- T3 [S4] | #13, #6 | route: repair or verify ordered Herdr child lifecycle, prompt transport, and mailbox evidence in `pi-herdr-orchestration` | commit: 5e4212c
- T4 [S5] | #69 | route: reproduce and correct the model-preflight runtime path without touching credentials or live config | commit: bac5e67
- T5 [S1-S5] | #75, #76, #13, #6, #69 | route: run adversarial review, focused tests, final functional smoke, and push stable repository branches | commits: 8aea335 and current branch evidence; push pending explicit delivery authorization

## Log

L1. User authorized implementation, issue comments, commits, push, adversarial review, final functional verification, automatic natural-language routing, and hierarchical result propagation.
L2. Existing repository worktree is intentionally dirty on `fix/cliproxyapi-live-failover`; unrelated prior changes must be preserved and separated from new work units.
L3. Existing approved tickets #61, #65, #69, #73 and Herdr tickets #13, #6 were reconciled. New tickets #75 and #76 were created for the two missing dotenv behaviors.
L4. Initial evidence: focused extension tests pass; role smoke passes; automatic NL routing is guidance-only; master/chief upward propagation is absent; Herdr child prompt smoke stalled; one Pi job reported `invalid failover route` from model preflight.
L5. Implemented T1, T2, and T4 in the dotenv repository. Natural-language input now transforms only unambiguous, parseable requests into one native workflow-tool instruction; sequential issue batches return a schema-validated master summary; model preflight accepts the producer's redacted route entries without `id`, while preserving route matching and HA atomic-write protections.
L6. Added the shared-skill collision/linker hardening, setup skip guard, Arch `diffutils` dependency, and operational docs. Functional verification: Node 82/82, Bun 12/12, `bash -n`, JavaScript syntax checks, `git diff --check`, `bash check-config.sh`, Debian 13 container 64/64, and Arch latest container 65/65. Judgment Day dual judges were unavailable with `invalid-published-state`; no adversarial verdict was obtained. Herdr live smoke remains blocked because Herdr reports `session=null`.
L7. The first authorized work-unit commit was rejected by the GGA review: replace-copy-with-link lacked rollback if link creation failed, and setup_env.sh created normalized settings in the system temp directory. Added red/green regressions, restored the original copy on simulated link failure, and made settings temp files target-local. Linker tests now pass 9/9 and skill/setup tests pass 7/7; commit will be retried after the corrected slice is staged.
L8. Subsequent GGA review found two more fail-closed gaps: dangling canonical-looking Pi links were accepted, and external Pi-local links were scheduled for deletion. Added regressions, required existing canonical targets in check-config.sh, verified link identity before drop-link, and blocked harness actions when canonical planning reports a conflict. Final host verification is Node 84/84, Bun 12/12, with config, syntax, and whitespace checks passing; Debian and Arch final rows are rerunning for this last linker change.
L9. GGA then found harnessPresent treated a parent config directory as an installed harness. Added a RED regression and changed detection to require the actual configured skills root. Host verification remains green; Debian and Arch final rows will be rerun before the next commit attempt.
L10. The routing slice was committed as `8981788` and the parallel-review slice as `5e4212c`. Native review lineage `review-3b968dae1df2608a` completed and was acknowledged after a fresh exact STATUS binding; an intermediate manually altered binding was rejected without mutation. Push remains pending explicit delivery authorization.
L11. Final verification rerun: Bun extension tests pass 12/12. Node tests pass 84/85; the single failure is the non-root setup test because `runuser` cannot execute its copied fixture below the root-only `/root` path (exit 126).
