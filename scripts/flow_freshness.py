#!/usr/bin/env python3
"""flow_freshness.py — drift checker for process-/flow-summary docs (flow_summarizer skill).

A flow doc declares the source files it was built from in a frontmatter `source_hashes:`
map (anchor file -> sha1[:8] at build time). This script recomputes each anchor's live
hash and reports drift, so a summary that no longer matches reality is caught instead of
silently rotting.

Anchors are a HEURISTIC (see the flow_summarizer SKILL.md anchor-file rule): drift here is
a strong hint to re-verify, not a proof the doc is wrong (false-fresh / false-stale possible).

Usage:
    python3 scripts/flow_freshness.py [doc.md ...]   # default: scan knowledge/**/*.md
Output:
    [flow-stale] path:<doc> anchor:<file> stored:<h> live:<h|MISSING>   (per drifted anchor)
    [flow-ok] <doc> (<N> anchors)                                       (per fresh doc)
Exit code: always 0 (reporter — wired as a Stop hook, must not block session close).
"""
import hashlib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness_paths

ROOT = harness_paths.project_root()


def sha8(path: Path) -> str | None:
    try:
        return hashlib.sha1(path.read_bytes()).hexdigest()[:8]
    except OSError:
        return None


def parse_source_hashes(md: Path) -> dict[str, str]:
    """Extract the frontmatter `source_hashes:` map (indented `  path: hash` lines)."""
    text = md.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    fm = text[3:end]
    out: dict[str, str] = {}
    in_block = False
    for line in fm.splitlines():
        if re.match(r"^source_hashes:\s*$", line):
            in_block = True
            continue
        if in_block:
            m = re.match(r"^\s+([^#\s][^:]*?):\s*([0-9a-f]{6,40})\s*$", line)
            if m:
                out[m.group(1).strip()] = m.group(2).strip()
            elif line.strip() and not line.startswith((" ", "\t")):
                break  # dedent → block ended
    return out


def check_doc(md: Path) -> int:
    anchors = parse_source_hashes(md)
    if not anchors:
        return 0
    rel_doc = md.relative_to(ROOT)
    stale = 0
    for anchor, stored in anchors.items():
        live = sha8(ROOT / anchor)
        if live != stored:
            print(f"[flow-stale] path:{rel_doc} anchor:{anchor} "
                  f"stored:{stored} live:{live or 'MISSING'}")
            stale += 1
    if stale == 0:
        print(f"[flow-ok] {rel_doc} ({len(anchors)} anchors)")
    return stale


def main(argv: list[str]) -> int:
    if argv:
        docs = [Path(a) if Path(a).is_absolute() else ROOT / a for a in argv]
    else:
        docs = sorted((ROOT / "knowledge").rglob("*.md"))
    total_stale = 0
    checked = 0
    for md in docs:
        if not md.exists():
            continue
        anchors = parse_source_hashes(md)
        if anchors:
            checked += 1
            total_stale += check_doc(md)
    if checked == 0:
        print("[flow-freshness] no flow docs with source_hashes found")
    elif total_stale == 0:
        print(f"[flow-freshness] all {checked} flow doc(s) fresh")
    else:
        print(f"[flow-freshness] {total_stale} stale anchor(s) across {checked} doc(s) "
              f"— re-run flow_summarizer Verify-from-real on the flagged docs")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
