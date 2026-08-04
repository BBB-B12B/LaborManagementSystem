#!/usr/bin/env bash
# harness_selftest.sh — T-312 · one-shot health check for a harness install.
#
# THIN wrapper only. It does NOT re-implement any checks — it SHELLS OUT to the
# three existing verifiers and aggregates their exit codes:
#   - verify_runner.py            (runs the Verify-N lines in mece_plan.md)
#   - repo_map_check.py           (REPO_MAP.md drift detector)
#   - loop_engineer_preflight.py  (headless-loop doorman / preflight)
#
# Contract
#   - prints one "PASS"/"FAIL" summary line per sub-verifier
#   - exits NON-ZERO if ANY sub-verifier exits non-zero (aggregate exit code)
#   - exits 0 only when every sub-verifier exited 0
#
# Usage
#   bash scripts/harness_selftest.sh
#   # engine-relative resolution honors HARNESS_ENGINE_ROOT (plugin: CLAUDE_PLUGIN_ROOT)
#
# Test hooks (used by the S6 propagation proof — normal runs ignore them):
#   HARNESS_SELFTEST_PLAN=/path/to/plan.md   # override the plan passed to verify_runner.py
set -uo pipefail

# ENGINE root = where the harness scripts live. Falls back to this script's repo,
# so self-hosted (unset) behavior is byte-identical to a machine/plugin install.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ENGINE="${HARNESS_ENGINE_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SCRIPTS="$ENGINE/scripts"

PLAN="${HARNESS_SELFTEST_PLAN:-}"

overall=0
run() {
  local label="$1"; shift
  "$@"
  local rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "[selftest] $label: PASS (exit 0)"
  else
    echo "[selftest] $label: FAIL (exit $rc)"
    overall=1
  fi
}

echo "[selftest] engine: $ENGINE"

# 1) Verify-N runner. --all runs every Verify-N line in the plan; non-zero on any FAIL.
if [ -n "$PLAN" ]; then
  run "verify_runner"           python3 "$SCRIPTS/verify_runner.py" --all --file "$PLAN"
else
  run "verify_runner"           python3 "$SCRIPTS/verify_runner.py" --all
fi

# 2) REPO_MAP drift detector (fail-safe: designed to exit 0; still aggregated).
run "repo_map_check"            python3 "$SCRIPTS/repo_map_check.py"

# 3) Headless-loop preflight doorman (0 on any clean decision; non-zero on real error).
run "loop_engineer_preflight"  python3 "$SCRIPTS/loop_engineer_preflight.py"

if [ "$overall" -eq 0 ]; then
  echo "[selftest] RESULT: PASS — all verifiers green"
else
  echo "[selftest] RESULT: FAIL — at least one verifier reported non-zero"
fi
exit "$overall"
