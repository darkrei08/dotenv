# Workflow Gemini transport compatibility
Feature tracking for the authorized local Pi orchestration fix.

## Specs
1. **S1**: "Attenzione, analizza correttamente tutte le impostazioni di P agence in locale. In quanto quando richiedo di seguire dei flussi, loop di sottoagti, non avvia lo stand alone workflow con i rispettivi ruoli. E alias. Quindi segui questa analisi, correggi, e porta in gol questo risultato. Esegui tutti i commit locali. Dopodiché, al termine del turno, dimmi se è stato risolto eseguendo appunto dei test. E dimmi quando potrò fare il commit della modifica e pusciarlo sul mio dot-env repo."
2. **S2**: Workflow role launches must use the configured CLIProxyAPI routes and complete through the Herdr transport without timing out before model output.
3. **S3**: The repository's source configuration and live `~/.pi/agent` configuration must remain synchronized after the fix.

## Tasks
- T1 | S1-S2 | Reproduce the failing Gemini high workflow route and verify a stable route | commit: prior evidence
- T2 | S2 | Align Gemini workflow aliases, HA entries, tests, and documentation with the stable effort | commit: 2798370
- T3 | S3 | Sync live Pi configuration and run source/live checks | commit: 2798370
- T4 | S1-S3 | Commit the coherent dot-env work unit and report publication state | commit: 2798370

## Log
- L1: Attenzione, analizza correttamente tutte le impostazioni di P agence in locale. In quanto quando richiedo di seguire dei flussi, loop di sottoagti, non avvia lo stand alone workflow con i rispettivi ruoli. E alias. Quindi segui questa analisi, correggi, e porta in gol questo risultato. Esegui tutti i commit locali. Dopodiché, al termine del turno, dimmi se è stato risolto eseguendo appunto dei test. E dimmi quando potrò fare il commit della modifica e pusciarlo sul mio dot-env repo.
- L2: Explicit Gemini high workflow probe timed out with zero model tokens; the same prompt succeeded with Gemini medium and CLIProxyAPI GPT high. The failure is therefore tied to the Gemini high route in the Herdr workflow transport, not to role alias parsing.
- L3: Effort labels must remain separate from model names: human-facing documentation should call the model `Gemini 3.8 Flash` and show `medium` or `high` as the configured effort, while the exact provider model ID remains unchanged for runtime routing.
- L4: Effettua anche una correzione sulle etichette di questi alias e modelli. In quanto se si chiama Gemini 3.8 Flash deve essere Flash, allora impostano Gemini 3.8 e poi l'hforte affianco quindi riscrivi meglio le etichette.
- L5: E quindi la stessa logica dell'etichetta la devi applicare a tutti i modelli, in modo tale che sia ordinata la questione. Tra alias e i ruoli PX Rolls. Quindi PX Rolls deve comandare su alias.
- L6: Pi ext roles
- L7: Commit `2798370` passed the repository GGA pre-commit review. Source checks passed: 35 Node tests, `check-config.sh`, role-tool policy, shell syntax, and `git diff --check`. Live aliases match source with zero Gemini high-effort workflow aliases. Runtime role probes passed for scout, researcher, architect, oracle, market-researcher, and marketing-strategist in workflow run `f69d5642-987d-4248-a8d5-11e1a2737f9d`; optional Gemini researcher/developer/tests aliases passed in run `b572d8f0-348a-4365-8040-a23ef6ad73e4`.
