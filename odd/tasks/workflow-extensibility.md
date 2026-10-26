# Workflow Extensibility and Governed Child Briefs
Feature ledger for integrating TeamAI-derived governance, child briefs, evidence/HITL gates, and knowledge loop into PiWorkflow. Read through `## Log` before editing.

## Specs

S1. "Seguendo P Workflow, P, Hard Orchestration, Excellence Engineering e anche tutte le skill di Mac Path puoi analizzare come possiamo integrare le ulteriori direttive di questo ulteriore repo analizzando i ruoli, i system prompt dei ruoli, le logiche, agentiche di orchestrazione sotto agentica in modo"

S2. "Perfetto procedi all'implementazione di tutte le analisi che hai individuato per poter migliorare al meglio più workflow extensible esegui step by step con Wayfinder, Grilling with Docks e con tutte le skill di Excellence Engineering, e dopodiché implementa i commit localmente merge sul mio repo e poi esegui la pure request sul repo di Vega Xasia."

S3. "Il tutto deve andare in PX Rolls come appunto ha effettuato Vexancia che ha separato i ruoli da P Workflow."

S4. "API pubblica completa" & "Esegui una ricerca complessiva e trovo la soluzione migliore che Vexaksia possa accettare."

S5. "Percorso staged consigliato: PiWorkflow resta l’unico scheduler; ogni slice resta reviewabile e reversibile."

S6. "Dipendenze dirette" [soggetta a verifica di confini architetturali e compatibilità upstream]

## Tasks

- T1 [S1,S2,S5] Establish Wayfinder Map (darkrei08/dotenv#84) and dispatch research tickets #85, #86, #87; route: wayfinder; commit: none (complete).
- T2 [S2,S3,S4] Complete Wayfinder research workflow for roles, HITL/evidence, and Engram/SkillOpt boundaries; route: research; commit: none (in_progress).
- T3 [S2,S3,S4] Settle public child-brief schema and compatibility guarantees based on research evidence; route: design; commit: none.
- T4 [S2,S4] Settle maintainer-acceptable HITL/evidence contract extending checkpoint and run-scoped evidence; route: design; commit: none.
- T5 [S2,S6] Settle knowledge-loop and memory/adoption boundary adhering to repository boundary and licensing constraints; route: design; commit: none.
- T6 [S2,S4] Implement vertical test-first slice for child-brief schema and validation in pi-extensible-workflows; route: implementation; commit: pending.
- T7 [S2,S3] Implement role-boundary adapter updates adhering to pi-ext-roles separation; route: implementation; commit: pending.
- T8 [S2,S4] Implement HITL/evidence extension with unit tests; route: implementation; commit: pending.
- T9 [S2,S6] Implement knowledge-loop integration and dotenv policy/documentation; route: implementation; commit: pending.
- T10 [S2] Run comprehensive verification (npm run check, evals, docs check); route: verification; commit: pending.
- T11 [S2] Commit reviewable work units, merge locally into fork main, and open upstream PR to vekexasia/pi-extensible-workflows; route: delivery; commit: pending.

## Log

L1. User request: "Seguendo P Workflow, P, Hard Orchestration, Excellence Engineering e anche tutte le skill di Mac Path puoi analizzare come possiamo integrare le ulteriori direttive di questo ulteriore repo analizzando i ruoli, i system prompt dei ruoli, le logiche, agentiche di orchestrazione sotto agentica in modo"
L2. User authorization: "Perfetto procedi all'implementazione di tutte le analisi che hai individuato per poter migliorare al meglio più workflow extensible esegui step by step con Wayfinder, Grilling with Docks e con tutte le skill di Excellence Engineering, e dopodiché implementa i commit localmente merge sul mio repo e poi esegui la pure request sul repo di Vega Xasia."
L3. Grilling Round 1 decisions:
  - Destinazione: Staged delivery with PiWorkflow as the single scheduler.
  - Repositories: Runtime (`pi-extensible-workflows`) + coordination/policy (`dotenv`).
  - Delivery: Local work-unit commits, merge into fork main, then upstream PR to vekexasia.
L4. Grilling Round 2 decisions:
  - Role ownership: Preserved in `pi-ext-roles` as separated by upstream maintainer Vekexasia.
  - Child brief: Full public typed API.
  - HITL/evidence: Comprehensive research to identify the cleanest solution acceptable to upstream.
  - Knowledge loop: Direct dependencies requested by user, subject to architectural research and failure isolation.
L5. Wayfinder map created: darkrei08/dotenv#84 with child tickets #85, #86, #87, #88, #89.
L6. Multi-agent research workflow launched (fe755376-5ec5-4fd1-82d2-dbd42d1e9f91) covering roles, HITL/evidence, and Engram/SkillOpt boundaries.
