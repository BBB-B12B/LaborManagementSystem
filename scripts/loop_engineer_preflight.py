#!/usr/bin/env python3
"""loop_engineer_preflight.py — the doorman for the headless Loop Engineer.

Runs from the cron entry BEFORE the loop_engineer skill is invoked. It makes one
decision and prints it to stdout, then exits. The cron reads stdout:

    line starts "green:"            -> invoke the loop_engineer skill
    line "P0: no active task"       -> normal idle tick, do nothing
    line starts "red:"              -> blocked (paused / budget / another run), do nothing

Exit code is 0 on ANY clean decision (green, idle, or red). It is non-zero ONLY
on a real script error (e.g. roadmap file unreadable) so the cron can alert.

Checks, in order (first failing check wins):
  1. .sessions/loop_paused exists                         -> red (human pause lever)
  2. daily/weekly odometer at/over cap (if ledger exists)  -> red (budget tripped)
  3. an active [/] task with a FRESH heartbeat (<25 min)   -> red (another run active)
  4. an active [/] task with a STALE heartbeat + no PR      -> green (orphan -> first job is PR it)
  5. >=1 eligible pending [ ] task (schema + depends_on met)-> green (prints the claim candidate)
  6. nothing eligible                                       -> "P0: no active task"

Stdlib only. Safe to run when no task is active and when the budget ledger does
not yet exist (the ledger is part of a later build wave).
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths

REPO = str(harness_paths.project_root())
ROADMAP = os.path.join(REPO, "docs", "master_roadmap.md")
PAUSE_FLAG = os.path.join(REPO, ".sessions", "loop_paused")
LOOP_ACTIVE = os.path.join(REPO, ".sessions", "loop_active")  # T-304 headless sentinel
LEDGER = os.path.join(REPO, ".sessions", "loop_token_ledger.json")

DAILY_CAP = 10_000_000      # LOOP_DAILY_BUDGET
WEEKLY_CAP = 100_000_000    # WEEKLY_TOKEN_LIMIT
STALE_MIN = 25              # orphan heartbeat threshold (minutes)

# A loop-eligible task line carries an explicit priority tag: "· P0|P1|P2 ·"
PENDING_RE = re.compile(r"^- \[ \] (T-\d+) .*?· (P[012]) ·")
ACTIVE_RE = re.compile(r"^- \[/\] (T-\d+)")
DEPENDS_RE = re.compile(r"depends_on:\s*([^\n·]*)")
HB_RE = re.compile(r"hb:\s*([0-9]+)")
PR_RE = re.compile(r"pr:\s*(\S+)")


def out(line, code=0):
    print(line)
    sys.exit(code)


def load_roadmap():
    with open(ROADMAP, "r", encoding="utf-8") as fh:
        return fh.read()


def done_ids(text):
    return set(re.findall(r"^- \[X\] (T-\d+)", text, re.MULTILINE))


def depends_met(line, completed):
    m = DEPENDS_RE.search(line)
    if not m:
        return True
    raw = m.group(1).strip()
    if not raw or raw.lower() == "none":
        return True
    deps = [d.strip() for d in raw.replace(",", " ").split() if d.strip().startswith("T-")]
    return all(d in completed for d in deps)


def budget_tripped():
    """True if the ledger shows we are at/over a cap. Missing ledger -> not tripped.

    Caps come from the ledger itself (single source of truth); the module
    DAILY_CAP/WEEKLY_CAP constants are only the fallback when the ledger omits
    them. Rollover is applied on READ (T-297 scrutinize fix): a daily/weekly
    total left over from a previous day/week reads as 0 here, so a stale total
    can never false-trip the new period before the writer's first reset."""
    if not os.path.exists(LEDGER):
        return False
    try:
        with open(LEDGER, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        return False
    import datetime
    today = datetime.date.today()
    iso = today.isocalendar()
    cur_date = today.isoformat()
    cur_week = str(iso[0]) + "-W" + str(iso[1]).zfill(2)
    # rollover on read: stale period -> 0 until the writer (posttool_track) resets it
    day = data.get("daily_spent", 0) if data.get("date") == cur_date else 0
    week = data.get("weekly_spent", 0) if data.get("week") == cur_week else 0
    daily_cap = data.get("daily_cap", DAILY_CAP)
    weekly_cap = data.get("weekly_cap", WEEKLY_CAP)
    return day >= daily_cap or week >= weekly_cap


def heartbeat_minutes(active_line):
    """Minutes since the active task's heartbeat, or None if no hb recorded yet."""
    m = HB_RE.search(active_line)
    if not m:
        return None
    try:
        return (time.time() - int(m.group(1))) / 60.0
    except ValueError:
        return None


def main():
    # 1. human pause lever
    if os.path.exists(PAUSE_FLAG):
        out("red: paused by human (.sessions/loop_paused present)")

    # 2. budget
    if budget_tripped():
        out("red: budget tripped (daily/weekly odometer at cap)")

    try:
        text = load_roadmap()
    except OSError as exc:
        # real error -> non-zero so the cron alerts
        print("error: cannot read roadmap: %s" % exc, file=sys.stderr)
        sys.exit(2)

    completed = done_ids(text)
    lines = text.splitlines()

    # 3 + 4. an active [/] task
    for line in lines:
        am = ACTIVE_RE.match(line)
        if am:
            mins = heartbeat_minutes(line)
            has_pr = bool(PR_RE.search(line))
            if mins is not None and mins < STALE_MIN:
                out("red: another run active (%s · hb %.0f min)" % (am.group(1), mins))
            if not has_pr:
                out("green: orphan %s (hb stale) -> escalate to PR first" % am.group(1))
            # stale but already PR'd -> treat as resolved, fall through to selection

    # 5. eligible pending task -> select by P0>P1>P2 then document position
    candidates = []  # (priority_rank, position, tid, prio)
    for pos, line in enumerate(lines):
        pm = PENDING_RE.match(line)
        if pm and depends_met(line, completed):
            tid, prio = pm.group(1), pm.group(2)
            candidates.append((int(prio[1]), pos, tid, prio))
    if candidates:
        candidates.sort(key=lambda c: (c[0], c[1]))  # priority asc (P0=0 best), then position
        _, _, tid, prio = candidates[0]
        # T-304: the loop is about to run headless -> refresh the headless sentinel
        # so scripts/danger_gate.py hard-blocks destructive/gated calls (no self-confirm).
        # Fresh mtime marks headless for STALE_MIN; a stalled/dead loop auto-disengages it.
        try:
            open(LOOP_ACTIVE, "a").close()
            os.utime(LOOP_ACTIVE, None)
        except Exception:
            pass
        out("green: claim %s (%s)" % (tid, prio))

    # 6. nothing to do
    out("P0: no active task")


if __name__ == "__main__":
    main()
