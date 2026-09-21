#!/usr/bin/env bash
set -uo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SETTINGS="$ROOT/pi/agent/settings.json"
WORKFLOWS_SETTINGS="$ROOT/pi/agent/pi-extensible-workflows/settings.json"
RETIRED_EXTENSION="$ROOT/pi/agent/extensions/gentle-bar.ts"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
LIVE_SETTINGS="$PI_AGENT_DIR/settings.json"
LIVE_WORKFLOWS_SETTINGS="$PI_AGENT_DIR/pi-extensible-workflows/settings.json"
SETUP="$ROOT/setup_env.sh"
failures=0

check_json_file() {
  local path=$1
  if [[ ! -f "$path" ]]; then
    printf '%s: missing file\n' "$path"
    return 1
  fi
  if ! jq empty "$path" >/dev/null 2>&1; then
    printf '%s: invalid JSON\n' "$path"
    return 1
  fi
}

if ! jq empty "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: invalid JSON\n' "$SETTINGS"
  failures=1
fi

required_packages=(
  npm:pi-extensible-workflows
  npm:gentle-pi
  npm:gentle-engram
  npm:pi-mcp-adapter
)
missing_packages=()
for package in "${required_packages[@]}"; do
  if ! jq -e --arg package "$package" \
      'any((.packages? // [])[]?; . == $package or (type == "object" and .source == $package))' \
      "$SETTINGS" >/dev/null 2>&1; then
    missing_packages+=("$package")
  fi
done
if ((${#missing_packages[@]})); then
  printf '%s: missing package registration(s): %s\n' "$SETTINGS" "${missing_packages[*]}"
  failures=1
fi

if ! jq -e '
  any((.packages? // [])[]?;
    type == "object" and .source == "npm:gentle-pi" and
    ((.extensions? // []) |
      if type == "array" then
        index("-extensions/quiet-tools.ts") != null and
        index("-extensions/pi-pretty.ts") != null
      else false end))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: npm:gentle-pi must be an object with both excluded extensions\n' "$SETTINGS"
  failures=1
fi

versioned_workflows_ok=1
live_workflows_ok=1
live_settings_ok=1
check_json_file "$WORKFLOWS_SETTINGS" || { versioned_workflows_ok=0; failures=1; }
if [[ ! -f "$LIVE_WORKFLOWS_SETTINGS" ]]; then
  printf '%s: missing file; skipping live workflow comparison\n' "$LIVE_WORKFLOWS_SETTINGS"
  live_workflows_ok=0
elif ! check_json_file "$LIVE_WORKFLOWS_SETTINGS"; then
  live_workflows_ok=0
  failures=1
fi
if [[ ! -f "$LIVE_SETTINGS" ]]; then
  printf '%s: missing file; skipping live package comparison\n' "$LIVE_SETTINGS"
  live_settings_ok=0
elif ! check_json_file "$LIVE_SETTINGS"; then
  live_settings_ok=0
  failures=1
fi

# Compare only behavior-bearing projections: modelAliases, workflow extensions, and object-package source/extensions. Pi/setup-ai may normalize package versions, duplicate entries, and order, so the whole settings file is intentionally not compared.
if ((versioned_workflows_ok && live_workflows_ok)) &&
    ! diff -u \
      <(jq -S '{modelAliases, extensions}' "$WORKFLOWS_SETTINGS") \
      <(jq -S '{modelAliases, extensions}' "$LIVE_WORKFLOWS_SETTINGS") >/dev/null; then
  printf '%s: canonical modelAliases/extensions differ from %s\n' \
    "$WORKFLOWS_SETTINGS" "$LIVE_WORKFLOWS_SETTINGS"
  failures=1
fi

if ((live_settings_ok)); then
  if ! diff -u \
      <(jq -S '[.packages? // [] | .[]? | select(type == "object") | {source, extensions: (.extensions? // [])}] | sort_by(.source)' "$SETTINGS") \
      <(jq -S '[.packages? // [] | .[]? | select(type == "object") | {source, extensions: (.extensions? // [])}] | sort_by(.source)' "$LIVE_SETTINGS") >/dev/null; then
    printf '%s: canonical object-package source/extensions entries differ from %s\n' \
      "$SETTINGS" "$LIVE_SETTINGS"
    failures=1
  fi
fi

if grep -Fq -- '../../' "$SETTINGS"; then
  printf '%s: contains a ../../ relative package path\n' "$SETTINGS"
  failures=1
fi

if [[ -e "$RETIRED_EXTENSION" ]]; then
  printf '%s: retired repository extension must not exist\n' "$RETIRED_EXTENSION"
  failures=1
fi

# A commented-out mention documents the obsolete switch instead of writing it.
if grep -vE '^[[:space:]]*#' "$SETUP" |
    grep -Eq "GENTLE_PI_QUIET_TOOLS[[:space:]]*=[[:space:]]*[\"']?0[\"']?([[:space:];]|$)"; then
  printf '%s: writes GENTLE_PI_QUIET_TOOLS=0\n' "$SETUP"
  failures=1
fi

if ((failures)); then
  exit 1
fi
printf 'config check passed: %s and %s\n' "$SETTINGS" "$SETUP"
