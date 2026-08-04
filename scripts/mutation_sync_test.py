#!/usr/bin/env python3
"""mutation_sync_test.py -- T-322 S3 test matrix for scripts/mutation_sync.py.

Exercises the REAL enforce write path against a TEMPORARY repo + index (never the
real knowledge/index_files.json). Real temp files are created on disk so the
exists-guard (defect-1 fix) is exercised end-to-end. Run from anywhere:
    python3 scripts/mutation_sync_test.py
Exit 0 = all PASS. Covers: enforce-write, provisional flag, no-clobber, dry-run,
escape hatch, non-indexable scope, wrong-tool ignore, delete-remove, ghost-file skip.
"""
import io
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mutation_sync as ms  # noqa: E402


def _read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def run():
    fails = []

    # T1 -- unit self-test still green (pure, in-memory)
    if ms._self_test() != 0:
        fails.append("T1 self-test")

    # temp repo + index; redirect the module at both so _rel + exists-guard resolve here
    tmp = tempfile.mkdtemp()
    idx = os.path.join(tmp, "knowledge", "index_files.json")
    os.makedirs(os.path.dirname(idx), exist_ok=True)
    with open(idx, "w", encoding="utf-8") as fh:
        json.dump({"knowledge/keep.md": {"description": "human",
                                         "topics": ["x"]}}, fh)
    ms.INDEX = idx
    ms.REPO = tmp

    def touch(rel, body="x"):
        ap = os.path.join(tmp, rel)
        os.makedirs(os.path.dirname(ap), exist_ok=True)
        with open(ap, "w", encoding="utf-8") as fh:
            fh.write(body)
        return ap

    def feed(tool, abspath):
        return io.StringIO(json.dumps(
            {"tool_name": tool, "tool_input": {"file_path": abspath}}))

    def clean_env():
        os.environ.pop("HARNESS_MUTATION_SYNC_ENFORCE", None)
        os.environ.pop("HARNESS_SKIP_MUTATION_SYNC", None)

    # T2 -- enforce ON: a real new .py gets a provisional entry
    clean_env()
    os.environ["HARNESS_MUTATION_SYNC_ENFORCE"] = "1"
    sys.stdin = feed("Write", touch("scripts/newthing.py"))
    ms.handle_stdin()
    fm = ms._files_map(json.load(open(idx, encoding="utf-8")))
    if "scripts/newthing.py" not in fm:
        fails.append("T2 enforce-write")
    elif fm["scripts/newthing.py"].get("backfill_pending") is not True:
        fails.append("T2 provisional-flag")

    # T3 -- editing an existing entry never clobbers a human description
    touch("knowledge/keep.md", "# keep")
    sys.stdin = feed("Edit", os.path.join(tmp, "knowledge/keep.md"))
    ms.handle_stdin()
    d = json.load(open(idx, encoding="utf-8"))
    if ms._files_map(d)["knowledge/keep.md"]["description"] != "human":
        fails.append("T3 no-clobber")

    # T4 -- dry-run (enforce unset): logs only, writes nothing
    clean_env()
    before = _read(idx)
    sys.stdin = feed("Write", touch("scripts/dry.py"))
    ms.handle_stdin()
    if _read(idx) != before:
        fails.append("T4 dry-run-wrote")

    # T5 -- escape hatch: even with enforce ON, SKIP short-circuits main()
    os.environ["HARNESS_MUTATION_SYNC_ENFORCE"] = "1"
    os.environ["HARNESS_SKIP_MUTATION_SYNC"] = "1"
    before = _read(idx)
    sys.stdin = feed("Write", touch("scripts/skip.py"))
    rc = ms.main()
    if rc != 0 or _read(idx) != before:
        fails.append("T5 escape-hatch")

    # T6 -- non-indexable paths ignored (.svg exempt, .sessions excluded)
    clean_env()
    os.environ["HARNESS_MUTATION_SYNC_ENFORCE"] = "1"
    before = _read(idx)
    for rel in ("knowledge/x.svg", ".sessions/x.md"):
        sys.stdin = feed("Write", touch(rel))
        ms.handle_stdin()
    if _read(idx) != before:
        fails.append("T6 non-indexable-wrote")

    # T7 -- wrong tool (Bash) ignored
    before = _read(idx)
    sys.stdin = feed("Bash", touch("scripts/whatever.py"))
    ms.handle_stdin()
    if _read(idx) != before:
        fails.append("T7 wrong-tool")

    # T8 -- delete removes the entry
    d = json.load(open(idx, encoding="utf-8"))
    fm = ms._files_map(d)
    ms.remove_entry(fm, "scripts/newthing.py")
    ms._save_index(d)
    if "scripts/newthing.py" in ms._files_map(json.load(open(idx, encoding="utf-8"))):
        fails.append("T8 delete-remove")

    # T9 -- ghost file (indexable path, NOT on disk) must be skipped (defect-1 guard)
    clean_env()
    os.environ["HARNESS_MUTATION_SYNC_ENFORCE"] = "1"
    before = _read(idx)
    sys.stdin = feed("Write", os.path.join(tmp, "scripts/ghost.py"))  # never touched
    ms.handle_stdin()
    if _read(idx) != before:
        fails.append("T9 ghost-file-written")

    clean_env()
    total = 9
    if fails:
        print(f"[mutation-sync-test] {total - len(fails)}/{total} PASS -- FAIL:",
              "; ".join(fails))
        return 1
    print(f"[mutation-sync-test] {total}/{total} PASS (enforce/provisional/"
          "no-clobber/dry-run/escape/scope/wrong-tool/delete/ghost-guard)")
    return 0


if __name__ == "__main__":
    sys.exit(run())
