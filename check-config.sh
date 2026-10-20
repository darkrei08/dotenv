#!/usr/bin/env bash
set -uo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SETTINGS="$ROOT/pi/agent/settings.json"
MODES="$ROOT/pi/agent/modes.json"
GGA_CONFIG="$ROOT/.gga"
WORKFLOWS_SETTINGS="$ROOT/pi/agent/pi-ext-roles/settings.json"
ROLE_GROUPS="$ROOT/pi/agent/pi-ha-role-groups.json"
ROLE_GROUP_MANIFEST="$ROOT/pi/agent/extensions/pi-ha-role-groups/package.json"
HA_MATRIX="$ROOT/pi/agent/ha-failover.example.json"
RETIRED_EXTENSION="$ROOT/pi/agent/extensions/gentle-bar.ts"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
LIVE_SETTINGS="$PI_AGENT_DIR/settings.json"
LIVE_WORKFLOWS_SETTINGS="$PI_AGENT_DIR/pi-ext-roles/settings.json"
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

if ! check_json_file "$ROLE_GROUPS" || ! check_json_file "$HA_MATRIX" || ! check_json_file "$ROLE_GROUP_MANIFEST"; then
  failures=1
elif ! jq -e '
  (.pi.extensions // []) as $extensions |
  ($extensions | index("bind.ts") | not) and
  (["fast.ts", "research.ts", "reviewer.ts", "scout.ts", "summary.ts", "testing.ts"] | all(.[]; $extensions | index(.) != null))
' "$ROLE_GROUP_MANIFEST" >/dev/null 2>&1; then
  printf '%s: HA group package manifest must expose only the six factory extensions
' "$ROLE_GROUP_MANIFEST"
  failures=1
else
  while IFS=$'\t' read -r role alias group; do
    role_file="$ROOT/pi/agent/pi-ext-roles/roles/$role.md"
    group_extension="$ROOT/pi/agent/extensions/pi-ha-role-groups/$group.ts"
    if ! jq -e --arg alias "$alias" '.modelAliases[$alias] != null' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
      printf '%s: role %s references missing model alias %s\n' "$ROLE_GROUPS" "$role" "$alias"
      failures=1
    fi
    if ! jq -e --arg group "$group" '.groups[$group] != null' "$HA_MATRIX" >/dev/null 2>&1; then
      printf '%s: role %s references missing HA group %s\n' "$ROLE_GROUPS" "$role" "$group"
      failures=1
    fi
    if [[ ! -f "$role_file" ]] || ! grep -Fq "pi-ha-role-groups/$group.ts" "$role_file"; then
      printf '%s: role %s does not load its HA group extension %s\n' "$ROLE_GROUPS" "$role" "$group"
      failures=1
    fi
    if [[ ! -f "$group_extension" ]]; then
      printf '%s: missing HA group extension for %s\n' "$ROLE_GROUPS" "$group"
      failures=1
    fi
  done < <(jq -r '.roles | to_entries[] | [.key, .value.modelAlias, .value.haGroup] | @tsv' "$ROLE_GROUPS")
fi

if ! jq -e '
  .compaction.enabled == true and
  (.compaction.reserveTokens // 0) >= 16384 and
  (.compaction.keepRecentTokens // 0) >= 20000
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: compaction must stay enabled with reserveTokens >= 16384 and keepRecentTokens >= 20000\n' "$SETTINGS"
  failures=1
fi
if ! jq -e '
  (.packages // []) as $packages |
  any($packages[]?; . == "npm:@sting8k/pi-vcc") and
  all($packages[]?; . != "packages/pi-codex-context")
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: pi-vcc must be the sole registered compaction package\n' "$SETTINGS"
  failures=1
fi
if ! jq -e '
  .overrideDefaultCompaction == true and
  .smartKeepTail == true and
  .continueAfterThresholdCompact == true
' "$ROOT/pi/agent/pi-vcc-config.json" >/dev/null 2>&1; then
  printf '%s: pi-vcc config must enable default override, smart tail, and threshold continuation\n' "$ROOT/pi/agent/pi-vcc-config.json"
  failures=1
fi

if ! node "$ROOT/pi/agent/bin/pi-token-budget.mjs" --root="$ROOT/pi/agent" --json >/dev/null 2>&1; then
  printf '%s: token-budget policy check failed\n' "$ROOT/pi/agent/bin/pi-token-budget.mjs"
  failures=1
fi

reviewer_role_model=$(sed -nE 's/^model:[[:space:]]*([^[:space:]]+).*/\1/p;T;q' "$ROOT/pi/agent/pi-ext-roles/roles/reviewer.md")
gga_expected=$(jq -er --arg ref "$reviewer_role_model" '
  .modelAliases as $aliases |
  def splitref: if test(":.*$") then [sub(":.*$"; ""), match(":([^:]+)$").captures[0].string] else [., null] end;
  def resolve($ref; $effort; $depth):
    if $depth > 10 then error("model alias chain exceeds 10 steps") else
      ($ref | splitref) as $parts |
      ($effort // $parts[1]) as $resolved_effort |
      if $aliases[$parts[0]] then resolve($aliases[$parts[0]]; $resolved_effort; $depth + 1)
      elif ($parts[0] | contains("/")) and ($resolved_effort != null) then {model: $parts[0], effort: $resolved_effort}
      else error("unresolved model alias or effort") end
    end;
  resolve($ref; null; 0) | .model + ":" + .effort | sub("^(anthropic|openai-codex)/"; "cliproxyapi/")
' "$WORKFLOWS_SETTINGS" 2>/dev/null) || gga_expected=""
gga_provider=$(sed -nE 's/^PROVIDER="([^"]*)".*/\1/p' "$GGA_CONFIG" 2>/dev/null)
gga_model=${gga_expected%:*}
gga_effort=${gga_expected##*:}
if ! jq -e --arg model "$gga_model" --arg effort "$gga_effort" '(.enabledModels // [] | index($model) != null) and .modelThinkingLevels[$model] == $effort' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: GGA reviewer model/effort must be enabled (found: %s:%s)\n' "$SETTINGS" "${gga_model:-unresolved}" "${gga_effort:-unresolved}"
  failures=1
fi
if [[ -z "$reviewer_role_model" || -z "$gga_expected" || "$gga_provider" != "kilo:$reviewer_role_model" ]]; then
  printf '%s: PROVIDER must use the Pi workflow reviewer role alias (kilo:%s, found: %s)\n' \
    "$GGA_CONFIG" "${reviewer_role_model:-missing-reviewer-alias}" "${gga_provider:-missing}"
  failures=1
fi
if [[ -n "$gga_expected" ]] && ! jq -e --arg expected "${gga_expected%:*}" --arg effort "${gga_expected##*:}" '
  (.model_profiles // {}) as $profiles |
  reduce ["review-risk", "review-resilience", "review-readability", "review-reliability"][] as $profile
    (true; . and ($profiles[$profile].model == $expected and $profiles[$profile].effort == $effort))
' "$ROOT/pi/agent/subagents.json" >/dev/null 2>&1; then
  printf '%s: Gentle AI reviewer profiles must match the Pi workflow reviewer role (%s)\n' \
    "$ROOT/pi/agent/subagents.json" "$gga_expected"
  failures=1
fi
for bridge in agents/gga-pi/bin/kilo agents/gga-pi/run-gga.sh; do
  if [[ ! -x "$ROOT/$bridge" ]]; then
    printf '%s: GGA Pi bridge file is missing or not executable\n' "$ROOT/$bridge"
    failures=1
  fi
done

# If this clone already has a hook, keep it on the repo-owned bridge path.
git_common_dir=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null || printf '')
if [[ -n "$git_common_dir" && "$git_common_dir" != /* ]]; then
  git_common_dir="$ROOT/$git_common_dir"
fi
pre_commit_hook="$git_common_dir/hooks/pre-commit"
if [[ -f "$pre_commit_hook" ]] && ! grep -Fq 'agents/gga-pi/run-gga.sh' "$pre_commit_hook"; then
  printf '%s: installed pre-commit hook must invoke agents/gga-pi/run-gga.sh\n' "$pre_commit_hook"
  failures=1
fi

required_packages=(
  npm:pi-extensible-workflows
  npm:@piewf/pi-ext-roles
  npm:gentle-pi
  npm:gentle-engram
  npm:@router-for-me/pi-cliproxyapi-provider
  npm:@piewf/herdr
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

# Compare only behavior-bearing projections: modelAliases, workflow tools/extensions, and object-package source/extensions. Pi/setup-ai may normalize package versions, duplicate entries, and order, so the whole settings file is intentionally not compared.
if ((versioned_workflows_ok && live_workflows_ok)) &&
    ! diff -u \
      <(jq -S '{modelAliases, tools, extensions}' "$WORKFLOWS_SETTINGS") \
      <(jq -S '{modelAliases, tools, extensions}' "$LIVE_WORKFLOWS_SETTINGS") >/dev/null; then
  printf '%s: canonical modelAliases/tools/extensions differ from %s\n' \
    "$WORKFLOWS_SETTINGS" "$LIVE_WORKFLOWS_SETTINGS"
  failures=1
fi

if ! jq -e '
  (.tools // [] | index("tool_search") != null) and
  ((["builtin:codemode", "builtin:tool-search", "builtin:mcp"] | all(.[]; . as $extension | $extensions | index($extension) != null)))
' --argjson extensions "$(jq '.extensions // []' "$WORKFLOWS_SETTINGS" 2>/dev/null || printf '[]')" "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
  printf '%s: workflow subagents must retain tool_search and the built-in codemode/tool-search/mcp extensions\n' "$WORKFLOWS_SETTINGS"
  failures=1
fi

# Plan-tier routing (Claude Pro + ChatGPT Plus), aligned with vekexasia/dotenv roles:
# Claude roles resolve through cliproxy-*; native-* Claude aliases stay as the mirror reference.
if ! jq -e '
  .modelAliases as $aliases |
  $aliases["native-cheap-model"] == "anthropic/claude-sonnet-5-5:medium" and
  $aliases["native-luna"] == "openai-codex/gpt-5.6-luna:high" and
  $aliases["native-reviewer-model"] == "anthropic/claude-opus-5-5:high" and
  $aliases["native-sol"] == "openai-codex/gpt-6.1-sol:medium" and
  $aliases["native-astra"] == "openai-codex/gpt-6-astra:high" and
  $aliases["cliproxy-cheap-model"] == "cliproxyapi/claude-sonnet-5-5:medium" and
  $aliases["cliproxy-luna"] == "cliproxyapi/gpt-5.6-luna:high" and
  $aliases["cliproxy-reviewer-model"] == "cliproxyapi/claude-opus-5-5:high" and
  $aliases["cliproxy-sol"] == "cliproxyapi/gpt-6.1-sol:medium" and
  $aliases["cliproxy-astra"] == "cliproxyapi/gpt-6-astra:high" and
  $aliases["cheap-model"] == "cliproxy-cheap-model" and
  $aliases["scout-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["developer-model"] == "cheap-model" and
  $aliases["tests-expert"] == "cliproxy-luna" and
  $aliases["researcher-model"] == "cliproxy-luna:xhigh" and
  $aliases["summarizer-model"] == "cliproxyapi/claude-haiku-5-5:low" and
  $aliases["gemini-scout-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["gemini-summarizer-model"] == "cliproxyapi/gemini-3.5-flash-lite:low" and
  $aliases["gemini-researcher-model"] == "cliproxyapi/gemini-pro-agent:high" and
  $aliases["gemini-developer-model"] == "cliproxyapi/gemini-3.8-flash-high:high" and
  $aliases["gemini-tests-model"] == "cliproxyapi/gemini-3.8-flash-high:high" and
  $aliases["reviewer-model"] == "cliproxy-reviewer-model" and
  $aliases["oracle-model"] == "reviewer-model" and
  all(["cheap-model-ant", "cheap-model-oai", "old-reviewer-model", "native-gpt-model", "cliproxy-gpt-model", "native-sonnet-executor", "cliproxy-sonnet-executor"][]; $aliases[.] == null)
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
  printf '%s: workflow aliases are not the gateway-first policy\n' "$WORKFLOWS_SETTINGS"
  failures=1
fi

if ! jq -e '
  .defaultProvider == "cliproxyapi" and .defaultModel == "gpt-5.6-luna" and .defaultThinkingLevel == "high" and
  (.enabledModels | all(.[]; startswith("cliproxyapi/"))) and
  (.enabledModels | index("cliproxyapi/claude-sonnet-5-5") != null) and
  (.enabledModels | index("cliproxyapi/gpt-5.6-luna") != null)
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: defaults must be cliproxyapi GPT-5.6 Luna high with gateway-only enabledModels\n' "$SETTINGS"
  failures=1
fi

if ! jq -e '
  .modes.advisor.provider == "cliproxyapi" and
  .modes.advisor.modelId == "gpt-5.6-luna" and
  .modes.advisor.thinkingLevel == "high"
' "$MODES" >/dev/null 2>&1; then
  printf '%s: advisor mode must use cliproxyapi GPT-5.6 Luna high\n' "$MODES"
  failures=1
fi

if ! jq -e '
  .defaultTools == ["+tool_search"]
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: canonical defaultTools must be ["+tool_search"]\n' "$SETTINGS"
  failures=1
fi

# Native definitions remain available as a manual fallback, while the active picker
# exposes only CLIProxyAPI models. Native and gateway aliases and startup thinking levels
# must still mirror each other.
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
  ([.modelThinkingLevels | to_entries[] | select(.key | startswith("cliproxyapi/")) | {k: (.key | mirror), v: .value}] | sort_by(.k)) ==
    ([.modelThinkingLevels | to_entries[] | select(.key | startswith("anthropic/") or startswith("openai-codex/")) | {k: (.key | native), v: .value}] | sort_by(.k))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: native and CLIProxyAPI aliases, enabledModels or thinking levels do not mirror each other\n' "$WORKFLOWS_SETTINGS and $SETTINGS"
  failures=1
fi

if ! jq -e '(.providers | has("tuxevil-rotator") | not)' "$ROOT/pi/agent/models.json" >/dev/null 2>&1; then
  printf '%s: the retired tuxevil-rotator provider is back in the catalog\n' "$ROOT/pi/agent/models.json"
  failures=1
fi

if ((live_settings_ok)); then
  if ! diff -u \
      <(jq -S '.defaultTools // []' "$SETTINGS") \
      <(jq -S '.defaultTools // []' "$LIVE_SETTINGS") >/dev/null; then
    printf '%s: canonical defaultTools differ from %s\n' \
      "$SETTINGS" "$LIVE_SETTINGS"
    failures=1
  fi
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

ROLES_DIR="$ROOT/pi/agent/pi-ext-roles/roles"
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

researcher_tools=$(sed -nE 's/^tools:[[:space:]]*(.*)/\1/p;T;q' "$ROLES_DIR/researcher.md")
if [[ -z "$researcher_tools" ]] || ! jq -e '
  (index("!edit") != null) and
  (index("!write") != null) and
  (index("!bash") != null) and
  (any(.[]; . == "!replace" or . == "!insert" or . == "!undo_last_change" or . == "replace" or . == "insert" or . == "undo_last_change") | not)
' <<<"$researcher_tools" >/dev/null 2>&1; then
  printf '%s: researcher role must exclude edit, write, and bash without referencing absent tools (replace, insert, undo_last_change)\n' "$ROLES_DIR/researcher.md"
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
