#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [--replace] [--profile NAME] [REPOSITORY]\n' "$0" >&2
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
profile=reviewer
replace=0
repo_arg=.
repo_arg_set=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      profile=$2
      shift 2
      ;;
    --replace)
      replace=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      printf 'Unknown option: %s\n' "$1" >&2
      usage
      exit 2
      ;;
    *)
      [ "$repo_arg_set" -eq 0 ] || { printf 'Only one repository may be supplied\n' >&2; exit 2; }
      repo_arg=$1
      repo_arg_set=1
      shift
      ;;
  esac
done

profile_path="$script_dir/profiles/$profile.gga"
[ -f "$profile_path" ] || { printf 'GGA profile not found: %s\n' "$profile_path" >&2; exit 2; }
command -v git >/dev/null 2>&1 || { printf 'git is required\n' >&2; exit 127; }
repo_root=$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null) || {
  printf 'Not a Git repository: %s\n' "$repo_arg" >&2
  exit 2
}
repo_root=$(cd -- "$repo_root" && pwd)

backup_path() {
  local target=$1 candidate="$1.local"
  if [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; then
    printf '%s\n' "$candidate"
    return
  fi
  local index=1
  while :; do
    candidate="$1.local.$index"
    if [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
    index=$((index + 1))
  done
}

link_path() {
  local target=$1 source=$2 label=$3 target_dir desired
  target_dir=$(dirname -- "$target")
  desired=$(realpath --relative-to="$target_dir" -- "$source")
  if [ -L "$target" ]; then
    if [ "$(readlink -f -- "$target")" = "$(readlink -f -- "$source")" ]; then
      if [ "$(readlink -- "$target")" = "$desired" ]; then
        return
      fi
      rm -f -- "$target"
    elif [ "$replace" -ne 1 ]; then
      printf '%s already exists: %s (use --replace to preserve it as a .local backup)\n' "$label" "$target" >&2
      exit 2
    fi
  elif [ -e "$target" ] && [ "$replace" -ne 1 ]; then
    printf '%s already exists: %s (use --replace to preserve it as a .local backup)\n' "$label" "$target" >&2
    exit 2
  fi
  if [ -e "$target" ] || [ -L "$target" ]; then
    local backup
    backup=$(backup_path "$target")
    mv -- "$target" "$backup"
    printf 'Backed up %s to %s\n' "$target" "$backup"
  fi
  ln -s -- "$desired" "$target"
}

command -v gga >/dev/null 2>&1 || { printf 'gga is required to install the pre-commit hook\n' >&2; exit 127; }

link_path "$repo_root/.gga" "$profile_path" '.gga profile'
source_repo=$(cd -- "$script_dir/../.." && pwd)
if [ "$repo_root" != "$source_repo" ]; then
  mkdir -p "$repo_root/agents"
  link_path "$repo_root/agents/gga-pi" "$script_dir" 'Pi GGA bridge'
fi

git_common_dir=$(git -C "$repo_root" rev-parse --git-common-dir)
case "$git_common_dir" in
  /*) ;;
  *) git_common_dir="$repo_root/$git_common_dir" ;;
esac
hook="$git_common_dir/hooks/pre-commit"
if [ ! -e "$hook" ]; then
  (cd -- "$repo_root" && gga install)
fi
[ -f "$hook" ] || { printf 'GGA did not create a pre-commit hook: %s\n' "$hook" >&2; exit 1; }

if ! grep -Fq 'agents/gga-pi/run-gga.sh' "$hook"; then
  tmp=$(mktemp "${hook}.XXXXXX")
  trap 'rm -f -- "$tmp"' EXIT
  awk '
    BEGIN { replaced = 0 }
    /^[[:space:]]*gga run([[:space:]]|$)/ {
      print "gga_pi=\"$(git rev-parse --show-toplevel)/agents/gga-pi/run-gga.sh\""
      print "if [ -x \"$gga_pi\" ]; then \"$gga_pi\" run || exit 1; else gga run || exit 1; fi"
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) {
        print ""
        print "# GGA Pi bridge"
        print "gga_pi=\"$(git rev-parse --show-toplevel)/agents/gga-pi/run-gga.sh\""
        print "if [ -x \"$gga_pi\" ]; then \"$gga_pi\" run || exit 1; else gga run || exit 1; fi"
      }
    }
  ' "$hook" > "$tmp"
  chmod --reference="$hook" "$tmp"
  mv -- "$tmp" "$hook"
  trap - EXIT
fi

printf 'Initialized shared GGA profile in %s\n' "$repo_root"
