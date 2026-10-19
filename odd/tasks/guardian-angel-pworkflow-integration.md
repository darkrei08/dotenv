# Guardian Angel Pi Ext Roles and P-Workflow integration

Feature document for the cross-repository GGA integration and delivery work.

## Specs

1. **S1**: "Procedi alla risoluzione definitiva di tutti i task, di tutti gli uso, di tutte le PR e anche delle ultime attività necessarie per GGA, dove risultano ancora segnalazioni indipendenti per Answare.ts e per Ponytail, dopodiché, visto che GGA finalmente adesso utilizza i modelli secondo i ruoli e gli effort ed esegue anche i failover."
2. **S2**: "Posso immaginare di creare uno script, qualcosa in codice per attivare gga a leggere i ruoli."
3. **S3**: "Possi poi creare una PR mastodontica e molto descrittiva da inviare al repo Guardian Angel descrivendo qual è l'attuale stack, quali sono le estensioni utilizzate, che cosa fanno questi script, in modo tale da rendere Guardian Edge il più indipendente possibile anche dal client nativo provider, perché appunto è possibile leggerlo attraverso CLI Proxy Api."
4. **S4**: "Ma soprattutto quando poi quel tipo di alias ruolo, e quindi quel tipo di modello ed effort non sono disponibili, si passa al modello successivo con la matrice di failover."
5. **S5**: "Review the delivered subagent output and continue."

## Tasks

- T1 [S1,S4] Finish the local GGA reviewer alias, effort, and failover implementation. Route: current dotenv worktree. Commit: pending.
- T2 [S1,S3] Audit official Guardian Angel open issues and pull requests, then identify only the bounded upstream contribution needed for Pi/CLIProxyAPI role routing. Route: read-only inventory first. Commit: pending.
- T3 [S2,S3] Prepare the smallest upstream GGA integration patch and descriptive documentation. Route: dedicated Guardian Angel branch/worktree. Commit: `eb3757c` (`feat(providers): add Pi CLI backend`).
- T4 [S3] Verify, publish, and report the upstream PR through P-Workflow Extension. Route: official Guardian Angel repository. Commit: blocked until issue #131 receives `status:approved`; no PR opened.

## Log

- L1: "Procedi alla risoluzione definitiva di tutti i task, di tutti gli uso, di tutte le PR e anche delle ultime attività necessarie per GGA, dove risultano ancora segnalazioni indipendenti per Answare.ts e per Ponytail, dopodiché, visto che GGA finalmente adesso utilizza i modelli secondo i ruoli e gli effort ed esegue anche i failover. Posso immaginare di creare uno script, qualcosa in codice per attivare gga a leggere i ruoli. Possi poi creare una PR mastodontica e molto descrittiva da inviare al repo Guardian Angel descrivendo qual è l'attuale stack, quali sono le estensioni utilizzate, che cosa fanno questi script, in modo tale da rendere Guardian Edge il più indipendente possibile anche dal client nativo provider, perché appunto è possibile leggerlo attraverso CLI Proxy Api."
- L2: User selected cross-repository audit and publication of the PR, with the official repository discovered as `https://github.com/Gentleman-Programming/gentleman-guardian-angel`, default branch `main`.
- L3: GGA independently reported the reviewer documentation chain as stale; docs/gentle-ai-gga.md was corrected to `reviewer.md → reviewer-model → cliproxy-reviewer-model`.
- L4: "Attenzione però! Attenzione però! Potremmo aver bisogno anche di integrare Pi Workflow, CLI, proxy api l'estensione P Model Fit e P Extern Rules e P workflow di Vexia all'interno anche della suite Guardian Angel e Gentle e capire se qualcosa si sovrappone a questi progetti o tra di loro si sovrappongono. Prima inviare la pull request che si allega o che si attacca ad altre pull request."
- L5: The boundary audit found that the upstream contribution must remain a native headless `pi[:model]` provider. Pi Workflow Extensions, CLIProxyAPI routing, pi-model-fit recommendations, and pi-ext-roles resolution remain Pi/Gentle-side concerns and must not be embedded into provider-neutral GGA. The local dotenv bridge may continue to resolve role aliases and failover before invoking Pi; the upstream PR must not be published until issue #131 has `status:approved`.
