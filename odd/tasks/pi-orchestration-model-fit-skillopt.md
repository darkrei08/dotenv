# Pi orchestration, model fit, and SkillOpt follow-up

Scope: coordinate the authorized follow-up across `dotenv`, `pi-herdr-orchestration`, and `pi-model-fit`; keep provider credentials and runtime secrets unchanged.

## Specs

1. **S1**: "adesso esegui anche la skillopt per questo task ulteriore:"
2. **S2**: "inoltre integra anche nella lista dei task come poter ig,iorare pi herdr orchestration (analizzando le ultime variazioni da https://github.com/boadij/pi-herdsman) e pi model fit (analizzando i modelli dispoinibili ad oggi e quelli cosnigliati per ruolo e anche pèer i miei nuovi ruoli in pi roles per i provider: antigarvity codex claude opencodego e altri blasonati e rispetto agli account collegati o collegabili in cliproxyapi )"
3. **S3**: "esegui nuove pr, completale, mergiale committa agigorna i repo e pushale e chiudile"
4. **S4**: "certoi procedi"
5. **S5**: "aggiona elenco delle skill per far funzioanre skillopt appena agigunto ed integra anche in pi model fit questi link di analisi  https://models.dev/api.json  quello di litellm e quello di pi.dev"
6. **S6**: "aggiungi al taska anche come pcolelgare opencodego via cliporyapi https://help.router-for.me/introduction/quick-start.html"
7. **S7**: "ti ricordo che ci sono anceh altri modelli che possiamo usare per i ruoli di piworjfklow di vekexasi che abbaimo analizat in precedneza con i miei abbonamenti"
8. **S8**: "aggiungi al task anche tutti  i modelli free denonno essere letti da cliprorxyapi per opencodego e pi model fit deve trovare quali modelli free di opencodego sono adattati per quali ruoli pi role e con quali efferot, quindia ggiungi quesat specifica di controllo opencode go anceh per mia repo estensione pi model fit"
9. **S9**: "ti ricordo che puoi aggoingere ed aggiungere alla liste dei task,  analisi di sviluppo e migliroativa delle mie skill con facendo esecuzione di skillopt di microsoft"

## Tasks

- T1 (S1-S4): Inventory repository state, existing issues/PRs, SkillOpt runtime capability, and current task/role conventions; route: exploration; commit: none.
- T2 (S2): Analyze latest `boadij/pi-herdsman` changes and derive bounded improvements for `pi-herdr-orchestration`; route: research and implementation; commit: one work-unit commit in that repository.
- T3 (S2, S5): Inventory currently available models, plans, CLIProxyAPI registrations, aliases, roles, and the `models.dev`, LiteLLM, and Pi.dev catalogs; produce dated evidence and recommendations in `pi-model-fit`; route: research and implementation; commit: one work-unit commit in that repository.
- T4 (S2, S5): Add the coordinated follow-up to the dotenv task list, register the SkillOpt skill in the repository skill list, and document the SkillOpt workflow without enabling autonomous mutation; route: implementation; commit: one work-unit commit in dotenv.
- T5 (S1-S5): Run applicable tests, GGA/native review gates, create and link issues/PRs, push branches, merge PRs, close resolved issues, and reconcile all repositories; route: delivery; commit: delivery evidence recorded in the Log.
- T6 (S6): Add a bounded OpenCode Go via CLIProxyAPI integration task. First document the supported architecture and prerequisites: CLIProxyAPI installation and startup, the local OpenAI-compatible endpoint (`http://127.0.0.1:8317/v1`), the OpenCode Go subscription key boundary, and the model-prefix/alias rules. Then add only the repository configuration needed to make the route reproducible without storing credentials, and verify it with JSON/YAML validation, a local CLIProxyAPI health or model-catalog check when the service is available, and a clear NOT RUN result when credentials or the service are unavailable. Explicitly distinguish the paid OpenCode Go catalog from separately advertised free models; do not change the global Pi default or claim inference success from catalog discovery alone. Route: research, implementation, and verification; commit: one focused work-unit commit in dotenv.
- T7 (S7): Reconcile the previously analyzed subscription-backed models with the Vekexasia PiWorkflow role aliases. Use the recorded Pi model-fit inventory and current authenticated model discovery as evidence; map native, CLIProxyAPI, Anthropic, OpenAI Codex, and OpenCode Go candidates by role and effort, while preserving provider-neutral aliases and keeping unverified or unavailable models out of defaults. Do not replace subscription-backed models with free OpenCode Go models without measured evidence. Route: research, configuration, and verification; commit: fold into the focused dotenv routing work unit unless the diff becomes independently reviewable.
- T8 (S8): Require all OpenCode Go free-model discovery to come from the CLIProxyAPI catalog exposed by the Docker Compose stack, not from a static direct-provider list alone. Extend `pi-model-fit` so it inventories the currently exposed free OpenCode Go models, evaluates each model's context/output/reasoning capabilities, and recommends suitable `pi-ext-roles` roles and effort levels with explicit evidence and NOT RUN/UNVERIFIED states. Add an OpenCode Go control/check specification to the pi-model-fit extension repository and keep free-model mappings separate from paid subscription-backed defaults. Route: cross-repository research, implementation, and verification; commit: one focused work unit in `pi-model-fit`, plus any minimal consumer-doc update in dotenv.
- T9 (S9): Add a separate Microsoft SkillOpt analysis track to the task list. Inventory the user's installed skills and applicable Microsoft SkillOpt capabilities, run SkillOpt only through its supported explicit execution path, and produce a development/improvement analysis with recommendations and evidence. Keep SkillOpt opt-in, do not upload credentials or transcripts, and do not let SkillOpt mutate repositories or provider configuration without a separately authorized implementation task. Route: research, SkillOpt execution, and report; commit: documentation/evidence only unless a later task authorizes a concrete skill change.

## Log

L1: "adesso esegui anche la skillopt per questo task ulteriore:\n\ninoltre integra anche nella lista dei task come poter ig,iorare pi herdr orchestration (analizzando le ultime variazioni da https://github.com/boadij/pi-herdsman) e pi model fit (analizzando i modelli dispoinibili ad oggi e quelli cosnigliati per ruolo e anche pèer i miei nuovi ruoli in pi roles per i provider: antigarvity codex claude opencodego e altri blasonati e rispetto agli account collegati o collegabili in cliproxyapi )\n\nesegui nuove pr, completale, mergiale committa agigorna i repo e pushale e chiudile"

L2: "certoi procedi"

L3: 2026-10-14: Created approved tracking issues: dotenv #54, pi-herdr-orchestration #2, and pi-model-fit #5. Upstream Herdsman evidence covered commits `0dc62d39`, `a422c804`, `c72acadf`, `44698e40`, `56bd0258`, and `321114de`. The pi-herdr-orchestrator guidance now documents effective-capability routing, presentation-only role labels, simulated-first smoke validation, and nonterminal execution failures. The pi-model-fit report now records local provider/model inventory, plan uncertainty, official source provenance, and provisional Herdr-role mappings without changing persistent role configuration.

L4: SkillOpt runtime execution remains a separate opt-in task. The local runtime checkout is `/root/git/personale/upstream/skillopt` at commit `2f63439`; the expected `~/.skillopt` environment is not installed. No auto-adoption, credential changes, or transcript upload was performed.

L5: "aggiona elenco delle skill per far funzioanre skillopt appena agigunto ed integra anche in pi model fit questi link di analisi  https://models.dev/api.json  quello di litellm e quello di pi.dev"

L6: "aggiungi al taska anche come pcolelgare opencodego via cliporyapi https://help.router-for.me/introduction/quick-start.html"

L7: 2026-10-17: The requested CLIProxyAPI path is documented as a local OpenAI-compatible endpoint (`http://127.0.0.1:8317/v1`) with a dummy client key in OpenCode configuration. OpenCode Go credentials remain provider-specific and must not be written to tracked files; verify the actual OpenCode Go model/key configuration against the current CLIProxyAPI documentation before implementation. The official quick-start page is installation/startup guidance, not proof that OpenCode Go itself is free or that a particular model is exposed.

L8: 2026-10-17: Reframed T6 as a bounded integration task: document prerequisites and credential boundaries, add reproducible non-secret configuration only, validate the local gateway when available, and report unavailable credentials/service as NOT RUN rather than inferring runtime success. The global Pi default remains unchanged until a separate measured inference decision.

L9: "ti ricordo che ci sono anceh altri modelli che possiamo usare per i ruoli di piworjfklow di vekexasi che abbaimo analizat in precedneza con i miei abbonamenti"

L10: 2026-10-17: Added T7 to reconcile previously analyzed subscription-backed models with role aliases before selecting free OpenCode Go fallbacks. The prior model-fit report and authenticated runtime catalog remain the evidence sources; no credentials or subscription assumptions are copied into tracked configuration.

L11: 2026-10-17: Implemented T6/T7 in the focused `odd/tasks/opencode-go-cliproxyapi-routing.md` work unit. The Docker Compose stack was verified running; the gateway route and optional `cliproxyapi/go/...` aliases are documented without changing the global default. Credentialed CLIProxyAPI discovery and inference remain NOT RUN because no secret was read.

L12: "aggiungi al task anche tutti  i modelli free denonno essere letti da cliprorxyapi per opencodego e pi model fit deve trovare quali modelli free di opencodego sono adattati per quali ruoli pi role e con quali efferot, quindia ggiungi quesat specifica di controllo opencode go anceh per mia repo estensione pi model fit"

L13: 2026-10-17: Added T8. Free OpenCode Go discovery is now required to use the authenticated CLIProxyAPI catalog from the Docker Compose stack. Direct `opencode-go` static metadata may support planning but cannot establish that a free model is exposed by the user's gateway. The `pi-model-fit` repository must add a control/report that maps exposed free models to Pi roles and effort levels with capability evidence and explicit unavailable states.

L14: "ti ricordo che puoi aggoingere ed aggiungere alla liste dei task,  analisi di sviluppo e migliroativa delle mie skill con facendo esecuzione di skillopt di microsoft"

L15: 2026-10-17: Added T9 as a separate, opt-in Microsoft SkillOpt analysis track. It may produce recommendations and evidence, but it must not mutate repositories, credentials, provider configuration, or transcripts unless a later implementation task explicitly authorizes those changes.

L16: 2026-10-17: Executed SkillOpt-Sleep through the explicit `/root/git/personale/upstream/.venv/bin/python` path after the system `python` resolved to an unrelated mineru environment. `aimem sync` completed; the mock `dry-run --source pi` completed with `night: 4`, `n_tasks: 5`, `n_sessions: 5`, `baseline: 0.0`, `candidate: 0.0`, `gate_action: reject`, `accepted: false`, `adopted: false`, and no staged edits. No credentials, transcripts, live provider, or repository skills were mutated.

L6: 2026-10-14: Gemini GGA review failed on the reconciled candidate with two findings: `install_opencode` indexed Node `process.argv[1]` and `process.argv[2]` instead of the arguments at `[2]` and `[3]`, risking a stray `[eval]` file and leaving `opencode.json` unchanged; `skillopt-sleep` was registered in `agents/skills.manifest.json` but omitted from the explicit `pi-ext-roles` skills allowlist. Fixed both findings before commit.
