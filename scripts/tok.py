#!/usr/bin/env python3
"""Per-file token estimator (PULL helper — T-247).

Answers "how many tokens does loading this file cost?" before you Read it, so
load-vs-grep is a measured decision instead of a guess.

Ratio is single-sourced from token_estimator.PROVIDER_MULTS (EN_MULT / THAI_MULT)
so the project never carries two disagreeing char->token ratios (scrutinize pre-check c).

Usage:
    python3 scripts/tok.py FILE [FILE ...]          # per-file + total estimate
    python3 scripts/tok.py --lines N FILE           # partial-read predictor:
                                                    #   tokens(slice) ~= (N / total_lines) * est_tokens
Note: estimate is ~±20% (char-class heuristic, not the real tokenizer). The exact
count is only knowable AFTER reading; this is the best pre-read signal we have.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from token_estimator import EN_MULT, THAI_MULT
except Exception:  # standalone fallback — keep the helper usable if import breaks
    EN_MULT, THAI_MULT = 0.3, 1.7


def est(path):
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except Exception:
        return None
    ascii_c = sum(1 for ch in text if ord(ch) < 128)
    nonascii_c = len(text) - ascii_c
    tok = round(ascii_c * EN_MULT + nonascii_c * THAI_MULT)
    lines = text.count("\n") + 1
    return len(text), lines, tok


def main(argv):
    lines_arg = None
    files = []
    i = 0
    while i < len(argv):
        if argv[i] == "--lines" and i + 1 < len(argv):
            lines_arg = int(argv[i + 1])
            i += 2
            continue
        files.append(argv[i])
        i += 1

    if not files:
        print(__doc__)
        return 1

    print(f"{'file':44} {'chars':>8} {'lines':>7} {'~tokens':>8}")
    print("-" * 70)
    total = 0
    for f in files:
        r = est(f)
        if r is None:
            print(f"{os.path.basename(f):44} (unreadable)")
            continue
        chars, lines, tok = r
        total += tok
        print(f"{os.path.basename(f):44} {chars:>8} {lines:>7} {tok:>8}")
        if lines_arg is not None and lines > 0:
            frac = min(lines_arg, lines) / lines
            print(f"{'  -> partial read ' + str(lines_arg) + ' lines':44} "
                  f"{'':>8} {'':>7} {round(tok * frac):>8}  (~{frac*100:.0f}%)")
    print("-" * 70)
    print(f"{'TOTAL if all loaded together':44} {'':>8} {'':>7} {total:>8}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
