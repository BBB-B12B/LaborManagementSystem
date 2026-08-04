#!/usr/bin/env bash
# harness_uninstall.sh — T-312 · the reverse of machine_install.sh.
#
# machine_install.sh COPIES the engine (scripts/ + .agents/) into a target with
# `rsync -a` and NO --delete, so it is purely additive. This uninstaller is the
# additive-safe reversal: it removes ONLY the engine files the harness installed
# (i.e. files that exist in THIS repo's scripts/ + .agents/), and leaves every
# pre-existing / non-harness file and all project data untouched.
#
# What it removes from TARGET:
#   - for each file present in SRC/scripts/  -> delete TARGET/scripts/<same path>
#   - for each file present in SRC/.agents/  -> delete TARGET/.agents/<same path>
#   - empty engine dirs left behind are pruned; non-empty dirs (holding the
#     user's own files) are kept.
# What it NEVER touches:
#   - knowledge/ .sessions/ docs/ CLAUDE.md AGENTS.md src/  (PROJECT data)
#   - any file in TARGET that is NOT part of the engine source (user's own files)
#
# R14 destructive gate
#   - refuses to operate on the REAL ~/.claude without an explicit --confirm flag.
#   - any other target (e.g. a mktemp sandbox) uninstalls freely.
#
# Usage
#   bash scripts/harness_uninstall.sh [TARGET_ENGINE_ROOT] [--dry-run] [--confirm]
#   TARGET_ENGINE_ROOT defaults to ~/.claude
set -euo pipefail

# SRC = the engine source repo = dir two levels above this script (scripts/ -> repo).
SRC="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

TARGET=""
DRY_RUN=false
CONFIRM=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --confirm) CONFIRM=true ;;
    -*)        echo "unknown flag: $arg" >&2; exit 2 ;;
    *)         TARGET="$arg" ;;
  esac
done
TARGET="${TARGET:-$HOME/.claude}"
TARGET="$(cd "$(dirname "$TARGET")" 2>/dev/null && printf '%s/%s' "$(pwd)" "$(basename "$TARGET")" || echo "$TARGET")"

# R14 destructive gate: the real ~/.claude is the user's live global config.
REAL_CLAUDE="$(cd "$HOME" && pwd)/.claude"
if [ "$TARGET" = "$REAL_CLAUDE" ] && [ "$CONFIRM" != true ]; then
  echo "[gate] Action: uninstall engine from the REAL $TARGET" >&2
  echo "[gate] Risk: deletes harness engine files from your live Claude config home" >&2
  echo "[gate] Waiting: re-run with --confirm to proceed, or pass a sandbox target like ~/.claude-test" >&2
  exit 3
fi

if [ "$TARGET" = "$SRC" ]; then
  echo "[refuse] TARGET resolves to the engine source repo itself — refusing to self-delete." >&2
  exit 4
fi

# engine dirs to sweep — SINGLE SOURCE: scripts/engine_manifest.txt `dir:` entries
# (T-348 · S6). Same list machine_install.sh installs + harness_sync.py ports, so
# uninstall removes EXACTLY what the engine ships: scripts, .agents, Implement,
# docs/session_templates. Before T-348 this was hardcoded (scripts .agents), so a
# stale local Implement/ copy could never be swept — the T-348 gap. The manifest
# `file:` entries (CLAUDE.md/AGENTS.md/INVARIANTS.md/domain/_TEMPLATE.md) are
# deliberately NOT swept: under Model B a project keeps its own copies of those
# (client-auto-loaded / merge-managed). Fallback to the historical set if the
# manifest is somehow absent — never sweep MORE than before on a missing manifest.
EMANIFEST="$SRC/scripts/engine_manifest.txt"
ENGINE_DIRS=()
if [ -f "$EMANIFEST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      dir:*) ENGINE_DIRS+=("${line#dir:}") ;;
    esac
  done < "$EMANIFEST"
fi
[ ${#ENGINE_DIRS[@]} -eq 0 ] && ENGINE_DIRS=(scripts .agents)

echo "harness_uninstall: SRC=$SRC"
echo "harness_uninstall: TARGET=$TARGET  (dry-run=$DRY_RUN)"

removed=0
kept_dirs=0
for d in "${ENGINE_DIRS[@]}"; do
  [ -d "$SRC/$d" ] || { echo "  [skip] $d absent in source"; continue; }
  [ -d "$TARGET/$d" ] || { echo "  [skip] $TARGET/$d not present"; continue; }

  # Delete only files that the engine source defines (relative paths under SRC/$d).
  while IFS= read -r rel; do
    tf="$TARGET/$d/$rel"
    if [ -f "$tf" ]; then
      if $DRY_RUN; then
        echo "  [dry] would remove $tf"
      else
        rm -f "$tf"
        echo "  [rm] $tf"
      fi
      removed=$((removed+1))
    fi
  done < <(cd "$SRC/$d" && find . -type f -not -name '._*' | sed 's|^\./||')

  # Prune now-empty engine dirs; keep any dir that still holds user files.
  if ! $DRY_RUN; then
    find "$TARGET/$d" -depth -type d -empty -delete 2>/dev/null || true
    if [ -d "$TARGET/$d" ]; then
      kept_dirs=$((kept_dirs+1))
      echo "  [keep] $TARGET/$d — still holds non-harness files"
    else
      echo "  [pruned] $TARGET/$d — empty after uninstall"
    fi
  fi
done

if $DRY_RUN; then
  echo "dry-run complete: would remove $removed engine file(s)."
else
  echo "done. removed $removed engine file(s); kept $kept_dirs non-empty engine dir(s). project data untouched."
fi
