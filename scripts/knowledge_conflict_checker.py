#!/usr/bin/env python3
"""
knowledge_conflict_checker.py — Stage 1 conflict detection tool (0 LLM tokens)

Reads index_files.json only. Computes review_priority_score for related files.
Returns structured JSON for agent review — agent never needs to read source files.

Verdicts:
  clean              → no related files with overlap ≥ min_overlap → exit 0, no agent needed
  low_priority       → related files found, no phrase-level claims match → agent optional
  review_recommended → related files found WITH phrase matches → agent should review

Usage:
  python3 scripts/knowledge_conflict_checker.py --file knowledge/new_file.md
  python3 scripts/knowledge_conflict_checker.py --file knowledge/new_file.md --dry-run
  python3 scripts/knowledge_conflict_checker.py --file knowledge/new_file.md --no-trigger
  python3 scripts/knowledge_conflict_checker.py --file knowledge/new_file.md --min-overlap 0.6
"""

import json
import argparse
import subprocess
import sys
import datetime
import os
import re
from pathlib import Path

INDEX_PATH    = "knowledge/index_files.json"
MAX_CANDIDATES    = 5
MAX_EXCERPT_LINES = 20
MAX_OUTPUT_TOKENS = 1500   # hard cap on JSON output size
MIN_PHRASE_WORDS  = 3      # consecutive words required for a claims match signal


def load_index():
    try:
        return json.load(open(INDEX_PATH))
    except FileNotFoundError:
        print(f"ERROR: {INDEX_PATH} not found", file=sys.stderr)
        sys.exit(1)


def get_excerpt_lines(path, key_claims):
    """
    Extract ≤MAX_EXCERPT_LINES from file: first 5L + section headers + lines matching claims.
    Pure filesystem read — 0 LLM tokens.
    """
    try:
        with open(path) as f:
            all_lines = f.readlines()
    except FileNotFoundError:
        return "[file not found on disk]"

    seen, result = set(), []

    def add(line, idx_):
        key = (idx_, line)
        if key not in seen and len(result) < MAX_EXCERPT_LINES:
            seen.add(key)
            result.append(f"L{idx_+1}: {line.rstrip()}")

    # first 5 lines
    for i, l in enumerate(all_lines[:5]):
        add(l, i)

    # section headers (^#)
    for i, l in enumerate(all_lines):
        if l.startswith('#') and len(result) < MAX_EXCERPT_LINES:
            add(l, i)

    # lines matching any key_claim keyword window
    for claim in key_claims:
        words = claim.lower().split()
        if len(words) < MIN_PHRASE_WORDS:
            continue
        for wi in range(len(words) - MIN_PHRASE_WORDS + 1):
            window = ' '.join(words[wi:wi + MIN_PHRASE_WORDS])
            for i, l in enumerate(all_lines):
                if window in l.lower() and len(result) < MAX_EXCERPT_LINES:
                    add(l, i)
                    break

    return "\n".join(result)


def claims_match_score(claims_a, summary_b, key_claims_b):
    """
    Count how many of claims_a appear (as ≥MIN_PHRASE_WORDS consecutive words) in
    file_b's summary or key_claims. Phrase-level only — no single-word matching.
    Returns (score, signals[])
    """
    target_text = (summary_b + " " + " ".join(key_claims_b)).lower()
    score = 0
    signals = []

    for claim in claims_a:
        words = claim.lower().split()
        if len(words) < MIN_PHRASE_WORDS:
            continue
        for wi in range(len(words) - MIN_PHRASE_WORDS + 1):
            window = ' '.join(words[wi:wi + MIN_PHRASE_WORDS])
            if window in target_text:
                score += 1
                signals.append(claim)
                break   # count each claim once

    return score, signals


def supersedes_relation(path_changed, entry_changed, path_candidate, entry_candidate):
    """
    Determine if changed file is newer or older relative to candidate.
    Uses explicit supersedes field first, then filename date pattern as fallback.
    """
    # Explicit index fields
    if entry_changed.get("supersedes") == path_candidate:
        return "this_is_newer"   # changed supersedes candidate → skip (not a conflict)
    if entry_changed.get("superseded_by") == path_candidate:
        return "this_is_older"
    if entry_candidate.get("supersedes") == path_changed:
        return "this_is_older"
    if entry_candidate.get("superseded_by") == path_changed:
        return "this_is_newer"

    # Fallback: filename date pattern
    DATE_PAT = re.compile(r'_(\d{8})\.md$')
    m_a = DATE_PAT.search(path_changed)
    m_b = DATE_PAT.search(path_candidate)
    if m_a and m_b:
        base_a = DATE_PAT.sub('.md', path_changed)
        base_b = DATE_PAT.sub('.md', path_candidate)
        if base_a == base_b:
            return "this_is_newer" if m_a.group(1) > m_b.group(1) else "this_is_older"

    return "none"


def estimate_tokens(obj):
    """Rough token estimate for a JSON-serializable object."""
    s = json.dumps(obj)
    return int(len(s) * 0.3)


def ensure_key_claims(path, entry, idx, dry_run=False):
    """
    If entry has no key_claims or is stale, print a warning.
    Actual regeneration is done by the agent (backfill_knowledge_index.py --extract --file).
    Returns True if key_claims are usable.
    """
    if not entry.get('key_claims') or entry.get('key_claims_stale'):
        if dry_run:
            print(f"WARN: {path} has no/stale key_claims — run backfill first", file=sys.stderr)
        else:
            print(f"WARN: {path} has no/stale key_claims — run: python3 scripts/backfill_knowledge_index.py --extract --file {path}", file=sys.stderr)
        return False
    return True


def run_check(path_changed, min_overlap, dry_run):
    idx = load_index()

    if path_changed not in idx:
        # New file not yet indexed — can't check, emit guidance
        return {
            "verdict": "not_indexed",
            "changed_file": path_changed,
            "message": f"File not in index. Run: python3 scripts/backfill_knowledge_index.py --extract --file {path_changed}",
            "token_estimate": 50,
            "candidates": [],
        }

    entry_changed = idx[path_changed]
    has_claims = ensure_key_claims(path_changed, entry_changed, idx, dry_run)
    claims_a = entry_changed.get("key_claims", []) if has_claims else []
    topics_a = set(entry_changed.get("topics", []))

    candidates = []

    for path_b, entry_b in idx.items():
        if path_b == path_changed:
            continue
        if not isinstance(entry_b, dict):
            continue
        topics_b = set(entry_b.get("topics", []))
        if not topics_a or not topics_b:
            continue

        overlap = len(topics_a & topics_b) / len(topics_a)
        if overlap < min_overlap:
            continue

        rel = supersedes_relation(path_changed, entry_changed, path_b, entry_b)
        if rel == "this_is_newer":
            continue   # C1 skip: changed file supersedes candidate → not a conflict

        match_score, signals = (0, [])
        if claims_a:
            match_score, signals = claims_match_score(
                claims_a,
                entry_b.get("summary", ""),
                entry_b.get("key_claims", [])
            )

        review_priority_score = round(overlap * (1 + match_score * 0.3), 3)

        excerpt = get_excerpt_lines(path_b, claims_a) if match_score > 0 else ""

        candidates.append({
            "path": path_b,
            "review_priority_score": review_priority_score,
            "overlap": round(overlap, 2),
            "supersedes_relation": rel,
            "summary": entry_b.get("summary", ""),
            "match_signals": signals,
            "excerpt": excerpt,
        })

    # Sort + cap
    candidates.sort(key=lambda x: -x["review_priority_score"])
    candidates = candidates[:MAX_CANDIDATES]

    # Determine verdict
    has_signals = any(c["match_signals"] for c in candidates)
    high_overlap = any(c["overlap"] >= 0.7 for c in candidates)

    if not candidates:
        verdict = "clean"
        suggested_action = "no_action"
        agent_prompt = None
    elif has_signals or high_overlap:
        verdict = "review_recommended"
        suggested_action = "supersede_or_merge"
        agent_prompt = (
            "Review the candidates below. Each was flagged because the changed file shares "
            "topics AND phrase-level content with the candidate.\n"
            "For each candidate decide ONE action:\n"
            "  supersede  → set supersedes/superseded_by in both index entries\n"
            "  merge      → add cross_ref field in older entry's index\n"
            "  annotate   → add conflict_note + date to older entry\n"
            "  no_action  → log to .sessions/self_improve_log.md only\n"
            "Update knowledge/index_files.json accordingly."
        )
    else:
        verdict = "low_priority"
        suggested_action = "no_action"
        agent_prompt = "Low-priority overlap detected. Review only if you suspect semantic conflict."

    result = {
        "verdict": verdict,
        "changed_file": path_changed,
        "candidates": candidates,
        "suggested_action": suggested_action,
        "agent_prompt": agent_prompt,
        "token_estimate": 0,   # filled below
    }

    result["token_estimate"] = estimate_tokens(result)

    # Hard cap: truncate excerpts if over budget
    if result["token_estimate"] > MAX_OUTPUT_TOKENS:
        for c in result["candidates"]:
            lines = c["excerpt"].split("\n")
            c["excerpt"] = "\n".join(lines[:10]) + "\n[truncated]"
        result["token_estimate"] = estimate_tokens(result)
        result["truncated"] = True

    return result


def main():
    parser = argparse.ArgumentParser(description="Knowledge conflict checker — Stage 1 (0 LLM tokens)")
    parser.add_argument("--file", required=True, metavar="PATH", help="Changed/new file to check")
    parser.add_argument("--dry-run", action="store_true", help="Print result JSON, no writes")
    parser.add_argument("--no-trigger", action="store_true", help="Suppress R8 re-fire (use when called from hook)")
    parser.add_argument("--min-overlap", type=float, default=0.5, metavar="N", help="Minimum topic overlap (default 0.5)")
    args = parser.parse_args()

    result = run_check(args.file, args.min_overlap, args.dry_run)

    print(json.dumps(result, indent=2))

    # Exit codes: 0=clean/low_priority, 1=review_recommended
    sys.exit(1 if result["verdict"] == "review_recommended" else 0)


if __name__ == "__main__":
    main()
