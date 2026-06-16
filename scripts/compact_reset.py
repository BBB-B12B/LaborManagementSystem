#!/usr/bin/env python3
"""compact_reset.py — single-source token reset after a /compact (T-180).

Why this exists:
  The Claude Code CLI intercepts `/compact` before it reaches the model, so the
  agent never sees it as a user turn. Previously only B1 (boot) recomputed
  CHAT_TOTAL, and the per-turn UserPromptSubmit hook PRESERVED a stale CHAT_TOTAL
  -> [compact-STOP] fired forever at the old value. This script is the ONE place
  that recomputes the counters after a compact, callable from:
    - the SessionStart:compact hook (Claude-code, automatic)   --trigger=hook
    - C0 routing when a non-Claude provider's user types "compact แล้ว"
                                                               --trigger=user-confirm

Recomputes .sessions/session_tokens.md:
  CHAT_TOTAL    = compact_size + sys_fixed
  LOOP_WEIGHT   = 0
  SESSION_TOTAL = 0   if (session_reset=armed OR active_thread phase: done)
                  preserved otherwise   (mid-task compact must not wipe the per-task counter)
Flips session_reset=armed -> consumed (consume-once, matches B1).
Prints a visible [compact-reset] line. Never crashes a hook (always exit 0).

Usage: python3 scripts/compact_reset.py [--dry-run] [--trigger=hook|user-confirm]
"""
import os
import re
import sys


def repo_root():
    r = os.environ.get("CLAUDE_PROJECT_DIR")
    if r:
        return r
    # scripts/ -> repo root
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(path):
    try:
        with open(path) as f:
            return f.read()
    except Exception:
        return ""


def main():
    dry = "--dry-run" in sys.argv
    trigger = "hook"
    for a in sys.argv[1:]:
        if a.startswith("--trigger="):
            trigger = a.split("=", 1)[1] or "hook"
    if dry:
        trigger = "dry-run"

    root = repo_root()
    j = lambda *a: os.path.join(root, *a)

    # sys_fixed = (CLAUDE.md + AGENTS.md bytes * 0.3) + 3500  (matches B1)
    try:
        sys_fixed = int((os.path.getsize(j("CLAUDE.md")) + os.path.getsize(j("AGENTS.md"))) * 0.3) + 3500
    except Exception:
        sys_fixed = 11070

    cs_txt = read(j(".sessions", "compact_state.md"))
    m = re.search(r"^compact_size=(\d+)", cs_txt, re.M)
    compact_size = int(m.group(1)) if m else 0
    mm = re.search(r"^session_reset=(\w+)", cs_txt, re.M)
    reset_marker = mm.group(1) if mm else None

    at_txt = read(j(".sessions", "active_thread.md"))
    pm = re.search(r"^phase:\s*(\w+)", at_txt, re.M)
    phase = pm.group(1) if pm else ""

    chat = sys_fixed + compact_size

    tok_path = j(".sessions", "session_tokens.md")
    tok_txt = read(tok_path)
    sm = re.search(r"^SESSION_TOTAL:\s*(\d+)", tok_txt, re.M)
    prev_session = int(sm.group(1)) if sm else 0

    if reset_marker == "armed" or phase == "done":
        session = 0
        session_note = "0"
    else:
        session = prev_session
        session_note = "preserved=%d" % prev_session

    if not dry:
        with open(tok_path, "w") as f:
            f.write(
                "SESSION_TOTAL: %d\nCHAT_TOTAL: %d\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n"
                % (session, chat)
            )
        if reset_marker == "armed":
            new_cs = re.sub(r"^session_reset=armed", "session_reset=consumed", cs_txt, flags=re.M)
            with open(j(".sessions", "compact_state.md"), "w") as f:
                f.write(new_cs)

    print(
        "[compact-reset] trigger: %s · CHAT_TOTAL→%d · LOOP_WEIGHT→0 · SESSION_TOTAL→%s · cache: cold"
        % (trigger, chat, session_note)
    )
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # A reset failure must never break a hook chain.
        print("[compact-reset] skipped (error: %s)" % e)
        sys.exit(0)
