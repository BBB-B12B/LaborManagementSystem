#!/usr/bin/env python3
"""cache_prefix_guard.py — cache-stable prefix guard, DETECT-ONLY (T-303).

Flags volatile content (UUIDs, ISO-8601 timestamps, JWTs, long hex hashes)
inside files that belong to the prompt-cache STABLE PREFIX. Volatile bytes
there break the provider's prompt-cache prefix match, so every turn re-pays
full input price.

Contract (hard):
  - detect-only: NEVER mutates a file, NEVER blocks — exit 0 ALWAYS
    (even on crash or missing file: a warner must never break a pipeline)
  - findings -> "[cache-prefix-WARN] file:line · kind · snippet" (first
    MAX_WARN lines, remainder aggregated as "+N more") +
    "[cache-prefix-score] NN/100" (100 - 10 per TOTAL finding, floor 0)
  - clean -> prints NOTHING

Rule idea ported from Headroom CacheAligner (Apache-2.0), reimplemented as
plain deterministic rules — no model, no ONNX, no new dependency.
"""
import re
import sys

# Volatile-content patterns — flags PINNED (SR-3): jwt is case-SENSITIVE
# (exact "eyJ" base64 header); uuid/hexhash cover case via character class.
# No IGNORECASE anywhere — ambiguity killed by skeptical review.
PATTERNS = {
    "uuid": re.compile(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
        r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    ),
    "iso8601": re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "hexhash": re.compile(r"\b[0-9a-fA-F]{32,}\b"),
}

DEFAULT_PREFIX_FILES = ["CLAUDE.md", "AGENTS.md", ".agents/platform/detected.md"]
MAX_WARN = 10   # printed WARN-line cap (SR-1) — score still counts ALL findings
PENALTY  = 10   # score deduction per finding (CacheAligner-style)


def scan_file(path):
    """Return [(lineno, kind, snippet)] — missing/unreadable file -> [] (SR-2)."""
    findings = []
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            for lineno, line in enumerate(f, 1):
                for kind, pat in PATTERNS.items():
                    m = pat.search(line)
                    if m:
                        findings.append((lineno, kind, m.group(0)[:40]))
    except OSError:
        pass  # detect-only: a bad path is never an error
    return findings


def main(argv):
    targets = argv or DEFAULT_PREFIX_FILES
    all_findings = []
    for path in targets:
        for lineno, kind, snippet in scan_file(path):
            all_findings.append((path, lineno, kind, snippet))

    if not all_findings:
        return  # clean -> fully silent

    for path, lineno, kind, snippet in all_findings[:MAX_WARN]:
        print(f"[cache-prefix-WARN] {path}:{lineno} · {kind} · {snippet}")
    hidden = len(all_findings) - MAX_WARN
    if hidden > 0:
        print(f"[cache-prefix-WARN] +{hidden} more findings (suppressed)")
    score = max(0, 100 - PENALTY * len(all_findings))
    print(f"[cache-prefix-score] {score}/100")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception:
        pass  # a warner never breaks its caller
    sys.exit(0)
