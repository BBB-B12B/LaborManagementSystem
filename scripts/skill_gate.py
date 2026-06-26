#!/usr/bin/env python3
"""PreToolUse skill-invocation gate (T-263).

The turnstile that makes skill invocation STRUCTURAL, not opt-in. Two gates:

  1. Ownership gate — an Edit/Write to a harness or skill file is BLOCKED unless
     the owning skill is active today. Ownership is read from the manifest
     `owns_paths` field (single source of truth): the required-owner set for a
     path = every skill whose owns_paths glob matches it. A core harness file
     (AGENTS.md, scripts/**, ...) → {harness_editor}; a skill file
     (.agents/skills/**) → {harness_editor, skill_auditor}. The edit passes only
     if required-owner-set ∩ today-set ≠ ∅ (FINDING C: membership in the
     today-set log, NOT single-slot equality — a secondary skill read mid-task
     must not evict the owner). Kills CFP-020 / CFP-043.

  2. Review close-gate — writing `phase: done` to active_thread.md is BLOCKED
     when a review was demanded this turn (.review_intent armed by
     review_intent.py) but no scrutinize/skeptical_reviewer was ever loaded
     (today-set ∩ {scrutinize, skeptical_reviewer} == ∅). Kills CFP-044.
     Escape hatch: HARNESS_SKIP_REVIEW_GATE=1.

FAIL-OPEN CONTRACT: every code path is wrapped — on ANY unexpected error the
gate exits 0 (allow). exit(1) fires ONLY on an intended, explicit block. A gate
must never brick the harness.
"""
import os
import sys
import json
import subprocess
import datetime


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


def _rel(file_path, root):
    """Path as given → repo-relative ('AGENTS.md', 'scripts/x.py'). Handles
    both absolute live paths and the relative paths used in tests."""
    norm = (file_path or '').replace(os.sep, '/')
    root_norm = root.replace(os.sep, '/').rstrip('/')
    if norm.startswith(root_norm + '/'):
        return norm[len(root_norm) + 1:]
    return norm.lstrip('/')


def _match(rel, pat):
    """Glob match supporting trailing /** (recursive) and exact paths."""
    if pat.endswith('/**'):
        base = pat[:-3]
        return rel == base or rel.startswith(base + '/')
    if pat.endswith('/*'):
        base = pat[:-2]
        return rel.startswith(base + '/') and '/' not in rel[len(base) + 1:]
    return rel == pat


def _today_set(root):
    """Skills with a marker line dated today (the today-set log)."""
    today = datetime.date.today().isoformat()
    out = set()
    try:
        for line in open(os.path.join(root, '.sessions', '.active_skill')):
            parts = line.strip().split('|')
            if len(parts) >= 2 and parts[1] == today and parts[0]:
                out.add(parts[0])
    except Exception:
        pass
    return out


def _required_owners(rel, root):
    """Owner set for a path, from manifest owns_paths (single source)."""
    owners = set()
    try:
        mf = os.path.join(root, '.agents', 'skills', 'skill-manifest.json')
        skills = json.load(open(mf)).get('skills', {})
        for name, meta in skills.items():
            for pat in (meta or {}).get('owns_paths', []) or []:
                if _match(rel, pat):
                    owners.add(name)
                    break
    except Exception:
        return set()
    return owners


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # fail-open on bad/empty input

    try:
        tool = data.get('tool_name', '')
        if tool not in ('Edit', 'Write', 'NotebookEdit'):
            return 0
        ti = data.get('tool_input', {}) or {}
        file_path = ti.get('file_path') or ti.get('notebook_path') or ''
        new_string = ti.get('new_string') or ti.get('content') or ''
        root = _root()
        rel = _rel(file_path, root)
        today = _today_set(root)

        # --- Gate 2: review close-gate (active_thread.md phase: done) ---
        if rel.endswith('active_thread.md') and 'phase: done' in new_string:
            armed = os.path.exists(os.path.join(root, '.sessions', '.review_intent'))
            reviewed = bool(today & {'scrutinize', 'skeptical_reviewer'})
            if armed and not reviewed and not os.environ.get('HARNESS_SKIP_REVIEW_GATE'):
                print('[skill-gate] BLOCKED: a review/audit was requested this '
                      'session (.review_intent armed) but no scrutinize/'
                      'skeptical_reviewer skill was loaded. Load the owning skill '
                      'and run the review before closing — or set '
                      'HARNESS_SKIP_REVIEW_GATE=1 to override.', file=sys.stderr)
                return 1

        # --- Gate 1: ownership gate (harness/skill file edits) ---
        required = _required_owners(rel, root)
        if required and not (required & today):
            print('[skill-gate] BLOCKED: editing %s requires one of %s to be '
                  'active (loaded today). Active skills today: %s. Load the '
                  'owning SKILL.md first (CFP-020/043).'
                  % (rel, sorted(required), sorted(today) or 'none'),
                  file=sys.stderr)
            return 1
    except Exception:
        return 0  # fail-open: never brick a tool call

    return 0


if __name__ == '__main__':
    sys.exit(main())
