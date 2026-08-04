#!/usr/bin/env python3
"""version_check.py — T-332 · other-machine update detection + notify.

A SessionStart hook that tells the user when a NEWER released harness version
exists, so machines other than the one that cut the release stop silently
running a stale plugin. Non-blocking, advisory: it never applies the update
(that stays a user-typed `/plugin update` / `git pull`), never pushes/pulls,
and NEVER fails the session — any error prints nothing and exits 0.

Detection is LAYERED (user-confirmed design, T-332):
  Layer A — git repo present + online + throttled (<=1/day):
      `git fetch origin main` (prompt-proof + timeout, F1) → count commits
      HEAD..FETCH_HEAD; if behind, read the remote plugin.json version + a
      one-line-per-commit change summary. This is the real cross-machine
      signal (a version cut on another machine and pushed).
  Layer B — offline / no git / plugin-only consumer:
      compare the running version against the newest sibling plugin-cache dir
      (`.../harness-agent/<version>/`), or the last-known-remote version cached
      in the throttle marker. No data => stay silent (graceful, no false alarm).

Throttle marker: <project>/.sessions/.version_check (JSON). The network fetch
runs at most once/day; between fetches the cached remote version still drives
the notice, so "you have not updated yet" keeps showing until you do — while a
genuinely up-to-date machine stays silent (How-Check C).

Usage:
  python3 scripts/version_check.py            # the SessionStart hook entry
  python3 scripts/version_check.py --force     # ignore the once/day throttle
  python3 scripts/version_check.py --self-test # deterministic offline self-test

Detection internals (semver helpers, env resolution, Layers A/B/C, throttle
marker I/O) live in the sibling module `version_check_detect.py` (kept ≤250
lines each; split is behavior-preserving, no logic changes).
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import os
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
from version_check_detect import (
    THROTTLE_SECONDS, SUMMARY_LINES, _cmp_semver,
    _engine_root, _project_root, _read_version, _update_steps,
    _git_latest, _disk_latest, _source_root,
    _read_marker, _write_marker,
)


def _build_notice(running, latest, summary, steps):
    """Build the user-facing notice, or '' when not strictly newer.

    steps: list of (label, command) update instructions to show.
    """
    if not running or not latest:
        return ""
    if _cmp_semver(latest, running) <= 0:
        return ""  # equal or we are ahead -> silent (How-Check C)
    lines = [f"[harness-update] ⬆ v{running} → v{latest} available"]
    if summary:
        lines.append("  what changed:")
        for s in summary[:SUMMARY_LINES]:
            lines.append(f"    - {s}")
    else:
        lines.append("  what changed: (details unavailable offline — a newer version was released)")
    lines.append("  to update (you run this — not applied automatically):")
    for label, cmd in steps:
        lines.append(f"    {label}: {cmd}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Orchestration.
# ---------------------------------------------------------------------------
def check(force=False, now=None):
    """Return the notice string ('' when up-to-date / no data). Never raises."""
    try:
        now = now if now is not None else time.time()
        engine_root = _engine_root()
        project_root = _project_root(engine_root)
        running = _read_version(engine_root / ".claude-plugin" / "plugin.json")
        if not running:
            return ""

        marker = _read_marker(project_root)
        latest = marker.get("last_remote_version")
        summary = marker.get("last_summary") or []

        due = force or (now - float(marker.get("last_check_epoch", 0)) >= THROTTLE_SECONDS)
        if due:
            got = _git_latest(engine_root)          # Layer A
            if got is None:                          # Layer C — machine_install engine (no .git) → check the recorded source clone
                src = _source_root(engine_root)
                if src is not None:
                    got = _git_latest(src)
            if got is not None:
                latest, summary, head = got
                marker.update(last_check_epoch=now, last_remote_version=latest,
                              last_summary=summary, last_remote_head=head)
                _write_marker(project_root, marker)
            else:
                # record the attempt so we do not retry the network every boot
                marker["last_check_epoch"] = now
                _write_marker(project_root, marker)

        # Layer B — always consider the newest on-disk sibling (covers plugin
        # consumers with no git, and self-host when the fetch was offline).
        disk = _disk_latest(engine_root)
        if disk and (not latest or _cmp_semver(disk, latest) > 0):
            latest = disk

        return _build_notice(running, latest, summary, _update_steps(engine_root))
    except Exception:
        return ""  # fail-safe: a boot hook must never crash the session


# ---------------------------------------------------------------------------
# Self-test (F2) — deterministic, no network / no git.
# ---------------------------------------------------------------------------
def self_test():
    steps = [("plugin", "/plugin update")]
    cases = [
        # (running, latest, summary, expect_notice, must_contain)
        ("1.0.6", "1.0.7", ["fix: x"], True, "1.0.7"),
        ("1.0.6", "1.0.6", [], False, None),
        ("1.0.7", "1.0.6", [], False, None),     # we are ahead -> silent
        ("1.0.6", None, [], False, None),        # offline / no data -> silent
        (None, "1.0.7", [], False, None),        # unknown running -> silent
        ("1.0.9", "1.0.10", ["a"], True, "1.0.10"),  # numeric (not string) compare
    ]
    failures = []
    for running, latest, summary, expect, contains in cases:
        note = _build_notice(running, latest, summary, steps)
        got = bool(note)
        if got != expect:
            failures.append(f"notice({running},{latest}) -> present={got}, expected={expect}")
        if contains and contains not in note:
            failures.append(f"notice({running},{latest}) missing {contains!r}")
    # _cmp_semver spot checks
    for a, b, exp in [("1.0.10", "1.0.9", 1), ("1.0.9", "1.0.10", -1), ("1.0.6", "1.0.6", 0),
                      ("2.0.0", "1.9.9", 1)]:
        if _cmp_semver(a, b) != exp:
            failures.append(f"_cmp_semver({a},{b}) != {exp}")
    # Layer C (_source_root) — machine_install engine: no .git but a .harness_source
    # pointer to the real clone (T-337).
    import tempfile
    _eng = Path(tempfile.mkdtemp())
    _clone = Path(tempfile.mkdtemp())
    (_clone / ".git").mkdir()
    (_eng / ".harness_source").write_text(str(_clone))
    if _source_root(_eng) != _clone:
        failures.append("_source_root did not resolve the .harness_source clone")
    if _source_root(Path(tempfile.mkdtemp())) is not None:
        failures.append("_source_root should be None without a marker")

    if failures:
        print("SELF-TEST FAIL")
        for f in failures:
            print("  -", f)
        return 1
    print("SELF-TEST PASS")
    return 0


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if "--self-test" in argv:
        return self_test()
    force = "--force" in argv
    notice = check(force=force)
    if notice:
        print(notice)
    return 0  # always 0 — advisory hook, never blocks boot


if __name__ == "__main__":
    sys.exit(main())
