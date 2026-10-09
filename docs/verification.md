# Verification and known gaps

## Verification

Run these on the machine, after `setup_env.sh`:

```bash
# This checkout's own config invariants: settings.json parses, carries the
# module-owned packages and gentle-pi exclusions, enforces Claude-via-CLIProxyAPI
# and native Codex aliases, the GGA reviewer model, plus enabledModels, has no ../../ path, and
# setup_env.sh never writes GENTLE_PI_QUIET_TOOLS=0
bash check-config.sh

# The versioned Pi configuration was copied into the live config
test -f ~/.pi/agent/pi-ext-roles/settings.json
test -d ~/.pi/agent/pi-ext-roles/roles

# Pi's effective settings and packages
node -e "const s=require(process.env.HOME+'/.pi/agent/settings.json');console.log(s.defaultProvider, s.defaultModel, s.packages.length)"
cat ~/.pi/agent/pi-packages.txt

# The declared packages are the installed ones
pi --version
# For each source in pi-packages.txt, check it appears in ~/.pi/agent/settings.json

# The managed non-Pi configuration
grep -c 'export BAT_THEME' ~/.bashrc
cmp ~/.tmux.conf <repo>/.tmux.conf && echo tmux ok
nvim --version | head -1                      # >= NVIM v0.12.0

# The single-copy skills layout (after the skill installer has run)
node agents/link-skills.mjs --verify          # expect: verify: OK
ls -l ~/.claude/skills ~/.codex/skills        # entries are junctions/symlinks

# The local CPA + Keeper stack
CPA_KEY='paste-the-local-api-key-here'
curl -fsS -H "Authorization: Bearer ${CPA_KEY}" \
  'http://127.0.0.1:8317/v1/models?client_version=pi'
unset CPA_KEY
# Open http://127.0.0.1:8080 for CPA Usage Keeper
```

`setup_env.sh` has no `--dry-run`; `agents/link-skills.mjs` is dry-run by default.

## Known gaps

- `pi/agent/extensions/herdr-agent-state.ts` is produced by `herdr integration install pi` (already run by `setup_env.sh`), is machine-local, and is ignored by `pi/agent/.gitignore`. It is present on this machine. A pi session started before the integration was installed does not load it and must be restarted.
- `pi/agent/package.json` declares `"pi-extensible-workflows": "file:../../../pi-workflows/packages/core"`. From `pi/agent` that resolves to `<repo>/../pi-workflows/packages/core`, which does not exist in this layout. Not verified: whether anything ever installs it.
- `setup_env.sh` installs the Pi CLI with npm when it is missing on every supported distro; only the mise Pi shim cleanup is Arch/Omarchy-specific. The package application and later `pi update --extensions` remain guarded by `command -v pi`.
- `pi/agent/settings.json` ships theme `dark`; `themes/omarchy-system.json` is not selected by any setting here. Unverified: whether it is meant to be activated on Omarchy.
- `pi/agent/npm/node_modules` is git-ignored, preserved by `sync_pi`, and not populated by a direct `npm install` in `setup_env.sh`. Unverified: which step is expected to populate it.
- `agents/link-skills.mjs` junction discovery is verified for Pi only. For the other harnesses the manifest records the expected root; a harness that ignores junctions in its own directory is not detected. Run `--verify` and start each harness once after `--apply`.
- `sync_pi` copies the versioned allowlist with `rsync -a` and never prunes, so a file deleted from the repository (for example the removed `extensions/hashline-tool-display-bridge.ts` and `extensions/pi-tool-display/config.json`) keeps loading from `~/.pi/agent/` on a machine already on the real-directory model until it is removed by hand. The symlink -> real-directory migration itself produces a clean copy; only later deletions are affected.
