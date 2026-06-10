#!/usr/bin/env python3
"""
session_compactor.py — Session Health Gate

Validates that .sessions/ is in a healthy state before git commit/push.
Called by identity/SKILL.md Fatal Constraint.

Exit codes:
  0 → STATUS: OK   (all checks pass — safe to commit)
  1 → STATUS: FAIL (one or more checks failed — do not commit)

Usage:
  python3 scripts/session_compactor.py          # check + print STATUS
  python3 scripts/session_compactor.py --verbose # detailed check output
"""

import sys
import argparse
from pathlib import Path

SESSIONS_DIR = Path(".sessions")

# Required files and their minimum required fields/patterns
REQUIRED_FILES = {
    "active_thread.md": ["task:", "phase:", "next:"],
    # CHAT_TOTAL lives here — chat_tokens.md removed (was a duplicate of this field · BUG-2)
    "session_tokens.md": ["SESSION_TOTAL:", "CHAT_TOTAL:", "CACHE_READ:", "CACHE_WRITE:"],
}

# Files that must exist (but content not strictly validated)
MUST_EXIST = [
    "active_thread.md",
    "session_tokens.md",
    "mece_plan.md",
    "gather_complete.md",
    "session_handoff.md",
    "compact_state.md",
    "self_improve_log.md",
    "session_context_cache.md",  # written by Stop hook (write_context_cache.sh)
    "token_log.jsonl",           # per-turn telemetry (T-053)
]

# Blocking conditions: phase must NOT be in_progress on commit
# (in_progress = unfinished task = unsafe to commit)
PHASE_BLOCK = "in_progress"


def check(verbose=False):
    failures = []

    # 1. .sessions/ directory must exist
    if not SESSIONS_DIR.exists():
        failures.append(".sessions/ directory missing — run: python3 scripts/bootstrap_sessions.py")
        return failures

    # 2. All required files must exist
    for fname in MUST_EXIST:
        fpath = SESSIONS_DIR / fname
        if not fpath.exists():
            failures.append(f"MISSING: .sessions/{fname} — run: python3 scripts/bootstrap_sessions.py")
        elif verbose:
            print(f"  [✓] .sessions/{fname} exists")

    # 3. Required field checks
    for fname, required_fields in REQUIRED_FILES.items():
        fpath = SESSIONS_DIR / fname
        if not fpath.exists():
            continue  # already flagged above
        content = fpath.read_text()
        for field in required_fields:
            if field not in content:
                failures.append(f".sessions/{fname} missing field: {field}")
            elif verbose:
                print(f"  [✓] .sessions/{fname} has '{field}'")

    # 4. active_thread.md phase must not be in_progress
    active = SESSIONS_DIR / "active_thread.md"
    if active.exists():
        content = active.read_text()
        for line in content.splitlines():
            if line.startswith("phase:"):
                phase = line.split(":", 1)[1].strip()
                if phase == PHASE_BLOCK:
                    failures.append(
                        f"active_thread.md phase: in_progress — task not closed. "
                        f"Run session_manager §3 close sequence before committing."
                    )
                elif verbose:
                    print(f"  [✓] active_thread.md phase: {phase} (safe to commit)")

    return failures


def main():
    parser = argparse.ArgumentParser(description="Session health gate before git commit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed check results")
    args = parser.parse_args()

    if args.verbose:
        print("[session_compactor] Checking .sessions/ health...")

    failures = check(verbose=args.verbose)

    if failures:
        print("\nSTATUS: FAIL")
        for f in failures:
            print(f"  ✗ {f}")
        sys.exit(1)
    else:
        if args.verbose:
            print()
        print("STATUS: OK")
        sys.exit(0)


if __name__ == "__main__":
    main()
