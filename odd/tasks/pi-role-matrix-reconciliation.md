# Pi Workflow role and HA matrix reconciliation

This feature reconciles model-fit role primaries with the committed CLIProxyAPI failover matrix and local Pi runtime without changing credentials or installed third-party packages.

## Specs

1. **S1**: "sincronizzare localmente su questa macchina, gli alias, i ruoli, i modelli, gli effort, secondo appunto quelli preimpostati nella matrice predefinita quella di failover, che abbiamo committato localmente."
2. **S2**: "devono avere tutto l'ultimo aggiornamento e tutta l'ultima conciliazione."
3. **S3**: "siano correttamente allineati i modelli utilizzati dai singoli ruoli all'interno dei flussi di lavoro workflow di P workflow Extensions"
4. **S4**: "quelli individuati con P-model fit hai usato per i rispettivi ruoli l'una 6, che è diverso rispetto a quelli predefiniti che abbiamo studiato, analizzato con i report."
5. **S5**: The selected policy is hybrid: pi-model-fit defines each role's primary model and each role is explicitly mapped to a committed HA failover group.

## Tasks

- T1 [S1-S5] Compare tracked role aliases, model-fit reports, committed HA matrix, live Pi Ext Roles, and Pi Workflow role loading. Route: read-only reconciliation. Commit: pending.
- T2 [S1-S5] Implement the smallest explicit role-to-HA mapping and synchronize only managed local files. Route: dotenv Pi configuration. Commit: pending.
- T3 [S1-S5] Add regression checks for alias, effort, role-group coverage, live/source parity, and failover resolution. Route: check-config/tests. Commit: pending.
- T4 [S1-S5] Run focused and platform checks, GGA/native review where applicable, commit one coherent work unit, and record the commit in Engram. Route: verification/delivery. Commit: pending.

## Log

- L1: "Eseguendo Excellen Engineering Porkflow, Ptern Rules, devi analizzare tutte le singole usu o commit, ancora aperti, riorganizzarli, targettizzarli per i singoli repo su cui abbiamo operato. E poi l'ulteriore PR per Guardian Angel in cui è integrata PI.dev deve essere tutti svolti completati committati pusciati mergiati chiusi e quando è tutto a posto salvare step by step la memoria dei singoli commit quindi possiamo integrare un'ulteriore direttiva in agence md in clode md e germin md e così via e nel mio pacchetto aimem la direttiva che per ogni commit bisogna appunto salvare in memoria indicizzandola quando è completato tutto, di ogni singolo task, allora possiamo ritenerci soddisfatti e chiudere anche questa sessione di P del rispettivo panel header."
- L2: "Aggiungi alla lista dei task anche quello di dover sincronizzare localmente su questa macchina, gli alias, i ruoli, i modelli, gli effort, secondo appunto quelli preimpostati nella matrice predefinita quella di failover, che abbiamo committato localmente. E qui quindi, appunto, devono avere tutto l'ultimo aggiornamento e tutta l'ultima conciliazione. E che quindi siano correttamente allineati i modelli utilizzati dai singoli ruoli all'interno dei flussi di lavoro workflow di P workflow Extensions perché mi sono reso conto che quelli individuati con P-model fit hai usato per i rispettivi ruoli l'una 6, che è diverso rispetto a quelli predefiniti che abbiamo studiato, analizzato con i report."
- L3: User selected the hybrid policy: model-fit primary per role plus explicit HA group per role.
- L4: Current evidence: tracked Pi Ext Roles contains GPT-5.6 Luna aliases for native/CLIProxyAPI Luna; committed `pi/agent/ha-failover.example.json` contains GPT-6 Luna in development/scout/research/testing groups; live `/root/.pi/agent/pi-ext-roles/settings.json` contains GPT-6 Luna. Pi HA currently reads only `PI_HA_GROUP` or active/default group, so explicit role propagation is not yet implemented.
