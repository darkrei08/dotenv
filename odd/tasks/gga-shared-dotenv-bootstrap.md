# Shared GGA bootstrap and repository routing
Source: user-authorized cross-repository GGA and CLIProxyAPI/pi-ext-roles alignment.
Status: implementation in progress; local commits only, no push or merge.

## Specs
1. **S1**: "applica gga in tuti miei repositori e ceh usino cliproxyapi ed i modelli ed iruoli assegnati da pi ext roles"
2. **S2**: "possiamoa nceh crare una preconfig ggaenl mio dotenv chee si utile a tutti i miei repo futuri per avere un sysmslink che legga la configrazioen gga inbvece di copiarla in ogni repo e poi basterebbe fare init nel repo"
3. **S3**: Use every top-level Git repository discovered under `/root/git/personale` for the current rollout (the reconciled inventory contains 23 roots), while keeping the reusable setup centered in `/root/git/personale/dotenv`.
4. **S4**: Use both the active `pi-ext-roles` model aliases and the Pi Herdr routing/HA matrix as the routing sources; do not copy credentials or mutable Pi runtime state into repositories.

## Tasks
- T1 | S1-S4 | Design shared dotenv GGA profile, init command, symlink and Pi bridge ownership | commit: f6ee5d0
- T2 | S1-S4 | Apply the shared configuration and initialization to every discovered repository root without overwriting unrelated work | commit: local rollout changes remain uncommitted per repository
- T3 | S1-S4 | Verify shell syntax, symlink resolution, init idempotence, config and bridge smoke behavior | commit: f6ee5d0 plus rollout checks

## Log
- L1: appica gga in tuti miei repositori e ceh usino cliproxyapi ed i modelli ed iruoli assegnati da pi ext roles
- L2: possiamoa nceh crare una preconfig ggaenl mio dotenv chee si utile a tutti i miei repo futuri per avere un sysmslink che legga la configrazioen gga inbvece di copiarla in ogni repo e poi basterebbe fare init nel repo
- L3: Added `agents/gga-pi/profiles/reviewer.gga` and `agents/gga-pi/init-repo.sh`. The profile uses `PROVIDER="kilo:reviewer-model"` only for GGA v2.10.1 protocol compatibility; the local adapter invokes Pi directly, resolves the active pi-ext-roles alias, and routes through CLIProxyAPI plus reviewer HA. It does not use Kilo or OpenCode.
- L4: Initialized every top-level Git repository found under `/root/git/personale` (23 roots, including infrastructure repositories and repositories without a previous `.gga`). `.gga` and `agents/gga-pi` are relative symlinks to the dotenv source; prior regular paths were preserved as `.local` backups. No Pi credentials or mutable runtime directories were linked.
- L5: Verification passed: `check-config.sh`, Bash syntax checks, bridge/init tests (11/11), relative symlink resolution for all 23 roots, executable Pi bridge hooks for all 23 roots, and `git diff --check` for all 23 roots. No push or merge performed.
- L6: Commit `f6ee5d0` contains the reusable dotenv bootstrap, tests, profile, and feature spec. The 23 per-repository symlink rollouts remain local working-tree changes because the repositories contain unrelated dirty/untracked state; no unrelated files were staged, and no push or merge was performed. The required GGA review passed after correcting the 23-root scope and two init argument/safety defects; provider fallback warnings remain recorded.
