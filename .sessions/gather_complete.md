# Gather Complete — T-049

date: 2026-07-13
task: T-049 · Workspace "Complete" box — gate on report status (draft) not just progress=100 · rename "ซ่อน"→"จัดเก็บ" · swap trash-can unarchive icon
skill: editor (coder-scope: backend + frontend, multi-file targeted edits)

## Objective
1. A subtask that reaches dailyProgress=100 but whose latest daily report is still 'draft' must STAY in "In Progress" (not advance to "For Checking") until the report is submitted. User-confirmed: gate the In-Progress → For-Checking transition (not just Complete).
2. Rename the "ซ่อน" completed-task action/labels to "จัดเก็บ" everywhere.
3. Replace the RestoreFromTrash (trash-can) unarchive icon with a non-trash icon + tooltip "ยกเลิกจัดเก็บ".

## Key Findings (contradiction vs roadmap premise — surfaced to user)
- Roadmap claimed the Complete box gates purely on dailyProgress>=100. Actual code: progress>=100 && status!=='completed' → 'for-checking' (NOT 'completed'). "Completed" column requires status==='completed', which only happens via approveTask (TaskService.ts:492/519); the approve button is gated on report NOT being draft (TaskDailyReportModal.tsx:796). So a draft-report task already cannot reach Complete — it sits in For-Checking. User confirmed real intent: keep it in In-Progress until the report is submitted (gate the For-Checking step).
- Board is REALTIME (useRealtimeTasks → Firestore onSnapshot on tasks + subtasks collectionGroup). Does NOT use REST getTasks. Card data = subtask doc fields only.
- Report status is NOT on the subtask doc. Reports live at subtaskRef/revisions/{rev}/dailyReports/{dateStr} with a `status` field. Modal derives latestSiteReportStatus by fetching all reports per task.
- submitDailyReport (TaskService.ts:1863) already computes isLatestDate (~2099) and updates the subtask's dailyProgress + status in a transaction when isLatestDate → natural place to denormalize the report status.

## Approach (user-confirmed)
- DENORMALIZE `latestSiteReportStatus` onto the subtask doc in submitDailyReport (piggyback the existing isLatestDate subtask update).
- FE realtime hook maps the field onto each card.
- FE grouping gates progress>=100 → 'for-checking' on it: draft → keep 'in-progress'; submitted/absent → 'for-checking'.
- Backfill default (user-confirmed "ไม่กัน"): field ABSENT → treat as submitted (no gating) so existing tasks don't reshuffle.

## Affected Files
- backend/src/services/TaskService.ts (submitDailyReport — denormalize field on subtask [+ task] update)
- frontend/src/types/legacy.ts (Task type: add latestSiteReportStatus?)
- frontend/src/hooks/useRealtimeTasks.ts (map field on subtask)
- frontend/src/pages/workspace/index.tsx (getEffectiveSubtaskStatus:100 + inline dups ~1806 + desktop bucket; rename chips/popover; icon swap ~2804)
- frontend/src/page-components/workspace/components/TaskCard.tsx (rename "ซ่อน"→"จัดเก็บ" menu label:312)

## Acceptance Criteria
- Subtask at 100% + latest report draft → In Progress; submitted → For Checking; approved → Complete.
- Card missing the field → For Checking (no regression).
- "ซ่อน" labels all read "จัดเก็บ"; unarchive icon non-trash; tooltip "ยกเลิกจัดเก็บ".
- `npx tsc --noEmit` clean on frontend AND backend.

### Files Read — Phase 1
| File | Why | Lines |
|---|---|---|
| frontend/src/pages/workspace/index.tsx | grouping helper + inline dups + hide/unhide popover | 90-160, 1690-1945, 2030-2090, 2640-2770 |
| frontend/src/page-components/workspace/components/TaskCard.tsx | hide action/label | grep 189-312 |
| frontend/src/page-components/workspace/components/TaskDailyReportModal.tsx | latestSiteReportStatus derivation + approve gate | grep 82-827 |
| frontend/src/hooks/useRealtimeTasks.ts | realtime data shape | grep 1-234 |
| backend/src/services/TaskService.ts | approveTask + submitDailyReport subtask write | 495-544, 1863-2144, 2145-2290(grep) |
| backend/src/api/routes/tasks.routes.ts | existing reportStatus join precedent | 355-424 |
