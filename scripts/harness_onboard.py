#!/usr/bin/env python3
"""harness_onboard.py — detect a project's harness state on entry, route it.

T-312 S4. Designed to run as a plugin SessionStart hook. It is the missing
"step 4" glue: when you enter a project, decide whether the harness needs to be
installed, upgraded, or is already current, and RECOMMEND the next action.

DETECT + RECOMMEND ONLY. It never copies, overwrites, or deletes anything and
never auto-runs a migration — that keeps it headless-safe (R14): a destructive
upgrade always waits for a human. It just prints a route line the agent/user
acts on.

Routes
------
  init     PROJECT is not a harness project yet.
           reason 'A1 fresh'  -> empty/new project  -> project_init.py
           reason 'A2 mid-dev'-> existing source    -> project_init.py + scan
  upgrade  PROJECT is a harness project but its constitution files differ from
           the engine's shipped reference (stale / missing files).
  noop     constitution matches the engine — nothing to do.

Version compare (M4 finding-5, the whole point)
-----------------------------------------------
We do NOT trust the VERSION date. 09_migration.md M0.2 compares
``harness_version:`` dates, but a stale copy can carry an IDENTICAL date (that is
exactly the real case that motivated this script). Instead we compare a
content-hash of each constitution file: project copy vs engine reference. A
same-date-but-different-content project therefore still routes 'upgrade'.

The "constitution" = framework-identical files (same in every harness project):
CLAUDE.md, AGENTS.md, INVARIANTS.md, Implement/*.md. Deliberately excluded:
REPO_MAP.md, domain/, knowledge/, .sessions/ — those are legitimately
project-specific and would false-positive as drift.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
try:
    from harness_paths import engine_root, project_root, is_harness_project
except Exception:  # pragma: no cover - resolver must ship with the engine
    def engine_root():
        return Path(_HERE).parent

    def project_root():
        return Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))

    def is_harness_project(proj=None):
        proj = proj or project_root()
        return (proj / "AGENTS.md").is_file()

_BASE_CONSTITUTION = ("CLAUDE.md", "AGENTS.md", "INVARIANTS.md")
# Merge-managed constitution files: they legitimately DIVERGE from the engine
# after a migration (the project keeps its own half — INVARIANTS §I2 user rules,
# project-accumulated CFPs), so a byte-diff on them is EXPECTED, not real drift.
# They are reported as an advisory note but never drive the route to 'upgrade'
# (T-313 F1: without this split, a correctly-migrated project could never reach
# 'noop' because its merged INVARIANTS is intentionally != the engine's).
_MERGE_SET = ("INVARIANTS.md",)
# markers that mean "this project already has real source code" (A2 vs A1)
_SOURCE_MARKERS = ("src", "package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml")


def constitution_rel_files() -> list[str]:
    """PROJECT-LOCAL constitution set = only the entry files a consumer keeps
    its own copy of (client-auto-loaded / merge-managed): CLAUDE.md, AGENTS.md,
    INVARIANTS.md.

    Implement/*.md is deliberately NOT here. Under Model B (T-348) the
    constitution DETAIL lives in the CENTRAL engine and is read from <ENG> at
    runtime (CLAUDE.md R5 DOCS companion rule), never copied per project — so a
    consumer legitimately has no local Implement/, and flagging it 'missing'
    here was a false-positive that pushed correctly-installed projects to
    'upgrade' forever. Engine-side DETAIL health is checked separately via
    engine_ships_detail() (an ENGINE problem, not project drift)."""
    return list(_BASE_CONSTITUTION)


def engine_ships_detail(engine: Path) -> bool:
    """True when the ENGINE itself ships the constitution DETAIL (Implement/
    with at least one .md). Model B reads this centrally; if the engine lacks
    it, that is an ENGINE fault (surface loudly), never a consumer's drift."""
    impl = engine / "Implement"
    if not impl.is_dir():
        return False
    return any(p.name.endswith(".md") and not p.name.startswith(".")
               for p in impl.iterdir())


def _hash(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except Exception:
        return None


def _looks_mid_dev(project: Path) -> bool:
    return any((project / m).exists() for m in _SOURCE_MARKERS)


def detect(project: Path, engine: Path) -> tuple[str, str, list[str]]:
    """Return (route, reason, drift_list)."""
    if project.resolve() == engine.resolve():
        return ("noop", "self-hosted (project is the engine)", [])

    if not is_harness_project(project):
        reason = "A2 mid-dev" if _looks_mid_dev(project) else "A1 fresh"
        return ("init", reason, [])

    overwrite_drift: list[str] = []
    merge_drift: list[str] = []
    for rel in constitution_rel_files():
        ef = engine.joinpath(*rel.split("/"))
        pf = project.joinpath(*rel.split("/"))
        if not ef.is_file():
            continue  # only compare what the engine actually ships
        bucket = merge_drift if Path(rel).name in _MERGE_SET else overwrite_drift
        if not pf.exists():
            bucket.append(rel + " (missing)")
        elif _hash(pf) != _hash(ef):
            bucket.append(rel + " (differs)")

    # Only overwrite-set drift drives an 'upgrade'. Merge-set divergence is the
    # expected steady state after a migration, so it never blocks 'noop'.
    if overwrite_drift:
        note = f"{len(overwrite_drift)} constitution file(s) drift vs engine"
        if merge_drift:
            note += f" (+{len(merge_drift)} merge-file advisory)"
        return ("upgrade", note, overwrite_drift + merge_drift)
    if merge_drift:
        return ("noop", f"overwrite-set matches; {len(merge_drift)} merge-file(s) diverge (expected)", merge_drift)
    return ("noop", "constitution matches engine", [])


def format_line(route: str, reason: str, drift: list[str]) -> str:
    line = f"[harness-onboard] route: {route} · {reason}"
    if route == "init":
        line += " · run: python3 scripts/project_init.py <project-dir>"
    elif route == "upgrade":
        shown = ", ".join(drift[:5]) + (" …" if len(drift) > 5 else "")
        line += f" · stale: {shown} · run Implement/09_migration.md (M0->M5) to upgrade (nothing changed yet)"
    return line


def detach(target: str | None, confirm: bool) -> int:
    """Remove a migrated project's STALE LOCAL engine copy so it borrows the
    engine from the plugin instead of shadowing it with its own stale files.

    Reuses harness_uninstall.sh (single-source): that script deletes ONLY files
    the engine ships (scripts/ + .agents/ present in the engine source) and never
    touches project data (knowledge/ .sessions/ docs/ CLAUDE.md AGENTS.md src/)
    or the user's own non-engine files. So this is engine-only removal, not a
    blanket wipe of the project's scripts/.

    Dry-run by DEFAULT — nothing is deleted without an explicit --confirm (R14).

    target = the migrated PROJECT root whose local engine copy to remove
             (defaults to the current project_root()).
    """
    proj = (Path(target).expanduser() if target else project_root()).resolve()
    engine = engine_root().resolve()
    if proj == engine:
        print("[detach] refuse: target is the engine source itself — nothing to detach.")
        return 4
    uninstall = engine / "scripts" / "harness_uninstall.sh"
    if not uninstall.is_file():
        print(f"[detach] error: harness_uninstall.sh not found at {uninstall}")
        return 2
    flag = "--confirm" if confirm else "--dry-run"
    mode = "REMOVING" if confirm else "dry-run (nothing deleted yet)"
    print(f"[detach] {mode} local engine copy from: {proj}")
    print(f"[detach] reusing harness_uninstall.sh {flag} — engine-only "
          "(preserves project data + your own app files)")
    res = subprocess.run(["bash", str(uninstall), str(proj), flag], text=True)

    # .agents/ is 100% framework-owned (skills/ platform/ tools/ router.md) — a
    # migrated project never keeps its own files there. harness_uninstall.sh is
    # path-EXACT, so an OLD-LAYOUT stale copy (e.g. pre-bucketing flat skills/)
    # and macOS AppleDouble sidecars (._*) survive it. Sweep the whole dir to
    # FULLY detach. scripts/ is deliberately NOT swept — it mixes the user's own
    # app code, so it stays file-exact via harness_uninstall.sh above (asymmetry).
    agents_dir = proj / ".agents"
    if agents_dir.is_dir():
        residual = [p for p in agents_dir.rglob("*") if p.is_file()]
        if confirm:
            # ignore_errors + a second pass: on external volumes macOS removes a
            # ._* AppleDouble sidecar the instant its partner file goes, which
            # races rmtree into a spurious FileNotFoundError. Two tolerant passes
            # clear whatever the first left; the caller then verifies it is gone.
            shutil.rmtree(agents_dir, ignore_errors=True)
            if agents_dir.exists():
                shutil.rmtree(agents_dir, ignore_errors=True)
            print(f"[detach] swept framework-owned .agents/ — removed {len(residual)} "
                  f"residual file(s) (old-layout skills + macOS ._* sidecars) · "
                  f"fully gone={not agents_dir.exists()}")
        elif residual:
            print(f"[detach] would then sweep framework-owned .agents/ entirely "
                  f"({len(residual)} file(s) remain after the path-exact pass)")

    if not confirm:
        print("[detach] dry-run only. review the list above, then re-run with "
              "--confirm to actually remove (R14).")
    return res.returncode


def main() -> int:
    argv = sys.argv[1:]
    if argv and argv[0] == "detach":
        rest = argv[1:]
        confirm = "--confirm" in rest
        positional = [a for a in rest if not a.startswith("-")]
        return detach(positional[0] if positional else None, confirm=confirm)
    # default route: detect + recommend (detect-only: never block, never mutate)
    project = project_root()
    engine = engine_root()
    route, reason, drift = detect(project, engine)
    print(format_line(route, reason, drift))
    # Model B assertion: the DETAIL must live in the ENGINE (read centrally via
    # <ENG>), NOT per project. A missing engine Implement/ is an ENGINE fault —
    # surface it loudly and separately from any project-local drift.
    if not engine_ships_detail(engine):
        print(f"[engine-detail] MISSING · engine has no Implement/*.md at {engine} "
              "· constitution DETAIL unreadable — fix the engine (not the project)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
