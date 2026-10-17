# CLI-Anything HA CLI integration
Owner: el Gentleman
Scope: install CLI-Anything on the host and expose HA state through a shell CLI managed by dotenv.

## Specs
1. **S1** — "ma allora rendilo eseguibile da llm con una cli ? root@herdr:~/git/personale/dotenv# /ha bash: /ha: No such file or directory root@herdr:~/git/personale/dotenv#"
2. **S2** — "usa la repo clyanything ed instalala su questo host e anceh su dotenv mio"
3. **S3** — "aggiungi al task anche le best practies del limite dei token che vekexasi ha applicato ai suoi modelli e tuoli"

## Tasks
- T1 (S1-S2): Install CLI-Anything Hub and its Pi extension on the host. Route: host installation. Commit: none yet.
- T2 (S1-S2): Add a dotenv-managed shell CLI for HA status and group management. Route: `pi/agent/bin/pi-ha` plus installer sync. Commit: none yet.
- T3 (S1-S2): Verify host installation, shell CLI, Pi extension assets, config parity, and syntax. Route: focused checks. Commit: none yet.
- T4 (S3): Add Vekexasia token-budget guardrails for models and tool-heavy workflows. Route: record the context trigger `contextTokens > contextWindow - reserveTokens`, default `reserveTokens=16384`, the floor `reserveTokens >= max(maxTokens, 16384)`, 80-85% proactive-compaction targeting, `maxTokens >= 32K` for developer/tests/reviewer roles, `contextWindow >= 200K` for researcher/repository-wide scout, and gateway-registered limits as authoritative. Commit: none yet.

## Log
L1: ma allora rendilo eseguibile da llm con una cli ?
root@herdr:~/git/personale/dotenv# /ha
bash: /ha: No such file or directory
root@herdr:~/git/personale/dotenv#

usa la repo clyanything ed instalala su questo host e anceh su dotenv mio

L2: aggiungi al task anche le best practies del limite dei token che vekexasi ha applicato ai suoi modelli e tuoli

L3: The token-budget guardrail is implemented in `pi/agent/bin/pi-token-budget.mjs`, enforced by `check-config.sh`, configured in `pi/agent/settings.json`, and documented in `pi/agent/README.md` and `docs/setup-reference.md`. Gateway-dynamic models remain unverified unless their registered catalog is available; no limits are guessed.

L4: Verification passed: RED/GREEN fixture for an invalid reserve, shell and Node syntax, JSON parsing, `check-config.sh`, `pi-token-budget.mjs --json`, strict-mode exit 3 for unverified gateway models, and `git diff --check`. Native review found and corrected an over-broad global model limit check; the corrected candidate was validated and the approved review was acknowledged.
