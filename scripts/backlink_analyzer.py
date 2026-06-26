#!/usr/bin/env python3
"""
backlink_analyzer.py — Topic-Graph Backlink Analyzer (v2 · weighted facets)
Computes related[] entries in index_files.json from per-file weighted topic overlap.

Algorithm (v2 · see knowledge/topic_facet_schema.md §7):
  weight_F(t) = 2 if t in major(F), 1 if t in minor(F)
  score(A,B)  = Σ_{t in shared} min(weight_A(t), weight_B(t))
  strength:   "strong"  if score >= 4
              "related" if 2 <= score < 4
              "weak"    if score == 1
              (excluded) if score < min_score (default 2)
  Backward-compatible: a legacy flat topics=[...] is read as all-minor (weight 1),
  so score == number of shared topics until the file is re-tagged to {major,minor}.

Usage:
  python3 scripts/backlink_analyzer.py              # update index_files.json in-place
  python3 scripts/backlink_analyzer.py --dry-run    # print results, no file write
  python3 scripts/backlink_analyzer.py --min-score 1   # include weak links
  python3 scripts/backlink_analyzer.py --show-matrix   # print full score matrix
"""

import json
import argparse
import sys
from pathlib import Path

INDEX_PATH   = "knowledge/index_files.json"
REGISTRY_PATH = "knowledge/topic_registry.json"


def load_files():
    try:
        idx = json.load(open(INDEX_PATH))
    except FileNotFoundError:
        print(f"ERROR: {INDEX_PATH} not found", file=sys.stderr)
        sys.exit(1)
    try:
        registry = json.load(open(REGISTRY_PATH))
        valid_topics = set(registry["topics"])
    except FileNotFoundError:
        print(f"WARN: {REGISTRY_PATH} not found — skipping topic validation", file=sys.stderr)
        valid_topics = None
    return idx, valid_topics


def normalize_index(idx):
    """Heal malformed entries: flatten any stray list-valued wrapper key
    (e.g. "files": [ {path, ...}, ... ]) into proper top-level path->meta
    entries, then drop the wrapper. Returns count of entries healed.
    Keeps this Stop-hook regenerator fail-safe against bad appends (T-188)."""
    healed = 0
    for key in [k for k, v in idx.items() if isinstance(v, list)]:
        for item in idx[key]:
            if isinstance(item, dict) and item.get("path"):
                p = item["path"]
                idx[p] = {k: v for k, v in item.items() if k != "path"}
                healed += 1
        del idx[key]
    return healed


def topic_weights(meta):
    """Return {topic: weight} for a file entry.
    v2 schema  : topics = {"major": [...], "minor": [...]}  -> major=2, minor=1
    legacy flat: topics = [...]                              -> all weight 1 (minor-equiv)
    A topic appearing in both major and minor keeps the higher (major) weight."""
    t = meta.get("topics", [])
    weights = {}
    if isinstance(t, dict):
        for topic in t.get("minor", []):
            weights[topic] = 1
        for topic in t.get("major", []):
            weights[topic] = 2
    elif isinstance(t, list):
        for topic in t:
            weights[topic] = 1
    return weights


def score_to_strength(score):
    if score >= 4:
        return "strong"
    if score >= 2:
        return "related"
    if score >= 1:
        return "weak"
    return None


def all_topics(meta):
    """Flat set of every topic on an entry, regardless of v1/v2 shape (for validation)."""
    t = meta.get("topics", [])
    if isinstance(t, dict):
        return set(t.get("major", [])) | set(t.get("minor", []))
    if isinstance(t, list):
        return set(t)
    return set()


def validate_topics(idx, valid_topics):
    if not valid_topics:
        return
    errors = []
    warn_summary = []
    for path, meta in idx.items():
        if not isinstance(meta, dict):
            continue
        for t in all_topics(meta):
            if t not in valid_topics:
                errors.append(f"  {path}: unknown topic '{t}'")
        if not meta.get("summary"):
            warn_summary.append(f"  {path}: summary empty — run backfill_knowledge_index.py")
    if errors:
        # WARN, do not abort (T-188): this is a fail-safe Stop-hook regenerator.
        # Off-vocabulary topics still intersect each other, so related[] stays
        # meaningful — vocabulary cleanup is a separate data-hygiene task.
        print(f"WARN: {len(errors)} off-vocabulary topic(s) — related[] still computed; "
              f"clean up to closed vocab (knowledge/topic_registry.json):", file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
    if warn_summary:
        print(f"WARN: {len(warn_summary)} entries missing summary (run backfill_knowledge_index.py)", file=sys.stderr)


def compute_related(idx, min_score=2):
    results = {}
    paths = [p for p in idx.keys() if isinstance(idx[p], dict)]
    weights = {p: topic_weights(idx[p]) for p in paths}

    for path_a in paths:
        wa = weights[path_a]
        if not wa:
            results[path_a] = []
            continue

        related = []
        for path_b in paths:
            if path_a == path_b:
                continue
            wb = weights[path_b]
            shared = set(wa) & set(wb)
            if not shared:
                continue

            score = sum(min(wa[t], wb[t]) for t in shared)
            strength = score_to_strength(score)
            if strength is None or score < min_score:
                continue
            related.append({
                "path": path_b,
                "strength": strength,
                "score": score,
                "shared_topics": sorted(shared),
            })

        results[path_a] = sorted(related, key=lambda x: (-x["score"], x["path"]))

    return results


def print_matrix(idx, related_map):
    print("\n=== Score Matrix ===")
    paths = sorted(idx.keys())
    for path_a in paths:
        entries = related_map.get(path_a, [])
        if not entries:
            continue
        short_a = path_a.split("/")[-1][:30]
        print(f"\n{short_a}")
        for e in entries:
            short_b = e['path'].split("/")[-1][:35]
            bar = "█" * min(int(e['score']), 10)
            print(f"  {e['strength']:8s} {e['score']:>2}  {bar:10s} → {short_b}")
            print(f"           shared: {', '.join(e['shared_topics'])}")


def main():
    parser = argparse.ArgumentParser(description="Compute topic-graph related[] links (v2 weighted)")
    parser.add_argument("--dry-run",     action="store_true", help="Print results, do not write file")
    parser.add_argument("--min-score",   type=int, default=2, help="Minimum link score to keep (default 2; use 1 to include weak)")
    parser.add_argument("--min-overlap", type=float, default=None, help="(deprecated v1 alias — ignored; use --min-score)")
    parser.add_argument("--show-matrix", action="store_true", help="Print full score matrix")
    args = parser.parse_args()

    if args.min_overlap is not None:
        print("[backlink_analyzer] NOTE: --min-overlap is deprecated (v1); scoring now uses --min-score. Ignoring.", file=sys.stderr)

    idx, valid_topics = load_files()
    healed = normalize_index(idx)
    if healed:
        print(f"[backlink_analyzer] normalized {healed} malformed entr(y/ies) — flattened stray list wrapper")
    validate_topics(idx, valid_topics)

    related_map = compute_related(idx, min_score=args.min_score)

    total_links = sum(len(v) for v in related_map.values())
    entries_with_related = sum(1 for v in related_map.values() if v)

    print(f"[backlink_analyzer] Analyzed {len(idx)} files")
    print(f"  Entries with related links: {entries_with_related}/{len(idx)}")
    print(f"  Total related[] links computed: {total_links}")
    print(f"  Min score threshold: {args.min_score}")

    if args.show_matrix:
        print_matrix(idx, related_map)
    else:
        for path, entries in sorted(related_map.items()):
            if entries:
                short = path.split("/")[-1]
                links = ", ".join(f"{e['path'].split('/')[-1]}({e['score']})" for e in entries[:3])
                suffix = f" +{len(entries)-3} more" if len(entries) > 3 else ""
                print(f"  {short}: {links}{suffix}")

    if args.dry_run:
        print("\n[dry-run] No changes written.")
        return

    # Write related[] back to index_files.json
    for path, entries in related_map.items():
        if path in idx:
            # Strip shared_topics from persisted output (verbose, keep index lean)
            idx[path]["related"] = [
                {"path": e["path"], "strength": e["strength"], "score": e["score"]}
                for e in entries
            ]

    json.dump(idx, open(INDEX_PATH, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"\n[backlink_analyzer] Written → {INDEX_PATH}")


if __name__ == "__main__":
    main()
