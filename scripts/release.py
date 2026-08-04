#!/usr/bin/env python3
"""release.py — one command to make a harness release propagation-ready (T-331 S1).

The manual release dance was: bump the version in .claude-plugin/plugin.json, THEN
remember to regenerate .claude-plugin/hooks.json from .claude/settings.json, THEN
check the two hook-lists still agree. Forgetting any step ships a broken/stale
plugin. This wraps all three into `python3 scripts/release.py <patch|minor|major>`.

It does NOT re-implement any logic — it REUSES the existing single-source scripts:
  - gen_plugin_hooks.main()  regenerates hooks.json from settings.json (the port)
  - hooks_sync.run_check()   confirms the two hook-lists reference the same scripts
  - hooks_sync.self_test()   sanity-checks the drift detector itself
so there is exactly one place each behavior lives.

Push and `/plugin update` are USER actions (git push is deny-listed for the agent),
so this prints the remaining propagation checklist rather than performing it.

Usage:
  python3 scripts/release.py patch          # 1.0.5 -> 1.0.6, regen hooks, verify
  python3 scripts/release.py minor          # 1.0.5 -> 1.1.0
  python3 scripts/release.py major          # 1.0.5 -> 2.0.0
  python3 scripts/release.py --dry-run patch  # show the plan, write NOTHING
  python3 scripts/release.py --self-test    # built-in assertions
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PLUGIN_JSON = os.path.join(ROOT, ".claude-plugin", "plugin.json")
HOOKS_JSON = os.path.join(ROOT, ".claude-plugin", "hooks.json")

# import the sibling engine scripts (single-source — never re-implement their logic)
sys.path.insert(0, HERE)
import gen_plugin_hooks   # noqa: E402
import hooks_sync         # noqa: E402
import gen_native_skills  # noqa: E402


def _bump(version: str, level: str) -> str:
    """'1.0.5' + level -> new semver string. patch/minor/major reset lower parts."""
    parts = version.strip().split(".")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise ValueError(f"version must be MAJOR.MINOR.PATCH, got {version!r}")
    major, minor, patch = (int(p) for p in parts)
    if level == "patch":
        patch += 1
    elif level == "minor":
        minor, patch = minor + 1, 0
    elif level == "major":
        major, minor, patch = major + 1, 0, 0
    else:
        raise ValueError(f"level must be patch|minor|major, got {level!r}")
    return f"{major}.{minor}.{patch}"


def _read_plugin():
    if not os.path.exists(PLUGIN_JSON):
        raise FileNotFoundError(f"missing {PLUGIN_JSON}")
    return json.load(open(PLUGIN_JSON))


def _regen_hooks() -> int:
    """Run gen_plugin_hooks.main() with a CLEAN argv so it does not mistake
    release.py's own args (e.g. 'patch') for its [SETTINGS] [OUT] positionals."""
    saved = sys.argv
    sys.argv = [saved[0]]
    try:
        return gen_plugin_hooks.main()
    finally:
        sys.argv = saved


def _git_stage(paths) -> None:
    """git add the files release.py just changed, so the version bump can never be left
    unstaged (the T-334 trap: committing BEFORE running release.py stranded v1.0.8). Guarded
    — silently skip if this is not a git repo or git is unavailable (release.py also runs on
    consumer machines that may have neither)."""
    try:
        inside = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"],
                                cwd=ROOT, capture_output=True, text=True)
        if inside.returncode != 0 or inside.stdout.strip() != "true":
            return  # not a git repo — nothing to stage
        subprocess.run(["git", "add", "--"] + list(paths), cwd=ROOT,
                       capture_output=True, text=True)
        rels = ", ".join(os.path.relpath(p, ROOT) for p in paths)
        print(f"[release] staged (git add): {rels}")
    except OSError:
        return  # git not installed — skip silently


def _checklist(new_version: str) -> None:
    print("\n--- propagation checklist (USER actions — agent cannot push) ---")
    print("  release.py already did: bump plugin.json · regen hooks.json · git add BOTH —")
    print("  the version bump is now STAGED, so the next commit cannot leave it behind.")
    print(f"  1. commit:   git commit -am 'release: v{new_version} (bump + hook-sync)'")
    print("               (folds the staged bump + your content into ONE commit)")
    print("  2. push:     git push   (USER — git push is deny-listed for the agent)")
    print("  3. propagate:")
    print("       plugin consumers:  /plugin update   (one command — pulls engine + constitution)")
    print("       self-host machines: git pull && bash scripts/machine_install.sh")
    print("  4. other machines auto-detect this release at their next SessionStart")
    print("     (T-332 · scripts/version_check.py) → they notify + offer /plugin update")


def do_release(level: str, dry_run: bool) -> int:
    data = _read_plugin()
    old = data.get("version")
    if not old:
        raise KeyError(f"{PLUGIN_JSON} has no 'version' field")
    new = _bump(old, level)

    if dry_run:
        print(f"[release --dry-run] {level}: {old} -> {new}")
        print(f"  would write:      {PLUGIN_JSON} (version {new})")
        print("  would regenerate: .claude-plugin/hooks.json  (gen_plugin_hooks)")
        print("  would regenerate: skills/<name>/SKILL.md      (gen_native_skills, bridged)")
        _dns, _okns = gen_native_skills.check()  # read-only — safe in dry-run
        print(f"  current native-skills status: {'DRIFT' if _dns else 'in-sync'} ({_okns} ok)")
        drift = hooks_sync.run_check()  # read-only — safe in dry-run
        print(f"  current hook-drift status: {'DRIFT' if drift else 'clean'} (exit {drift})")
        print("  (dry-run — no files written)")
        return 0

    # 0. regenerate native plugin skills from the .agents/skills/ single source, then
    #    drift-check — a release must never ship a stale or missing native skill (no seam).
    built_ns, skipped_ns = gen_native_skills.generate()
    if skipped_ns:
        print(f"[release] WARN — native skills skipped (source missing): {skipped_ns}")
    drift_ns, ok_ns = gen_native_skills.check()
    if drift_ns:
        for _d in drift_ns:
            print(f"[release] FAIL — native-skills drift: {_d}")
        return 1
    print(f"[release] native skills regenerated + in-sync: {ok_ns} (built {len(built_ns)})")

    # 1. bump version
    data["version"] = new
    with open(PLUGIN_JSON, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"[release] version {old} -> {new}")

    # 2. regenerate hooks.json from settings.json (single-source port)
    rc = _regen_hooks()
    if rc != 0:
        print(f"[release] FAIL — gen_plugin_hooks returned {rc}")
        return rc

    # 3. verify the two hook-lists still agree + the detector itself is sane
    if hooks_sync.self_test() != 0:
        print("[release] FAIL — hooks_sync self-test did not pass")
        return 1
    drift = hooks_sync.run_check()
    if drift:
        print("[release] FAIL — hook drift AFTER regenerate (investigate settings.json)")
        return 1

    # stage the two files we just changed so the bump cannot be left uncommitted (T-334)
    _git_stage([PLUGIN_JSON, HOOKS_JSON, os.path.join(ROOT, "skills")])
    print(f"[release] OK — v{new} is propagation-ready (version bumped · hooks regenerated · no drift · staged)")
    _checklist(new)
    return 0


def self_test() -> int:
    assert _bump("1.0.5", "patch") == "1.0.6", _bump("1.0.5", "patch")
    assert _bump("1.0.5", "minor") == "1.1.0", _bump("1.0.5", "minor")
    assert _bump("1.0.5", "major") == "2.0.0", _bump("1.0.5", "major")
    assert _bump("1.9.9", "minor") == "1.10.0", _bump("1.9.9", "minor")
    for bad in ("1.0", "1.0.x", "v1.0.0"):
        try:
            _bump(bad, "patch")
            raise AssertionError(f"expected ValueError for {bad!r}")
        except ValueError:
            pass
    for bad_level in ("", "PATCH", "bump"):
        try:
            _bump("1.0.0", bad_level)
            raise AssertionError(f"expected ValueError for level {bad_level!r}")
        except ValueError:
            pass
    # plugin.json is present and carries a well-formed version we can bump
    data = _read_plugin()
    _bump(data["version"], "patch")
    print("[release self-test] PASS (bump patch/minor/major · carry · bad-version · bad-level · plugin.json readable)")
    return 0


def main(argv) -> int:
    ap = argparse.ArgumentParser(description="Make a harness release propagation-ready.")
    ap.add_argument("level", nargs="?", choices=["patch", "minor", "major"],
                    help="semver bump level")
    ap.add_argument("--dry-run", action="store_true", help="show the plan, write nothing")
    ap.add_argument("--self-test", action="store_true", help="run built-in assertions")
    args = ap.parse_args(argv)

    if args.self_test:
        return self_test()
    if not args.level:
        ap.error("level (patch|minor|major) is required unless --self-test")
    return do_release(args.level, args.dry_run)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
