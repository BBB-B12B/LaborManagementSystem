#!/usr/bin/env python3
"""
compute_compact_size.py — Single source of truth for the compact_size formula.

compact_size estimates how many tokens of CHAT_TOTAL survive a /compact (the
summary the next session boots with). B1 seeds the next session's
CHAT_TOTAL = compact_size + sys_fixed.

THE 0.52 RETENTION CONSTANT LIVES HERE AND NOWHERE ELSE.
Calibration history (retained fraction of CHAT_TOTAL): 0.30 → 0.45 → 0.52.
If you re-tune it, change RETENTION below — do NOT copy the number back into
AGENTS.md / mece_plan_schema.md / token_tracker (they all call this script).
This is the SSOT fix for the magic-constant drift (was duplicated 4×, one copy
was even broken: `import re,open as o`).

Usage:
  python3 scripts/compute_compact_size.py
    → prints int(CHAT_TOTAL * RETENTION), CHAT_TOTAL read from .sessions/session_tokens.md
  python3 scripts/compute_compact_size.py --chat 23991
    → prints int(23991 * RETENTION)            (override CHAT_TOTAL — for testing)
  python3 scripts/compute_compact_size.py --file path/to/session_tokens.md
"""
import re
import argparse
from pathlib import Path

# ── single source of the compact_size constant (history: 0.30 → 0.45 → 0.52) ──
RETENTION = 0.52


def chat_total_from_file(path: str) -> int:
    p = Path(path)
    if not p.exists():
        return 0
    m = re.search(r"CHAT_TOTAL:\s*(\d+)", p.read_text())
    return int(m.group(1)) if m else 0


def compact_size(chat_total: int) -> int:
    return int(chat_total * RETENTION)


def main():
    ap = argparse.ArgumentParser(description="Compute compact_size = int(CHAT_TOTAL * 0.52)")
    ap.add_argument("--chat", type=int, default=None, help="override CHAT_TOTAL (for testing)")
    ap.add_argument("--file", default=".sessions/session_tokens.md", help="session_tokens.md path")
    args = ap.parse_args()
    chat = args.chat if args.chat is not None else chat_total_from_file(args.file)
    print(compact_size(chat))


if __name__ == "__main__":
    main()
