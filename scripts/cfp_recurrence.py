#!/usr/bin/env python3
"""cfp_recurrence.py — T-265 Gap 8 ("re-open on recurrence").

Self-improvement-loop stage 8 (Re-open-on-recurrence) used to mean hand-editing
knowledge/index_cfp_fix.json: bump the count, append a date, flip the status. A
hand edit is exactly where the loop leaked — easy to forget a field, easy to
typo the status, easy to skip entirely. The DETECTION of a recurrence stays a
judgment call (R16 / harness_doctor BC-E decides "this is the same failure
mode") — but once an agent has decided, the WRITE should be reliable and total.

This script is that reliable write. It is AGENT-INVOKED, not automatic:
  python3 scripts/cfp_recurrence.py CFP-N
On the named entry it:
  1. appends today's date to recurred_after_fix[]  (the stays-fixed tripwire)
  2. flips status resolved -> reopened              (so the probe/doctor see it)
  3. count += 1
  4. sets last_seen = today
and prints the escalation signal the harness keys off:
  [recurrence-logged] CFP-N · count: K        (K < 3)
  [fix-required]      CFP-N · count: K         (K >= 3)
  [fix-escalated]     CFP-N · count: K         (K >= 5)

Usage:
  python3 scripts/cfp_recurrence.py CFP-044
  python3 scripts/cfp_recurrence.py CFP-044 --date 2026-06-24   # override (tests)

Today's date: pass --date for determinism (tests); else datetime.date.today().
NOT fail-open: this is an explicit agent action on demand, so a bad CFP id or a
write error SHOULD surface (exit 1) rather than silently no-op.
"""
import json
import os
import sys

LEDGER = 'knowledge/index_cfp_fix.json'


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


def _today(argv):
    if '--date' in argv:
        return argv[argv.index('--date') + 1]
    return __import__('datetime').date.today().isoformat()


def main(argv):
    # parse: first non-flag token (that isn't the value of --date) is the CFP id
    cfp = None
    skip = False
    for i, a in enumerate(argv):
        if skip:
            skip = False
            continue
        if a == '--date':
            skip = True
            continue
        if not a.startswith('--'):
            cfp = a
            break
    if not cfp:
        print('usage: cfp_recurrence.py CFP-N [--date YYYY-MM-DD]', file=sys.stderr)
        return 1

    today = _today(argv)
    root = _root()
    path = os.path.join(root, LEDGER)
    with open(path) as f:
        ledger = json.load(f)

    if cfp not in ledger:
        print('[cfp-recurrence] unknown CFP id: %s' % cfp, file=sys.stderr)
        return 1

    e = ledger[cfp]
    raf = e.get('recurred_after_fix') or []
    if today not in raf:
        raf.append(today)
    e['recurred_after_fix'] = raf
    e['status'] = 'reopened'
    e['count'] = int(e.get('count') or 0) + 1
    e['last_seen'] = today

    json.dump(ledger, open(path, 'w'), indent=2, ensure_ascii=True)
    open(path, 'a').write('\n')

    k = e['count']
    if k >= 5:
        sig = '[fix-escalated]'
    elif k >= 3:
        sig = '[fix-required]'
    else:
        sig = '[recurrence-logged]'
    print('%s %s · count: %d · status: reopened · recurred_after_fix+=%s'
          % (sig, cfp, k, today))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
