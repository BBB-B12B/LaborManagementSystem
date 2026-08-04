#!/usr/bin/env python3
"""Shared 'loud fail-open' helper for the harness gate hooks (T-355).

WHY: every gate hook (danger_gate, skill_gate, phase_gate, spawn_gate,
cfp_fix_plan_gate, init_gate, git_guard) wraps its logic in an outermost
`except: <allow>` so a bug in the gate can never brick the loop. That is the
right safety valve — but it is SILENT: a gate that dies on an exception is
indistinguishable from a gate that passed. A gate could be dead for weeks and
nobody would know (scrutinize finding #1).

This module keeps fail-open behavior (still allow) but removes the SILENCE:
when a gate's outermost guard fires, it calls `report_fail_open(gate, exc)`,
which (1) appends a durable JSONL event to <project>/.sessions/gate_health.jsonl
and (2) prints a visible `[gate-error]` line to stderr (the channel Claude Code
surfaces as hook context). boot_init.sh reads the log at session start and warns.

HARD RULE: this helper must NEVER raise into the calling gate. A logger that
crashes the gate would turn a benign fail-open into a real crash — worse than
the disease. Every path here is best-effort and swallows its own errors.

Single source of truth: the log/emit format lives here only, never copied into
the 7 gate scripts (they each call report_fail_open).
"""
import json
import os
import sys
import time

LOG_REL = os.path.join(".sessions", "gate_health.jsonl")
_MAX_LINES = 200  # keep the log bounded (F3): a health log is a tail, not an archive


def _project_root():
    """Resolve the PROJECT root the same way the hooks do (F2), so the log
    always lands in the project's .sessions/ regardless of the gate's cwd.
    Order: HARNESS_ENGINE_ROOT -> CLAUDE_PROJECT_DIR -> walk up for .sessions
    -> cwd. Never raises."""
    try:
        for env in ("HARNESS_ENGINE_ROOT", "CLAUDE_PROJECT_DIR"):
            v = os.environ.get(env)
            if v and os.path.isdir(os.path.join(v, ".sessions")):
                return v
        d = os.getcwd()
        while True:
            if os.path.isdir(os.path.join(d, ".sessions")):
                return d
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
    except Exception:
        pass
    return os.getcwd()


def _trim(path):
    """Best-effort: keep only the last _MAX_LINES so the log stays a bounded
    tail (F3). Silent on any error."""
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.readlines()
        if len(lines) > _MAX_LINES:
            with open(path, "w", encoding="utf-8") as fh:
                fh.writelines(lines[-_MAX_LINES:])
    except Exception:
        pass


def report_fail_open(gate, exc, root=None):
    """Record + surface a gate's outermost fail-open. Best-effort, never raises.

    gate: short gate name (e.g. 'danger_gate').
    exc:  the caught exception (or any value describing why the gate bailed).
    Call this from a gate's outermost `except` BEFORE it allows the action.
    """
    try:
        root = root or _project_root()
        reason = repr(exc)[:400]
        try:
            path = os.path.join(root, LOG_REL)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            event = {
                "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "gate": str(gate),
                "exc": reason,
                "cwd": os.getcwd(),
            }
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(event, ensure_ascii=False) + "\n")
            _trim(path)
        except Exception:
            pass  # a failed WRITE must not stop the stderr signal below
        try:
            sys.stderr.write(
                "[gate-error] gate:%s · fail-open(allowed) · %s\n"
                % (gate, reason)
            )
        except Exception:
            pass
    except Exception:
        pass  # absolute backstop: this helper never raises into the gate


def _self_test():
    """Write + read back a temp event under a throwaway root; print OK."""
    import tempfile
    tmp = tempfile.mkdtemp(prefix="gatelib_selftest_")
    os.makedirs(os.path.join(tmp, ".sessions"), exist_ok=True)
    report_fail_open("self_test", ValueError("synthetic"), root=tmp)
    log = os.path.join(tmp, LOG_REL)
    ok = os.path.exists(log) and "self_test" in open(log, encoding="utf-8").read()
    print("OK" if ok else "FAIL: event not written")
    return 0 if ok else 1


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(_self_test())
    print("gatelib: shared loud-fail-open helper (import report_fail_open). "
          "Run --self-test to verify.")
