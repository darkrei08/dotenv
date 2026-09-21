# Gentle Shell Pi configuration

## Goal
Restore the package-owned gentle-shell footer and prevent dotenv Pi configuration from silently drifting from the live agent configuration.

## Tasks

- [x] Verify installed gentle-pi/gentle-ai state, official release guidance, extension loading, and the pre-change configuration snapshot.
- [x] Remove the legacy local footer override and make setup remove its stale live copy.
- [x] Add a checked comparison for workflow aliases and extension lists between dotenv and live Pi configuration.
- [x] Run focused checks and the applicable shell/container verification; record evidence and limitations.

## Evidence captured

- Pre-change snapshot: `/tmp/gentle-shell-before-20260921161226`.
- `gentle-pi` installed at `/root/.pi/agent/npm/node_modules/gentle-pi`, version `3.3.0`; npm `latest` is `3.3.0`.
- The installed package declares `pi.extensions: ["./extensions"]` and contains `extensions/gentle-shell.ts`.
- `GENTLE_PI_SHELL` and `GENTLE_PI_AGENTS_CHILD` are unset in the host session; `shellEnabled()` therefore returns true for the interactive host.
- Interactive TUI capture rendered `gentle-pi`, proving the repository extension `pi/agent/extensions/gentle-bar.ts` owns the footer instead of the package-owned Gentle Shell bar.
- `gentle-ai sync` completed successfully and changed six managed non-Pi files; Pi settings and workflow settings were unchanged.
- The legacy footer extension is deleted, setup removes any stale live copy, and `README.md` no longer documents it.
- `bash -n setup_env.sh check-config.sh` passed.
- `./check-config.sh` passed, including canonical/live workflow alias and extension comparisons.
- `git diff --check` passed and the retired extension path is absent.
- Container verification was not run because Docker is unavailable in this host (`docker: command not found`); no Windows/macOS runner is available here.

## Scope

- `README.md`
- `pi/agent/extensions/gentle-bar.ts`
- `setup_env.sh`
- `check-config.sh`
- `odd/tasks/gentle-shell-pi-config.md`
