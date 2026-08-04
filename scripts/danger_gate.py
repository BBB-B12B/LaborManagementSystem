#!/usr/bin/env python3
"""
danger_gate.py — T-304 PreToolUse HARD block for headless / autonomous-loop runs.

Problem it solves (turns the T-297 R14/R15 "Headless:" clause from prose into a
real block): when the harness runs headless (the autonomous loop is driving, with
no human to type the confirmation word a [gate]/[db-gate] demands), a destructive
or gated tool call cannot satisfy the human-confirm contract. Without a hard block
the loop could talk itself into "yes" and self-confirm its own destructive action.
This hook intercepts such a call, BLOCKS it, and escalates it to a LOCAL review
queue (.sessions/review_queue/) while tripping the loop red-lever
(.sessions/loop_paused) so a human reviews it out-of-band.

Design (per T-304 skeptical review — sr #1..#5):
- Interactive session (NOT headless): exit 0 — never break human work; the human
  uses the normal [gate]/[db-gate] flow. (sr #4: fail-open only when interactive.)
- Headless + confirmed destructive/gated: escalate + BLOCK (exit 2).
- Headless + this hook's OWN error: fail-CLOSED = escalate + block (a safety guard
  must not wave danger through on its own bug — sr #4).
- Headless detection is SELF-CONTAINED (sr #1): HARNESS_HEADLESS=1 env flag OR a
  FRESH .sessions/loop_active sentinel (mtime < 25 min, same window the preflight
  doorman uses). No dependency on an external setter that could ship inert.
- Single gate definition (sr: one source, no 2nd copy): R14 core list + the domain
  pack's `## paths protected:` field, parsed at runtime.
- Per-call scope only (sr #2): cross-call "batch > 5 files" is NOT detectable in a
  per-call hook, so it is out of scope here.

Block exit code = 2: Claude Code treats PreToolUse exit 2 as a hard block (stderr
is fed back to the model and the tool is stopped). exit 1 is a non-blocking error,
so the guaranteed-block code is 2.

Stdlib only. Does NOT touch the existing inline PreToolUse hook.
"""
import json
import sys
import os
import re
import subprocess
import datetime
import hashlib

BLOCK = 2       # Claude Code PreToolUse: exit 2 = hard block (stderr → model)
ALLOW = 0
STALE_MIN = 25  # loop_active freshness window — matches loop_engineer_preflight
ACK_TTL_SEC = 600  # T-342: interactive gate ack lifetime (10 min · one-shot)


def project_root():
    root = os.environ.get('CLAUDE_PROJECT_DIR')
    if root:
        return root
    try:
        return subprocess.check_output(
            ['git', 'rev-parse', '--show-toplevel'],
            stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
    except Exception:
        return os.getcwd()


def is_headless(root):
    """True if the autonomous loop is driving (no human to confirm a gate).

    HARNESS_HEADLESS=1 is authoritative and MUST win first: a genuine autonomous
    loop is REQUIRED to export it (see loop_engineer). T-358 (a): after that, an
    interactive front-end being present (a human at the keyboard) forces NOT-headless
    -- otherwise a stale-but-fresh `loop_active` marker left behind by a dead loop
    would misclassify a HUMAN's protected edit as headless and hard-block it with no
    ack path. Because `loop_active` alone is no longer trusted once a human marker is
    seen, the loop MUST set HARNESS_HEADLESS=1 (loop_active can no longer be its sole
    headless signal).
    """
    if os.environ.get('HARNESS_HEADLESS') == '1':
        return True
    # T-358 (a): a human front-end attached -> never headless (HARNESS_HEADLESS is
    # handled above and still wins). os.environ.get never raises; the guard is
    # belt-and-suspenders so any error falls through to the current behavior below.
    try:
        if (os.environ.get('CLAUDE_CODE_ENTRYPOINT') in ('cli', 'claude-desktop', 'vscode')
                or os.environ.get('CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL') == 'true'):
            return False
    except Exception:
        pass
    sentinel = os.path.join(root, '.sessions', 'loop_active')
    try:
        if os.path.exists(sentinel):
            age_min = (datetime.datetime.now().timestamp()
                       - os.path.getmtime(sentinel)) / 60.0
            if age_min < STALE_MIN:
                return True
    except Exception:
        pass
    return False


def _parse_pack_protected(pack_path, paths):
    """Append one domain pack's `## paths protected:` entries to paths (best-effort)."""
    in_paths = False
    for line in open(pack_path, encoding='utf-8'):
        s = line.strip()
        if s.startswith('## paths'):
            in_paths = True
            continue
        if in_paths:
            if s.startswith('## '):      # reached the next section
                break
            m = re.match(r'-\s*protected:\s*(\S+)', s)
            if m:
                paths.append(m.group(1).rstrip('/') + '/')


def protected_paths(root):
    """Single source of truth: R14 core list + EVERY active domain pack's `## paths protected:`.

    T-337: active packs are resolved via topic_bootstrap.detect_domains (the same
    detector project_init uses) — NOT a hardcoded coding.md — so a non-coding
    consumer's protected paths are honored too. Fail-safe: any failure leaves the
    R14 core list enforced.

    T-357: an mtime+size-guarded disk cache (.sessions/.protected_paths_cache,
    gitignored) skips the detect+parse on the hot path when no domain/*.md changed.
    FULLY fail-open: any error or a cache miss falls through to the full compute below
    — the cache only avoids re-parsing, it NEVER changes WHICH paths are protected
    (R14 correctness is absolute).
    """
    import glob as _glob
    _cache = os.path.join(root, '.sessions', '.protected_paths_cache')
    _sig = None
    try:
        _packs = sorted(_glob.glob(os.path.join(root, 'domain', '*.md')))
        _sig = '|'.join('%s:%r:%d' % (os.path.basename(p), os.path.getmtime(p),
                                      os.path.getsize(p)) for p in _packs)
        with open(_cache, encoding='utf-8') as _f:
            _c = json.load(_f)
        if _c.get('sig') == _sig and isinstance(_c.get('paths'), list):
            return list(_c['paths'])  # HIT — packs unchanged since last compute
    except Exception:
        pass  # miss / unreadable / cache absent -> recompute below (fail-open)

    paths = ['knowledge/', '.sessions/mece_plan.md']  # R14 core (CLAUDE.md)
    try:
        import sys
        from pathlib import Path
        _here = os.path.dirname(os.path.abspath(__file__))
        if _here not in sys.path:
            sys.path.insert(0, _here)
        from topic_bootstrap import detect_domains
        for name in detect_domains(Path(root)):
            pack = os.path.join(root, 'domain', name + '.md')
            try:
                _parse_pack_protected(pack, paths)
            except Exception:
                pass  # one unreadable pack never drops the others / R14 core
    except Exception:
        pass  # detector unavailable — R14 core still enforced
    if _sig is not None:  # best-effort cache write (never fatal)
        try:
            with open(_cache, 'w', encoding='utf-8') as _f:
                json.dump({'sig': _sig, 'paths': paths}, _f)
        except Exception:
            pass
    return paths


def to_relpath(target, root):
    """Normalize a target (absolute OR relative) to a repo-relative posix path.
    Claude Code passes ABSOLUTE file_path to Edit/Write — must strip the repo
    root or a protected prefix match never fires (scrutinize GAP 1)."""
    t = target.replace(os.sep, '/')
    r = root.replace(os.sep, '/').rstrip('/')
    if r and t.startswith(r + '/'):
        t = t[len(r) + 1:]
    while t.startswith('./') or t.startswith('/'):
        t = t[2:] if t.startswith('./') else t[1:]
    return t


def hits_protected(target, protected, root):
    t = to_relpath(target, root)
    for p in protected:
        pp = p.rstrip('/')
        if t == pp or t.startswith(pp + '/'):
            return p
    return None


# Destructive verbs (incl. python shutil.rmtree / os.unlink), find -delete,
# output redirect, in-place sed, destructive git (scrutinize GAP 2 broadened it
# beyond the rm/mv/shred/truncate-only original).
DESTRUCTIVE_BASH = re.compile(
    r'\b(rm|rmdir|mv|shred|truncate|rmtree|unlink|dd)\b'
    r'|-delete\b'
    r'|(?<![-=&2>])>>?\|?\s*[^>&|\s]'   # redirect `>`/`>>`/`>|` write; skip `->` `=>` and stderr `2>`/`&>`/`2>>` (stdout `1>`/bare `>` still caught)
    r'|\bsed\b[^|]*\s-i\b'
    r'|\bgit\b[^|]*\b(checkout|clean|reset)\b',
    re.IGNORECASE)


def bash_hits_protected(cmd, protected):
    """A protected path referenced at a PATH BOUNDARY in a Bash command.
    Boundary match avoids 'knowledge' matching inside 'acknowledge' (GAP 3)."""
    for p in protected:
        pp = p.rstrip('/')
        if pp and re.search(r'(?<![\w.])' + re.escape(pp) + r'(?![\w])', cmd):
            return p
    return None


# T-342: shared Bash write-target extraction (single source — the phase gate and
# its settings.json inline copy both import this, so their Bash coverage can never
# silently diverge in the extraction step). Deliberately conservative: it reports
# paths a command WRITES/MUTATES, not paths it merely READS — so a read like
# `grep x src/f > /tmp/o` yields {/tmp/o}, never src/f.
_WT_REDIR = re.compile(r'(?<![-=&2>])>>?\|?\s*("?)([^\s;|&>"\']+)')  # `>`/`>>`/`>|` path (skip `->`/`=>` and stderr `2>`/`&>`, mirror DESTRUCTIVE_BASH)
_WT_SEDI = re.compile(r'\bsed\b[^|;&]*?\s-i\b([^|;&]*)')       # in-place sed → file args
_WT_MUTATE = re.compile(                                        # commands that write their args
    r'\b(tee|cp|mv|install|rsync|touch|mkdir|rm|rmdir|ln)\b([^|;&]*)')
_WT_DD = re.compile(r'\bdd\b[^|;&]*?\bof=("?)([^\s;|&"\']+)')    # `dd ... of=PATH` writes PATH


def _strip_quoted(cmd):
    """Blank single/double-quoted spans so pattern DATA (grep/sed/awk args,
    echoed strings) is never mis-read as a command or redirect — e.g. the word
    `install` inside `grep "install\\|rm"` is data, not the install command.
    Best-effort: unbalanced quotes leave the tail intact (fail toward detecting)."""
    out = re.sub(r'"[^"]*"', ' ', cmd)
    out = re.sub(r"'[^']*'", ' ', out)
    return out


def bash_write_targets(cmd):
    """Best-effort set of filesystem paths a Bash command writes/mutates.
    Quoted spans are blanked first (via _strip_quoted) so mutate keywords / `>`
    that live inside a grep/sed/awk PATTERN are not treated as write targets —
    the fix for the phase-gate over-blocking read-only greps (T-346)."""
    scan = _strip_quoted(cmd)
    targets = set()
    for m in _WT_REDIR.finditer(scan):
        targets.add(m.group(2))
    for m in _WT_SEDI.finditer(scan):
        for tok in m.group(1).split():        # sed -i edits each file arg in place
            if not tok.startswith('-'):
                targets.add(tok.strip('"\''))
    for m in _WT_MUTATE.finditer(scan):
        for tok in m.group(2).split():         # non-option args are write targets
            if not tok.startswith('-'):
                targets.add(tok.strip('"\''))
    for m in _WT_DD.finditer(scan):            # dd of=PATH — write target is the of= arg
        targets.add(m.group(2))
    return {t for t in targets if t}


# T-356: blank ONLY a `git commit` message ARGUMENT (the -m/-am/--message body) so
# a message text that happens to contain `rm -rf knowledge` / `sed -i src/x` is not
# scanned as a real command. Flag-anchored + argument-scoped on purpose: it does NOT
# strip all quoted spans (that would regress T-342 interpreter-hidden `rmtree`
# detection and open a compound bypass like `commit -m "x" && rm -rf knowledge`).
_COMMIT_MSG = re.compile(
    r'(?:--message|-am|-ma|-m)\s*=?\s*'
    r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|\S+)')


def match_gate(tool, tool_input, protected, root):
    """Return (reason, target) if this call is destructive/gated, else None."""
    if tool in ('Edit', 'Write', 'NotebookEdit'):
        fp = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
        hit = hits_protected(fp, protected, root)
        if hit:
            return ('%s on protected path %s' % (tool, hit), fp)
        return None
    if tool == 'Bash':
        cmd = tool_input.get('command', '') or ''
        # For the destructive-verb SCAN only, blank a git-commit message body so its
        # text can't masquerade as a command. bash_hits_protected still runs on the
        # RAW cmd — a genuine destructive verb outside the message stays caught.
        scan = cmd
        if re.search(r'\bgit\b', cmd) and re.search(r'\bcommit\b', cmd):
            scan = _COMMIT_MSG.sub(' ', cmd)
        if DESTRUCTIVE_BASH.search(scan):
            hit = bash_hits_protected(cmd, protected)
            if hit:
                return ('destructive Bash touching protected path %s' % hit,
                        cmd[:200])
    return None


def escalate(root, tool, reason, target, headless_via):
    """Write a local review-PR record + trip the loop red-lever. Best-effort."""
    stamp = datetime.datetime.now().strftime('%Y%m%dT%H%M%S')
    qdir = os.path.join(root, '.sessions', 'review_queue')
    try:
        os.makedirs(qdir, exist_ok=True)
        safe_tool = re.sub(r'[^A-Za-z0-9]', '', tool) or 'tool'
        rec = os.path.join(qdir, '%s-%s.md' % (stamp, safe_tool))
        with open(rec, 'w', encoding='utf-8') as f:
            f.write('# Danger-gate escalation — %s\n\n' % stamp)
            f.write('- tool: %s\n' % tool)
            f.write('- reason: %s\n' % reason)
            f.write('- headless_via: %s\n' % headless_via)
            f.write('- target:\n\n```\n%s\n```\n\n' % target)
            f.write('Status: BLOCKED by scripts/danger_gate.py (T-304). '
                    'A human must review and, if safe, run it manually. '
                    'The loop is paused (.sessions/loop_paused) until then.\n')
    except Exception:
        pass
    try:
        open(os.path.join(root, '.sessions', 'loop_paused'), 'a').close()
    except Exception:
        pass


# --- T-342: interactive gate ack-token ------------------------------------
# Closes the old `if not headless: return ALLOW` hole. In interactive mode a
# destructive/gated call now HARD-BLOCKS (exit 2) until an explicit human "yes"
# arms a one-shot, command-bound, TTL'd ack via `--ack <cmd>`; the retry then
# consumes it and proceeds. A stale or mismatched ack can NEVER greenlight a
# different action (command-hash binding + TTL + one-shot consume).
def _norm(s):
    """Whitespace-collapse so trivial spacing differences don't defeat the ack."""
    return ' '.join((s or '').split())


def _ack_candidates(tool, tool_input, root):
    """The set of keys an ack may legitimately bind to for THIS call.
    Bash → the normalized command. Edit/Write → both the absolute path (as Claude
    Code sends it) AND the repo-relpath, so the agent may arm with either form."""
    if tool == 'Bash':
        return {_norm(tool_input.get('command', ''))}
    fp = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
    return {_norm(fp), _norm(to_relpath(fp, root))}


def _norm_key(tool, tool_input, root):
    """The canonical key echoed in the block message (what to pass to --ack)."""
    if tool == 'Bash':
        return _norm(tool_input.get('command', ''))
    fp = tool_input.get('file_path') or tool_input.get('notebook_path') or ''
    return _norm(to_relpath(fp, root))


def _ack_hash(norm_key):
    return hashlib.sha256(norm_key.encode('utf-8')).hexdigest()


def _ack_path(root):
    return os.path.join(root, '.sessions', '.gate_ack')


def arm_ack(root, key):
    """Write a one-shot ack bound to key (mtime = the TTL clock)."""
    p = _ack_path(root)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(_ack_hash(_norm(key)) + '\n')


def _ack_stored(root):
    """(hash, True) if a FRESH ack exists; (None, False) otherwise. Clears expiry."""
    p = _ack_path(root)
    if not os.path.exists(p):
        return (None, False)
    try:
        age = datetime.datetime.now().timestamp() - os.path.getmtime(p)
        stored = open(p, encoding='utf-8').read().strip()
    except Exception:
        return (None, False)
    if age >= ACK_TTL_SEC:
        try:
            os.remove(p)          # expired → clear so it can't be resurrected
        except Exception:
            pass
        return (None, False)
    return (stored, True)


def ack_valid(root, tool, tool_input):
    """True if a fresh ack bound to THIS exact call is present (does NOT consume)."""
    stored, fresh = _ack_stored(root)
    if not fresh or not stored:
        return False
    return stored in {_ack_hash(c) for c in _ack_candidates(tool, tool_input, root)}


def consume_ack(root):
    """One-shot: remove the ack after a successful match."""
    try:
        os.remove(_ack_path(root))
    except Exception:
        pass


def classify(root, headless, tool, tool_input):
    """Pure verdict (no escalate/consume side effects) → (verdict, reason, target, key).
    verdict ∈ allow | escalate | has-ack | need-ack."""
    hit = match_gate(tool, tool_input, protected_paths(root), root)
    if hit is None:
        return ('allow', None, None, None)
    reason, target = hit
    if headless:
        return ('escalate', reason, target, None)      # headless: strict, unchanged
    # Interactive (human present): gate only genuinely destructive/overwrite ops —
    # destructive Bash + full-file overwrite (Write/NotebookEdit). A SURGICAL Edit is
    # neither a delete nor an overwrite (R14's own wording), and routine harness
    # bookkeeping (e.g. checkboxing .sessions/mece_plan.md) is an Edit — so it defers
    # to Claude Code's own permission prompt + the phase gate, NOT the ack. This
    # closes the destructive-Bash / overwrite hole without making the harness
    # unusable (an ack on every plan checkbox). Headless still escalates Edit too.
    if tool == 'Edit':
        return ('allow', reason, target, None)
    key = _norm_key(tool, tool_input, root)
    if ack_valid(root, tool, tool_input):
        return ('has-ack', reason, target, key)
    return ('need-ack', reason, target, key)


def main():
    root = project_root()
    if os.environ.get('HARNESS_SKIP_DANGER_GATE') == '1':
        return ALLOW  # explicit emergency escape (parity with git_guard's GIT_GUARD_OK)
    headless = False
    try:
        headless = is_headless(root)
        data = json.load(sys.stdin)
        tool = data.get('tool_name', '')
        tool_input = data.get('tool_input', {}) or {}
        verdict, reason, target, key = classify(root, headless, tool, tool_input)
        if verdict == 'allow':
            return ALLOW
        if verdict == 'escalate':
            via = ('HARNESS_HEADLESS'
                   if os.environ.get('HARNESS_HEADLESS') == '1' else 'loop_active')
            escalate(root, tool, reason, target, via)
            print('[danger-gate] BLOCKED headless %s: %s '
                  '— escalated to .sessions/review_queue/ + loop paused. '
                  'No self-confirm in headless mode (T-304 · R14/R15).'
                  % (tool, reason), file=sys.stderr)
            return BLOCK
        if verdict == 'has-ack':
            consume_ack(root)      # one-shot — this pass only
            print('[danger-gate] interactive: ack consumed — %s allowed ONCE '
                  '(T-342 · R14/R15).' % reason, file=sys.stderr)
            return ALLOW
        # need-ack → HARD block until a human confirm arms one. The arm must NOT
        # go through a Bash command that re-echoes a destructive string, or it would
        # re-trigger this very gate and deadlock (T-342 scrutinize GAP 1). So the
        # deadlock-free arm path is: WRITE the printed hash to .sessions/.gate_ack
        # (a .sessions write is un-gated by both gates). The --ack CLI stays as a
        # convenience but only for a key with no destructive verb (e.g. an overwrite
        # path); for destructive Bash it would self-block, so prefer the Write path.
        h = _ack_hash(key)
        print('[gate] BLOCKED interactive %s: %s\n'
              'Destructive/gated action — the harness gate enforces here too '
              '(T-342, not prose-only). After an explicit user "yes", arm a one-shot '
              'ack then retry the SAME call. Arm it by WRITING exactly this line to '
              '.sessions/.gate_ack (a .sessions write is un-gated, so it never '
              'deadlocks):\n'
              '  %s\n'
              '(convenience, only when the key has NO destructive verb: '
              'python3 scripts/danger_gate.py --ack %r)\n'
              'ack: one-shot · command-bound · TTL %ds · escape '
              'HARNESS_SKIP_DANGER_GATE=1'
              % (tool, reason, h, key, ACK_TTL_SEC), file=sys.stderr)
        return BLOCK
    except Exception as e:
        # Fail-CLOSED when headless (guard must not pass danger on its own bug);
        # fail-OPEN when interactive (never break human work).
        if headless:
            try:
                escalate(root, 'unknown',
                         'danger_gate internal error: %s' % e, '', 'error')
            except Exception:
                pass
            print('[danger-gate] BLOCKED (fail-closed): internal error in '
                  'headless mode: %s' % e, file=sys.stderr)
            return BLOCK
        return ALLOW


def self_test():
    """T-342: exercise the interactive ack path + headless escalate + allow, with
    NO real stdin and NO review_queue side effects (classify is pure)."""
    import tempfile
    import shutil
    root = tempfile.mkdtemp(prefix='dgtest_')
    os.makedirs(os.path.join(root, '.sessions'), exist_ok=True)
    fails = []

    def chk(name, cond):
        print(('  ok   ' if cond else '  FAIL ') + name)
        if not cond:
            fails.append(name)

    def bash(c):
        return ('Bash', {'command': c})
    try:
        t, ti = bash('rm -rf knowledge/foo')          # hits R14-core protected
        chk('interactive-no-ack->block',
            classify(root, False, t, ti)[0] == 'need-ack')

        arm_ack(root, 'rm -rf knowledge/foo')
        chk('interactive-valid-ack->pass',
            classify(root, False, t, ti)[0] == 'has-ack')
        consume_ack(root)
        chk('ack-one-shot-consumed->block',
            classify(root, False, t, ti)[0] == 'need-ack')

        arm_ack(root, 'rm -rf knowledge/foo')
        old = datetime.datetime.now().timestamp() - (ACK_TTL_SEC + 60)
        os.utime(_ack_path(root), (old, old))
        chk('interactive-stale-ack->block',
            classify(root, False, t, ti)[0] == 'need-ack')

        arm_ack(root, 'rm -rf knowledge/foo')
        t2, ti2 = bash('rm -rf .sessions/mece_plan.md')
        chk('interactive-mismatch-ack->block',
            classify(root, False, t2, ti2)[0] == 'need-ack')
        consume_ack(root)

        # GAP-1 fix: arm by WRITING the block message's printed hash to .gate_ack
        # (the deadlock-free path — no Bash command re-echoes the destructive string)
        printed_hash = _ack_hash(_norm_key('Bash', ti, root))
        open(_ack_path(root), 'w', encoding='utf-8').write(printed_hash + '\n')
        chk('write-hash-arm->pass', classify(root, False, t, ti)[0] == 'has-ack')
        consume_ack(root)

        chk('headless->escalate',
            classify(root, True, t, ti)[0] == 'escalate')

        t3, ti3 = bash('ls -la knowledge')             # non-destructive verb
        chk('non-protected->allow',
            classify(root, False, t3, ti3)[0] == 'allow')

        # interactive: a surgical Edit on a protected path is EXEMPT (defers to the
        # CC prompt + phase gate) — routine plan bookkeeping must not need an ack
        te, tie = ('Edit', {'file_path': os.path.join(root, 'knowledge', 'x.json')})
        chk('interactive-edit-protected->allow',
            classify(root, False, te, tie)[0] == 'allow')
        # but headless stays strict on Edit (escalate) — unchanged
        chk('headless-edit-protected->escalate',
            classify(root, True, te, tie)[0] == 'escalate')
        # a full-file overwrite (Write) IS gated interactively; ack may use relpath
        tw, tiw = ('Write', {'file_path': os.path.join(root, 'knowledge', 'x.json')})
        chk('interactive-write-protected-no-ack->block',
            classify(root, False, tw, tiw)[0] == 'need-ack')
        arm_ack(root, 'knowledge/x.json')              # relpath form of the ack
        chk('write-ack-relpath->pass',
            classify(root, False, tw, tiw)[0] == 'has-ack')
        consume_ack(root)

        # bash_write_targets: writes captured, reads excluded (T-342 · used by phase gate)
        chk('wt-sed-i-target',
            'src/x.ts' in bash_write_targets('sed -i s/a/b/ src/x.ts'))
        chk('wt-redirect-target',
            'src/new.ts' in bash_write_targets('cat foo > src/new.ts'))
        chk('wt-read-excludes-src',
            'src/x.ts' not in bash_write_targets('grep foo src/x.ts > /tmp/o')
            and '/tmp/o' in bash_write_targets('grep foo src/x.ts > /tmp/o'))
        chk('wt-mv-target',
            'src/b.ts' in bash_write_targets('mv src/a.ts src/b.ts'))
        # T-346: read-only commands must NOT yield phantom write-targets
        chk('wt-arrow-not-target',                        # `->` is not a redirect (lookbehind)
            bash_write_targets('gen a -> b.ts') == set())
        chk('wt-grep-keyword-not-target',                 # mutate keyword INSIDE a grep pattern
            bash_write_targets(r'grep -n "install\|rm\|mv" src/foo.py') == set())

        # T-356: false-positives killed + false-negatives closed (ticket How-Check)
        chk('dg-fp-stderr-redirect',                      # `2>/dev/null` is not a write
            DESTRUCTIVE_BASH.search('grep x knowledge/ 2>/dev/null') is None)
        chk('dg-fp-commit-msg',                           # commit MESSAGE text is not a command
            match_gate('Bash', {'command': 'git commit -m "rm -rf knowledge"'},
                       ['knowledge/'], root) is None)
        chk('dg-fn-dd-of',                                # `dd of=PATH` writes PATH
            'src/x' in bash_write_targets('dd if=/dev/zero of=src/x'))
        chk('dg-fn-clobber',                              # `>|` clobber is a write
            'src/x' in bash_write_targets('cat a >| src/x'))
        # regression + skeptical-refinement guards: real destructive still caught
        chk('dg-regress-rm-still-blocks',
            bool(DESTRUCTIVE_BASH.search('rm -rf knowledge')))
        chk('dg-regress-commit-compound-still-blocks',    # msg blank must not hide a real verb
            match_gate('Bash', {'command': 'git commit -m "msg" && rm -rf knowledge'},
                       ['knowledge/'], root) is not None)
        chk('dg-regress-stdout-1-redirect-caught',        # `1>` stdout write stays destructive
            bool(DESTRUCTIVE_BASH.search('echo x 1>src/x')))

        # T-358 (a): is_headless interactive-presence override
        _ihkeys = ('HARNESS_HEADLESS', 'CLAUDE_CODE_ENTRYPOINT',
                   'CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL')
        _ihsave = {k: os.environ.get(k) for k in _ihkeys}

        def _ihset(**kw):
            for k in _ihkeys:
                os.environ.pop(k, None)
            os.environ.update(kw)

        _loop = os.path.join(root, '.sessions', 'loop_active')
        open(_loop, 'w').close()          # fresh mtime -> within STALE_MIN
        try:
            _ihset(HARNESS_HEADLESS='1', CLAUDE_CODE_ENTRYPOINT='cli')
            chk('ih: HARNESS_HEADLESS=1 wins over interactive -> headless',
                is_headless(root) is True)
            _ihset(CLAUDE_CODE_ENTRYPOINT='vscode')
            chk('ih: interactive entrypoint + fresh loop_active -> not headless',
                is_headless(root) is False)
            _ihset(CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL='true')
            chk('ih: ask-question flag + fresh loop_active -> not headless',
                is_headless(root) is False)
            _ihset()                       # no human marker at all
            chk('ih: no human marker + fresh loop_active -> headless (fail-closed)',
                is_headless(root) is True)
        finally:
            for k in _ihkeys:
                if _ihsave[k] is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = _ihsave[k]
            try:
                os.remove(_loop)
            except OSError:
                pass
    finally:
        shutil.rmtree(root, ignore_errors=True)
    print('[danger-gate] self-test: %s'
          % ('PASS' if not fails else 'FAIL %s' % fails))
    return 0 if not fails else 1


if __name__ == '__main__':
    argv = sys.argv[1:]
    if argv and argv[0] == '--self-test':
        sys.exit(self_test())
    if argv and argv[0] == '--ack':
        _root = project_root()
        if len(argv) < 2 or not argv[1].strip():
            print('[danger-gate] --ack needs the exact command/path to bind',
                  file=sys.stderr)
            sys.exit(1)
        arm_ack(_root, argv[1])
        print('[danger-gate] ack armed (one-shot · TTL %ds) for: %s'
              % (ACK_TTL_SEC, _norm(argv[1])[:120]), file=sys.stderr)
        sys.exit(0)
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # loud fail-open (T-355)
        try:
            import gatelib; gatelib.report_fail_open("danger_gate", exc)
        except Exception:      # F1: helper failure must not crash the gate
            sys.stderr.write("[gate-error] gate:danger_gate · fail-open(allowed) · %r\n" % (exc,))
        sys.exit(0)
