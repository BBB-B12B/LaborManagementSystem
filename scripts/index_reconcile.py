#!/usr/bin/env python3
"""index_reconcile.py — session-close index drift net (T-183).

Runs at session Stop (wired in .claude/settings.json). It answers ONE question:
"did anything change on disk this session that an index should have tracked, but
didn't?" — so a forgotten R8 update is caught at close, not silently lost.

What it does:
  1. read git status (working-tree changes since last commit)
  2. compare changed/new/deleted paths against knowledge/index_files.json keys
  3. detect which idempotent regenerators are now STALE (their source files changed)
  4. emit a [index-drift] report (or [index-clean])
  S2 = detection + report only. S3 adds guarded auto-run of the regenerators.

FAIL-SAFE CONTRACT (like compact_reset.py): this script must NEVER block session
close. Every failure path returns exit 0. A reconciler that crashes a Stop hook is
worse than one that misses a drift — so it swallows all errors and reports best-effort.

Usage:
  python3 scripts/index_reconcile.py            # report drift (Stop-hook default)
  python3 scripts/index_reconcile.py --dry-run  # same report, never writes/regenerates
"""
import argparse
import glob
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "knowledge", "index_files.json")

# paths that should NEVER count as index drift (transient / self / generated)
EXCLUDE_PREFIX = (".sessions/", ".git/", "node_modules/", "memory/")
EXCLUDE_SUFFIX = (".lock", ".close_checklist_ack", "tool_schema_hash.txt")
EXCLUDE_NAME = ("index_files.json", "index_variables.json", "index_sessions.json",
                "index_cfp_fix.json")

# a changed file is "indexable" (deserves an index_files.json entry) if it lives in
# one of these trees and is a doc / code / config file
INDEXABLE_DIRS = ("scripts/", "knowledge/", "src/", "Implement/", "docs/",
                  ".agents/skills/", ".agents/tools/", "")  # "" = repo-root md files
INDEXABLE_EXT = (".md", ".py", ".ts", ".tsx", ".js", ".json")

# harness rule files → when any of these change, rule_indexer.py output is stale
RULE_FILE_GLOBS = ["CLAUDE.md", "AGENTS.md", "CODING_FAILURE_PATTERNS.md",
                   "INVARIANTS.md", "REPO_MAP.md", "Implement/*.md",
                   ".agents/skills/*/SKILL.md", ".agents/skills/*/SKILL_detail.md",
                   "knowledge/*.md", "docs/master_roadmap.md"]


def git_changes():
    """Return dict {path: status} where status in {new, modified, deleted}. Best-effort."""
    try:
        out = subprocess.run(["git", "-C", REPO, "status", "--porcelain"],
                             capture_output=True, text=True, timeout=15)
        if out.returncode != 0:
            return {}
    except (OSError, subprocess.SubprocessError):
        return {}
    changes = {}
    for line in out.stdout.splitlines():
        if len(line) < 4:
            continue
        code, path = line[:2], line[3:].strip()
        # handle "old -> new" rename lines
        if " -> " in path:
            path = path.split(" -> ", 1)[1].strip()
        path = path.strip('"')
        if "D" in code:
            changes[path] = "deleted"
        elif "?" in code:
            changes[path] = "new"
        else:
            changes[path] = "modified"
    return changes


def is_indexable(path):
    if path.startswith(EXCLUDE_PREFIX) or path.endswith(EXCLUDE_SUFFIX):
        return False
    if os.path.basename(path) in EXCLUDE_NAME:
        return False
    if os.path.basename(path).startswith("._"):
        return False
    if not path.endswith(INDEXABLE_EXT):
        return False
    # repo-root .md files are indexable; otherwise must sit under a tracked dir
    if "/" not in path:
        return path.endswith(".md")
    return any(path.startswith(d) for d in INDEXABLE_DIRS if d)


def load_index_keys():
    try:
        with open(INDEX, encoding="utf-8") as fh:
            return set(json.load(fh).keys())
    except (OSError, ValueError):
        return set()


def rule_files_changed(changes):
    rule_set = set()
    for pat in RULE_FILE_GLOBS:
        for p in glob.glob(os.path.join(REPO, pat)):
            rule_set.add(os.path.relpath(p, REPO))
    return sorted(p for p, st in changes.items() if p in rule_set and st != "deleted")


def repo_map_drift_lines():
    """Auto-sync: run repo_map_check.py --sync (always exits 0). The AUTO structure
    block (folders incl. nested + per-folder file counts), content-rename carries
    (git -M), and TODO placeholders for genuinely-new items are applied automatically.
    This is safe to auto-run because --sync only ever touches the marker-delimited
    AUTO block + adds placeholder rows — curated descriptions live OUTSIDE the markers
    and are NEVER overwritten (T-185 / T-190). Returns the meaningful action lines
    (residual drift, renames carried, placeholders added) for session-close visibility."""
    try:
        r = subprocess.run(["python3", "scripts/repo_map_check.py", "--sync"],
                           cwd=REPO, capture_output=True, text=True, timeout=30)
        return [ln for ln in r.stdout.splitlines()
                if ln.startswith(("[repo-map-drift]", "[repo-map-rename]", "[repo-map-append]"))]
    except (OSError, subprocess.SubprocessError):
        return []  # fail-safe — never block session close


def reconcile():
    """Return (drift_lines, regen_plan). regen_plan = list of (cmd, reason)."""
    changes = git_changes()
    keys = load_index_keys()
    drift, regen = [], []

    indexable = {p: st for p, st in changes.items() if is_indexable(p)}
    for path, st in sorted(indexable.items()):
        if st in ("new", "modified") and path not in keys:
            drift.append(f"[index-drift] missing entry: {path} ({st}) — not in index_files.json")
        elif st == "deleted" and path in keys:
            drift.append(f"[index-drift] stale entry: {path} (deleted) — still in index_files.json")

    # idempotent regenerators whose source changed
    rc = rule_files_changed(changes)
    if rc:
        regen.append(("python3 scripts/rule_indexer.py",
                      f"harness rule file(s) changed: {', '.join(rc[:4])}"))
    if indexable:
        regen.append(("python3 scripts/backlink_analyzer.py",
                      f"{len(indexable)} indexable file(s) changed (related[] may be stale)"))

    # code import-graph (Tier-A hard edges · T-192) — when code files changed.
    # Idempotent + hash-locked: re-extracts only changed files, unchanged skipped.
    code_changed = [p for p in changes
                    if p.endswith((".py", ".ts", ".tsx", ".js", ".jsx"))
                    and (p.startswith("scripts/") or p.startswith("src/"))]
    if code_changed:
        regen.append(("python3 scripts/code_graph.py --write",
                      f"{len(code_changed)} code file(s) changed (import edges may be stale)"))
        # index_variables.json (symbol catalog) has no other auto-heal — wire it here so
        # symbols self-heal at close like every other index. Idempotent + scans src/ only,
        # so a scripts-only change makes it a cheap no-op (guarded; failure never fatal).
        regen.append(("python3 scripts/symbol_indexer.py",
                      f"{len(code_changed)} code file(s) changed (index_variables.json symbols may be stale)"))

    # REPO_MAP.md drift — flag only (curated descriptions, never auto-regen · T-185)
    drift.extend(repo_map_drift_lines())
    return drift, regen


def execute_regen(regen):
    """S3: run each idempotent regenerator, GUARDED. One failure (e.g. the currently
    broken backlink_analyzer) never aborts the rest or the session close. Returns
    [(cmd, status)] for reporting."""
    results = []
    for cmd, _reason in regen:
        argv = cmd.split()
        try:
            r = subprocess.run(argv, cwd=REPO, capture_output=True, text=True, timeout=60)
            results.append((cmd, "ok" if r.returncode == 0
                            else f"exit {r.returncode} — skipped (regenerator failed, not fatal)"))
        except (OSError, subprocess.SubprocessError) as exc:
            results.append((cmd, f"error: {exc} — skipped (not fatal)"))
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="report only — never write or regenerate")
    ap.add_argument("--no-regen", action="store_true",
                    help="detect + report, but do NOT auto-run the regenerators")
    args = ap.parse_args()
    try:
        drift, regen = reconcile()
        if not drift and not regen:
            print("[index-clean] no index drift detected this session")
            return 0
        for line in drift:
            print(line)
        if regen:
            print(f"[index-regen-plan] {len(regen)} idempotent regenerator(s) relevant:")
            for cmd, reason in regen:
                print(f"  -> {cmd}  ({reason})")
            # S3: auto-run the idempotent regenerators unless suppressed
            if not args.dry_run and not args.no_regen:
                print("[index-regen-run] executing (guarded — one failure never aborts close):")
                for cmd, status in execute_regen(regen):
                    print(f"  [OK] {cmd} -> {status}")
            else:
                print("[index-regen-skip] dry-run/no-regen — plan above is advisory only")
        if not drift:
            print("[index-clean] no missing/stale entries")
    except Exception as exc:  # noqa: BLE001 — fail-safe: never crash a Stop hook
        print(f"[index-reconcile-error] {exc} — skipped (session close not blocked)",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
