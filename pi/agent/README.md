# Pi configuration

The parent repository's `setup_env.sh` selectively rsyncs managed files into
`~/.pi/agent` and preserves runtime state such as credentials, sessions, and
installed packages. It does not replace the live directory with a symlink.

The module-owned package entries in `settings.json` (`pi-extensible-workflows`,
`gentle-pi`) are installed and verified by `@darkrei08/setup-ai`'s
`pi-workflows` and `gentle-ai` modules. `npm:gentle-engram` is a plain
`pi-packages.txt` line kept in both files for consistency.

## CLIProxyAPI

The only configured model gateway is [CLIProxyAPI + CPA Usage Keeper](../../cliproxyapi/README.md).
CPA manages OAuth provider accounts and dynamically exposes models to Pi.
Keeper is the local usage, cost and quota dashboard:

- CPA management: `http://127.0.0.1:8317/management.html`
- Keeper dashboard: `http://127.0.0.1:8080`

After authenticating an account in CPA:

- run `/cliproxyapi-refresh` after account or routing changes;
- use `/fast` for priority processing and `/pause` or `/continue` to control requests;
- select a live `cliproxyapi/...` model from `/model` or use the protected workflow aliases.

Pi's built-in MCP reads `~/.pi/agent/mcp.json` on Pi 0.99.0 and later. Gentle
AI 4.0.0 retires `pi-mcp-adapter` on sync, and an installed adapter replaces
Pi's built-in MCP, so neither `npm:pi-mcp-adapter` nor `-builtin:mcp` belongs
in `settings.json`. Verify the configured servers with:

```bash
pi mcp list
```

The standard workflow route is CLIProxyAPI only:
`cheap-model=cliproxyapi/gpt-6-luna:high` and
`reviewer-model=cliproxyapi/claude-opus-5-5:high`. The optional
`cheap-model-ant` and `cheap-model-oai` aliases also use CLIProxyAPI.

## Credentials and local files

Pi keeps provider credentials under ignored files in `~/.pi/agent/`. This
repository never stores OAuth tokens, API keys, Keeper passwords, or CPA
management keys. The local CPA and Keeper setup is described in
`cliproxyapi/README.md`.
