#!/usr/bin/env python3
"""exec_log_get.py — retrieve a parked tool output by id (T-301).

Counterpart of the <<offload:ID>> marker written by safe_run.py:
prints .sessions/exec_log/<ID>.txt to stdout byte-for-byte, exit 0.
Agent-invoked only — no API-level tool injection (T-301 INTEGRATION NOTE).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness_paths

EXEC_LOG_DIR = harness_paths.project_root() / ".sessions" / "exec_log"


def main() -> int:
    parser = argparse.ArgumentParser(description="Retrieve parked output by <<offload:ID>>")
    parser.add_argument("--id", required=True, help="offload id from the <<offload:ID>> marker")
    args = parser.parse_args()

    # alnum-only guard: the id is a uuid4 hex fragment; anything else is path traversal
    if not args.id.isalnum():
        sys.stderr.write(f"[exec-log-get] invalid id {args.id!r} (alnum only)\n")
        return 1

    path = EXEC_LOG_DIR / f"{args.id}.txt"
    if not path.is_file():
        sys.stderr.write(
            f"[exec-log-get] id not found: {args.id} "
            "(may be pruned by trim_exec_log — max 50 files / 24h)\n"
        )
        return 1

    sys.stdout.write(path.read_text())
    return 0


if __name__ == "__main__":
    sys.exit(main())
