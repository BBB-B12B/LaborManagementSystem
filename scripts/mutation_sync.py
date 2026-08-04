#!/usr/bin/env python3
"""mutation_sync.py -- T-322 per-event incremental index sync (PostToolUse hook).

WHY: index/backlink/symbol/topic-label sync used to run ONLY at session close
(Stop-hook index_reconcile.py). New files were invisible in the file table of
contents (knowledge/index_files.json) until then. This hook closes the common
case at the mutation TRIGGER -- so grep-ability is immediate, plan-free.

TWO-LAYER SPLIT (see .sessions/gather_complete.md S1 + CFP-049):
  * PER-EVENT (this hook, cheap, single file): upsert the file's index_files.json
    entry so it is grep-able right away. New files get a PROVISIONAL entry flagged
    backfill_pending so a human / backfill can write a real description later.
  * CLOSE-BATCH (unchanged, Stop reconciler, whole-repo): backlink + symbol +
    code_graph + repo_map -- these are cross-file graphs, correct only whole-repo,
    so deferring them is right, not lazy. Deletes are reconciled at close via
    git-diff (robust) rather than a brittle Bash `rm` parser.

NON-BLOCKING: PostToolUse runs AFTER the edit, so it can only SYNC, never block.
On ANY error it logs to stderr and exits 0 -- it must never break a user edit.

SINGLE SOURCE: indexability + paths are imported from index_reconcile.py; the
reuse-first topic resolver lives in tag_gate.py. This file adds no new vocab and
no new indexability rule. `.svg` is exempt because index_reconcile.is_indexable
excludes it -- we follow that, we do not diverge from it.

ENV:
  HARNESS_SKIP_MUTATION_SYNC=1     -> no-op escape hatch (nothing runs)
  HARNESS_MUTATION_SYNC_ENFORCE=1  -> perform writes. DEFAULT (unset) = dry-run:
                                      log what it WOULD do, write nothing.

USAGE:
  (hook)   echo '<PostToolUse-json>' | python3 scripts/mutation_sync.py
  (test)   python3 scripts/mutation_sync.py --self-test
"""
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

# --- single-source reuse: predicate + index path from the close reconciler -----
try:
    from index_reconcile import is_indexable, INDEX, REPO
except Exception:  # never let an import problem break an edit
    REPO = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    INDEX = os.path.join(REPO, "knowledge", "index_files.json")

    def is_indexable(_path):  # conservative fallback = do nothing
        return False


def _skip():
    return os.environ.get("HARNESS_SKIP_MUTATION_SYNC") == "1"


def _enforce():
    return os.environ.get("HARNESS_MUTATION_SYNC_ENFORCE") == "1"


# --- index_files.json helpers (flat {path: entry} dict; tag_gate handles both) --
def _load_index():
    try:
        with open(INDEX, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def _files_map(idx):
    if not isinstance(idx, dict):
        return {}
    # some tools nest under "files"; most of this repo is flat -> mirror tag_gate
    return idx.get("files", idx)


def _save_index(idx):
    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump(idx, fh, ensure_ascii=False, indent=2)


def _auto_description(path):
    """Provisional one-line description read from the file itself (best-effort)."""
    ap = os.path.join(REPO, path)
    try:
        with open(ap, encoding="utf-8", errors="replace") as fh:
            head = fh.read(2000)
    except OSError:
        return ""
    if path.endswith(".md"):
        for line in head.splitlines():
            s = line.strip().lstrip("#").strip()
            if s:
                return s[:180]
    if path.endswith(".py"):
        m = re.search(r'"""(.+?)"""', head, re.S)
        if m:
            first = m.group(1).strip().splitlines()
            if first:
                return first[0][:180]
    for line in head.splitlines():
        s = line.strip()
        if s and not s.startswith(("#", "//", "/*", "*")):
            return s[:180]
    return ""


# --- core operations (pure: act on a files map so they are unit-testable) -------
def upsert_entry(files, path, description_fn=_auto_description):
    """Ensure `path` has an entry. Existing entries are NEVER clobbered (a human
    description / real topics stay intact); only genuinely-new files get a
    provisional backfill_pending stub so they are grep-able immediately."""
    if path in files:
        return "present"
    files[path] = {"description": description_fn(path), "backfill_pending": True}
    return "added"


def remove_entry(files, path):
    """Delete-side: drop a stale entry. (Wired for close-time git-diff / manual;
    live rm is intentionally reconciled at close, not parsed from Bash.)"""
    if path in files:
        del files[path]
        return "removed"
    return "absent"


# --- hook mode -----------------------------------------------------------------
def _rel(path):
    try:
        return os.path.relpath(os.path.abspath(path), REPO)
    except ValueError:
        return path


def handle_stdin():
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        return 0
    if data.get("tool_name", "") not in ("Edit", "Write", "NotebookEdit"):
        return 0
    ti = data.get("tool_input", {}) or {}
    fp = ti.get("file_path") or ti.get("notebook_path") or ""
    if not fp:
        return 0
    rel = _rel(fp)
    if not is_indexable(rel):
        return 0
    # PostToolUse fires only AFTER a successful write, so the file should exist.
    # Guard against ghost entries from odd/synthetic paths (defect-1, 3rd-party test).
    if not os.path.exists(os.path.join(REPO, rel)):
        return 0
    idx = _load_index()
    files = _files_map(idx)
    if upsert_entry(files, rel) != "added":
        return 0  # already indexed -> nothing to do this event
    if _enforce():
        try:
            _save_index(idx)
            sys.stderr.write(
                f"[mutation-sync] indexed: {rel} (provisional · backfill_pending)\n")
        except OSError as exc:
            sys.stderr.write(f"[mutation-sync] WARN could not write index: {exc}\n")
    else:
        sys.stderr.write(
            f"[mutation-sync:dry-run] would index: {rel} "
            f"(set HARNESS_MUTATION_SYNC_ENFORCE=1 to apply)\n")
    return 0


# --- self-test (S2 Verify-1: pure in-memory, never touches the real index) ------
def _self_test():
    fails = []
    files = {}

    if upsert_entry(files, "scripts/_st_new.py", lambda p: "x") != "added" \
            or "scripts/_st_new.py" not in files:
        fails.append("create->indexed")
    if files.get("scripts/_st_new.py", {}).get("backfill_pending") is not True:
        fails.append("new-entry-flagged-provisional")

    files["knowledge/_st_doc.md"] = {"description": "human", "topics": ["x"]}
    upsert_entry(files, "knowledge/_st_doc.md", lambda p: "AUTO")
    if files["knowledge/_st_doc.md"]["description"] != "human":
        fails.append("edit->no-clobber")

    if remove_entry(files, "scripts/_st_new.py") != "removed" \
            or "scripts/_st_new.py" in files:
        fails.append("delete->removed")

    for p, want in [("scripts/x.py", True), ("knowledge/a.md", True),
                    ("docs/x.md", True), (".sessions/x.md", False),
                    ("knowledge/x.svg", False), ("memory/x.md", False),
                    ("knowledge/index_files.json", False)]:
        if bool(is_indexable(p)) != want:
            fails.append(f"indexable({p})!={want}")

    if fails:
        print("[mutation-sync self-test] FAIL:", "; ".join(fails))
        return 1
    print("[mutation-sync self-test] PASS "
          "(create/edit-no-clobber/delete/indexable-scope/provisional-flag)")
    return 0


def main():
    if "--self-test" in sys.argv:
        return _self_test()
    if _skip():
        return 0
    return handle_stdin()


if __name__ == "__main__":
    sys.exit(main())
