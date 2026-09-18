#!/usr/bin/env bash
set -uo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SETTINGS="$ROOT/pi/agent/settings.json"
SETUP="$ROOT/setup_env.sh"
failures=0

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

if grep -Fq -- '../../' "$SETTINGS"; then
  printf '%s: contains a ../../ relative package path\n' "$SETTINGS"
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
