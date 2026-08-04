#!/usr/bin/env python3
"""version_check_detect.py — detection helpers split out of version_check.py.

Pure semver helpers, environment resolution, Layer A (git), Layer B (disk),
Layer C (source), and the throttle marker I/O. No orchestration/CLI here —
see version_check.py for `check`/`self_test`/`main`.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

THROTTLE_SECONDS = 24 * 60 * 60  # network check at most once/day
FETCH_TIMEOUT = 5                # seconds — a hung remote must never stall boot
SUMMARY_LINES = 5                # cap the change summary


# ---------------------------------------------------------------------------
# Pure, testable helpers (no network / no git) — exercised by --self-test (F2).
# ---------------------------------------------------------------------------
def _parse_semver(text):
    """'1.0.6' -> (1, 0, 6). Non-numeric parts -> 0. Returns () on junk."""
    if not text:
        return ()
    out = []
    for part in str(text).strip().split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out) if out else ()


def _cmp_semver(a, b):
    """Return 1 if a>b, -1 if a<b, 0 if equal (length-normalized)."""
    pa, pb = _parse_semver(a), _parse_semver(b)
    n = max(len(pa), len(pb))
    pa = pa + (0,) * (n - len(pa))
    pb = pb + (0,) * (n - len(pb))
    return (pa > pb) - (pa < pb)


# ---------------------------------------------------------------------------
# Environment resolution (mirrors harness_paths.py; kept inline to avoid an
# import that could itself raise inside a boot hook).
# ---------------------------------------------------------------------------
def _engine_root():
    env = os.environ.get("HARNESS_ENGINE_ROOT")
    if env:
        return Path(env).resolve()
    # scripts/version_check.py -> scripts/ -> engine home
    return Path(__file__).resolve().parent.parent


def _project_root(engine_root):
    for key in ("HARNESS_PROJECT_ROOT", "CLAUDE_PROJECT_DIR"):
        v = os.environ.get(key)
        if v:
            return Path(v).resolve()
    cwd = Path.cwd().resolve()
    for d in (cwd, *cwd.parents):
        if (d / ".sessions").exists() or (d / "CLAUDE.md").exists():
            return d
    return engine_root


def _read_version(plugin_json):
    try:
        return json.loads(Path(plugin_json).read_text()).get("version")
    except Exception:
        return None


def _is_plugin_install(engine_root):
    """True when the engine is a plugin cache dir (.../plugins/cache/...)."""
    return "plugins/cache" in str(engine_root).replace(os.sep, "/")


def _update_steps(engine_root):
    """Which update instruction(s) to surface, most-relevant first."""
    if _is_plugin_install(engine_root):
        return [("plugin", "/plugin update")]
    if (engine_root / ".git").exists():
        return [("self-host", "git pull && bash scripts/machine_install.sh")]
    # unsure — show both so the notice is still actionable
    return [("plugin", "/plugin update"),
            ("self-host", "git pull && bash scripts/machine_install.sh")]


# ---------------------------------------------------------------------------
# Layer A — git remote (throttled, prompt-proof, fail-safe).
# ---------------------------------------------------------------------------
def _git(root, args, timeout=FETCH_TIMEOUT):
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"  # F1: never block on a credential prompt
    return subprocess.run(
        ["git", "-C", str(root), *args],
        env=env, timeout=timeout,
        capture_output=True, text=True,
    )


def _git_latest(root):
    """(latest_version, summary_lines, head) from the remote, or None on any failure."""
    try:
        if not (root / ".git").exists():
            return None
        # prompt-proof, single-branch fetch — F1
        r = _git(root, ["-c", "credential.helper=", "fetch", "--quiet", "origin", "main"])
        if r.returncode != 0:
            return None
        behind = _git(root, ["rev-list", "--count", "HEAD..FETCH_HEAD"], timeout=3)
        if behind.returncode != 0 or int((behind.stdout or "0").strip() or 0) <= 0:
            return None
        show = _git(root, ["show", "FETCH_HEAD:.claude-plugin/plugin.json"], timeout=3)
        latest = None
        if show.returncode == 0:
            try:
                latest = json.loads(show.stdout).get("version")
            except Exception:
                latest = None
        log = _git(root, ["log", "--oneline", "--no-merges", f"HEAD..FETCH_HEAD"], timeout=3)
        summary = [ln.strip() for ln in (log.stdout or "").splitlines() if ln.strip()][:SUMMARY_LINES]
        head = _git(root, ["rev-parse", "FETCH_HEAD"], timeout=3).stdout.strip() or None
        return (latest, summary, head)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Layer B — newest sibling plugin-cache dir on disk.
# ---------------------------------------------------------------------------
def _disk_latest(engine_root):
    """Highest sibling version under .../harness-agent/*/ , or None."""
    try:
        parent = engine_root.parent  # .../harness-agent
        if parent.name != "harness-agent":
            return None
        best = None
        for child in parent.iterdir():
            if not child.is_dir():
                continue
            v = child.name
            if _parse_semver(v) and (best is None or _cmp_semver(v, best) > 0):
                best = v
        return best
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Layer C — machine_install engine (copied to ~/.claude: no .git, not a plugin
# cache) so Layers A+B both miss it. machine_install.sh records the source clone
# path in `.harness_source`; check THAT clone's remote so machine-installed
# engines still get a notice (T-337).
# ---------------------------------------------------------------------------
def _source_root(engine_root):
    """Path to the recorded source clone (must have .git), or None. Never raises."""
    try:
        marker = engine_root / ".harness_source"
        if not marker.exists():
            return None
        src = Path(marker.read_text().strip())
        if src.is_dir() and (src / ".git").exists():
            return src
        return None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Throttle marker.
# ---------------------------------------------------------------------------
def _marker_path(project_root):
    return project_root / ".sessions" / ".version_check"


def _read_marker(project_root):
    try:
        return json.loads(_marker_path(project_root).read_text())
    except Exception:
        return {}


def _write_marker(project_root, data):
    try:
        p = _marker_path(project_root)
        if p.parent.exists():
            p.write_text(json.dumps(data))
    except Exception:
        pass
