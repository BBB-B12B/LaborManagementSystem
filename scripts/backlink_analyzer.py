#!/usr/bin/env python3
"""
backlink_analyzer.py — Topic-Graph Backlink Analyzer
Computes related[] entries in index_files.json based on topic overlap.

Algorithm:
  overlap(A, B) = |topics_A ∩ topics_B| / |topics_A|
  strength: "strong"  if overlap >= 1.0
            "related" if 0.5 <= overlap < 1.0
            (excluded)  if overlap < min_overlap

Usage:
  python3 scripts/backlink_analyzer.py              # update index_files.json in-place
  python3 scripts/backlink_analyzer.py --dry-run    # print results, no file write
  python3 scripts/backlink_analyzer.py --min-overlap 0.6   # raise threshold
  python3 scripts/backlink_analyzer.py --show-matrix       # print full overlap matrix
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


def validate_topics(idx, valid_topics):
    if not valid_topics:
        return
    errors = []
    warn_summary = []
    for path, meta in idx.items():
        for t in meta.get("topics", []):
            if t not in valid_topics:
                errors.append(f"  {path}: unknown topic '{t}'")
        if not meta.get("summary"):
            warn_summary.append(f"  {path}: summary empty — run backfill_knowledge_index.py")
    if errors:
        print("VALIDATION ERRORS — topics not in registry:", file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
        sys.exit(1)
    if warn_summary:
        print(f"WARN: {len(warn_summary)} entries missing summary (run backfill_knowledge_index.py)", file=sys.stderr)


def compute_related(idx, min_overlap=0.5):
    results = {}
    paths = list(idx.keys())

    for path_a in paths:
        topics_a = set(idx[path_a].get("topics", []))
        if not topics_a:
            results[path_a] = []
            continue

        related = []
        for path_b in paths:
            if path_a == path_b:
                continue
            topics_b = set(idx[path_b].get("topics", []))
            if not topics_b:
                continue

            overlap = len(topics_a & topics_b) / len(topics_a)
            if overlap >= 1.0:
                related.append({
                    "path": path_b,
                    "strength": "strong",
                    "overlap": 1.0,
                    "shared_topics": sorted(topics_a & topics_b)
                })
            elif overlap >= min_overlap:
                related.append({
                    "path": path_b,
                    "strength": "related",
                    "overlap": round(overlap, 2),
                    "shared_topics": sorted(topics_a & topics_b)
                })

        results[path_a] = sorted(related, key=lambda x: -x["overlap"])

    return results


def print_matrix(idx, related_map):
    print("\n=== Overlap Matrix ===")
    paths = sorted(idx.keys())
    for path_a in paths:
        entries = related_map.get(path_a, [])
        if not entries:
            continue
        short_a = path_a.split("/")[-1][:30]
        print(f"\n{short_a}")
        for e in entries:
            short_b = e['path'].split("/")[-1][:35]
            bar = "█" * int(e['overlap'] * 10)
            print(f"  {e['strength']:8s} {e['overlap']:.2f} {bar:10s} → {short_b}")
            print(f"           shared: {', '.join(e['shared_topics'])}")


def main():
    parser = argparse.ArgumentParser(description="Compute topic-graph related[] links")
    parser.add_argument("--dry-run",     action="store_true", help="Print results, do not write file")
    parser.add_argument("--min-overlap", type=float, default=0.5, help="Minimum overlap threshold (default 0.5)")
    parser.add_argument("--show-matrix", action="store_true", help="Print full overlap matrix")
    args = parser.parse_args()

    idx, valid_topics = load_files()
    validate_topics(idx, valid_topics)

    related_map = compute_related(idx, min_overlap=args.min_overlap)

    total_links = sum(len(v) for v in related_map.values())
    entries_with_related = sum(1 for v in related_map.values() if v)

    print(f"[backlink_analyzer] Analyzed {len(idx)} files")
    print(f"  Entries with related links: {entries_with_related}/{len(idx)}")
    print(f"  Total related[] links computed: {total_links}")
    print(f"  Min overlap threshold: {args.min_overlap}")

    if args.show_matrix:
        print_matrix(idx, related_map)
    else:
        # Print summary per file
        for path, entries in sorted(related_map.items()):
            if entries:
                short = path.split("/")[-1]
                links = ", ".join(f"{e['path'].split('/')[-1]}({e['overlap']:.1f})" for e in entries[:3])
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
                {"path": e["path"], "strength": e["strength"], "overlap": e["overlap"]}
                for e in entries
            ]

    json.dump(idx, open(INDEX_PATH, "w"), indent=2)
    print(f"\n[backlink_analyzer] Written → {INDEX_PATH}")


if __name__ == "__main__":
    main()
