# OpenCode Go through the CLIProxyAPI Docker stack

Scope: add reproducible, non-secret OpenCode Go routing guidance for the local `cliproxy-stack`; preserve existing staged user changes and keep the global Pi default unchanged.

## Specs

1. **S1**: "aggiungi al taska anche come pcolelgare opencodego via cliporyapi https://help.router-for.me/introduction/quick-start.html"
2. **S2**: "ti ricordo che cliproxyapi e keeper sono eseguiti su questa macchian come docker compose e sono nello stack mio cliproxy api stack"
3. **S3**: "ti ricordo che ci sono anceh altri modelli che possiamo usare per i ruoli di piworjfklow di vekexasi che abbaimo analizat in precedneza con i miei abbonamenti"
4. **S4**: "aggiungi al task anche tutti  i modelli free denonno essere letti da cliprorxyapi per opencodego e pi model fit deve trovare quali modelli free di opencodego sono adattati per quali ruoli pi role e con quali efferot, quindia ggiungi quesat specifica di controllo opencode go anceh per mia repo estensione pi model fit"

## Tasks

- T1 (S1-S3): Document the Docker Compose topology, CLIProxyAPI loopback endpoint, OpenCode Go credential boundary, model prefix/alias rules, and role-selection policy without storing secrets; route: implementation; commit: pending.
- T2 (S1-S3): Add only verified non-secret configuration and role aliases; preserve subscription-backed candidates and do not change the global Pi default; route: implementation; commit: pending.
- T3 (S1-S3): Validate JSON/YAML, Compose state, unauthenticated gateway behavior, and credentialed model discovery only if an authorized non-secret runtime check is available; route: verification; commit: pending.
- T4 (S4): Require the authenticated CLIProxyAPI catalog to be the source of truth for free OpenCode Go exposure, and add a coordinated `pi-model-fit` control/report that maps exposed free models to Pi roles and effort levels using capability evidence; route: cross-repository research and verification; commit: pending.

## Log

L1: "aggiungi al taska anche come pcolelgare opencodego via cliporyapi https://help.router-for.me/introduction/quick-start.html"

L2: "ti ricordo che cliproxyapi e keeper sono eseguiti su questa macchian come docker compose e sono nello stack mio cliproxy api stack"

L3: "ti ricordo che ci sono anceh altri modelli che possiamo usare per i ruoli di piworjfklow di vekexasi che abbaimo analizat in precedneza con i miei abbonamenti"

L4: 2026-10-17: Docker Compose runtime evidence shows `cliproxy-stack` running with CLIProxyAPI and CPA Usage Keeper healthy. The unauthenticated root endpoint returned HTTP 200 and `/v1/models` returned HTTP 401 `Missing API key`; no credential files or secret values were read. The repository's provider documentation defines `http://127.0.0.1:8317` as the Pi gateway and keeps credentials in ignored runtime files.

L5: 2026-10-17: OpenCode Go is a CLIProxyAPI provider-side subscription route, distinct from the direct `opencode-go` Pi provider. Paid OpenCode Go and separately advertised free model entries must remain distinct; catalog discovery is not proof of inference success.

L6: "aggiungi al task anche tutti  i modelli free denonno essere letti da cliprorxyapi per opencodego e pi model fit deve trovare quali modelli free di opencodego sono adattati per quali ruoli pi role e con quali efferot, quindia ggiungi quesat specifica di controllo opencode go anceh per mia repo estensione pi model fit"

L7: 2026-10-17: Added the non-secret `opencode-go-api-key` example block to `cliproxyapi/config.example.yaml`, with `prefix: "go"`, and documented the resulting `cliproxyapi/go/...` Pi route in `cliproxyapi/README.md`. Added optional aliases for scout, DeepSeek V4.1 Flash, LongCat Free, and Step Free without changing `scout-model` or the global Pi default.

L8: 2026-10-17: Verification passed: role-alias JSON assertions, PyYAML parsing of `config.example.yaml`, `docker compose config --quiet`, running Compose services, CLIProxyAPI root HTTP 200, expected unauthenticated `/v1/models` HTTP 401 `Missing API key`, and `pi --list-models opencode-go` listing the direct free and paid candidates. Credentialed CLIProxyAPI catalog discovery and inference were NOT RUN because no API key was read or exposed.

L9: 2026-10-17: T4 now requires the authenticated CLIProxyAPI model catalog to drive free OpenCode Go discovery. Static direct-provider metadata remains descriptive only; `pi-model-fit` must produce the role/effort suitability report from the user's exposed gateway catalog and preserve explicit NOT RUN/UNVERIFIED states.
