skill_name: editor
CFP_COUNT: 46
task: T-049 (P1) — Workspace: gate For-Checking column on draft daily-report status + rename ซ่อน→จัดเก็บ + swap trash-can unarchive icon — CODE-COMPLETE + tsc-clean FE+BE (behavioral verify pending on device)

sections_done: S1 (backend denormalize), S2 (FE type), S3 (FE hook map), S4 (FE grouping gate + consolidate), S5 (rename labels), S6 (icon swap), S7 (tsc FE+BE)
mece_plan_hash: (pending PATH A clear at close-gate)

objective: On /workspace, a subtask reaching dailyProgress=100 whose latest daily report is still 'draft' must stay in "In Progress" and only advance to "For Checking" once the report is submitted (user-confirmed: gate the For-Checking step, not Complete — because Complete already required approve, which already requires non-draft). Plus rename the "ซ่อน" archive action/labels to "จัดเก็บ" and replace the trash-can unarchive icon.

key finding (surfaced to user): roadmap premise was wrong — progress>=100 already routed to 'for-checking' (not 'completed'); Complete needs status==='completed' via approveTask, gated on non-draft report. Board is realtime (useRealtimeTasks/Firestore onSnapshot), not REST; report status was NOT on the subtask doc. Solution = denormalize.

outcome: Done. 5 files changed:
  - backend/src/services/TaskService.ts (S1): in submitDailyReport, isLatestDate && !isSupportReport branch, added `latestSiteReportStatus: finalReportData.status ?? null` to BOTH the subtask update and the no-subtask task update (report status = reportData.status = 'draft'|'submitted', set at daily-reports/index.tsx:2560 isFinalSubmit). Additive only; no state-machine change.
  - frontend/src/services/taskService.ts (S2): added optional `latestSiteReportStatus?: string` to interface Task AND interface Subtask.
  - frontend/src/hooks/useRealtimeTasks.ts (S3): mapped `latestSiteReportStatus: data.latestSiteReportStatus ?? undefined` in the subtask mapper.
  - frontend/src/pages/workspace/index.tsx (S4/S5/S6): getEffectiveSubtaskStatus — when progress>=100 && status!=='completed' && latestSiteReportStatus==='draft' → return 'in-progress' (else 'for-checking'; absent → no gate). Added `latestSiteReportStatus: subtask.latestSiteReportStatus` to subtaskCards mergedTask so cards carry the subtask value (not parent's). Consolidated the 3 inline copies of the status logic (mobile count, mobile bucket, desktop bucket) to call getEffectiveSubtaskStatus(t) — single source of truth. Renamed labels ซ่อน→จัดเก็บ (chip "จัดเก็บ N", mobile chip, popover title "รายการที่จัดเก็บ", empty "ไม่มีรายการที่จัดเก็บ"). Swapped RestoreFromTrash→Unarchive icon import+usage, tooltip "เอากลับมาแสดง"→"ยกเลิกจัดเก็บ". Updated stale comment.
  - frontend/src/page-components/workspace/components/TaskCard.tsx (S5): menu label "ซ่อน"→"จัดเก็บ".

validation: `cd frontend && npx tsc --noEmit` exit 0; `cd backend && npx tsc --noEmit` exit 0. Browser verify blocked by sandbox (dev-server). Data path traced: subtaskCards→filteredSubtasks→getEffectiveSubtaskStatus (reads latestSiteReportStatus).

caveat (user-approved): existing subtasks lack the field until a new report is submitted post-deploy → treated as submitted (no gating) so the board doesn't reshuffle old tasks. Only forward-looking submits gate.
