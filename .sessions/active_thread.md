task: T-054 · Eliminate mobile/PC logic-drift (daily-reports + workspace) — single-source logic, CSS-only responsive
phase: done
next: user to browser-verify OT toggle + DC buttons on real mobile (authed page); optional separate task — audit page-components/daily-reports/mobile/ leftover files (DailyReportForm/UploadDialog/ExcelImportModal — possible duplicates of components/).

## Summary (2026-07-13)
- S1 · SHIFT_DEFAULT_TIMES const shared by WorkerTableRow (desktop) + WorkerMobileCard (mobile); removed mobile OT "requires regular" gate (the reported bug); unified otMorning default 08:00-12:00 -> 06:00-08:00 (user-confirmed)
- S2 · DC header responsive (flexDirection xs:column/md:row, full-width button on xs)
- S3 · bucketedColumns useMemo shared by both workspace kanban branches (killed allMobileColTasks/allColumnTasks/mobileHiddenTasks forks)
- S4 · git rm 3 dead files (mobile/create.tsx, DailyReportEntryModal.tsx, DailyReportDashboard.tsx); index_files.json synced (-3)
- +drift#3 · bulk OT picker defaults wired to SHIFT_DEFAULT_TIMES (found during verify, user-confirmed)
- Plan skeptical-reviewed (revise -> go) before execution
- tsc EXIT=0 · 0 dangling refs · index_files.json valid JSON
- NOT DONE by assistant: browser behavioral test (authed page, cannot log in per security policy)

prev_done: T-053 (bug fix + verified), T-049 (verified), T-047/T-048 (verified).
