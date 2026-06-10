#!/usr/bin/env python3
"""
session_close.py — Write all 5 mandatory session-close files.
Generates session_NNN.json, session_tokens.md, active_thread.md, session_handoff.md.
Runs session_indexer.py to update knowledge/index_sessions.json.

Usage:
  python3 scripts/session_close.py --task "desc" --next "action" [--session-total N] [--chat-total N] [--dry-run]
"""

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent.parent
SESSIONS_DIR = ROOT / ".sessions"


def find_next_session_id():
    """Find max session_NNN.json number, return NNN+1."""
    if not SESSIONS_DIR.exists():
        return 1
    existing = list(SESSIONS_DIR.glob("session_*.json"))
    if not existing:
        return 1
    numbers = []
    for path in existing:
        name = path.stem.replace("session_", "")
        try:
            numbers.append(int(name))
        except ValueError:
            continue
    return max(numbers) + 1 if numbers else 1


def write_session_json(session_id, task, dry_run=False):
    """Write .sessions/session_NNN.json"""
    path = SESSIONS_DIR / f"session_{session_id:03d}.json"
    content = {
        "session_id": f"session_{session_id:03d}",
        "status": "completed",
        "task": task,
        "summary_context": "closed by session_close.py"
    }
    if dry_run:
        print(f"[dry-run] {path}")
        return True
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, indent=2) + "\n", encoding="utf-8")
        print(f"[written] {path}")
        return True
    except OSError as e:
        print(f"[error] Failed to write {path}: {e}", file=sys.stderr)
        return False


def write_session_tokens(chat_total, session_total=0, dry_run=False):
    """Write .sessions/session_tokens.md"""
    path = SESSIONS_DIR / "session_tokens.md"
    content = (
        f"SESSION_TOTAL: {session_total}\n"
        f"CHAT_TOTAL: {chat_total}\n"
        "CACHE_READ: 0\n"
        "CACHE_WRITE: 0\n"
        "TURN_COUNT: 0\n"
        "LOOP_WEIGHT: 0\n"
    )
    if dry_run:
        print(f"[dry-run] {path}")
        return True
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"[written] {path}")
        return True
    except OSError as e:
        print(f"[error] Failed to write {path}: {e}", file=sys.stderr)
        return False


def write_active_thread(task, next_action, dry_run=False):
    """Write .sessions/active_thread.md"""
    path = SESSIONS_DIR / "active_thread.md"
    content = f"task: {task}\nphase: done\nnext: {next_action}\n"
    if dry_run:
        print(f"[dry-run] {path}")
        return True
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"[written] {path}")
        return True
    except OSError as e:
        print(f"[error] Failed to write {path}: {e}", file=sys.stderr)
        return False


def write_session_handoff(task, next_action, dry_run=False):
    """Write .sessions/session_handoff.md"""
    path = SESSIONS_DIR / "session_handoff.md"
    today = date.today().isoformat()
    content = (
        f"task: {task}\n"
        "status: complete\n"
        f"date: {today}\n"
        "outcome: closed by session_close.py\n"
        f"follow_ups: {next_action}\n"
    )
    if dry_run:
        print(f"[dry-run] {path}")
        return True
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"[written] {path}")
        return True
    except OSError as e:
        print(f"[error] Failed to write {path}: {e}", file=sys.stderr)
        return False


def run_session_indexer(dry_run=False):
    """Run session_indexer.py; warn but continue if it fails."""
    if dry_run:
        print(f"[dry-run] python3 {ROOT / 'scripts' / 'session_indexer.py'}")
        return True
    try:
        result = subprocess.run(
            ["python3", str(ROOT / "scripts" / "session_indexer.py")],
            cwd=str(ROOT),
            capture_output=True,
            timeout=10
        )
        if result.returncode == 0:
            print("[✓ session-indexer] completed")
            return True
        else:
            print(f"[warn] session_indexer.py failed (code {result.returncode})", file=sys.stderr)
            return True
    except Exception as e:
        print(f"[warn] Could not run session_indexer.py: {e}", file=sys.stderr)
        return True


def main():
    parser = argparse.ArgumentParser(description="Write session-close files.")
    parser.add_argument("--task", default="", help="Task description")
    parser.add_argument("--next", default="", help="Next action")
    parser.add_argument("--session-total", type=int, default=0, help="SESSION_TOTAL value")
    parser.add_argument("--chat-total", type=int, default=0, help="CHAT_TOTAL value")
    parser.add_argument("--dry-run", action="store_true", help="Print paths only")

    args = parser.parse_args()

    session_id = find_next_session_id()

    if args.dry_run:
        write_session_json(session_id, args.task, dry_run=True)
        write_session_tokens(args.chat_total, session_total=args.session_total, dry_run=True)
        write_active_thread(args.task, args.next, dry_run=True)
        write_session_handoff(args.task, args.next, dry_run=True)
        run_session_indexer(dry_run=True)
        sys.exit(0)

    success = True
    success &= write_session_json(session_id, args.task)
    success &= write_session_tokens(args.chat_total, session_total=args.session_total)
    success &= write_active_thread(args.task, args.next)
    success &= write_session_handoff(args.task, args.next)
    success &= run_session_indexer()

    if success:
        print("[✓ session-close] 5 files written")
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
