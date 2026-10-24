# CLIProxyAPI + CPA Usage Keeper

This is the CLIProxyAPI local model gateway in this setup. The Compose stack runs the
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
model. The configured workflow role aliases use CLIProxyAPI by default, so role
routing follows the shared gateway-backed matrix. Native aliases remain explicit
alternatives when the gateway is unavailable. To route a child agent through
CLIProxyAPI with a specific route, use these explicit aliases as its per-agent
model override:

- `cliproxy-cheap-model=cliproxyapi/gpt-5.6-luna:medium`
- `cliproxy-luna=cliproxyapi/gpt-5.6-luna:high`
- `cliproxy-reviewer-model=cliproxyapi/claude-opus-4-6-thinking:off`
- `cliproxy-sol=cliproxyapi/gpt-6-sol:high`
- `cliproxy-astra=cliproxyapi/gpt-6-astra:medium`

These aliases resolve only after the CLIProxyAPI catalog is authenticated. No
second dashboard is required.

## Route OpenCode Go through CLIProxyAPI

The Compose stack can route an OpenCode Go subscription key through the same
local gateway. This is separate from Pi's direct `opencode-go/...` provider:

- direct Pi provider: `opencode-go/deepseek-v4.1-flash`
- CLIProxyAPI route: `cliproxyapi/go/deepseek-v4.1-flash`

The `go/` segment comes from the optional `prefix: "go"` in the
`opencode-go-api-key` entry. Add that entry to the ignored `config.yaml`, using
`config.example.yaml` as the shape, then restart only the stack when the local
configuration changes:

```bash
docker compose up -d --force-recreate cli-proxy-api
```

The client-facing key remains the private `api-keys` value already required by
CLIProxyAPI. The OpenCode Go subscription key is a separate upstream credential;
never copy either value into Git, Pi role settings, or an OpenCode config file.

After the stack is running, verify the gateway without printing secrets:

```bash
curl -fsS http://127.0.0.1:8317/
```

Then authenticate Pi through `/login CLIProxyAPI` and run
`/cliproxyapi-refresh`. The resulting `cliproxyapi/go/...` models are dynamic:
model listing proves catalog exposure only, not successful inference. If the
stack has no authenticated OpenCode Go account, report model discovery and
inference as NOT RUN rather than falling back silently.

Optional Pi role aliases for this route are kept in
`pi/agent/pi-ext-roles/settings.json`; they do not replace the existing
subscription-backed defaults. Free entries such as `cat-jam-free`,
`longcat-2.5-preview-free`, and `step-5-preview-free` are suitable for scout or
fallback experiments only until role-quality evidence exists. DeepSeek V4.1
Flash is a paid OpenCode Go model, not a free default.

## Keeper login and data

Open `http://127.0.0.1:8080` and use the `LOGIN_PASSWORD` from `keeper.env`.
Keeper stores its SQLite database and backups in the ignored `keeper/` directory.
Keep the dashboard loopback-only unless you deliberately put it behind an
authenticated reverse proxy.

The old `cliproxyapi-dashboard` deployment is not part of this stack. Stop an
old deployment with its own Compose file before starting this one, but preserve
its volumes until you have confirmed that the migration is complete.
