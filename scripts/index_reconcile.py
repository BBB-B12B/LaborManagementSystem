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
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(REPO, "knowledge", "index_files.json")
MANIFEST = os.path.join(REPO, ".agents", "skills", "skill-manifest.json")

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
                   # T-215: skills bucketed 2 levels deep — keep BOTH so flat+nested resolve
                   ".agents/skills/*/*/SKILL.md", ".agents/skills/*/*/SKILL_detail.md",
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


def git_tracked_files():
    """Return list of ALL git-tracked file paths (committed + staged), repo-relative.
    Unlike git_changes() (this-session working tree only), this sees every tracked
    file — so a file committed in a PRIOR session is visible and can be enrolled.
    This is the authoritative source for ADD coverage (T-269). Best-effort."""
    try:
        out = subprocess.run(["git", "-C", REPO, "ls-files"],
                             capture_output=True, text=True, timeout=15)
        if out.returncode != 0:
            return []
    except (OSError, subprocess.SubprocessError):
        return []
    return [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]


def enroll_missing(dry_run=False):
    """T-269: make the index AUTHORITATIVE over the working tree — ADD and DELETE both
    ENFORCED, not remembered. Computed against every indexable file that ACTUALLY EXISTS
    (git ls-files ∪ this-session untracked/modified) vs every index key:

      ENROLL — an existing indexable file (tracked OR uncommitted-new) absent from the
               index gets a stub entry. Empty description("") flags it for a later
               backfill --extract pass; the present key lets the field-only regenerators
               (backlink_analyzer etc.) populate related[]. Closes BOTH the pre-committed
               leak (porcelain never saw prior-session commits) AND the uncommitted gap.
      PRUNE  — an index key whose file is gone from disk AND untracked is removed, so a
               deleted/renamed file leaves no ghost entry.

    Returns (enrolled, pruned, wrote). Writes ONLY when not dry_run and there is a change.
    Index written indent=2/ensure_ascii=False (canonical). PRUNE is skipped entirely when
    `git ls-files` came back empty — never delete on a failed git signal. Fail-safe: any
    I/O error → (…, …, False), never raises."""
    keys = load_index_keys()
    tracked = git_tracked_files()
    changes = git_changes()
    # DISK REALITY is the single authority: an index entry should exist iff the file
    # exists on disk AND is indexable. Build the present-set from tracked ∪ untracked,
    # then keep only paths that ACTUALLY EXIST (drops a tracked-but-deleted file so it is
    # never re-enrolled — the bug that made enroll and prune flip-flop forever).
    present = set(tracked) | {p for p, st in changes.items() if st != "deleted"}
    present = {p for p in present
               if is_indexable(p) and os.path.exists(os.path.join(REPO, p))}
    missing = sorted(p for p in present if p not in keys)
    # stale: an indexed key whose file is GONE from disk (covers committed-gone,
    # renamed-away, and unstaged-deleted in one rule). Guarded by a non-empty tracked
    # list so a failed `git ls-files` can never trigger a mass prune. present (on-disk)
    # and stale (off-disk) are disjoint by construction → enroll/prune is idempotent.
    # (A `git checkout` that restores a file simply re-enrolls it next run — self-heals.)
    stale = (sorted(k for k in keys if not os.path.exists(os.path.join(REPO, k)))
             if tracked else [])
    if (not missing and not stale) or dry_run:
        return missing, stale, False
    try:
        with open(INDEX, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return missing, stale, False
    for p in missing:
        # fresh dict per path — no shared-reference aliasing between entries
        data[p] = {"description": "", "topics": {"major": [], "minor": []},
                   "backlinks": [], "references": [], "related": []}
    for k in stale:
        data.pop(k, None)
    try:
        with open(INDEX, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
    except OSError:
        return missing, stale, False
    return missing, stale, True


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


def _skill_handoff_blocks():
    """Map SKILL.md relpath -> set of downstream names declared in its `## hand-off`
    block (the ARTIFACT hand-off block, NOT `## hand-off (index)`). SKILL.md is the
    single source of truth (T-217); the manifest hand_off[] is a mirror of this."""
    out = {}
    for p in glob.glob(os.path.join(REPO, ".agents/skills/**/SKILL.md"), recursive=True):
        rel = os.path.relpath(p, REPO)
        try:
            with open(p, encoding="utf-8") as fh:
                lines = fh.read().splitlines()
        except OSError:
            continue
        in_block, downs = False, set()
        for ln in lines:
            if ln.strip() == "## hand-off":          # exact — excludes "## hand-off (index)"
                in_block = True
                continue
            if in_block:
                if ln.startswith("## "):              # next header ends the block
                    in_block = False
                    continue
                m = re.match(r"\s*downstream:\s*(\S+)", ln)
                if m:
                    downs.add(m.group(1))
        if downs:
            out[rel] = downs
    return out


def _manifest_handoff():
    """Map producer SKILL.md relpath -> set of downstream names from manifest hand_off[]."""
    out = {}
    try:
        with open(MANIFEST, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return out

    def walk(o):
        if isinstance(o, dict):
            if "hand_off" in o and "path" in o and isinstance(o["hand_off"], list):
                downs = {h.get("downstream") for h in o["hand_off"]
                         if isinstance(h, dict) and h.get("downstream")}
                if downs:
                    out[o["path"]] = downs
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    return out


def handoff_consistency_lines():
    """T-217: SKILL.md `## hand-off` blocks are the single source of truth. Flag any
    drift where the manifest hand_off[] mirror disagrees (missing / extra / different
    downstream). FLAG-ONLY — manifest edits are judgment-type, never auto-applied."""
    try:
        skill = _skill_handoff_blocks()
        manifest = _manifest_handoff()
    except Exception:
        return []  # fail-safe — never block session close
    lines = []
    for path in sorted(set(skill) | set(manifest)):
        s, m = skill.get(path, set()), manifest.get(path, set())
        if s and not m:
            lines.append(f"[handoff-drift] {path}: SKILL.md declares hand-off -> "
                         f"{sorted(s)} but manifest has no hand_off[] entry")
        elif m and not s:
            lines.append(f"[handoff-drift] {path}: manifest hand_off[] -> {sorted(m)} "
                         f"but SKILL.md has no `## hand-off` block")
        elif s != m:
            lines.append(f"[handoff-drift] {path}: downstream mismatch — "
                         f"SKILL.md {sorted(s)} vs manifest {sorted(m)}")
    return lines


# history / changelog files where naming a JUST-deleted skill is LEGITIMATE (we record
# the deletion there) — never flag these as stale doc-prose refs.
_STALE_NAME_EXCLUDE = ("master_roadmap.md", "reflections.md", "CODING_FAILURE_PATTERNS.md",
                       "cfp_archive.md", "self_improve_log.md", "session_handoff.md")


def stale_skillname_refs(changes):
    """T-252 (closes CFP-043): index/backlink sync is blind to free-text doc prose, so a
    deleted/renamed skill NAME can linger in docs (it orphaned ~9 docs in T-238). When a
    skill dir was deleted THIS session, grep the repo for the leftover name. The
    'deleted this session' guard keeps it tight — historical mentions of OTHER past
    deletions never trigger. FAIL-SAFE: any error → [] (never block close)."""
    try:
        names = set()
        for path, st in changes.items():
            if st == "deleted" and path.startswith(".agents/skills/") and "/SKILL" in path:
                parts = path.split("/")            # .agents/skills/<bucket>/<name>/SKILL.md
                if len(parts) >= 4:
                    names.add(parts[-2])
        lines = []
        for name in sorted(names):
            try:
                # prose-only (.md): CFP-043 is about doc TEXT, not generated JSON/JSONL indexes.
                # Exclude dated history files (both _YYYY and -YYYY- naming) + known logs.
                r = subprocess.run(
                    ["grep", "-rl", "--include=*.md",
                     "--exclude-dir=.git", "--exclude-dir=.sessions",
                     "--exclude-dir=node_modules", "--exclude-dir=research",
                     "--exclude=*_2026*", "--exclude=*-2026-*",
                     "--exclude=optimization_logs.md", name, REPO],
                    capture_output=True, text=True, timeout=20)
                hits = [os.path.relpath(h.strip(), REPO) for h in r.stdout.splitlines()
                        if h.strip() and os.path.basename(h.strip()) not in _STALE_NAME_EXCLUDE]
                if hits:
                    lines.append(f"[index-drift] stale skill-name '{name}' (dir deleted) still "
                                 f"referenced in {len(hits)} live file(s): {', '.join(hits[:4])}")
            except (OSError, subprocess.SubprocessError):
                continue
        return lines
    except Exception:  # noqa: BLE001 — fail-safe: never crash a Stop hook
        return []


def reconcile(dry_run=False):
    """Return (drift_lines, regen_plan). regen_plan = list of (cmd, reason)."""
    changes = git_changes()
    drift, regen = [], []

    # T-269: ENROLL pass FIRST — authoritative over `git ls-files` (every tracked file),
    # not just this-session porcelain. Inserts a stub for any indexable tracked file
    # missing from the index, so a file committed in a prior session can never leak
    # forever. Runs only on the main/Stop path (never in --check, which is read-only).
    enrolled, pruned, wrote = enroll_missing(dry_run=dry_run)
    keys = load_index_keys()  # re-read AFTER enroll/prune so the set is current
    if enrolled:
        verb = "enrolled" if wrote else "would enroll (dry-run)"
        head = ", ".join(enrolled[:5]) + (" …" if len(enrolled) > 5 else "")
        drift.append(f"[index-enrolled] {verb} {len(enrolled)} missing file(s): {head}")
    if pruned:
        verb = "pruned" if wrote else "would prune (dry-run)"
        head = ", ".join(pruned[:5]) + (" …" if len(pruned) > 5 else "")
        drift.append(f"[index-pruned] {verb} {len(pruned)} stale entry(ies): {head}")
    if wrote:
        # enrolled stubs have empty related[]; a prune can leave dangling links → refresh
        regen.append(("python3 scripts/backlink_analyzer.py",
                      f"index changed (+{len(enrolled)}/-{len(pruned)}) — related[] may be stale"))

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
    # hand-off SKILL.md <-> manifest consistency — flag only (manifest = judgment-type · T-217)
    drift.extend(handoff_consistency_lines())
    # T-252: stale doc-prose refs to a skill dir deleted this session (CFP-043) — HARD drift
    drift.extend(stale_skillname_refs(changes))
    # dedupe regen by command (enroll + changed-path logic may both request
    # backlink_analyzer) — running it once is enough (idempotent, but avoid waste)
    seen, deduped = set(), []
    for cmd, reason in regen:
        if cmd not in seen:
            seen.add(cmd)
            deduped.append((cmd, reason))
    return drift, deduped


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


def session_close_guard(dry_run=False):
    """T-199: auto-heal session close at Stop, the same rhythm as backlink/symbol/repo_map.

    Fire session_close.py --record-only ONCE when active_thread phase==done AND no
    session_*.json detail file yet records this task. The 'already recorded?' check is
    the guard — it makes the call idempotent (re-run every turn = no-op, no spam) and
    --record-only means NO token reset / handoff rewrite. Fail-safe: never blocks close.
    """
    try:
        at = os.path.join(REPO, ".sessions", "active_thread.md")
        if not os.path.exists(at):
            return ["[session-close-skip] no active_thread.md"]
        phase = task = None
        with open(at, encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("phase:"):
                    phase = line.split(":", 1)[1].strip()
                elif line.startswith("task:"):
                    task = line.split(":", 1)[1].strip()
        if phase != "done":
            return [f"[session-close-skip] phase={phase or 'unknown'} — not done"]
        if not task:
            return ["[session-close-skip] no task in active_thread.md"]
        # guard: already recorded in a detail file? → no-op (idempotent)
        for p in glob.glob(os.path.join(REPO, ".sessions", "session_*.json")):
            try:
                with open(p, encoding="utf-8") as fh:
                    if json.load(fh).get("task", "").strip() == task:
                        return [f"[session-close-skip] already recorded: {task[:50]}"]
            except (OSError, ValueError):
                continue
        if dry_run:
            return [f"[session-close-fire] would record (dry-run): {task[:50]}"]
        r = subprocess.run(
            ["python3", "scripts/session_close.py", "--record-only", "--task", task],
            cwd=REPO, capture_output=True, text=True, timeout=30)
        status = "ok" if r.returncode == 0 else f"exit {r.returncode}"
        return [f"[session-close-fire] recorded ({status}): {task[:50]}"]
    except Exception as exc:  # noqa: BLE001 — fail-safe: never crash a Stop hook
        return [f"[session-close-error] {exc} — skipped (close not blocked)"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="report only — never write or regenerate")
    ap.add_argument("--no-regen", action="store_true",
                    help="detect + report, but do NOT auto-run the regenerators")
    ap.add_argument("--check", action="store_true",
                    help="T-252: read-only HARD-drift gate for the PreToolUse close-gate — no "
                         "regen, no writes. exit 2 if unhealed index/doc-ref drift, else 0. "
                         "Fail-safe: any internal error → exit 0 (never block on our own bug).")
    args = ap.parse_args()

    # T-252 close-gate path: fast + read-only + NO side effects (deliberately does NOT call
    # reconcile(), which would trigger repo_map_check.py --sync writes). Detects only HARD
    # drift — un-indexed new/modified files, stale deleted entries, and stale skill-name
    # doc-refs — then exit 2 so the close-gate can block the `phase: done` write.
    if args.check:
        try:
            changes = git_changes()
            keys = load_index_keys()
            hard = []
            for path, st in sorted(changes.items()):
                if not is_indexable(path):
                    continue
                # block ONLY on genuinely NEW un-indexed files — a "modified" file absent from
                # index_files.json is a pre-existing index gap this task did not create, so
                # blocking on it would fire on nearly every edit (the over-block trap · T-252).
                if st == "new" and path not in keys:
                    hard.append(f"[index-drift] missing entry: {path} (new) — not in index_files.json")
                elif st == "deleted" and path in keys:
                    hard.append(f"[index-drift] stale entry: {path} (deleted) — still in index_files.json")
            hard.extend(stale_skillname_refs(changes))
            for line in hard:
                print(line, file=sys.stderr)
            if hard:
                print("[index-blocked] unhealed index/doc-ref drift — run "
                      "`python3 scripts/index_reconcile.py` to heal, then retry "
                      "(or set HARNESS_SKIP_INDEX_BLOCK=1 to override).", file=sys.stderr)
                return 2
            return 0
        except Exception as exc:  # noqa: BLE001 — fail-safe: never block on our own error
            print(f"[index-reconcile-error] {exc} — --check skipped (not blocking)", file=sys.stderr)
            return 0

    try:
        drift, regen = reconcile(dry_run=args.dry_run)
        # T-199: auto-heal session close (guarded · idempotent) — runs even when the
        # index is clean, since a no-file-change session still needs its record.
        for line in session_close_guard(dry_run=args.dry_run):
            print(line)
        if not drift and not regen:
            print("[index-clean] no index drift detected this session")
            return 0
        for line in drift:
            print(line)
        if regen:
            print(f"[index-regen-plan] {len(regen)} idempotent regenerator(s) relevant:")
            for cmd, reason in regen:
                print(f"  → {cmd}  ({reason})")
            # S3: auto-run the idempotent regenerators unless suppressed
            if not args.dry_run and not args.no_regen:
                print("[index-regen-run] executing (guarded — one failure never aborts close):")
                for cmd, status in execute_regen(regen):
                    print(f"  ✓ {cmd} → {status}")
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
