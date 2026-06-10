#!/usr/bin/env python3
"""
safe_run.py — Priority-first chunked output filter (T-042)

Usage:
  python3 scripts/safe_run.py "command here"
  python3 scripts/safe_run.py "git push origin main"
  python3 scripts/safe_run.py "python3 scripts/backlink_analyzer.py"

Behaviour:
  - Output ≤ THRESHOLD lines → pass through unchanged
  - Output > THRESHOLD lines →
      1. Extract signal lines (error/warn/fail/exception/traceback) — sent first, never truncated
      2. Non-signal lines → first CHUNK_SIZE lines + "[+N more lines]" if remainder exists
"""

import subprocess
import sys
import re
import shlex

# ── Config ────────────────────────────────────────────────────────────────────
THRESHOLD   = 40   # lines: below this → pass through unchanged
CHUNK_SIZE  = 25   # lines: non-signal lines to show when output is long
SIGNAL_RE   = re.compile(
    r'error|warn|fail|exception|traceback|✗|✘|assert|fatal|critical|denied|refused',
    re.IGNORECASE
)
NOISE_RE    = re.compile(
    r'non-monotonic|Cloning into|Already up to date|nothing to commit',
    re.IGNORECASE
)
# ──────────────────────────────────────────────────────────────────────────────


def run_command(cmd: str) -> tuple[str, int]:
    """Run shell command, return (stdout+stderr combined, exit_code)."""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True
        )
        output = result.stdout + result.stderr
        return output, result.returncode
    except Exception as e:
        return f"safe_run error: {e}\n", 1


def filter_output(raw: str) -> str:
    """Apply priority-first chunked filtering."""
    lines = raw.splitlines()

    # Remove known noise lines unconditionally
    lines = [l for l in lines if not NOISE_RE.search(l)]

    # Short output — pass through unchanged
    if len(lines) <= THRESHOLD:
        return "\n".join(lines)

    # Long output — apply filtering
    signal_lines     = [l for l in lines if SIGNAL_RE.search(l)]
    non_signal_lines = [l for l in lines if not SIGNAL_RE.search(l)]

    parts = []

    # Section 1: signals (always show all, never truncate)
    if signal_lines:
        parts.append(f"[⚡ Signals — {len(signal_lines)} lines]")
        parts.extend(signal_lines)
        parts.append("")

    # Section 2: non-signal chunk
    total_non = len(non_signal_lines)
    shown     = non_signal_lines[:CHUNK_SIZE]
    remaining = total_non - CHUNK_SIZE

    parts.append(f"[Output — {len(lines)} lines total · showing first {len(shown)} non-signal lines]")
    parts.extend(shown)

    if remaining > 0:
        parts.append(f"[+{remaining} more lines — run command directly to see all]")

    return "\n".join(parts)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/safe_run.py \"command\"", file=sys.stderr)
        sys.exit(1)

    cmd = " ".join(sys.argv[1:])
    raw_output, exit_code = run_command(cmd)
    filtered = filter_output(raw_output)

    print(filtered)

    # Preserve original exit code for callers
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
