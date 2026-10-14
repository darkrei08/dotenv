# Pi orchestration, model fit, and SkillOpt follow-up

Scope: coordinate the authorized follow-up across `dotenv`, `pi-herdr-orchestration`, and `pi-model-fit`; keep provider credentials and runtime secrets unchanged.

## Specs

1. **S1**: "adesso esegui anche la skillopt per questo task ulteriore:"
2. **S2**: "inoltre integra anche nella lista dei task come poter ig,iorare pi herdr orchestration (analizzando le ultime variazioni da https://github.com/boadij/pi-herdsman) e pi model fit (analizzando i modelli dispoinibili ad oggi e quelli cosnigliati per ruolo e anche pèer i miei nuovi ruoli in pi roles per i provider: antigarvity codex claude opencodego e altri blasonati e rispetto agli account collegati o collegabili in cliproxyapi )"
3. **S3**: "esegui nuove pr, completale, mergiale committa agigorna i repo e pushale e chiudile"
4. **S4**: "certoi procedi"
5. **S5**: "aggiona elenco delle skill per far funzioanre skillopt appena agigunto ed integra anche in pi model fit questi link di analisi  https://models.dev/api.json  quello di litellm e quello di pi.dev"

## Tasks

- T1 (S1-S4): Inventory repository state, existing issues/PRs, SkillOpt runtime capability, and current task/role conventions; route: exploration; commit: none.
- T2 (S2): Analyze latest `boadij/pi-herdsman` changes and derive bounded improvements for `pi-herdr-orchestration`; route: research and implementation; commit: one work-unit commit in that repository.
- T3 (S2, S5): Inventory currently available models, plans, CLIProxyAPI registrations, aliases, roles, and the `models.dev`, LiteLLM, and Pi.dev catalogs; produce dated evidence and recommendations in `pi-model-fit`; route: research and implementation; commit: one work-unit commit in that repository.
- T4 (S2, S5): Add the coordinated follow-up to the dotenv task list, register the SkillOpt skill in the repository skill list, and document the SkillOpt workflow without enabling autonomous mutation; route: implementation; commit: one work-unit commit in dotenv.
- T5 (S1-S5): Run applicable tests, GGA/native review gates, create and link issues/PRs, push branches, merge PRs, close resolved issues, and reconcile all repositories; route: delivery; commit: delivery evidence recorded in the Log.

## Log

L1: "adesso esegui anche la skillopt per questo task ulteriore:\n\ninoltre integra anche nella lista dei task come poter ig,iorare pi herdr orchestration (analizzando le ultime variazioni da https://github.com/boadij/pi-herdsman) e pi model fit (analizzando i modelli dispoinibili ad oggi e quelli cosnigliati per ruolo e anche pèer i miei nuovi ruoli in pi roles per i provider: antigarvity codex claude opencodego e altri blasonati e rispetto agli account collegati o collegabili in cliproxyapi )\n\nesegui nuove pr, completale, mergiale committa agigorna i repo e pushale e chiudile"

L2: "certoi procedi"

L3: 2026-10-14: Created approved tracking issues: dotenv #54, pi-herdr-orchestration #2, and pi-model-fit #5. Upstream Herdsman evidence covered commits `0dc62d39`, `a422c804`, `c72acadf`, `44698e40`, `56bd0258`, and `321114de`. The pi-herdr-orchestrator guidance now documents effective-capability routing, presentation-only role labels, simulated-first smoke validation, and nonterminal execution failures. The pi-model-fit report now records local provider/model inventory, plan uncertainty, official source provenance, and provisional Herdr-role mappings without changing persistent role configuration.

L4: SkillOpt runtime execution remains a separate opt-in task. The local runtime checkout is `/root/git/personale/upstream/skillopt` at commit `2f63439`; the expected `~/.skillopt` environment is not installed. No auto-adoption, credential changes, or transcript upload was performed.

L5: "aggiona elenco delle skill per far funzioanre skillopt appena agigunto ed integra anche in pi model fit questi link di analisi  https://models.dev/api.json  quello di litellm e quello di pi.dev"

L6: 2026-10-14: Gemini GGA review failed on the reconciled candidate with two findings: `install_opencode` indexed Node `process.argv[1]` and `process.argv[2]` instead of the arguments at `[2]` and `[3]`, risking a stray `[eval]` file and leaving `opencode.json` unchanged; `skillopt-sleep` was registered in `agents/skills.manifest.json` but omitted from the explicit `pi-ext-roles` skills allowlist. Fixed both findings before commit.
