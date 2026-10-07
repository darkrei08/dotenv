# CLIProxyAPI + CPA Usage Keeper

This is the CLIProxyAPI local model gateway in this setup. An optional
`tuxevil-rotator` gateway is documented in `../pi/agent/README.md`. The Compose stack runs the
official CLIProxyAPI image and [CPA Usage Keeper](https://github.com/Willxup/cpa-usage-keeper).
The API and OAuth callback are bound to loopback only:

- CLIProxyAPI: `http://127.0.0.1:8317`
- CPA management panel: `http://127.0.0.1:8317/management.html`
- Keeper usage dashboard: `http://127.0.0.1:8080`
- OAuth callback: `127.0.0.1:1455`

CLIProxyAPI manages provider OAuth accounts and serves models. Keeper reads CPA
usage, cost, request and quota data. Keeper is the usage interface; it does not
replace CPA's management panel for adding OAuth accounts.

## Configure and run

From the repository root:

```bash
cd cliproxyapi
cp config.example.yaml config.yaml
cp keeper.env.example keeper.env
chmod 600 config.yaml keeper.env
```

Set these values before starting:

- `config.yaml`: a private inbound `api-keys` value and a private
  `remote-management.secret-key`.
- `keeper.env`: the same plaintext management key as
  `CPA_MANAGEMENT_KEY`, plus a private `LOGIN_PASSWORD`.

`remote-management.allow-remote: true` is required because Keeper calls CPA
from another container. Host ports remain bound to `127.0.0.1`. CPA hashes the
management key in `config.yaml` after startup; keep the plaintext copy only in
the ignored `keeper.env` file.

Start and inspect the stack:

```bash
docker compose up -d
docker compose ps
docker compose logs -f cli-proxy-api
```

Stop it without deleting local OAuth or Keeper data:

```bash
docker compose down
```

Do not use `docker compose down -v` unless you deliberately want to delete
Docker-managed volumes from an older deployment.

## Add provider accounts

The provider credentials are separate from the inbound API key. Use the CPA
management panel, or start an OAuth flow in the running container:

```bash
docker compose exec cli-proxy-api \
  /CLIProxyAPI/CLIProxyAPI -config /CLIProxyAPI/config.yaml -codex-login -no-browser

docker compose exec cli-proxy-api \
  /CLIProxyAPI/CLIProxyAPI -config /CLIProxyAPI/config.yaml -claude-login -no-browser

docker compose exec cli-proxy-api \
  /CLIProxyAPI/CLIProxyAPI -config /CLIProxyAPI/config.yaml -antigravity-login -no-browser
```

Open the URL printed by the command and complete the OAuth flow. Credentials
are stored under the ignored `auths/` directory. No Pi credentials are copied
automatically.

Check the dynamic catalog without printing the API key:

```bash
CPA_KEY='paste-the-local-api-key-here'
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' \
  -H "Authorization: Bearer ${CPA_KEY}" \
  'http://127.0.0.1:8317/v1/models?client_version=pi'
unset CPA_KEY
```

The response is empty until at least one provider account is authenticated.
Keeper will then collect new usage records and refresh quota metadata.

## Connect Pi

The provider package `npm:@router-for-me/pi-cliproxyapi-provider` is declared
in `pi/agent/settings.json` and `pi/agent/pi-packages.txt`. After syncing and
installing the repository's Pi configuration, restart Pi and run:

```text
/login CLIProxyAPI
/model
```

Use the inbound `api-keys` value from `config.yaml`. Pi stores its local
provider credentials in ignored files under `~/.pi/agent/`. After accounts are
authenticated, use `/cliproxyapi-refresh` and select a live `cliproxyapi/...`
model. The standard workflow aliases use native providers by default, so
workflows do not stop when this gateway is offline. To route a child agent
through CLIProxyAPI, use these explicit aliases as its per-agent model override:

- `cliproxy-cheap-model=cliproxyapi/claude-sonnet-5-5:medium`
- `cliproxy-luna=cliproxyapi/gpt-6-luna:high`
- `cliproxy-reviewer-model=cliproxyapi/claude-opus-5-5:high`
- `cliproxy-sol=cliproxyapi/gpt-6.1-sol:medium`
- `cliproxy-astra=cliproxyapi/gpt-6-astra:high`

These aliases resolve only after the CLIProxyAPI catalog is authenticated. No
second dashboard is required.

## Keeper login and data

Open `http://127.0.0.1:8080` and use the `LOGIN_PASSWORD` from `keeper.env`.
Keeper stores its SQLite database and backups in the ignored `keeper/` directory.
Keep the dashboard loopback-only unless you deliberately put it behind an
authenticated reverse proxy.

The old `cliproxyapi-dashboard` deployment is not part of this stack. Stop an
old deployment with its own Compose file before starting this one, but preserve
its volumes until you have confirmed that the migration is complete.
