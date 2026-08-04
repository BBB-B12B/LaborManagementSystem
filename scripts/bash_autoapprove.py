#!/usr/bin/env python3
"""bash_autoapprove.py — context-aware PreToolUse auto-approver (T-343).

Problem it solves
-----------------
Claude Code's permission matcher auto-approves only a SINGLE simple command
that maps to one ``Bash(<cmd>:*)`` allow rule. A COMPOUND command — segments
joined by ``;`` ``&&`` ``||`` ``|`` or carrying a redirect — matches no single
rule, so it prompts EVEN when every segment is individually allow-listed
(e.g. ``git log …; echo ---; grep … | head``). That friction is pure shape,
not missing trust.

What it does
------------
Emits ``permissionDecision: allow`` for a Bash command ONLY when it is
provably safe:
  * every segment's base command ∈ seed_permissions.BASELINE_ALLOW
  * no segment's base command ∈ seed_permissions.BASELINE_DENY
  * no write target outside ``.sessions/`` or a temp dir
    (reuses danger_gate.bash_write_targets — single source)
  * no command substitution / subshell (``$(`` backtick ``<(`` ``(`` )
  * no destructive ``find`` flag (-delete/-exec/-execdir/-ok*/-fprint*/-fls)
Anything else → stay SILENT (exit 0, no output) = defer to the normal flow.

Safety invariant
----------------
The approval-set ⊆ commands the allow-list already auto-passes at the
single-command level. This hook NEVER emits deny and NEVER widens trust — it
only removes compound-shape friction. Blocking stays with danger_gate /
phase_gate, which run as separate PreToolUse hooks in parallel; because this
hook defers on exactly the commands those gates block, there is no case where
it says "allow" for something a gate would block, so hook precedence is moot.

Fail-safe: any exception → exit 0 with no output (defer). Never crash, never
wrongly approve.

Escape: HARNESS_SKIP_AUTOAPPROVE=1 → always defer.
"""
from __future__ import annotations

import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# --- segment separators (top-level only; quote-aware split below) ------------
_SUBSHELL_RE = re.compile(r"\$\(|`|<\(|>\(")   # command / process substitution
_FIND_DANGER = {
    "-delete", "-exec", "-execdir", "-ok", "-okdir",
    "-fprint", "-fprint0", "-fprintf", "-fls",
}


def _allowed_bases(baseline):
    """Extract base-command strings from Bash(<base>:*) allow/deny entries."""
    bases = set()
    for entry in baseline:
        m = re.match(r"Bash\((.+?):\*\)$", entry)
        if m:
            bases.add(m.group(1).strip())
    return bases


def _mask_quotes(s):
    """Replace quoted spans (both ' and ") with spaces so shell metachars
    hidden inside strings do not trip the structural checks."""
    out, q = [], None
    for c in s:
        if q:
            out.append(c if c == q else " ")
            if c == q:
                q = None
        elif c in ("'", '"'):
            q = c                      # enter quote
            out.append(" ")
        else:
            out.append(c)
    return "".join(out)


_REDIR_FD = re.compile(r"\d*>&\d*")     # fd-dup: 2>&1  >&2  >&
_REDIR_BOTH = re.compile(r"&>>?")       # bash &>  &>>  (redirect both streams)


def _has_background_amp(cmd):
    """True if the command contains a backgrounding/separator '&' — i.e. an '&'
    that is NOT part of '&&' and NOT part of a redirect (2>&1, &>file). Such an
    '&' launches a hidden second command, so we must defer."""
    s = _mask_quotes(cmd)
    s = s.replace("&&", "  ")           # logical-AND is a real separator (splitter handles it)
    s = _REDIR_FD.sub("  ", s)
    s = _REDIR_BOTH.sub("  ", s)
    return "&" in s


def _split_segments(cmd):
    """Split a Bash line on top-level ; && || | and newline — respecting quotes.

    Returns None if the parse is unsafe to reason about (unbalanced quote).
    A single '&' (background / 2>&1 fd-dup) is handled separately in is_safe.
    """
    segments, buf = [], []
    quote = None            # None | "'" | '"'
    i, n = 0, len(cmd)
    while i < n:
        c = cmd[i]
        if quote:
            buf.append(c)
            if c == quote:
                quote = None
            i += 1
            continue
        if c in ("'", '"'):
            quote = c
            buf.append(c)
            i += 1
            continue
        two = cmd[i:i + 2]
        if two in ("&&", "||"):
            segments.append("".join(buf)); buf = []
            i += 2
            continue
        if c in (";", "|", "\n", "\r"):
            segments.append("".join(buf)); buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    if quote is not None:               # unbalanced quote → cannot reason
        return None
    segments.append("".join(buf))
    return [s.strip() for s in segments if s.strip()]


def _write_targets_safe(cmd):
    """True iff every write target the command touches is inside .sessions/ or tmp."""
    from danger_gate import bash_write_targets   # single source
    for t in bash_write_targets(cmd):
        s = t.strip().strip('"\'')
        if (s.startswith(".sessions/") or s.startswith("./.sessions/")
                or "/.sessions/" in s or s in (".sessions", "tmp")
                or s.startswith("tmp/") or s.startswith("/tmp/")
                or s.startswith("/private/tmp/") or s.startswith("/var/folders/")
                or s in ("/dev/null", "/dev/stdout", "/dev/stderr")):
            continue
        return False
    return True


def _segment_base(seg):
    """The base command of a segment ('git log' is two words; else first token)."""
    toks = seg.split()
    if not toks:
        return "", toks
    if toks[0] == "git" and len(toks) > 1:
        return "git " + toks[1], toks
    return toks[0], toks


def is_safe(cmd, allow_bases, deny_bases):
    """Return True only if cmd is provably safe to auto-approve."""
    if not cmd or not cmd.strip():
        return False
    if _SUBSHELL_RE.search(cmd) or "(" in cmd or ")" in cmd or "{" in cmd or "}" in cmd:
        return False                       # substitution / subshell / brace group → defer
    if _has_background_amp(cmd):
        return False                       # '&' backgrounding hides a second command → defer
    if not _write_targets_safe(cmd):
        return False
    segs = _split_segments(cmd)
    if segs is None or not segs:
        return False
    for seg in segs:
        base, toks = _segment_base(seg)
        if not base:
            return False
        if base in deny_bases:
            return False
        if base not in allow_bases:
            return False
        if base == "find" and any(t in _FIND_DANGER for t in toks):
            return False                   # find's write flags aren't base-covered
    return True


def decide(payload):
    """Return the allow-JSON string, or None to defer."""
    if os.environ.get("HARNESS_SKIP_AUTOAPPROVE") == "1":
        return None
    if (payload.get("tool_name") or payload.get("tool")) != "Bash":
        return None
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    from seed_permissions import BASELINE_ALLOW, BASELINE_DENY   # single source
    allow_bases = _allowed_bases(BASELINE_ALLOW)
    deny_bases = _allowed_bases(BASELINE_DENY)
    if is_safe(cmd, allow_bases, deny_bases):
        return json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason":
                    "bash_autoapprove: every segment allow-listed, "
                    "no destructive command and no write outside .sessions/tmp",
            }
        })
    return None


# --------------------------------------------------------------------------- #
def _self_test():
    from seed_permissions import BASELINE_ALLOW, BASELINE_DENY
    ab = _allowed_bases(BASELINE_ALLOW)
    db = _allowed_bases(BASELINE_DENY)
    approve = [
        "git log --oneline -3 | grep fix",
        "cat a.txt | grep foo | head",
        "grep -n x file; echo ---; ls",
        "cd /some/dir && grep -rn y .",
        "find . -name '*.py' | head",
        'git status --short | grep -v "^??" 2>&1 | head',   # the friction case
        "grep -c pat f | sort | uniq",
        "python3 scripts/x.py | tail -5",
        "cat a > .sessions/tmpout; grep e .sessions/tmpout",  # write inside .sessions
        "grep a f\ncat b",                       # benign newline separator → both safe
        "cat f 2>/dev/null | grep -i err | head",  # redirect to /dev/null, no bg
    ]
    defer = [
        "rm -rf knowledge",
        "grep x f\ngit push origin main",        # HOLE#1: newline hides git push
        "grep x f & git push origin main",       # HOLE#2: '&' backgrounds a hidden push
        "cat f & rm -rf x",                      # '&' + destructive second command
        "ls *.{py,md}",                          # brace expansion (unquoted) → defer
        "sed -i 's/a/b/' src/x.py",
        "echo hi > src/config.py",
        "cat $(rm -rf x)",
        "unknownbin foo | grep bar",
        "git push origin main",
        "find . -name '*.tmp' -delete",
        "find . -type f -exec rm {} ;",
        "git commit -m x && echo done",     # git commit not in allow-list
        "(grep x f)",                        # subshell
        "echo hi > /etc/passwd",             # write outside safe zone
    ]
    fails = []
    for c in approve:
        if not is_safe(c, ab, db):
            fails.append(f"EXPECTED-APPROVE but deferred: {c!r}")
    for c in defer:
        if is_safe(c, ab, db):
            fails.append(f"EXPECTED-DEFER but approved: {c!r}")
    # malformed stdin → decide() must not raise and must defer
    try:
        if decide({"tool_name": "Bash", "tool_input": {}}) is not None:
            fails.append("empty-command should defer")
        if decide({"tool_name": "Edit", "tool_input": {"command": "grep x"}}) is not None:
            fails.append("non-Bash tool should defer")
    except Exception as e:                                  # noqa: BLE001
        fails.append(f"decide() raised: {e}")
    if fails:
        print("SELF-TEST FAIL:")
        for f in fails:
            print("  -", f)
        return 1
    print(f"SELF-TEST PASS — {len(approve)} approve, {len(defer)} defer cases")
    return 0


def main(argv):
    if "--self-test" in argv:
        return _self_test()
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        out = decide(payload)
        if out:
            print(out)
    except Exception:                                       # noqa: BLE001
        pass                                                # fail-safe: defer
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
