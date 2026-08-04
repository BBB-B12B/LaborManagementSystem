#!/usr/bin/env python3
"""headroom_hook.py — PostToolUse WARNER for oversized Bash output (T-344).

Background: headroom (T-301 offload / T-302 view-compress in safe_run.py) only
fired when the AGENT manually ran safe_run.py — discipline-only, so it slipped.
This hook makes headroom AUTOMATIC + VISIBLE.

Design constraint (proven by the T-344 S0 spike): a PostToolUse hook CANNOT
replace the tool output the model reads — `updatedToolOutput` does not take
effect for our purpose in the current Claude Code. The ONE supported lever is
`additionalContext`, which ADDS a system reminder. So this hook does NOT shrink
the current output (that text already entered context); instead, when a Bash
command produced a large output, it:
  (a) PARKS a lossless copy via safe_run.park_output() → .sessions/exec_log/<id>
  (b) injects a terse [headroom] reminder naming the parked id + pointing at the
      real token-savers (index-first lookup.py + manual safe_run.py next time).

This builds the habit, gives a retrievable short copy, and makes the
"Context-send Standard" observable. It is a NUDGE, not a rewrite.

Fail-safe: ANY error / below threshold / non-Bash / already-headroom'd output
→ print nothing, exit 0 (never disturb a real tool result).
"""
import sys
import os
import json

# fire only on genuinely large output — higher than safe_run's manual THRESHOLD
# (40) so routine diffs/traces are not nudged into noise.
AUTO_THRESHOLD = 80

# markers that mean the agent ALREADY routed this through safe_run (or a prior
# headroom pass) — never double-nudge.
_ALREADY = (
    "[headroom]",
    "<<offload:",
    "run command directly to see all]",
    "[⚡ Signals",
    "table view compressed (T-302)",
)


def _stdout_of(tool_response):
    """Extract the model-visible text from a PostToolUse tool_response (dict|str).
    Includes BOTH stdout and stderr — the model sees both, and a command can
    dump its bulk to stderr (verbose builds/linters), so counting stdout alone
    would miss large stderr output (scrutinize GAP-1, T-344)."""
    if isinstance(tool_response, str):
        return tool_response
    if isinstance(tool_response, dict):
        out = tool_response.get("stdout") or tool_response.get("output") or ""
        err = tool_response.get("stderr") or ""
        return (out + "\n" + err) if (out and err) else (out or err)
    return ""


def _park(raw):
    """Reuse safe_run.park_output — single-source, no reimplementation.
    Returns an 8-char offload id or None."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import safe_run
        return safe_run.park_output(raw)
    except Exception:
        return None


def build_nudge(stdout):
    """Given a Bash stdout string, return an additionalContext reminder string,
    or None if the output does not warrant a nudge. Pure/testable."""
    if not stdout:
        return None
    if any(m in stdout for m in _ALREADY):
        return None
    n = stdout.count("\n") + 1
    if n <= AUTO_THRESHOLD:
        return None
    offload_id = _park(stdout)
    where = (f"parked → `python3 scripts/exec_log_get.py {offload_id}`"
             if offload_id else "not parked (park failed)")
    # ONE line — terse, no noise.
    return (f"[headroom] that Bash output was {n} lines (>{AUTO_THRESHOLD}); "
            f"full copy {where}. Prefer index-first (lookup.py read_hint ranges) "
            f"+ pipe big commands through safe_run.py so large output never "
            f"enters context in the first place.")


def decide(data):
    """Map a PostToolUse payload dict → additionalContext string or None."""
    if (data.get("tool_name") or "") != "Bash":
        return None
    return build_nudge(_stdout_of(data.get("tool_response")))


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    try:
        nudge = decide(data)
    except Exception:
        sys.exit(0)
    if not nudge:
        sys.exit(0)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": nudge,
        }
    }))
    sys.exit(0)


def _self_test():
    big = "\n".join(f"line {i}" for i in range(200))       # 200 lines
    small = "\n".join(f"line {i}" for i in range(10))       # 10 lines
    already = "[headroom] previously nudged\n" + big
    cases = [
        # (label, payload, expect_nudge)
        ("big Bash → nudge",
         {"tool_name": "Bash", "tool_response": {"stdout": big}}, True),
        ("small Bash → none",
         {"tool_name": "Bash", "tool_response": {"stdout": small}}, False),
        ("non-Bash → none",
         {"tool_name": "Read", "tool_response": {"stdout": big}}, False),
        ("already-headroom → none (no double)",
         {"tool_name": "Bash", "tool_response": {"stdout": already}}, False),
        ("stdout as string → nudge",
         {"tool_name": "Bash", "tool_response": big}, True),
        ("big STDERR (empty stdout) → nudge (GAP-1)",
         {"tool_name": "Bash", "tool_response": {"stdout": "", "stderr": big}}, True),
        ("empty stdout → none",
         {"tool_name": "Bash", "tool_response": {"stdout": ""}}, False),
        ("missing tool_response → none",
         {"tool_name": "Bash"}, False),
        ("safe_run marker present → none",
         {"tool_name": "Bash",
          "tool_response": {"stdout": big + "\n[+9 more lines — run command directly to see all]"}},
         False),
    ]
    passed = 0
    for label, payload, expect in cases:
        got = decide(payload)
        ok = (got is not None) == expect
        if ok and expect:
            # nudge must be ONE line and name the threshold
            ok = ("\n" not in got.rstrip("\n")) and (str(AUTO_THRESHOLD) in got)
        print(f"  {'PASS' if ok else 'FAIL'} · {label}"
              + ("" if ok else f"  (got={got!r})"))
        passed += ok
    # malformed stdin path is covered by main()'s try/except (not decide()).
    total = len(cases)
    print(f"[self-test] {passed}/{total} "
          + ("PASS" if passed == total else "*** FAIL ***"))
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        _self_test()
    main()
