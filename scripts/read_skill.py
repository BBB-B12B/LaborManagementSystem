#!/usr/bin/env python3
"""read_skill.py — code-level engine resolution for MODEL-FACING skill reads.

T-314 · S1 (fix G1 / HALT-1). The constitution used to tell the model to
``Read .agents/skills/<bucket>/<skill>/SKILL.md`` — a PROJECT-RELATIVE literal
path. Claude's Read tool takes a literal string with NO shell/env expansion, so
in a project that has no local engine copy (a pure-plugin install) that read is
a silent 404 — exactly the T-313 failure.

The fix pushes resolution into CODE. The model shells out (Bash CAN expand /
this script self-locates) instead of issuing a bare Read:

    python3 <ENGINE>/scripts/read_skill.py harness/mece [start] [end]

Engine resolution order (first hit wins):
  1. env HARNESS_ENGINE_ROOT   (installer / hooks.json set this to the plugin)
  2. env CLAUDE_PLUGIN_ROOT    (Claude Code exports this for plugin hooks)
  3. Path(__file__).parent.parent  (this script lives at <ENGINE>/scripts/, so
     invoking it by absolute path makes it self-locating with NO env at all)

Because option 3 always holds when the file is called by its real path, this is
robust even when the model passes no environment — the mechanism does not depend
on the model remembering or concatenating anything.

A missing SKILL.md prints a LOUD error to stderr and exits non-zero, so a bad
path can never masquerade as an empty/clean read again (the T-313 silent fail).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_engine_root() -> Path:
    """ENGINE_ROOT for a model-facing read. See module docstring for order.

    Kept consistent with harness_paths._resolve_engine_root but additionally
    honors CLAUDE_PLUGIN_ROOT, since read_skill.py can be invoked bare from a
    plugin hook context where only CLAUDE_PLUGIN_ROOT is exported.
    """
    for var in ("HARNESS_ENGINE_ROOT", "CLAUDE_PLUGIN_ROOT"):
        val = os.environ.get(var)
        if val:
            return Path(val).resolve()
    # scripts/read_skill.py -> parent (scripts/) -> parent (engine home)
    return Path(__file__).resolve().parent.parent


def skill_file(engine_root: Path, skill: str, fname: str = "SKILL.md") -> Path:
    """Map a bucketed skill id (e.g. 'harness/mece') to its SKILL.md path."""
    return engine_root.joinpath(".agents", "skills", *skill.split("/"), fname)


def main(argv: list) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print("usage: read_skill.py <bucket/skill> [start_line] [end_line] "
              "[--file NAME]", file=sys.stderr)
        return 2

    skill = argv[0]
    fname = "SKILL.md"
    positional = []
    i = 1
    while i < len(argv):
        if argv[i] == "--file" and i + 1 < len(argv):
            fname = argv[i + 1]
            i += 2
            continue
        positional.append(argv[i])
        i += 1

    start = int(positional[0]) if len(positional) >= 1 else None
    end = int(positional[1]) if len(positional) >= 2 else None

    engine_root = resolve_engine_root()
    path = skill_file(engine_root, skill, fname)

    if not path.is_file():
        # LOUD failure — never a silent 404 (the whole point of T-314 S1).
        print(f"read_skill.py ERROR: not found: {path}", file=sys.stderr)
        print(f"  engine_root = {engine_root}", file=sys.stderr)
        print(f"  skill       = {skill}  file = {fname}", file=sys.stderr)
        print("  (set HARNESS_ENGINE_ROOT or CLAUDE_PLUGIN_ROOT, or invoke this "
              "script by its absolute path so it self-locates)", file=sys.stderr)
        return 3

    lines = path.read_text(encoding="utf-8").splitlines()
    if start is not None:
        lo = max(start - 1, 0)
        hi = end if end is not None else len(lines)
        lines = lines[lo:hi]
    sys.stdout.write("\n".join(lines) + ("\n" if lines else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
