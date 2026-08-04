#!/usr/bin/env python3
"""cfp_import.py — merge another machine's CFP failure export into this machine.

T-319 STAGE 1 · Track 1 (consumer side). Reads an export produced by
cfp_export.py and folds its per-topic failure counts into a machine-wide
per-origin store, then reports the EFFECTIVE count per topic (this machine's own
tally + every other machine's contribution) so a failure seen a little on many
machines can still cross the ≥3 "fix-required" line.

Why the per-origin REPLACE model (see .sessions/mece_plan.md S3 + spec §10)
--------------------------------------------------------------------------
  * STORE PER ORIGIN. Each origin machine's contribution is one file
    <shared>/cfp/merged/<origin_id>.json. Importing an export REPLACES that one
    file wholesale — never appends. So re-importing the same (or a newer) export
    is IDEMPOTENT by construction: no sequence numbers, no consumer bookmark, no
    clock-skew hazard. The newest export from a machine is the whole truth for
    that machine.
  * NO TRANSITIVE DOUBLE-COUNT. An export carries a machine's OWN-origin counts
    only (cfp_export never re-exports merged-in foreign counts). And at compute
    time we EXCLUDE our own machine_id from the merged dir, so if our own export
    ever gets imported back it cannot inflate our effective total.
  * MERGE KEY = TOPIC. CFP ids (CFP-005 …) are per-machine-local; the shared
    vocabulary is the topic. Foreign topics we have never seen are created on
    the fly (create-if-absent) with local own = 0.
  * ALLOW-LIST on the way IN too (defense in depth). We keep only
    {topic, own_count, n_patterns} from a foreign doc — never trust free-text.

STAGE-1 boundary (proof-of-mechanism only)
------------------------------------------
This COMPUTES the effective count and emits [fix-required] / [fix-escalated] as
a demonstration. It deliberately does NOT touch cfp_recurrence.py or
index_cfp_fix.json — rewiring the LIVE 90-day window escalation to consume the
cross-machine total is deferred to a later stage.

Usage:
  python3 scripts/cfp_import.py <export.json>   # merge one export + report
  python3 scripts/cfp_import.py --report        # recompute effective from store
  python3 scripts/cfp_import.py --self-test
"""
from __future__ import annotations

import datetime
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths
import cfp_export

SCHEMA_VERSION = 1
KIND = "cfp-export"
FIX_REQUIRED = 3      # effective count that demands a structural fix (mirrors CFP rule)
FIX_ESCALATED = 5     # effective count that escalates
_ALLOWED_TOPIC_FIELDS = {"topic", "own_count", "n_patterns"}
# An origin id becomes a FILENAME in the merged store, and it arrives from a
# FOREIGN machine's export — so it is untrusted input. Restrict it to a safe
# charset (machine_id() emits 12 lowercase hex; allow a bit more) so a crafted
# id like "../../evil" can never traverse out of the store. (scrutinize finding)
_SAFE_ORIGIN = re.compile(r"^[A-Za-z0-9_-]{4,64}$")


def _merged_dir():
    """<shared>/cfp/merged — one file per contributing origin machine."""
    d = harness_paths.shared_cfp_dir() / "merged"
    d.mkdir(parents=True, exist_ok=True)
    return d


def validate_export(doc: dict) -> None:
    """Reject anything that is not a v1 cfp-export with an origin + topics list."""
    if not isinstance(doc, dict):
        raise ValueError("export is not a JSON object")
    if doc.get("schema_version") != SCHEMA_VERSION:
        raise ValueError(f"unsupported schema_version: {doc.get('schema_version')!r}")
    if doc.get("kind") != KIND:
        raise ValueError(f"not a cfp-export (kind={doc.get('kind')!r})")
    origin = doc.get("origin_machine_id")
    if not origin:
        raise ValueError("missing origin_machine_id")
    # origin becomes a filename in the merged store — reject anything that could
    # traverse out of it (path separators, "..", dots, spaces). Untrusted input.
    if not _SAFE_ORIGIN.match(str(origin)):
        raise ValueError(f"unsafe origin_machine_id: {origin!r}")
    if not isinstance(doc.get("topics"), list):
        raise ValueError("topics must be a list")


def sanitize_topics(topics: list) -> list:
    """Allow-list every incoming topic entry — keep only the safe integer fields."""
    clean = []
    for t in topics:
        if not isinstance(t, dict) or not t.get("topic"):
            continue
        clean.append({
            "topic": str(t["topic"]),
            "own_count": int(t.get("own_count") or 0),
            "n_patterns": int(t.get("n_patterns") or 0),
        })
    return clean


def store_origin(merged_dir, doc: dict, kind: str = KIND) -> str:
    """REPLACE this origin's block in the store (idempotent). Returns file path.

    `kind` lets a sibling track (T-319 S4 skill wiki) reuse this ONE writer instead of
    copy-pasting it — the only per-track difference is the stamped kind. (single-source ·
    the S3-scrutinize lesson applied again.) The foreign-import trust boundary
    (validate_export → _SAFE_ORIGIN) runs BEFORE this on the CLI path; own-writes pass a
    generated machine_id, so no untrusted origin reaches this function."""
    origin = doc["origin_machine_id"]
    block = {
        "schema_version": SCHEMA_VERSION,
        "kind": kind,
        "origin_machine_id": origin,
        "exported_at": doc.get("exported_at"),
        "topics": sanitize_topics(doc["topics"]),
    }
    out = merged_dir / f"{origin}.json"
    out.write_text(json.dumps(block, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return str(out)


def load_merged(merged_dir, exclude_origin: str, fresh_as_of: str | None = None,
                window_days: int | None = None) -> dict:
    """Return {origin_id: {topic: own_count}} for every stored origin != exclude.

    Excluding our own machine_id makes an accidental re-import of our own export
    a no-op on the effective total (kills self double-count).

    Freshness (T-319 STAGE 2 S3): when BOTH fresh_as_of (a YYYY-MM-DD) and
    window_days are given, an origin whose export is older than window_days before
    fresh_as_of — or has a missing/unparseable exported_at — is DROPPED. A frozen
    snapshot past its 90-day window must not inflate a LIVE total. Both omitted
    (default) = no freshness filter = STAGE-1 behavior, byte-for-byte unchanged.
    Single source: this is the ONE place the merged dir is walked (cfp_effective
    calls it with the date rather than re-implementing the walk)."""
    by_origin: dict = {}
    if not os.path.isdir(merged_dir):
        return by_origin
    cutoff = None
    if fresh_as_of and window_days is not None:
        cutoff = datetime.date.fromisoformat(fresh_as_of) - datetime.timedelta(days=window_days)
    for name in sorted(os.listdir(merged_dir)):
        if not name.endswith(".json"):
            continue
        origin = name[:-5]
        if origin == exclude_origin:
            continue
        try:
            block = json.loads((merged_dir / name).read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if cutoff is not None:
            exported = block.get("exported_at")
            try:
                if not exported or datetime.date.fromisoformat(exported) < cutoff:
                    continue  # stale / dateless → drop (fail-safe: never inflate)
            except (ValueError, TypeError):
                continue
        by_origin[origin] = {
            t["topic"]: int(t.get("own_count") or 0)
            for t in block.get("topics", []) if t.get("topic")
        }
    return by_origin


def compute_effective(own_agg: dict, merged_by_origin: dict) -> dict:
    """Effective count per topic = local own + Σ(each other origin's own).

    own_agg = {topic: {own_count, n_patterns}} from cfp_export.aggregate_by_topic.
    Foreign topics absent locally are created with own = 0 (create-if-absent)."""
    topics = set(own_agg) | {t for m in merged_by_origin.values() for t in m}
    # T-319 STAGE 2 S2: the "unclassified" catch-all never escalates across
    # machines. Post-S2 exports already drop it, but a stale/old-version foreign
    # block could still carry it — this is the defense-in-depth guard so unrelated
    # untopic'd failures from different machines can never sum past ≥3 here.
    topics.discard("unclassified")
    result: dict = {}
    for topic in sorted(topics):
        own = int(own_agg.get(topic, {}).get("own_count", 0))
        contribs = {o: m[topic] for o, m in merged_by_origin.items() if topic in m}
        others = sum(contribs.values())
        result[topic] = {
            "own": own,
            "others": others,
            "effective": own + others,
            "origins": contribs,
        }
    return result


def fix_signals(effective: dict) -> list:
    """Build the proof-of-mechanism signal lines for topics that cross a line."""
    lines = []
    for topic in sorted(effective):
        eff = effective[topic]["effective"]
        if eff >= FIX_ESCALATED:
            lines.append(f"[fix-escalated] topic:{topic} · effective:{eff} (≥{FIX_ESCALATED})")
        elif eff >= FIX_REQUIRED:
            lines.append(f"[fix-required] topic:{topic} · effective:{eff} (≥{FIX_REQUIRED})")
    return lines


def _own_agg() -> dict:
    """This machine's own per-topic aggregate, read live from the local ledger."""
    return cfp_export.aggregate_by_topic(cfp_export._load_local_cfp())


def report(own_agg: dict | None = None) -> dict:
    """Recompute + print the effective per-topic totals from the current store."""
    own_agg = _own_agg() if own_agg is None else own_agg
    merged = load_merged(_merged_dir(), harness_paths.machine_id())
    effective = compute_effective(own_agg, merged)
    for topic in sorted(effective):
        e = effective[topic]
        print(f"  {topic}: effective={e['effective']} (own={e['own']} + others={e['others']})")
    for line in fix_signals(effective):
        print(line)
    return effective


def run_import(export_path: str) -> dict:
    doc = json.loads(open(export_path, encoding="utf-8").read())
    validate_export(doc)
    stored = store_origin(_merged_dir(), doc)
    print(f"merged origin {doc['origin_machine_id']} -> {stored}")
    return report()


# --- self-test ----------------------------------------------------------------

def _selftest() -> int:
    failures = []

    def check(name, cond, detail=""):
        if not cond:
            failures.append(f"{name}: {detail}")

    import tempfile
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        try:
            md = _merged_dir()

            # Local own: token-tracking=3, phase-gate-skip=2 (below the ≥3 line).
            own_agg = {
                "token-tracking": {"own_count": 3, "n_patterns": 1},
                "phase-gate-skip": {"own_count": 2, "n_patterns": 1},
            }

            # (a) effective = own + foreign. Import origin AAA: token-tracking +2.
            doc_a = {"schema_version": 1, "kind": KIND, "origin_machine_id": "AAA",
                     "exported_at": "2026-07-13",
                     "topics": [{"topic": "token-tracking", "own_count": 2, "n_patterns": 1},
                                # foreign-only topic -> create-if-absent (own local = 0)
                                {"topic": "index-drift", "own_count": 4, "n_patterns": 2}]}
            store_origin(md, doc_a)
            eff = compute_effective(own_agg, load_merged(md, "SELF"))
            check("a.effective", eff["token-tracking"]["effective"] == 5,
                  str(eff.get("token-tracking")))
            check("d.create_if_absent",
                  eff["index-drift"]["own"] == 0 and eff["index-drift"]["effective"] == 4,
                  str(eff.get("index-drift")))

            # (b) re-import same export -> REPLACE, idempotent (no accumulation).
            store_origin(md, doc_a)
            store_origin(md, doc_a)
            eff2 = compute_effective(own_agg, load_merged(md, "SELF"))
            check("b.idempotent", eff2["token-tracking"]["effective"] == 5,
                  f"re-import changed total: {eff2['token-tracking']}")

            # (c) 2 (local) + 2 (foreign BBB) -> 4 crosses ≥3 for phase-gate-skip.
            doc_b = {"schema_version": 1, "kind": KIND, "origin_machine_id": "BBB",
                     "exported_at": "2026-07-13",
                     "topics": [{"topic": "phase-gate-skip", "own_count": 2, "n_patterns": 1}]}
            store_origin(md, doc_b)
            eff3 = compute_effective(own_agg, load_merged(md, "SELF"))
            check("c.crosses", eff3["phase-gate-skip"]["effective"] == 4,
                  str(eff3.get("phase-gate-skip")))
            sigs = fix_signals(eff3)
            check("c.fix_required_emitted",
                  any("phase-gate-skip" in s and "[fix-required]" in s for s in sigs),
                  str(sigs))
            check("c.escalated_for_5",
                  any("index-drift" not in s for s in sigs) and
                  any("token-tracking" in s and "[fix-escalated]" in s for s in sigs),
                  f"token-tracking eff=5 should escalate: {sigs}")

            # own-origin exclusion: importing OUR OWN export back is a no-op.
            mid = harness_paths.machine_id()
            store_origin(md, {"schema_version": 1, "kind": KIND, "origin_machine_id": mid,
                              "exported_at": "2026-07-13",
                              "topics": [{"topic": "token-tracking", "own_count": 99,
                                          "n_patterns": 1}]})
            eff4 = compute_effective(own_agg, load_merged(md, mid))
            check("e.self_excluded", eff4["token-tracking"]["effective"] == 5,
                  f"own export leaked into effective: {eff4['token-tracking']}")

            # allow-list on import: a leaky field is stripped at store time.
            store_origin(md, {"schema_version": 1, "kind": KIND, "origin_machine_id": "CCC",
                              "exported_at": "2026-07-13",
                              "topics": [{"topic": "x", "own_count": 1, "n_patterns": 1,
                                          "symptom": "/Users/secret leak", "root": "leak"}]})
            block = json.loads((md / "CCC.json").read_text(encoding="utf-8"))
            extra = set(block["topics"][0].keys()) - _ALLOWED_TOPIC_FIELDS
            check("f.import_allowlist", not extra, f"leaked keys stored: {extra}")

            # validate rejects a bad schema.
            try:
                validate_export({"schema_version": 2, "kind": KIND,
                                 "origin_machine_id": "z", "topics": []})
                check("g.validate_rejects", False, "did not raise on schema_version 2")
            except ValueError:
                pass

            # SECURITY (scrutinize finding): a crafted origin id that could
            # traverse out of the store must be rejected before it is used as a
            # filename. Also rejects too-short ids and dotted names.
            for bad in ("../../evil", "a/b", "..", "x.y", "ab", "has space"):
                try:
                    validate_export({"schema_version": 1, "kind": KIND,
                                     "origin_machine_id": bad,
                                     "topics": []})
                    check(f"h.reject[{bad}]", False, "unsafe origin accepted")
                except ValueError:
                    pass
            # a real 12-hex machine id still passes.
            try:
                validate_export({"schema_version": 1, "kind": KIND,
                                 "origin_machine_id": "655356ef248c", "topics": []})
            except ValueError as e:
                check("h.valid_origin_ok", False, f"rejected a good id: {e}")

            # (i) S2: two machines each carrying "unclassified"=3 sum to 6 in the
            # store, yet the catch-all must NEVER appear in the effective total
            # and must NEVER emit a fix signal (unrelated untopic'd failures from
            # different machines are not the same failure — no false escalation).
            for m in ("DDD", "EEE"):
                store_origin(md, {"schema_version": 1, "kind": KIND, "origin_machine_id": m,
                                  "exported_at": "2026-07-13",
                                  "topics": [{"topic": "unclassified", "own_count": 3,
                                              "n_patterns": 2}]})
            eff5 = compute_effective(own_agg, load_merged(md, "SELF"))
            check("i.unclassified_dropped", "unclassified" not in eff5,
                  f"unclassified must never appear in effective: {list(eff5)}")
            check("i.unclassified_no_signal",
                  not any("unclassified" in s for s in fix_signals(eff5)),
                  f"unclassified must never emit a fix signal: {fix_signals(eff5)}")
        finally:
            os.environ.pop("HARNESS_SHARED_HOME", None)

    if failures:
        print("FAIL cfp_import selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK cfp_import selftest: all checks pass · per-origin REPLACE · idempotent · "
          "self-excluded · allow-list enforced · unsafe-origin rejected")
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--report"
    if arg == "--self-test":
        sys.exit(_selftest())
    elif arg == "--report":
        report()
        sys.exit(0)
    elif arg.startswith("-"):
        print(f"usage: {sys.argv[0]} [<export.json>|--report|--self-test]")
        sys.exit(2)
    else:
        run_import(arg)
        sys.exit(0)
