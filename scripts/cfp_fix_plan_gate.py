#!/usr/bin/env python3
"""cfp_fix_plan_gate.py — PreToolUse hard-block gate (T-316 · fixes CFP-048).

A CFP-fix task's mece_plan MUST carry a loop-closure section (the self_improve
subtasks: fix-validation re-run, CFP-entry -> APPLIED, SI-N log, cfp_topics/
index_cfp_fix sync). self_improve only activates at session_close/manual, so at
plan time nothing folds these in and the plan silently omits them (CFP-048).

This hook fires on any Write/Edit to .sessions/mece_plan.md. If the task is a
CFP fix AND the resulting plan text carries no loop-closure marker -> exit 2
(hard block; T-315 lesson: exit 1 is non-blocking, only exit 2 blocks the tool).

Detection of "CFP-fix task" (either signal):
  (a) .sessions/gather_complete.md task:/goal: line names a CFP or ERR fix
  (b) the plan text declares a File: line touching CODING_FAILURE_PATTERNS.md

Escape hatch: HARNESS_SKIP_CFP_PLAN_GATE=1
Fail-safe: any internal error -> exit 0 (never break the tool on hook error).
Plugin-global no-op on non-harness projects via is_harness_project().
"""
import json
import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
try:
    from harness_paths import is_harness_project as _is_harness_project
except Exception:  # resolver unavailable -> preserve legacy behavior (enforce)
    def _is_harness_project():
        return True

# any one of these in the plan text == a loop-closure section is present
# (scrutinize T-316: dropped the bare word 'applied' — too broad, risked a
#  false-negative when a plan said "applied" for an unrelated reason; the
#  strong markers below always co-occur in a real loop-closure section)
CLOSURE_MARKERS = ('self_improve', 'loop-closure', 'loop closure', 'si-n')


def _project_root():
    root = os.environ.get('CLAUDE_PROJECT_DIR')
    if root:
        return root
    try:
        import subprocess
        return subprocess.check_output(
            ['git', 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
    except Exception:
        return os.getcwd()


def _is_cfp_fix(root, plan_low):
    # (a) gather_complete.md task:/goal: line names a CFP or ERR fix
    try:
        gc = os.path.join(root, '.sessions', 'gather_complete.md')
        if os.path.exists(gc):
            for raw in open(gc, encoding='utf-8').read().lower().splitlines():
                line = raw.strip()
                if line.startswith('task:') or line.startswith('goal:'):
                    if ('cfp-' in line or 'fix err' in line
                            or 'fix cfp' in line or 'err-' in line):
                        return True
    except Exception:
        pass
    # (b) the plan itself declares a File: line touching the CFP catalogue
    for line in plan_low.splitlines():
        if 'file:' in line and 'coding_failure_patterns.md' in line:
            return True
    return False


def main():
    if os.environ.get('HARNESS_SKIP_CFP_PLAN_GATE'):
        sys.exit(0)
    if not _is_harness_project():
        sys.exit(0)  # plugin-global no-op on non-harness projects

    data = json.load(sys.stdin)
    tool = data.get('tool_name', '')
    if tool not in ('Write', 'Edit'):
        sys.exit(0)

    ti = data.get('tool_input', {})
    file_path = ti.get('file_path', '') or ''
    rel_path = file_path.replace(os.sep, '/').lstrip('/')
    if not rel_path.endswith('mece_plan.md'):
        sys.exit(0)

    root = _project_root()

    # resulting plan text: Write -> full content · Edit -> on-disk + the added new_string
    if tool == 'Write':
        plan_text = ti.get('content', '') or ''
    else:
        disk = ''
        mp = os.path.join(root, '.sessions', 'mece_plan.md')
        try:
            disk = open(mp, encoding='utf-8').read()
        except Exception:
            disk = ''
        plan_text = disk + '\n' + (ti.get('new_string', '') or '')
    plan_low = plan_text.lower()

    if not _is_cfp_fix(root, plan_low):
        sys.exit(0)
    if any(m in plan_low for m in CLOSURE_MARKERS):
        sys.exit(0)  # loop-closure section present -> allow

    print('[gate] CFP-fix plan missing loop-closure: this task edits a CFP / '
          'CODING_FAILURE_PATTERNS.md, so its mece_plan MUST include a loop-closure '
          'section (self_improve subtasks: fix-validation re-run + CFP-entry -> APPLIED '
          '+ SI-N log + cfp_topics/index_cfp_fix sync). Add it before writing the plan '
          '(harness_editor SKILL_detail §"Stage 2 · CFP-fix fold-in"). '
          'Override: HARNESS_SKIP_CFP_PLAN_GATE=1.', file=sys.stderr)
    sys.exit(2)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # fail-safe: never break the tool on hook error (loud · T-355)
        try:
            import gatelib; gatelib.report_fail_open("cfp_fix_plan_gate", exc)
        except Exception:      # F1: helper failure must not crash the gate
            sys.stderr.write("[gate-error] gate:cfp_fix_plan_gate · fail-open(allowed) · %r\n" % (exc,))
        sys.exit(0)
