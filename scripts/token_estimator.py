#!/usr/bin/env python3
"""
token_estimator.py — estimate SESSION_TOTAL and CHAT_TOTAL for harness agents.

Usage:
  # Estimate one turn
  python3 scripts/token_estimator.py --user-chars=500 --tool-chars=1200 \\
      --thai-chars=80 --en-chars=600 --chat-total=50000

  # Self-test (verify formula produces valid output)
  python3 scripts/token_estimator.py --test

  # Simulate N turns
  python3 scripts/token_estimator.py --simulate --turns=25

Output: JSON to stdout
"""

import argparse
import json
import sys

# ── Constants ─────────────────────────────────────────────────────────────────
def _compute_sys_fixed():
    import os
    try:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        size = os.path.getsize(os.path.join(base, "CLAUDE.md")) + \
               os.path.getsize(os.path.join(base, "AGENTS.md"))
        return int(size * 0.3) + 3500
    except OSError:
        return 11070  # fallback

SYSTEM_FIXED = _compute_sys_fixed()
# dynamic: (CLAUDE.md + AGENTS.md chars × 0.3) + 3500 ≈ 11–13k

HOOKS_PER_TURN = 700
# deferred-tools manifest ~600 + HARNESS REMINDER ~100 (per CLAUDE.md R1)

OVERHEAD_PER_TURN = SYSTEM_FIXED + HOOKS_PER_TURN

# ── Char multipliers ───────────────────────────────────────────────────────────
THAI_MULT = 1.7    # UTF-8 multi-byte: ~1.5-2.5 tokens/char
EN_MULT   = 0.3    # ~4 English chars/token
TOOL_MULT = 0.3    # tool results ≈ English density


def estimate_turn(user_chars=0, tool_chars=0, thai_chars=0, en_chars=0, chat_total=0):
    """
    Estimate token cost for one turn.

    Args:
        user_chars  : characters in user's message
        tool_chars  : characters in all tool results combined
        thai_chars  : Thai characters in the response output
        en_chars    : English characters in the response output
        chat_total  : current CHAT_TOTAL *before* this turn

    Returns dict:
        output_tokens   : tokens generated in response
        turn_tokens     : new tokens added this turn (user + tools + output)
        session_delta   : add this to SESSION_TOTAL
        new_chat_total  : CHAT_TOTAL after this turn (includes overhead)
        overhead_applied: OVERHEAD_PER_TURN constant used
    """
    output_tokens = (thai_chars * THAI_MULT) + (en_chars * EN_MULT)
    turn_tokens   = (user_chars * EN_MULT) + (tool_chars * TOOL_MULT) + output_tokens

    # CHAT_TOTAL: sys_fixed added ONCE at session start.
    # Per-turn: hooks + turn_tokens × 1.5 (calibrated T-046: actual ≈ 1.5–2× due to history re-sent)
    # schema_drift=True: simulate cache prefix reset → adds sys_fixed again (tool schema edited)
    system_bootstrap = SYSTEM_FIXED if chat_total == 0 else 0
    new_chat_total   = chat_total + system_bootstrap + HOOKS_PER_TURN + round(turn_tokens * 1.5)

    return {
        "output_tokens":    round(output_tokens),
        "turn_tokens":      round(turn_tokens),
        "session_delta":    round(turn_tokens),
        "new_chat_total":   round(new_chat_total),
        "hooks_per_turn":   HOOKS_PER_TURN,
    }


def run_test():
    """
    Self-test: verify formula produces valid non-negative outputs.
    Prints JSON result. Returns 0 on pass, 1 on fail.
    """
    cases = [
        {"user_chars": 0,   "tool_chars": 0,   "thai_chars": 0,  "en_chars": 0,   "chat_total": 0},
        {"user_chars": 200, "tool_chars": 0,   "thai_chars": 50, "en_chars": 200, "chat_total": 0},
        {"user_chars": 500, "tool_chars": 1200,"thai_chars": 80, "en_chars": 600, "chat_total": 30000},
    ]

    results = []
    passed = True
    for i, c in enumerate(cases):
        r = estimate_turn(**c)
        ok = (r["output_tokens"] >= 0 and r["turn_tokens"] >= 0
              and r["new_chat_total"] >= OVERHEAD_PER_TURN and r["session_delta"] >= 0)
        results.append({"case": i + 1, "pass": ok, **r})
        if not ok:
            passed = False

    print(json.dumps({
        "test": "formula-validation",
        "pass": passed,
        "overhead_per_turn": OVERHEAD_PER_TURN,
        "cases": results,
    }, indent=2))
    return 0 if passed else 1


def run_simulate(turns=25, user_chars=300, tool_chars=600, thai_chars=60, en_chars=400):
    """
    Simulate N turns with constant turn size. Prints per-turn SESSION and CHAT.
    """
    session = 0
    chat = 0
    rows = []

    for t in range(1, turns + 1):
        r = estimate_turn(user_chars=user_chars, tool_chars=tool_chars,
                          thai_chars=thai_chars, en_chars=en_chars, chat_total=chat)
        session += r["session_delta"]
        chat = r["new_chat_total"]
        rows.append({"turn": t, "session_k": round(session / 1000, 1),
                     "chat_k": round(chat / 1000, 1)})

    print(json.dumps({
        "simulation": f"{turns} turns",
        "per_turn_input": {"user_chars": user_chars, "tool_chars": tool_chars,
                           "thai_chars": thai_chars, "en_chars": en_chars},
        "final_session_k": round(session / 1000, 1),
        "final_chat_k":    round(chat / 1000, 1),
        "sample_last_5":   rows[-5:],
    }, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Harness token estimator (SESSION_TOTAL + CHAT_TOTAL)"
    )
    parser.add_argument("--user-chars",  type=int, default=0)
    parser.add_argument("--tool-chars",  type=int, default=0)
    parser.add_argument("--thai-chars",  type=int, default=0)
    parser.add_argument("--en-chars",    type=int, default=0)
    parser.add_argument("--chat-total",  type=int, default=0,
                        help="Current CHAT_TOTAL before this turn")
    parser.add_argument("--test",     action="store_true",
                        help="Run formula self-test (verify non-negative outputs)")
    parser.add_argument("--simulate", action="store_true",
                        help="Simulate N turns with constant turn size")
    parser.add_argument("--turns",    type=int, default=25,
                        help="Number of turns for --simulate (default: 25)")
    parser.add_argument("--schema-drift", action="store_true",
                        help="Simulate cache prefix reset (tool schema edited) — adds sys_fixed once")
    args = parser.parse_args()

    if args.test:
        sys.exit(run_test())

    if args.simulate:
        run_simulate(turns=args.turns,
                     user_chars=args.user_chars or 300,
                     tool_chars=args.tool_chars or 600,
                     thai_chars=args.thai_chars or 60,
                     en_chars=args.en_chars    or 400)
        return

    result = estimate_turn(
        user_chars=args.user_chars,
        tool_chars=args.tool_chars,
        thai_chars=args.thai_chars,
        en_chars=args.en_chars,
        chat_total=args.chat_total,
    )
    if getattr(args, 'schema_drift', False):
        result["schema_drift_penalty"] = SYSTEM_FIXED
        result["new_chat_total"] += SYSTEM_FIXED
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
