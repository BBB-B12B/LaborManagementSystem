#!/usr/bin/env bash
# machine_install.sh — T-309 · Section 5 (machine-install track)
#
# Install the harness ENGINE once, machine-wide, so many projects share ONE copy
# of the engine code (scripts/ + .agents/) with NO per-project duplication.
#
# What is the "engine"?  The code + docs that are identical for every project:
#   - scripts/                (all hook/boot/track/gate scripts + sys_fixed_base.txt)
#   - .agents/                (skills, platform detection, skill manifest)
#   - Implement/              (constitution single-source detail — CLAUDE.md/AGENTS.md point here)
#   - docs/session_templates/ (session-file + schema templates read at runtime, e.g. M3 schema)
#   - CLAUDE.md AGENTS.md INVARIANTS.md domain/_TEMPLATE.md  (ENGINE_FILES, below)
#   - knowledge/<engine specs>  (ONLY the subset listed in scripts/knowledge_engine.manifest —
#     loop specs, rubric, glossary, skill specs; the source project_init.seed_knowledge_specs
#     copies into each project. NOT the whole knowledge/ dir.)
# What is NOT copied (each project owns its own — see project_init.py):
#   - knowledge/<project-state> (index_*.json, cfp_*, error_*, out_of_scope, research notes,
#     harness_flow_2026*) · .sessions/ · src/ · docs/ top-level (docs/master_roadmap.md etc.)
#
# Guarantees
#   - COPY, not move: the source repo stays fully intact.
#   - Idempotent: re-running copies only changed files; a second run shows no diff.
#     (rsync without --delete: we never remove files the target already had — so
#      installing into ~/.claude/ never touches the user's own global config.)
#   - R14 gate: writing to the REAL ~/.claude requires an explicit --confirm flag.
#     Any other target (e.g. a ~/.claude-test sandbox) installs freely.
#
# Usage
#   bash scripts/machine_install.sh [TARGET_ENGINE_ROOT] [--dry-run] [--confirm]
#   TARGET_ENGINE_ROOT defaults to ~/.claude
#
#   # safe sandbox test (Verify-6):
#   bash scripts/machine_install.sh ~/.claude-test
#   # real machine install (R14 — explicit consent required):
#   bash scripts/machine_install.sh --confirm
#
# After install, point projects at the engine with:
#   export HARNESS_ENGINE_ROOT="$TARGET_ENGINE_ROOT"
# (boot_init.sh + settings.json hooks honor it; unset => self-hosted, unchanged.)
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
# normalize to an absolute path without requiring the dir to exist yet
TARGET="$(cd "$(dirname "$TARGET")" 2>/dev/null && printf '%s/%s' "$(pwd)" "$(basename "$TARGET")" || echo "$TARGET")"

# R14 destructive gate: the real ~/.claude is the user's live global config.
REAL_CLAUDE="$(cd "$HOME" && pwd)/.claude"
if [ "$TARGET" = "$REAL_CLAUDE" ] && [ "$CONFIRM" != true ] && [ "$DRY_RUN" != true ]; then
  echo "[gate] Action: install engine into the REAL $TARGET" >&2
  echo "[gate] Risk: writes into your live Claude config home (additive: scripts/ + .agents/ only, no delete)" >&2
  echo "[gate] Waiting: re-run with --confirm to proceed, or pass a sandbox target like ~/.claude-test" >&2
  exit 3
fi

# engine file-list — SINGLE SOURCE: scripts/engine_manifest.txt (T-348 · S4).
# Both this installer AND scripts/harness_sync.py read it, so "what is an engine
# file" is never duplicated across bash + python. Format: one entry per line,
# `dir:<path>` (copy CONTENTS into target/<name>/) or `file:<path>` (single file);
# `#`/blank lines ignored. What each entry means + why (Implement/ = constitution
# detail, only domain/_TEMPLATE.md ships, etc.) is documented IN the manifest.
# knowledge specs stay in scripts/knowledge_engine.manifest (read further below).
EMANIFEST="$SRC/scripts/engine_manifest.txt"
ENGINE_DIRS=()
ENGINE_FILES=()
if [ -f "$EMANIFEST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*)  continue ;;
      dir:*)   ENGINE_DIRS+=("${line#dir:}") ;;
      file:*)  ENGINE_FILES+=("${line#file:}") ;;
      *)       echo "  [warn] engine_manifest.txt: unrecognized line '$line' — skipped" >&2 ;;
    esac
  done < "$EMANIFEST"
else
  echo "[fatal] engine manifest missing: $EMANIFEST — cannot resolve engine file-list" >&2
  exit 2
fi

RSYNC_FLAGS=(-a)
$DRY_RUN && RSYNC_FLAGS+=(-n -i)

# Portability: plain Git-Bash-on-Windows commonly has no rsync. Fall back to a
# cp -a based copy (still additive/no-delete) so the installer works there too.
if command -v rsync >/dev/null 2>&1; then
  HAVE_RSYNC=true
else
  HAVE_RSYNC=false
  echo "  [note] rsync not found on PATH — using cp fallback (additive copy, same as rsync -a)" >&2
fi

# sync_dir SRC_DIR/ TARGET_DIR/  — copies CONTENTS of SRC_DIR into TARGET_DIR.
sync_dir() {
  local src="$1" dst="$2"
  if $HAVE_RSYNC; then
    rsync "${RSYNC_FLAGS[@]}" "$src" "$dst"
  elif $DRY_RUN; then
    echo "  [dry-run] would copy contents: $src -> $dst"
  else
    mkdir -p "$dst"
    cp -a "$src." "$dst"
  fi
}

# sync_file SRC_FILE TARGET_FILE
sync_file() {
  local src="$1" dst="$2"
  if $HAVE_RSYNC; then
    rsync "${RSYNC_FLAGS[@]}" "$src" "$dst"
  elif $DRY_RUN; then
    echo "  [dry-run] would copy: $src -> $dst"
  else
    mkdir -p "$(dirname "$dst")"
    cp -a "$src" "$dst"
  fi
}

echo "machine_install: SRC=$SRC"
echo "machine_install: TARGET=$TARGET  (dry-run=$DRY_RUN)"
$DRY_RUN || mkdir -p "$TARGET"

for d in "${ENGINE_DIRS[@]}"; do
  if [ ! -d "$SRC/$d" ]; then
    echo "  [skip] $d absent in source" >&2
    continue
  fi
  $DRY_RUN || mkdir -p "$TARGET/$d"
  # trailing slashes: copy the CONTENTS of SRC/d into TARGET/d (no nested dup dir).
  # no --delete => never remove pre-existing files in the user's target.
  sync_dir "$SRC/$d/" "$TARGET/$d/"
  echo "  [ok] $d -> $TARGET/$d"
done

for f in "${ENGINE_FILES[@]}"; do
  if [ ! -f "$SRC/$f" ]; then
    echo "  [skip] $f absent in source" >&2
    continue
  fi
  # rsync -a (or cp -a fallback) updates these engine files in place; additive
  # install leaves the target's other files untouched. mkdir the parent so
  # nested files (domain/*) land.
  $DRY_RUN || mkdir -p "$(dirname "$TARGET/$f")"
  sync_file "$SRC/$f" "$TARGET/$f"
  echo "  [ok] $f -> $TARGET/$f"
done

# engine knowledge specs — ONLY the subset a consumer needs at runtime (loop specs, rubric,
# glossary, skill specs). The list lives in scripts/knowledge_engine.manifest (single source;
# also read by project_init.seed_knowledge_specs). This populates engine_root/knowledge so
# project_init has a source to seed each project from. project-state + research notes are NOT
# installed. Guarded for `set -euo pipefail`: the missing-spec warn uses `if`, never a bare grep.
KMANIFEST="$SRC/scripts/knowledge_engine.manifest"
if [ -f "$KMANIFEST" ]; then
  $DRY_RUN || mkdir -p "$TARGET/knowledge"
  while IFS= read -r kf || [ -n "$kf" ]; do
    case "$kf" in ''|\#*) continue ;; esac
    if [ ! -f "$SRC/knowledge/$kf" ]; then
      echo "  [warn] manifest lists knowledge/$kf but it is missing from source — skipped" >&2
      continue
    fi
    sync_file "$SRC/knowledge/$kf" "$TARGET/knowledge/$kf"
    echo "  [ok] knowledge/$kf -> $TARGET/knowledge/$kf"
  done < "$KMANIFEST"
else
  echo "  [skip] $KMANIFEST absent — no engine knowledge specs installed" >&2
fi

# T-339 (fixes the T-338 S3 seed): the machine-wide command-access baseline lives in the
# USER-GLOBAL settings. Claude Code reads GLOBAL settings ONLY from $HOME/.claude/settings.json
# — NOT from the engine root ($TARGET). So seed that fixed path (reusing REAL_CLAUDE, computed
# above = "$HOME/.claude"), and ONLY for a real ~/.claude install: a sandbox/custom-target
# engine install must never mutate the user's real global config (mirrors the REAL_CLAUDE
# --confirm gate above). ADDITIVE + fail-soft. Before T-339 this seeded "$TARGET/settings.json",
# which is a file Claude never reads whenever TARGET != ~/.claude → the seed was silently dead.
GLOBAL_SETTINGS="$REAL_CLAUDE/settings.json"
SEEDER="$SRC/scripts/seed_permissions.py"
if $DRY_RUN; then
  if [ -f "$SEEDER" ] && [ "$TARGET" = "$REAL_CLAUDE" ]; then
    echo "  [dry-run] would seed machine-wide permission baseline -> $GLOBAL_SETTINGS:"
    python3 "$SEEDER" "$GLOBAL_SETTINGS" --dry-run 2>/dev/null || true
  elif [ -f "$SEEDER" ]; then
    echo "  [dry-run] permission baseline NOT seeded (custom/sandbox target — Claude reads only $GLOBAL_SETTINGS)"
  fi
  echo "dry-run complete (no files written)."
else
  # T-337: record the source clone path so version_check Layer C can detect updates
  # on this machine-installed engine ($TARGET is an rsync copy with no .git of its own;
  # $SRC is the git clone the user ran `git pull` in, so it has .git + a remote).
  printf '%s\n' "$SRC" > "$TARGET/.harness_source"
  echo "  [ok] recorded source clone -> $TARGET/.harness_source (update detection)"
  if [ -f "$SEEDER" ] && [ "$TARGET" = "$REAL_CLAUDE" ]; then
    python3 "$SEEDER" "$GLOBAL_SETTINGS" \
      || echo "  [warn] permission-baseline seed skipped (non-fatal)" >&2
  elif [ -f "$SEEDER" ]; then
    echo "  [note] permission baseline NOT seeded (custom/sandbox target — Claude reads only $GLOBAL_SETTINGS)"
  fi
  echo "done. engine installed at: $TARGET"
  echo "next: export HARNESS_ENGINE_ROOT=\"$TARGET\"  (per project: also set CLAUDE_PROJECT_DIR)"
fi
