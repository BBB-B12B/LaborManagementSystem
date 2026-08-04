#!/usr/bin/env python3
"""cfp_fix_probe.py — T-265 Gap 7 ("does it stay fixed?").

Self-improvement-loop stage 7 (Measure-stays-fixed) used to be manual: nobody
re-checked that a resolved CFP's fix artifacts still existed and were still
wired into the harness. A fix can silently rot — a hook script deleted, a
settings.json wiring removed during an unrelated edit — and the CFP stays marked
`resolved` while the failure mode is once again unguarded.

This probe makes that check mechanical. For every CFP entry in
knowledge/index_cfp_fix.json with status==resolved AND a real `resolved_by`
(stub entries with no resolved_by are skipped — they record nothing to verify),
it asserts:
  1. every path in the entry's `artifacts:[]` list exists on disk; and
  2. for artifacts that are hook scripts (scripts/*.py referenced by a hook),
     the script is still wired into .claude/settings.json (grep by basename).

Emits one line per resolved CFP:
  [cfp-fix-ok]   CFP-N
  [cfp-fix-drift] CFP-N: missing=<paths> unwired=<paths>

Exit codes (the wiring in boot_init.sh / Stop hook keys off these):
  0 — all resolved CFP fixes intact (or nothing to check)
  2 — at least one drift detected
FAIL-OPEN: any unexpected exception → print a note → exit 0. This probe must
never block boot or session-close on its own bug (T-263 self-brick lesson).

Read-only: never edits the ledger, never "auto-fixes" — drift is reported for a
human/agent to act on via R16 / harness_doctor.
"""
import json
import os
import sys

LEDGER = 'knowledge/index_cfp_fix.json'
SETTINGS = '.claude/settings.json'


def _root():
    r = os.environ.get('CLAUDE_PROJECT_DIR')
    if r:
        return r
    try:
        import subprocess
        return subprocess.check_output(
            ['git', 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return os.getcwd()


def main():
    root = _root()
    ledger_path = os.path.join(root, LEDGER)
    settings_path = os.path.join(root, SETTINGS)

    with open(ledger_path) as f:
        ledger = json.load(f)

    try:
        settings_text = open(settings_path).read()
    except Exception:
        settings_text = ''

    drift = False
    checked = 0
    for cfp, entry in sorted(ledger.items()):
        if entry.get('status') != 'resolved':
            continue
        if not entry.get('resolved_by'):
            # stub / no recorded fix — nothing to verify, skip silently
            continue
        checked += 1
        artifacts = entry.get('artifacts') or []
        missing = []
        unwired = []
        for art in artifacts:
            ap = os.path.join(root, art)
            if not os.path.exists(ap):
                missing.append(art)
                continue
            # hook-script wiring check: a scripts/*.py whose basename no longer
            # appears in settings.json is "present but unwired".
            norm = art.replace(os.sep, '/')
            if norm.startswith('scripts/') and norm.endswith('.py'):
                base = os.path.basename(norm)
                if base not in settings_text:
                    unwired.append(art)
        if missing or unwired:
            drift = True
            print('[cfp-fix-drift] %s: missing=%s unwired=%s'
                  % (cfp, missing or '-', unwired or '-'))
        else:
            print('[cfp-fix-ok] %s' % cfp)

    if checked == 0:
        print('[cfp-fix-ok] no resolved CFP with recorded fix to check')
    return 2 if drift else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:  # FAIL-OPEN — never block boot/close on a probe bug
        print('[cfp-fix-probe] skipped (fail-open): %s' % e)
        sys.exit(0)
