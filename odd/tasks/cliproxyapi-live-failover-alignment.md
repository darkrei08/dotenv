# CLIProxyAPI live failover alignment

Authorized runtime/configuration alignment for the currently exposed CLIProxyAPI catalog, with workflow verification before closure.

## Specs

1. **S1**: "E allora qual è la soluzione migliore per far funzionare il failover?"
2. **S2**: "Applicala eseguendo P workflow con il rispettivo modello failover"
3. **S3**: "fai dei test continui fin tanto che non risolvi."
4. **S4**: "Sì, ma come ti ho detto prima sarebbe utile appunto che P Model Fit si ha un'estensione di Pagent che permetta in runtime nella stessa sessione ad automaticamente ad applicare la matrice di failover dopo appunto la richiesta dell'utente di rianalizzare il mercato attuale di tutti gli agenti secondo quali modelli ad effort disponibilmente a quelli collegati dalle sottoscrizioni e dagli abbonamenti in CLI Proxy App sono disponibili."

## Tasks

- T1 [S1-S2] Align role aliases and HA group order with currently reachable CLIProxyAPI model IDs and efforts; commit: none yet.
- T2 [S1] Update deterministic config checks and routing documentation to describe the active catalog-backed matrix; commit: none yet.
- T3 [S2-S3] Sync the live role/HA configuration without exposing credentials and run repeated Pi Extensible Workflows for each role route and fallback; commit: none yet.
- T4 [S4] Add the same-session Pi Agent runtime integration that lets pi-model-fit reanalyze the authenticated CLIProxyAPI catalog and apply its resulting model/effort failover matrix after an explicit user refresh request; commit: none yet.

## Log

- L1: E allora qual è la soluzione migliore per far funzionare il failover? Applicala eseguendo P workflow con il rispettivo modello failover e fai dei test continui fin tanto che non risolvi.
- L2: Sì, ma come ti ho detto prima sarebbe utile appunto che P Model Fit si ha un'estensione di Pagent che permetta in runtime nella stessa sessione ad automaticamente ad applicare la matrice di failover dopo appunto la richiesta dell'utente di rianalizzare il mercato attuale di tutti gli agenti secondo quali modelli ad effort disponibilmente a quelli collegati dalle sottoscrizioni e dagli abbonamenti in CLI Proxy App sono disponibili.
