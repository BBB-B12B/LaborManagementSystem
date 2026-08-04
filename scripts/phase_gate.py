#!/usr/bin/env python3
"""phase_gate.py — PreToolUse phase-transition + never-full-load + close gate.

T-312 S3: extracted verbatim from the inline `python3 -c` hook in
.claude/settings.json so the plugin can reference it as a file and add the
non-harness-project guard as the first statement of main(). The project's own
.claude/settings.json keeps its inline copy unchanged (it only ever runs inside
this harness repo, where the gate should run); the PLUGIN hooks.json points here.

Behavior (unchanged from the inline version):
  - Read of a Never-Full-Load file            -> exit 1 (block)
  - Edit/Write/NotebookEdit outside .sessions/ -> require gather_complete.md +
    mece_plan.md dated today, else exit 1
  - Edit/Write of active_thread.md 'phase: done' -> close-gate checks
    (.close_checklist_ack, index drift, CFP log), else exit 1
  - everything else                            -> exit 0 (allow)
"""
import json
import sys
import os
import re
import subprocess

# T-312 S3: resolve the harness-project marker (sibling engine module).
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
try:
    from harness_paths import is_harness_project as _is_harness_project
except Exception:  # resolver unavailable -> preserve legacy behavior (enforce)
    def _is_harness_project():
        return True

PROHIBITED = [
    'knowledge/index_variables.json',
    'knowledge/index_files.json',
    'CODING_FAILURE_PATTERNS.md',
    'docs/master_roadmap.md',
    'INVARIANTS.md',
    'knowledge/error_index.md',
]


def _resolve_root():
    root = os.environ.get('CLAUDE_PROJECT_DIR')
    if not root:
        try:
            root = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
        except Exception:
            root = os.getcwd()
    return root


def _require_fresh_plan(root):
    """Exit 2 if gather_complete.md or mece_plan.md is missing/stale; else return."""
    today = __import__('datetime').date.today().isoformat()
    gather = os.path.join(root, '.sessions', 'gather_complete.md')
    mece = os.path.join(root, '.sessions', 'mece_plan.md')
    errors = []
    if not os.path.exists(gather):
        errors.append('[gate] gather_complete.md missing — run Phase 1 first')
    elif today not in open(gather).read():
        errors.append('[gate] gather_complete.md stale (not today) — re-run Phase 1')
    if not os.path.exists(mece):
        errors.append('[gate] mece_plan.md missing — run Phase 2 first')
    elif today not in open(mece).read():
        errors.append('[gate] mece_plan.md stale (not today) — re-run Phase 2')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(2)


def _repo_relpath(target, root):
    """Repo-relative posix path if target is inside root, else None. A relative
    target is assumed cwd=repo-root (where hooks run)."""
    t = target.replace(os.sep, '/')
    r = root.replace(os.sep, '/').rstrip('/')
    if t.startswith('/'):
        if r and t.startswith(r + '/'):
            return t[len(r) + 1:]
        return None                       # absolute path outside the repo
    while t.startswith('./'):
        t = t[2:]
    if t.startswith('../'):
        return None                       # escapes the repo
    return t


def _bash_writes_gated_path(cmd, root):
    """True if a Bash command writes/mutates a repo path outside .sessions/ (T-342).
    Extraction is reused from danger_gate (single source); repo-scope policy local."""
    if _HERE not in sys.path:
        sys.path.insert(0, _HERE)
    try:
        import danger_gate
    except Exception:
        return False   # extractor unavailable → do not block (ordering gate fails open)
    for t in danger_gate.bash_write_targets(cmd):
        rp = _repo_relpath(t, root)
        if rp is None:
            continue                      # outside repo (e.g. /tmp) → ignore
        if rp == '.sessions' or rp.startswith('.sessions/'):
            continue                      # session bookkeeping → allowed
        return True
    return False


def main():
    if not _is_harness_project():
        sys.exit(0)  # T-312 S3: plugin-global no-op on non-harness projects

    data = json.load(sys.stdin)
    tool = data.get('tool_name', '')
    file_path = data.get('tool_input', {}).get('file_path', '') or data.get('tool_input', {}).get('notebook_path', '')
    rel_path = file_path.replace(os.sep, '/').lstrip('/')

    if tool == 'Read':
        ti = data.get('tool_input', {})
        has_range = ti.get('offset') is not None or ti.get('limit') is not None
        for p in PROHIBITED:
            if rel_path.endswith(p) or p in rel_path:
                if has_range:
                    sys.exit(0)  # offset/limit read is allowed per R5 (only full reads are blocked)
                print(f'[gate] never-full-load: {p} is prohibited — use grep/offset only', file=sys.stderr)
                sys.exit(2)
        sys.exit(0)

    if tool not in ('Edit', 'Write', 'NotebookEdit', 'Bash'):
        sys.exit(0)

    # T-342: a Bash command that WRITES into a repo path outside .sessions/ is
    # phase-gated too (closes the old `tool not in (Edit,Write,...)` Bash hole).
    # Reads and .sessions/ writes pass. Extraction is single-sourced in danger_gate.
    if tool == 'Bash':
        cmd = data.get('tool_input', {}).get('command', '') or ''
        root_b = _resolve_root()
        if _bash_writes_gated_path(cmd, root_b):
            _require_fresh_plan(root_b)   # exits 2 if stale/missing
        sys.exit(0)

    # Close-gate: block phase:done write until .close_checklist_ack exists
    if tool in ('Edit', 'Write') and ('active_thread.md' in rel_path or rel_path.endswith('active_thread.md')):
        new_string = data.get('tool_input', {}).get('new_string', '') or data.get('tool_input', {}).get('content', '')
        if 'phase: done' in new_string:
            root_cg = os.environ.get('CLAUDE_PROJECT_DIR')
            if not root_cg:
                try:
                    root_cg = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
                except Exception:
                    root_cg = os.getcwd()
            ack = os.path.join(root_cg, '.sessions', '.close_checklist_ack')
            if not os.path.exists(ack):
                print('[close-gate] BLOCKED: .close_checklist_ack missing — must Read mece_plan_schema.md §Close Checklist + touch .sessions/.close_checklist_ack before writing phase: done', file=sys.stderr)
                sys.exit(2)
            if not os.environ.get('HARNESS_SKIP_INDEX_BLOCK'):
                try:
                    chk = subprocess.run(['python3', os.path.join(os.environ.get('HARNESS_ENGINE_ROOT') or root_cg, 'scripts', 'index_reconcile.py'), '--check'], capture_output=True, text=True, timeout=40)
                    if chk.returncode == 2:
                        sys.stderr.write(chk.stderr)
                        print('[close-gate] BLOCKED: index/doc-ref drift unhealed - run python3 scripts/index_reconcile.py to heal, then retry (or HARNESS_SKIP_INDEX_BLOCK=1 to override).', file=sys.stderr)
                        sys.exit(2)
                except Exception:
                    pass
            try:
                cfp_touched = os.path.join(root_cg, '.sessions', '.cfp_touched')
                block_cfp = False
                if os.path.exists(cfp_touched) and not os.environ.get('HARNESS_SKIP_CFP_BLOCK'):
                    _lp = os.path.join(root_cg, '.sessions', 'self_improve_log.md')
                    _td = __import__('datetime').date.today().isoformat()
                    _logged = (os.path.exists(_lp) and __import__('datetime').date.fromtimestamp(os.path.getmtime(_lp)).isoformat() == _td)
                    block_cfp = not _logged
            except Exception:
                block_cfp = False
            if block_cfp:
                print('[close-gate] BLOCKED: a CFP status changed this session (.cfp_touched) but self_improve_log.md not updated today - record the solution (loop stage 5) before phase:done, or HARNESS_SKIP_CFP_BLOCK=1 to override.', file=sys.stderr)
                sys.exit(2)

    root_ew = _resolve_root()
    if _repo_relpath(file_path, root_ew) is None:
        sys.exit(0)                       # out-of-repo (scratchpad/tmp) → not phase-gated (mirror Bash branch)
    if rel_path.startswith('.sessions/'):
        sys.exit(0)
    if '.sessions/' in rel_path:
        sys.exit(0)
    _require_fresh_plan(root_ew)
    sys.exit(0)


def _extract_inline_body(root):
    """The python source inside the settings.json inline phase-gate `-c "..."`."""
    s = json.load(open(os.path.join(root, '.claude', 'settings.json')))
    for h in s.get('hooks', {}).get('PreToolUse', []):
        for hk in h.get('hooks', []):
            c = hk.get('command', '')
            if 'never-full-load' in c and 'gather_complete' in c:
                m = re.match(r'\s*python3\s+-c\s+"(.*)"\s*$', c, re.DOTALL)
                return m.group(1) if m else None
    return None


def self_test():
    """T-342 S3: unit checks + BEHAVIORAL PARITY between phase_gate.py and the
    settings.json inline copy (feeds an identical battery to both, asserts equal
    exit codes) — closes the T-337 'phase-gate parity' Pool item. The parity run
    uses a temp harness-project so a STALE plan can be exercised (the discriminating
    case: a Bash READ must pass while a Bash WRITE into src/ blocks)."""
    import tempfile
    import shutil
    root = _resolve_root()
    fails = []

    def chk(name, cond):
        print(('  ok   ' if cond else '  FAIL ') + name)
        if not cond:
            fails.append(name)

    # --- unit: write-target repo-scope policy ---
    sedi = 's' + 'ed -i s/a/b/ src/foo.ts'
    chk('unit: sed -i src → gated', _bash_writes_gated_path(sedi, root) is True)
    chk('unit: read grep src → not gated',
        _bash_writes_gated_path('grep foo src/foo.ts', root) is False)
    chk('unit: write .sessions → not gated',
        _bash_writes_gated_path('cat x > .sessions/n.md', root) is False)
    chk('unit: write /tmp → not gated',
        _bash_writes_gated_path('cat x > /tmp/o', root) is False)

    # --- behavioral parity: build two temp harness-projects (stale + fresh) ---
    body = _extract_inline_body(root)
    chk('inline body extracted', bool(body))
    battery = [
        ('bash-write-src', {'tool_name': 'Bash', 'tool_input': {'command': sedi}}),
        ('bash-read-src', {'tool_name': 'Bash', 'tool_input': {'command': 'grep foo src/foo.ts'}}),
        ('bash-write-sessions', {'tool_name': 'Bash', 'tool_input': {'command': 'cat x > .sessions/n.md'}}),
        ('bash-nonwrite', {'tool_name': 'Bash', 'tool_input': {'command': 'ls -la'}}),
        ('edit-src', {'tool_name': 'Edit', 'tool_input': {'file_path': 'src/foo.ts', 'new_string': 'x'}}),
        ('edit-sessions', {'tool_name': 'Edit', 'tool_input': {'file_path': '.sessions/x.md', 'new_string': 'x'}}),
        ('write-outside', {'tool_name': 'Write', 'tool_input': {'file_path': 'CLAUDE.md', 'content': 'x'}}),
        ('write-outrepo', {'tool_name': 'Write', 'tool_input': {'file_path': '/tmp/pg_out_x.txt', 'content': 'x'}}),
        ('read-prohibited-full', {'tool_name': 'Read', 'tool_input': {'file_path': 'docs/master_roadmap.md'}}),
        ('read-prohibited-ranged', {'tool_name': 'Read', 'tool_input': {'file_path': 'docs/master_roadmap.md', 'offset': 1, 'limit': 5}}),
    ]
    if body:
        for label, fresh in (('stale', False), ('fresh', True)):
            tmp = tempfile.mkdtemp(prefix='pgpar_%s_' % label)
            try:
                os.makedirs(os.path.join(tmp, '.sessions'))
                os.makedirs(os.path.join(tmp, 'scripts'))
                open(os.path.join(tmp, 'AGENTS.md'), 'w').write('harness\n')
                # the inline resolves danger_gate from <root>/scripts → give it one
                shutil.copy(os.path.join(_HERE, 'danger_gate.py'),
                            os.path.join(tmp, 'scripts', 'danger_gate.py'))
                stamp = (__import__('datetime').date.today().isoformat()
                         if fresh else '2000-01-01')
                for f in ('gather_complete.md', 'mece_plan.md'):
                    open(os.path.join(tmp, '.sessions', f), 'w').write('date: %s\n' % stamp)
                env = dict(os.environ)
                env['CLAUDE_PROJECT_DIR'] = tmp
                for name, payload in battery:
                    j = json.dumps(payload).encode()
                    ri = subprocess.run([sys.executable, '-c', body], input=j,
                                        capture_output=True, cwd=tmp, env=env).returncode
                    rf = subprocess.run([sys.executable, os.path.abspath(__file__)],
                                        input=j, capture_output=True, cwd=tmp, env=env).returncode
                    chk('parity[%s] %s (inline=%d file=%d)' % (label, name, ri, rf),
                        ri == rf)
                    if name == 'write-outrepo':   # gap #3 fix: out-of-repo Write not phase-gated
                        chk('fix[%s] write-outrepo not gated' % label, ri == 0 and rf == 0)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)

    print('[phase-gate] self-test: %s'
          % ('PASS' if not fails else 'FAIL %s' % fails))
    return 0 if not fails else 1


if __name__ == '__main__':
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # loud fail-open (T-355)
        try:
            import gatelib; gatelib.report_fail_open("phase_gate", exc)
        except Exception:      # F1: helper failure must not crash the gate
            sys.stderr.write("[gate-error] gate:phase_gate · fail-open(allowed) · %r\n" % (exc,))
        sys.exit(0)
