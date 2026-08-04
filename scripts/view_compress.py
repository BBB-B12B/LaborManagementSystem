#!/usr/bin/env python3
"""view_compress.py — content-type-aware IN-CONTEXT VIEW compression (T-302).

Deterministic rules ONLY — no neural model, no ONNX, no external dependency.
This module only PRODUCES the compressed view of long tool output; the
lossless original is parked by safe_run.py via T-301 (<<offload:ID>>).
It never stores or retrieves (anti-conflict: ONE retrieve system =
scripts/exec_log_get.py).

Rule ideas borrowed from Headroom SmartCrusher (Apache-2.0), reimplemented
as plain rules: keep head ~30% + tail ~15% + even-stride middle samples.
Signal lines (error/warn/fail/…) are ALWAYS kept in the view — the R6
promise that warnings are visible immediately, without a retrieve.
"""
import re

# Same signal contract as safe_run.SIGNAL_RE (kept import-free on purpose —
# this module must never make safe_run.py fail to start)
SIGNAL_RE = re.compile(
    r'error|warn|fail|exception|traceback|✗|✘|assert|fatal|critical|denied|refused',
    re.IGNORECASE
)

DELIMS      = [",", "\t", "|"]
MIN_FIELDS  = 2     # a "table" row has at least this many fields
MATCH_FRAC  = 0.8   # ≥80% of sampled lines must share the same field count
HEAD_FRAC   = 0.30  # keep first ~30% (capped by MAX_VIEW)
TAIL_FRAC   = 0.15  # keep last ~15% (capped by MAX_VIEW)
MAX_VIEW    = 30    # view-line cap before signal add-back


def detect_content_type(lines):
    """Return 'table' or 'generic'. Deterministic — even-stride sampling,
    sorted tie-break, no randomness."""
    body = [l for l in lines if l.strip()]
    if len(body) < 10:
        return "generic"
    stride = max(1, len(body) // 20)
    sampled = body[::stride][:40]
    for d in DELIMS:
        counts = [l.count(d) + 1 for l in sampled]
        mode = max(sorted(set(counts)), key=counts.count)
        if mode >= MIN_FIELDS and counts.count(mode) / len(counts) >= MATCH_FRAC:
            return "table"
    return "generic"


def compress_table(lines):
    """list[str] -> list[str]: head + omission note + even-stride samples +
    tail. Lines matching SIGNAL_RE are always kept — never dropped in the
    omitted middle."""
    lines = list(lines)
    n = len(lines)
    if n <= MAX_VIEW:
        return lines

    head_n = max(1, min(int(n * HEAD_FRAC), MAX_VIEW // 2))
    tail_n = max(1, min(int(n * TAIL_FRAC), MAX_VIEW // 4))
    budget = max(1, MAX_VIEW - head_n - tail_n - 1)  # -1 = omission note

    mid = lines[head_n:n - tail_n]
    stride = max(1, len(mid) // budget)
    keep = set(list(range(0, len(mid), stride))[:budget])
    keep |= {i for i, l in enumerate(mid) if SIGNAL_RE.search(l)}

    omitted = len(mid) - len(keep)
    view = lines[:head_n]
    view.append(
        f"[~{omitted} rows omitted — table view compressed (T-302) · full copy parked]"
    )
    view.extend(mid[i] for i in sorted(keep))
    view.extend(lines[n - tail_n:])
    return view
