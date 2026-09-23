#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
IS_WSL=0
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=1

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
fi

case "${ID:-}:${ID_LIKE:-}" in
  omarchy:*|*:arch*|arch:*)
    PACKAGE_MANAGER=arch
    ;;
  debian:*|ubuntu:*|*:debian*)
    PACKAGE_MANAGER=debian
    ;;
  *)
    printf 'Unsupported Linux distribution: ID=%s ID_LIKE=%s\n' "${ID:-unknown}" "${ID_LIKE:-unknown}" >&2
    exit 1
    ;;
esac

install_package() {
  local command_name=$1 package_name=${2:-$1}
  command -v "$command_name" >/dev/null 2>&1 && return
  case "$PACKAGE_MANAGER" in
    arch)
      if command -v omarchy >/dev/null 2>&1; then
        omarchy pkg add "$package_name"
      else
        sudo pacman -S --needed --noconfirm "$package_name"
      fi
      ;;
    debian)
      sudo apt-get install -y "$package_name"
      ;;
  esac
}

# GitHub's unauthenticated API allows roughly 60 requests per hour per IP, and a
# 403 there fails `curl -f` with exit 22. Under `set -e` that aborted the whole
# run for one optional CLI, so authenticate when a token is available, retry
# transient failures, and skip that tool instead of failing the machine.
install_release() {
  local repository=$1 asset_pattern=$2 binary=$3
  { [ -x "$HOME/.bin/$binary" ] || command -v "$binary" >/dev/null 2>&1; } && return
  local workdir url rc=0
  workdir=$(mktemp -d)

  # GITHUB_TOKEN wins; `gh auth token` covers an authenticated gh CLI. A gh that
  # is absent or not logged in is an expected, non-fatal case: the lookup below
  # then warns with the unauthenticated rate limit as the likely cause. The
  # token is passed to curl as a header and never printed.
  local token=${GITHUB_TOKEN:-} auth=()
  if [ -z "$token" ] && command -v gh >/dev/null 2>&1; then
    token=$(gh auth token 2>/dev/null) || token=
  fi
  if [ -n "$token" ]; then
    auth=(-H "Authorization: Bearer $token")
  fi

  # `first()` replaces `| head -1`, whose SIGPIPE under `pipefail` can turn a
  # large result into exit 141, and the `|| rc=$?` keeps a failed lookup from
  # reaching the plain `[ ]` tests this used to abort on.
  # `${auth[@]+...}` guards the empty-array expansion: `set -u` aborts on it in
  # bash before 4.4.
  url=$(curl -fsSL --retry 3 --retry-all-errors --retry-delay 2 "${auth[@]+"${auth[@]}"}" \
      "https://api.github.com/repos/$repository/releases/latest" \
    | jq -r --arg pattern "$asset_pattern" \
      'first(.assets[] | select(.name | test($pattern)) | .browser_download_url) // empty') || rc=$?
  if [ "$rc" -ne 0 ]; then
    if [ "$rc" -eq 22 ]; then
      printf 'WARN: skipping %s: api.github.com refused the release lookup for %s (curl exit 22). Unauthenticated requests allow about 60 per hour per IP, so a rate limit is the likely cause; set GITHUB_TOKEN or log in with gh. Continuing without it.\n' \
        "$binary" "$repository" >&2
    else
      printf 'WARN: skipping %s: the release lookup for %s failed (curl exit %s). Continuing without it.\n' \
        "$binary" "$repository" "$rc" >&2
    fi
    rm -rf "$workdir"
    return 0
  fi
  if [ -z "$url" ]; then
    printf 'WARN: skipping %s: no release asset in %s matches %s. Continuing without %s.\n' \
      "$binary" "$repository" "$asset_pattern" "$binary" >&2
    rm -rf "$workdir"
    return 0
  fi

  curl -fsSL "$url" -o "$workdir/release.tar.gz"
  tar -xzf "$workdir/release.tar.gz" -C "$workdir"
  # `-print -quit` stops at the first match: `| head -1` here exits 141 under
  # `pipefail` once the matches exceed the pipe buffer.
  install -Dm755 "$(find "$workdir" -type f -name "$binary" -perm -u+x -print -quit)" "$HOME/.bin/$binary"
  rm -rf "$workdir"
}

append_once() {
  local line=$1 file=${2:-"$HOME/.bashrc"}
  touch "$file"
  grep -Fqx -- "$line" "$file" || printf '\n%s\n' "$line" >> "$file"
}

# Install only the CLI-Anything Pi extension assets, pinned to a reviewed commit.
# Its upstream installer ignores PI_CODING_AGENT_DIR and its uninstall deletes the
# whole target directory, so never invoke either upstream install.sh mode.
install_cli_anything_pi() (
  local revision=34f519533bc175d2fe287ab8316b0dd99bb9cc43
  local agent_dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
  case "$agent_dir" in
    '~') agent_dir="$HOME" ;;
    '~/'*) agent_dir="$HOME/${agent_dir#\~/}" ;;
  esac

  local workdir source extension_source plugin_source target asset resource_dir
  workdir=$(mktemp -d)
  trap 'rm -rf "$workdir"' EXIT
  source="$workdir/source"
  git -C "$workdir" init -q source
  git -C "$source" remote add origin https://github.com/HKUDS/CLI-Anything.git
  git -C "$source" sparse-checkout init --no-cone
  git -C "$source" sparse-checkout set --no-cone \
    '/.pi-extension/cli-anything/index.ts' \
    '/cli-anything-plugin/HARNESS.md' \
    '/cli-anything-plugin/commands/*.md' \
    '/cli-anything-plugin/guides/*.md' \
    '/cli-anything-plugin/templates/*' \
    '/cli-anything-plugin/repl_skin.py' \
    '/cli-anything-plugin/skill_generator.py'
  git -C "$source" fetch --quiet --filter=blob:none --depth=1 origin "$revision"
  git -C "$source" checkout --quiet --detach FETCH_HEAD
  [ "$(git -C "$source" rev-parse HEAD)" = "$revision" ] || {
    printf 'CLI-Anything source did not resolve to pinned revision %s\n' "$revision" >&2
    return 1
  }

  extension_source="$source/.pi-extension/cli-anything"
  plugin_source="$source/cli-anything-plugin"
  target="$agent_dir/extensions/cli-anything"
  for asset in \
    "$extension_source/index.ts" "$plugin_source/HARNESS.md" \
    "$plugin_source/commands/cli-anything.md" "$plugin_source/commands/list.md" \
    "$plugin_source/commands/refine.md" "$plugin_source/commands/test.md" \
    "$plugin_source/commands/validate.md" "$plugin_source/guides/session-locking.md" \
    "$plugin_source/templates/SKILL.md.template" "$plugin_source/repl_skin.py" \
    "$plugin_source/skill_generator.py"; do
    [ -s "$asset" ] || { printf 'CLI-Anything source asset missing: %s\n' "$asset" >&2; return 1; }
  done

  if [ -L "$target" ] || { [ -e "$target" ] && [ ! -d "$target" ]; }; then
    printf 'Refusing to install CLI-Anything into non-directory or symlink: %s\n' "$target" >&2
    return 1
  fi
  mkdir -p "$target/scripts"
  rsync -a "$extension_source/index.ts" "$target/"
  rsync -a "$plugin_source/HARNESS.md" "$target/"
  for resource_dir in commands guides templates; do
    rsync -a "$plugin_source/$resource_dir/" "$target/$resource_dir/"
  done
  rsync -a "$plugin_source/repl_skin.py" "$target/scripts/repl_skin.py"
  rsync -a "$plugin_source/skill_generator.py" "$target/scripts/skill_generator.py"

  for asset in \
    index.ts HARNESS.md commands/cli-anything.md commands/list.md \
    commands/refine.md commands/test.md commands/validate.md \
    guides/session-locking.md templates/SKILL.md.template \
    scripts/repl_skin.py scripts/skill_generator.py; do
    [ -s "$target/$asset" ] || { printf 'CLI-Anything installed asset missing: %s\n' "$target/$asset" >&2; return 1; }
  done
  printf 'Installed CLI-Anything Pi extension at %s\n' "$target"
)

# Mirror the versioned Pi config into the live ~/.pi/agent WITHOUT touching
# runtime state. We deliberately do NOT symlink ~/.pi/agent to the repo: the
# symlink model made npm resolve recursive self-paths into the lockfile and put
# credentials/sessions under version control. Instead we rsync an explicit
# allowlist of versioned items on top of the live dir, so re-runs stay
# idempotent and never delete auth.json, sessions/, or pi-managed installs
# (npm/, packages pi resolves from settings.json).
sync_pi() {
  local src="$REPO_DIR/pi/agent" target="$HOME/.pi/agent"

  # A leftover symlink from the old model would make rsync write back into the
  # repo; replace it with a real directory first, backing up anything real.
  if [ -L "$target" ]; then
    rm -f "$target"
  elif [ -e "$target" ] && [ ! -d "$target" ]; then
    mv -- "$target" "$target.backup.$(date +%s)"
  fi
  mkdir -p "$target"

  local item
  for item in \
    AGENTS.md advisor-system.md MODELS.md README.md \
    settings.json models.json modes.json keybindings.json subagents.json \
    pi-vcc-config.json tsconfig.json package.json pi-packages.txt .pii-allowlist \
    bin packages prompts skills themes pi-extensible-workflows; do
    if [ -e "$src/$item" ]; then
      rsync -a "$src/$item" "$target/"
    fi
  done

  # extensions/: copy the repo-owned .ts extensions, but NOT the workflow-command
  # wrappers (piextworkflows.ts + pi-ext-workflows/). setup-ai's `pi-workflows`
  # module owns those and installs their `pi-extensible-workflows` dependency into
  # pi-ext-workflows/node_modules; copying them here without that node_modules
  # breaks `pi` startup ("Cannot find module 'pi-extensible-workflows'").
  if [ -d "$src/extensions" ]; then
    rsync -a --exclude='piextworkflows.ts' --exclude='pi-ext-workflows/' \
      "$src/extensions" "$target/"
  fi
  # gentle-pi owns the visual shell; remove the retired local footer override.
  rm -f "$target/extensions/gentle-bar.ts"

  # Verify the workflow roles and aliases actually landed: this is the config
  # that silently breaks `workflow` (missing roles/aliases) if the copy fails.
  if [ ! -d "$target/pi-extensible-workflows/roles" ] ||
     [ ! -f "$target/pi-extensible-workflows/settings.json" ]; then
    printf 'sync_pi: workflow roles/aliases missing after sync (%s)\n' "$target" >&2
    return 1
  fi
}

if [ "$PACKAGE_MANAGER" = debian ]; then
  sudo apt-get update
  package_specs=(
    'make:make' 'gcc:gcc' 'g++:g++' 'rg:ripgrep' 'git:git' 'curl:curl' 'xclip:xclip' 'jq:jq'
    'tree:tree' 'htop:htop' 'fdfind:fd-find' 'rsync:rsync' 'fzf:fzf' 'batcat:bat'
    'gh:gh' 'glab:glab' 'python3:python3' 'python3-venv:python3-venv' 'notify-send:libnotify-bin'
  )
else
  package_specs=(
    'make:make' 'gcc:gcc' 'g++:gcc' 'rg:ripgrep' 'git:git' 'curl:curl' 'xclip:xclip' 'jq:jq'
    'tree:tree' 'htop:htop' 'fd:fd' 'rsync:rsync' 'fzf:fzf' 'bat:bat'
    'gh:github-cli' 'glab:glab' 'python3:python' 'notify-send:libnotify'
  )
fi

for spec in "${package_specs[@]}"; do
  install_package "${spec%%:*}" "${spec#*:}"
done

if [ "$IS_WSL" -eq 1 ]; then
  install_package wl-copy wl-clipboard
  install_package convert imagemagick
fi

mkdir -p "$HOME/.bin" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$HOME/.bin:/usr/local/go/bin:/opt/nvim-linux-x86_64/bin:$PATH"
command -v bat >/dev/null 2>&1 || ln -sf "$(command -v batcat)" "$HOME/.bin/bat"
if [ "$PACKAGE_MANAGER" = arch ]; then
  install_package lazygit lazygit
  install_package zellij zellij
else
  install_release jesseduffield/lazygit '_linux_x86_64\.tar\.gz$' lazygit
  install_release zellij-org/zellij '^zellij-x86_64-unknown-linux-musl\.tar\.gz$' zellij
fi
append_once 'export PATH="$HOME/.bin:$PATH"'
append_once 'export PATH="$HOME/.local/bin:$PATH"'
append_once 'export PATH="$PATH:/usr/local/go/bin"'
append_once 'export PATH="$PATH:/opt/nvim-linux-x86_64/bin"'
append_once 'eval "$(fzf --bash)"'
append_once 'export BAT_THEME="TwoDark"'
append_once "alias ll='ls -alF'"
append_once "alias herdr-devbox='herdr --remote devbox-hz --remote-keybindings server'"
append_once 'export SUDO_EDITOR="nvim"'
append_once "export FZF_ALT_C_OPTS=\"--walker-skip .git,node_modules,target --preview 'tree -C {}'\""
append_once "export FZF_CTRL_T_OPTS=\"--walker-skip .git,node_modules,target --preview 'bat -n --color=always --style=numbers {}' --bind 'ctrl-/:change-preview-window(down|hidden|)'\""

if ! command -v go >/dev/null 2>&1 && [ "$PACKAGE_MANAGER" = arch ]; then
  install_package go go
fi

if ! command -v go >/dev/null 2>&1; then
  go_version=1.24.4
  archive=$(mktemp)
  curl -fsSL "https://go.dev/dl/go${go_version}.linux-amd64.tar.gz" -o "$archive"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "$archive"
  rm -f "$archive"
fi

nvim_bin=$(command -v nvim || true)
nvim_version=$([ -n "$nvim_bin" ] && "$nvim_bin" --version | head -1 | sed 's/^NVIM v//' || true)
if [ -z "$nvim_version" ] || [ "$(printf '%s\n' 0.12.0 "$nvim_version" | sort -V | head -1)" != 0.12.0 ]; then
  if [ "$PACKAGE_MANAGER" = arch ]; then
    install_package nvim neovim
    nvim_bin=$(command -v nvim)
  else
  archive=$(mktemp)
  curl -fsSL https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz -o "$archive"
  sudo rm -rf /opt/nvim-linux-x86_64
  sudo tar -C /opt -xzf "$archive"
  rm -f "$archive"
    nvim_bin=/opt/nvim-linux-x86_64/bin/nvim
  fi
fi

mkdir -p "$HOME/.config"
rsync -a --delete --exclude=node_modules/ "$REPO_DIR/nvim/" "$HOME/.config/nvim/"
install -Dm644 "$REPO_DIR/herdr/config.toml" "$HOME/.config/herdr/config.toml"
if [ "$(hostname -s)" = "devbox" ]; then
  sed -i '/^\[ui\]$/a copy_on_select = false' "$HOME/.config/herdr/config.toml"
fi
install -Dm644 "$REPO_DIR/.tmux.conf" "$HOME/.tmux.conf"

if [ "$IS_WSL" -eq 1 ]; then
  mkdir -p "$HOME/.local/bin"
  rsync -a "$REPO_DIR/.local/bin/" "$HOME/.local/bin/"
  if command -v powershell.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
    windows_home=$(powershell.exe -NoProfile -Command '$env:USERPROFILE' | tr -d '\r')
    [ -n "$windows_home" ] && install -Dm644 "$REPO_DIR/.wezterm.lua" "$(wslpath "$windows_home")/.wezterm.lua"
  fi
fi

venv="$HOME/.local/share/nvim/gigatoken-venv"
if [ ! -x "$venv/bin/python" ]; then
  python3 -m venv "$venv"
  "$venv/bin/pip" install gigatoken
fi

if [ "$PACKAGE_MANAGER" = arch ]; then
  # Omarchy activates mise globally, and its pi shim precedes ~/.local/bin in
  # PATH while leaking mise output into pi's stdout. Own pi via npm instead.
  grep -q mise "$HOME/.local/bin/pi" 2>/dev/null && rm -f "$HOME/.local/bin/pi"
  if command -v mise >/dev/null 2>&1; then
    mise unuse -g pi
    mise uninstall --all pi
  fi
  npm install -g --ignore-scripts --prefix "$HOME/.local" @earendil-works/pi-coding-agent
fi

sync_pi
install_cli_anything_pi

# Apply the Pi packages declared in pi/agent/pi-packages.txt. pi-extensible-workflows
# is skipped: @darkrei08/setup-ai's `pi-workflows` module owns that package.
pi_packages="$REPO_DIR/pi/agent/pi-packages.txt"
if ! command -v pi >/dev/null 2>&1; then
  printf 'WARN: pi is not installed, so the Pi configuration (packages and extensions) is not applied.\n' >&2
  printf 'WARN: install it with: npm install -g --prefix "$HOME/.local" @earendil-works/pi-coding-agent\n' >&2
elif [ -r "$pi_packages" ]; then
  while IFS= read -r spec || [ -n "$spec" ]; do
    spec=${spec%%#*}
    spec=${spec#"${spec%%[![:space:]]*}"}
    spec=${spec%"${spec##*[![:space:]]}"}
    [ -n "$spec" ] || continue
    # The manifest carries a ~ path for the in-repo advisor package; the shell does
    # not expand a tilde inside a quoted word read from a file, so do it here.
    case "$spec" in '~/'*) spec="$HOME/${spec#\~/}" ;; esac
    case "$spec" in *pi-extensible-workflows*) continue ;; esac
    pi install "$spec" </dev/null || printf 'WARN: pi install %s failed; continuing\n' "$spec" >&2
  done < "$pi_packages"
fi
# The shared agent-skill stack. When setup-ai orchestrates this script it already
# installs these for EVERY detected agent (not just pi), so it sets
# SETUP_AI_SKIP_SKILLS=1 to avoid running the same `npx skills add` twice. A
# standalone dotenv run leaves the flag unset and installs them for pi as before.
# Every `skills` call gets an explicit </dev/null: with a closed or non-TTY stdin
# its readline interface aborts the whole run with `EBADF: bad file descriptor,
# read`, which is exactly the path a CI, `ssh -T` or scripted install takes.
if [ "${SETUP_AI_SKIP_SKILLS:-0}" != 1 ]; then
  npx skills add herdrdev/herdr --skill herdr --global --agent pi --copy --yes </dev/null
  npx skills@latest add mattpocock/skills --skill triage grill-me grilling wayfinder domain-modeling prototype research --global --agent pi --copy --yes </dev/null
  npx skills add https://github.com/pedronauck/skills --skill typescript-advanced --global --agent pi --copy --yes </dev/null
  npx skills add humanlayer/skills --skill show-me --global --agent pi --copy --yes </dev/null
  npx skills@latest add micio86dev/Engineering-Excellence --skill engineering-excellence --global --agent pi --copy --yes </dev/null
fi

# Repository-centric AI memory (ai-memory-kit): the project-memory skill for pi and
# the `aimem` CLI. The skill goes through the same skills flow as the lines above;
# the CLI installer is invoked with --no-skill to avoid installing the skill twice.
# Pinned to a stable release tag (AIMEM_REF) instead of a moving branch.
AIMEM_REF=v0.1.0
npx skills add "darkrei08/ai-memory-kit#${AIMEM_REF}" --skill project-memory --global --agent pi --copy --yes </dev/null \
  || npx skills add darkrei08/ai-memory-kit --skill project-memory --global --agent pi --copy --yes </dev/null
# ai-memory-kit v0.1.0 used GitHub's refs/heads codeload URL for tags.
# Rewrite it in the streamed installer until the upstream installer is fixed.
command -v aimem >/dev/null 2>&1 || AIMEM_REF="${AIMEM_REF}" curl -fsSL "https://raw.githubusercontent.com/darkrei08/ai-memory-kit/${AIMEM_REF}/install.sh" \
  | sed 's|/tar.gz/refs/heads/\$REF|/tar.gz/\$REF|g' \
  | AIMEM_REF="${AIMEM_REF}" bash -s -- --no-skill

# AI coding CLIs — installed only when missing, via each tool's official installer.
command -v gentle-ai >/dev/null 2>&1 || curl -fsSL https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/scripts/install.sh | bash
if ! command -v gga >/dev/null 2>&1; then
  printf 'ERROR: gentle-ai setup completed without the gga executable; cannot install the repository pre-commit hook.\n' >&2
  exit 1
fi
(cd "$REPO_DIR" && gga install)
command -v agy >/dev/null 2>&1 || curl -fsSL https://antigravity.google/cli/install.sh | bash
command -v codex >/dev/null 2>&1 || curl -fsSL https://chatgpt.com/codex/install.sh | sh
if command -v herdr >/dev/null 2>&1; then
  [ -x /usr/local/bin/bun ] || sudo "$(command -v npm)" install -g --prefix /usr/local bun
  herdr integration install pi
  herdr plugin link "$REPO_DIR/herdr/plugins/agent-notify"
fi
command -v pi >/dev/null 2>&1 && pi update --extensions
(cd "$HOME/.config/nvim" && npm ci)
command -v tsgo >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" @typescript/native-preview
# tree-sitter-cli ships only an install.js that downloads the real binary in a
# postinstall step. pi's npm policy blocks install scripts, so a plain install
# leaves the package dir present but the binary missing, and Neovim -- which
# spawns it by absolute path, not via PATH -- fails with ENOENT. Force scripts
# for this one package, then verify/repair the exact binary Neovim will spawn.
TS_CLI_BIN="$HOME/.local/lib/node_modules/tree-sitter-cli/tree-sitter"
if [ ! -x "$TS_CLI_BIN" ]; then
  npm install -g --prefix "$HOME/.local" --foreground-scripts --include=optional tree-sitter-cli
fi
if [ ! -x "$TS_CLI_BIN" ] && [ -f "$HOME/.local/lib/node_modules/tree-sitter-cli/install.js" ]; then
  (cd "$HOME/.local/lib/node_modules/tree-sitter-cli" && node install.js)
fi
[ -x "$TS_CLI_BIN" ] || { printf 'tree-sitter binary missing after install: %s\n' "$TS_CLI_BIN" >&2; exit 1; }
"$nvim_bin" --headless "+Lazy! restore" +qa
"$nvim_bin" --headless "+MasonInstall markdownlint" +qa
"$nvim_bin" --headless "+lua require('nvim-treesitter').install({'bash','c','diff','html','lua','luadoc','markdown','markdown_inline','query','vim','vimdoc','typescript','javascript'}):wait(300000)" +qa

# Fail the setup run if a managed Pi alias or extension list drifted.
"$REPO_DIR/check-config.sh"
