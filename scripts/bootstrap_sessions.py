#!/usr/bin/env python3
"""
bootstrap_sessions.py — Initialize .sessions/ from docs/session_templates/

Usage:
  python3 scripts/bootstrap_sessions.py           # create missing files only
  python3 scripts/bootstrap_sessions.py --force   # overwrite existing files
  python3 scripts/bootstrap_sessions.py --dry-run # list actions without writing

Purpose:
  On first clone or fresh environment, .sessions/ files may not exist.
  This script copies templates from docs/session_templates/ into .sessions/,
  skipping files that already exist (unless --force is set).

  Templates are in docs/session_templates/ — committed to repo.
  .sessions/ files are gitignored in TARGET projects (not this dev repo).

  For target project setup, see: Implement/02_setup.md §Step 5
  For gitignore context, see: Implement/03_config.md §Gitignore
"""

import argparse
import shutil
import sys
from pathlib import Path

TEMPLATES_DIR = Path("docs/session_templates")
SESSIONS_DIR  = Path(".sessions")

# Map: template filename → target filename in .sessions/
# Note: mece_plan_schema.md → mece_plan.md (schema file renamed to avoid hook trigger)
TEMPLATE_MAP = {
    "active_thread.md":    "active_thread.md",
    "session_tokens.md":   "session_tokens.md",
    "compact_state.md":    "compact_state.md",
    "gather_complete.md":  "gather_complete.md",
    "session_handoff.md":  "session_handoff.md",
    "self_improve_log.md": "self_improve_log.md",
    "mece_plan_schema.md": "mece_plan.md",
}

# Minimal content for files that should start blank (not with template schema comments)
CLEAN_INIT = {
    "active_thread.md":  "task: init\nphase: done\nnext: none\n",
    # 6 fields to match B1 boot format · LOOP_WEIGHT present from clone so PostToolUse hook + B1 normalization work (BUG-2/BUG-3)
    "session_tokens.md": "SESSION_TOTAL: 0\nCHAT_TOTAL: 0\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n",
    "self_improve_log.md": "# Self-Improve Log\n# Created by bootstrap_sessions.py\n",
    "token_log.jsonl":   "",  # empty — Stop hook appends JSON lines
    "session_memory.md": "# Auto-history cap summary\ndate: \nturns_summarized: 0\ncontent:\n",
}


def main():
    parser = argparse.ArgumentParser(description="Initialize .sessions/ from templates")
    parser.add_argument("--force",   action="store_true", help="Overwrite existing files")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without writing")
    args = parser.parse_args()

    # Verify templates directory exists
    if not TEMPLATES_DIR.exists():
        print(f"ERROR: {TEMPLATES_DIR} not found — run from project root", file=sys.stderr)
        sys.exit(1)

    # Create .sessions/ if missing
    if not SESSIONS_DIR.exists():
        if not args.dry_run:
            SESSIONS_DIR.mkdir()
        print(f"[created] {SESSIONS_DIR}/")

    created = skipped = 0

    for template_name, target_name in TEMPLATE_MAP.items():
        template_path = TEMPLATES_DIR / template_name
        target_path   = SESSIONS_DIR  / target_name

        if not template_path.exists():
            print(f"[warn] template missing: {template_path}")
            continue

        if target_path.exists() and not args.force:
            print(f"[skipped] {target_path} (exists — use --force to overwrite)")
            skipped += 1
            continue

        action = "would create" if args.dry_run else "created"

        if not args.dry_run:
            if target_name in CLEAN_INIT:
                target_path.write_text(CLEAN_INIT[target_name])
            else:
                # Copy full template (schema comments help agent understand format)
                shutil.copy2(template_path, target_path)

        print(f"[{action}] {target_path}")
        created += 1

    print(f"\nDone: {created} created · {skipped} skipped")
    if args.dry_run:
        print("[dry-run] No files written.")


if __name__ == "__main__":
    main()
