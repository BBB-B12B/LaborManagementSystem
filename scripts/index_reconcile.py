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
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness_paths

# PROJECT data (index, registry, git repo, .sessions, repo file scans) vs ENGINE
# resources (.agents manifest + SKILL.md glob + regenerator SCRIPT paths).
REPO = str(harness_paths.project_root())
ENGINE = str(harness_paths.engine_root())
INDEX = os.path.join(REPO, "knowledge", "index_files.json")
REGISTRY = os.path.join(REPO, "knowledge", "topic_registry.json")
MANIFEST = os.path.join(ENGINE, ".agents", "skills", "skill-manifest.json")

# paths that should NEVER count as index drift (transient / self / generated)
EXCLUDE_PREFIX = (".sessions/", ".git/", "node_modules/", "memory/", "skills/")
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
    # S5: prune keys whose file is GONE, PLUS any macOS AppleDouble / .DS_Store ghost
    # that a non-filtering writer (e.g. code_graph's os.walk) leaked in. is_indexable
    # already rejects these on enroll; this makes the reconciler the single gatekeeper
    # that also EVICTS them every run. Guarded by non-empty `tracked` (no mass-prune on a
    # failed git signal). Basename-exact match — never a broad "._" substring.
    def _macos_ghost(k):
        b = os.path.basename(k)
        return b.startswith("._") or b == ".DS_Store"
    stale = (sorted(k for k in keys
                    if not os.path.exists(os.path.join(REPO, k)) or _macos_ghost(k))
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
        # T-271: backfill_pending flags the empty-description stub for a later
        # backfill --extract pass (an AI-in-the-loop step; the Stop hook only counts it)
        data[p] = {"description": "", "topics": {"major": [], "minor": []},
                   "backlinks": [], "references": [], "related": [],
                   "backfill_pending": True}
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


def _crashed(where, exc):
    """T-272: a core reconcile/drift step hit an unexpected crash. Stay non-fatal
    (caller still returns []/0 — never crash a Stop hook, never break the --check 0/2
    contract) but SURFACE it loudly on stderr: a swallowed crash makes a broken index
    look 'clean' at session close. Advisory-only failures use [index-advisory-skip]."""
    print(f"[index-reconcile-CRASHED] {where}: {type(exc).__name__}: {exc}", file=sys.stderr)


def repo_map_drift_lines():
    """Auto-sync: run repo_map_check.py --sync (always exits 0). The AUTO structure
    block (folders incl. nested + per-folder file counts), content-rename carries
    (git -M), and TODO placeholders for genuinely-new items are applied automatically.
    This is safe to auto-run because --sync only ever touches the marker-delimited
    AUTO block + adds placeholder rows — curated descriptions live OUTSIDE the markers
    and are NEVER overwritten (T-185 / T-190). Returns the meaningful action lines
    (residual drift, renames carried, placeholders added) for session-close visibility."""
    try:
        r = subprocess.run(["python3", os.path.join(ENGINE, "scripts", "repo_map_check.py"), "--sync"],
                           cwd=REPO, capture_output=True, text=True, timeout=30)
        return [ln for ln in r.stdout.splitlines()
                if ln.startswith(("[repo-map-drift]", "[repo-map-rename]", "[repo-map-append]"))]
    except (OSError, subprocess.SubprocessError) as exc:
        _crashed("repo_map_drift_lines (repo_map_check.py --sync)", exc)
        return []  # fail-safe — never block session close (crash surfaced above)


def _skill_handoff_blocks():
    """Map SKILL.md relpath -> set of downstream names declared in its `## hand-off`
    block (the ARTIFACT hand-off block, NOT `## hand-off (index)`). SKILL.md is the
    single source of truth (T-217); the manifest hand_off[] is a mirror of this."""
    out = {}
    for p in glob.glob(os.path.join(ENGINE, ".agents/skills/**/SKILL.md"), recursive=True):
        rel = os.path.relpath(p, ENGINE)
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
    except Exception as exc:  # noqa: BLE001
        _crashed("handoff_consistency_lines", exc)
        return []  # fail-safe — never block session close (crash surfaced above)
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
    except Exception as exc:  # noqa: BLE001 — fail-safe: never crash a Stop hook
        _crashed("stale_skillname_refs", exc)
        return []


def find_untagged(extra_new=()):
    """T-306: produce-side tag-gap detector — feeds the [tag-needed] drift lines.
    Returns NEW indexable files whose index entry lacks topic_map/coverage — the §5 T1
    tagging only the AI can author, which enroll_missing's skeleton never writes. Candidate set = porcelain "new" ∪ extra_new
    (files enrolled this run): a same-session commit hides porcelain-new, so porcelain
    alone would let a committed file escape forever (the pre-committed leak, produce
    side). A candidate not yet in the index is skipped — the [index-drift] missing-entry
    line already covers it. Read-only. Fail-safe: any error → [] (never crash a Stop hook)."""
    try:
        changes = git_changes()
        cand = {p for p, st in changes.items() if st == "new"}
        cand |= set(extra_new or ())
        cand = {p for p in cand if is_indexable(p)}
        if not cand:
            return []
        with open(INDEX, encoding="utf-8") as fh:
            idx = json.load(fh)
        out = []
        for p in sorted(cand):
            meta = idx.get(p)
            if not isinstance(meta, dict):
                continue
            if not meta.get("topic_map") or not meta.get("coverage"):
                out.append(p)
        return out
    except Exception as exc:  # noqa: BLE001 — advisory only
        print(f"[index-advisory-skip] find_untagged: {exc}", file=sys.stderr)
        return []


def reconcile(dry_run=False):
    """Return (drift_lines, regen_plan). regen_plan = list of (cmd, reason)."""
    changes = git_changes()
    # T-357: skip-when-clean. A completely clean working tree (nothing changed this
    # session) has nothing new to enroll / flag / regenerate — short-circuit BEFORE
    # enroll_missing's full `git ls-files` scan (the always-on Stop cost). T-269 backfill
    # is PRESERVED: a prior-session index leak is still caught at the next Stop that
    # changes any file (a clean Stop = no new work, so the backfill is delayed, never
    # lost). session_close_guard + hook-drift heal in main() run regardless (they do NOT
    # go through reconcile). --check never calls this. Fail-safe: git_changes() returns
    # {} on any git error, so an error path also skips here — but that loses nothing,
    # because enroll_missing's own `git ls-files` would fail on the same error and
    # enroll nothing anyway; we just avoid the failed-subprocess spam. Transient git
    # errors self-heal on the next Stop with working git.
    if not changes:
        print("[index-reconcile] clean — skipped full scan (no working-tree change)")
        return [], []
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

    # T-306: create-time tagging forcing function — a NEW indexable file whose entry
    # lacks topic_map/coverage is FLAGGED, never silently counted clean. Lives on the
    # drift list so it prints to STDOUT: the Stop-hook invokes this script with
    # `2>/dev/null` (.claude/settings.json), so anything on stderr would be swallowed.
    for p in find_untagged(extra_new=enrolled):
        drift.append(f"[tag-needed] file:{p} — new file has no topic_map/label "
                     "(run topic_facet_schema.md §5 T1 tagging)")

    indexable = {p: st for p, st in changes.items() if is_indexable(p)}
    for path, st in sorted(indexable.items()):
        if st in ("new", "modified") and path not in keys:
            drift.append(f"[index-drift] missing entry: {path} ({st}) — not in index_files.json")
        elif st == "deleted" and path in keys:
            drift.append(f"[index-drift] stale entry: {path} (deleted) — still in index_files.json")

    # T-270: a knowledge/*.md whose CONTENT changed this session may carry topics that
    # no longer match its text → flag for re-tagging. ADVISORY only — topic assignment is
    # judgment-type (topic_facet schema), NEVER auto-mutated (auto-mapping free-form tags
    # onto the closed topic vocab would inject wrong topics — the silent-corruption T-268
    # guards against). Mirrors the [tag-needed] forcing function used for new files.
    try:
        with open(INDEX, encoding="utf-8") as _fh270:
            _idx270 = json.load(_fh270)
    except (OSError, ValueError):
        _idx270 = {}
    for path, st in sorted(indexable.items()):
        if st == "modified" and path.startswith("knowledge/") and path.endswith(".md"):
            _e = _idx270.get(path)
            _t = _e.get("topics", {}) if isinstance(_e, dict) else {}
            # legacy/malformed entries store topics as a list, not {major,minor} — guard
            if isinstance(_t, dict) and (_t.get("major") or _t.get("minor")):
                drift.append(f"[retag-needed] file:{path} — content changed; topics may be "
                             "stale (re-check topic_facet tagging before trusting related[])")

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

    # T-351: doc navigation maps (mini-TOC + labels_by_topic) self-heal at close when a long
    # doc changed — an edit shifts heading line numbers, so the map must regenerate. Idempotent
    # (unchanged docs are a no-op) + gated on doc changes; guarded by execute_regen (never fatal).
    docs_changed = [p for p in changes
                    if (p.startswith("Implement/") or p.startswith("docs/session_templates/"))
                    and p.endswith(".md") and os.path.basename(p) not in ("CLAUDE.md", "AGENTS.md")]
    if docs_changed:
        regen.append(("python3 scripts/gen_doc_labels.py --all",
                      f"{len(docs_changed)} long doc(s) changed (nav map/TOC may be stale)"))

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
        # regenerator SCRIPTS are ENGINE resources — resolve their path under ENGINE
        # while running with cwd=REPO (project data). Self-hosted: ENGINE==REPO, no-op.
        argv = [os.path.join(ENGINE, tok) if tok.startswith("scripts/") else tok
                for tok in argv]
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
            ["python3", os.path.join(ENGINE, "scripts", "session_close.py"),
             "--record-only", "--task", task],
            cwd=REPO, capture_output=True, text=True, timeout=30)
        status = "ok" if r.returncode == 0 else f"exit {r.returncode}"
        # T-358 (b): a recorded close is the safe point to clear the per-close
        # checklist ack. phase:done already passed the phase_gate close-gate, so
        # removing it here cannot false-block THIS close; the 'already recorded'
        # guard above makes this fire exactly once (never on a bare Stop), and the
        # dry_run/--check path returned above so a read-only scan never deletes it.
        try:
            os.remove(os.path.join(REPO, ".sessions", ".close_checklist_ack"))
        except OSError:
            pass
        return [f"[session-close-fire] recorded ({status}): {task[:50]}"]
    except Exception as exc:  # noqa: BLE001 — fail-safe: never crash a Stop hook
        return [f"[session-close-error] {exc} — skipped (close not blocked)"]


def check_labels():
    """T-305: label-integrity pass. Every per-file topic_map row `label` must be registered
    in topic_registry.json `labels_by_topic[topic_id]` (closed, reuse-first vocab). An orphan
    label (present on a file but never registered under its topic) → `[label-drift]`.
    Read-only. Returns a list of drift lines (empty = clean). Fail-safe: any error → [] (never block)."""
    lines = []
    try:
        with open(INDEX, encoding="utf-8") as fh:
            idx = json.load(fh)
        with open(REGISTRY, encoding="utf-8") as fh:
            reg = json.load(fh)
    except (OSError, ValueError) as exc:
        return [f"[label-check-error] {exc} — labels: skipped (not blocking)"]
    labels_by_topic = reg.get("labels_by_topic", {})
    for path, meta in idx.items():
        if not isinstance(meta, dict):
            continue
        for row in meta.get("topic_map", []):
            if not isinstance(row, dict):
                continue
            label = row.get("label")
            topic = row.get("topic")
            if not label:
                continue  # label is optional until a file is (re)tagged under §10
            if label not in labels_by_topic.get(topic, []):
                lines.append(f"[label-drift] file:{path} topic:{topic} label:{label!r} "
                             f"— not in labels_by_topic[{topic!r}] (register via §10 gate)")
    return lines


# ---- T-320 S2: label/topic hard-gate (folded into --check · scoped · OFF by default) ----
def _tag_gate_in_scope(path):
    """T-320: the tag-gate fires ONLY on knowledge/ doc files. Everything else —
    .sessions/, scratchpad, scripts/ code, tests, config, AND the tagging infra itself
    (topic_registry.json / index_files.json) — is hard-exempt so the gate can never
    deadlock its own registry writes or brick normal work."""
    if not path.startswith("knowledge/") or not path.endswith(".md"):
        return False
    base = os.path.basename(path)
    if base in ("topic_registry.json", "index_files.json"):  # infra (belt-and-suspenders)
        return False
    return True


def tag_gate_check(changes):
    """T-320 S2: contribute exit-2 lines for an UNTAGGED knowledge doc.

    Reuse-first + capability-preserving:
      - scope: knowledge/*.md only (see _tag_gate_in_scope) — deadlock/brick guard
      - T-252 intact: a tagged file is never blocked, even when modified
      - auto-tag path (agent-side, via tag_gate.resolve) reuses an existing topic/label
        first; the gate blocks only when a doc has NO major topic at all
      - OFF by default: dormant until HARNESS_TAG_GATE_ENFORCE=1 (flipped ON in S5,
        after the test matrix is green)
      - escape hatch: HARNESS_SKIP_TAG_GATE=1 forces a pass
    Read-only. Fail-safe: any error → [] (never block on our own bug)."""
    try:
        if os.environ.get("HARNESS_SKIP_TAG_GATE") == "1":
            return []
        # T-320 S5: enforcement is ON by default (flipped LAST, after the S5 test matrix
        # went green — scripts/tag_gate_test.py 7/7). Emergency off-switch: set
        # HARNESS_TAG_GATE_ENFORCE=0. Per-op escape hatch above: HARNESS_SKIP_TAG_GATE=1.
        if os.environ.get("HARNESS_TAG_GATE_ENFORCE") == "0":
            return []
        import tag_gate  # same scripts/ dir
        block = []
        for path, st in sorted(changes.items()):
            if st not in ("new", "modified"):
                continue
            if not _tag_gate_in_scope(path):
                continue
            if tag_gate.is_tagged(path):
                continue  # T-252: tagged (even if modified) → never block
            block.append(
                f"[tag-gate] file:{path} — untagged knowledge doc (no major topic). "
                "Register a topic+label (reuse-first via tag_gate.resolve / index_manager) "
                "then retry. Override: HARNESS_SKIP_TAG_GATE=1")
        return block
    except Exception as exc:  # noqa: BLE001 — fail-safe: never block on our own error
        print(f"[tag-gate-skip] {exc} (not blocking)", file=sys.stderr)
        return []


# ---- T-320 S4: delete-side orphan-label prune (conservative · backup · never-if-used) ----
def _label_refs(idx):
    """Map (topic, label) -> set of files that carry that label in a topic_map row.
    This is the ground truth of 'who still uses this label'."""
    refs = {}
    for path, meta in idx.items():
        if not isinstance(meta, dict):
            continue
        for row in meta.get("topic_map", []):
            if not isinstance(row, dict):
                continue
            t, l = row.get("topic"), row.get("label")
            if t and l:
                refs.setdefault((t, l), set()).add(path)
    return refs


def prune_orphan_labels(dry_run=True):
    """T-320 S4: GC labels in topic_registry whose LAST referencing file is gone.

    A label registered under labels_by_topic[T] but referenced by ZERO files' topic_map
    rows is an orphan → remove it. Deliberately conservative + reversible (destroying vocab
    is R14 territory):
      - a label still referenced by >=1 file is NEVER removed (the hard guard)
      - dry_run=True (default) only REPORTS — writing requires an explicit --apply
      - a timestamped backup of topic_registry.json is written BEFORE any mutation
      - human-invoked only (never wired into an automatic hook)
    Returns (pruned, report_lines). Fail-safe: any error → ([], [err line])."""
    try:
        with open(INDEX, encoding="utf-8") as fh:
            idx = json.load(fh)
        with open(REGISTRY, encoding="utf-8") as fh:
            reg = json.load(fh)
    except (OSError, ValueError) as exc:
        return [], [f"[prune-error] {exc} — prune skipped (no change)"]

    refs = _label_refs(idx)
    labels_by_topic = reg.get("labels_by_topic", {})
    pruned, report, kept = [], [], 0
    new_lbt = {}
    for topic, labels in labels_by_topic.items():
        survivors = []
        for lbl in labels:
            users = refs.get((topic, lbl), set())
            if users:
                survivors.append(lbl)
                kept += 1
            else:
                pruned.append((topic, lbl))
                report.append(f"[label-orphan] topic:{topic} label:{lbl!r} — 0 files reference it "
                              f"(prune candidate)")
        if survivors:
            new_lbt[topic] = survivors

    if not pruned:
        report.append(f"[prune-clean] no orphan labels · {kept} label(s) still in use")
        return [], report

    if dry_run:
        report.append(f"[prune-dry-run] {len(pruned)} orphan label(s) would be removed · "
                      f"{kept} kept · re-run with --apply to write (a backup is made first)")
        return pruned, report

    # --apply: backup FIRST, then write
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{REGISTRY}.bak-{ts}"
    shutil.copy2(REGISTRY, backup)
    reg["labels_by_topic"] = new_lbt
    with open(REGISTRY, "w", encoding="utf-8") as fh:
        json.dump(reg, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    report.append(f"[prune-applied] removed {len(pruned)} orphan label(s) · {kept} kept · "
                  f"backup: {os.path.basename(backup)}")
    return pruned, report


# ---- T-331: hook-list parity — auto-heal (default) + hard-block (--check) ----
def hook_drift_check():
    """T-331 (D): contribute an exit-2 line to --check when the two hook-lists drift.

    Read-only (never regenerates — the DEFAULT path heals; --check only reports).
    Hook drift is a repo-wide invariant (a hook registered in one list but not the
    other fires on only one consumption mode), so per the SR decision this blocks
    `phase: done` for ANY task while the lists diverge — not only hook-touching tasks.
    Escape: HARNESS_SKIP_PROPAGATION_BLOCK=1 (parity with HARNESS_SKIP_INDEX_BLOCK).
    hooks_sync.run_check() self-skips on a consumer machine (settings.json has no
    harness hooks), so this is master-repo-only. Fail-safe: any error → [] (never
    block on our own bug)."""
    try:
        if os.environ.get("HARNESS_SKIP_PROPAGATION_BLOCK") == "1":
            return []
        import hooks_sync  # same scripts/ dir — parity guard for the two hook-lists
        if hooks_sync.run_check() == 0:  # clean / consumer-skip / missing file
            return []
        return ["[hook-blocked] the two hook-lists diverge — run "
                "`python3 scripts/index_reconcile.py` to auto-heal, then retry "
                "(or set HARNESS_SKIP_PROPAGATION_BLOCK=1 to override)."]
    except Exception as exc:  # noqa: BLE001 — fail-safe: never block on our own bug
        _crashed("hook_drift_check (not blocking · returncode stays 0)", exc)
        return []


def heal_hook_drift():
    """T-331 (B): auto-heal hook-list drift on the DEFAULT/Stop path.

    When hooks_sync reports the two hook-lists diverge, regenerate hooks.json FROM
    settings.json (the single source) via gen_plugin_hooks — but to a temp path first,
    replacing the real file ONLY when the bytes actually change, so a clean tree is
    never churned (the user develops concurrently in this folder). Emits [hook-synced]
    on a real heal. The read path (--check) never calls this. Returns True if healed.
    Caller wraps this so any error is non-fatal (never crash a Stop hook)."""
    import hooks_sync  # same scripts/ dir
    if hooks_sync.run_check() == 0:  # no drift (or consumer / missing) — nothing to heal
        return False
    import gen_plugin_hooks  # same scripts/ dir — the single-source port
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    real = os.path.join(root, ".claude-plugin", "hooks.json")
    tmp = real + ".heal.tmp"
    saved = sys.argv
    sys.argv = [saved[0], os.path.join(root, ".claude", "settings.json"), tmp]
    try:
        gen_plugin_hooks.main()
    finally:
        sys.argv = saved
    try:
        new_bytes = open(tmp, "rb").read()
        old_bytes = open(real, "rb").read() if os.path.exists(real) else b""
        if new_bytes != old_bytes:
            os.replace(tmp, real)  # atomic
            print("[hook-synced] hooks.json regenerated from settings.json (drift healed)")
            return True
        return False
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def doc_map_drift_lines():
    """T-351: advisory — report long docs whose nav map is stale (TOC / line-ranges drifted).
    Read-only (runs gen_doc_labels.py --check, which writes nothing). NEVER hard-drift: the
    default close path regenerates it via reconcile(). Fail-safe: any error → [] (never block)."""
    try:
        argv = ["python3", os.path.join(ENGINE, "scripts", "gen_doc_labels.py"), "--check"]
        r = subprocess.run(argv, cwd=REPO, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return []
    out = []
    for line in r.stdout.splitlines():
        if "would-map" in line or line.startswith("[doc-map-skip]"):
            out.append("[doc-map-drift] " + line.strip())
    return out


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
    ap.add_argument("--check-labels", action="store_true",
                    help="T-305: read-only label-integrity pass. Report [label-drift] for any "
                         "per-file topic_map label not registered in labels_by_topic. Always exit 0 "
                         "(advisory · never blocks close).")
    ap.add_argument("--prune-labels", action="store_true",
                    help="T-320 S4: report orphan labels (registered but referenced by 0 files). "
                         "DRY-RUN unless --apply. Human-invoked only. exit 0.")
    ap.add_argument("--apply", action="store_true",
                    help="with --prune-labels: actually remove orphans (backup made first).")
    args = ap.parse_args()

    # T-320 S4 orphan-label prune: report-only unless --apply. Backup before any write.
    if args.prune_labels:
        _pruned, _report = prune_orphan_labels(dry_run=not args.apply)
        for line in _report:
            print(line)
        return 0

    # T-305 label-integrity path: read-only, advisory. Reports orphan labels; never blocks.
    if args.check_labels:
        drift = check_labels()
        for line in drift:
            print(line, file=sys.stderr)
        # T-306: split "untagged" from "clean" — a file with no topic_map has nothing
        # to label-check, and nothing-to-check is NOT clean (the false green).
        try:
            with open(INDEX, encoding="utf-8") as fh:
                idx = json.load(fh)
            entries = [m for m in idx.values() if isinstance(m, dict)]
            tagged = sum(1 for m in entries if m.get("topic_map"))
            untagged = len(entries) - tagged
        except (OSError, ValueError):
            tagged = untagged = None
        if not drift:
            if untagged is None:
                print("[label-check] labels: clean")
            elif untagged:
                print(f"[label-check] labels: clean (tagged: {tagged}) · "
                      f"untagged: {untagged} file(s) (no topic_map yet — §5 T1)")
            else:
                print(f"[label-check] labels: clean (tagged: {tagged} · all files tagged)")
        elif untagged is not None:
            print(f"[label-check] tagged: {tagged} · untagged: {untagged} · "
                  f"drift: {len(drift)}", file=sys.stderr)
        return 0

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
            hard.extend(tag_gate_check(changes))  # T-320 S2 (scoped · OFF until S5)
            hard.extend(hook_drift_check())       # T-331 (D): hook-list parity is a close-gate invariant
            for _dm in doc_map_drift_lines():      # T-351: advisory — nav-map staleness (healed at close, never blocks)
                print(_dm)
            for line in hard:
                print(line, file=sys.stderr)
            if hard:
                print("[index-blocked] unhealed index/doc-ref drift — run "
                      "`python3 scripts/index_reconcile.py` to heal, then retry "
                      "(or set HARNESS_SKIP_INDEX_BLOCK=1 to override).", file=sys.stderr)
                return 2
            return 0
        except Exception as exc:  # noqa: BLE001 — fail-safe: never block on our own error
            _crashed("--check (not blocking · returncode stays 0)", exc)
            return 0

    try:
        drift, regen = reconcile(dry_run=args.dry_run)
        # T-199: auto-heal session close (guarded · idempotent) — runs even when the
        # index is clean, since a no-file-change session still needs its record.
        for line in session_close_guard(dry_run=args.dry_run):
            print(line)
        # T-271: surface enrolled stubs still awaiting backfill enrichment (stdout
        # only — never affects the --check returncode contract the close-gate reads)
        try:
            with open(INDEX, encoding="utf-8") as _fh:
                _idx = json.load(_fh)
            _pending = sum(1 for _v in _idx.values()
                           if isinstance(_v, dict) and not _v.get("description"))
            if _pending:
                print(f"[backfill-pending] {_pending} entr(y/ies) need backfill "
                      "— run: python3 scripts/backfill_knowledge_index.py --extract")
        except (OSError, ValueError):
            pass
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
        _crashed("main (session close not blocked)", exc)
    try:
        # T-331 (B): was advisory-only run_check(); now AUTO-HEALS on real drift by
        # regenerating hooks.json from settings.json (diff-before-write · [hook-synced]).
        # heal_hook_drift() calls run_check() internally, so the [hook-drift]/[hook-info]
        # diagnostic still prints; a clean tree is a no-op (no churn).
        heal_hook_drift()
    except Exception as exc:  # noqa: BLE001 — never crash a Stop hook
        _crashed("hook-drift auto-heal", exc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
