#!/usr/bin/env python3
"""skill_success.py — T-319 STAGE 2 S4 (Track 2): cross-machine skill/tool success wiki.

Track 1 (CFP) shares FAILURES that keep coming back. Track 2 shares the opposite:
a NEW approach that WORKED. When a [skill-miss] task (no manifest skill matched) still
completes successfully, the approach that carried it is worth remembering. If ≥3 FRESH
machines independently land on the same successful approach it becomes a
[promotion-candidate] — a PROPOSAL for the user to approve into a real skill. It is
NEVER auto-created (R14): the candidate is a signal a human acts on, exactly like CFP's
[fix-required] (M4 review #2 — closes the loop, so S4 is not a write-only notebook).

Single source (the S3-scrutinize lesson): the per-origin merge ENGINE is REUSED VERBATIM
from cfp_import — load_merged (per-origin dir-walk + 90-day freshness drop), compute_effective
(own + Σ fresh others), store_origin (the single per-origin writer, called with kind=KIND),
sanitize_topics + _SAFE_ORIGIN (the security-critical allow-list + path-traversal guard). This
file adds ONLY the per-track adapter: the skill export doc-shape, KIND="skill-export", its own
merged dir, and the promotion signal. A skill "approach" is keyed onto the same `topic` field the
engine already merges on, so NO merge or writer code is duplicated.

Privacy: the raw local ledger is MACHINE-LOCAL (~/.claude, never the synced folder). Only the
sanitized merged block is ever written into the shared folder, and only by the opt-in-gated
S6 hook (export_own). record() logs locally; nothing leaves the machine here.

Usage:
  python3 scripts/skill_success.py record <skill_key> [--context <detail>]   # birth: log a win
  python3 scripts/skill_success.py export                                     # own block -> merged (S6 calls this)
  python3 scripts/skill_success.py --report                                   # effective + candidates
  python3 scripts/skill_success.py --self-test
  ... --date YYYY-MM-DD                                                        # freeze "today" (tests)
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths
import cfp_import
from cfp_decay import WINDOW_DAYS

SCHEMA_VERSION = 1
KIND = "skill-export"
# ≥3 fresh machines agree → propose the approach as a skill. Its own policy that
# happens to share CFP's number 3 — kept independent (a skill-promotion threshold
# and a failure-fix threshold are different decisions).
CANDIDATE_THRESHOLD = 3
LEDGER_ENV = "HARNESS_SKILL_LEDGER"          # test override for the machine-local ledger


# --- machine-local ledger (never synced — honors opt-in) ----------------------

def _local_ledger_path() -> str:
    """The raw own-success ledger. Machine-local (~/.claude), NOT under the synced
    shared folder — so recording a win never puts data in the shared pool."""
    override = os.environ.get(LEDGER_ENV)
    if override:
        return override
    return os.path.expanduser(os.path.join("~", ".claude", "harness_skill_success.json"))


def _load_ledger() -> dict:
    p = _local_ledger_path()
    if os.path.isfile(p):
        try:
            return json.loads(open(p, encoding="utf-8").read())
        except (ValueError, OSError):
            return {}
    return {}


def _save_ledger(d: dict) -> None:
    p = _local_ledger_path()
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(json.dumps(d, indent=2, sort_keys=True) + "\n")


def _norm_key(skill_key: str) -> str:
    """Constrain the approach key to a safe charset (it becomes a merge `topic` string
    AND part of a filename downstream — untrusted-adjacent). Illegal chars → '_'."""
    k = re.sub(r"[^A-Za-z0-9_.:\-]", "_", str(skill_key).strip())[:80]
    return k or "unnamed"


def record(skill_key: str, context: str | None = None) -> dict:
    """Log ONE successful use of an approach. `context` is HASHED before store
    (confidential user detail is never kept raw — S4 constraint); it is kept only to
    give the human reviewer a sense of how many distinct situations the win spans, and
    it never leaves the machine (export allow-lists it out anyway)."""
    key = _norm_key(skill_key)
    led = _load_ledger()
    ent = led.setdefault(key, {"count": 0, "contexts": []})
    ent["count"] = int(ent.get("count") or 0) + 1
    if context:
        h = hashlib.sha1(str(context).encode("utf-8")).hexdigest()[:8]
        ctxs = ent.setdefault("contexts", [])
        if h not in ctxs:
            ctxs.append(h)
            del ctxs[:-10]  # cap — a rolling window of distinct-situation hashes
    _save_ledger(led)
    return led


def _own_agg(led: dict | None = None) -> dict:
    """Own ledger → {topic: {own_count, n_patterns}} — the shape compute_effective wants."""
    led = _load_ledger() if led is None else led
    return {k: {"own_count": int(v.get("count") or 0), "n_patterns": 1}
            for k, v in led.items()}


# --- shared merged store (per-track dir; ROOT is the single-sourced shared_home) --

def _merged_dir():
    """<shared>/skills/merged — one file per contributing origin. Sibling of cfp/merged;
    the shared ROOT stays single-sourced in harness_paths.shared_home()."""
    d = harness_paths.shared_home() / "skills" / "merged"
    d.mkdir(parents=True, exist_ok=True)
    return d


def build_export(machine_id: str, own_agg: dict, today: str) -> dict:
    """The skill-track export doc (per-track shape — mirrors cfp_export.build_export)."""
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": KIND,
        "origin_machine_id": machine_id,
        "exported_at": today,
        "topics": [{"topic": k, "own_count": v["own_count"], "n_patterns": v["n_patterns"]}
                   for k, v in sorted(own_agg.items())],
    }


def export_own(today: str | None = None) -> str:
    """Write THIS machine's sanitized skill block into the shared merged store, REUSING the
    single writer cfp_import.store_origin (the `kind` arg stamps it as a skill block — no
    duplicate writer). Called ONLY by the opt-in-gated S6 hook; origin is always our own
    machine_id, so no foreign-input guard is needed here."""
    today = today or datetime.date.today().isoformat()
    doc = build_export(harness_paths.machine_id(), _own_agg(), today)
    return cfp_import.store_origin(_merged_dir(), doc, kind=KIND)


def effective(today: str | None = None, own_agg: dict | None = None) -> dict:
    """Per-approach effective count across the fleet (own + Σ fresh others).
    The dir-walk + freshness drop live in cfp_import.load_merged (single source)."""
    today = today or datetime.date.today().isoformat()
    own_agg = _own_agg() if own_agg is None else own_agg
    merged = cfp_import.load_merged(_merged_dir(), harness_paths.machine_id(),
                                    fresh_as_of=today, window_days=WINDOW_DAYS)
    return cfp_import.compute_effective(own_agg, merged)


def candidate_lines(eff: dict) -> list:
    """The signal a HUMAN acts on — a candidate is a proposal, never an auto-created skill."""
    return [f"[promotion-candidate] skill:{t} · effective:{e['effective']} "
            f"(≥{CANDIDATE_THRESHOLD}) origins={e['origins']}"
            for t, e in sorted(eff.items()) if e["effective"] >= CANDIDATE_THRESHOLD]


# --- CLI ----------------------------------------------------------------------

def _parse_today(argv):
    return argv[argv.index("--date") + 1] if "--date" in argv else \
        datetime.date.today().isoformat()


def main(argv) -> int:
    today = _parse_today(argv)
    if "record" in argv:
        i = argv.index("record")
        key = argv[i + 1] if i + 1 < len(argv) else None
        if not key:
            print("usage: skill_success.py record <skill_key> [--context <detail>]")
            return 2
        ctx = argv[argv.index("--context") + 1] if "--context" in argv else None
        led = record(key, ctx)
        print(f"recorded skill:{_norm_key(key)} · own_count={led[_norm_key(key)]['count']}")
        return 0
    if "export" in argv:
        print(f"exported own skill block -> {export_own(today)}")
        return 0
    # --report (default): effective per approach + candidate proposals
    eff = effective(today)
    for t in sorted(eff):
        e = eff[t]
        print(f"  {t}: effective={e['effective']} (own={e['own']} + others={e['others']})")
    for line in candidate_lines(eff):
        print(line)
    return 0


# --- self-test ----------------------------------------------------------------

def _selftest() -> int:
    import tempfile
    failures = []

    def check(name, cond, detail=""):
        if not cond:
            failures.append(f"{name}: {detail}")

    TODAY = "2026-07-14"
    with tempfile.TemporaryDirectory() as td:
        os.environ["HARNESS_SHARED_HOME"] = td
        os.environ[LEDGER_ENV] = os.path.join(td, "ledger.json")
        try:
            md = _merged_dir()

            # (a) record is additive + local-only (nothing written to the shared merged store).
            record("edge-runtime-shim")
            led = record("edge-runtime-shim", context="secret-project-x")
            check("a.record_counts", led["edge-runtime-shim"]["count"] == 2,
                  str(led.get("edge-runtime-shim")))
            check("a.context_hashed",
                  led["edge-runtime-shim"]["contexts"]
                  and all(re.fullmatch(r"[0-9a-f]{8}", h)
                          for h in led["edge-runtime-shim"]["contexts"]),
                  "context must be stored as an 8-hex hash, never raw")
            check("a.record_no_shared_write", not os.listdir(md),
                  "record() must NOT write to the shared merged store")

            # (b) own-only (no fresh foreign origins) → below threshold → NO candidate.
            eff = effective(TODAY)
            check("b.own_only", eff["edge-runtime-shim"]["effective"] == 2, str(eff))
            check("b.no_candidate_below", candidate_lines(eff) == [],
                  f"2 < {CANDIDATE_THRESHOLD} must not propose: {candidate_lines(eff)}")

            # (c) one FRESH foreign origin agrees → own 2 + 1 = 3 → [promotion-candidate].
            cfp_import.store_origin(md, {  # store_origin is kind-blind on the topics it writes
                "schema_version": 1, "kind": KIND, "origin_machine_id": "FRESHSK1",
                "exported_at": TODAY,
                "topics": [{"topic": "edge-runtime-shim", "own_count": 1, "n_patterns": 1}]})
            eff = effective(TODAY)
            check("c.fresh_promotes", eff["edge-runtime-shim"]["effective"] == 3, str(eff))
            cands = candidate_lines(eff)
            check("c.candidate_emitted",
                  any("edge-runtime-shim" in c for c in cands), str(cands))

            # (d) a STALE foreign origin (>90d) is dropped — does not inflate to a candidate.
            cfp_import.store_origin(md, {
                "schema_version": 1, "kind": KIND, "origin_machine_id": "STALESK1",
                "exported_at": "2026-01-01",   # >90d before 2026-07-14
                "topics": [{"topic": "papaparse-stream", "own_count": 9, "n_patterns": 1}]})
            eff = effective(TODAY)
            check("d.stale_dropped",
                  eff.get("papaparse-stream", {}).get("effective", 0) == 0
                  or "papaparse-stream" not in eff,
                  f"stale origin must not inflate: {eff.get('papaparse-stream')}")

            # (f) export_own round-trips via the shared writer: valid, sanitized own block.
            path = export_own(TODAY)
            blk = json.loads(open(path, encoding="utf-8").read())
            check("f.export_kind", blk["kind"] == KIND, blk.get("kind"))
            check("f.export_sanitized",
                  all(set(t) == {"topic", "own_count", "n_patterns"} for t in blk["topics"]),
                  "exported topics must be allow-listed to the 3 safe fields")
        finally:
            os.environ.pop("HARNESS_SHARED_HOME", None)
            os.environ.pop(LEDGER_ENV, None)

    if failures:
        print("FAIL skill_success selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK skill_success selftest: all checks pass · record local-only + context hashed · "
          "merge engine reused from cfp_import · own+Σfresh-others · stale dropped · "
          "≥3 → [promotion-candidate] (human-approved, never auto)")
    return 0


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--self-test" in a:
        sys.exit(_selftest())
    sys.exit(main(a))
