# MECE Plan: API Cache & Loading Spinner Flow

**[✓ MECE]** Goal: Verify and implement API cache invalidation and screen-center loading spinner flow across Workspace, Daily Report, and Backlog.

- [X] Section 1 — Diagnose:
    Steps:
      - [A] Inspect existing implementation of cache (`useTaskCacheStore`, `dailyReportService`) and how they interface with pages.
      - [B] Check how `globalSync` is triggered and handled in `Layout.tsx`, `workspace/index.tsx`, `daily-reports/index.tsx`.
      - [C] Verify how pages load initial data (e.g. skeleton vs spinner) and where they submit/save data (checking if Spinner is active).
    DoD: Blast radius mapped, files to modify confirmed.
    Est: 15m
    Verify: Run type-check to confirm current codebase is clean.
    Rollback: N/A (Read-only phase).

- [X] Section 2 — Edit & Verify:
    Steps:
      - [D] Modify `Layout.tsx` to pre-load task cache on login in the background.
      - [E] Modify `workspace/index.tsx` to use screen-center spinner during `globalSync` (instead of silent reload).
      - [F] Verify/modify `daily-reports/index.tsx` to correctly invalidate cache and show spinner on submit/save.
      - [G] Modify `daily-reports/list.tsx` to listen to `globalSync`, show screen-center spinner, and invalidate backlog query.
      - [H] Update backlog page's save handlers in `list.tsx` to clear `dailyReportService` cache on save/edit.
    DoD: Cache invalidation on save, login cache pre-load, and sync spinner implemented across all pages.
    Est: 45m
    Verify: Run `npm run type-check` and verify no syntax or type errors in modified files.
    Rollback: Revert modifications using Git or file tools.

- [X] Section 3 — Sync & Close:
    Steps:
      - [I] Run `python scripts/symbol_indexer.py` to sync symbols.
      - [J] Update roadmap task `T-001-001-06` to `[X]` done.
      - [K] Update `active_thread.md` to `phase: done`.
    DoD: Code compiled, indexed, and roadmap marked completed.
    Est: 10m
    Verify: `npm run build` succeeds, index synced.
    Rollback: N/A.
