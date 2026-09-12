#!/usr/bin/env bash
#
# install-agent-extensions.sh - install the ponytail extension for every agent CLI
# that is present on this machine.
#
# Official commands (ponytail README, "Install" section):
#   Codex CLI        codex plugin marketplace add DietrichGebert/ponytail
#                    codex plugin add ponytail@ponytail
#   Antigravity CLI  agy plugin install https://github.com/DietrichGebert/ponytail
#   Gemini CLI       gemini extensions install https://github.com/DietrichGebert/ponytail
#   Copilot CLI      copilot plugin marketplace add DietrichGebert/ponytail
#                    copilot plugin install ponytail@ponytail
#   OpenCode         the `plugin` array in opencode.json must list
#                    @dietrichgebert/ponytail
#   Claude Code      NOT scriptable: its install is two interactive /plugin
#                    commands, so this script prints them as a manual step.
#   pi               NOT handled here. Pi installs ponytail from
#                    pi/agent/pi-packages.txt (setup-ai's pi-packages module).
#                    See README.md.
#
# Behavior:
#   * Idempotent. Where a host can list what it already has, an existing ponytail
#     is detected and the add command is skipped. Otherwise the documented add
#     command runs, which is idempotent on its own.
#   * A missing CLI is skipped with a log line; nothing is installed for it.
#   * One failing host never stops the run: the failure is logged and the other
#     hosts are still attempted. The exit status is 1 when a step that was
#     attempted failed, so a caller can still detect the problem.
#
# Usage: bash agents/install-agent-extensions.sh
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
MARKETPLACE="DietrichGebert/ponytail"
PLUGIN_REF="ponytail@ponytail"
EXTENSION_URL="https://github.com/DietrichGebert/ponytail"
OPENCODE_PLUGIN="@dietrichgebert/ponytail"

skipped=0
failures=0

log() { printf '[%s] %s\n' "${SCRIPT_NAME}" "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Run one step and record its outcome instead of aborting the script. The status is
# captured explicitly (never a bare `|| true`), so a failure is always reported.
step() {
  local label="$1"
  shift
  local status=0
  "$@" || status=$?
  if [[ "${status}" -eq 0 ]]; then
    log "OK   ${label}"
    return 0
  fi
  log "FAIL ${label} (exit ${status})"
  failures=$(( failures + 1 ))
  return 0
}

# Opportunistic "is it already installed?" probe. `plugin list` / `extensions list`
# is not part of ponytail's documented install, so a host without that subcommand
# simply exits non-zero here and the caller falls through to the documented add
# command, which is idempotent. stdin is /dev/null so a subcommand that expects a
# terminal cannot stall an unattended run.
host_lists_plugin() {
  local cli="$1"
  shift
  "$cli" "$@" list </dev/null 2>/dev/null | grep -qi 'ponytail'
}

install_codex() {
  if ! have codex; then
    log "SKIP Codex CLI (codex not found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  if host_lists_plugin codex plugin; then
    log "OK   Codex CLI already lists ponytail (codex plugin list)"
    return 0
  fi

  step "Codex: codex plugin marketplace add ${MARKETPLACE}" \
    codex plugin marketplace add "${MARKETPLACE}"
  step "Codex: codex plugin add ${PLUGIN_REF}" \
    codex plugin add "${PLUGIN_REF}"
}

# Google renamed the Gemini CLI to Antigravity CLI (the `agy` binary) and the same
# extension installs into both, so prefer `agy` and fall back to `gemini`.
install_antigravity_or_gemini() {
  if have agy; then
    if host_lists_plugin agy plugin; then
      log "OK   Antigravity CLI already lists ponytail (agy plugin list)"
      return 0
    fi
    step "Antigravity: agy plugin install ${EXTENSION_URL}" \
      agy plugin install "${EXTENSION_URL}"
    return 0
  fi

  if have gemini; then
    if host_lists_plugin gemini extensions; then
      log "OK   Gemini CLI already lists ponytail (gemini extensions list)"
      return 0
    fi
    step "Gemini: gemini extensions install ${EXTENSION_URL}" \
      gemini extensions install "${EXTENSION_URL}"
    return 0
  fi

  log "SKIP Antigravity/Gemini CLI (neither agy nor gemini found on PATH)"
  skipped=$(( skipped + 1 ))
  return 0
}

install_copilot() {
  if ! have copilot; then
    log "SKIP Copilot CLI (copilot not found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  if host_lists_plugin copilot plugin; then
    log "OK   Copilot CLI already lists ponytail (copilot plugin list)"
    return 0
  fi

  step "Copilot: copilot plugin marketplace add ${MARKETPLACE}" \
    copilot plugin marketplace add "${MARKETPLACE}"
  step "Copilot: copilot plugin install ${PLUGIN_REF}" \
    copilot plugin install "${PLUGIN_REF}"
}

# OpenCode documents its global config as opencode.json under the XDG config home.
opencode_config_path() {
  if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
    printf '%s/opencode/opencode.json' "${XDG_CONFIG_HOME}"
  else
    printf '%s/.config/opencode/opencode.json' "${HOME}"
  fi
}

install_opencode() {
  if ! have opencode; then
    log "SKIP OpenCode CLI (opencode not found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  local config
  config="$(opencode_config_path)"

  if ! have node; then
    log "FAIL OpenCode: node is missing, cannot edit ${config} safely"
    failures=$(( failures + 1 ))
    return 0
  fi

  # Additive edit of one key. The parsed config is written back unchanged apart
  # from `plugin`, and the file is only written when the entry is missing. A
  # config that is not plain JSON (comments make JSON.parse throw) is reported
  # and left untouched rather than rewritten from a partial read.
  local result status=0
  result="$(node -e '
var fs = require("node:fs");
var path = require("node:path");
var configPath = process.argv[1];
var plugin = process.argv[2];
var raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
var config;
try {
  config = raw.replace(/^\uFEFF/, "").trim() === "" ? {} : JSON.parse(raw.replace(/^\uFEFF/, ""));
} catch (error) {
  console.error("config is not plain JSON (comments or a syntax error), leaving it alone: " + configPath + " - " + error.message);
  process.exit(2);
}
if (config === null || typeof config !== "object" || Array.isArray(config)) {
  console.error("config root is not a JSON object: " + configPath);
  process.exit(2);
}
var plugins = config.plugin;
if (plugins !== undefined && !Array.isArray(plugins)) {
  console.error("config.plugin is not an array: " + configPath);
  process.exit(2);
}
if (Array.isArray(plugins) && plugins.indexOf(plugin) !== -1) {
  console.log("already");
  process.exit(0);
}
config.plugin = (Array.isArray(plugins) ? plugins : []).concat([plugin]);
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("added");
' "${config}" "${OPENCODE_PLUGIN}")" || status=$?

  if [[ "${status}" -ne 0 ]]; then
    log "FAIL OpenCode: could not update ${config} (see the error above)"
    failures=$(( failures + 1 ))
    return 0
  fi

  if [[ "${result}" == "already" ]]; then
    log "OK   OpenCode already lists ${OPENCODE_PLUGIN} (${config})"
  else
    log "OK   OpenCode: added ${OPENCODE_PLUGIN} to ${config}"
  fi
}

report_claude_code() {
  local suffix=""
  if ! have claude; then
    suffix=" (claude not found on PATH)"
  fi
  log "MANUAL Claude Code${suffix}: send these two prompts separately"
  log "         /plugin marketplace add ${MARKETPLACE}"
  log "         /plugin install ${PLUGIN_REF}"
}

main() {
  log "Installing ponytail (${MARKETPLACE}) for every agent CLI found on PATH"
  install_codex
  install_antigravity_or_gemini
  install_copilot
  install_opencode
  report_claude_code
  log "pi is not handled here: pi/agent/pi-packages.txt drives it (setup-ai pi-packages)"
  log "Summary: ${skipped} host(s) skipped, ${failures} step failure(s)"

  if [[ "${failures}" -gt 0 ]]; then
    log "Fix the FAIL lines above and re-run; every step is safe to repeat."
    exit 1
  fi

  log "Done. Start a new session in each host so it loads the extension."
}

main "$@"
