#!/usr/bin/env python3
"""
project_init.py — T-309 S4 · Per-project bootstrap

Scaffolds a FRESH, EMPTY harness project skeleton at a target directory.
Seed-empty only — this script NEVER copies any of Harness Agent's own
content (no topics, no CFP entries, no session history, no identity
strings). Every file it writes starts from a blank/minimal shape.

Note on user_learning_profile.json: that file is USER-tier (shared
across projects, not project-scoped). It lives machine-wide at
~/.claude/knowledge-shared/ and is created by the machine-installer
(S3b), NOT here. Its absence from the scaffolded project is intentional
and required — do not add it to this script.

Note on .sessions/: this script writes minimal blank working files
directly (active_thread.md, session_tokens.md, compact_state.md,
self_improve_log.md, token_log.jsonl) so a fresh project is usable
without any other setup step. It does NOT depend on
docs/session_templates/ existing in the fresh project — copying the
full session template set (gather_complete.md, session_handoff.md,
mece_plan.md, etc., via bootstrap_sessions.py) is the machine-installer's
job (S5), run separately against the new project.

Constitution seed (T-312 S5 · GAP-1)
-------------------------------------
Beyond project STATE (indexes, roadmap, .sessions/), a usable project also
needs its CONSTITUTION — the project-agnostic core rulebook the agent boots
against. Those files (CLAUDE.md / AGENTS.md / INVARIANTS.md) and the domain/
layer are COPIED FROM THE ENGINE reference via harness_paths.engine_root(),
NOT generated from memory and NOT invented per project. Core is designed
project-agnostic (Implement/02_setup.md — "CORE is project-agnostic"), so the
engine's own copies ARE the reference. domain/ is seeded with the engine's
_TEMPLATE.md (a template, never an active pack — detect_domains skips _*) so
setup can fill the active domain pack later; if the engine has no template a
short README placeholder is written instead.

Additive-only, same as the state seed: a constitution file is written ONLY if
it does not already exist, unless --force is passed. Existing project files are
never clobbered.

Mid-dev projects (T-312 S5 · A2)
--------------------------------
If the target already contains source code (src/, package.json, pyproject.toml,
go.mod, Cargo.toml, pom.xml) the constitution is STILL seeded (additively), and
a REPO_MAP build + domain auto-pick hook is triggered so the harness orients to
the existing code. Auto-pick = detect_domains(target) (the project's own
domain/*.md packs); REPO_MAP build reuses scripts/repo_map_check.py --sync
against the target (via HARNESS_PROJECT_ROOT) — no bespoke re-implementation.

Usage:
  python3 scripts/project_init.py <target_dir>            # create missing files only
  python3 scripts/project_init.py <target_dir> --force     # overwrite existing files
  python3 scripts/project_init.py <target_dir> --dry-run   # list actions without writing
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import topic_bootstrap  # noqa: E402 — sibling engine script; single source of the topic-registry schema
import harness_paths  # noqa: E402 — sibling engine script; single source of engine/project roots
import seed_knowledge  # noqa: E402 — sibling engine script; single source of the knowledge-spec seed (T-335)
import seed_permissions  # noqa: E402 — sibling engine script; single source of the command-access baseline (T-338)

TODAY = date.today().isoformat()

# Constitution: project-agnostic core files copied from the ENGINE reference.
CONSTITUTION_FILES = ("CLAUDE.md", "AGENTS.md", "INVARIANTS.md")

# Source-code markers that flag a MID-DEV target (existing project to adopt).
MIDDEV_MARKERS = ("src", "package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml")

DOMAIN_README = (
    "# domain/\n"
    "\n"
    "Swappable project layer — one active domain pack per project.\n"
    "Copy `_TEMPLATE.md` to `domain/<name>.md` and fill it WITH the user during\n"
    "setup (Implement/02_setup.md §Choose Domain Pack). The core harness stays\n"
    "project-agnostic and reads anything domain-specific from the active pack.\n"
)


def json_text(obj):
    """Serialize obj as pretty JSON with a trailing newline."""
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def build_files(target: Path):
    """Return {relative_path: content} for every seed-empty file to scaffold."""
    project_name = target.resolve().name
    project_root = str(target.resolve())

    files = {}

    # --- knowledge/ ---------------------------------------------------
    files["knowledge/index_files.json"] = json_text({})
    files["knowledge/index_variables.json"] = json_text({"variables": {}})
    files["knowledge/index_sessions.json"] = json_text([])
    files["knowledge/index_cfp_fix.json"] = json_text({})
    # Topic registry: delegate to topic_bootstrap so the v3 schema has ONE source
    # of truth. detect_domains reads target/domain/*.md — a fresh project has none,
    # so this seeds an empty registry (zero harness topics inherited). (T-309 S6/S7)
    files["knowledge/topic_registry.json"] = json_text(
        topic_bootstrap.build_registry(topic_bootstrap.detect_domains(target))
    )
    files["knowledge/cross_ref.json"] = json_text({
        "schema_version": 1,
        "description": (
            "Read-only pointers to OTHER harness projects for reference/learning. "
            "Never merged/imported/depended-on at runtime."
        ),
        "policy": {"access": "read-only", "merge": False, "copy": False, "runtime_dependency": False},
        "self": {"name": project_name, "project_root": project_root},
        "projects": [],
    })
    # NOTE: knowledge/user_learning_profile.json is intentionally NOT created here.
    # It is USER-tier (machine-wide, ~/.claude/knowledge-shared/) — see module docstring.

    # --- docs/master_roadmap.md ---------------------------------------
    files["docs/master_roadmap.md"] = (
        "# Master Roadmap\n"
        "\n"
        "> Status: `[ ]` pending -> `[/]` in progress -> `[X]` done\n"
        "\n"
        "---\n"
        "\n"
        "## T-000: Project initialized\n"
        "- [X] T-000 · P2 · project scaffolded by project_init.py\n"
    )

    # --- CODING_FAILURE_PATTERNS.md -----------------------------------
    files["CODING_FAILURE_PATTERNS.md"] = (
        "# CODING_FAILURE_PATTERNS.md — Known Agent Failure Modes\n"
        "\n"
        "> Each pattern: what happened, why it broke, how to prevent it.\n"
        "> Add new patterns after post-mortems. Never delete entries.\n"
    )

    # --- error_index.md -------------------------------------------------
    files["error_index.md"] = (
        "# Error Index\n"
        "\n"
        "> ERR-XXX entries logged as errors are resolved.\n"
    )

    # --- knowledge/harness_flow_20260525.md (empty per-project self-improve log) ---
    # PER-PROJECT log — NOT an engine spec (see knowledge_engine.manifest), so it is
    # seeded here, not copied by seed_knowledge. Header-only so the self_improve loop
    # (Step 5: `grep -c "^| Q" ...`) has a Q# table to append to WITHOUT inheriting any
    # other project's fix rows. (T-335)
    files["knowledge/harness_flow_20260525.md"] = (
        "# Harness Complete Flow — Per-Project Self-Improvement Log\n"
        "\n"
        "> Seeded empty by project_init.py. The self_improve loop appends a Q# row\n"
        "> here each time a harness gap is fixed in THIS project. Starts header-only\n"
        "> — no fix rows are inherited from any other project.\n"
        "\n"
        "---\n"
        "\n"
        "## Fix Log (Q# series)\n"
        "\n"
        "| Q# | Issue | Fix | Files Changed |\n"
        "|---|---|---|---|\n"
    )

    # --- .sessions/ (minimal blank working files, written directly) ---
    files[".sessions/active_thread.md"] = "task: init\nphase: done\nnext: none\n"
    files[".sessions/session_tokens.md"] = (
        "SESSION_TOTAL: 0\n"
        "CHAT_TOTAL: 0\n"
        "CACHE_READ: 0\n"
        "CACHE_WRITE: 0\n"
        "TURN_COUNT: 0\n"
        "LOOP_WEIGHT: 0\n"
        "FILES_READ: 0\n"
        "LONG_OUTPUTS: 0\n"
    )
    files[".sessions/compact_state.md"] = "phase: done\n"
    files[".sessions/self_improve_log.md"] = "# Self-Improve Log\n"
    files[".sessions/token_log.jsonl"] = ""

    return files


def seed_constitution(target: Path, force: bool, dry_run: bool):
    """Copy the project-agnostic constitution (CLAUDE/AGENTS/INVARIANTS + domain/)
    from the ENGINE reference into the target. Additive-only: skips any file that
    already exists unless force is set. Returns (created, skipped).

    The engine's own copies are the reference (core is project-agnostic), read via
    harness_paths.engine_root() — never hardcoded, never generated from memory.
    """
    created = skipped = 0
    engine = harness_paths.engine_root()

    # --- CLAUDE.md / AGENTS.md / INVARIANTS.md (copied verbatim from engine) ---
    for name in CONSTITUTION_FILES:
        src = engine / name
        dst = target / name
        if not src.is_file():
            print(f"[warn] engine reference missing: {src} — cannot seed {name}")
            continue
        if dst.exists() and not force:
            print(f"[skipped] {dst} (exists — use --force to overwrite)")
            skipped += 1
            continue
        action = "would create" if dry_run else "created"
        if not dry_run:
            dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"[{action}] {dst} (constitution ← engine)")
        created += 1

    # --- domain/ (template + README placeholder · never an active pack) --------
    domain_dst = target / "domain"
    if not domain_dst.exists():
        if not dry_run:
            domain_dst.mkdir(parents=True, exist_ok=True)
        print(f"[{'would create' if dry_run else 'created'}] {domain_dst}/")

    tmpl_src = engine / "domain" / "_TEMPLATE.md"
    tmpl_dst = domain_dst / "_TEMPLATE.md"
    if tmpl_src.is_file():
        if tmpl_dst.exists() and not force:
            print(f"[skipped] {tmpl_dst} (exists — use --force to overwrite)")
            skipped += 1
        else:
            action = "would create" if dry_run else "created"
            if not dry_run:
                tmpl_dst.write_text(tmpl_src.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"[{action}] {tmpl_dst} (domain template ← engine)")
            created += 1
    else:
        # No engine template — leave a short README so domain/ is self-explaining.
        readme_dst = domain_dst / "README.md"
        if readme_dst.exists() and not force:
            print(f"[skipped] {readme_dst} (exists — use --force to overwrite)")
            skipped += 1
        else:
            action = "would create" if dry_run else "created"
            if not dry_run:
                readme_dst.write_text(DOMAIN_README, encoding="utf-8")
            print(f"[{action}] {readme_dst} (domain README placeholder)")
            created += 1

    return created, skipped


def is_middev(target: Path) -> bool:
    """True when the target already holds source code (an existing project to adopt)."""
    for marker in MIDDEV_MARKERS:
        p = target / marker
        if marker == "src":
            if p.is_dir():
                return True
        elif p.is_file():
            return True
    return False


def middev_hook(target: Path, dry_run: bool):
    """A2 mid-dev: orient the harness to pre-existing code — REPO_MAP build +
    domain auto-pick. Reuses existing engine machinery (no re-implementation):
      - domain auto-pick = topic_bootstrap.detect_domains(target)
      - REPO_MAP build    = scripts/repo_map_check.py --sync (HARNESS_PROJECT_ROOT=target)
    Both are best-effort and never fail the scaffold.
    """
    print("[mid-dev] source markers detected — seeding constitution + orienting harness")

    # Domain auto-pick: list the project's own domain packs (empty on a fresh
    # copy — the seeded _TEMPLATE.md is skipped by detect_domains).
    domains = topic_bootstrap.detect_domains(target)
    if domains:
        print(f"[mid-dev] domain auto-pick: {domains}")
    else:
        print("[mid-dev] domain auto-pick: none yet — copy domain/_TEMPLATE.md to "
              "domain/<name>.md during setup to activate a pack")

    # REPO_MAP build: run the existing drift-syncer against the target. It needs
    # a REPO_MAP.md to sync into; --append seeds placeholders when one exists.
    repo_map = target / "REPO_MAP.md"
    if dry_run:
        print("[mid-dev] would run repo_map_check.py --sync against target (dry-run — skipped)")
        return
    if not repo_map.is_file():
        print("[mid-dev] REPO_MAP.md not present — skipping --sync "
              "(setup Step generates REPO_MAP.md; re-run repo_map_check.py --sync then)")
        return
    script = Path(__file__).resolve().parent / "repo_map_check.py"
    env = dict(os.environ, HARNESS_PROJECT_ROOT=str(target.resolve()))
    try:
        out = subprocess.run(
            [sys.executable, str(script), "--sync"],
            env=env, capture_output=True, text=True, timeout=60,
        )
        for ln in (out.stdout + out.stderr).splitlines():
            print(f"[repo-map] {ln}")
    except Exception as exc:  # best-effort — never fail the scaffold
        print(f"[mid-dev] repo_map_check.py --sync skipped: {exc}")


def main():
    parser = argparse.ArgumentParser(
        description="Scaffold a fresh, empty harness project skeleton at <target_dir> (no Harness-Agent carryover)"
    )
    parser.add_argument("target_dir", help="Root directory of the new project (created if missing)")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without writing")
    args = parser.parse_args()

    target = Path(args.target_dir)

    if not target.exists():
        if not args.dry_run:
            target.mkdir(parents=True)
        print(f"[created] {target}/")
    elif not target.is_dir():
        print(f"ERROR: {target} exists and is not a directory", file=sys.stderr)
        sys.exit(1)

    files = build_files(target)

    created = skipped = 0

    for rel_path, content in files.items():
        target_path = target / rel_path

        if target_path.exists() and not args.force:
            print(f"[skipped] {target_path} (exists — use --force to overwrite)")
            skipped += 1
            continue

        action = "would create" if args.dry_run else "created"

        if not args.dry_run:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")

        print(f"[{action}] {target_path}")
        created += 1

    # --- constitution seed (T-312 S5 · GAP-1) — additive, engine-sourced ------
    c_created, c_skipped = seed_constitution(target, args.force, args.dry_run)
    created += c_created
    skipped += c_skipped

    # --- knowledge-spec seed (T-335 · Part B) — engine-reference specs, additive.
    # Mirrors seed_constitution: copies the engine specs listed in
    # scripts/knowledge_engine.manifest into <target>/knowledge/, where lookup.py
    # reads them. No-op when self-hosted (engine_root == target).
    k_created, k_skipped = seed_knowledge.seed_knowledge_specs(target, args.force, args.dry_run)
    created += k_created
    skipped += k_skipped

    # --- machine-wide permission baseline (T-338) — additive, best-effort -----
    # Seed the command-access baseline (deny+allow) into the USER-GLOBAL
    # ~/.claude/settings.json so every project on this machine shares ONE
    # allow/deny policy ("set once, whole machine"). Plugins cannot ship a
    # permissions block, so an installer seeding it is the only propagation path.
    # seed_permissions is the single source of the list; additive + idempotent
    # (never removes/weakens). Best-effort: a failure never breaks project init.
    if not args.dry_run:
        try:
            gsettings = Path.home() / ".claude" / "settings.json"
            res = seed_permissions.merge(str(gsettings))
            n = len(res["added_allow"]) + len(res["added_deny"])
            print(f"[ok] machine-wide permission baseline ensured @ {gsettings} (+{n})")
        except Exception as e:
            print(f"[warn] permission-baseline seed skipped (non-fatal): {e}", file=sys.stderr)

    # --- A2 mid-dev: existing source code present → orient the harness --------
    if is_middev(target):
        middev_hook(target, args.dry_run)

    print(f"\nDone: {created} created · {skipped} skipped")
    if args.dry_run:
        print("[dry-run] No files written.")


if __name__ == "__main__":
    main()
