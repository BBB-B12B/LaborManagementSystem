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
     when no scrutinize/skeptical_reviewer was ever loaded today
     (today-set ∩ {scrutinize, skeptical_reviewer} == ∅) AND either trigger
     fires. Two triggers (T-324 broadened it beyond the demanded case):
       2a DEMANDED — a review was requested up front (.review_intent armed by
          review_intent.py). STRICT: cleared only by a real review load or the
          env override — NOT by the self-attested skip token.
       2b PROACTIVE — this task BUILT a code artifact (src/ or scripts/ changed
          vs the T-230b .scope_baseline, via _code_changed_this_task). Cleared
          by a real review, the env override, OR an explicit auditable
          `scrutinize-skip: <reason>` line written into the active_thread.md
          payload. Fires ONCE at close (git call sits inside the phase:done
          branch, never per edit). Kills CFP-044 (incl. the #4 proactive case).
     Escape hatch (both): HARNESS_SKIP_REVIEW_GATE=1.

FAIL-OPEN CONTRACT: every code path is wrapped — on ANY unexpected error the
gate exits 0 (allow). exit(1) fires ONLY on an intended, explicit block. A gate
must never brick the harness.
"""
import os
import sys
import json
import re
import subprocess
import datetime

# T-312 S3: resolve the harness-project marker (sibling engine module).
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
try:
    from harness_paths import is_harness_project as _is_harness_project
except Exception:  # resolver unavailable -> preserve legacy behavior (enforce)
    def _is_harness_project():
        return True


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


def _code_changed_this_task(root):
    """True if a file under src/ or scripts/ changed DURING this task.

    Reuses the T-230b `.scope_baseline` (the `git status --porcelain` snapshot
    written at Phase-1 gather) as the task-start reference — NOT a raw
    git-diff-vs-HEAD, which a pre-dirty tree would pollute. A path already in
    the baseline was dirty BEFORE the task and is excluded; only paths new vs
    the baseline count. Compares by PATH (not the full porcelain line) so a
    mere status-char change (' M' -> 'MM') is not a false positive.
    Fail-safe: any error -> False (never block a close on uncertainty)."""
    def _paths(lines):
        out = set()
        for line in lines:
            s = line.rstrip('\n')
            if not s.strip():
                continue
            p = s[3:].strip() if len(s) > 3 else s.strip()
            if ' -> ' in p:            # rename: take the new path
                p = p.split(' -> ', 1)[1].strip()
            out.add(p)
        return out
    try:
        base_path = os.path.join(root, '.sessions', '.scope_baseline')
        baseline = _paths(open(base_path)) if os.path.exists(base_path) else set()
        cur = subprocess.check_output(
            ['git', 'status', '--porcelain'],
            stderr=subprocess.DEVNULL, cwd=root).decode().splitlines()
        for p in _paths(cur) - baseline:
            if p.startswith('src/') or p.startswith('scripts/'):
                return True
    except Exception:
        return False
    return False


def _stripped_plan_hash(root):
    """sha1 of mece_plan.md with checkbox STATES normalized out (T-350).

    Ticking a box (`- [ ]` -> `- [X]`) does NOT change the hash, but any real
    content edit DOES. This ties a review proof to the plan's IDENTITY, not its
    progress: a finished-step tick keeps the proof valid, a genuine plan rewrite
    invalidates every proof and forces re-review. None on any error (callers
    treat None as 'cannot verify' -> fail-open allow, never a false block)."""
    try:
        import hashlib
        txt = open(os.path.join(root, '.sessions', 'mece_plan.md'),
                   encoding='utf-8').read()
        norm = re.sub(r'-\s*\[[ /xX-]\]', '- []', txt)
        return hashlib.sha1(norm.encode('utf-8')).hexdigest()
    except Exception:
        return None


def main():
    if not _is_harness_project():
        return 0  # T-312 S3: plugin-global no-op on non-harness projects
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
        env_skip = bool(os.environ.get('HARNESS_SKIP_REVIEW_GATE'))

        # --- Gate 4 (T-350): per-section scrutinize. Marking `- [X] S<N>` in
        #     mece_plan.md needs a hash-matched proof line in .scrutinize_log
        #     (`S<N>|<stripped-plan-hash>`). No proof -> BLOCK. Fail-open: if the
        #     plan can't be hashed (h is None) we do NOT block. ---
        if not env_skip and rel.endswith('mece_plan.md'):
            marked = re.findall(r'-\s*\[X\]\s*S(\d+)', new_string)
            if marked:
                h = _stripped_plan_hash(root)
                proven = set()
                try:
                    for line in open(os.path.join(root, '.sessions',
                                     '.scrutinize_log'), encoding='utf-8'):
                        parts = line.strip().split('|')
                        if len(parts) >= 2 and parts[1] == h:
                            proven.add(parts[0])
                except Exception:
                    proven = set()
                missing = ['S' + m for m in marked if ('S' + m) not in proven]
                if h is not None and missing:
                    print('[scrutinize-gate] BLOCKED: marking %s [X] but no '
                          'hash-matched per-section scrutinize proof in '
                          '.sessions/.scrutinize_log. Run the light scrutinize on '
                          'the section first (or HARNESS_SKIP_REVIEW_GATE=1).'
                          % ', '.join(missing), file=sys.stderr)
                    return 2

        # --- Gate 3 (T-350): skeptical entry. A real IN-REPO, non-.sessions edit
        #     during an active task (fresh mece_plan today) needs skeptical_reviewer
        #     to have challenged THIS plan (.skeptical_ok hash-matched). Ties
        #     Phase-3 entry to a mandatory M4. Out-of-repo (scratch/tmp) is never
        #     gated. Fail-open: h is None -> do NOT block. ---
        try:
            _abs = (os.path.abspath(file_path) if os.path.isabs(file_path)
                    else os.path.abspath(os.path.join(root, file_path)))
            _in_repo = _abs.startswith(os.path.abspath(root) + os.sep)
        except Exception:
            _in_repo = False
        if (not env_skip and _in_repo and rel
                and not rel.startswith('.sessions/')
                and '.sessions/' not in rel):
            mece = os.path.join(root, '.sessions', 'mece_plan.md')
            today_iso = datetime.date.today().isoformat()
            try:
                fresh_plan = (os.path.exists(mece)
                              and today_iso in open(mece, encoding='utf-8').read())
            except Exception:
                fresh_plan = False
            if fresh_plan:
                h = _stripped_plan_hash(root)
                ok = False
                try:
                    ok = (h is not None and h in open(os.path.join(
                        root, '.sessions', '.skeptical_ok'),
                        encoding='utf-8').read())
                except Exception:
                    ok = False
                if h is not None and not ok:
                    print('[skeptical-gate] BLOCKED: editing %s but '
                          'skeptical_reviewer has not challenged the current plan '
                          '(.sessions/.skeptical_ok missing or stale vs the plan). '
                          'Run M4 skeptical_reviewer first (or '
                          'HARNESS_SKIP_REVIEW_GATE=1).' % rel, file=sys.stderr)
                    return 2

        # --- Gate 2: review close-gate (active_thread.md phase: done) ---
        if rel.endswith('active_thread.md') and 'phase: done' in new_string:
            reviewed = bool(today & {'scrutinize', 'skeptical_reviewer'})
            env_skip = bool(os.environ.get('HARNESS_SKIP_REVIEW_GATE'))
            armed = os.path.exists(os.path.join(root, '.sessions', '.review_intent'))

            # 2a: a review was DEMANDED up front (.review_intent). STRICT —
            #     only a real scrutinize/skeptical load or the env override
            #     clears it (the self-attested skip token does NOT). CFP-044.
            if armed and not reviewed and not env_skip:
                print('[skill-gate] BLOCKED: a review/audit was requested this '
                      'session (.review_intent armed) but no scrutinize/'
                      'skeptical_reviewer skill was loaded. Load the owning skill '
                      'and run the review before closing — or set '
                      'HARNESS_SKIP_REVIEW_GATE=1 to override.', file=sys.stderr)
                return 2

            # 2b: a code artifact was BUILT this task (src/ or scripts/ changed
            #     vs .scope_baseline) but no review ran — the PROACTIVE close
            #     case (CFP-044 #4: an undemanded build must still be reviewed).
            #     Clears on a real review, the env override, OR an explicit
            #     auditable `scrutinize-skip` token written into the
            #     active_thread.md payload (self-attested, logged there).
            skip_token = 'scrutinize-skip' in new_string
            if (not armed and not reviewed and not env_skip and not skip_token
                    and _code_changed_this_task(root)):
                print('[skill-gate] BLOCKED: this task built a code artifact '
                      '(src/ or scripts/ changed vs the task-start baseline) but '
                      'no scrutinize/skeptical_reviewer review ran before close. '
                      'Load the owning skill and scrutinize the change — or write '
                      'an explicit "scrutinize-skip: <reason>" line into '
                      'active_thread.md (audit trail) — or set '
                      'HARNESS_SKIP_REVIEW_GATE=1.', file=sys.stderr)
                return 2

        # --- Gate 1: ownership gate (harness/skill file edits) ---
        required = _required_owners(rel, root)
        if required and not (required & today):
            print('[skill-gate] BLOCKED: editing %s requires one of %s to be '
                  'active (loaded today). Active skills today: %s. Load the '
                  'owning SKILL.md first (CFP-020/043).'
                  % (rel, sorted(required), sorted(today) or 'none'),
                  file=sys.stderr)
            return 2
    except Exception:
        return 0  # fail-open: never brick a tool call

    return 0


def self_test():
    """T-350: unit + behavioral checks for the two review gates. Asserts BOTH
    that a missing proof BLOCKS and that a hash-matched proof ALLOWS — so a broken
    hash/parse fails LOUDLY instead of silently fail-open-allowing (F2 · the
    detect-only-guard trap). Runs the real script as a subprocess in a temp
    harness-project (mirrors phase_gate.self_test)."""
    import tempfile
    import shutil
    fails = []

    def chk(name, cond):
        print(('  ok   ' if cond else '  FAIL ') + name)
        if not cond:
            fails.append(name)

    def run(tmp, payload, extra_env=None):
        env = dict(os.environ)
        env['CLAUDE_PROJECT_DIR'] = tmp
        env.pop('HARNESS_SKIP_REVIEW_GATE', None)
        if extra_env:
            env.update(extra_env)
        return subprocess.run(
            [sys.executable, os.path.abspath(__file__)],
            input=json.dumps(payload).encode(),
            capture_output=True, cwd=tmp, env=env).returncode

    tmp = tempfile.mkdtemp(prefix='sg_t350_')
    try:
        os.makedirs(os.path.join(tmp, '.sessions'))
        open(os.path.join(tmp, 'AGENTS.md'), 'w').write('harness\n')
        today = datetime.date.today().isoformat()
        plan = os.path.join(tmp, '.sessions', 'mece_plan.md')

        # --- unit: stripped-hash identity semantics ---
        open(plan, 'w').write('date: %s\n- [ ] S1\n- [ ] S2\n' % today)
        hb = _stripped_plan_hash(tmp)
        open(plan, 'w').write('date: %s\n- [X] S1\n- [/] S2\n' % today)
        chk('unit: checkbox tick keeps stripped-hash stable',
            _stripped_plan_hash(tmp) == hb)
        open(plan, 'w').write('date: %s\n- [-] S1\n- [ ] S2\n' % today)
        chk('unit: section cancel [-] keeps stripped-hash stable (T-358)',
            _stripped_plan_hash(tmp) == hb)
        open(plan, 'w').write('date: %s\n- [ ] S1 DIFFERENT CONTENT\n' % today)
        chk('unit: real content change moves stripped-hash',
            _stripped_plan_hash(tmp) != hb)

        # reset to a known 2-section plan
        open(plan, 'w').write('date: %s\n- [ ] S1\n- [ ] S2\n' % today)
        h = _stripped_plan_hash(tmp)
        slog = os.path.join(tmp, '.sessions', '.scrutinize_log')
        sok = os.path.join(tmp, '.sessions', '.skeptical_ok')

        # --- Gate 4: per-section scrutinize ---
        p_mark = {'tool_name': 'Edit', 'tool_input': {
            'file_path': '.sessions/mece_plan.md', 'new_string': '- [X] S1'}}
        chk('gate4 no-proof -> BLOCK', run(tmp, p_mark) == 2)
        open(slog, 'w').write('S1|%s\n' % h)
        chk('gate4 hash-matched proof -> ALLOW', run(tmp, p_mark) == 0)
        open(slog, 'w').write('S1|deadbeef\n')
        chk('gate4 wrong-hash proof -> BLOCK', run(tmp, p_mark) == 2)
        chk('gate4 env-skip -> ALLOW',
            run(tmp, p_mark, {'HARNESS_SKIP_REVIEW_GATE': '1'}) == 0)

        # --- Gate 3: skeptical entry ---
        p_edit = {'tool_name': 'Edit', 'tool_input': {
            'file_path': 'CLAUDE.md', 'new_string': 'x'}}
        chk('gate3 no-skeptical -> BLOCK', run(tmp, p_edit) == 2)
        open(sok, 'w').write('verdict:go hash:%s\n' % h)
        chk('gate3 hash-matched skeptical_ok -> ALLOW', run(tmp, p_edit) == 0)
        open(plan, 'a').write('- [ ] S3 GENUINELY NEW\n')     # content change
        chk('gate3 plan-content-change invalidates proof -> BLOCK',
            run(tmp, p_edit) == 2)
        p_out = {'tool_name': 'Write', 'tool_input': {
            'file_path': '/tmp/sg_t350_out.txt', 'content': 'x'}}
        chk('gate3 out-of-repo edit -> ALLOW (never gated)', run(tmp, p_out) == 0)
        chk('gate3 env-skip -> ALLOW',
            run(tmp, p_edit, {'HARNESS_SKIP_REVIEW_GATE': '1'}) == 0)

        # --- fail-open: malformed stdin -> ALLOW ---
        env = dict(os.environ)
        env['CLAUDE_PROJECT_DIR'] = tmp
        rc = subprocess.run([sys.executable, os.path.abspath(__file__)],
                            input=b'not json', capture_output=True,
                            cwd=tmp, env=env).returncode
        chk('fail-open malformed stdin -> ALLOW', rc == 0)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print('[skill-gate] self-test: %s'
          % ('PASS' if not fails else 'FAIL %s' % fails))
    return 0 if not fails else 1


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # loud fail-open (T-355)
        try:
            import gatelib; gatelib.report_fail_open("skill_gate", exc)
        except Exception:      # F1: helper failure must not crash the gate
            sys.stderr.write("[gate-error] gate:skill_gate · fail-open(allowed) · %r\n" % (exc,))
        sys.exit(0)
