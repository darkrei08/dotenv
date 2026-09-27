#!/usr/bin/env bash
set -euo pipefail

[ "$(id -u)" -eq 0 ] || exit 0

settings_dir="$HOME/.claude"
settings_file="$settings_dir/settings.json"
mkdir -p "$settings_dir"

tmp=$(mktemp "$settings_dir/settings.json.XXXXXX")
trap 'rm -f "$tmp"' EXIT

if [ -e "$settings_file" ]; then
  jq '
    if type != "object" then error("Claude settings must be a JSON object")
    else .permissions = ((.permissions // {}) |
      if type != "object" then error("Claude permissions must be a JSON object")
      else .defaultMode = "default"
      end)
    end
  ' "$settings_file" > "$tmp"
else
  jq -n '{permissions: {defaultMode: "default"}}' > "$tmp"
fi

mv -- "$tmp" "$settings_file"
if ! jq -e '.permissions.defaultMode == "default"' "$settings_file" >/dev/null; then
  printf 'ERROR: failed to verify Claude settings permissions.defaultMode=default\n' >&2
  exit 1
fi
trap - EXIT
