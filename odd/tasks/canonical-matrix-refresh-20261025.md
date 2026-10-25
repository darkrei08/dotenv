# Canonical matrix and failover refresh 2026-10-25

Scope: verify the current model/effort matrix against pi-model-fit preflight, preserve the existing gateway-first routing, and record only tested evidence. Do not commit live HA state, credentials, caches, or unrelated untracked files.

## Specs

1. **S1**: "procedi con verifiche test e valurazione nuova matrice canonica e failover e test efort ed applicala e pusga la modifica"
2. **S2**: The canonical matrix must use fresh reachable preflight entries and retain explicit effort values.
3. **S3**: Versioned dotenv changes must be limited to proven configuration or evidence discrepancies.

## Tasks

- [x] T1 (S1-S3): Compare tracked aliases, role groups, HA example, GGA route, and configuration assertions with fresh preflight evidence. Commit: `20d1f84`.
- [x] T2 (S1-S3): Run configuration and failover/effort tests in isolation. Commit: `20d1f84`.
- [x] T3 (S1-S3): Record the result and push only the tested evidence/configuration commit. Commit: `20d1f84`.

## Log

L1: "procedi con verifiche test e valurazione nuova matrice canonica e failover e test efort ed applicala e pusga la modifica"

2026-10-25: Initial inspection found the tracked dotenv matrix already matches the fresh pi-model-fit preflight: seven ready groups, explicit efforts, role-group coverage, and the GGA reviewer fallback. No config mutation is justified before focused verification.

2026-10-25: `bash check-config.sh` passed. Focused model-preflight, HA bootstrap, and HA role-group tests passed 24/24. The pi-model-fit runtime refresh applied the fresh matrix to live HA with exit code 0; all seven live groups were unchanged and no lock remained. No dotenv routing edit was necessary.

2026-10-25: Delivered this versioned evidence in dotenv commit `20d1f84` on `feat/canonical-matrix-refresh-20261025`, pushed to origin.
