#!/usr/bin/env python3
"""
trim_exec_log.py — prune .sessions/exec_log/ to prevent disk bloat.

Rules:
  - Remove files older than MAX_AGE_HOURS (default: 24h)
  - Keep at most MAX_FILES newest files
  - --test: verify dir exists and logic runs without deleting

Usage:
  python3 scripts/trim_exec_log.py
  python3 scripts/trim_exec_log.py --test
  python3 scripts/trim_exec_log.py --max-age=48 --max-files=100
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_AGE_HOURS = 24
MAX_FILES = 50


def get_exec_log_dir():
    base = Path(__file__).parent.parent
    return base / ".sessions" / "exec_log"


def trim(exec_dir: Path, max_age_hours: int, max_files: int, dry_run: bool = False):
    if not exec_dir.exists():
        return {"deleted": 0, "kept": 0, "reason": "dir_missing"}

    files = sorted(exec_dir.glob("*.txt"), key=lambda f: f.stat().st_mtime, reverse=True)
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - (max_age_hours * 3600)

    deleted = []
    kept = []

    for i, f in enumerate(files):
        too_old = f.stat().st_mtime < cutoff
        over_limit = i >= max_files
        if too_old or over_limit:
            if not dry_run:
                f.unlink()
            deleted.append(f.name)
        else:
            kept.append(f.name)

    return {"deleted": len(deleted), "kept": len(kept), "deleted_files": deleted}


def run_test(exec_dir: Path):
    result = {"test": "trim_exec_log", "pass": False, "checks": []}

    # Check 1: dir exists or can be created
    try:
        exec_dir.mkdir(parents=True, exist_ok=True)
        result["checks"].append({"name": "dir_exists", "pass": True})
    except Exception as e:
        result["checks"].append({"name": "dir_exists", "pass": False, "error": str(e)})
        print(json.dumps(result, indent=2))
        return 1

    # Check 2: trim logic runs without error (dry_run)
    try:
        r = trim(exec_dir, max_age_hours=MAX_AGE_HOURS, max_files=MAX_FILES, dry_run=True)
        result["checks"].append({"name": "trim_dry_run", "pass": True, "result": r})
    except Exception as e:
        result["checks"].append({"name": "trim_dry_run", "pass": False, "error": str(e)})
        print(json.dumps(result, indent=2))
        return 1

    result["pass"] = all(c["pass"] for c in result["checks"])
    print(json.dumps(result, indent=2))
    return 0 if result["pass"] else 1


def main():
    parser = argparse.ArgumentParser(description="Prune .sessions/exec_log/ temp files")
    parser.add_argument("--test", action="store_true", help="Dry-run self-test")
    parser.add_argument("--max-age", type=int, default=MAX_AGE_HOURS,
                        help=f"Max file age in hours (default: {MAX_AGE_HOURS})")
    parser.add_argument("--max-files", type=int, default=MAX_FILES,
                        help=f"Max files to keep (default: {MAX_FILES})")
    args = parser.parse_args()

    exec_dir = get_exec_log_dir()

    if args.test:
        sys.exit(run_test(exec_dir))

    result = trim(exec_dir, max_age_hours=args.max_age, max_files=args.max_files)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
