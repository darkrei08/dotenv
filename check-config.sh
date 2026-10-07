#!/usr/bin/env bash
set -uo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SETTINGS="$ROOT/pi/agent/settings.json"
GGA_CONFIG="$ROOT/.gga"
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

pi_default_model=$(jq -r '.defaultModel // empty' "$SETTINGS" 2>/dev/null)
pi_default_provider=$(jq -r '.defaultProvider // empty' "$SETTINGS" 2>/dev/null)
gga_provider=$(sed -nE 's/^PROVIDER="([^"]*)".*/\1/p' "$GGA_CONFIG" 2>/dev/null)
if [[ -z "$pi_default_provider" || -z "$pi_default_model" || "$gga_provider" != "kilo:$pi_default_provider/$pi_default_model:"* ]]; then
  printf '%s: PROVIDER must be the Pi bridge for the Pi default model (kilo:%s/%s:<effort>, found: %s)\n' \
    "$GGA_CONFIG" "${pi_default_provider:-missing}" "${pi_default_model:-missing}" "${gga_provider:-missing}"
  failures=1
fi
for bridge in agents/gga-pi/bin/kilo agents/gga-pi/run-gga.sh; do
  if [[ ! -x "$ROOT/$bridge" ]]; then
    printf '%s: GGA Pi bridge file is missing or not executable\n' "$ROOT/$bridge"
    failures=1
  fi
done

required_packages=(
  npm:pi-extensible-workflows
  npm:gentle-pi
  npm:gentle-engram
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

# Plan-tier routing (Claude Pro + ChatGPT Plus), aligned with vekexasia/dotenv roles:
# native providers are the default, cliproxy-* mirror the same models explicitly.
if ! jq -e '
  .modelAliases as $aliases |
  $aliases["native-cheap-model"] == "anthropic/claude-sonnet-5-5:medium" and
  $aliases["native-luna"] == "openai-codex/gpt-6-luna:high" and
  $aliases["native-reviewer-model"] == "anthropic/claude-opus-5-5:high" and
  $aliases["native-sol"] == "openai-codex/gpt-6.1-sol:medium" and
  $aliases["native-astra"] == "openai-codex/gpt-6-astra:high" and
  $aliases["cliproxy-cheap-model"] == "cliproxyapi/claude-sonnet-5-5:medium" and
  $aliases["cliproxy-luna"] == "cliproxyapi/gpt-6-luna:high" and
  $aliases["cliproxy-reviewer-model"] == "cliproxyapi/claude-opus-5-5:high" and
  $aliases["cliproxy-sol"] == "cliproxyapi/gpt-6.1-sol:medium" and
  $aliases["cliproxy-astra"] == "cliproxyapi/gpt-6-astra:high" and
  $aliases["cheap-model"] == "native-cheap-model" and
  $aliases["scout-model"] == "cheap-model" and
  $aliases["developer-model"] == "cheap-model" and
  $aliases["tests-expert"] == "native-luna" and
  $aliases["researcher-model"] == "native-luna:xhigh" and
  $aliases["reviewer-model"] == "native-reviewer-model" and
  $aliases["oracle-model"] == "reviewer-model" and
  all(["cheap-model-ant", "cheap-model-oai", "old-reviewer-model", "native-gpt-model", "cliproxy-gpt-model", "native-sonnet-executor", "cliproxy-sonnet-executor"][]; $aliases[.] == null)
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
  printf '%s: workflow aliases are not the native-default/CLIProxyAPI-explicit policy\n' "$WORKFLOWS_SETTINGS"
  failures=1
fi

if ! jq -e '
  .defaultProvider == "anthropic" and .defaultModel == "claude-sonnet-5-5" and .defaultThinkingLevel == "medium" and
  (.enabledModels | all(.[]; startswith("anthropic/") or startswith("openai-codex/") or startswith("cliproxyapi/"))) and
  (.enabledModels | index("anthropic/claude-sonnet-5-5") != null) and
  (.enabledModels | index("openai-codex/gpt-6.1-sol") != null)
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: defaults must be Sonnet 5.5 medium with enabledModels limited to Anthropic, OpenAI and CLIProxyAPI mirrors\n' "$SETTINGS"
  failures=1
fi

# Native and CLIProxyAPI must coincide: every native alias, enabled model and startup
# thinking level has a cliproxyapi mirror on the same model and effort.
if ! jq -e '
  def native: sub("^(anthropic|openai-codex)/"; "");
  def mirror: sub("^cliproxyapi/"; "");
  .modelAliases as $aliases |
  all(["cheap-model", "luna", "reviewer-model", "sol", "astra"][];
      ($aliases["native-" + .] | native) == ($aliases["cliproxy-" + .] | mirror))
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1 ||
  ! jq -e '
  def native: sub("^(anthropic|openai-codex)/"; "");
  def mirror: sub("^cliproxyapi/"; "");
  ([.enabledModels[] | select(startswith("cliproxyapi/")) | mirror] | sort) ==
    ([.enabledModels[] | select(startswith("anthropic/") or startswith("openai-codex/")) | native] | sort) and
  ([.modelThinkingLevels | to_entries[] | select(.key | startswith("cliproxyapi/")) | {k: (.key | mirror), v: .value}] | sort_by(.k)) ==
    ([.modelThinkingLevels | to_entries[] | select(.key | startswith("anthropic/") or startswith("openai-codex/")) | {k: (.key | native), v: .value}] | sort_by(.k))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: native and CLIProxyAPI aliases, enabledModels or thinking levels do not mirror each other\n' "$WORKFLOWS_SETTINGS"
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

ROLES_DIR="$ROOT/pi/agent/pi-extensible-workflows/roles"
required_roles=(
  developer.md
  oracle.md
  researcher.md
  reviewer.md
  scout.md
  summarizer.md
  tests-expert.md
  architect.md
  security.md
  qa.md
  release.md
  sre.md
)
missing_roles=()
for role in "${required_roles[@]}"; do
  if [[ ! -f "$ROLES_DIR/$role" ]]; then
    missing_roles+=("$role")
  fi
done
if ((${#missing_roles[@]})); then
  printf '%s: missing required role file(s): %s\n' "$ROLES_DIR" "${missing_roles[*]}"
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
