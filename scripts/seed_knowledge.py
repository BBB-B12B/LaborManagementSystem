#!/usr/bin/env python3
"""
seed_knowledge.py — T-335 · Part B · Per-project engine-spec delivery

Seed the ENGINE-REFERENCE knowledge specs into a target project's knowledge/,
so lookup.py resolves them. lookup.py reads specs from PROJECT_ROOT/knowledge,
NOT from the engine root — so a consumer project needs the engine specs COPIED
into its own knowledge/, mirroring how project_init.seed_constitution copies
CLAUDE/AGENTS/INVARIANTS from the engine. This module is the knowledge-spec
half of that same seed.

Why knowledge/ needs splitting
------------------------------
knowledge/ holds two very different kinds of file:
  - ENGINE reference specs (loop specs, rubric, glossary, skill specs) — identical
    for every project, part of the harness engine.
  - PROJECT state (index_*.json, cfp_*, error_*, out_of_scope, session history) —
    unique to each project, seeded EMPTY by project_init (never carried over).
Only the engine specs are seeded here. Project state is scaffolded blank elsewhere.

Single source of the spec LIST: scripts/knowledge_engine.manifest (also read by
scripts/machine_install.sh). One filename per line; blanks + #-comments ignored.

Additive-only, engine-sourced (same contract as seed_constitution):
  - a spec is written ONLY if it does not already exist, unless force is set
  - the source is harness_paths.engine_root()/knowledge/<f> — never generated
  - a manifest entry missing from the engine source is warned + skipped, never fatal
  - when engine_root == target (self-hosted: the project IS the engine) seeding is
    a no-op — the specs already live there.

Usage:
  python3 scripts/seed_knowledge.py <target_dir>            # create missing specs only
  python3 scripts/seed_knowledge.py <target_dir> --force    # overwrite existing specs
  python3 scripts/seed_knowledge.py <target_dir> --dry-run  # list actions without writing
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness_paths  # noqa: E402 — sibling engine script; single source of engine/project roots

MANIFEST = Path(__file__).resolve().parent / "knowledge_engine.manifest"


def read_manifest(manifest: Path = MANIFEST):
    """Return the engine-spec filenames from the manifest (blanks + #-comments skipped)."""
    if not manifest.is_file():
        return []
    specs = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        specs.append(s)
    return specs


def seed_knowledge_specs(target, force=False, dry_run=False):
    """Copy the engine-reference knowledge specs (per knowledge_engine.manifest)
    from the ENGINE reference into target/knowledge/. Additive-only: skips any
    file that already exists unless force is set. Returns (created, skipped).

    No-op when engine_root == target (self-hosted — the specs already live there).
    """
    target = Path(target)
    engine = harness_paths.engine_root()

    # Self-hosted: the project IS the engine — specs already present, nothing to seed.
    if engine.resolve() == target.resolve():
        print("[skip] engine_root == target (self-hosted) — knowledge specs already present")
        return 0, 0

    specs = read_manifest()
    if not specs:
        print(f"[warn] {MANIFEST} absent or empty — no engine knowledge specs seeded")
        return 0, 0

    created = skipped = 0
    if not dry_run:
        (target / "knowledge").mkdir(parents=True, exist_ok=True)

    for name in specs:
        src = engine / "knowledge" / name
        dst = target / "knowledge" / name
        if not src.is_file():
            print(f"[warn] engine reference missing: {src} — cannot seed knowledge/{name}")
            continue
        if dst.exists() and not force:
            print(f"[skipped] {dst} (exists — use --force to overwrite)")
            skipped += 1
            continue
        action = "would create" if dry_run else "created"
        if not dry_run:
            dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"[{action}] {dst} (knowledge spec ← engine)")
        created += 1

    return created, skipped


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Seed engine-reference knowledge specs into <target>/knowledge/ (per knowledge_engine.manifest)"
    )
    parser.add_argument("target_dir", help="Root directory of the project to seed")
    parser.add_argument("--force", action="store_true", help="Overwrite existing specs")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without writing")
    args = parser.parse_args()

    created, skipped = seed_knowledge_specs(Path(args.target_dir), args.force, args.dry_run)
    print(f"\nDone: {created} created · {skipped} skipped")
    if args.dry_run:
        print("[dry-run] No files written.")


if __name__ == "__main__":
    main()
