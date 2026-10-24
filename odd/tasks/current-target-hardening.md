# Current target hardening
Implementation ledger for the authorized remediation of the current review findings. Read through `## Log` before editing.

## Specs

S1. "You are the developer. Address the actionable findings in the current target."

S2. "Make the smallest safe changes needed for critical and high-severity issues, then report what you changed."

S3. "1) MAJOR: symlinked pi-model-fit preflight path causes its import.meta.url entry guard to exit 0 with empty stdout; wrapper reports Unexpected end of JSON input."

S4. "2) MAJOR: setup_env.sh updates live extensions/settings non-atomically, allowing partial files, ENOENT, or truncated JSON during startup."

S5. "3) MAJOR: link-skills fold-in creates an intentional missing-path window and can leave the canonical skill absent on failure."

S6. "4) MAJOR: link-skills --apply has no process lock, so concurrent runs race on links, backups, and temp paths."

S7. "5) MAJOR: setup_env.sh never invokes link-skills; current `node agents/link-skills.mjs --verify` reports five missing project-memory links."

S8. "6) MAJOR: check-config.sh skips dangling symlinks and suppresses manifest parse failures."

S9. "7) MAJOR: predictable HA temp path can follow a symlink and overwrite another file."

S10. "8) MAJOR: HA temp mode inherits insecure original permissions, potentially exposing credentials."

S11. "9) MAJOR: ctx.reload() failure leaves persisted HA routes changed while runtime is stale."

## Tasks

- T1 [S3, S9-S11] route: harden model preflight launcher/HA persistence and add focused regression tests; commits: cd0c673, bac5e67.
- T2 [S5-S7] route: make skill linking transactional and serialized, wire setup invocation, and add focused regression tests; commits: 61206a8, 84aae5d.
- T3 [S4, S8] route: make setup/config validation fail-closed and atomic, with shell regression coverage; commits: 84aae5d, c8a06f6, 6760ef7.
- T4 [S1-S11] route: run focused, syntax, repository, and applicable container checks; evidence recorded in L3-L6, with live-path checks still environment-blocked.
- T5 [S12] route: align GGA with the reviewer role's primary CLIProxyAPI model while retaining the reviewer HA fallback group; update config checks, tests, and documentation; commit: cd0c673.

## Log

L1. User request: "You are the developer. Address the actionable findings in the current target.\nMake the smallest safe changes needed for critical and high-severity issues, then report what you changed.\n<review>Review completed. Findings: 1) MAJOR: symlinked pi-model-fit preflight path causes its import.meta.url entry guard to exit 0 with empty stdout; wrapper reports Unexpected end of JSON input. 2) MAJOR: setup_env.sh updates live extensions/settings non-atomically, allowing partial files, ENOENT, or truncated JSON during startup. 3) MAJOR: link-skills fold-in creates an intentional missing-path window and can leave the canonical skill absent on failure. 4) MAJOR: link-skills --apply has no process lock, so concurrent runs race on links, backups, and temp paths. 5) MAJOR: setup_env.sh never invokes link-skills; current `node agents/link-skills.mjs --verify` reports five missing project-memory links. 6) MAJOR: check-config.sh skips dangling symlinks and suppresses manifest parse failures. 7) MAJOR: predictable HA temp path can follow a symlink and overwrite another file. 8) MAJOR: HA temp mode inherits insecure original permissions, potentially exposing credentials. 9) MAJOR: ctx.reload() failure leaves persisted HA routes changed while runtime is stale. Evidence: focused Node tests 22/22 passed; syntax checks passed; `bash check-config.sh` passed; offline Pi reproduced `Extension error ... invalid model preflight output: Unexpected end of JSON input`; symlinked preflight invocation exited 0 with 0-byte stdout; linker verification failed on five missing links. No files modified.\n<security>Audit completato. Nessun file modificato. Findings principali: 1) MAJOR: confronto `import.meta.url`/`process.argv[1]` in `pi-model-fit/scripts/preflight.mjs:239` fallisce con symlink o spazi e produce stdout vuoto, causando `invalid model preflight output`; 2) MAJOR: `model-preflight.mjs` non valida root/script/schema/route e usa temporary HA prevedibile con `realpath:false`, possibile symlink race e permessi ereditati; 3) MAJOR: `agents/link-skills.mjs` è privo di lock, con TOCTOU riprodotto: due `--apply` concorrenti producono `ENOENT ... SKILL.md`; 4) MAJOR: `setup_env.sh` modifica la live tree in-place e riscrive `settings.json` non atomicamente, causando file parziali/mancanti durante startup; 5) MAJOR: linker senza path validation, `fold-in` può spostare path esterni e Windows usa `cmd /c mklink`; 6) MAJOR: setup installa codice remoto latest senza checksum/firma e passa `GITHUB_TOKEN` negli argv; 7) MINOR: `check-config.sh` non è completamente fail-closed e verifica le loader solo per presenza. Verifiche: model-preflight 13/13, skill-collision 5/5, bash/node syntax pass, `check-config.sh` exit 0, `git diff --check` pass. Non eseguiti Windows, startup Pi reale o provider remoto."\nL2. The P EXTIL TDD workflow changed HA writes to owner-only permissions (0600 for a normal 0644 file, preserving already-private owner modes), kept atomic random O_EXCL temp files, and retained rollback on reload failure.\nL3. Final repository verification passed: Node 67/67, Bun 11/11, focused preflight 17/17, shell/Node syntax, `git diff --check`, and `bash check-config.sh`. A real symlinked wrapper invocation returned valid JSON with probe `ok` and 70 models; the canonical root contained 58 readable managed skills.\nL4. Live validation remains blocked: the current `~/.pi/agent` still emits the old empty-stdout preflight error, and `node agents/link-skills.mjs --verify` reports five missing non-Pi project-memory links. Repairing those external paths needs explicit authorization; no live files were changed in this remediation.

L5. Addressed the residual review findings without changing live paths: workflow-intent now exposes a visible fail-closed diagnostic when `pi-extensible-workflows` is unavailable, and the S9 test now drives `applyMatrixToHaConfig` with a deterministic temp suffix, proving a pre-created symlink is rejected and both the target and config remain unchanged. Verification: Node extensions 45/45, Bun extension tests 11/11, repository regressions 15/15, syntax checks, `bash check-config.sh`, and whitespace checks passed. No commit, push, or live runtime/provider validation was performed.

L6. Addressed the fifth GGA retry findings: identical non-Pi harness skill copies now remain explicit conflicts instead of being moved through a missing-path window, and the project-memory skills install now honors `SETUP_AI_SKIP_SKILLS`. Focused linker/collision tests pass 19/19; full Node tests pass 85/85; Bun tests pass 12/12; Debian 13 and Arch latest container rows pass 85/85 with shell, syntax, and config checks. The first Arch row was rerun with its required `diffutils` package after correctly exposing that missing dependency.

L7. The configured GGA fifth review could not start: `gga run --no-cache` exits immediately with `Kilo CLI not found`; the repository `.gga` selects `kilo:cliproxyapi/gpt-6-luna:high`. No commit or `--no-verify` bypass was attempted. The remaining decision is to make the configured verifier available or explicitly choose an approved alternate review path.

L8. User request: "volgio che gga usi anche il rispettivo ruolo e modlelo anche per ha failover cn cli peoxyapi". Interpret this as requiring `.gga` to use the primary route resolved by the `reviewer` role, while preserving the existing reviewer HA fallbacks through CLIProxyAPI.

L9. Implemented T5: `.gga` now uses `kilo:cliproxyapi/claude-opus-4-6-thinking:off`, the route resolved by `reviewer.md`. `check-config.sh` resolves the role alias, requires exact primary-route equality, and separately requires membership in the reviewer HA group. Focused mapping/config tests pass; no fallback entries or live credentials were changed."