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

## Connect Pi

The provider package `npm:@router-for-me/pi-cliproxyapi-provider` is declared in both `pi/agent/settings.json` and `pi/agent/pi-packages.txt`. After syncing the repository's Pi configuration and installing packages (or run `pi install npm:@router-for-me/pi-cliproxyapi-provider` if it is not installed yet), restart Pi and use:

```text
/login CLIProxyAPI
/model
```

Use the inbound client API key from `config.yaml` when Pi requests the proxy credential. Pi's interactive login stores credentials in `~/.pi/agent/auth.json`; keep that file private (`chmod 600 ~/.pi/agent/auth.json`) and never commit it. After upstream OAuth completes, `/model` discovers the available model catalog dynamically. Select a model explicitly; this setup does not change `defaultProvider`, `defaultModel`, `pi/agent/models.json`, workflow aliases, or default routing. No upstream OAuth is initiated until you explicitly complete the login above.
