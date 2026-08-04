#!/usr/bin/env python3
"""harness_paths.py — single source of truth for WHERE harness files live.

T-309 · Section 1 (DESIGN). Defines two roots and one resolver so the engine
can be installed once machine-wide (~/.claude/) while each project keeps its
own knowledge, with NO file duplication across projects.

Three tiers
-----------
ENGINE_ROOT  : home of the engine code that ships with the harness and is the
               same for every project — scripts/, .agents/skills/, hooks.
PROJECT_ROOT : home of the working project's own data — knowledge/, .sessions/,
               docs/, roadmap, src/. One per project, never shared.
SHARED_HOME  : machine-wide store that follows the USER across every project
               (~/.claude/knowledge-shared) — the user learning profile and,
               from T-319, the cross-machine CFP store. This module is the ONE
               definition of that path (learning_profile._SHARED_HOME points here).

Backward-compat invariant (self-hosting safety)
-----------------------------------------------
TODAY every script resolves paths off ``Path(__file__).resolve().parent.parent``
(the repo root), because the engine and the project are the same directory.
When ENGINE_ROOT == PROJECT_ROOT this resolver MUST reproduce that exact path
byte-identically, so rewiring a script to use it (Section 2) changes nothing
while we are still running the engine on itself.

Resolution order
----------------
ENGINE_ROOT:
  1. env HARNESS_ENGINE_ROOT (explicit override — set by the machine installer)
  2. else the dir two levels above this file (scripts/harness_paths.py -> repo)
PROJECT_ROOT:
  1. env HARNESS_PROJECT_ROOT (explicit override)
  2. env CLAUDE_PROJECT_DIR (the host's "which project" signal — same var
     real_context.py and the settings.json hooks already trust)
  3. else walk up from CWD to the nearest project marker (.sessions/ or CLAUDE.md)
  4. else fall back to ENGINE_ROOT  -> self-hosted, byte-identical legacy behavior

This module is DESIGN-ONLY in S1: nothing else is rewired to use it yet.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Markers that identify a project's own root when walking up from CWD.
_PROJECT_MARKERS = (".sessions", "CLAUDE.md")


def _resolve_engine_root(environ: dict, script_file: str) -> Path:
    """Pure resolver for ENGINE_ROOT (testable — no global state read)."""
    override = environ.get("HARNESS_ENGINE_ROOT")
    if override:
        return Path(override).resolve()
    # scripts/harness_paths.py -> parent (scripts/) -> parent (engine home)
    return Path(script_file).resolve().parent.parent


def _resolve_project_root(environ: dict, cwd: Path, engine_root: Path) -> Path:
    """Pure resolver for PROJECT_ROOT (testable — no global state read)."""
    override = environ.get("HARNESS_PROJECT_ROOT")
    if override:
        return Path(override).resolve()
    host = environ.get("CLAUDE_PROJECT_DIR")
    if host:
        return Path(host).resolve()
    cwd = cwd.resolve()
    for d in (cwd, *cwd.parents):
        if any((d / m).exists() for m in _PROJECT_MARKERS):
            return d
    # No project marker found -> self-hosted: project IS the engine (legacy).
    return engine_root


# --- public API (reads real environment; not cached, so tests can vary env) ---

def engine_root() -> Path:
    return _resolve_engine_root(os.environ, __file__)


def project_root() -> Path:
    eng = engine_root()
    return _resolve_project_root(os.environ, Path.cwd(), eng)


def engine_path(*parts: str) -> Path:
    """Path to engine-owned file (scripts/skills/hooks). Under ENGINE_ROOT."""
    return engine_root().joinpath(*parts)


def project_path(*parts: str) -> Path:
    """Path to project-owned file (knowledge/.sessions/docs). Under PROJECT_ROOT."""
    return project_root().joinpath(*parts)


def is_self_hosted() -> bool:
    """True when engine and project are the same dir (today's default)."""
    return engine_root() == project_root()


def is_harness_project(proj: "Path | None" = None) -> bool:
    """True when PROJECT_ROOT is an initialized harness project.

    T-312 S3 marker (M4 finding-2): require the harness orientation file
    AGENTS.md at the project root — NOT ``.sessions/`` alone, which a project
    can have for unrelated reasons. Also require one harness state dir so a
    stray AGENTS.md (now a semi-generic filename) cannot false-positive.

    Used as the first-statement guard in the plugin's exit-code blockers
    (phase_gate / skill_gate / git_guard) so that globally-installed plugin
    hooks NO-OP on any project that is not running the harness.
    """
    proj = proj or project_root()
    if not (proj / "AGENTS.md").is_file():
        return False
    return (
        (proj / "CLAUDE.md").is_file()
        or (proj / ".sessions").is_dir()
        or (proj / "knowledge").is_dir()
    )


# --- USER/SHARED tier (machine-wide · follows the user across projects) -------
# ONE definition of the shared-home root (T-319 S1). Everything machine-wide
# (user learning profile · cross-machine CFP store) resolves off this — no second
# hardcode elsewhere (learning_profile._SHARED_HOME now references shared_home()).

def _resolve_shared_home(environ: dict) -> Path:
    """Pure resolver for the machine-wide shared home (testable — no global read).

    1. env HARNESS_SHARED_HOME (explicit override — used by tests)
    2. else ~/.claude/knowledge-shared
    """
    override = environ.get("HARNESS_SHARED_HOME")
    if override:
        return Path(override).resolve()
    return Path(os.path.expanduser("~")) / ".claude" / "knowledge-shared"


def shared_home() -> Path:
    """Machine-wide shared store root — the SINGLE source of this path."""
    return _resolve_shared_home(os.environ)


def shared_cfp_dir() -> Path:
    """Directory for cross-machine CFP data (T-319). Ensured to exist."""
    d = shared_home() / "cfp"
    d.mkdir(parents=True, exist_ok=True)
    return d


def share_enabled() -> bool:
    """T-319 STAGE 2 S6: is cross-machine SHARING opted in on THIS machine?

    DEFAULT OFF (privacy) — no data leaves the machine unless this is True. The flag is
    MACHINE-LOCAL (~/.claude/harness_share.enabled), NOT under the synced shared folder, so
    turning it on for one machine does not silently opt in every other machine that syncs the
    same folder. Env HARNESS_SHARE_ENABLED overrides (tests / explicit)."""
    v = os.environ.get("HARNESS_SHARE_ENABLED")
    if v is not None:
        return v.strip().lower() in ("1", "true", "yes", "on")
    flag = Path(os.path.expanduser("~")) / ".claude" / "harness_share.enabled"
    return flag.is_file()


def machine_id() -> str:
    """Stable, generate-once id for THIS machine (T-319 cross-machine merge key).

    Persisted to <shared_home>/machine_id so cross-machine CFP entries can be
    attributed to their origin machine. Generated once (random) then reused —
    NOT the hostname (which can change, collide, or leak identity).
    """
    home = shared_home()
    home.mkdir(parents=True, exist_ok=True)
    f = home / "machine_id"
    if f.is_file():
        mid = f.read_text(encoding="utf-8").strip()
        if mid:
            return mid
    import uuid
    mid = uuid.uuid4().hex[:12]
    f.write_text(mid + "\n", encoding="utf-8")
    return mid


# --- self-test (Verify-2 / F2) ------------------------------------------------

def _selftest() -> int:
    """Assert the 3 cwd scenarios resolve correctly, byte-identical when equal."""
    failures = []

    def check(name: str, cond: bool, detail: str = "") -> None:
        if not cond:
            failures.append(f"{name}: {detail}")

    here = Path(__file__).resolve()
    legacy_root = here.parent.parent  # what every script computes today

    # Scenario A — in-project / both-equal (no env overrides, cwd inside repo).
    # Must be byte-identical to today's Path(__file__).parent.parent behavior.
    eng_a = _resolve_engine_root({}, str(here))
    proj_a = _resolve_project_root({}, legacy_root, eng_a)
    check("A.engine==legacy", eng_a == legacy_root, f"{eng_a} != {legacy_root}")
    check("A.project==legacy", proj_a == legacy_root, f"{proj_a} != {legacy_root}")
    check("A.self_hosted", eng_a == proj_a, f"{eng_a} != {proj_a}")
    # byte-identical legacy path for a known project file
    legacy_file = legacy_root / "knowledge" / "index_files.json"
    resolved_file = proj_a.joinpath("knowledge", "index_files.json")
    check("A.byte_identical_path", resolved_file == legacy_file,
          f"{resolved_file} != {legacy_file}")

    # Scenario B — engine installed elsewhere, project is a different dir.
    env_b = {"HARNESS_ENGINE_ROOT": "/opt/harness-engine",
             "HARNESS_PROJECT_ROOT": "/work/proj-x"}
    eng_b = _resolve_engine_root(env_b, str(here))
    proj_b = _resolve_project_root(env_b, Path("/tmp"), eng_b)
    check("B.engine", eng_b == Path("/opt/harness-engine"), str(eng_b))
    check("B.project", proj_b == Path("/work/proj-x"), str(proj_b))
    check("B.distinct", eng_b != proj_b, "engine and project must differ")
    check("B.engine_path",
          eng_b.joinpath("scripts", "lookup.py") == Path("/opt/harness-engine/scripts/lookup.py"),
          "engine_path wrong")
    check("B.project_path",
          proj_b.joinpath("knowledge", "index_files.json") == Path("/work/proj-x/knowledge/index_files.json"),
          "project_path wrong")

    # Scenario C — both explicitly equal -> self-hosted, byte-identical.
    same = str(legacy_root)
    env_c = {"HARNESS_ENGINE_ROOT": same, "HARNESS_PROJECT_ROOT": same}
    eng_c = _resolve_engine_root(env_c, str(here))
    proj_c = _resolve_project_root(env_c, Path("/tmp"), eng_c)
    check("C.equal", eng_c == proj_c == legacy_root, f"{eng_c} / {proj_c}")

    # Scenario D — host sets CLAUDE_PROJECT_DIR (Claude Code default) -> that
    # dir wins as PROJECT_ROOT even from an unrelated cwd. HARNESS_PROJECT_ROOT
    # still overrides it (precedence check).
    env_d = {"CLAUDE_PROJECT_DIR": "/work/proj-y"}
    proj_d = _resolve_project_root(env_d, Path("/tmp"), _resolve_engine_root({}, str(here)))
    check("D.host_dir", proj_d == Path("/work/proj-y"), str(proj_d))
    env_d2 = {"CLAUDE_PROJECT_DIR": "/work/proj-y", "HARNESS_PROJECT_ROOT": "/work/override"}
    proj_d2 = _resolve_project_root(env_d2, Path("/tmp"), _resolve_engine_root({}, str(here)))
    check("D.override_wins", proj_d2 == Path("/work/override"), str(proj_d2))

    # Scenario E — USER/SHARED tier (T-319): override resolves; cfp dir is under
    # shared_home and gets created; machine_id is generate-once stable.
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        home_e = _resolve_shared_home({"HARNESS_SHARED_HOME": td})
        check("E.shared_home_override", home_e == Path(td).resolve(), str(home_e))
        os.environ["HARNESS_SHARED_HOME"] = td
        try:
            cfp = shared_cfp_dir()
            check("E.cfp_under_home", cfp == home_e / "cfp" and cfp.is_dir(), str(cfp))
            m1, m2 = machine_id(), machine_id()
            check("E.machine_id_stable", m1 == m2 and len(m1) == 12, f"{m1} != {m2}")
        finally:
            os.environ.pop("HARNESS_SHARED_HOME", None)

    if failures:
        print("FAIL harness_paths selftest:")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK harness_paths selftest: 5/5 scenarios pass (byte-identical when equal)")
    return 0


def _show() -> int:
    print(f"ENGINE_ROOT  = {engine_root()}")
    print(f"PROJECT_ROOT = {project_root()}")
    print(f"SHARED_HOME  = {shared_home()}")
    print(f"self_hosted  = {is_self_hosted()}")
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--show"
    if arg == "--selftest":
        sys.exit(_selftest())
    elif arg == "--show":
        sys.exit(_show())
    else:
        print(f"usage: {sys.argv[0]} [--selftest|--show]")
        sys.exit(2)
