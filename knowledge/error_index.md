# Error Index

This catalog lists known errors and bug fix details.

---

## ERR-001: FAILED_PRECONDITION Missing Collection Group Index
- **Task:** T-005-001-01 Â· **Session:** session_01
- **File:** backend/src/services/TaskService.ts Â· **Line:** 700
- **Symptom:** API responds with 500 Internal Server Error when querying `collectionGroup('dailyReports')` with `.where('reportDate')`. Console logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index...`
- **Root Cause:** Firebase Firestore does not have an index created for the collection group query on the `reportDate` field.
- **Resolution:** Temporarily reverted to fetching `.get()` without `.where()` and applied an in-memory filter (`filter(...)` using `getTime()`). Additionally, provided the Firebase index creation URL to the user for a permanent fix.

## ERR-002: Cannot edit or view locked cell popup in Backlog/History Grid
- **Task:** T-008-001-01 Â· **Session:** session_02
- **File:** frontend/src/pages/daily-reports/list.tsx Â· **Line:** 828
- **Symptom:** Manit Sathitwat (FM) reported that clicking on any worker's cell for Sunday, May 17, 2026 (or any locked cell) in the Backlog / History grid does not open the edit/absent popup.
- **Root Cause:** Cells with `day.allowEdit === false` had their `onClick` handler completely disabled in the list grid view, preventing the popup from showing at all.
- **Resolution:** Removed the check that disabled clicking on non-editable cells. Added `disabled` attributes to all form input components in the popup and disabled the save button when `!selectedCell.day.allowEdit`. Added a prominent warning alert at the top of the popup explaining why it is read-only and instructing how to request an unlock from the Daily Report page if applicable.

## ERR-003: Creator/Foreman information and record update date not shown in Normal/Leave popups
- **Task:** T-001-001-01 Â· **Session:** session_03
- **File:** frontend/src/pages/daily-reports/list.tsx Â· **Line:** 885
- **Symptom:** In the Backlog/History grid worker edit popup, the grey badge for a worker with a "Normal" (à¸›à¸�à¸•à¸´) or "Leave" (à¸¥à¸²) record only displayed the creator's name. It did not have the "à¸œà¸¹à¹‰à¸šà¸±à¸™à¸—à¸¶à¸�:" (Creator) prefix, nor did it show the date when it was recorded/updated, unlike the "Absent" (à¸‚à¸²à¸”à¸‡à¸²à¸™) popup which displays both.
- **Root Cause:** The conditional branch rendering the creator info in the dialog header only outputted `selectedCell.day.record.createdByName` without a prefix or the formatted date string. Also, the backend did not include `updatedAt` / `createdAt` formatted as `updatedAtStr` on the record objects in the grid payload.
- **Resolution:** Modified the backend (`backend/src/api/routes/tasks.routes.ts`) to calculate `reportUpdatedAtStr` from the daily report's `updatedAt` (or `createdAt` fallback) and attached it as `updatedAtStr` to both regular and leave record items in the grid payload. Modified the frontend (`frontend/src/pages/daily-reports/list.tsx`) to prepend "à¸œà¸¹à¹‰à¸šà¸±à¸™à¸—à¸¶à¸�: " and display the formatted date from `updatedAtStr` inside the creator information badge in the popup header.

## ERR-004: Popup displays future recorded dates and foreman usage in the past cell context
- **Task:** T-001-001-02 Â· **Session:** session_04
- **File:** backend/src/api/routes/tasks.routes.ts, frontend/src/pages/daily-reports/list.tsx Â· **Line:** 372 (backend), 900 (frontend)
- **Symptom:** Opening the backlog cell popup on a past date (e.g. May 13) showed creator or last-used foreman info from a future date (e.g. May 19), which was confusing to users.
- **Root Cause:** The Normal/Leave popup displayed the database transaction update date (`updatedAtStr`), and the Absent popup displayed the absolute latest row-level/worker-level last-used foreman name and date, regardless of whether that usage occurred in the future of the clicked cell's date.
- **Resolution:**
  1. For Normal/Leave popups (à¸›à¸�à¸•à¸´/à¸¥à¸²), modified the frontend to display the cell's own work date instead of the database update transaction date.
  2. For Absent popups (à¸‚à¸²à¸”à¸‡à¸²à¸™), updated the backend to compute a daily relative last-used foreman and date (`lastUsedByName` and `lastUsedDateStr` per cell day) by filtering the task's daily reports to only include entries on or before the cell's date. Modified the frontend to display this day-level relative info.

## ERR-005: Incorrect OT Evening default time and unaligned checkbox time toggling in Backlog popup
- **Task:** T-001-001-03 Â· **Session:** session_05
- **File:** frontend/src/pages/daily-reports/list.tsx Â· **Line:** 246, 248, 323, 332, 341, 350, 359
- **Symptom:** In the backlog/history grid worker edit popup, the OT Evening default time was set to 17:30 - 20:30 instead of 18:00 - 21:00. Additionally, checking any shift/OT checkbox did not initialize or align the time ranges with the default times from the Daily Report page.
- **Root Cause:** The state initialization for OT Evening was hardcoded to '17:30 - 20:30' (and fallback values in handleCellClick also used the incorrect ranges). The toggle handlers for the checkboxes (e.g. handleOtEveningChange) only set the boolean states without initializing the corresponding time range string state to the default value.
- **Resolution:** Updated default state values and handleCellClick fallback defaults in list.tsx to use '18:00 - 21:00' for OT Evening and '06:00 - 08:00' for OT Morning. Modified the checkbox change handlers (handleNormalShiftChange, handleOtMorningChange, handleOtNoonChange, handleOtEveningChange, handleLeaveChange) to set the respective time state to its default value when checked is true.

## ERR-006: Axios Error 500 when saving backlog work record (Missing Collection Group Index)
- **Task:** T-001-001-04 Â· **Session:** session_06
- **File:** backend/src/api/routes/tasks.routes.ts Â· **Line:** 80
- **Symptom:** Submitting work or OT hour updates in the backlog/history grid edit popup fails with `AxiosError: Request failed with status code 500`. Backend logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index for collection tasks and field taskId.`
- **Root Cause:** The `/tasks/backlog` endpoint returned raw `taskId` values. When editing records, the frontend called report submission/retrieval endpoints using this raw ID, which triggered a Firestore `collectionGroup('tasks').where('taskId', '==', id)` query. This query requires an index that is missing in the local Firestore emulator.
- **Resolution:** Modified `/api/tasks/backlog` to return the task's composite ID (`woId__catId__taskId`) instead of its raw `taskId`. Since this composite ID contains `__`, the backend's `getDailyReport` and `submitDailyReport` services resolve the task directly by document reference path, bypassing the index requirement and resolving the 500 error.


## ERR-007: Maximum update depth exceeded in workspace/index.tsx
- **Task:** T-010 · **Session:** session_004
- **File:** src/pages/workspace/index.tsx · **Line:** 133
- **Symptom:** React rendering infinite loop (Maximum update depth exceeded)
- **Root Cause:** useTaskCacheStore() returned the whole state object which changes on every mutation, causing infinite re-renders when taskCache is used as a dependency in useCallback/useEffect.
- **Resolution:** Destructured useTaskCacheStore into specific properties (tasksInCache, isCacheValid, etc.) to prevent unnecessary re-renders.



## ERR-008: RangeError: Invalid time value in Daily Report Sidebar
- **Task:** T-011-001-01 Â· **Session:** session_008
- **File:** frontend/src/pages/daily-reports/index.tsx Â· **Line:** 3581
- **Symptom:** The daily report sidebar crashed with `RangeError: Invalid time value` inside `TaskSidebarCard` component when attempting to parse `task.dueDate`.
- **Root Cause:** In the backend `assigned-subtasks` API route, subtasks without a `dueDate` in Firestore merged into parent tasks via spreading `...st`, which overwrote the parent task's valid `dueDate` with `undefined`. Frontend then executed `new Date(undefined)` which returned `Invalid Date`, causing date-fns `format` to throw a RangeError.
- **Resolution:** Modified backend route to merge due dates safely using `st.dueDate || parentTask.dueDate`. Updated frontend components (`index.tsx`, `daily_report_ui_aftersale_reference.tsx`, and `TaskCard.tsx`) to validate `dueDate` before formatting, displaying `'-'` as a fallback instead of crashing.

## ERR-009: RangeError: Invalid time value in CustomPickersDay Calendar
- **Task:** T-011-001-02 Â· **Session:** session_008
- **File:** frontend/src/pages/daily-reports/index.tsx Â· **Line:** 492
- **Symptom:** The daily report calendar crashed with `RangeError: Invalid time value` in `CustomPickersDay` component upon clicking/loading the date picker.
- **Root Cause:** In the backend `/assigned-subtasks` endpoint, parent tasks were loaded directly from Firestore without `taskConverter.fromFirestore`, which left fields like `revisionCreatedAt` and `supportCreatedAt` as raw Firestore Timestamp objects. Passing these raw objects to `new Date()` on the frontend returned `Invalid Date`, making `effectiveBoundaryDate` an invalid date, causing `format(effectiveBoundaryDate, 'yyyy-MM-dd')` to crash.
- **Resolution:** Modified backend route `/assigned-subtasks` to parse task documents using `taskConverter.fromFirestore(doc)` so all timestamps are correctly resolved to JS dates. Added `parseSafeDate` utility on the frontend to safely parse standard date strings and raw Firestore Timestamp objects. Updated frontend useMemos (`boundaryDate`, `effectiveBoundaryDate`, `calendarMinDate`) and PickersDay components to defensively check dates using `isNaN(date.getTime())` before using or formatting them.

## ERR-010: FM Subtasks Progress and Calendar Dots Incorrect
- **Task:** T-011-001-03 · **Session:** session_008
- **File:** backend/src/services/TaskService.ts · **Line:** 904
- **Symptom:** Subtask daily report progress shows 0% and calendar status dots do not display correct colors (remain red/yellow after daily report submission).
- **Root Cause:** 
  1. Firestore Transaction Violation: Inside `submitDailyReport`, the transaction performed `transaction.update(subtaskRef, ...)` (WRITE) first and then `transaction.get(taskRef.collection('subtasks'))` (READ). This read-after-write violation caused the transaction to fail and roll back.
  2. Missing currentRevision Sync: During task rejection (`rejectTask`), the backend created new revision documents for subtasks but forgot to update the `currentRevision` field of the subtask document itself. This caused subtask reports to be written to `revisions/rev00` while the frontend expected `revisions/rev01`, resulting in mismatching calendar dots.
- **Resolution:**
  1. Restructured `submitDailyReport` transaction to perform all queries (`transaction.get` for taskDoc, dailyReportDoc, newerReports, and sibling subtasks collection) at the beginning before executing any writes.
  2. Updated `rejectTask` to correctly update the subtask document's `currentRevision`, `dailyProgress`, and `status` to sync with the parent task revisions.

## ERR-011: Daily Report leaveType mapping not persisted in Firestore
- **Task:** T-011-001-04 · **Session:** session_008
- **File:** backend/src/services/TaskService.ts · **Line:** 969
- **Symptom:** The leaveType (Paid/Unpaid) mapped in `submitDailyReport` was not being saved to Firestore (saved as empty or original unmapped values).
- **Root Cause:** The leaveType mapping logic modified the request object `reportData.leave` instead of `finalReportData.leave`, while the final save payload was built using `finalReportData` (which was cloned before the mapping was applied).
- **Resolution:** Updated the mapping in `TaskService.ts` to assign the mapped leave items directly to `finalReportData.leave` instead of `reportData.leave`.

## ERR-012: Daily Report Unlock APIs failing to unlock subtask daily reports
- **Task:** T-011-002-01 · **Session:** session_008
- **File:** backend/src/services/TaskService.ts · **Line:** 1253, 1296
- **Symptom:** Unlocking or requesting unlock of a daily report failed to make editing allowed on the frontend when using the subtasks database structure.
- **Root Cause:** The `unlockDailyReport` and `requestDailyReportUnlock` methods parsed only the first 3 parts of the composite ID and hardcoded updates to parent tasks, which left the subtask document's `unlockedDates` unmodified.
- **Resolution:** Modified both methods in `TaskService.ts` to use `resolveRefs(id)` so that they correctly update `unlockedDates` / `unlockRequests` on the subtask document (`subtaskRef`) if the ID refers to a subtask.

## ERR-013: Workspace "+ Newtasks" button hidden or off-screen on mobile devices
- **Task:** T-012-002-01 · **Session:** session_008
- **File:** frontend/src/pages/workspace/index.tsx · **Line:** 233
- **Symptom:** In the mobile version of the workspace page, the "+ Newtasks" button disappears and is completely inaccessible to users.
- **Root Cause:** The tabs capsule and "+ Newtasks" button were wrapped in a horizontal flex stack (`direction="row"`) that did not wrap. Because the tabs capsule was very wide, it pushed the adjacent button completely off the viewport on mobile devices.
- **Resolution:** Modified the wrapper Stack to be responsive (`direction={{ xs: 'column', sm: 'row' }}` and `alignItems={{ xs: 'stretch', sm: 'center' }}`). Enabled horizontal scrolling on the tabs container capsule using `overflowX: 'auto'` (with scrollbar hidden via CSS rules) and set individual tabs to `flexShrink: 0`. Stretched the buttons to full width (`width: { xs: '100%', sm: 'auto' }`) on mobile screens to make them highly touch-friendly and visually cohesive.

## ERR-014: Plan/Report data type capsule toggle switcher colors unaligned with dark theme
- **Task:** T-012-002-02 · **Session:** session_008
- **File:** frontend/src/pages/workspace/requests.tsx · **Line:** 361
- **Symptom:** The supervisor requests/reports data type toggle switcher (capsule design) used a gray background with white text for active, which looked inconsistent and had styling issues on some viewports.
- **Root Cause:** ToggleButtonGroup container used `#f3f4f6` (light gray) with `#fff` background and `#0f172a` text for the active toggle. The styling did not match the premium dark theme controls.
- **Resolution:** Modified the ToggleButtonGroup's container background to `#1c1e2b` (dark). Configured the active ToggleButton background to `#ffffff` (white) with dark text (`#1c1e2b`). Configured the inactive ToggleButton text to white (`rgba(255, 255, 255, 0.7)`), creating a high-contrast, premium, dark-themed capsule switcher where active buttons are white and inactive labels are white/muted white.

## ERR-015: Workspace displaying tasks from non-After-Sale systems
- **Task:** T-012-003-01 · **Session:** session_008
- **File:** backend/src/services/TaskService.ts, backend/src/api/routes/tasks.routes.ts · **Line:** 497 (TaskService), 94, 579, 663, 772 (tasks.routes)
- **Symptom:** Workspace dashboard showing tasks and reports from other systems, cluttering the view for supervisors and foremen.
- **Root Cause:** The database is shared with the After-Sale system, but the backend query/listing methods fetched all tasks and subtasks indiscriminately without filtering by their `workOrderCode` value.
- **Resolution:** Added backend filters to restrict task and subtask lists to only return records where `workOrderCode` equals `'WOA'` or `'WOP'`. Applied this filter in the `getTasks` service method (affecting general workspace listings) and in the `GET /backlog`, `GET /assigned-subtasks`, `GET /requests-all`, and `GET /reports-all` API endpoints (affecting daily reports, backlog, supervisor requests, and actual daily report summaries).
