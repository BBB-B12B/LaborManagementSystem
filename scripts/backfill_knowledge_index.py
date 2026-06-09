#!/usr/bin/env python3
"""
backfill_knowledge_index.py — Populate summary/key_claims/supersedes in index_files.json

Two-step workflow (no SDK required):
  Step 1: python3 scripts/backfill_knowledge_index.py --extract [--file path]
          → reads files, extracts scaled excerpts, auto-detects supersedes chain
          → outputs JSON to stdout (pure Python, 0 LLM tokens)

  Step 2: Agent reads excerpt JSON → generates {summary, key_claims[]} per entry
          (done by agent/sub-agent — not this script)

  Step 3: python3 scripts/backfill_knowledge_index.py --write results.json [--dry-run]
          → validates key_claims (≥4 words each) → writes to index_files.json

Usage:
  python3 scripts/backfill_knowledge_index.py --extract                    # all missing entries
  python3 scripts/backfill_knowledge_index.py --extract --file knowledge/harness_flow_20260526.md
  python3 scripts/backfill_knowledge_index.py --write /tmp/results.json --dry-run
  python3 scripts/backfill_knowledge_index.py --auto-supersedes --dry-run  # detect date chains
"""

import json
import argparse
import os
import re
import sys
import datetime
from pathlib import Path

INDEX_PATH = "knowledge/index_files.json"
MAX_EXCERPT_LINES = 60   # hard cap regardless of file size


def scale_excerpt(lines):
    """Return scaled excerpt based on file size. Hard cap: MAX_EXCERPT_LINES."""
    n = len(lines)
    headers = [l for l in lines if l.startswith('#')][:30]

    if n < 80:
        body = lines[:15]
    elif n < 300:
        body = lines[:20] + lines[-10:]
    else:
        body = lines[:20] + lines[-15:]

    # Deduplicate (body may overlap headers for small files)
    seen, combined = set(), []
    for l in body + headers:
        if l not in seen:
            seen.add(l)
            combined.append(l)

    return combined[:MAX_EXCERPT_LINES]


def extract_entries(idx, target_path=None):
    """Extract excerpts for entries missing summary or key_claims."""
    results = []
    for path, entry in idx.items():
        if target_path and path != target_path:
            continue
        needs_backfill = (not entry.get('summary') or not entry.get('key_claims'))
        if not needs_backfill:
            continue
        if os.path.isdir(path):
            results.append({"path": path, "status": "is_directory", "excerpt": None})
            continue
        try:
            with open(path) as f:
                lines = f.readlines()
        except FileNotFoundError:
            results.append({
                "path": path,
                "status": "file_not_found",
                "excerpt": None,
            })
            continue

        excerpt_lines = scale_excerpt(lines)
        results.append({
            "path": path,
            "file_lines": len(lines),
            "excerpt_lines": len(excerpt_lines),
            "excerpt": "".join(excerpt_lines),
            "existing_summary": entry.get("summary", ""),
            "existing_key_claims": entry.get("key_claims", []),
            "status": "needs_backfill",
            "agent_prompt": (
                "For this file excerpt, extract:\n"
                "1. summary: 2 sentences describing what this file ASSERTS (not what it contains)\n"
                "2. key_claims: 3-5 specific, falsifiable phrases (≥4 words each)\n"
                "   GOOD: 'compact_size equals CHAT_TOTAL pre-compact times 0.52'\n"
                "   BAD:  'discusses token tracking' (too generic)\n"
                "Output JSON only: {\"summary\": \"...\", \"key_claims\": [...]}"
            )
        })

    return results


def auto_detect_supersedes(idx):
    """
    Detect supersedes chain from _YYYYMMDD.md filename pattern.
    Groups files by base name (strip _YYYYMMDD suffix), sorts by date.
    Returns list of {path, supersedes, superseded_by} dicts.
    """
    DATE_PAT = re.compile(r'^(.+)_(\d{8})(\.md)$')
    groups = {}

    for path in idx:
        m = DATE_PAT.match(path)
        if m:
            base = m.group(1) + m.group(3)
            date = m.group(2)
            groups.setdefault(base, []).append((date, path))

    updates = []
    for base, items in groups.items():
        sorted_items = sorted(items, key=lambda x: x[0])  # oldest first
        for i, (date, path) in enumerate(sorted_items):
            supersedes = sorted_items[i - 1][1] if i > 0 else None
            superseded_by = sorted_items[i + 1][1] if i < len(sorted_items) - 1 else None
            updates.append({
                "path": path,
                "supersedes": supersedes,
                "superseded_by": superseded_by,
                "date": date,
            })

    return updates


def validate_results(results):
    """Validate agent-generated results before writing."""
    errors = []
    for entry in results:
        path = entry.get("path", "?")
        summary = entry.get("summary", "")
        key_claims = entry.get("key_claims", [])

        if not summary or len(summary) < 20:
            errors.append(f"  {path}: summary too short (<20 chars)")
        if not key_claims:
            errors.append(f"  {path}: key_claims empty")
        for claim in key_claims:
            if len(claim.split()) < 4:
                errors.append(f"  {path}: claim <4 words: '{claim}'")
        if len(key_claims) > 5:
            errors.append(f"  {path}: too many key_claims ({len(key_claims)} > 5)")

    return errors


def write_results(results_path, dry_run=False):
    """Read agent results JSON, validate, write to index_files.json."""
    try:
        results = json.load(open(results_path))
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"ERROR reading results: {e}", file=sys.stderr)
        sys.exit(1)

    errors = validate_results(results)
    if errors:
        print("VALIDATION ERRORS:", file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
        sys.exit(1)

    idx = json.load(open(INDEX_PATH))
    today = datetime.date.today().isoformat()
    written = 0

    for entry in results:
        path = entry["path"]
        if path not in idx:
            print(f"WARN: {path} not in index — skipping", file=sys.stderr)
            continue
        if dry_run:
            print(f"[dry-run] {path}")
            print(f"  summary: {entry['summary'][:80]}...")
            print(f"  key_claims: {entry['key_claims']}")
            continue
        idx[path]["summary"] = entry["summary"]
        idx[path]["key_claims"] = entry["key_claims"]
        idx[path]["key_claims_generated_at"] = today
        idx[path]["key_claims_stale"] = False
        written += 1

    if not dry_run:
        json.dump(idx, open(INDEX_PATH, "w"), indent=2)
        print(f"[backfill] Written {written} entries → {INDEX_PATH}")


def write_supersedes(updates, dry_run=False):
    """Write auto-detected supersedes chain to index_files.json."""
    idx = json.load(open(INDEX_PATH))
    written = 0

    for u in updates:
        path = u["path"]
        if path not in idx:
            print(f"WARN: {path} not in index — skipping", file=sys.stderr)
            continue
        if dry_run:
            print(f"[dry-run] {path}: supersedes={u['supersedes']} superseded_by={u['superseded_by']}")
            continue
        idx[path]["supersedes"] = u["supersedes"]
        idx[path]["superseded_by"] = u["superseded_by"]
        written += 1

    if not dry_run:
        json.dump(idx, open(INDEX_PATH, "w"), indent=2)
        print(f"[auto-supersedes] Written {written} entries → {INDEX_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Backfill knowledge/index_files.json")
    parser.add_argument("--extract", action="store_true", help="Extract excerpts for missing entries")
    parser.add_argument("--write", metavar="RESULTS_JSON", help="Write agent results to index")
    parser.add_argument("--auto-supersedes", action="store_true", help="Auto-detect supersedes from filenames")
    parser.add_argument("--file", metavar="PATH", help="Limit to specific file")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen, no writes")
    args = parser.parse_args()

    idx = json.load(open(INDEX_PATH))

    if args.extract:
        results = extract_entries(idx, target_path=args.file)
        needs = [r for r in results if r["status"] == "needs_backfill"]
        not_found = [r for r in results if r["status"] == "file_not_found"]
        if not_found:
            print(f"WARN: {len(not_found)} files not found on disk", file=sys.stderr)
        if not needs:
            print('{"status": "all_complete", "needs_backfill": 0}')
            return
        print(json.dumps({
            "status": "needs_backfill",
            "count": len(needs),
            "entries": needs,
        }, indent=2))

    elif args.write:
        write_results(args.write, dry_run=args.dry_run)

    elif args.auto_supersedes:
        updates = auto_detect_supersedes(idx)
        if not updates:
            print("No date-pattern files found — nothing to update")
            return
        write_supersedes(updates, dry_run=args.dry_run)
        if args.dry_run:
            print(f"\n[auto-supersedes] {len(updates)} entries would be updated")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
