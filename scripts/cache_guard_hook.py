#!/usr/bin/env python3
"""cache_guard_hook.py — PostToolUse wiring for the T-303 cache-prefix guard (T-308).

Fires ONLY when an Edit/Write lands on a cache-anchor (stable-prefix) file
— the one moment volatile content can enter and break the prompt-cache
prefix. Preventive, not reactive: catches it AT the edit, not after cache
already broke and full input price was re-paid for several turns.

Contract (same as the guard it wraps): detect-only — never mutates, never
blocks, exit 0 ALWAYS. Reuses cache_prefix_guard.scan_file (single source —
no duplicated scan logic).
"""
import json
import os
import sys

# Cache-anchor files: the stable prefix the provider caches. Volatile bytes
# here break the prefix match. Kept in sync with cache_prefix_guard.DEFAULT_PREFIX_FILES.
STABLE_SUFFIXES = ("CLAUDE.md", "AGENTS.md", ".agents/platform/detected.md")


def main():
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}
    if data.get("tool_name", "") not in ("Edit", "Write", "NotebookEdit"):
        return
    fp = (data.get("tool_input", {}) or {}).get("file_path", "") or ""
    if not fp:
        return
    rel = fp.replace(os.sep, "/").lstrip("/")
    if not any(rel == s or rel.endswith("/" + s) or rel.endswith(s) for s in STABLE_SUFFIXES):
        return

    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)
    try:
        from cache_prefix_guard import scan_file, PENALTY, MAX_WARN
    except Exception:
        return  # guard unavailable → stay silent, never break the tool

    findings = scan_file(fp)
    if not findings:
        return  # clean edit → silent (matches guard's clean contract)
    for lineno, kind, snippet in findings[:MAX_WARN]:
        print(f"[cache-prefix-WARN] {rel}:{lineno} · {kind} · {snippet}", file=sys.stderr)
    hidden = len(findings) - MAX_WARN
    if hidden > 0:
        print(f"[cache-prefix-WARN] +{hidden} more (suppressed)", file=sys.stderr)
    score = max(0, 100 - PENALTY * len(findings))
    print(
        f"[cache-prefix-score] {score}/100 · you edited a cache-anchor file "
        f"({rel}) — volatile content breaks the prompt-cache prefix, re-paying "
        f"full input price next turn. Remove it or move it out of the prefix (T-303/T-308).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # a warner never breaks its caller
    sys.exit(0)
