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
import os
import uuid

try:
    import view_compress  # T-302 — table-aware view compressor (same dir as this script)
except ImportError:
    view_compress = None  # fallback: generic filter_output path (view compression off)

# ── Config ────────────────────────────────────────────────────────────────────
THRESHOLD   = 40   # lines: below this → pass through unchanged
CHUNK_SIZE  = 25   # lines: non-signal lines to show when output is long
# NOTE: view_compress.py keeps an intentional COPY of this pattern (import-free
# on purpose so this script never fails to start) — change it here → update there (T-302)
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


EXEC_LOG_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), os.pardir, ".sessions", "exec_log"
)


def park_output(raw: str):
    """Park the RAW pre-filter output to .sessions/exec_log/<id>.txt (T-301).

    Returns the offload id, or None on any failure — parking must never
    break the command output (fallback = old lossy behaviour, no marker).
    Parked copies are pruned by trim_exec_log.py (max 50 files / 24h).
    """
    try:
        os.makedirs(EXEC_LOG_DIR, exist_ok=True)
        offload_id = uuid.uuid4().hex[:8]
        with open(os.path.join(EXEC_LOG_DIR, f"{offload_id}.txt"), "w") as f:
            f.write(raw)
        return offload_id
    except Exception:
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/safe_run.py \"command\"", file=sys.stderr)
        sys.exit(1)

    cmd = " ".join(sys.argv[1:])
    raw_output, exit_code = run_command(cmd)
    raw_lines = raw_output.splitlines()
    raw_line_count = len(raw_lines)

    # T-302: table/CSV → deterministic head/tail+sample view (signal lines always
    # kept). The lossy view is safe because the lossless copy is parked below (T-301).
    if (
        raw_line_count > THRESHOLD
        and view_compress
        and view_compress.detect_content_type(raw_lines) == "table"
    ):
        # T-311: bind the compressed list so the saving can be reported
        compressed = view_compress.compress_table(raw_lines)
        filtered = "\n".join(compressed)
        kept = len(compressed)
        # T-311: headroom observability — an automated compressor actually ran.
        # stderr only, so stdout (the parsed content) stays byte-identical.
        print(
            f"[headroom] view-compress: {raw_line_count}→{kept} lines"
            f" · saved ~{raw_line_count - kept} lines",
            file=sys.stderr,
        )
    else:
        filtered = filter_output(raw_output)

    # T-301: long output → park the raw copy first, so truncation is reversible
    if raw_line_count > THRESHOLD:
        offload_id = park_output(raw_output)
        if offload_id:
            filtered += (
                f"\n<<offload:{offload_id}>> full output parked ({raw_line_count} lines)"
                f" · retrieve: python3 scripts/exec_log_get.py --id {offload_id}"
            )
            # T-311: headroom observability — offload mechanism fired (stderr only)
            print(
                f"[headroom] offload: parked {raw_line_count} lines"
                f" → exec_log/{offload_id}",
                file=sys.stderr,
            )

    print(filtered)

    # Preserve original exit code for callers
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
