#!/usr/bin/env python3
"""rule_indexer.py — auto-generate a cross-file rule map for the harness.

Scans the harness doc/skill files, extracts rule identifiers (R-rules, T-tasks,
CFP/ERR codes, BC names) and classifies each as DEFINED (the canonical home —
appears in a header / definition line) vs REFERENCED (merely mentioned) in each
file. Writes `rules_defined[]` + `rules_referenced[]` into each matching entry of
knowledge/index_files.json.

The index is a CACHE only — the harness files remain the single source of truth.
Regenerate any time; never hand-edit the two fields (that would recreate the very
drift this tool exists to detect — see audit_engine_rubric.md §6 Scan D / T-182).

Usage:
  python3 scripts/rule_indexer.py --dry-run   # print candidates, write nothing
  python3 scripts/rule_indexer.py             # write fields into index_files.json
"""
import argparse
import glob
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "knowledge", "index_files.json")

# --- which files carry harness rules -------------------------------------
FILE_GLOBS = [
    "CLAUDE.md",
    "AGENTS.md",
    "CODING_FAILURE_PATTERNS.md",  # canonical home of CFP-NN
    "INVARIANTS.md",
    "REPO_MAP.md",
    "Implement/*.md",
    ".agents/skills/*/SKILL.md",
    ".agents/skills/*/SKILL_detail.md",
    # T-215: skills bucketed 2 levels deep — keep BOTH so flat+nested resolve
    ".agents/skills/*/*/SKILL.md",
    ".agents/skills/*/*/SKILL_detail.md",
    "knowledge/*.md",
    "docs/master_roadmap.md",
]

# --- rule-identifier patterns --------------------------------------------
# each: (name, compiled regex matching the token)
RULE_PATTERNS = [
    ("R-rule", re.compile(r"\bR\d{1,2}\b")),
    ("T-task", re.compile(r"\bT-\d+\b")),
    ("CFP", re.compile(r"\bCFP-\d+\b")),
    ("ERR", re.compile(r"\bERR-\d+\b")),
    ("BC", re.compile(r"\bBC-[A-Za-z][\w-]*\b")),
]

HEADER_RE = re.compile(r"^#{1,6}\s")
# roadmap / checklist definition line: "- [ ] T-182: ..." or "[X] T-99: ..."
CHECKBOX_DEF_RE = re.compile(r"^\s*-?\s*\[[ xX/]\]\s*")


def all_tokens(line):
    found = []
    for _name, rx in RULE_PATTERNS:
        found.extend(rx.findall(line))
    return found


def is_definition_line(line, token):
    """A token is DEFINED on this line if the line is its header / entry, not a mention."""
    stripped = line.strip()
    # markdown header that contains the token  e.g. "## R1 · Token Footer", "## CFP-38"
    if HEADER_RE.match(stripped) and token in stripped:
        return True
    # checklist/roadmap definition  e.g. "- [ ] T-182: desc"
    if CHECKBOX_DEF_RE.match(line) and re.search(re.escape(token) + r"\s*:", stripped):
        return True
    # "token:" or "token ·" or "token —" at line start = definition entry
    if re.match(re.escape(token) + r"\s*[:·—\-]", stripped):
        return True
    return False


def scan_file(path):
    """Return (defined:set, referenced:set) of rule tokens for one file."""
    defined, mentioned = set(), set()
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                for tok in all_tokens(line):
                    mentioned.add(tok)
                    if is_definition_line(line, tok):
                        defined.add(tok)
    except OSError:
        return set(), set()
    referenced = mentioned - defined
    return defined, referenced


def collect_files():
    seen, out = set(), []
    for pat in FILE_GLOBS:
        for p in sorted(glob.glob(os.path.join(REPO, pat))):
            rel = os.path.relpath(p, REPO)
            if rel not in seen and os.path.isfile(p):
                seen.add(rel)
                out.append(rel)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="print candidates without writing index_files.json")
    args = ap.parse_args()

    files = collect_files()
    results = {}
    for rel in files:
        defined, referenced = scan_file(os.path.join(REPO, rel))
        if defined or referenced:
            results[rel] = {
                "rules_defined": sorted(defined),
                "rules_referenced": sorted(referenced),
            }

    total_def = sum(len(v["rules_defined"]) for v in results.values())
    total_ref = sum(len(v["rules_referenced"]) for v in results.values())

    if args.dry_run:
        print(f"[dry-run] scanned {len(files)} files · {len(results)} carry rules")
        for rel, v in sorted(results.items()):
            print(f"  {rel}: defined={len(v['rules_defined'])} referenced={len(v['rules_referenced'])}")
        print(f"[dry-run] totals: defined={total_def} referenced={total_ref} · NOTHING written")
        return 0

    # write into index_files.json (only existing entries — never invent keys)
    try:
        with open(INDEX, encoding="utf-8") as fh:
            index = json.load(fh)
    except (OSError, ValueError) as exc:
        print(f"[error] cannot read {INDEX}: {exc}", file=sys.stderr)
        return 1

    updated, skipped = 0, []
    for rel, v in results.items():
        if rel in index and isinstance(index[rel], dict):
            index[rel]["rules_defined"] = v["rules_defined"]
            index[rel]["rules_referenced"] = v["rules_referenced"]
            updated += 1
        else:
            skipped.append(rel)

    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"[written] {updated} index entries updated · defined={total_def} referenced={total_ref}")
    if skipped:
        print(f"[note] {len(skipped)} rule-bearing files not in index (skipped): {', '.join(skipped[:8])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
