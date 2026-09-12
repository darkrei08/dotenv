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
# Shared design skills, driven through their own upstream installers:
#   design-taste     h3nryprod01/design-taste, installed with the agent-skills CLI
#                    (`npx skills add`) for every agent CLI present on PATH.
#                    Mixed license (MIT + Apache-2.0), see the upstream NOTICE.
#   impeccable       pbakaus/impeccable, installed with its own installer
#                    (`npx impeccable install --providers=... --scope=global`) for every
#                    harness of its supported list that is present. Apache-2.0. The
#                    installer downloads its engine binary into ~/.impeccable/bin on the
#                    first run and installs harness hooks where the harness supports them.
#                    It writes its project hook manifest for the current directory, so it
#                    runs in a scratch directory: project hooks belong to a project.
#
# Local skills this repository ships as files, copied into every agent skills root:
#   phantom-ui       agents/skills/phantom-ui (skill plus the MIT standalone build,
#                    provenance in its VENDORED.md), because it is a component library
#                    with no upstream skill to install.
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

DESIGN_TASTE_SOURCE="h3nryprod01/design-taste"
SKILLS_CLI="skills@latest"
IMPECCABLE_CLI="impeccable"

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

# OpenCode documents its global config under the XDG config home.
opencode_config_dir() {
  if [[ -n "${XDG_CONFIG_HOME:-}" ]]; then
    printf '%s/opencode' "${XDG_CONFIG_HOME}"
  else
    printf '%s/.config/opencode' "${HOME}"
  fi
}

opencode_config_path() {
  printf '%s/opencode.json' "$(opencode_config_dir)"
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

# --- local skills --------------------------------------------------------------------
#
# Skills this repository owns as files, rather than ones an upstream installer places.
# Each is copied into every agent skills root that exists on this machine, so all CLIs
# read the same text. A destination that already matches is left alone, and an agent
# whose config directory is absent is never touched.

# Global skills shipped under agents/skills/.
LOCAL_SKILLS=(phantom-ui)

# Directory holding an agent's own config, used to decide whether that agent exists.
agent_config_dir() {
  case "$1" in
    claude-code) printf '%s/.claude' "${HOME}" ;;
    codex) printf '%s/.codex' "${HOME}" ;;
    gemini-cli) printf '%s/.gemini' "${HOME}" ;;
    cursor) printf '%s/.cursor' "${HOME}" ;;
    antigravity) printf '%s/.antigravity' "${HOME}" ;;
    opencode) opencode_config_dir ;;
    pi) printf '%s/.pi/agent' "${HOME}" ;;
    *) return 1 ;;
  esac
}

# Every skills root this script writes to: one per installed agent, plus the shared root
# the upstream skills CLI uses as well.
local_skill_roots() {
  local agent config
  for agent in claude-code codex gemini-cli cursor antigravity opencode pi; do
    config="$(agent_config_dir "${agent}")" || continue
    if [[ -d "${config}" ]]; then
      printf '%s/skills\n' "${config}"
    fi
  done
  printf '%s/.agents/skills\n' "${HOME}"
}

repo_skill_dir() {
  printf '%s/skills/%s' "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" "$1"
}

install_local_skill() {
  local skill="$1" src root dest
  src="$(repo_skill_dir "${skill}")"
  if [[ ! -d "${src}" ]]; then
    log "FAIL ${skill}: repository copy not found (${src})"
    failures=$(( failures + 1 ))
    return 0
  fi

  while IFS= read -r root; do
    dest="${root}/${skill}"
    if [[ -d "${dest}" ]] && diff -rq "${src}" "${dest}" >/dev/null 2>&1; then
      log "OK   ${skill} already current in ${root}"
      continue
    fi
    # Replace only on a difference, so a stale copy cannot survive a refresh.
    if ! mkdir -p "${root}" || ! rm -rf "${dest}" || ! cp -R "${src}" "${dest}"; then
      log "FAIL ${skill}: could not install into ${root}"
      failures=$(( failures + 1 ))
      continue
    fi
    log "OK   ${skill} installed into ${root}"
  done < <(local_skill_roots)
}

install_local_skills() {
  local skill
  for skill in "${LOCAL_SKILLS[@]}"; do
    install_local_skill "${skill}"
  done
}

# --- shared design skills ------------------------------------------------------------
#
# design-taste and impeccable are upstream distributions, so this script drives the
# installers their own documentation names instead of vendoring their files: the
# agent-skills CLI for design-taste, and impeccable's installer for impeccable. Both
# are asked to cover every agent CLI found on PATH, and both are safe to re-run.

# Agent name the `skills` CLI expects for an installed CLI binary.
skill_agent_for_cli() {
  case "$1" in
    claude) printf 'claude-code' ;;
    codex) printf 'codex' ;;
    gemini) printf 'gemini-cli' ;;
    agy) printf 'antigravity' ;;
    cursor) printf 'cursor' ;;
    opencode) printf 'opencode' ;;
    pi) printf 'pi' ;;
    *) return 1 ;;
  esac
}

# Provider name `impeccable install` expects for an installed CLI binary. Those names
# differ from the binaries: Copilot ships as the `github` provider, `agy` as `gemini`.
impeccable_provider_for_cli() {
  case "$1" in
    claude) printf 'claude' ;;
    codex) printf 'codex' ;;
    gemini | agy) printf 'gemini' ;;
    cursor) printf 'cursor' ;;
    copilot) printf 'github' ;;
    opencode) printf 'opencode' ;;
    pi) printf 'pi' ;;
    *) return 1 ;;
  esac
}

# Every agent CLI present on PATH, mapped to the name its installer expects. An agent
# whose CLI is missing is simply not listed, so a machine without it is not a failure.
detected_skill_agents() {
  local cli agent
  for cli in claude codex gemini agy cursor opencode pi; do
    have "${cli}" || continue
    agent="$(skill_agent_for_cli "${cli}")" || continue
    printf '%s\n' "${agent}"
  done
}

# Deduplicated provider list for impeccable, because `agy` and `gemini` are one provider.
detected_impeccable_providers() {
  local cli provider found=""
  for cli in claude codex gemini agy cursor copilot opencode pi; do
    have "${cli}" || continue
    provider="$(impeccable_provider_for_cli "${cli}")" || continue
    case ",${found}," in
      *",${provider},"*) continue ;;
    esac
    found="${found:+${found},}${provider}"
  done
  printf '%s' "${found}"
}

# stdin is /dev/null so an installer that expects a terminal cannot stall an unattended
# run; both installers accept the flags above instead of asking.
install_design_taste_for_agent() {
  local agent="$1"
  npx --yes "${SKILLS_CLI}" add "${DESIGN_TASTE_SOURCE}" --global --agent "${agent}" --copy --yes </dev/null
}

install_impeccable_for_providers() {
  local providers="$1" scratch status=0
  # The installer always writes its provider-native hook manifest for the CURRENT
  # PROJECT, whatever the scope is. This script installs globally, so it runs in a
  # scratch directory instead of leaving a hook manifest in whatever directory it
  # happened to be called from; enabling project hooks stays a per-project decision
  # (`npx impeccable install` inside that project).
  scratch="$(mktemp -d)"
  ( cd "${scratch}" && npx --yes "${IMPECCABLE_CLI}" install --providers="${providers}" --scope=global </dev/null ) || status=$?
  rm -rf "${scratch}"
  return "${status}"
}

install_design_taste() {
  if ! have npx; then
    log "SKIP design-taste (npx not found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  local agents agent
  agents="$(detected_skill_agents)"
  if [[ -z "${agents}" ]]; then
    log "SKIP design-taste (no agent CLI found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  while IFS= read -r agent; do
    step "design-taste: skills add ${DESIGN_TASTE_SOURCE} for ${agent}" \
      install_design_taste_for_agent "${agent}"
  done <<< "${agents}"
}

install_impeccable() {
  if ! have npx; then
    log "SKIP impeccable (npx not found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  local providers
  providers="$(detected_impeccable_providers)"
  if [[ -z "${providers}" ]]; then
    log "SKIP impeccable (no harness it supports found on PATH)"
    skipped=$(( skipped + 1 ))
    return 0
  fi

  step "impeccable: install --providers=${providers} --scope=global" \
    install_impeccable_for_providers "${providers}"
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
  log "pi is not handled here for ponytail: pi/agent/pi-packages.txt drives it (setup-ai pi-packages)"
  log "Installing the shared design skills for every agent CLI found on PATH"
  install_design_taste
  install_impeccable
  log "Installing the skills this repository ships for every agent found on PATH"
  install_local_skills
  log "Summary: ${skipped} host(s) skipped, ${failures} step failure(s)"

  if [[ "${failures}" -gt 0 ]]; then
    log "Fix the FAIL lines above and re-run; every step is safe to repeat."
    exit 1
  fi

  log "Done. Start a new session in each host so it loads the extension."
}

main "$@"
