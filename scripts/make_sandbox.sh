#!/usr/bin/env bash
# make_sandbox.sh — S0 (T-309): create TWO throwaway harness-project skeletons
# so engine/path changes can be tested WITHOUT touching the live Harness Agent repo.
#
# Guarantees:
#   - idempotent (safe to re-run; existing seed files are left alone)
#   - writes ONLY under $SBX_ROOT (never the live repo)
#   - does NOT copy engine scripts here — that is S5 (machine-install); S0 only
#     builds minimal PROJECT skeletons to point engine scripts at.
#
# Two projects (proj-A, proj-B) are required so S3/S4 can prove cross-project
# isolation (user knowledge shared across both, project indexes stay separate).
set -euo pipefail

SBX_ROOT="${SBX_ROOT:-/tmp/harness-sbx}"
PROJECTS=("proj-A" "proj-B")

make_one() {
  local name="$1"
  local root="$SBX_ROOT/$name"
  mkdir -p "$root"/{knowledge,.sessions,docs,scripts,src}

  # seed-empty PROJECT-FRESH indexes — zero carryover from Harness Agent
  [ -f "$root/knowledge/index_files.json" ]     || printf '{"files":{}}\n'     > "$root/knowledge/index_files.json"
  [ -f "$root/knowledge/index_variables.json" ] || printf '{"variables":{}}\n' > "$root/knowledge/index_variables.json"
  [ -f "$root/knowledge/topic_registry.json" ]  || printf '{"topics":{}}\n'    > "$root/knowledge/topic_registry.json"

  # marker so scripts / humans can tell this is a sandbox, NOT the live repo
  printf 'SANDBOX=%s\ncreated_by=make_sandbox.sh (T-309 S0)\n' "$name" > "$root/.harness_sandbox"

  # make it a git repo so `git rev-parse --show-toplevel` resolves to THIS dir
  # (several engine scripts fall back to git rev-parse for PROJECT_ROOT)
  if [ ! -d "$root/.git" ]; then
    git -C "$root" init -q
    git -C "$root" add -A
    git -C "$root" -c user.name=sbx -c user.email=sbx@local commit -qm "sandbox skeleton" >/dev/null 2>&1 || true
  fi

  echo "  [ok] $root"
}

echo "make_sandbox.sh -> $SBX_ROOT"
for p in "${PROJECTS[@]}"; do make_one "$p"; done
echo "done: ${#PROJECTS[@]} isolated sandbox projects (no live-repo files touched)"
