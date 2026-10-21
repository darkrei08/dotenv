# Model routing and gateway refresh 2026-10-22

Authorized configuration refresh for live Pi routing and the CLIProxyAPI/CPA Usage Keeper stack.
Do not modify credentials, auth state, workflow structure, or unrelated working-tree files.

## Specs

1. **S1 - Current model evidence:** "eseguite adesso una nuova ricerca con P Model Fit per individuare quali modelli sono attualmente disponibili in CLI Proxy, Api e online"
2. **S2 - Role matrix and upstream alignment:** "qual è la migliore matrice di assegnazione per determinati ruoli, dirmela e applicala appunto per i ruoli nella mia configurazione di P Agent, e quindi nella configurazione di PExtRoll"
3. **S3 - Image refresh:** "vorrei capire se puoi effettuare il pool della nuova immagine Docker di Clay Proxy API e di keeper"
4. **S4 - Role cleanup and failover:** "Ti suggerisco anche di allineare ai ruoli di Vex Asia eliminando non lo so, duplicati, aspetti nativi oppure se sono necessari i provider nativi per Guardian Angel lasciali però vorrei migliorare i modelli utilizzati e i rispettivi ruoli perché vedo troppi duplicati o per lo meno anche ruoli che non hanno tanto senso e vorrei mettere ordine in quanto utilizzo prevalentemente o in nativi o CLI proxy api senza avere il modello con la sua denominazione e poi l'intero ID del modello è l'effort. Quindi insomma trovo una soluzione migliore per riorganizzare meglio i modelli rispetto a quelli disponibili e che seguono le matrici comparative canoniche e poi quelle di failover. Ed esegui, appunto dei test per verificare se P Agent conosce a priori se è disponibile in un modello e quindi seleziona il rispettivo modello failover."
5. **S5 - Safety:** Apply only the necessary alias/role/default/failover configuration and matching documentation/invariants. Preserve credentials, provider auth, HA state, workflow structure, and unrelated working-tree files.

## Tasks

- [ ] T1 (S1): Inventory Pi-listed, gateway, native, and public-source model evidence; record route gates, context/output limits, and unknown entitlement/quota. Route: pi-model-fit scripts and bounded official web research. Commit: pending.
- [ ] T2 (S3): Pull the latest CLIProxyAPI and CPA Usage Keeper images, recreate only when changed, and verify health/API status. Route: `/root/git/personale/cliproxy-stack`. Commit: pending.
- [ ] T3 (S2,S4,S5): Align the role/alias architecture with Vek Asia while retaining only justified local roles and the native provider path required by Guardian Angel. Apply the evidence-backed primary/failover matrix to canonical dotenv config and live Pi config. Route: `pi/agent/settings.json`, `pi/agent/pi-ext-roles/settings.json`, `pi/agent/pi-ext-roles/roles/*.md`, `.gga`, `check-config.sh`, and current routing docs as required. Commit: pending.
- [ ] T4 (S4,S5): Add or run deterministic tests proving Pi rejects unavailable primary routes and selects the configured failover route before execution, without sending inference or mutating credentials. Route: existing preflight/HA/config test surfaces. Commit: pending.
- [ ] T5 (S1-S5): Run configuration, model-list, runtime, failover, health, and bounded smoke checks; save the dated evidence report and record unavailable gates. Route: verification commands and report artifacts. Commit: pending.

## Log

- **L1:** "Pertanto, se tu eseguite adesso una nuova ricerca con P Model Fit per individuare quali modelli sono attualmente disponibili in CLI Proxy, Api e online, qual è la migliore matrice di assegnazione per determinati ruoli, dirmela e applicala appunto per i ruoli nella mia configurazione di P Agent, e quindi nella configurazione di PExtRoll. E soprattutto vorrei capire se puoi effettuare il pool della nuova immagine Docker di Clay Proxy API e di keeper."
- L2: Live preflight on 2026-10-22 listed 74 models across Anthropic, CLIProxyAPI, OpenAI Codex, OpenCode Go, and unavailable Google/OpenRouter providers. The gateway exposed 16 models; catalog visibility, entitlement, and quota remain separate evidence states.
- L3: `docker compose pull` completed successfully. CLIProxyAPI remained digest `sha256:ab8dda4113ecb5b42986b7cd2bbad89e330ad33c0fa0185c2434654375055b20`; Keeper remained digest `sha256:81907edb9027001d8432d7e720f28ea43f36a9dd5d9fc9db7f83280e62328a28`, version 2.0.0. Both services are running; Keeper is healthy; root and Keeper health endpoints returned HTTP 200.
- L4 (2026-10-22): User decision: "Mantieni la nuova matrice". Keep the refreshed high/xhigh/low routing and reconcile repository policy, checks, and documentation before publication.
- **L4:** "Ti suggerisco anche di allineare ai ruoli di Vex Asia eliminando non lo so, duplicati, aspetti nativi oppure se sono necessari i provider nativi per Guardian Angel lasciali però vorrei migliorare i modelli utilizzati e i rispettivi ruoli perché vedo troppi duplicati o per lo meno anche ruoli che non hanno tanto senso e vorrei mettere ordine in quanto utilizzo prevalentemente o in nativi o CLI proxy api senza avere il modello con la sua denominazione e poi l'intero ID del modello è l'effort. Quindi insomma trovo una soluzione migliore per riorganizzare meglio i modelli rispetto a quelli disponibili e che seguono le matrici comparative canoniche e poi quelle di failover. Ed esegui, appunto dei test per verificare se P Agent conosce a priori se è disponibile in un modello e quindi seleziona il rispettivo modello failover."
