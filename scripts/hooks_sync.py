#!/usr/bin/env python3
"""hooks_sync.py — parity guard for the harness's TWO hook-lists.

The harness registers its enforcement hooks two ways, one per consumption mode:
  - .claude-plugin/hooks.json  (PLUGIN consumers · the shipped/canonical list)
  - .claude/settings.json      (the master dev repo's own local config)
Both files MUST exist (they serve different machines), so they cannot be collapsed into
one file. The risk is DRIFT: an enforcement script added to one list but not the other
fires on only one consumption mode. That was gap F2 (spawn_gate/mutation_sync/
cfp_fix_plan_gate/init_gate/share_close lived in settings.json but not hooks.json, so
they never fired on plugin installs). This guard makes that drift LOUD instead of silent.

What it compares: the SET of (event, scripts/NAME) references across both files. Command
prefixes legitimately differ (the plugin list sets HARNESS_ENGINE_ROOT=${CLAUDE_PLUGIN_ROOT},
the local list relies on the fallback), so only the event + script identity is compared,
never the exact command string. Big inline bash hooks (the token tracker, the sed context
updaters) carry no scripts/NAME reference and are reported separately, not diffed.

Master-repo-only: on a plugin-consumer machine, settings.json has NO harness hooks, so a
diff would be meaningless. If settings.json references zero harness scripts, the check is
SKIPPED (exit 0) — it only bites in the master repo where both lists are hand-maintained.

Usage:
  python3 scripts/hooks_sync.py [--check]   # default; exit 1 on drift, 0 on parity/skip
  python3 scripts/hooks_sync.py --self-test # built-in assertions
"""
import json
import re
import sys
from pathlib import Path

SCRIPT_RE = re.compile(r"scripts/([A-Za-z0-9_]+)\.(?:py|sh)")
# a `python3 -c "..."` hook is INLINE python — any scripts/NAME inside it is a subprocess
# STRING, not the hook's identity, so such a command is not mined for script refs.
INLINE_PY = re.compile(r"python3?\s+-c\b")
# scripts the master repo implements INLINE in settings.json (the plugin calls the .py).
# An accepted implementation divergence — reported as [hook-info], never counted as drift.
KNOWN_INLINE = {"phase_gate"}


def extract(data):
    """dict -> (scripts:set[(event,script)], inline:list[(event,matcher)]).

    scripts = the primary scripts/NAME each hook invokes, keyed by event. A `python3 -c`
              command is treated as inline (its embedded scripts/NAME are subprocess args,
              not the hook identity) so it never pollutes the script set.
    inline  = groups whose commands invoke no scripts/NAME directly — reported, not diffed.
    """
    scripts, inline = set(), []
    for event, groups in (data.get("hooks") or {}).items():
        for g in groups or []:
            matcher = g.get("matcher", "")
            found = False
            for h in g.get("hooks", []) or []:
                cmd = h.get("command", "")
                if INLINE_PY.search(cmd):
                    continue  # inline python body — do not mine its subprocess strings
                for m in SCRIPT_RE.finditer(cmd):
                    scripts.add((event, m.group(1)))
                    found = True
            if not found and (g.get("hooks")):
                inline.append((event, matcher))
    return scripts, inline


def extract_file(path):
    return extract(json.loads(Path(path).read_text()))


def check(plugin_path, settings_path):
    """-> (only_plugin, only_settings, skipped:bool)."""
    p_scripts, _ = extract_file(plugin_path)
    s_scripts, _ = extract_file(settings_path)
    if not s_scripts:  # consumer machine: settings.json carries no harness hooks
        return set(), set(), True
    return p_scripts - s_scripts, s_scripts - p_scripts, False


def _root():
    return Path(__file__).resolve().parent.parent


def run_check():
    root = _root()
    plugin = root / ".claude-plugin" / "hooks.json"
    settings = root / ".claude" / "settings.json"
    for f in (plugin, settings):
        if not f.exists():
            print(f"[hook-drift] skip — {f} absent (not the master repo)")
            return 0
    only_p, only_s, skipped = check(plugin, settings)
    if skipped:
        print("[hook-drift] skip — settings.json has no harness hooks (plugin-consumer machine)")
        return 0
    info = {(e, s) for (e, s) in only_p if s in KNOWN_INLINE}
    only_p -= info
    for event, s in sorted(info):
        print(f"[hook-info] {s} ({event}) — .py in plugin hooks.json; settings.json implements it INLINE (accepted divergence)")
    if not only_p and not only_s:
        print("[hook-drift] none — both hook-lists reference the same enforcement scripts")
        return 0
    print("[hook-drift] DRIFT — the two hook-lists diverge:")
    for event, s in sorted(only_p):
        print(f"  {s} ({event}) — in plugin hooks.json, MISSING from .claude/settings.json")
    for event, s in sorted(only_s):
        print(f"  {s} ({event}) — in .claude/settings.json, MISSING from plugin hooks.json")
    print("  fix: add the missing hook to the other file (author BOTH; hooks.json is the shipped canonical).")
    return 1


def self_test():
    base = {"hooks": {"PreToolUse": [
        {"hooks": [{"command": 'python3 "$X/scripts/skill_gate.py"'}]},
        {"matcher": "Edit|Write", "hooks": [{"command": 'python3 "$X/scripts/spawn_gate.py"'}]},
    ]}}
    s, inline = extract(base)
    assert s == {("PreToolUse", "skill_gate"), ("PreToolUse", "spawn_gate")}, s
    assert inline == [], inline
    # inline-only group is reported, not counted as a script
    il = {"hooks": {"UserPromptSubmit": [{"hooks": [{"command": "echo hi | awk '{print}'"}]}]}}
    s2, inline2 = extract(il)
    assert s2 == set() and inline2 == [("UserPromptSubmit", "")], (s2, inline2)
    # drift detection: plugin has a script settings lacks
    plugin = base
    settings = {"hooks": {"PreToolUse": [
        {"hooks": [{"command": 'python3 scripts/skill_gate.py'}]},
    ]}}
    ps, _ = extract(plugin)
    ss, _ = extract(settings)
    assert ps - ss == {("PreToolUse", "spawn_gate")}, ps - ss
    # python3 -c inline body: nested scripts/X refs are NOT mined (subprocess strings)
    cinline = {"hooks": {"PreToolUse": [
        {"hooks": [{"command": "python3 -c \"import subprocess; subprocess.run(['python3','scripts/index_reconcile.py'])\""}]}
    ]}}
    sc, inl = extract(cinline)
    assert sc == set(), sc
    assert inl == [("PreToolUse", "")], inl
    # empty settings => skip path
    assert extract({"hooks": {}})[0] == set()
    print("[hooks_sync self-test] PASS (extract · inline-body-skip · drift-diff · empty-skip)")
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    return run_check()  # --check is the default


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
