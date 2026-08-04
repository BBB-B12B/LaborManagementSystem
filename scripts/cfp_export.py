#!/usr/bin/env python3
"""cfp_export.py — export this machine's CFP failure counts for cross-machine sharing.

T-319 STAGE 1 · Track 1. Reads the LOCAL CFP ledger (knowledge/index_cfp_fix.json)
and writes a sanitized, versioned export into the machine-wide shared store
(harness_paths.shared_cfp_dir()) so another machine can learn from this one's
failure history.

Design (why it is safe + correct — see .sessions/mece_plan.md S2 + spec §10):
  * Merge key = TOPIC, not CFP id. CFP ids (CFP-005 …) are per-machine-local and
    meaningless across machines; the 8 topics are the shared vocabulary. So we
    AGGREGATE own counts by topic before export.
  * OWN-ORIGIN ONLY. We read index_cfp_fix.json, which holds only THIS machine's
    own recurrence tallies. Counts merged IN from other machines live in a
    separate per-origin store (see cfp_import.py) and are never re-exported —
    that is what kills transitive double-counting across ≥3 machines.
  * ALLOW-LIST sanitize. The export carries ONLY {topic, own_count, n_patterns}
    — enum topic + integers. No symptom/root/recurrences/description free-text,
    which could leak paths, ticket ids, or project identity (privacy · spec §6).

Usage:
  python3 scripts/cfp_export.py            # export real local ledger -> shared store
  python3 scripts/cfp_export.py --self-test
"""
from __future__ import annotations

import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths

SCHEMA_VERSION = 1
KIND = "cfp-export"
# Fields an exported topic entry is ALLOWED to contain — the allow-list IS the
# privacy guarantee (enumerate what leaves; never blocklist what to strip).
_ALLOWED_TOPIC_FIELDS = {"topic", "own_count", "n_patterns"}


def aggregate_by_topic(cfp: dict) -> dict:
    """Sum own CFP 90-day window_count by topic. Returns {topic: {own_count, n_patterns}}.

    T-319 STAGE 2 S1: we share the LIVE 90-day window_count (cfp_decay.py), NOT the
    lifetime count, so cross-machine sums line up with each machine's live 90-day
    window — a failure that stopped recurring months ago should stop inflating the
    shared total. Fallback to lifetime count for un-migrated ledgers that have no
    window_count field yet (backward-compat).

    n_patterns = how many distinct CFP entries feed this topic (context for a
    human reading the merged total — still just an integer, no free-text)."""
    agg: dict = {}
    for entry in cfp.values():
        topic = entry.get("topic")
        # T-319 STAGE 2 S2: never export the "unclassified" catch-all. A CFP with
        # no topic is a real LOCAL failure (it still escalates on this machine),
        # but topic is the ONLY cross-machine merge key — bucketing untopic'd
        # failures from different machines into one shared "unclassified" pile
        # would spuriously cross the ≥3 fix-required line (scrutinize finding).
        if not topic or topic == "unclassified":
            continue
        slot = agg.setdefault(topic, {"own_count": 0, "n_patterns": 0})
        wc = entry.get("window_count")
        slot["own_count"] += int((wc if wc is not None else entry.get("count")) or 0)
        slot["n_patterns"] += 1
    return agg


def build_export(machine_id: str, topic_agg: dict, today: str) -> dict:
    """Assemble the versioned, allow-listed export document."""
    topics = [
        {"topic": t, "own_count": v["own_count"], "n_patterns": v["n_patterns"]}
        for t, v in sorted(topic_agg.items())
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": KIND,
        "origin_machine_id": machine_id,
        "exported_at": today,
        "topics": topics,
    }


def _load_local_cfp() -> dict:
    path = harness_paths.project_path("knowledge", "index_cfp_fix.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _write_export(doc: dict) -> str:
    """Write the export into the shared CFP store, named by origin machine."""
    out = harness_paths.shared_cfp_dir() / f"export_{doc['origin_machine_id']}.json"
    out.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return str(out)


def run_export() -> str:
    cfp = _load_local_cfp()
    doc = build_export(
        harness_paths.machine_id(),
        aggregate_by_topic(cfp),
        datetime.date.today().isoformat(),
    )
    return _write_export(doc)


# --- self-test ----------------------------------------------------------------

def _selftest() -> int:
    failures = []

    def check(name, cond, detail=""):
        if not cond:
            failures.append(f"{name}: {detail}")

    # Fixture proves STAGE 2 S1: window_count is preferred over lifetime count.
    #   CFP-005: window_count 1 but lifetime count 2 -> the 1 must win (recency).
    #   CFP-009: no window_count field -> falls back to lifetime count 1.
    #   => phase-gate-skip own_count = 1 (window) + 1 (fallback) = 2, NOT 3.
    #   CFP-041: no window_count -> fallback to lifetime count 4.
    fixture = {
        "CFP-005": {"topic": "phase-gate-skip", "count": 2, "window_count": 1,
                    "description": "leaky free text /Users/x", "recurrences": [{"symptom": "leak"}]},
        "CFP-009": {"topic": "phase-gate-skip", "count": 1, "description": "more"},
        "CFP-041": {"topic": "token-tracking", "count": 4, "description": "x"},
        # S2: an untopic'd entry must be DROPPED from the export (no catch-all).
        "CFP-050": {"count": 7, "window_count": 7, "description": "no topic yet"},
    }
    agg = aggregate_by_topic(fixture)
    check("agg.window_preferred", agg["phase-gate-skip"]["own_count"] == 2,
          f"expected 2 (window 1 + fallback 1), got {agg['phase-gate-skip']['own_count']}")
    check("agg.n_patterns", agg["phase-gate-skip"]["n_patterns"] == 2, str(agg))
    check("agg.fallback", agg["token-tracking"]["own_count"] == 4, str(agg))
    check("agg.no_unclassified", "unclassified" not in agg and len(agg) == 2,
          f"untopic'd CFP must be dropped, got topics={list(agg)}")

    doc = build_export("testmachine01", agg, "2026-07-13")
    check("doc.schema", doc["schema_version"] == SCHEMA_VERSION, str(doc.get("schema_version")))
    check("doc.machine", doc["origin_machine_id"] == "testmachine01", "")
    check("doc.kind", doc["kind"] == KIND, "")
    check("doc.topics_list", isinstance(doc["topics"], list) and len(doc["topics"]) == 2, "")
    # exported_at IS the staleness anchor S3 reads (no redundant as_of field · single-source).
    check("doc.exported_at", doc.get("exported_at") == "2026-07-13", str(doc.get("exported_at")))

    # ALLOW-LIST proof: every exported topic entry has ONLY allowed keys — no
    # symptom/root/recurrences/description leaked through.
    for t in doc["topics"]:
        extra = set(t.keys()) - _ALLOWED_TOPIC_FIELDS
        check(f"allowlist.{t['topic']}", not extra, f"leaked keys: {extra}")

    # Round-trip through a real temp shared store (never touches ~/.claude).
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        try:
            out = _write_export(doc)
            reloaded = json.loads(open(out, encoding="utf-8").read())
            check("write.roundtrip", reloaded == doc, "reloaded != doc")
            # resolve td too — macOS /var -> /private/var symlink (shared_home resolves)
            check("write.location", out.startswith(os.path.realpath(td)), f"{out} not under {td}")
            # own-origin: the export never contains a per-origin 'merged' block.
            check("own_origin.only", "merged" not in reloaded and "sources" not in reloaded, "")
        finally:
            os.environ.pop("HARNESS_SHARED_HOME", None)

    if failures:
        print("FAIL cfp_export selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK cfp_export selftest: all checks pass · window_count preferred (lifetime fallback) · allow-list enforced · own-origin only")
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--export"
    if arg == "--self-test":
        sys.exit(_selftest())
    elif arg == "--export":
        print("exported ->", run_export())
        sys.exit(0)
    else:
        print(f"usage: {sys.argv[0]} [--export|--self-test]")
        sys.exit(2)
