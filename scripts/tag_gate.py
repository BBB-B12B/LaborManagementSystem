#!/usr/bin/env python3
"""tag_gate.py — T-320 S1 · Core resolver + auto-tag (reuse-first · conservative synonym).

The ONE reusable module for the label/topic hard-gate. Two entry points:

  is_tagged(path)  -- PURE CODE presence check (deterministic, fast). Used by the
                      gate on every file op. No AI, no network, no side effects.

  resolve(cand)    -- Map a candidate topic/label string onto the CLOSED vocab,
                      reuse-first. Returns {verdict, matched_id, reason, score}:
                        verdict = reuse           -> an existing id/label fits; use it
                                = new-justified   -> genuinely new; may mint (with reason)
                                = reject-ambiguous -> two+ plausible matches; a human
                                                      must decide (the gate BLOCKS here)
                      Conservative by design: over-merging distinct concepts is a
                      silent capability loss, so a match must be confident + clear-margin
                      or it is NOT merged.

  usage_count(id)  -- How many indexed files still use a topic id / label. Feeds the
                      delete-side orphan prune (S4): 0 users -> safe to GC.

Determinism (topic_facet_schema §6): resolve() is a pure function of its input +
the current registry; the same candidate always yields the same verdict. AI judgment
happens ONCE at file-create time; the cached result is what the hot path reads.

CLI:
  python3 scripts/tag_gate.py --self-test
  python3 scripts/tag_gate.py --resolve "knowledge base"
  python3 scripts/tag_gate.py --is-tagged knowledge/foo.md
  python3 scripts/tag_gate.py --usage knowledge_base
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# ---- paths -----------------------------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)  # repo root = parent of scripts/
_REGISTRY = os.path.join(_ROOT, "knowledge", "topic_registry.json")
_INDEX = os.path.join(_ROOT, "knowledge", "index_files.json")

# ---- conservative synonym map (hand-curated, safe) -------------------------
# Only obvious abbreviations / surface variants of a SINGLE closed topic id.
# Kept deliberately small: the default path is exact-match; this map only rescues
# well-known short forms. A candidate NOT here and NOT a clear description-overlap
# match stays "new-justified" rather than being force-merged.
_SYNONYMS = {
    "kb": "knowledge_base",
    "knowledge store": "knowledge_base",
    "prompt cache": "prompt_caching",
    "boot": "boot_sequence",
    "routing": "per_turn_routing",
    "mece": "mece_planning",
    "react": "react_loop",
    "session": "session_management",
    "cfp": "cfp_logging",
    "topic registry": "topic_graph",
    "topic taxonomy": "topic_graph",
}

# High bar for a description-overlap merge, plus a clear-margin requirement so two
# similar topics never silently collapse into one.
_MERGE_MIN = 0.55       # candidate tokens covered by the winning topic
_MERGE_MARGIN = 0.20    # winner must beat runner-up by this much
_AMBIG_FLOOR = 0.35     # runner-up above this AND inside margin -> ambiguous, block

_WORD = re.compile(r"[a-z0-9]+")
# generic tokens that carry no discriminating signal for a merge decision
_STOP = {"the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "data",
         "agent", "system", "file", "files", "spec", "using", "via", "per"}


def _norm(s: str) -> str:
    """Lowercase, non-alnum -> underscore, collapse repeats, strip."""
    s = re.sub(r"[^a-z0-9]+", "_", s.strip().lower())
    return re.sub(r"_+", "_", s).strip("_")


def _tokens(s: str) -> set:
    return {t for t in _WORD.findall(s.lower()) if t not in _STOP and len(t) > 1}


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _used_topics(topics) -> set:
    """Normalize an entry's `topics` field to a flat set of topic ids.

    Two on-disk shapes exist: the v2 dict {major:[], minor:[]} and a legacy
    flat list. Both are handled so the gate never crashes on old records.
    """
    if isinstance(topics, dict):
        return set(topics.get("major", []) or []) | set(topics.get("minor", []) or [])
    if isinstance(topics, list):
        return set(topics)
    return set()


def _has_major(topics) -> bool:
    """A real (non-empty) topic assignment, tolerant of both on-disk shapes."""
    if isinstance(topics, dict):
        return bool(topics.get("major"))
    if isinstance(topics, list):
        return bool(topics)
    return False


# ---- entry point 1: presence check (PURE CODE) -----------------------------
def is_tagged(path: str, index: dict | None = None) -> bool:
    """True iff `path` has a real topic assignment in index_files.json.

    Deterministic presence check — no AI. A file counts as tagged when it has an
    entry with at least one MAJOR topic and is not still awaiting backfill.
    """
    idx = index if index is not None else _load(_INDEX)
    files = idx.get("files", idx)
    entry = files.get(path)
    if not isinstance(entry, dict):
        return False
    if entry.get("backfill_pending") is True:
        return False
    return _has_major(entry.get("topics"))


# ---- entry point 2: reuse-first resolver -----------------------------------
def resolve(candidate: str, registry: dict | None = None) -> dict:
    """Map a candidate topic/label onto the closed vocab, reuse-first + conservative."""
    reg = registry if registry is not None else _load(_REGISTRY)
    topics = reg.get("topics", [])
    topic_set = set(topics)
    descriptions = reg.get("descriptions", {})
    labels_by_topic = reg.get("labels_by_topic", {})

    cand_norm = _norm(candidate)

    # 1) exact topic id (e.g. "knowledge base" -> knowledge_base ; "prompt caching" -> prompt_caching)
    if cand_norm in topic_set:
        return {"verdict": "reuse", "matched_id": cand_norm, "kind": "topic",
                "reason": "exact topic id", "score": 1.0}

    # 2) exact existing label (normalized) -> reuse that label
    for topic, labels in labels_by_topic.items():
        for lbl in labels:
            if _norm(lbl) == cand_norm:
                return {"verdict": "reuse", "matched_id": topic, "kind": "label",
                        "reason": f"exact existing label under {topic}", "score": 1.0,
                        "label": lbl}

    # 3) curated synonym map (obvious short forms only)
    cand_spaced = cand_norm.replace("_", " ")
    if cand_spaced in _SYNONYMS:
        tid = _SYNONYMS[cand_spaced]
        return {"verdict": "reuse", "matched_id": tid, "kind": "topic",
                "reason": f"curated synonym '{cand_spaced}' -> {tid}", "score": 0.9}

    # 4) conservative description-overlap match (high bar + clear margin)
    ctok = _tokens(candidate)
    scored = []
    if ctok:
        for tid in topics:
            ttok = _tokens(tid.replace("_", " ")) | _tokens(descriptions.get(tid, ""))
            if not ttok:
                continue
            covered = len(ctok & ttok) / len(ctok)
            scored.append((covered, tid))
        scored.sort(reverse=True)

    if scored and scored[0][0] >= _MERGE_MIN:
        top_score, top_id = scored[0]
        runner = scored[1][0] if len(scored) > 1 else 0.0
        if top_score - runner >= _MERGE_MARGIN:
            return {"verdict": "reuse", "matched_id": top_id, "kind": "topic",
                    "reason": f"description overlap {top_score:.2f} (margin {top_score - runner:.2f})",
                    "score": round(top_score, 2)}
        # two topics both plausibly fit and neither clearly wins -> do NOT guess
        return {"verdict": "reject-ambiguous", "matched_id": None, "kind": "topic",
                "reason": (f"ambiguous: {top_id} {top_score:.2f} vs {scored[1][1]} "
                           f"{runner:.2f} within margin"),
                "score": round(top_score, 2)}

    if scored and _AMBIG_FLOOR <= scored[0][0] < _MERGE_MIN:
        # weakly similar to something but below the confident-merge bar -> flag, don't merge
        return {"verdict": "reject-ambiguous", "matched_id": None, "kind": "topic",
                "reason": f"weak overlap {scored[0][0]:.2f} with {scored[0][1]} (below merge bar)",
                "score": round(scored[0][0], 2)}

    # 5) genuinely novel -> may mint, WITH justification
    return {"verdict": "new-justified", "matched_id": None, "kind": "label",
            "reason": "no exact/synonym/confident match in closed vocab", "score": 0.0}


# ---- entry point 3: usage count (feeds delete-side prune, S4) ---------------
def usage_count(name: str, registry: dict | None = None, index: dict | None = None) -> int:
    """Count indexed files still using a topic id (major+minor) OR a label string."""
    reg = registry if registry is not None else _load(_REGISTRY)
    idx = index if index is not None else _load(_INDEX)
    files = idx.get("files", idx)

    # topic id: count files whose topic_map / topics reference it
    n = 0
    for entry in files.values():
        if not isinstance(entry, dict):
            continue
        if name in _used_topics(entry.get("topics")):
            n += 1
    # label string: presence in labels_by_topic counts as 1 registration
    if n == 0:
        for labels in reg.get("labels_by_topic", {}).values():
            if any(_norm(lbl) == _norm(name) or lbl == name for lbl in labels):
                n += 1
                break
    return n


# ---- self-test --------------------------------------------------------------
def _self_test() -> int:
    reg = _load(_REGISTRY)
    idx = _load(_INDEX)
    checks = []

    # Verify-2: true synonym reused to the RIGHT id
    r = resolve("knowledge base", reg)
    checks.append(("resolve 'knowledge base' -> reuse:knowledge_base",
                   r["verdict"] == "reuse" and r["matched_id"] == "knowledge_base"))

    # Verify-3 (false-merge guard): "prompt caching" must NOT be merged into knowledge_base
    r = resolve("prompt caching", reg)
    checks.append(("resolve 'prompt caching' NOT merged into knowledge_base",
                   r["matched_id"] != "knowledge_base"))

    # genuinely novel -> new-justified (not a silent merge)
    r = resolve("quantum flux capacitor wobble", reg)
    checks.append(("resolve novel -> new-justified",
                   r["verdict"] == "new-justified"))

    # presence check both directions
    checks.append(("is_tagged known tagged file",
                   is_tagged("knowledge/agent-dev-wiki-skill-sharing-spec.md", idx) is True))
    checks.append(("is_tagged missing file -> False",
                   is_tagged("knowledge/__does_not_exist__.md", idx) is False))

    # usage_count of a live topic
    checks.append(("usage_count knowledge_base >= 1",
                   usage_count("knowledge_base", reg, idx) >= 1))

    ok = True
    for name, passed in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
        ok = ok and passed
    print(f"tag_gate self-test: {'ALL PASS' if ok else 'FAILURES'} "
          f"({sum(1 for _, p in checks if p)}/{len(checks)})")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="tag_gate — reuse-first label/topic resolver")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--resolve", metavar="CAND")
    ap.add_argument("--is-tagged", metavar="PATH")
    ap.add_argument("--usage", metavar="NAME")
    args = ap.parse_args()

    if args.self_test:
        return _self_test()
    if args.resolve is not None:
        print(json.dumps(resolve(args.resolve), ensure_ascii=False))
        return 0
    if args.is_tagged is not None:
        print(json.dumps({"path": args.is_tagged, "tagged": is_tagged(args.is_tagged)}))
        return 0
    if args.usage is not None:
        print(json.dumps({"name": args.usage, "usage_count": usage_count(args.usage)}))
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
