# CLIProxyAPI

This Compose setup runs the official `eceasy/cli-proxy-api:latest` image. The API and Codex OAuth callback are published only on host loopback: `127.0.0.1:8317` and `127.0.0.1:1455`. The service listens on `0.0.0.0` inside Docker so the container can receive traffic; the host bindings keep it inaccessible from other machines.

## Configure and run

From the repository root:

```bash
cd cliproxyapi
cp config.example.yaml config.yaml
```

Edit `config.yaml` and replace `REPLACE_WITH_A_LONG_RANDOM_CLIENT_KEY` with a private random key for clients that call the proxy. This is an **inbound client API key**, not a credential for Codex or another upstream provider. Keep the ignored local file private; do not commit it. The Compose mount persists upstream OAuth credentials under the ignored `auths/` directory.

Start the service and follow its logs:

```bash
docker compose up -d
docker compose logs -f cli-proxy-api
```

Stop it with:

```bash
docker compose down
```

## Add Codex provider authentication

Upstream provider credentials are separate from the inbound `api-keys` value. To start Codex OAuth from the running service, execute:

```bash
docker compose exec cli-proxy-api cli-proxy-api --config /CLIProxyAPI/config.yaml --codex-login --no-browser
```

Open the URL printed by the command and explicitly complete the upstream OAuth flow. The OAuth callback uses port 1455, published on host loopback and forwarded to the container. The resulting provider credentials are stored in `auths/`; no existing Pi credentials are copied or used automatically.

## Use Gemini CLI accounts

CLIProxyAPI and `tuxevil-rotator` are separate gateways with separate OAuth credentials and quotas. Tuxevil remains a separate static provider/catalog and is not part of the standard workflow aliases. See the [Tuxevil setup](../pi/agent/README.md) for its Antigravity/Gemini account pool and existing Pi aliases.

The official [Gemini CLI provider plugin](https://github.com/router-for-me/cpa-plugin-gemini-cli) supports OAuth login. Run this once for each Google account, completing the browser flow with the intended account:

```bash
docker compose exec cli-proxy-api cli-proxy-api \
  --config /CLIProxyAPI/config.yaml --geminicli-login --no-browser
```

The OAuth credentials are stored under the mounted `auths/` directory. They are independent of the inbound client key in `config.yaml` and are not copied from Tuxevil or Pi. A saved credential can include multiple `project_ids`; CLIProxyAPI exposes those as virtual project credentials, not as additional Google accounts.

After login, Pi's `/model` picker discovers the models exposed by CLIProxyAPI. Pi chooses the provider/model; CLIProxyAPI chooses an eligible credential. The documented [`routing.strategy`](https://github.com/router-for-me/CLIProxyAPIDocs/blob/main/docs/en/configuration/basic.md) supports `round-robin` (the default) or `fill-first`; you can set it explicitly in the ignored local `config.yaml`:

```yaml
routing:
  strategy: "round-robin"
```

`quota-exceeded.switch-project` can try another project attached to a credential; it does not create accounts. Gemini CLI quota failover can vary by CLIProxyAPI release, so do not assume a rate-limited credential is always skipped immediately ([upstream issue #1756](https://github.com/router-for-me/CLIProxyAPI/issues/1756)). Tuxevil separately documents quota/health-aware routing for its own Antigravity account pool; account rotation can carry provider terms-of-service risk ([Tuxevil Rotator](https://github.com/tuxevil/tuxevil-rotator)).

## Connect Pi

The provider package `npm:@router-for-me/pi-cliproxyapi-provider` is declared in both `pi/agent/settings.json` and `pi/agent/pi-packages.txt`. After syncing the repository's Pi configuration and installing packages (or run `pi install npm:@router-for-me/pi-cliproxyapi-provider` if it is not installed yet), restart Pi and use:

```text
/login CLIProxyAPI
/model
```

Use the inbound client API key from `config.yaml` when Pi requests the proxy credential. Pi's interactive login stores credentials in `~/.pi/agent/auth.json`; keep that file private (`chmod 600 ~/.pi/agent/auth.json`) and never commit it. After upstream OAuth completes, `/model` discovers the available model catalog dynamically. Workflow aliases now use CLIProxyAPI targets, including `reviewer-model=cliproxyapi/claude-opus-5-5:high` and `cheap-model=cliproxyapi/gpt-6-luna:high`; other standard role aliases chain through `cheap-model`. Pi's interactive default remains `openai-codex/gpt-5.6-luna` unless you select another model. No upstream OAuth is initiated until you explicitly complete the login above.
