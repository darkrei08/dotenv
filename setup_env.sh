#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SKILLOPT_SLEEP_REPO=${SKILLOPT_SLEEP_REPO:-$HOME/git/personale/upstream}
export SKILLOPT_SLEEP_REPO
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

mkdir -p "$HOME/.bin" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$HOME/.bin:/usr/local/go/bin:/opt/nvim-linux-x86_64/bin:$PATH"
for command_name in node npm npx; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: %s is required; install Node.js >=22.19.0 (which provides npm and npx) and retry.\n' "$command_name" >&2
    exit 1
  fi
done
node_version=$(node --version)
if [ "$(printf '%s\n' 22.19.0 "${node_version#v}" | sort -V | head -1)" != 22.19.0 ]; then
  printf 'ERROR: Node.js >=22.19.0 is required; found %s.\n' "$node_version" >&2
  exit 1
fi

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
  # then warns with the unauthenticated rate limit as the likely cause. Keep the
  # token in a mode-600 curl config file instead of passing it in argv, where
  # process listings can expose it.
  local token=${GITHUB_TOKEN:-}
  if [ -z "$token" ] && command -v gh >/dev/null 2>&1; then
    token=$(gh auth token 2>/dev/null) || token=
  fi

  # `first()` replaces `| head -1`, whose SIGPIPE under `pipefail` can turn a
  # large result into exit 141, and the `|| rc=$?` keeps a failed lookup from
  # reaching the plain `[ ]` tests this used to abort on.
  local curl_args=(-fsSL --retry 3 --retry-all-errors --retry-delay 2)
  if [ -n "$token" ]; then
    local auth_config="$workdir/curl.conf"
    (umask 077; printf 'header = "Authorization: Bearer %s"\n' "$token" > "$auth_config")
    curl_args+=(--config "$auth_config")
  fi
  url=$(curl "${curl_args[@]}" \
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
    rm -r -- "$workdir"
    return 0
  fi
  if [ -z "$url" ]; then
    printf 'WARN: skipping %s: no release asset in %s matches %s. Continuing without %s.\n' \
      "$binary" "$repository" "$asset_pattern" "$binary" >&2
    rm -r -- "$workdir"
    return 0
  fi

  curl -fsSL "$url" -o "$workdir/release.tar.gz"
  tar -xzf "$workdir/release.tar.gz" -C "$workdir"
  # `-print -quit` stops at the first match: `| head -1` here exits 141 under
  # `pipefail` once the matches exceed the pipe buffer.
  install -Dm755 "$(find "$workdir" -type f -name "$binary" -perm -u+x -print -quit)" "$HOME/.bin/$binary"
  rm -r -- "$workdir"
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
  trap 'rm -r -- "$workdir"' EXIT
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
  rsync -a --delay-updates "$extension_source/index.ts" "$target/"
  rsync -a --delay-updates "$plugin_source/HARNESS.md" "$target/"
  for resource_dir in commands guides templates; do
    rsync -a --delay-updates "$plugin_source/$resource_dir/" "$target/$resource_dir/"
  done
  rsync -a --delay-updates "$plugin_source/repl_skin.py" "$target/scripts/repl_skin.py"
  rsync -a --delay-updates "$plugin_source/skill_generator.py" "$target/scripts/skill_generator.py"

  for asset in \
    index.ts HARNESS.md commands/cli-anything.md commands/list.md \
    commands/refine.md commands/test.md commands/validate.md \
    guides/session-locking.md templates/SKILL.md.template \
    scripts/repl_skin.py scripts/skill_generator.py; do
    [ -s "$target/$asset" ] || { printf 'CLI-Anything installed asset missing: %s\n' "$target/$asset" >&2; return 1; }
  done
  printf 'Installed CLI-Anything Pi extension at %s\n' "$target"
)

# Install CLI-Hub in an isolated virtualenv and expose only its entry point.
# The adjacent checkout is used when present; fresh hosts install the same pinned
# revision from GitHub without mixing CLI-Anything dependencies into other venvs.
install_cli_anything_hub() (
  local revision=34f519533bc175d2fe287ab8316b0dd99bb9cc43
  local source="${CLI_ANYTHING_SOURCE:-$REPO_DIR/../CLI-Anything}"
  local venv="$HOME/.local/share/cli-anything/venv"
  mkdir -p "$(dirname "$venv")" "$HOME/.local/bin"
  if [ ! -x "$venv/bin/python" ]; then
    python3 -m venv "$venv"
  fi
  if [ -f "$source/cli-hub/setup.py" ]; then
    "$venv/bin/python" -m pip install --disable-pip-version-check -e "$source/cli-hub"
  else
    "$venv/bin/python" -m pip install --disable-pip-version-check \
      "git+https://github.com/HKUDS/CLI-Anything.git@${revision}#subdirectory=cli-hub"
  fi
  ln -sfn "$venv/bin/cli-hub" "$HOME/.local/bin/cli-hub"
  "$HOME/.local/bin/cli-hub" --help >/dev/null
)

# Mirror the versioned Pi config into the live ~/.pi/agent WITHOUT touching
# runtime state. We deliberately do NOT symlink ~/.pi/agent to the repo: the
# symlink model made npm resolve recursive self-paths into the lockfile and put
# credentials/sessions under version control. Instead we rsync an explicit
# allowlist of versioned items on top of the live dir, so re-runs stay
# idempotent and never delete auth.json, sessions/, or pi-managed installs
# (npm/, packages pi resolves from settings.json).
sync_pi() {
  local src="$REPO_DIR/pi/agent" target="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
  case "$target" in
    '~') target="$HOME" ;;
    '~/'*) target="$HOME/${target#\~/}" ;;
  esac

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
    pi-vcc-config.json ha-failover.example.json pi-ha-role-groups.json \
    tsconfig.json package.json pi-packages.txt .pii-allowlist \
    bin packages prompts skills themes pi-extensible-workflows pi-ext-roles; do
    if [ -e "$src/$item" ]; then
      # --delay-updates writes each destination through a same-directory rename,
      # so startup never observes a truncated versioned file.
      rsync -a --delay-updates "$src/$item" "$target/"
    fi
  done

  # extensions/: copy the repo-owned .ts extensions, but NOT the workflow-command
  # wrappers (piextworkflows.ts + pi-ext-workflows/). setup-ai's `pi-workflows`
  # module owns those and installs their `pi-extensible-workflows` dependency into
  # pi-ext-workflows/node_modules; copying them here without that node_modules
  # breaks `pi` startup ("Cannot find module 'pi-extensible-workflows'").
  if [ -d "$src/extensions" ]; then
    rsync -a --delay-updates --exclude='*.test.ts' --exclude='piextworkflows.ts' --exclude='pi-ext-workflows/' \
      "$src/extensions" "$target/"
  fi
  # Pi loads direct TypeScript files as extensions. Remove test files left by older
  # syncs; they are intentionally excluded above but rsync does not prune them.
  find "$target/extensions" -maxdepth 1 -type f -name '*.test.ts' -delete
  # gentle-pi owns the visual shell; remove the retired local footer override.
  rm -f "$target/extensions/gentle-bar.ts"

  # Legacy role sources make pi-extensible-workflows warn on every launch; roles and
  # shared settings now live in pi-ext-roles. Keep a backup, never delete.
  if [ -d "$target/pi-extensible-workflows/roles" ]; then
    mv -- "$target/pi-extensible-workflows/roles" "$target/pi-extensible-workflows/roles.legacy.$(date +%s)"
  fi

  # Verify the roles and aliases actually landed: this is the config that
  # silently breaks `workflow` (missing roles/aliases) if the copy fails.
  if [ ! -d "$target/pi-ext-roles/roles" ] ||
     [ ! -f "$target/pi-ext-roles/settings.json" ]; then
    printf 'sync_pi: roles/aliases missing after sync (%s)\n' "$target" >&2
    return 1
  fi

  # Idempotently normalize pi-extensible-workflows to exclude standalone subagents UI
  if [ -f "$target/settings.json" ] && command -v jq >/dev/null 2>&1; then
    local tmp_settings
    tmp_settings=$(mktemp "$target/settings.json.XXXXXX")
    if jq '
      .packages = [
        (.packages // [])[] |
        if . == "npm:pi-extensible-workflows" then
          { source: "npm:pi-extensible-workflows", extensions: ["!dist/subagents/index.js"] }
        else . end
      ]
    ' "$target/settings.json" > "$tmp_settings" 2>/dev/null; then
      # Replace the complete JSON document, never truncate the live file in place.
      mv -f -- "$tmp_settings" "$target/settings.json"
    else
      printf 'sync_pi: failed to normalize %s\n' "$target/settings.json" >&2
      rm -f "$tmp_settings"
      return 1
    fi
    rm -f "$tmp_settings"
  fi
}

if [ "$PACKAGE_MANAGER" = debian ]; then
  sudo apt-get update
  package_specs=(
    'make:make' 'gcc:gcc' 'g++:g++' 'rg:ripgrep' 'git:git' 'curl:curl' 'diff:diffutils' 'xclip:xclip' 'jq:jq'
    'tree:tree' 'htop:htop' 'fdfind:fd-find' 'rsync:rsync' 'fzf:fzf' 'batcat:bat'
    'gh:gh' 'glab:glab' 'python3:python3' 'python3-venv:python3-venv' 'notify-send:libnotify-bin'
  )
else
  package_specs=(
    'make:make' 'gcc:gcc' 'g++:gcc' 'rg:ripgrep' 'git:git' 'curl:curl' 'diff:diffutils' 'xclip:xclip' 'jq:jq'
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
append_once 'export SKILLOPT_SLEEP_REPO="${SKILLOPT_SLEEP_REPO:-$HOME/git/personale/upstream}"'
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
  if [ -e /usr/local/go ] || [ -L /usr/local/go ]; then
    sudo rm -r -- /usr/local/go
  fi
  sudo tar -C /usr/local -xzf "$archive"
  rm -f "$archive"
fi

if nvim_bin=$(command -v nvim); then
  nvim_version=$("$nvim_bin" --version | sed -n '1s/^NVIM v//p')
else
  printf 'WARN: Neovim is not installed; setup will install it.\n' >&2
  nvim_version=
fi
if [ -z "$nvim_version" ] || [ "$(printf '%s\n' 0.12.0 "$nvim_version" | sort -V | head -1)" != 0.12.0 ]; then
  if [ "$PACKAGE_MANAGER" = arch ]; then
    if command -v omarchy >/dev/null 2>&1; then
      omarchy pkg add neovim
    else
      sudo pacman -S --needed --noconfirm neovim
    fi
    if ! nvim_bin=$(command -v nvim); then
      printf 'ERROR: Neovim was not found after installing the package.\n' >&2
      exit 1
    fi
  else
    archive=$(mktemp)
    curl -fsSL https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz -o "$archive"
    if [ -e /opt/nvim-linux-x86_64 ] || [ -L /opt/nvim-linux-x86_64 ]; then
      sudo rm -r -- /opt/nvim-linux-x86_64
    fi
    sudo tar -C /opt -xzf "$archive"
    rm -f "$archive"
    nvim_bin=/opt/nvim-linux-x86_64/bin/nvim
  fi
  nvim_version=$("$nvim_bin" --version | sed -n '1s/^NVIM v//p')
  if [ -z "$nvim_version" ] || [ "$(printf '%s\n' 0.12.0 "$nvim_version" | sort -V | head -1)" != 0.12.0 ]; then
    printf 'ERROR: Neovim >=0.12.0 is required after installation; found %s.\n' "${nvim_version:-unknown}" >&2
    exit 1
  fi
fi

mkdir -p "$HOME/.config"
rsync -a --delay-updates --delete --exclude=node_modules/ "$REPO_DIR/nvim/" "$HOME/.config/nvim/"
install -Dm644 "$REPO_DIR/herdr/config.toml" "$HOME/.config/herdr/config.toml"
if [ "$(hostname -s)" = "devbox" ]; then
  sed -i '/^\[ui\]$/a copy_on_select = false' "$HOME/.config/herdr/config.toml"
fi
install -Dm644 "$REPO_DIR/.tmux.conf" "$HOME/.tmux.conf"

if [ "$IS_WSL" -eq 1 ]; then
  mkdir -p "$HOME/.local/bin"
  rsync -a --delay-updates "$REPO_DIR/.local/bin/" "$HOME/.local/bin/"
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
fi
if ! command -v pi >/dev/null 2>&1; then
  npm install -g --ignore-scripts --prefix "$HOME/.local" @earendil-works/pi-coding-agent </dev/null
fi

sync_pi
install_cli_anything_pi
install_cli_anything_hub

# Apply the Pi packages declared in pi/agent/pi-packages.txt. The manifest omits
# pi-extensible-workflows and gentle-pi because @darkrei08/setup-ai owns them.
# The Herdr orchestration package is installed here for its native mailbox tools.
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
    if ! pi install "$spec" </dev/null; then
      printf 'ERROR: pi install %s failed; setup cannot continue.\n' "$spec" >&2
      exit 1
    fi
  done < "$pi_packages"
fi
# gentle-pi owns the `gentle-ai` skill. Keep one physical copy in its package,
# but expose a Pi-local symlink so role prompts and skill reads resolve the same
# package-owned file instead of a stale shared-root path.
if ! node "$REPO_DIR/agents/ensure-pi-package-skill.mjs"; then
  printf 'ERROR: the package-owned gentle-ai skill could not be exposed to Pi.\n' >&2
  exit 1
fi
# Install SkillOpt-Sleep from the selected local fork. The upstream installer
# copies only the skill into the canonical user skill root; it does not clone or
# download another checkout. A missing fork is optional and must not block setup.
if [ -f "$SKILLOPT_SLEEP_REPO/plugins/codex/install.sh" ] &&
   [ -f "$SKILLOPT_SLEEP_REPO/plugins/run-sleep.sh" ] &&
   [ -f "$SKILLOPT_SLEEP_REPO/plugins/codex/skills/skillopt-sleep/SKILL.md" ]; then
  bash "$SKILLOPT_SLEEP_REPO/plugins/codex/install.sh"
else
  printf 'WARN: SkillOpt-Sleep fork not found at %s; skipping its skill install. Set SKILLOPT_SLEEP_REPO to a local checkout to enable it.\n' \
    "$SKILLOPT_SLEEP_REPO" >&2
fi

# The shared agent-skill stack. The explicit `cline` target makes skills-cli
# materialize one canonical copy under ~/.agents/skills, which Pi reads directly;
# setup-ai installs the same stack for every detected agent and sets
# SETUP_AI_SKIP_SKILLS=1 to avoid running these commands twice. A standalone
# dotenv run leaves the flag unset and still provisions Pi.
# Every `skills` call gets an explicit </dev/null: with a closed or non-TTY stdin
# its readline interface aborts the whole run with `EBADF: bad file descriptor,
# read`, which is exactly the path a CI, `ssh -T` or scripted install takes.
if [ "${SETUP_AI_SKIP_SKILLS:-0}" != 1 ]; then
  npx skills add herdrdev/herdr --skill herdr --global --agent pi cline --yes </dev/null
  matt_skills=(
    ask-matt code-review codebase-design diagnosing-bugs domain-modeling grill-with-docs
    implement implement-spec improve-codebase-architecture pr prototype research retro
    setup-matt-pocock-skills tdd to-spec to-tickets triage wayfinder wizard grill-me
    grilling handoff teach to-questionnaire wait-what writing-for-agents
  )
  npx skills@latest add mattpocock/skills --skill "${matt_skills[@]}" --global --agent pi cline --yes </dev/null
  npx skills add https://github.com/pedronauck/skills --skill typescript-advanced --global --agent pi cline --yes </dev/null
  npx skills add humanlayer/skills --skill show-me --global --agent pi cline --yes </dev/null
  npx skills@latest add micio86dev/Engineering-Excellence --skill engineering-excellence --global --agent pi cline --yes </dev/null
  DATA_SEARCH_REF=7d19e656be75b2dc853d4edc7b3c29a9b839b8cf
  npx skills add "https://github.com/darkrei08/pi-data-search#${DATA_SEARCH_REF}" --skill reusable-data-search --global --agent cline --yes </dev/null
fi

# Repository-centric AI memory (ai-memory-kit): the project-memory skill for pi and
# the `aimem` CLI. The skill goes through the same skills flow as the lines above;
# the CLI installer is invoked with --no-skill to avoid installing the skill twice.
# Pinned to a stable release tag (AIMEM_REF) instead of a moving branch.
#
# Pi is intentionally omitted from --agent: Pi reads the canonical root
# (~/.agents/skills) directly, so installing project-memory into ~/.pi/agent/skills
# would create a duplicate that Pi loads twice. The canonical copy serves Pi.
# See agents/LINKING.md and S1-S2 in odd/tasks/pi-ecosystem-activation-and-routing.md.
AIMEM_REF=v0.1.0
if [[ "${SETUP_AI_SKIP_SKILLS:-0}" != "1" ]]; then
  if ! npx skills add "darkrei08/ai-memory-kit#${AIMEM_REF}" --skill project-memory --global --agent cline --yes </dev/null; then
    printf 'ERROR: pinned ai-memory-kit skill %s could not be installed; refusing an unpinned fallback.\n' "$AIMEM_REF" >&2
    exit 1
  fi
fi
# ai-memory-kit v0.1.0 used GitHub's refs/heads codeload URL for tags.
# Rewrite it in the streamed installer until the upstream installer is fixed.
command -v aimem >/dev/null 2>&1 || AIMEM_REF="${AIMEM_REF}" curl -fsSL "https://raw.githubusercontent.com/darkrei08/ai-memory-kit/${AIMEM_REF}/install.sh" \
  | sed 's|/tar.gz/refs/heads/\$REF|/tar.gz/\$REF|g' \
  | AIMEM_REF="${AIMEM_REF}" bash -s -- --no-skill

# AI coding CLIs — installed only when missing, via each tool's official installer.
command -v gentle-ai >/dev/null 2>&1 || GOBIN="$HOME/.local/bin" go install github.com/gentleman-programming/gentle-ai/v2/cmd/gentle-ai@latest
"$REPO_DIR/agents/ensure-claude-root-mode.sh"
if ! command -v gga >/dev/null 2>&1; then
  # gentle-ai's installer only installs gentle-ai; gga has its own installer and must run from a clone.
  (
    GGA_TMP="$(mktemp -d)"
    trap 'rm -r -- "$GGA_TMP"' EXIT
    git clone --depth 1 https://github.com/Gentleman-Programming/gentleman-guardian-angel.git "$GGA_TMP"
    (cd "$GGA_TMP" && ./install.sh </dev/null)
  )
fi
if ! command -v gga >/dev/null 2>&1; then
  printf 'ERROR: the gentleman-guardian-angel installer completed without the gga executable; cannot install the repository pre-commit hook.\n' >&2
  exit 1
fi
(cd "$REPO_DIR" && gga install)
command -v agy >/dev/null 2>&1 || curl -fsSL https://antigravity.google/cli/install.sh | bash
command -v codex >/dev/null 2>&1 || curl -fsSL https://chatgpt.com/codex/install.sh | sh
command -v claude >/dev/null 2>&1 || curl -fsSL https://claude.ai/install.sh | bash
command -v gemini >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" @google/gemini-cli </dev/null
command -v copilot >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" @github/copilot </dev/null
command -v opencode >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" opencode-ai </dev/null
command -v cursor-agent >/dev/null 2>&1 || curl -fsSL https://cursor.com/install | bash
# Local usage of Pi, Codex and Claude Code from their session logs (used by /agent-usage in Pi).
command -v ccusage >/dev/null 2>&1 || npm install -g --prefix "$HOME/.local" ccusage </dev/null

for command_name in pi gentle-ai gga agy codex claude gemini copilot opencode cursor-agent ccusage; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'ERROR: required AI CLI %s was not found after installation; ensure its installer populated PATH and retry.\n' "$command_name" >&2
    exit 1
  fi
done
if command -v herdr >/dev/null 2>&1; then
  [ -x /usr/local/bin/bun ] || sudo "$(command -v npm)" install -g --prefix /usr/local bun
  herdr integration install pi
  herdr plugin link "$REPO_DIR/herdr/plugins/agent-notify"
fi
if [[ "${SETUP_AI_SKIP_SKILLS:-0}" != "1" ]]; then
  if ! node "$REPO_DIR/agents/link-skills.mjs" --apply; then
    printf 'ERROR: shared skill linking failed; setup cannot continue.\n' >&2
    exit 1
  fi
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
