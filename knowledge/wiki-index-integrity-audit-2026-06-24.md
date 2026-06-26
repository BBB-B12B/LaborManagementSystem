# LLM-Wiki Index Integrity Audit — add/edit/delete sync

> Audit note. Captured 2026-06-24. Question: does the index + backlink system stay
> perfectly in sync with real files across ADD/EDIT/DELETE/RENAME? Answer (at audit time): NO — the
> add side leaks permanently. Diagnosis verified by direct code inspection (not just rules).
>
> **UPDATE 2026-06-25 — FIXED (T-269 shipped).** The ADD leak is closed and went further than the
> original plan: the reconciler is now **authoritative over disk reality** under one rule — *disk is the
> single source of truth*. It auto-ENROLLs any indexable file present on disk but missing a card, and
> auto-PRUNEs any card whose file is gone. Enroll/prune are disjoint by the disk rule → idempotent.
> Verified: index 139 → 208 (enroll 71 · prune 2) · idempotent x3 (0/0/0) · `--check` exit 0.
> Sections below are kept as the historical diagnosis. EDIT/RENAME hardening (T-270/T-271/T-272) still open.

## Headline
- Repo = 279 git-tracked files · index_files.json = 136 entries · **76 tracked content files missing**, 0 stale.
- DELETE works (enforced). ADD leaks (honor-system, no script behind it). EDIT drifts (topics never re-extracted). RENAME is asymmetric (delete blocks, add doesn't enroll → ghost-prone).

## Verified root cause
- `scripts/index_reconcile.py:59` detects via `git status --porcelain` = working-tree, THIS session only. Files committed in prior sessions never reappear → never flagged.
- `index_reconcile.py:262` & `:384`: a missing file only does `drift.append("[index-drift] missing entry ...")` — **it reports, it never enrolls.** No component anywhere inserts a new index entry.
- The R8 rule (Implement/03_config.md:358) maps file-created → "index_manager mode:file" = a MANUAL agent step, no script. Enrollment depends on the agent remembering every time — the exact thing CFP history shows agents skip.
- Regenerators (backlink_analyzer / rule_indexer / code_graph / symbol_indexer) only touch keys ALREADY in the index → they fill fields, never add rows. `rule_indexer.py:158` even silently skips rule-bearing files not in index (the gap hides itself).

## Operation coverage matrix
| Op | Enforced? | Gap |
|---|---|---|
| ADD | ❌ honor-system | no enroll script; detector reads porcelain(this-session) → committed adds leak forever |
| EDIT | ⚠ partial | regenerators rerun, but description/topics never re-extracted → `related[]` computed from stale topics (garbage-in) |
| DELETE | ✅ | `--check` exits 2 on deleted-but-still-indexed → blocks close (why 0 stale) |
| RENAME | ⚠ half | delete side blocks, add side doesn't enroll → ghost-prone |

## Other silent leaks
1. New file committed same turn it's created → never re-enters porcelain → permanent leak (the 76).
2. `HARNESS_SKIP_INDEX_BLOCK=1` + fail-safe exit 0 → adds slip through silently.
3. backfill_knowledge_index.py wired to ZERO hooks + needs an agent extract pass → summary/key_claims perpetually empty for new entries.
4. Stop-hook reconcile runs `2>/dev/null`, fail-safe exit 0 → a crash = silent no-op at close.

## Fix plan (prioritized)
**Core (closes the 76-gap, makes ADD/RENAME automatic) — ✅ SHIPPED 2026-06-25:**
1. ✅ DONE — `index_reconcile.py` now ENROLLs: for each indexable file present on disk but missing a card, insert a stub `{description:"", topics:{major:[],minor:[]}, backlinks:[],references:[],related:[]}`, then run regenerators. The `[index-drift] missing entry` print became a real insert.
2. ✅ DONE — and went further than `git ls-files`: the detector is now **disk reality** (`os.path.exists`), so it also auto-PRUNEs cards whose file is gone. `git ls-files` alone would have re-added unstaged-deletion files (idempotency loop); the disk rule makes enroll/prune disjoint → idempotent.

**Secondary (roadmap):**
3. Two-phase enroll: stub (0 tokens) → flag `description==""` → Stop-hook queues `backfill --extract` → surface `[backfill-pending] N`.
4. Re-extract topics on EDIT before backlink_analyzer (kill stale-topic drift).
5. Wire backfill_knowledge_index into Stop/close.
6. Guard silent crash: emit `[index-reconcile-CRASHED]` instead of fail-safe no-op.

## Bottom line
Delete works because it is ENFORCED by a blocking check; add leaks because it is HONOR-SYSTEM with no code behind it and the only detector reads the wrong source. Make the reconciler authoritative over `git ls-files` and enrollment becomes structural, not remembered.

## Related
- knowledge/karpathy-llm-wiki-pattern-2026-06-24.md (lint/health concept)
- scripts/index_reconcile.py · scripts/backlink_analyzer.py · scripts/backfill_knowledge_index.py
