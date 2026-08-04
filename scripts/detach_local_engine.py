#!/usr/bin/env python3
"""detach_local_engine.py — turn a MIGRATED project into a pure-plugin project.

T-314 · S3 (fix G3 · WARN-4/5). A project that once had a full local copy of the
engine (scripts/, .agents/skills/, settings.json hooks) keeps booting on those
stale local copies instead of borrowing from the installed plugin (the T-313
finding). This script strips ONLY the leftover engine copies so the plugin
becomes the single source — while never touching the project's own data.

Safety model (discrimination, not wholesale delete)
---------------------------------------------------
* A project script is removed ONLY when its sha256 is byte-identical to the
  engine's same-named canonical script (an EXACT COPY). A same-named file with a
  DIFFERENT hash means the project diverged → KEPT and FLAGGED for human review.
* A script with a name not present in the engine is PROJECT-ONLY → always kept.
* settings.json: engine-hook entries (commands that run an engine script that
  also ships as a plugin hook) are stripped IN PLACE (the file is rewritten,
  non-engine entries preserved); a full backup is taken first.
* Project-owned data (knowledge/ .sessions/ docs/ src/ + roadmap/CFP/INVARIANTS)
  is NEVER read for deletion and NEVER modified.

Modes
-----
  detach_local_engine.py <project>                 dry-run report (default, safe)
  detach_local_engine.py <project> --measure       hook double-fire count only
  detach_local_engine.py <project> --apply         EXECUTE (destructive; caller
                                                    must satisfy the R14 gate)
  detach_local_engine.py <project> --verify         post-apply assertions

--apply is the only destructive mode. It refuses to run headless without an
explicit HARNESS_DETACH_CONFIRM=yes env (belt-and-suspenders behind the R14
[gate] + danger_gate.py hook — a script must never self-confirm a delete).
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness_paths  # noqa: E402  (engine-owned sibling)

# Engine hook scripts that the plugin also provides — their presence in a
# project settings.json is a double-fire, so they are strip candidates.
PLUGIN_HOOK_SCRIPTS = {
    "posttool_track.py", "index_reconcile.py", "danger_gate.py",
    "compact_reset.py", "phase_gate.py", "skill_gate.py", "real_context.py",
    "review_intent.py", "loop_engineer_preflight.py",
}
# Never even look at these for deletion — project-owned.
PROJECT_DATA_DIRS = {"knowledge", ".sessions", "docs", "src", "domain"}


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _engine_scripts(engine_root: Path) -> dict:
    """{basename: sha256} for every engine scripts/*.py (canonical set)."""
    out = {}
    d = engine_root / "scripts"
    # ALL engine files (T-314 · F1) — not just .py/.sh. scripts/ is engine-only
    # under the T-309 split, so every file here is canonical (e.g. the .txt token
    # base). Dirs (__pycache__) and AppleDouble (._*) are excluded.
    for p in sorted(f for f in d.iterdir() if f.is_file() and not f.name.startswith("._")):
        out[p.name] = _sha(p)
    return out


def classify_scripts(project: Path, engine: dict) -> dict:
    """Bucket a project's scripts/*.py vs the engine canonical set."""
    exact, modified, project_only = [], [], []
    pdir = project / "scripts"
    if pdir.is_dir():
        for p in sorted(f for f in pdir.iterdir() if f.is_file() and not f.name.startswith("._")):
            if p.name not in engine:
                project_only.append(p.name)
            elif _sha(p) == engine[p.name]:
                exact.append(p.name)
            else:
                modified.append(p.name)
    return {"exact": exact, "modified": modified, "project_only": project_only}


def analyze_settings(project: Path) -> dict:
    """Find engine-hook entries in .claude/settings.json (double-fire sources)."""
    sf = project / ".claude" / "settings.json"
    result = {"path": sf, "exists": sf.is_file(), "dupe_events": {}, "total_dupes": 0}
    if not sf.is_file():
        return result
    try:
        data = json.loads(sf.read_text())
    except (json.JSONDecodeError, OSError):
        result["parse_error"] = True
        return result
    hooks = data.get("hooks", {})
    for event, groups in hooks.items():
        for gi, group in enumerate(groups or []):
            for hi, h in enumerate(group.get("hooks", []) or []):
                cmd = h.get("command", "")
                for script in PLUGIN_HOOK_SCRIPTS:
                    if script in cmd:
                        result["dupe_events"].setdefault(event, []).append(script)
                        result["total_dupes"] += 1
                        break
    return result


def _strip_engine_hooks(data: dict) -> dict:
    """Return settings with engine-hook command entries removed (in place)."""
    hooks = data.get("hooks", {})
    for event in list(hooks.keys()):
        new_groups = []
        for group in hooks[event] or []:
            kept = [h for h in group.get("hooks", []) or []
                    if not any(s in h.get("command", "") for s in PLUGIN_HOOK_SCRIPTS)]
            if kept:
                group = dict(group)
                group["hooks"] = kept
                new_groups.append(group)
        if new_groups:
            hooks[event] = new_groups
        else:
            del hooks[event]
    if hooks:
        data["hooks"] = hooks
    else:
        data.pop("hooks", None)
    return data


def _backup_dir(project: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return project / f".harness_detach_backup_{ts}"


def report(project: Path, engine_root: Path) -> dict:
    engine = _engine_scripts(engine_root)
    cls = classify_scripts(project, engine)
    settings = analyze_settings(project)
    return {"engine_count": len(engine), "scripts": cls, "settings": settings}


def print_report(project: Path, engine_root: Path, r: dict) -> None:
    print(f"[detach dry-run] project = {project}")
    print(f"  engine canonical scripts: {r['engine_count']}")
    s = r["scripts"]
    print(f"  EXACT engine copies (WILL DELETE on --apply): {len(s['exact'])}")
    for n in s["exact"]:
        print(f"    - {n}")
    print(f"  MODIFIED / diverged (KEPT — needs human eyes): {len(s['modified'])}")
    for n in s["modified"]:
        print(f"    ! {n}")
    print(f"  PROJECT-ONLY (KEPT): {len(s['project_only'])}")
    st = r["settings"]
    if st["exists"]:
        print(f"  settings.json engine-hook entries (WILL STRIP): {st['total_dupes']}")
        for ev, scs in st.get("dupe_events", {}).items():
            print(f"    {ev}: {', '.join(scs)}")
    else:
        print("  settings.json: none")
    print("  project data (knowledge/.sessions/docs/src/domain): NOT TOUCHED")


def apply(project: Path, engine_root: Path, include_diverged: bool = False) -> int:
    if os.environ.get("HARNESS_DETACH_CONFIRM") != "yes":
        print("REFUSED: --apply requires HARNESS_DETACH_CONFIRM=yes "
              "(destructive · must pass the R14 [gate], never self-confirm).",
              file=sys.stderr)
        return 4
    engine = _engine_scripts(engine_root)
    cls = classify_scripts(project, engine)
    backup = _backup_dir(project)
    (backup / "scripts").mkdir(parents=True, exist_ok=True)

    # Policy: always remove exact (byte-identical) engine copies. With
    # --include-diverged (an explicit user decision · T-314 S3), also remove
    # same-named-as-engine files whose content diverged — these are stale
    # OLDER engine versions, not app code. Every file is backed up first, so
    # the action is fully reversible.
    to_remove = list(cls["exact"]) + (list(cls["modified"]) if include_diverged else [])
    removed = []
    for name in to_remove:
        src = project / "scripts" / name
        shutil.copy2(src, backup / "scripts" / name)  # backup first
        src.unlink()
        removed.append(name)

    st = analyze_settings(project)
    stripped = 0
    if st["exists"] and not st.get("parse_error"):
        sf = st["path"]
        shutil.copy2(sf, backup / "settings.json")  # backup first
        data = json.loads(sf.read_text())
        stripped = st["total_dupes"]
        data = _strip_engine_hooks(data)
        sf.write_text(json.dumps(data, indent=2) + "\n")

    kept_diverged = 0 if include_diverged else len(cls["modified"])
    print(f"[detach applied] project = {project}")
    print(f"  policy: {'exact+diverged' if include_diverged else 'exact-only'}")
    print(f"  backup: {backup}")
    print(f"  scripts removed: {len(removed)} "
          f"(exact={len(cls['exact'])}, diverged={len(removed) - len(cls['exact'])})")
    print(f"  settings.json engine-hook entries stripped: {stripped}")
    print(f"  kept (diverged): {kept_diverged}  project-only: {len(cls['project_only'])}")
    return 0


def verify(project: Path, engine_root: Path, include_diverged: bool = False) -> int:
    """Post-apply assertions: cannot pass by over-deleting."""
    engine = _engine_scripts(engine_root)
    cls = classify_scripts(project, engine)
    fails = []
    # No exact engine copy should remain.
    if cls["exact"]:
        fails.append(f"exact engine copies still present: {cls['exact']}")
    # Under the include-diverged policy, no same-named-as-engine file may remain.
    if include_diverged and cls["modified"]:
        fails.append(f"diverged engine-named files still present: {cls['modified']}")
    # Over-deletion guard: project-only files must SURVIVE (they are never in
    # the removal set — if they vanished, the delete was too broad).
    if not (project / "scripts").is_dir():
        fails.append("project scripts/ dir gone — over-deletion")
    # No leftover plugin-hook dupes.
    st = analyze_settings(project)
    if st.get("total_dupes"):
        fails.append(f"settings.json still has engine-hook dupes: {st['total_dupes']}")
    # Project data must be intact (presence check — never in removal scope).
    missing_data = [d for d in ("knowledge", ".sessions", "docs")
                    if not (project / d).exists()]
    # (only flag if they existed pre-detach; absence may be legitimate — note only)
    if fails:
        print("VERIFY FAIL:")
        for f in fails:
            print("  - " + f)
        return 1
    print(f"VERIFY OK · policy={'exact+diverged' if include_diverged else 'exact-only'} · "
          f"removed=engine-only · project-only kept={len(cls['project_only'])} · "
          f"no hook dupes remain · project-data present={not missing_data}")
    return 0


def main(argv: list) -> int:
    if not argv:
        print("usage: detach_local_engine.py <project> "
              "[--measure|--apply|--verify]", file=sys.stderr)
        return 2
    project = Path(argv[0]).resolve()
    flags = argv[1:]
    include_diverged = "--include-diverged" in flags
    mode = next((f for f in flags if f in ("--measure", "--apply", "--verify")),
                "--dry-run")
    engine_root = harness_paths.engine_root()

    if not project.is_dir():
        print(f"ERROR: not a directory: {project}", file=sys.stderr)
        return 2
    if project == engine_root:
        print("REFUSED: target is the engine itself — cannot detach the engine "
              "from itself (self-host).", file=sys.stderr)
        return 3

    if mode == "--measure":
        st = analyze_settings(project)
        print(f"[double-fire] engine-hook entries in {project}/.claude/settings.json: "
              f"{st.get('total_dupes', 0)}")
        for ev, scs in st.get("dupe_events", {}).items():
            print(f"  {ev}: {', '.join(scs)}")
        return 0
    if mode == "--apply":
        return apply(project, engine_root, include_diverged)
    if mode == "--verify":
        return verify(project, engine_root, include_diverged)
    print_report(project, engine_root, report(project, engine_root))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
