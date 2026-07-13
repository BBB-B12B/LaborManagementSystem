skill_name: editor
CFP_COUNT: 47
task: T-054 · Eliminate mobile/PC logic-drift (daily-reports + workspace) — single-source logic, CSS-only responsive

sections_done: S1 (shared shift-cell rules + OT drift fix), S2 (DC header responsive), S3 (bucketedColumns memo), S4 (delete 5 dead files), S5 (verify + index sync)
mece_plan_hash: (cleared at close via PATH A)

objective: Remove duplicated mobile/PC logic that drifts; keep ONE logic set, differ only by CSS/responsive layout (daily-reports + workspace).

outcome: DONE. Changes:
  - frontend/src/pages/daily-reports/index.tsx: SHIFT_DEFAULT_TIMES const (~line 110) shared by WorkerMobileCard + WorkerTableRow; removed mobile-only OT "requires regular" gate (the reported bug); ALL shift-time-default literals wired to the const (26 uses; literals live only in the const def); unified otMorning default 08:00-12:00 → 06:00-08:00 (user-confirmed override); DC header responsive (flexDirection xs:column/md:row + full-width button on xs). Leave-time literals ('time:'/'leaveTimes' 08:00-17:00) intentionally NOT wired — semantically distinct from shift.
  - frontend/src/pages/workspace/index.tsx: bucketedColumns useMemo shared by BOTH kanban branches (killed allMobileColTasks/allColumnTasks/mobileHiddenTasks forks; mobileHiddenTasks→hiddenTasks).
  - Deleted 5 dead files: pages/daily-reports/mobile/create.tsx, page-components/daily-reports/mobile/DailyReportEntryModal.tsx, page-components/daily-reports/components/{DailyReportDashboard,DailyReportUploadDialog,ExcelImportModal}.tsx (all 0 external refs).
  - knowledge/index_files.json synced (-5 entries; valid JSON; 0 dangling refs).
  - docs/master_roadmap.md: T-054 §6.2 completion block.

validation: `cd frontend && npx tsc --noEmit` EXIT=0 · `npm run build` EXIT=0 (Node 20, 33/33 static pages, /daily-reports + /workspace built) · index_files.json valid JSON · plan skeptical_reviewer revise→go · artifact scrutinize 4-pass done.

not_done_by_assistant: browser behavioral test on the authed mobile page (OT toggle w/o regular · DC buttons · board columns) — assistant cannot log in per security policy; user to verify on device.

next: commit staged (T-054 only, tree clean). Push to main triggers Cloudflare + Firebase deploy → awaits explicit user go. Related open item: task_641cb094 (fix CFP-044 review-gate for plugin-only + Thai verify verbs) — separate session.
