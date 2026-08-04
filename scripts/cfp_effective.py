#!/usr/bin/env python3
"""cfp_effective.py — T-319 STAGE 2 S3: feed cross-machine totals into LIVE escalation.

The self-improvement recurrence check (self_improve SKILL, the "count recurrences
per CFP-N using window_count (90-day)" step) decides "this failure keeps coming
back — the fix isn't holding" from a CFP's LOCAL 90-day window_count. STAGE 1 could
COMPUTE a cross-machine effective total but nothing consumed it. This script is
that consumer: per topic it returns the EFFECTIVE 90-day count =
    this machine's own window_count  +  Σ every OTHER machine's window_count
so a failure that is rare on any single machine but common across the fleet still
crosses the ≥3 "fix-required" line.

Freshness (M4 review #1 — the reason this is not just cfp_import.report):
  An imported window_count is a frozen snapshot; the whole point of a 90-day
  window is recency. So a foreign origin whose export is OLDER than the 90-day
  window is treated as 0 — a machine that went quiet stops inflating the shared
  total. The anchor is the export's own `exported_at` date (no redundant field).
  Missing / unparseable / stale date → treated as stale (fail-safe: never inflate).

Backward-compat: no shared store, or every foreign origin stale → effective == own,
i.e. byte-for-byte today's local-only behavior. A single-machine user sees no change.

Single source: the 90-day window length is imported from cfp_decay.WINDOW_DAYS; the
own+Σothers merge math + the "unclassified" drop are reused from cfp_import — this
script only adds the freshness filter and the per-topic signal.

Usage:
  python3 scripts/cfp_effective.py <topic>        # one topic → effective + signal line
  python3 scripts/cfp_effective.py --report       # every topic
  python3 scripts/cfp_effective.py --self-test
  ... --date YYYY-MM-DD                            # freeze "today" (tests / determinism)
"""
from __future__ import annotations

import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths
import cfp_export
import cfp_import
from cfp_decay import WINDOW_DAYS

FIX_REQUIRED = cfp_import.FIX_REQUIRED
FIX_ESCALATED = cfp_import.FIX_ESCALATED


def effective(today: str | None = None, own_agg: dict | None = None) -> dict:
    """Per-topic effective 90-day count across the fleet (own + fresh others).

    The merged dir-walk + the freshness drop live in ONE place —
    cfp_import.load_merged(fresh_as_of=…, window_days=…). This function only wires
    'today' + the 90-day window in and hands the result to compute_effective, so a
    foreign origin whose export is older than 90 days contributes 0 (recency holds)."""
    today = today or datetime.date.today().isoformat()
    own_agg = cfp_import._own_agg() if own_agg is None else own_agg
    merged = cfp_import.load_merged(cfp_import._merged_dir(), harness_paths.machine_id(),
                                    fresh_as_of=today, window_days=WINDOW_DAYS)
    return cfp_import.compute_effective(own_agg, merged)


def signal_for(eff: int) -> str:
    """The escalation signal the self_improve recurrence step keys off."""
    if eff >= FIX_ESCALATED:
        return f"[fix-escalated] · effective:{eff} (≥{FIX_ESCALATED})"
    if eff >= FIX_REQUIRED:
        return f"[fix-required] · effective:{eff} (≥{FIX_REQUIRED})"
    return f"[recurrence-logged] · effective:{eff} (<{FIX_REQUIRED})"


def _parse_today(argv):
    return argv[argv.index("--date") + 1] if "--date" in argv else \
        datetime.date.today().isoformat()


def main(argv) -> int:
    today = _parse_today(argv)
    positional = [a for i, a in enumerate(argv)
                  if not a.startswith("-") and argv[i - 1] != "--date"]
    eff = effective(today)
    if positional:  # single topic
        topic = positional[0]
        e = eff.get(topic, {"own": 0, "others": 0, "effective": 0, "origins": {}})
        print(f"{topic}: effective={e['effective']} "
              f"(own={e['own']} + others={e['others']}) "
              f"origins={e['origins']}")
        print(signal_for(e["effective"]))
        return 0
    # --report (default): all topics + signals
    for topic in sorted(eff):
        e = eff[topic]
        print(f"  {topic}: effective={e['effective']} (own={e['own']} + others={e['others']})")
        sig = signal_for(e["effective"])
        if "[fix-" in sig:
            print(f"  {topic} {sig}")
    return 0


# --- self-test ----------------------------------------------------------------

def _selftest() -> int:
    failures = []

    def check(name, cond, detail=""):
        if not cond:
            failures.append(f"{name}: {detail}")

    import tempfile
    TODAY = "2026-07-13"
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        try:
            md = cfp_import._merged_dir()
            own = {"token-tracking": {"own_count": 2, "n_patterns": 1}}

            # (a) empty store → effective == own (backward-compat / fallback).
            eff = effective(TODAY, own)
            check("a.fallback_local_only", eff["token-tracking"]["effective"] == 2,
                  f"empty store must equal own: {eff.get('token-tracking')}")

            # (b) a FRESH foreign origin adds in: own 2 + fresh 2 = 4 → [fix-required].
            cfp_import.store_origin(md, {
                "schema_version": 1, "kind": cfp_import.KIND, "origin_machine_id": "FRESH01",
                "exported_at": TODAY,
                "topics": [{"topic": "token-tracking", "own_count": 2, "n_patterns": 1}]})
            eff = effective(TODAY, own)
            check("b.fresh_adds", eff["token-tracking"]["effective"] == 4,
                  str(eff.get("token-tracking")))
            check("b.signal_fix_required", signal_for(4).startswith("[fix-required]"),
                  signal_for(4))

            # (c) #1 STALE guard: an origin exported >90 days ago contributes 0.
            #     own 2 + stale(dropped) → effective stays 2, NOT 2+99.
            cfp_import.store_origin(md, {
                "schema_version": 1, "kind": cfp_import.KIND, "origin_machine_id": "STALE01",
                "exported_at": "2026-01-01",   # >90d before 2026-07-13
                "topics": [{"topic": "token-tracking", "own_count": 99, "n_patterns": 1}]})
            eff = effective(TODAY, own)
            check("c.stale_dropped", eff["token-tracking"]["effective"] == 4,
                  f"stale origin must not inflate (expected 4 = own2 + fresh2): "
                  f"{eff['token-tracking']}")

            # (d) a boundary-fresh origin (exactly 90d old) still counts.
            cutoff_day = (datetime.date.fromisoformat(TODAY)
                          - datetime.timedelta(days=WINDOW_DAYS)).isoformat()
            cfp_import.store_origin(md, {
                "schema_version": 1, "kind": cfp_import.KIND, "origin_machine_id": "EDGE01",
                "exported_at": cutoff_day,
                "topics": [{"topic": "phase-gate-skip", "own_count": 1, "n_patterns": 1}]})
            eff = effective(TODAY, own)
            check("d.edge_counts", eff.get("phase-gate-skip", {}).get("effective") == 1,
                  f"boundary-fresh origin should count: {eff.get('phase-gate-skip')}")

            # (e) missing exported_at → fail-safe drop (never inflate).
            cfp_import.store_origin(md, {
                "schema_version": 1, "kind": cfp_import.KIND, "origin_machine_id": "NODATE1",
                "topics": [{"topic": "token-tracking", "own_count": 50, "n_patterns": 1}]})
            eff = effective(TODAY, own)
            check("e.no_date_dropped", eff["token-tracking"]["effective"] == 4,
                  f"dateless origin must be dropped: {eff['token-tracking']}")
        finally:
            os.environ.pop("HARNESS_SHARED_HOME", None)

    if failures:
        print("FAIL cfp_effective selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK cfp_effective selftest: all checks pass · own+Σfresh-others · "
          "stale/dateless origins dropped (>90d) · empty-store fallback == local-only")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--self-test" in args:
        sys.exit(_selftest())
    sys.exit(main(args))
