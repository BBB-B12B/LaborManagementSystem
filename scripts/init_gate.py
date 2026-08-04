#!/usr/bin/env python3
"""init_gate.py -- T-323 PreToolUse HARD gate for an un-initialized harness project.

WHY: the boot sequence (boot_init.sh) only READS harness state files with
`2>/dev/null` -- a brand-new project with ZERO harness files looks identical to a
healthy project with nothing pending, so boot silently proceeds and the agent
starts editing as if the project were set up. The existing detector
`harness_onboard.py` already knows the difference (route init/upgrade/noop) but it
is DETECT+RECOMMEND-only (soft) -- it prints a suggestion the agent may ignore.
This gate makes that detection HARD: you cannot edit real project files in a
project that is not harness-initialized until you run project_init.py (or
explicitly skip). It is the structural check the user asked for -- boot-time
enforcement, not a prompt-triggered afterthought.

SINGLE SOURCE OF TRUTH: the "is this a harness project?" decision is NOT
re-implemented here. We import `harness_onboard.detect` and act on its route, so
there is exactly one definition of "initialized" across the engine.

CONTRACT:
  * Fires on PreToolUse Edit/Write/NotebookEdit.
  * Edits to `.sessions/**` ALWAYS pass -- init/scaffold must be able to write
    there, and so must the plan/session bookkeeping that precedes any setup.
  * If `harness_onboard.detect` routes the project to 'init' (not a harness
    project yet) -> BLOCK (exit 2) with a clear message pointing at project_init.
  * route 'upgrade' / 'noop' / self-hosted -> PASS. 'upgrade' is a soft state
    (a stale-but-working project); bricking every edit there would over-block.
  * In the self-hosted dev repo detect() returns 'noop' (project == engine), so
    this gate never blocks the engine's own editing.

ESCAPE HATCH: HARNESS_SKIP_INIT_GATE=1 -> always PASS (never bricks editing).

FAIL-OPEN: on any internal/parse error the gate logs to stderr and exits 0. A
block gate that crashes must not break every edit -- under-blocking beats
bricking. Mirrors spawn_gate.py / the phase-gate.

USAGE:
  (hook)   echo '<PreToolUse-json>' | python3 scripts/init_gate.py
  (test)   python3 scripts/init_gate.py --self-test
"""
import json
import os
import sys
from pathlib import Path

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

BLOCK = 2   # PreToolUse exit 2 = hard block
PASS = 0


def _skip():
    return os.environ.get("HARNESS_SKIP_INIT_GATE") == "1"


def _is_sessions_path(rel_path):
    """True if the edit target lives under .sessions/ (always allowed -- init,
    plan, and session bookkeeping must be writable before any setup runs)."""
    norm = (rel_path or "").replace(os.sep, "/").lstrip("/")
    return norm.startswith(".sessions/") or "/.sessions/" in ("/" + norm)


# --- decision (pure: route + path in, verdict out -> unit-testable) -------------
def gate_decision(route, rel_path, skip=False):
    """Return (exit_code, message). BLOCK only when the project is un-initialized
    (route 'init') AND the edit is to a real project file (not .sessions/)."""
    if skip:
        return PASS, ""
    if _is_sessions_path(rel_path):
        return PASS, ""            # setup/bookkeeping writes always allowed
    if route != "init":
        return PASS, ""            # upgrade / noop / self-hosted -> never block
    return (BLOCK,
            "[init-gate] BLOCKED: this project is NOT harness-initialized "
            "(harness_onboard route: init -- no AGENTS.md / .sessions / index). "
            "Editing project files before setup will scatter half-a-harness. "
            "Run `python3 scripts/project_init.py <project-dir>` first, or set "
            "HARNESS_SKIP_INIT_GATE=1 to override.")


def _route_for_project():
    """Resolve the project's route via the SINGLE-SOURCE detector. Any import or
    resolution failure -> return 'noop' so the gate fails open (never bricks)."""
    try:
        from harness_paths import engine_root, project_root
        from harness_onboard import detect
    except Exception:
        return "noop"
    try:
        return detect(project_root(), engine_root())[0]
    except Exception:
        return "noop"


# --- hook mode ------------------------------------------------------------------
def handle_stdin():
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        return PASS
    if data.get("tool_name") not in ("Edit", "Write", "NotebookEdit"):
        return PASS
    ti = data.get("tool_input", {}) or {}
    fp = ti.get("file_path", "") or ti.get("notebook_path", "") or ""
    code, msg = gate_decision(_route_for_project(), fp, skip=_skip())
    if code == BLOCK:
        sys.stderr.write(msg + "\n")
    return code


# --- self-test (pure decision cases + one real detect() integration probe) ------
def _self_test():
    import tempfile
    fails = []

    # pure gate_decision cases
    if gate_decision("init", "scripts/foo.py")[0] != BLOCK:
        fails.append("init+real-file-should-block")
    if gate_decision("init", ".sessions/mece_plan.md")[0] != PASS:
        fails.append("init+sessions-path-should-pass")
    if gate_decision("init", "scripts/foo.py", skip=True)[0] != PASS:
        fails.append("skip-should-pass")
    if gate_decision("noop", "scripts/foo.py")[0] != PASS:
        fails.append("noop-should-pass")
    if gate_decision("upgrade", "scripts/foo.py")[0] != PASS:
        fails.append("upgrade-should-pass")

    # integration: a genuinely fresh dir (no AGENTS.md) must route 'init'
    try:
        from harness_paths import engine_root
        from harness_onboard import detect
        fresh = tempfile.mkdtemp()
        route = detect(Path(fresh), engine_root())[0]
        if route != "init":
            fails.append(f"fresh-dir-should-route-init (got {route})")
        # and the gate would then block a real-file edit there
        if gate_decision(route, "src/app.py")[0] != BLOCK:
            fails.append("fresh-dir-real-edit-should-block")
    except Exception as exc:
        fails.append(f"integration-detect-error: {exc}")

    # stdin-path integration (T-323 polish · sr-fix#4): drive the REAL hook
    # entry (JSON on stdin → handle_stdin) via subprocess. The pure cases above
    # never touch handle_stdin. Force route=init DETERMINISTICALLY by pointing
    # CLAUDE_PROJECT_DIR at a fresh dir with no AGENTS.md and clearing
    # HARNESS_PROJECT_ROOT (which would otherwise win) — regardless of whether
    # this repo itself routes noop.
    import subprocess
    try:
        fresh2 = tempfile.mkdtemp()
        base_env = dict(os.environ)
        base_env.pop("HARNESS_PROJECT_ROOT", None)
        base_env.pop("HARNESS_SKIP_INIT_GATE", None)
        base_env["CLAUDE_PROJECT_DIR"] = fresh2

        def _stdin_exit(payload, extra_env=None):
            env = dict(base_env)
            if extra_env:
                env.update(extra_env)
            return subprocess.run(
                [sys.executable, os.path.abspath(__file__)],
                input=json.dumps(payload), text=True,
                capture_output=True, env=env,
            ).returncode

        if _stdin_exit({"tool_name": "Edit",
                        "tool_input": {"file_path": "src/app.py"}}) != BLOCK:
            fails.append("stdin init+real-file-should-block")
        if _stdin_exit({"tool_name": "Edit",
                        "tool_input": {"file_path": ".sessions/x.md"}}) != PASS:
            fails.append("stdin init+.sessions-should-pass")
        if _stdin_exit({"tool_name": "Edit",
                        "tool_input": {"file_path": "src/app.py"}},
                       {"HARNESS_SKIP_INIT_GATE": "1"}) != PASS:
            fails.append("stdin skip-should-pass")
    except Exception as exc:
        fails.append(f"stdin-integration-error: {exc}")

    if fails:
        print("[init-gate self-test] FAIL:", "; ".join(fails))
        return 1
    print("[init-gate self-test] PASS "
          "(init+real->block · init+.sessions->pass · skip->pass · "
          "noop->pass · upgrade->pass · fresh-dir->init->block · "
          "stdin: block/.sessions/skip)")
    return 0


def main():
    if "--self-test" in sys.argv:
        return _self_test()
    if _skip():
        return PASS
    try:
        return handle_stdin()
    except Exception as exc:                   # fail-open: never brick an edit
        try:                                   # loud fail-open (T-355): log + [gate-error]
            import gatelib; gatelib.report_fail_open("init_gate", exc)
        except Exception:                      # F1: a missing/broken helper must never crash the gate
            sys.stderr.write(f"[gate-error] gate:init_gate · fail-open(allowed) · {exc!r}\n")
        return PASS


if __name__ == "__main__":
    sys.exit(main())
