#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SETTINGS="$ROOT/pi/agent/settings.json"
GGA_CONFIG="$ROOT/.gga"
WORKFLOWS_SETTINGS="$ROOT/pi/agent/pi-ext-roles/settings.json"
RETIRED_EXTENSION="$ROOT/pi/agent/extensions/gentle-bar.ts"
MODEL_PREFLIGHT_EXTENSION="$ROOT/pi/agent/extensions/model-preflight.mjs"
MODEL_PREFLIGHT_LOADER="$ROOT/pi/agent/extensions/model-preflight.js"
PI_TOOL_DISPLAY_CONFIG="$ROOT/pi/agent/extensions/pi-tool-display/config.json"
VCC_CONFIG="$ROOT/pi/agent/pi-vcc-config.json"
PI_PACKAGE="$ROOT/pi/agent/package.json"
PI_PACKAGES="$ROOT/pi/agent/pi-packages.txt"
HA_EXAMPLE="$ROOT/pi/agent/ha-failover.example.json"
HA_ROLE_GROUPS="$ROOT/pi/agent/pi-ha-role-groups.json"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
LIVE_SETTINGS="$PI_AGENT_DIR/settings.json"
LIVE_WORKFLOWS_SETTINGS="$PI_AGENT_DIR/pi-ext-roles/settings.json"
SETUP="$ROOT/setup_env.sh"
failures=0

check_json_file() {
  local path=$1
  if [[ ! -e "$path" && ! -L "$path" ]]; then
    printf '%s: missing file\n' "$path"
    return 1
  fi
  if [[ -L "$path" && ! -e "$path" ]]; then
    printf '%s: dangling symlink\n' "$path"
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

if ! jq -e '(.defaultTools // []) | index("+tool_search") != null' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: defaultTools must activate +tool_search without replacing built-ins\n' "$SETTINGS"
  failures=1
fi

if ! jq -e '
  .compaction.enabled == true and
  (.compaction.reserveTokens // 0) >= 16384 and
  (.compaction.keepRecentTokens // 0) >= 20000
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: compaction must stay enabled with reserveTokens >= 16384 and keepRecentTokens >= 20000\n' "$SETTINGS"
  failures=1
fi

check_main_compaction_owner() {
  local path=$1
  jq -e '
    [(.packages // [])[]? |
      (if type == "string" then . else (.source // "") end)] as $packages |
    ([ $packages[] | select(. == "npm:@sting8k/pi-vcc") ] | length) == 1 and
    ([ $packages[] | select(test("pi-codex-context")) ] | length) == 0
  ' "$path" >/dev/null 2>&1
}

# pi-vcc owns the main session. pi-codex-context remains source-only and
# unregistered, matching the upstream Vekexasia compaction ownership model.
if ! check_main_compaction_owner "$SETTINGS"; then
  printf '%s: main Pi settings must register exactly npm:@sting8k/pi-vcc and not pi-codex-context\n' "$SETTINGS"
  failures=1
fi
if ! jq -e '
  .overrideDefaultCompaction == true and
  .smartKeepTail == true and
  .continueAfterThresholdCompact == true
' "$VCC_CONFIG" >/dev/null 2>&1; then
  printf '%s: pi-vcc must own compaction with upstream-compatible settings\n' "$VCC_CONFIG"
  failures=1
fi

if ! node "$ROOT/pi/agent/bin/pi-token-budget.mjs" --root="$ROOT/pi/agent" --json >/dev/null 2>&1; then
  printf '%s: token-budget policy check failed\n' "$ROOT/pi/agent/bin/pi-token-budget.mjs"
  failures=1
fi

gga_expected_alias='reviewer-model'
gga_expected_route=$(jq -r --arg alias "$gga_expected_alias" '.modelAliases[$alias] // empty' "$WORKFLOWS_SETTINGS")
gga_expected_model=${gga_expected_route%:*}
gga_expected_effort=${gga_expected_route##*:}
gga_provider=$(sed -nE 's/^PROVIDER="([^"]*)".*/\1/p' "$GGA_CONFIG" 2>/dev/null)
if ! jq -e --arg model "$gga_expected_model" --arg effort "$gga_expected_effort" '(.enabledModels // [] | index($model) != null) and .modelThinkingLevels[$model] == $effort' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: GGA reviewer model/effort must be enabled (found: %s:%s)\n' "$SETTINGS" "${gga_expected_model:-unresolved}" "${gga_expected_effort:-unresolved}"
  failures=1
fi
if [[ "$gga_provider" != "kilo:$gga_expected_alias" ]]; then
  printf '%s: GGA provider must use the Pi Ext Roles alias (expected: kilo:%s, found: %s)\n' \
    "$GGA_CONFIG" "$gga_expected_alias" "${gga_provider:-missing}"
  failures=1
fi
if [[ -n "$gga_expected_route" ]] && ! jq -e --arg route "$gga_expected_route" '
  (.groups.reviewer.entries // []) |
  any(.[]; (.id // "") == $route)
' "$HA_EXAMPLE" >/dev/null 2>&1; then
  printf '%s: GGA resolved route must be listed in the reviewer HA group (found: %s)\n' "$GGA_CONFIG" "${gga_expected_route:-unresolved}"
  failures=1
fi
for bridge in agents/gga-pi/bin/kilo agents/gga-pi/run-gga.sh; do
  if [[ ! -x "$ROOT/$bridge" ]]; then
    printf '%s: GGA Pi bridge file is missing or not executable\n' "$ROOT/$bridge"
    failures=1
  fi
done

# If this clone already has a hook, keep it on the repo-owned bridge path.
git_common_dir=''
pre_commit_hook=''
if git_common_dir=$(git -C "$ROOT" rev-parse --git-common-dir 2>/dev/null); then
  if [[ "$git_common_dir" != /* ]]; then
    git_common_dir="$ROOT/$git_common_dir"
  fi
  pre_commit_hook="$git_common_dir/hooks/pre-commit"
fi
if [[ -n "$pre_commit_hook" && -f "$pre_commit_hook" ]] && ! grep -Fq 'agents/gga-pi/run-gga.sh' "$pre_commit_hook"; then
  printf '%s: installed pre-commit hook must invoke agents/gga-pi/run-gga.sh\n' "$pre_commit_hook"
  failures=1
fi

required_packages=(
  npm:pi-extensible-workflows
  npm:@sting8k/pi-vcc
  npm:gentle-pi
  npm:gentle-engram
  npm:@router-for-me/pi-cliproxyapi-provider
  npm:@piewf/herdr
  git:github.com/darkrei08/pi-herdr-orchestration@e8e52d3a358f036f5cb2bcb517b0abe572d3d216
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
if ! jq -e --arg source 'git:github.com/darkrei08/pi-herdr-orchestration@e8e52d3a358f036f5cb2bcb517b0abe572d3d216' '
  any((.packages? // [])[]?;
    type == "object" and .source == $source and (.skills? // null) == []
  )
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: pi-herdr-orchestration must load extensions without its duplicate package skill\n' "$SETTINGS"
  failures=1
fi

if [[ $(grep -Ec '^[[:space:]]*npm:@sting8k/pi-vcc[[:space:]]*$' "$PI_PACKAGES") -ne 1 ]]; then
  printf '%s: pi-vcc must appear exactly once in the package manifest\n' "$PI_PACKAGES"
  failures=1
fi
if awk '!/^[[:space:]]*#/ && $0 ~ /^[[:space:]]*(npm:gentle-pi|npm:pi-extensible-workflows|.*pi-codex-context.*)[[:space:]]*$/ { found=1 } END { exit found }' "$PI_PACKAGES"; then
  :
else
  printf '%s: module-owned Gentle AI packages and pi-codex-context must stay out of the package manifest\n' "$PI_PACKAGES"
  failures=1
fi

if ! jq -e '
  any((.packages? // [])[]?;
    type == "object" and .source == "npm:gentle-pi" and
    ((.extensions? // []) |
      if type == "array" then
        index("-extensions/quiet-tools.ts") != null and
        index("-extensions/pi-pretty.ts") != null and
        index("-extensions/codegraph-tools.ts") != null
      else false end))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: npm:gentle-pi must be an object with all conflicting extensions excluded\n' "$SETTINGS"
  failures=1
fi

if ! jq -e '
  .registerToolOverrides as $overrides |
  all(["read", "edit", "grep", "ls"][]; $overrides[.] == false)
' "$PI_TOOL_DISPLAY_CONFIG" >/dev/null 2>&1; then
  printf '%s: pi-tool-display must leave command-artifacts and tool-fixer ownership untouched\n' "$PI_TOOL_DISPLAY_CONFIG"
  failures=1
fi

if ! jq -e '
  any((.packages? // [])[]?;
    type == "object" and .source == "npm:pi-extensible-workflows" and
    (.extensions? == null))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: npm:pi-extensible-workflows must not filter its standalone subagents extension\n' "$SETTINGS"
  failures=1
fi

if ! jq -e '
  .extensionSettings.subagents.enabled == true
' "$ROOT/pi/agent/pi-extensible-workflows/settings.json" >/dev/null 2>&1; then
  printf '%s: subagents.enabled must be explicitly true under extensionSettings\n' "$ROOT/pi/agent/pi-extensible-workflows/settings.json"
  failures=1
fi
if ! jq -e '
  (.extensions // []) as $extensions |
  ($extensions | index("**/@sting8k/pi-vcc/**")) != null and
  all($extensions[]?; test("pi-codex-context") | not)
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
  printf '%s: workflow children must load pi-vcc and not pi-codex-context\n' "$WORKFLOWS_SETTINGS"
  failures=1
fi

versioned_workflows_ok=1
live_workflows_ok=1
live_settings_ok=1
check_json_file "$WORKFLOWS_SETTINGS" || { versioned_workflows_ok=0; failures=1; }
if [[ ! -e "$LIVE_WORKFLOWS_SETTINGS" && ! -L "$LIVE_WORKFLOWS_SETTINGS" ]]; then
  printf '%s: missing file; skipping live workflow comparison\n' "$LIVE_WORKFLOWS_SETTINGS"
  live_workflows_ok=0
elif ! check_json_file "$LIVE_WORKFLOWS_SETTINGS"; then
  live_workflows_ok=0
  failures=1
fi
if [[ ! -e "$LIVE_SETTINGS" && ! -L "$LIVE_SETTINGS" ]]; then
  printf '%s: missing file; skipping live package comparison\n' "$LIVE_SETTINGS"
  live_settings_ok=0
elif ! check_json_file "$LIVE_SETTINGS"; then
  live_settings_ok=0
  failures=1
fi
if ((live_settings_ok)) && ! check_main_compaction_owner "$LIVE_SETTINGS"; then
  printf '%s: live main Pi settings must match the pi-vcc-only compaction policy\n' "$LIVE_SETTINGS"
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

# Configured gateway-first routing; catalog visibility does not establish plan access.
# Each native alias mirrors its CLIProxyAPI route, while role aliases deliberately use
# the effort supported by the selected model and workload.
if ! jq -e '
  .modelAliases as $aliases |
  $aliases["native-cheap-model"] == "openai-codex/gpt-5.6-luna:medium" and
  $aliases["native-luna"] == "openai-codex/gpt-5.6-luna:high" and
  $aliases["native-reviewer-model"] == "anthropic/claude-opus-4-6-thinking:high" and
  $aliases["native-sol"] == "openai-codex/gpt-6-sol:high" and
  $aliases["native-astra"] == "openai-codex/gpt-6-astra:medium" and
  $aliases["cliproxy-cheap-model"] == "cliproxyapi/gpt-5.6-luna:medium" and
  $aliases["cliproxy-luna"] == "cliproxyapi/gpt-5.6-luna:high" and
  $aliases["cliproxy-reviewer-model"] == "cliproxyapi/claude-opus-4-6-thinking:off" and
  $aliases["cliproxy-sol"] == "cliproxyapi/gpt-6-sol:high" and
  $aliases["cliproxy-astra"] == "cliproxyapi/gpt-6-astra:medium" and
  $aliases["scout-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["developer-model"] == "cliproxyapi/gpt-5.6-luna:high" and
  $aliases["architect-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["security-model"] == "cliproxyapi/claude-opus-4-6-thinking:off" and
  $aliases["debugger-model"] == "cliproxyapi/claude-sonnet-4-6:off" and
  $aliases["verifier-model"] == "cliproxyapi/claude-sonnet-4-6:off" and
  $aliases["qa-model"] == "cliproxyapi/claude-sonnet-4-6:off" and
  $aliases["release-model"] == "cliproxyapi/claude-sonnet-4-6:off" and
  $aliases["sre-model"] == "cliproxyapi/claude-sonnet-4-6:off" and
  $aliases["tests-expert"] == "cliproxyapi/gpt-5.6-luna:high" and
  $aliases["researcher-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["market-researcher-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["marketing-strategist-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["summarizer-model"] == "cliproxyapi/gemini-3.5-flash-lite:low" and
  $aliases["gemini-scout-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["gemini-summarizer-model"] == "cliproxyapi/gemini-3.5-flash-lite:low" and
  $aliases["gemini-researcher-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["gemini-developer-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["gemini-tests-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  $aliases["reviewer-model"] == "cliproxyapi/claude-opus-4-6-thinking:off" and
  $aliases["oracle-model"] == "cliproxyapi/gemini-3.8-flash-high:medium" and
  all(["cheap-model", "cheap-model-ant", "cheap-model-oai", "old-reviewer-model", "native-gpt-model", "cliproxy-gpt-model", "native-sonnet-executor", "cliproxy-sonnet-executor"][]; $aliases[.] == null)
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1; then
  printf '%s: workflow aliases are not the configured gateway-first matrix\n' "$WORKFLOWS_SETTINGS"
  failures=1
fi

if ! jq -e '
  .defaultProvider == "cliproxyapi" and .defaultModel == "gpt-5.6-luna" and .defaultThinkingLevel == "high" and
  (.enabledModels | all(.[]; startswith("cliproxyapi/"))) and
  (.enabledModels | index("cliproxyapi/gpt-5.6-luna") != null) and
  (.enabledModels | index("cliproxyapi/gpt-6-sol") != null)
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: defaults must be the gateway GPT-5.6 Luna high matrix with gateway-only enabledModels\n' "$SETTINGS"
  failures=1
fi

# Native definitions remain available as a manual fallback, while the active picker
# exposes only CLIProxyAPI models. Native and gateway aliases must mirror model IDs;
# provider-specific thinking support may legitimately differ.
if ! jq -e '
  def native: sub("^(anthropic|openai-codex)/"; "");
  def mirror: sub("^cliproxyapi/"; "");
  def route: sub(":(off|minimal|low|medium|high|xhigh|max)$"; "");
  .modelAliases as $aliases |
  all(["luna", "reviewer-model", "sol", "astra"][];
      (($aliases["native-" + .] | native | route) == ($aliases["cliproxy-" + .] | mirror | route)))
' "$WORKFLOWS_SETTINGS" >/dev/null 2>&1 ||
  ! jq -e '
  def native: sub("^(anthropic|openai-codex)/"; "");
  def mirror: sub("^cliproxyapi/"; "");
  ([.modelThinkingLevels | to_entries[] | select(.key | startswith("cliproxyapi/")) | {k: (.key | mirror)}] | sort_by(.k)) ==
    ([.modelThinkingLevels | to_entries[] | select(.key | startswith("anthropic/") or startswith("openai-codex/")) | {k: (.key | native)}] | sort_by(.k))
' "$SETTINGS" >/dev/null 2>&1; then
  printf '%s: native and CLIProxyAPI aliases, enabledModels or model identifiers do not mirror each other\n' "$WORKFLOWS_SETTINGS and $SETTINGS"
  failures=1
fi

if ! jq -e '(.providers | has("tuxevil-rotator") | not)' "$ROOT/pi/agent/models.json" >/dev/null 2>&1; then
  printf '%s: the retired tuxevil-rotator provider is back in the catalog\n' "$ROOT/pi/agent/models.json"
  failures=1
fi
if ! jq -e '
  (.providers["openai-codex"].models // [] | map(.id)) as $ids |
  ($ids | index("gpt-6-luna") != null) and ($ids | index("gpt-6-sol") != null)
' "$ROOT/pi/agent/models.json" >/dev/null 2>&1; then
  printf '%s: the openai-codex catalog must retain gpt-6-luna and gpt-6-sol\n' "$ROOT/pi/agent/models.json"
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
  debugger.md
  verifier.md
  market-researcher.md
  marketing-strategist.md
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

if [[ ! -s "$MODEL_PREFLIGHT_EXTENSION" ]]; then
  printf '%s: model availability preflight implementation is missing\n' "$MODEL_PREFLIGHT_EXTENSION"
  failures=1
fi
if [[ ! -s "$MODEL_PREFLIGHT_LOADER" ]]; then
  printf '%s: model availability preflight default-loadable adapter is missing\n' "$MODEL_PREFLIGHT_LOADER"
  failures=1
fi
if ! jq -e '.pi.extensions | index("extensions") != null' "$PI_PACKAGE" >/dev/null 2>&1; then
  printf '%s: repository Pi package must register the extensions directory\n' "$PI_PACKAGE"
  failures=1
fi
for config in "$HA_EXAMPLE" "$HA_ROLE_GROUPS"; do
  if ! check_json_file "$config"; then failures=1; fi
done

if ! ROOT_FOR_HA="$ROOT" node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.env.ROOT_FOR_HA;
const bind = await import(pathToFileURL(`${root}/pi/agent/extensions/pi-ha-role-groups/bind.mjs`));
const groups = JSON.parse(readFileSync(`${root}/pi/agent/ha-failover.example.json`, "utf8"));
const roleGroups = JSON.parse(readFileSync(`${root}/pi/agent/pi-ha-role-groups.json`, "utf8")).roleGroups;
const aliases = JSON.parse(readFileSync(`${root}/pi/agent/pi-ext-roles/settings.json`, "utf8")).modelAliases;
const roleModels = Object.fromEntries(Object.keys(roleGroups).map((role) => {
  const source = readFileSync(`${root}/pi/agent/pi-ext-roles/roles/${role}.md`, "utf8");
  return [role, source.match(/^model:\s*(\S+)\s*$/m)?.[1]];
}));
const failures = bind.assertRoleGroupCoverage({
  primaries: bind.resolveRolePrimaries({ roleModels, aliases }),
  roleGroups,
  groups: groups.groups,
});
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
NODE
then
  printf '%s: configured role primaries must be covered by their HA groups\n' "$HA_EXAMPLE"
  failures=1
fi

if [[ -e "$RETIRED_EXTENSION" || -L "$RETIRED_EXTENSION" ]]; then
  printf '%s: retired repository extension must not exist\n' "$RETIRED_EXTENSION"
  failures=1
fi

# A commented-out mention documents the obsolete switch instead of writing it.
if grep -vE '^[[:space:]]*#' "$SETUP" |
    grep -Eq "GENTLE_PI_QUIET_TOOLS[[:space:]]*=[[:space:]]*[\"']?0[\"']?([[:space:];]|$)"; then
  printf '%s: writes GENTLE_PI_QUIET_TOOLS=0\n' "$SETUP"
  failures=1
fi

# Skill collision audit (S3/S15): every skill declared as managed in
# agents/skills.manifest.json must NOT appear as a physical directory in
# ~/.pi/agent/skills. Pi already reads the canonical root (~/.agents/skills)
# directly (readsCanonical:true in the manifest), so a pi-local copy would be
# loaded twice. The linker's drop-copy action (run with --apply) removes these;
# this check detects regressions after install, upgrade or reload.
PI_SKILLS_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/skills"
MANIFEST="$ROOT/agents/skills.manifest.json"
manifest_ok=1
if ! check_json_file "$MANIFEST"; then
  manifest_ok=0
  failures=1
fi
if ((manifest_ok)) && [[ -d "$PI_SKILLS_DIR" ]]; then
  collisions=()
  if ! managed_skills=$(jq -r '.skills | to_entries[] | select(.value.managed != false) | .key' "$MANIFEST"); then
    printf '%s: manifest skill list could not be parsed\n' "$MANIFEST"
    failures=1
  else
    while IFS= read -r skill; do
      [[ -z "$skill" ]] && continue
      pi_entry="$PI_SKILLS_DIR/$skill"
      # Only an existing symlink to the canonical skill is a linker artifact (expected;
      # skip it). A real directory, a dangling link, or a link to elsewhere is a collision.
      if [[ -L "$pi_entry" ]] && [[ -e "$pi_entry" ]] &&
         [[ "$(readlink -f "$pi_entry")" == "${HOME}/.agents/skills/$skill" ]]; then
        continue
      fi
      if [[ -e "$pi_entry" || -L "$pi_entry" ]]; then
        collisions+=("$skill")
      fi
    done <<< "$managed_skills"
  fi
  if ((${#collisions[@]})); then
    printf '%s: skill(s) exist in the Pi-local root and would load twice — run: node agents/link-skills.mjs --apply --only pi\n  collisions: %s\n' \
      "$PI_SKILLS_DIR" "${collisions[*]}"
    failures=1
  fi
fi

if ((failures)); then
  exit 1
fi
printf 'config check passed: %s and %s\n' "$SETTINGS" "$SETUP"
