#!/usr/bin/env python3
"""
topic_bootstrap.py — per-project topic-registry generator (T-309 · S6)

Generates knowledge/topic_registry.json for a project in the CURRENT v3 schema
shape (domains + topics_by_domain + a flat `topics` union) but seeded EMPTY —
ZERO harness-specific topics are inherited. Topics are a closed vocabulary that
agents append as work begins; this only lays down the correct-shaped skeleton.

Why not just the v1 stub project_init.py writes? Downstream tooling
(backlink_analyzer, topic-facet assignment) expects the v3 shape: `domains`,
`topics_by_domain`, and the flat `topics` union it validates against. This
generator produces that shape while guaranteeing no harness topics leak in — it
NEVER reads the engine's registry.

Domain detection (opt-in, safe): with --domain it uses the given list; else it
reads the TARGET project's own domain/*.md packs (excluding _TEMPLATE.md) and
lists those as the project's domains, each with an EMPTY topic bucket; if the
project has no domain packs, it seeds an empty registry (domains: []).

PROJECT-data writer: the target is resolved via harness_paths.project_root()
(honors CLAUDE_PROJECT_DIR / an explicit positional arg), so it always writes
the ACTIVE project's registry — never the engine's. Correct in machine-install
mode where the engine lives elsewhere (engine != project).

Usage:
  python3 scripts/topic_bootstrap.py                  # bootstrap the active project
  python3 scripts/topic_bootstrap.py /path/to/proj    # explicit project target
  python3 scripts/topic_bootstrap.py --domain coding,data
  python3 scripts/topic_bootstrap.py --dry-run        # show action, write nothing
  python3 scripts/topic_bootstrap.py --force          # overwrite an existing registry
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness_paths  # noqa: E402

TODAY = date.today().isoformat()

NOTE = (
    "Fresh per-project topic vocabulary (v3 shape) — seed as work begins. "
    "Closed vocabulary: agents assign topics only from this list, no free-text "
    "tags. `topics` is the UNION of topics_by_domain. NO harness topics inherited."
)


def json_text(obj):
    """Serialize obj as pretty JSON with a trailing newline (project_init idiom)."""
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def detect_domains(target: Path):
    """List the project's own domain-pack names (excluding the template).

    Reads <target>/domain/*.md — the ACTIVE project's packs, never the engine's —
    so a fresh project with no packs yields [] (empty, honest)."""
    domain_dir = target / "domain"
    if not domain_dir.is_dir():
        return []
    names = []
    for p in sorted(domain_dir.glob("*.md")):
        if p.stem.startswith("_"):  # _TEMPLATE.md and friends
            continue
        names.append(p.stem)
    return names


def build_registry(domains):
    """Return the v3-shaped topic_registry dict, seeded EMPTY of topics."""
    return {
        "version": "3.1",
        "last_updated": TODAY,
        "note": NOTE,
        "domains": list(domains),
        "topics_by_domain": {d: [] for d in domains},
        "topics": [],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate a fresh per-project topic_registry.json (no harness topics).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "target_dir",
        nargs="?",
        default=None,
        help="Project root (default: the active project via harness_paths.project_root()).",
    )
    parser.add_argument(
        "--domain",
        default=None,
        help="Comma-separated domain list to seed (overrides auto-detection).",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing registry.")
    parser.add_argument("--dry-run", action="store_true", help="Show the action, write nothing.")
    args = parser.parse_args()

    target = Path(args.target_dir).resolve() if args.target_dir else harness_paths.project_root()
    out = target / "knowledge" / "topic_registry.json"

    if args.domain is not None:
        domains = [d.strip() for d in args.domain.split(",") if d.strip()]
        source = "--domain"
    else:
        domains = detect_domains(target)
        source = "detected domain/*.md" if domains else "empty (no domain packs)"

    registry = build_registry(domains)
    payload = json_text(registry)

    if args.dry_run:
        print(f"[dry-run] would write {out}")
        print(f"[dry-run] domains: {domains or '[]'} (source: {source})")
        print(f"[dry-run] topics: 0 (fresh — no harness topics)")
        return 0

    if out.exists() and not args.force:
        print(f"[skipped] {out} exists — use --force to overwrite")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(payload, encoding="utf-8")
    print(f"[written] {out}")
    print(f"[ok] domains: {domains or '[]'} (source: {source}) · topics: 0 (no harness topics)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
