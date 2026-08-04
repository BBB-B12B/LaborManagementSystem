#!/usr/bin/env python3
"""UserPromptSubmit review-intent detector (T-263).

When the user asks for a review / audit / verify, this hook:
  1. injects a non-skippable reminder (stdout → becomes agent context) to load
     the owning skill (scrutinize for finished artifacts · skeptical_reviewer for
     plans) instead of reviewing "in head"; and
  2. arms .sessions/.review_intent, which skill_gate.py consumes at the close-gate
     — if the agent reaches `phase: done` without ever loading
     scrutinize/skeptical_reviewer, the close is BLOCKED. Kills CFP-044.

This is a NUDGE: it NEVER exits non-zero (a UserPromptSubmit context hook must
not block the turn). Fail-open: any error → exit 0, silently.
"""
import os
import sys
import json
import subprocess
import datetime

# Trigger keywords. TH has no case; EN matched case-insensitively as substrings.
TH_KW = ['ตรวจสอบ', 'ตรวจ', 'รีวิว', 'ซัก scope', 'เจาะ scope']
EN_KW = ['audit', 'review', 'verify', 'scrutinize', 'skeptical']


def _root():
    r = os.environ.get('CLAUDE_PROJECT_DIR')
    if r:
        return r
    try:
        return subprocess.check_output(
            ['git', 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
    except Exception:
        return os.getcwd()


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    try:
        prompt = data.get('prompt', '') or ''
        low = prompt.lower()
        matched = [k for k in TH_KW if k in prompt] + [k for k in EN_KW if k in low]
        if not matched:
            return 0
        root = _root()
        today = datetime.date.today().isoformat()
        try:
            with open(os.path.join(root, '.sessions', '.review_intent'), 'w') as f:
                f.write('armed|%s|%s\n' % (today, ','.join(matched)))
        except Exception:
            pass
        print('[review-intent] You asked for a review/audit (matched: %s). '
              'Load the OWNING skill before reviewing — do NOT review in head: '
              'scrutinize (finished artifact / post-build) or skeptical_reviewer '
              '(a plan, Phase 2). Reading its SKILL.md disarms this gate; closing '
              'with phase: done before then is BLOCKED by skill_gate.py (CFP-044).'
              % ', '.join(matched))
    except Exception:
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
