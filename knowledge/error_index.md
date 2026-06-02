# Error Index

This catalog lists known errors and bug fix details.

---

## ERR-001: FAILED_PRECONDITION Missing Collection Group Index
- **Task:** T-005-001-01 Ã‚Â· **Session:** session_01
- **File:** backend/src/services/TaskService.ts Ã‚Â· **Line:** 700
- **Symptom:** API responds with 500 Internal Server Error when querying `collectionGroup('dailyReports')` with `.where('reportDate')`. Console logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index...`
- **Root Cause:** Firebase Firestore does not have an index created for the collection group query on the `reportDate` field.
- **Resolution:** Temporarily reverted to fetching `.get()` without `.where()` and applied an in-memory filter (`filter(...)` using `getTime()`). Additionally, provided the Firebase index creation URL to the user for a permanent fix.

## ERR-002: Cannot edit or view locked cell popup in Backlog/History Grid
- **Task:** T-008-001-01 Ã‚Â· **Session:** session_02
- **File:** frontend/src/pages/daily-reports/list.tsx Ã‚Â· **Line:** 828
- **Symptom:** Manit Sathitwat (FM) reported that clicking on any worker's cell for Sunday, May 17, 2026 (or any locked cell) in the Backlog / History grid does not open the edit/absent popup.
- **Root Cause:** Cells with `day.allowEdit === false` had their `onClick` handler completely disabled in the list grid view, preventing the popup from showing at all.
- **Resolution:** Removed the check that disabled clicking on non-editable cells. Added `disabled` attributes to all form input components in the popup and disabled the save button when `!selectedCell.day.allowEdit`. Added a prominent warning alert at the top of the popup explaining why it is read-only and instructing how to request an unlock from the Daily Report page if applicable.

## ERR-003: Creator/Foreman information and record update date not shown in Normal/Leave popups
- **Task:** T-001-001-01 Ã‚Â· **Session:** session_03
- **File:** frontend/src/pages/daily-reports/list.tsx Ã‚Â· **Line:** 885
- **Symptom:** In the Backlog/History grid worker edit popup, the grey badge for a worker with a "Normal" (Ã Â¸â€ºÃ Â¸ï¿½Ã Â¸â€¢Ã Â¸Â´) or "Leave" (Ã Â¸Â¥Ã Â¸Â²) record only displayed the creator's name. It did not have the "Ã Â¸Å“Ã Â¸Â¹Ã Â¹â€°Ã Â¸Å¡Ã Â¸Â±Ã Â¸â„¢Ã Â¸â€”Ã Â¸Â¶Ã Â¸ï¿½:" (Creator) prefix, nor did it show the date when it was recorded/updated, unlike the "Absent" (Ã Â¸â€šÃ Â¸Â²Ã Â¸â€�Ã Â¸â€¡Ã Â¸Â²Ã Â¸â„¢) popup which displays both.
- **Root Cause:** The conditional branch rendering the creator info in the dialog header only outputted `selectedCell.day.record.createdByName` without a prefix or the formatted date string. Also, the backend did not include `updatedAt` / `createdAt` formatted as `updatedAtStr` on the record objects in the grid payload.
- **Resolution:** Modified the backend (`backend/src/api/routes/tasks.routes.ts`) to calculate `reportUpdatedAtStr` from the daily report's `updatedAt` (or `createdAt` fallback) and attached it as `updatedAtStr` to both regular and leave record items in the grid payload. Modified the frontend (`frontend/src/pages/daily-reports/list.tsx`) to prepend "Ã Â¸Å“Ã Â¸Â¹Ã Â¹â€°Ã Â¸Å¡Ã Â¸Â±Ã Â¸â„¢Ã Â¸â€”Ã Â¸Â¶Ã Â¸ï¿½: " and display the formatted date from `updatedAtStr` inside the creator information badge in the popup header.

## ERR-004: Popup displays future recorded dates and foreman usage in the past cell context
- **Task:** T-001-001-02 Ã‚Â· **Session:** session_04
- **File:** backend/src/api/routes/tasks.routes.ts, frontend/src/pages/daily-reports/list.tsx Ã‚Â· **Line:** 372 (backend), 900 (frontend)
- **Symptom:** Opening the backlog cell popup on a past date (e.g. May 13) showed creator or last-used foreman info from a future date (e.g. May 19), which was confusing to users.
- **Root Cause:** The Normal/Leave popup displayed the database transaction update date (`updatedAtStr`), and the Absent popup displayed the absolute latest row-level/worker-level last-used foreman name and date, regardless of whether that usage occurred in the future of the clicked cell's date.
- **Resolution:**
  1. For Normal/Leave popups (Ã Â¸â€ºÃ Â¸ï¿½Ã Â¸â€¢Ã Â¸Â´/Ã Â¸Â¥Ã Â¸Â²), modified the frontend to display the cell's own work date instead of the database update transaction date.
  2. For Absent popups (Ã Â¸â€šÃ Â¸Â²Ã Â¸â€�Ã Â¸â€¡Ã Â¸Â²Ã Â¸â„¢), updated the backend to compute a daily relative last-used foreman and date (`lastUsedByName` and `lastUsedDateStr` per cell day) by filtering the task's daily reports to only include entries on or before the cell's date. Modified the frontend to display this day-level relative info.

## ERR-005: Incorrect OT Evening default time and unaligned checkbox time toggling in Backlog popup
- **Task:** T-001-001-03 Ã‚Â· **Session:** session_05
- **File:** frontend/src/pages/daily-reports/list.tsx Ã‚Â· **Line:** 246, 248, 323, 332, 341, 350, 359
- **Symptom:** In the backlog/history grid worker edit popup, the OT Evening default time was set to 17:30 - 20:30 instead of 18:00 - 21:00. Additionally, checking any shift/OT checkbox did not initialize or align the time ranges with the default times from the Daily Report page.
- **Root Cause:** The state initialization for OT Evening was hardcoded to '17:30 - 20:30' (and fallback values in handleCellClick also used the incorrect ranges). The toggle handlers for the checkboxes (e.g. handleOtEveningChange) only set the boolean states without initializing the corresponding time range string state to the default value.
- **Resolution:** Updated default state values and handleCellClick fallback defaults in list.tsx to use '18:00 - 21:00' for OT Evening and '06:00 - 08:00' for OT Morning. Modified the checkbox change handlers (handleNormalShiftChange, handleOtMorningChange, handleOtNoonChange, handleOtEveningChange, handleLeaveChange) to set the respective time state to its default value when checked is true.

## ERR-006: Axios Error 500 when saving backlog work record (Missing Collection Group Index)
- **Task:** T-001-001-04 Ã‚Â· **Session:** session_06
- **File:** backend/src/api/routes/tasks.routes.ts Ã‚Â· **Line:** 80
- **Symptom:** Submitting work or OT hour updates in the backlog/history grid edit popup fails with `AxiosError: Request failed with status code 500`. Backend logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index for collection tasks and field taskId.`
- **Root Cause:** The `/tasks/backlog` endpoint returned raw `taskId` values. When editing records, the frontend called report submission/retrieval endpoints using this raw ID, which triggered a Firestore `collectionGroup('tasks').where('taskId', '==', id)` query. This query requires an index that is missing in the local Firestore emulator.
- **Resolution:** Modified `/api/tasks/backlog` to return the task's composite ID (`woId__catId__taskId`) instead of its raw `taskId`. Since this composite ID contains `__`, the backend's `getDailyReport` and `submitDailyReport` services resolve the task directly by document reference path, bypassing the index requirement and resolving the 500 error.


## ERR-007: Maximum update depth exceeded in workspace/index.tsx
- **Task:** T-010 Â· **Session:** session_004
- **File:** src/pages/workspace/index.tsx Â· **Line:** 133
- **Symptom:** React rendering infinite loop (Maximum update depth exceeded)
- **Root Cause:** useTaskCacheStore() returned the whole state object which changes on every mutation, causing infinite re-renders when taskCache is used as a dependency in useCallback/useEffect.
- **Resolution:** Destructured useTaskCacheStore into specific properties (tasksInCache, isCacheValid, etc.) to prevent unnecessary re-renders.



## ERR-008: RangeError: Invalid time value in Daily Report Sidebar
- **Task:** T-011-001-01 Ã‚Â· **Session:** session_008
- **File:** frontend/src/pages/daily-reports/index.tsx Ã‚Â· **Line:** 3581
- **Symptom:** The daily report sidebar crashed with `RangeError: Invalid time value` inside `TaskSidebarCard` component when attempting to parse `task.dueDate`.
- **Root Cause:** In the backend `assigned-subtasks` API route, subtasks without a `dueDate` in Firestore merged into parent tasks via spreading `...st`, which overwrote the parent task's valid `dueDate` with `undefined`. Frontend then executed `new Date(undefined)` which returned `Invalid Date`, causing date-fns `format` to throw a RangeError.
- **Resolution:** Modified backend route to merge due dates safely using `st.dueDate || parentTask.dueDate`. Updated frontend components (`index.tsx`, `daily_report_ui_aftersale_reference.tsx`, and `TaskCard.tsx`) to validate `dueDate` before formatting, displaying `'-'` as a fallback instead of crashing.

## ERR-009: RangeError: Invalid time value in CustomPickersDay Calendar
- **Task:** T-011-001-02 Ã‚Â· **Session:** session_008
- **File:** frontend/src/pages/daily-reports/index.tsx Ã‚Â· **Line:** 492
- **Symptom:** The daily report calendar crashed with `RangeError: Invalid time value` in `CustomPickersDay` component upon clicking/loading the date picker.
- **Root Cause:** In the backend `/assigned-subtasks` endpoint, parent tasks were loaded directly from Firestore without `taskConverter.fromFirestore`, which left fields like `revisionCreatedAt` and `supportCreatedAt` as raw Firestore Timestamp objects. Passing these raw objects to `new Date()` on the frontend returned `Invalid Date`, making `effectiveBoundaryDate` an invalid date, causing `format(effectiveBoundaryDate, 'yyyy-MM-dd')` to crash.
- **Resolution:** Modified backend route `/assigned-subtasks` to parse task documents using `taskConverter.fromFirestore(doc)` so all timestamps are correctly resolved to JS dates. Added `parseSafeDate` utility on the frontend to safely parse standard date strings and raw Firestore Timestamp objects. Updated frontend useMemos (`boundaryDate`, `effectiveBoundaryDate`, `calendarMinDate`) and PickersDay components to defensively check dates using `isNaN(date.getTime())` before using or formatting them.

## ERR-010: FM Subtasks Progress and Calendar Dots Incorrect
- **Task:** T-011-001-03 Â· **Session:** session_008
- **File:** backend/src/services/TaskService.ts Â· **Line:** 904
- **Symptom:** Subtask daily report progress shows 0% and calendar status dots do not display correct colors (remain red/yellow after daily report submission).
- **Root Cause:** 
  1. Firestore Transaction Violation: Inside `submitDailyReport`, the transaction performed `transaction.update(subtaskRef, ...)` (WRITE) first and then `transaction.get(taskRef.collection('subtasks'))` (READ). This read-after-write violation caused the transaction to fail and roll back.
  2. Missing currentRevision Sync: During task rejection (`rejectTask`), the backend created new revision documents for subtasks but forgot to update the `currentRevision` field of the subtask document itself. This caused subtask reports to be written to `revisions/rev00` while the frontend expected `revisions/rev01`, resulting in mismatching calendar dots.
- **Resolution:**
  1. Restructured `submitDailyReport` transaction to perform all queries (`transaction.get` for taskDoc, dailyReportDoc, newerReports, and sibling subtasks collection) at the beginning before executing any writes.
  2. Updated `rejectTask` to correctly update the subtask document's `currentRevision`, `dailyProgress`, and `status` to sync with the parent task revisions.

## ERR-011: Daily Report leaveType mapping not persisted in Firestore
- **Task:** T-011-001-04 Â· **Session:** session_008
- **File:** backend/src/services/TaskService.ts Â· **Line:** 969
- **Symptom:** The leaveType (Paid/Unpaid) mapped in `submitDailyReport` was not being saved to Firestore (saved as empty or original unmapped values).
- **Root Cause:** The leaveType mapping logic modified the request object `reportData.leave` instead of `finalReportData.leave`, while the final save payload was built using `finalReportData` (which was cloned before the mapping was applied).
- **Resolution:** Updated the mapping in `TaskService.ts` to assign the mapped leave items directly to `finalReportData.leave` instead of `reportData.leave`.

## ERR-012: Daily Report Unlock APIs failing to unlock subtask daily reports
- **Task:** T-011-002-01 Â· **Session:** session_008
- **File:** backend/src/services/TaskService.ts Â· **Line:** 1253, 1296
- **Symptom:** Unlocking or requesting unlock of a daily report failed to make editing allowed on the frontend when using the subtasks database structure.
- **Root Cause:** The `unlockDailyReport` and `requestDailyReportUnlock` methods parsed only the first 3 parts of the composite ID and hardcoded updates to parent tasks, which left the subtask document's `unlockedDates` unmodified.
- **Resolution:** Modified both methods in `TaskService.ts` to use `resolveRefs(id)` so that they correctly update `unlockedDates` / `unlockRequests` on the subtask document (`subtaskRef`) if the ID refers to a subtask.

## ERR-013: Workspace "+ Newtasks" button hidden or off-screen on mobile devices
- **Task:** T-012-002-01 Â· **Session:** session_008
- **File:** frontend/src/pages/workspace/index.tsx Â· **Line:** 233
- **Symptom:** In the mobile version of the workspace page, the "+ Newtasks" button disappears and is completely inaccessible to users.
- **Root Cause:** The tabs capsule and "+ Newtasks" button were wrapped in a horizontal flex stack (`direction="row"`) that did not wrap. Because the tabs capsule was very wide, it pushed the adjacent button completely off the viewport on mobile devices.
- **Resolution:** Modified the wrapper Stack to be responsive (`direction={{ xs: 'column', sm: 'row' }}` and `alignItems={{ xs: 'stretch', sm: 'center' }}`). Enabled horizontal scrolling on the tabs container capsule using `overflowX: 'auto'` (with scrollbar hidden via CSS rules) and set individual tabs to `flexShrink: 0`. Stretched the buttons to full width (`width: { xs: '100%', sm: 'auto' }`) on mobile screens to make them highly touch-friendly and visually cohesive.

## ERR-014: Plan/Report data type capsule toggle switcher colors unaligned with dark theme
- **Task:** T-012-002-02 Â· **Session:** session_008
- **File:** frontend/src/pages/workspace/requests.tsx Â· **Line:** 361
- **Symptom:** The supervisor requests/reports data type toggle switcher (capsule design) used a gray background with white text for active, which looked inconsistent and had styling issues on some viewports.
- **Root Cause:** ToggleButtonGroup container used `#f3f4f6` (light gray) with `#fff` background and `#0f172a` text for the active toggle. The styling did not match the premium dark theme controls.
- **Resolution:** Modified the ToggleButtonGroup's container background to `#1c1e2b` (dark). Configured the active ToggleButton background to `#ffffff` (white) with dark text (`#1c1e2b`). Configured the inactive ToggleButton text to white (`rgba(255, 255, 255, 0.7)`), creating a high-contrast, premium, dark-themed capsule switcher where active buttons are white and inactive labels are white/muted white.

## ERR-015: Workspace displaying tasks from After-Sale system
- **Task:** T-012-003-01 Â· **Session:** session_008
- **File:** backend/src/services/TaskService.ts, backend/src/api/routes/tasks.routes.ts Â· **Line:** 497 (TaskService), 94, 579, 663, 772 (tasks.routes)
- **Symptom:** Workspace dashboard showing tasks and reports from other systems (After-Sale), cluttering the view for supervisors and foremen.
- **Root Cause:** The database is shared with the After-Sale system, but the backend query/listing methods fetched all tasks and subtasks indiscriminately without filtering by their `workOrderCode` value.
- **Resolution:** Added backend filters to exclude tasks and subtasks belonging to After-Sale (where `workOrderCode` equals `'WOA'` or `'WOP'`). Applied this filter in the `getTasks` service method (affecting general workspace listings) and in the `GET /backlog`, `GET /assigned-subtasks`, `GET /requests-all`, and `GET /reports-all` API endpoints (affecting daily reports, backlog, supervisor requests, and actual daily report summaries) so they are completely ignored and never loaded.

## ERR-016: Frontend Docker build failing due to MUI peer dependency conflict
- **Task:** T-012-003-02 Â· **Session:** session_008
- **File:** frontend/Dockerfile Â· **Line:** 23, 56
- **Symptom:** Running `docker compose up --build` fails at step `RUN npm install` in frontend container development/builder stage with `npm error ERESOLVE unable to resolve dependency tree` (peer dependency mismatch between `@mui/material` and `@mui/lab`).
- **Root Cause:** Standard npm installation behavior (`npm install`) checks and strictly enforces peer dependencies. Mismatch in version requirements of `@mui/material` and `@mui/lab` package versions in `package.json` triggers a build blocking error.
- **Resolution:** Modified `npm install` commands in `frontend/Dockerfile` to use the `--legacy-peer-deps` flag (e.g. `RUN npm install --legacy-peer-deps`), telling npm to ignore peer dependency mismatches and proceed with the installation, resolving the build failure.

## ERR-017: Subtask Modal Card Layout inconsistent with Image 2 Design
- **Task:** T-012-004-01 Â· **Session:** session_008
- **File:** frontend/src/pages/workspace/components/TaskSubtasksModal.tsx Â· **Line:** 112
- **Symptom:** Subtasks modal card layout displays progress as a horizontal linear progress bar, lists assignees as avatars, and displays a Duedate badge, which doesn't match the circular progress layout in Image 2.
- **Root Cause:** The component was implemented with a basic linear layout using `<LinearProgress>` and `<Avatar>` rows instead of the circular-progress-on-the-left, stacked metadata design on the right, and the responsible FM name badge at the bottom.
- **Resolution:** Replaced the linear progress layout with a custom horizontal `<Stack>` layout: a `<CircularProgress>` on the left with percentage text inside, and stacked text details on the right containing Subtask ID, Parent Task > Subtask name, Project â€¢ Category name, and a gray capsule badge for the responsible FM names. Added responsive hover styling to mimic Image 2's blue outline and light blue background highlight.

## ERR-018: Task Card Footer Assignees Display Cluttered
- **Task:** T-012-004-02 Â· **Session:** session_008
- **File:** frontend/src/pages/workspace/components/TaskCard.tsx Â· **Line:** 277
- **Symptom:** Task card footer displays the first assignee's name as text alongside their avatar, and then overlaps subsequent assignees, which looks cluttered and does not follow the clean overlapping avatar layout from Image 2.
- **Root Cause:** The assignees list was rendered by extracting the first assignee to show their name text next to their avatar, and then group-rendering only the remainder of assignees inside a small `<AvatarGroup>`.
- **Resolution:** Modified the assignees rendering block in `TaskCard.tsx` to group all assignees inside a single `<AvatarGroup>` with `max={4}` and avatar width/height styled to 28px. Wrapped each `<Avatar>` in an MUI `<Tooltip>` displaying the assignee's full name, only showing their profile avatar icons in the footer and revealing their names on hover.

## ERR-019: Redundant and Confusing Support Request Checkbox in Task Creation/Edit Form
- **Task:** T-012-006-01 Â· **Session:** session_009
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx Â· **Line:** 884
- **Symptom:** The task creation and edit modal displayed two "Request Help from Support Team" checkboxesâ€”one inside each subtask block and one at the parent task levelâ€”leading to user confusion. Furthermore, the parent task-level checkbox was ignored or overridden by the backend upon creation/update.
- **Root Cause:** The parent-level checkbox `isSupportRequest` was rendered in the form, but the backend dynamically calculates the parent task's `isSupportRequest` value based strictly on whether any subtask has `isSupportRequest: true`. This rendered the parent-level checkbox redundant, non-functional, and confusing.
- **Resolution:** Removed the parent-level `isSupportRequest` checkbox and its unused `useWatch` binding from `TaskCreateModal.tsx`. Updated the frontend `updateTask` invocation to dynamically compute the parent task's `isSupportRequest` property as `data.subtasks.some(st => st.isSupportRequest)`, ensuring it aligns perfectly with the backend's aggregate model.

## ERR-020: Unticked Subtask Displayed with Support Badge on Workspace Board
- **Task:** T-012-006-02 Â· **Session:** session_009
- **File:** backend/src/services/TaskService.ts Â· **Line:** 762
- **Symptom:** Subtasks that did not request support were displayed with the yellow "SUPPORT" badge on the workspace Kanban board if at least one other subtask of the same parent task was flagged for support.
- **Root Cause:** In the backend `getTasks` method, subtasks fetched from Firestore were mapped into a clean object returned to the frontend. However, this mapping omitted the `isSupportRequest` field entirely. As a result, `subtask.isSupportRequest` was undefined on the frontend, falling back to `task.isSupportRequest` (which was true for all subtasks if any single subtask flagged support).
- **Resolution:** Added `isSupportRequest: subData.isSupportRequest || false` to the subtask mapping inside `getTasks` in `TaskService.ts`. This ensures each subtask's independent `isSupportRequest` state is correctly passed to and resolved by the frontend card renderer.

## ERR-021: Form validation failure and cluttered fields in Support Pickup Flow inside TaskCreateModal
- **Task:** T-012-006-03 Â· **Session:** session_009
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx Â· **Line:** 528
- **Symptom:** Support users experienced validation errors (such as missing Work Order and Category) and saw a cluttered layout with unnecessary input fields (such as Subtasks list, Category, and Work Order) when accepting a support request. Additionally, regular users saw an empty Autocomplete input instead of a TextField for the task name.
- **Root Cause:** The `taskName` field had incorrect conditional rendering, displaying Autocomplete for normal users. The form model also enforced Work Order and Category selection even when those fields were hidden, causing Zod schema validation errors. Furthermore, the subtask name, assignees, and due date were not correctly synced with the single subtask model when the support task was accepted.
- **Resolution:** Restructured the `TaskCreateModal` template to dynamically toggle layouts. Introduced the `isSupportPickup` flag to hide Category, Work Order, and Subtask list elements, and instead present a clean, custom layout containing only the Project, pending Support Subtask dropdown (with a soft-styled "Rename" toggle), Support FM Assignees, and a read-only Due Date. Populated Category and Work Order programmatically when the subtask is chosen to satisfy the Zod schema. Restored the correct `taskName` text input for normal users.

## ERR-022: Workspace Kanban Board horizontal overflow and large scale of Task Cards
- **Task:** T-012-007-01 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/index.tsx Â· **Line:** 410, 600, 623
- **Symptom:** The Workspace Kanban board had a horizontal scrollbar spanning the bottom of the page, some task cards went off-screen (à¸«à¸¥à¸¸à¸”à¸ˆà¸­), and the card size and font scale were too large compared to the Left Structure Tree panel.
- **Root Cause:**
  1. The outer container in `index.tsx` was set to `height: '100vh'`, which combined with the topbar (64px) caused a vertical overflow of 64px.
  2. The board columns were set to a fixed width of `350px` which caused them to exceed the viewport width on standard desktop resolutions, causing a horizontal scrollbar.
  3. The task cards had large paddings (`p: 2.5`) and title font size (`subtitle1`, 16px) which made the UI feel oversized compared to the Left Structure Tree text.
- **Resolution:**
  1. Set the outer container height to `calc(100vh - 64px)` in `index.tsx` to eliminate the page-level vertical scrollbar.
  2. Added scrollbar-hiding styles to the board container in `index.tsx` to remove horizontal scrollbars.
  3. Made the Kanban columns flex-resizable (`flex: '1 1 0px', minWidth: 260, maxWidth: 310`) to adapt smoothly to different screen resolutions.
  4. Scaled down `TaskCard.tsx` paddings (`p: 1.5`), margins (`mb: 1.5`), title typography (`fontSize: '0.825rem', fontWeight: 700` matching the Structure Tree), description typography (`variant="caption"`), progress bar height (`4px`), and avatar sizes (`24px`).

## ERR-023: Structure Tree lacking WorkOrder grouping level, missing dedicated Support tasks area, and incorrect task filtering for Site users
- **Task:** T-012-008-01 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/components/WorkspaceTree.tsx, frontend/src/pages/workspace/index.tsx
- **Symptom:**
  1. The Left Structure Tree only grouped by Category -> Task -> Subtask, missing the top-level WorkOrder folder. Folder names displayed IDs instead of descriptive names.
  2. Main tasks and Support tasks were mixed together in the tree, making it difficult for the support team to distinguish between them.
  3. Site users saw tasks from other projects or sites that they did not create.
- **Root Cause:**
  1. `WorkspaceTree.tsx` was structured to map categories directly and did not group tasks by `workOrderId`. It used raw string keys instead of `workOrderName` or `categoryName` fields.
  2. There was no separation or separate tree representation for support-related subtasks.
  3. The `filterTasksByRole` method in `index.tsx` allowed any task matching projectLocationIds *or* assigned/support tasks, without applying the restriction that tasks outside a user's own project/site must be created by them to be visible.
- **Resolution:**
  1. Redesigned `WorkspaceTree.tsx` to build a 4-level nested tree: `WorkOrder -> Category -> Task -> Subtask` dynamically grouped using `workOrderName` and `categoryName` properties (with robust fallbacks to code/ID).
  2. Added two distinct tree structures: **à¸‡à¸²à¸™à¸«à¸¥à¸±à¸� (Main Tasks)** (filtering out support subtasks) and **à¸‡à¸²à¸™à¸Šà¹ˆà¸§à¸¢à¹€à¸«à¸¥à¸·à¸­ (Support Tasks)** rendered separately at the bottom of the tree.
  3. Updated `filterTasksByRole` in `index.tsx` so that for Site users (`department !== 'WH'`), tasks belonging to other projects (`!isMyProject`) are only shown if created by the user (`t.createdBy === user.id`) or if they are assigned to it.
  4. Expanded `selectedNode` types in `index.tsx` and `WorkspaceTree.tsx` to support `'workOrder'` type filtering.

## ERR-024: Pending support requests and regular tasks of other sites visible to external support/WH users
- **Task:** T-012-008-02 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/index.tsx Â· **Line:** 102
- **Symptom:** Subtasks that requested support but were not yet picked up by the support team (`isSupportRequest === true && isPickedUpBySupport === false`), along with regular subtasks from other projects/sites, showed up on the Kanban Board and Left Structure Tree for support (WH) users.
- **Root Cause:**
  1. The `filterTasksByRole` method only filtered the task document (parent level) and did not clean up the `subtasks` array. If one subtask of a task had an active support request, the parent task was loaded, which caused all other regular subtasks of that task to load as well.
  2. The `subtaskCards` memo did not check if the subtask was a support request when `isMyProject` was false, allowing non-support subtasks of the parent task to bypass the filter and render as cards.
- **Resolution:**
  1. Updated `filterTasksByRole` to filter each task's `subtasks` array. If a user is not in the project (`isMyProject` is false), the subtasks array is filtered to only include subtasks that are accepted support requests (`isSupportRequest === true && isPickedUpBySupport === true`). If a task has no subtasks remaining after filtering, the parent task is excluded.
  2. Simplified `subtaskCards` mapping to map pre-filtered subtasks directly without duplicate or redundant filtering logic.

## ERR-025: Support Tree section visible to site users and support tasks hidden from their main tree hierarchy
- **Task:** T-012-008-03 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/components/WorkspaceTree.tsx Â· **Line:** 35, 99, 484
- **Symptom:** Site users (non-WH users) saw the separate "à¸‡à¸²à¸™à¸Šà¹ˆà¸§à¸¢à¹€à¸«à¸¥à¸·à¸­" (Support Tasks) section at the bottom of the Left Structure Tree, which is intended only for WH users. Additionally, any of their own tasks that requested support disappeared from the "à¸‡à¸²à¸™à¸«à¸¥à¸±à¸�" (Main Tasks) tree hierarchy, causing them to not see their own tasks in the tree.
- **Root Cause:**
  1. The "à¸‡à¸²à¸™à¸Šà¹ˆà¸§à¸¢à¹€à¸«à¸¥à¸·à¸­" section in `WorkspaceTree.tsx` was rendered unconditionally for all users.
  2. The `mainTree` was filtered with `sub => !sub.isSupportRequest`, which excluded support requests for all users, including the site users who created them.
- **Resolution:**
  1. Integrated `useAuthStore` inside `WorkspaceTree.tsx` to detect `isWH` (`user?.department === 'WH'`).
  2. Wrapped the "à¸‡à¸²à¸™à¸Šà¹ˆà¸§à¸¢à¹€à¸«à¸¥à¸·à¸­" rendering block in an `{isWH && ( ... )}` condition so it is completely hidden for non-WH users.
  3. Modified the `mainTree` building logic: if the user is not WH (`!isWH`), they see all tasks (including support requests) under "à¸‡à¸²à¸™à¸«à¸¥à¸±à¸�" (`buildTree(() => true)`), so they keep a complete view of their project's structure. If they are WH, it remains filtered (`buildTree(sub => !sub.isSupportRequest)`).

## ERR-026: WH users with AM role see regular construction tasks of other sites
- **Task:** T-012-008-04 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/index.tsx Â· **Line:** 91
- **Symptom:** Warehouse (WH) users with the Area Manager (`AM`) role saw regular construction tasks of other projects (e.g. `STR-0001-001-0002` - à¹€à¸—à¸›à¸¹à¸™à¹€à¸ªà¸² GL.H) on their board and in their sidebar's "à¸‡à¸²à¸™à¸«à¸¥à¸±à¸�" tree list.
- **Root Cause:** In `filterTasksByRole` inside `index.tsx`, any user with the `AM` role was treated as a general admin (`isAdmin = true`) and bypassed the task filtering logic entirely, returning `allTasks` without applying project-based or WH support-based visibility rules.
- **Resolution:** Refactored the role bypass condition so that Area Managers (`AM`) only bypass the filter if they do NOT belong to the WH department (`(role === 'AM' && !isWH)`). WH Area Managers now correctly go through the WH filtering rules, hiding regular tasks of other projects while preserving access to their own projects and accepted support requests.

## ERR-027: Calendar dots shifted and progress colors missing in Subtask Daily Report popup
- **Task:** T-012-008-05 Â· **Session:** session_010
- **File:** frontend/src/pages/workspace/components/TaskDailyReportModal.tsx Â· **Line:** 106, 485
- **Symptom:** In the Subtask Daily Report modal calendar, dates with submitted reports did not display highlight colors, and missing report status dots (red/orange) were offset and overlapped adjacent days. Additionally, WH supervisors saw their own project's local tasks as missing reports (red dots) even though reports had been submitted.
- **Root Cause:** 
  1. Incorrect `isActingAsSupport` Evaluation: In `TaskDailyReportModal.tsx`, `isActingAsSupport` defaulted to `true` for all support tasks if the user's department was `WH`, ignoring whether the task belonged to their own project. This caused the calendar to search for support reports (`supportReports`) instead of site reports (`siteReports`) for local WH tasks.
  2. The daily progress value was only set on days with site reports, resetting to 0% on days with only support reports.
  3. The task status was not checked, meaning completed tasks did not show green for all report days.
  4. The custom calendar day component (`CustomPickersDay`) colored all report dates in green unconditionally, and the styling was overridden by default MUI styles.
  5. The custom component returned a `PickersDay` wrapped inside MUI's `Badge`, which positioned the badge content at the top-right corner. The relative alignment caused the dots to shift and overlap the row above.
- **Resolution:**
  1. Updated `isActingAsSupport` to match `index.tsx` logic: a user is acting as support only if they are explicitly in `supportAssignees` or if it is a cross-project task (`isViewingCrossProject === true`). This fixes the local WH tasks report visibility issue.
  2. Modified `fetchReports` to calculate progress via a chronological `runningProgress` value that is carried forward to days without site reports.
  3. Defined `isCompleted` checking both `progress === 100` and `task?.status === 'completed'`.
  4. Styled the day cell with `!important` color/background and used `&:not(.Mui-selected)` to prevent selected date styling conflicts, highlighting green (emerald light) for completed/100% days and yellow (amber light) for in-progress days.
  5. Replaced the MUI `Badge` wrapper with a custom relative `Box` containing an absolute positioned dot (`bottom: 4`, `left: '50%'`, `transform: 'translateX(-50%)'`). This centers the status dots perfectly at the bottom of the date circle.

## ERR-028: Subtask Daily Reports show empty and API throws FAILED_PRECONDITION
- **Task:** T-012-008-06 Â· **Session:** session_011
- **File:** backend/src/services/TaskService.ts Â· **Line:** 757
- **Symptom:** Clicking a subtask card in the Workspace board shows "à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸£à¸²à¸¢à¸‡à¸²à¸™à¸�à¸²à¸£à¸—à¸³à¸‡à¸²à¸™" (No work report data) in the Daily Report Modal calendar log for dates that already have submitted daily reports. The backend logs show an unhandled `FAILED_PRECONDITION` error stating that a collection group index for `subtasks` on the `subtaskId` field is required.
- **Root Cause:**
  1. The backend `getTasks()` API mapped subtasks using their raw document IDs instead of the composite ID format (e.g., `WH-2026-DBD-0001__DBD-0001__DBD-0001-001__DBD-0001-001-0001`).
  2. Because the frontend received and used the raw subtask ID, API endpoints like `/api/tasks/:id/reports` were called with the raw ID. This forced the backend to use `collectionGroup('subtasks').where('subtaskId', '==', id)` to locate the subtask. This query failed since the required collection group index was missing in the Firestore project.
- **Resolution:**
  Modified `backend/src/services/TaskService.ts` inside `getTasks()` to correctly return the composite ID (`subData.id || \`${woId}__\${catId}__\${taskId}__\${subDoc.id}\``) in the subtask `id` field. Using the composite ID allows the backend's `resolveRefs()` and `getAllDailyReports()` to directly construct the collection paths and perform fast, index-free document reference lookups, completely avoiding the collection group query.

## ERR-029: Calendar dates grid inside DatePicker popover and DateCalendar inside TaskDailyReportModal are not centered
- **Task:** T-012-008-07 Â· **Session:** session_011
- **File:** frontend/src/pages/daily-reports/index.tsx Â· **Line:** 2604
- **Symptom:** In the Daily Reports page, the calendar dates and day headers inside the DatePicker popover are shifted to the left and uncentered. In TaskDailyReportModal, the calendar grid can similarly become left-aligned if the column box expands.
- **Root Cause:** MUI X DatePicker/DateCalendar components default to a fixed width of 320px for the day grid and navigation controls. If the popover container (Paper) or dialog box is wider (due to the wide custom legend or flex grids), the calendar wrapper remains left-aligned inside the layout container.
- **Resolution:** Centered the calendar horizontally:
  1. For the DatePicker popovers in `index.tsx` and `daily_report_ui_aftersale_reference.tsx`, added `layout` slot styling overrides (`& .MuiPickersLayout-contentWrapper`: `{ display: 'flex', justifyContent: 'center' }`) in `slotProps`.
  2. For the static DateCalendar inside `TaskDailyReportModal.tsx`, restricted its max width to `320px` and set horizontal auto margins (`maxWidth: '320px', mx: 'auto'`) inside its `sx` overrides to align it at the center of the left-hand column box.

## ERR-030: Mismatch in calendar day lock evaluation (date offset by 1 day) in Daily Reports page
- **Task:** T-012-008-08 Â· **Session:** session_011
- **File:** frontend/src/pages/daily-reports/index.tsx Â· **Line:** 528
- **Symptom:** In the Daily Reports page, the calendar popover displays the 3rd past day (e.g. May 24th when today is May 27th) as locked (red dot) instead of unlocked (yellow dot), whereas the Workspace Daily Report modal shows it correctly as unlocked (yellow dot).
- **Root Cause:** In `CustomPickersDay` inside `index.tsx` and `daily_report_ui_aftersale_reference.tsx`, the `today` variable was instantiated as `new Date()`, which retains the current time component. When subtracting 3 days via `subDays(today, 3)`, the resulting date is `24th [CurrentTime]`. Since the calendar day `day` has a time of `24th 00:00:00`, `isBefore(day, subDays(today, 3))` evaluated to `true`, incorrectly marking the 3rd past day as locked.
- **Resolution:** Cleared the time component for `today` inside `CustomPickersDay` in both `index.tsx` and `daily_report_ui_aftersale_reference.tsx` by adding `today.setHours(0, 0, 0, 0)` immediately after instantiation. This aligns the date locking logic exactly with `TaskDailyReportModal.tsx` which uses `startOfDay`.

## ERR-031: Supervisor has no indication of pending FM unlock requests in TaskDailyReportModal
- **Task:** T-012-008-09 Â· **Session:** session_011
- **File:** frontend/src/pages/workspace/components/TaskDailyReportModal.tsx Â· **Line:** 600
- **Symptom:** When an FM submits an unlock request for a past date, the supervisor opens TaskDailyReportModal and sees no indication that there are pending unlock requests. The supervisor must manually click on each past date in the calendar to find the "à¸›à¸¥à¸”à¸¥à¹‡à¸­à¸„à¸ªà¸´à¸—à¸˜à¸´à¹Œ" button. There is no global notification or visual indicator.
- **Root Cause:** The `TaskDailyReportModal` only renders the unlock button when `task.unlockRequests[selectedDateStr]` exists, meaning a supervisor must already know which date to click. There was no computed list of all pending unlock dates nor any notification UI element shown globally.
- **Resolution:**
  1. Added `pendingUnlockDates` useMemo that computes a sorted array of all date strings from `task.unlockRequests` (or `task.supportUnlockRequests` for support mode) that have not yet been approved (no valid active `unlockedDates` entry).
  2. Added `handleJumpToFirstUnlockRequest()` function that updates `selectedDate` to the first pending date in the list.
  3. Added a yellow notification badge (`NotificationsActiveIcon` with MUI `Badge`) in the `DialogTitle` header row. The badge shows the count of pending requests and triggers `handleJumpToFirstUnlockRequest` when clicked, instantly setting the selected date so the unlock button appears and the supervisor can act immediately.

## ERR-032: Subtask Unlock Requests and Unlocked Dates not showing on Workspace board
- **Task:** T-012-008-10 Â· **Session:** session_011
- **File:** backend/src/services/TaskService.ts, frontend/src/pages/workspace/index.tsx Â· **Line:** 771 (backend), 283, 370 (frontend)
- **Symptom:** When a Foreman requests a backdated unlock for a subtask, the supervisor does not see the purple indicator dot on the calendar in TaskDailyReportModal from the Workspace Kanban board or Left Structure Tree, and the "Unlock" button is not visible.
- **Root Cause:** The backend `getTasks()` service fetched subtasks from Firestore but omitted the `unlockRequests`, `supportUnlockRequests`, `unlockedDates`, and `supportUnlockedDates` fields in the returned subtask payload. Furthermore, the frontend Workspace page mapped the subtasks into merged task cards and tree nodes, but did not copy these unlock fields from the subtasks onto the merged task objects.
## ERR-033: Daily Report Log modal content overlapping card header border
- **Task:** T-012-008-11 Â· **Session:** session_011
- **File:** frontend/src/pages/workspace/components/TaskDailyReportModal.tsx Â· **Line:** 674
- **Symptom:** In the Daily Report modal, the headers of the left and right columns ("Daily Report Log" and "à¸ªà¸£à¸¸à¸›à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸§à¸±à¸™à¸—à¸µà¹ˆ...") are positioned too close to the bottom border of the DialogTitle header.
- **Root Cause:** The `DialogContent` had a top padding `pt` of `3` (24px). Because the dialog header has a bottom border, 24px of top padding does not provide enough visual separation (breathing room), making the layout look cramped and visually overlapping.
- **Resolution:** Increased `pt` on the `<DialogContent>` wrapper from `3` (24px) to `5` (40px) in `TaskDailyReportModal.tsx`. This shifts the entire layout grid of the modal down by 16px, cleanly separating the content columns from the dialog title border.

## ERR-034: MUI Grid negative top margin pulls modal header columns into the DialogTitle border
- **Task:** T-012-008-12 Â· **Session:** session_011
- **File:** frontend/src/pages/workspace/components/TaskDailyReportModal.tsx Â· **Line:** 680
- **Symptom:** Even when padding-top of DialogContent was increased, the "Daily Report Log" header row (specifically the yellow unlock button) was still touching the bottom border of the DialogTitle header bar and looked compressed.
- **Root Cause:** Material-UI `<Grid container spacing={4}>` applies a negative margin-top (`mt: -32px`) to offset spacing inside items. Since the header row contains the very first components inside the grid items, this negative margin pulled the entire row 32px upward, nullifying the DialogContent padding-top.
- **Resolution:** Override the negative top margin by adding `sx={{ mt: 1.5 }}` (12px top margin) directly to `<Grid container spacing={4}>` in `TaskDailyReportModal.tsx`, and reverted DialogContent `pt` to `3` (24px). The net top space is now `24px (pt) + 12px (mt) + 32px (item padding) = 68px`, which positions the header row cleanly below the DialogTitle divider without overlapping.

## ERR-035: FM locked out of subtasks daily reports even after supervisor unlock approval
- **Task:** T-012-008-13 Â· **Session:** session_011
- **File:** backend/src/api/routes/tasks.routes.ts, frontend/src/pages/daily-reports/index.tsx Â· **Line:** 546 (backend), 509, 1053, 2577 (frontend)
- **Symptom:** After the supervisor approves an unlock request for a subtask, the Foreman (FM) still gets the backdated request dialog when attempting to click on or edit that date in the Daily Reports page, and is unable to submit the report.
- **Root Cause:**
  1. In the backend endpoint `/tasks/assigned-subtasks`, the subtask documents are fetched from Firestore and returned directly as JSON without using `taskConverter.fromFirestore` or parsing Timestamp objects in fields like `unlockedDates` and `unlockRequests`. Thus, `unlockedUntil` is serialized to JSON as `{ _seconds, _nanoseconds }`.
  2. In the frontend `daily-reports/index.tsx`, the checks for `unlockUntil` used `new Date(unlockInfo.unlockedUntil)`. When given the raw `{ _seconds, _nanoseconds }` object, `new Date()` results in `Invalid Date`, which fails the `unlockUntil > new Date()` comparison, making the client think the date is locked.
- **Resolution:**
  1. Updated the backend `/tasks/assigned-subtasks` mapping function to parse Firestore timestamps inside subtask `unlockedDates`, `unlockRequests`, `supportUnlockedDates`, and `supportUnlockRequests` using `parseFirestoreTimestamp` into ISO strings.
  2. Updated the frontend `daily-reports/index.tsx` file to parse `unlockedUntil` using the existing `parseSafeDate` utility (which handles both string ISO dates and raw timestamp objects) instead of calling `new Date(...)` directly.

## ERR-036: Subtask fields modifications not tracked or audited (Lack of edit history logs in subtasks collection)
- **Task:** T-012-008-14 Â· **Session:** session_012
- **File:** backend/src/models/Task.ts, backend/src/services/TaskService.ts Â· **Line:** 57 (Task.ts), 911 (TaskService.ts)
- **Symptom:** Modifications to subtasks (such as `subtaskName`, `assignees`, `dueDate`, or `isSupportRequest`) by supervisors are not audited or tracked, making it impossible for administrators to check the edit history of subtasks.
- **Root Cause:** The subtask update code inside the `TaskService.updateTask()` transaction block simply updated the fields in Firestore without comparing the differences with the existing subtask document or writing audit records. Subtask models also lacked type support for `dueDate` and `editHistory` fields.
- **Resolution:**
  1. Updated `Task.ts` model interface to add `EditHistoryRecord` and include optional `dueDate` and `editHistory` in `Subtask` and `UpdateTaskInput`.
  2. Implemented `compareDates` and `compareAssignees` helper methods in `TaskService.ts`.
  3. Modified the transaction update block in `TaskService.updateTask()` to query the existing subtask document, compare its fields with the updated payload, and construct a list of differences.
  4. Appended the edit history record to the `editHistory` array on the subtask document using `admin.firestore.FieldValue.arrayUnion`.
  5. Updated the subtask document reading logic in `TaskService.getSubtasks()` and `TaskService.getTasks()` to safely deserialize Firestore Timestamps inside `dueDate` and the `editHistory` changes array back to JavaScript Dates.

## ERR-037: Unrestricted route access bypass on dashboard, daily reports, wage calculation, scan data, and workspace pages
- **Task:** T-015 Â· **Session:** session_013
- **File:** frontend/src/pages/dashboard/index.tsx, frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/list.tsx, frontend/src/pages/daily-reports/new.tsx, frontend/src/pages/daily-reports/[id]/edit.tsx, frontend/src/pages/daily-reports/[id]/history.tsx, frontend/src/pages/management/index.tsx, frontend/src/pages/wage-calculation/index.tsx, frontend/src/pages/wage-calculation/[id].tsx, frontend/src/pages/scan-data-monitoring/index.tsx, frontend/src/pages/scan-data-monitoring/[id].tsx, frontend/src/pages/workspace/index.tsx, frontend/src/pages/workspace/requests.tsx
- **Symptom:** Users with unauthorized roles could bypass navigation menu restrictions by typing page URLs directly (e.g. site engineers could access the Workspace board or Wage Calculation, and office engineers could access Daily Reports).
- **Root Cause:** Page components did not specify `requiredRoles` on their `<ProtectedRoute>` wrappers or did not use `<ProtectedRoute>` wrappers at all, allowing any authenticated user to load the pages directly via the address bar.
- **Resolution:** Enforced strict route-level access checks by wrapping all specified page components with `<ProtectedRoute requiredRoles={...}>` and `<Layout>` components containing matching role access rules, redirecting unauthorized users to `/unauthorized`.

## ERR-038: Support Daily Report submissions not triggering Workspace notifications for Support Lead (WH)
- **Task:** T-012-008-19 Â· **Session:** session_014
- **File:** backend/src/services/TaskService.ts, backend/src/api/routes/notifications.routes.ts, backend/src/models/Notification.ts, frontend/src/services/notificationService.ts
- **Symptom:** When a Foreman submissions a daily report for a Support subtask card, the Support team lead (role/department WH) does not receive any notification on their Workspace board or notification bell.
- **Root Cause:** 
  1. The backend notification generation code (`submitDailyReport`) did not forward the `isSupportReport` flag into the saved Firestore notification document.
  2. The notification listing and reading APIs filtered all notifications strictly by `projectId` belonging to the user's `projectLocationIds`. Since WH users are from the Warehouse/Support department, they did not have all construction site project IDs in their profile, thus blocking all support notifications.
- **Resolution:** 
  1. Added optional `isSupportReport` boolean field to the backend and frontend `Notification` models.
  2. Updated `submitDailyReport` in `TaskService.ts` to populate the `isSupportReport` field on generated notification documents.
  3. Modified `/api/notifications` GET `/` and POST `/read-all` routes to allow users with the `WH` department to view and mark as read all notifications flagged with `isSupportReport: true` regardless of project location ID scoping.

## ERR-039: Axios 500 FAILED_PRECONDITION when marking subtask notifications as read
- **Task:** T-012-008-19 Â· **Session:** session_014
- **File:** backend/src/api/routes/notifications.routes.ts Â· **Line:** 175
- **Symptom:** Clicking a subtask card returns a 500 error: `AxiosError: Request failed with status code 500` inside console. Backend logs show `Unhandled error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here...`
- **Root Cause:** In `/api/notifications/subtask/:subtaskId/read`, the query used `.where('subtaskId', '==', targetSubtaskId).where('createdAt', '>=', sevenDaysAgo)`. This combined equality and inequality filters across different fields, which requires a composite index that was not present in the Firestore configuration.
- **Resolution:** Modified the Firestore query to filter by `subtaskId` equality only (which uses the default automatic index), and applied the `createdAt >= sevenDaysAgo` date range filter in memory (`filter(...)` on the returned snapshot docs), successfully removing the composite index requirement.




## ERR-040: rejectTask 500 — Firestore transaction reads-before-writes violation
- **Task:** T-014-002-01 · **Session:** session_current
- **File:** backend/src/services/TaskService.ts · **Line:** 304 (original)
- **Symptom:** POST /api/tasks/:id/reject returns 500. Backend logs: `Firestore transactions require all reads to be executed before all writes.`
- **Root Cause:** In rejectTask(), both Case A (subtask reject) and Case B (task reject) called transaction.get() AFTER transaction.set()/update() calls. Firestore transactions strictly enforce: all reads must complete before any writes begin.
- **Resolution:** Restructured the entire transaction block to hoist ALL reads to the top: (1) read taskRef, (2) conditionally read subtaskRef if present, (3) read all subtasks collection. Then all computes and writes follow. Both cases now share the pre-fetched subtasksQuery snapshot, eliminating the mid-write read.

## ERR-041: Rejected subtask (rework, progress=0) appears in In Progress instead of Upcoming
- **Task:** T-014-003-01 · **Session:** session_current
- **File:** backend/src/services/TaskService.ts · Line 330 (original) | frontend/src/pages/workspace/index.tsx · Line 1036 (original)
- **Symptom:** After rejecting a subtask, the parent task card appears in the In Progress column even though dailyProgress = 0 and all subtasks were reset.
- **Root Cause:** Two bugs in tandem: (1) Backend hardcoded status: ''in-progress'' for the parent task on subtask reject, regardless of calculated averageProgress. (2) Frontend mapped ework status unconditionally to the In Progress column without checking progress value.
- **Resolution:** (1) Backend: derive parentStatus dynamically — averageProgress>=100 ? for-checking, >0 ? in-progress, 0 ? upcoming. (2) Frontend: added rework+progress=0 ? upcoming and rework+progress>0 ? in-progress branches before the column filter check.


## ERR-042: updateSubtask/deleteSubtask 404 (Not Found) when parent task ID contains compound format
- **Task:** T-014-004-01 Ã‚Â· **Session:** session_current
- **File:** backend/src/services/TaskService.ts Ã‚Â· **Line:** 1176, 1231
- **Symptom:** When editing the Duedate or deleting a subtask on the frontend, the operation fails with AxiosError: Request failed with status code 404.
- **Root Cause:** The `updateSubtask` and `deleteSubtask` services called `resolveRefs(id.includes('__') ? id : `${id}__${subtaskId}`)`. When `id` was a compound task ID (e.g. `woId__catId__taskId`), `id.includes('__')` was true, so it passed `id` alone to `resolveRefs`, completely ignoring `subtaskId`. `resolveRefs` then split the ID into 3 parts, resolving `taskRef` but leaving `subtaskRef` as `undefined` (resulting in a 404). When `id` was a simple ID, it passed `${id}__${subtaskId}` (2 parts), which threw `Invalid ID format` 400.
- **Resolution:** Updated `updateSubtask` and `deleteSubtask` to determine the correct `lookupId` first: if `id` contains `__`, we check parts length (if >= 4 parts, use `id` as is, else append `__${subtaskId}`); if `id` does not contain `__`, we pass `subtaskId` directly to query it via collectionGroup.



## ERR-043: updateSubtask/deleteSubtask 404 (Not Found) when parent task ID contains single underscores
- **Task:** T-014-004-02 Ã‚Â· **Session:** session_current
- **File:** backend/src/services/TaskService.ts Ã‚Â· **Line:** 464, 607, 657, 913, 1144, 1176, 1238, 2134
- **Symptom:** When editing the Duedate or deleting a subtask on the frontend, the operation fails with AxiosError: Request failed with status code 404. In some cases, task updates/deletes could fail similarly.
- **Root Cause:** The frontend sends composite task IDs (and subtask IDs) using single underscores `_` (e.g. `woId_catId_taskId`) instead of double underscores `__`. Because the backend had hardcoded `id.includes('__')` and `id.split('__')` in `resolveRefs` and all other resource-parsing methods, it failed to identify and parse these single-underscore composite IDs. This led to wrong Firestore paths, missing references, and 404/400 errors.
- **Resolution:** Introduced a unified private helper `parseCompositeId` in `TaskService.ts` that tries splitting by `__` first, and falls back to `_` if length is less than 3. Refactored all composite ID checks (`id.includes('__')`) and splits (`id.split('__')`) to use this helper. This makes all task and subtask services completely resilient to both single-underscore and double-underscore composite IDs.



## ERR-044: Subtask dueDate updates not visible on cards due to missing dueDate mapping and parent task updates
- **Task:** T-014-004-03 Ã‚Â· **Session:** session_current
- **File:** frontend/src/pages/workspace/index.tsx Ã‚Â· **Line:** 545, 682 | backend/src/services/TaskService.ts Ã‚Â· **Line:** 1238, 1332, 1368
- **Symptom:** After editing the Duedate of a subtask card, the updated Duedate is not visible on the card (it continues showing the old Duedate).
- **Root Cause:** Two bugs: (1) On the frontend, `subtaskCards` and `handleSubtaskCardClick` spread the parent `...task` into the `mergedTask` card but did not copy `dueDate: subtask.dueDate`. Thus, the subtask card always displayed the parent task's `dueDate`. (2) On the backend, `updateSubtask` and `deleteSubtask` updated the subtask document in Firestore but did not recalculate and update the parent task's `dueDate`, `status`, and `dailyProgress` aggregates.
- **Resolution:** (1) Frontend: Added `dueDate: subtask.dueDate` in the merged card object mappings in `index.tsx`. (2) Backend: Added `updateParentTaskAggregates` private helper in `TaskService.ts` to query all active subtasks, recalculate the parent's `dailyProgress`, `status`, and `dueDate` (maximum Duedate), and update the parent task document. Called this helper in both `updateSubtask` and `deleteSubtask`.


## ERR-045: Support subtask reject resets progress and revision instead of moving to Completed
- **Task:** T-016-001-01 · **Session:** session_current
- **File:** backend/src/services/TaskService.ts · **Line:** 250
- **Symptom:** Rejecting a support request subtask resets progress to 0% and creates a rework revision (rev01, etc.), which sends the support request card back to the Upcoming column.
- **Root Cause:** The backend rejectTask implementation treated all subtasks the same, unconditionally creating a new revision, setting progress to 0, and status to 'rework', which is incorrect for support tasks that are considered finished by the WH department upon 100% progress.
- **Resolution:** (1) Backend: Updated rejectTask in TaskService.ts to check if the subtask has isSupportRequest === true. If so, update the subtask status to 'completed' and progress to 100, recalculate parent progress, record history as 'reject_subtask_completed', and skip revision creation. (2) Frontend: Configured TaskRejectModal.tsx to dynamically hide assignee selection and make reject reason optional when rejecting a support task, showing an informative blue info box explaining that the support card will be marked as Completed. (3) Frontend: Safely cast subtask.dueDate to string in index.tsx to fix compiler errors.

## ERR-046: Axios 500 FAILED_PRECONDITION when fetching subtasks list in workspace/requests
- **Task:** T-012-009-04 · **Session:** session_current
- **File:** backend/src/api/routes/tasks.routes.ts · **Line:** 724, 833
- **Symptom:** Clicking the history icon on a daily report or request row in workspace/requests.tsx triggers a 500 FAILED_PRECONDITION error: "The query requires a COLLECTION_GROUP_ASC index for collection tasks and field taskId".
- **Root Cause:** The `/requests-all` and `/reports-all` API endpoints returned the short `taskId` (e.g. `DBD-0001-001`). When the frontend clicked history, it called `getSubtasks(row.taskId)` using this short ID, forcing the backend's `getSubtasks()` method to fallback to an unindexed collectionGroup query: `afterSaleDb.collectionGroup('tasks').where('taskId', '==', taskId)`.
- **Resolution:** Modified the `/requests-all` and `/reports-all` endpoints in `tasks.routes.ts` to return the composite task ID (`workOrderId__categoryId__taskId`) as `taskId`: `taskId: \`\${parts[1]}__\${parts[3]}__\${parts[5]}\``. Since this composite ID contains `__`, the backend's `getSubtasks()` resolves it by a direct document path reference, bypassing the collection group query and resolving the 500 error.

## ERR-047: Inconsistent or basic status color indicators and tooltips on task due date badges
- **Task:** T-014-005-01 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCard.tsx · **Line:** 42, 73
- **Symptom:** Task card due date badges did not distinguish between overdue and within-3-days, lacked yellow color indicators for within-7-days, lacked blue color for other dates within the current month, and lacked slate grey fallback for outside conditions. White text on yellow badges was also unreadable.
- **Root Cause:** The `getDueDateColor` and `getDueDateTooltip` helpers grouped all dates <= 3 days (including overdue dates) into the red badge category and colored all dates > 7 days in blue regardless of the month, which did not align with workspace management expectations. The Typography text color was hardcoded to `#ffffff`.
- **Resolution:** Restructured `getDueDateColor` and `getDueDateTooltip` in `TaskCard.tsx` to explicitly check: `diffDays < 0` for Red (Overdue), `diffDays <= 3` for Orange (within 3 days), `diffDays <= 7` for Yellow (within 7 days), same month/year as today for Blue (current month), and `#9ca3af` for Grey (comfort zone / no conditions). Configured dynamic text coloring inside the due date Badge wrapper: using dark `#1c1e2b` text for Yellow background, and white `#ffffff` text for other backgrounds.

## ERR-048: Standard due date badge styling remains unchanged when subtask reaches 100% progress
- **Task:** T-014-005-02 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCard.tsx · **Line:** 48, 79, 382
- **Symptom:** When a task card is 100% completed (e.g. inside the Completed column), the due date badge continues to render as 'Due: DD/MM/YYYY' and uses the standard remaining days status colors (Red/Orange/Yellow/Blue/Grey), which fails to display actual scheduling outcomes.
- **Root Cause:** There was no custom logic checking if `task.dailyProgress === 100` within `getDueDateColor`, `getDueDateTooltip`, or the Typography render blocks.
- **Resolution:** Modified `getDueDateColor`, `getDueDateTooltip`, and Typography rendering inside `TaskCard.tsx` to handle `task.dailyProgress === 100`: comparing the completion date (subtask `updatedAt`) relative to the `dueDate`. If completed before/on due date, colors green (`#10b981`) and labels as "เสร็จก่อนแผน X วัน" or "ตรงตามแผน". If completed late, colors red (`#ef4444`) and labels as "เลยกำหนด X วัน". Tooltip updated to present detailed comparison metrics.

## ERR-049: Workspace task cards display exact due date instead of relative status messaging, hiding date in tooltip
- **Task:** T-014-005-03 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCard.tsx · **Line:** 114, 386
- **Symptom:** Task card due date badges display the absolute due date (e.g. 'Due: 31/05/2026') for non-completed cards, which does not convey scheduling urgency at first glance, and tooltips repeat redundant date explanation instead of showing the clean absolute due date.
- **Root Cause:** The `getDueDateTooltip` method rendered descriptive texts like 'เหลือเวลา 4 - 7 วัน' for pending tasks, and the Typography JSX returned `Due: DD/MM/YYYY` directly on the card, rather than showing relative day counts on the card and the absolute date inside the tooltip.
- **Resolution:** Modified `getDueDateTooltip` in `TaskCard.tsx` to return `Due: DD/MM/YYYY` for non-completed subtasks. Modified Typography rendering logic in `TaskCard.tsx` JSX to display relative messages: "เลยกำหนดส่ง X วัน" (Red), "ใกล้ถึงใน X วัน" (Orange/Yellow), "เหลือ X วัน" (Blue/Grey), or "ไม่ระบุ" if no due date.

## ERR-050: React Unhandled Runtime Error: Rendered fewer hooks than expected
- **Task:** T-016-001-01 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 1056, 1088
- **Symptom:** Unhandled Runtime Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
- **Root Cause:** Conditional calls of the `useWatch` hook were introduced inside JSX conditional path blocks (e.g. `{!isSupportPickup && !isEdit && useWatch(...) === 'subtask' && (...)` and `{(isEdit || useWatch(...) === 'task') && (...)`). When JS short-circuiting evaluated to false, the hooks were not run, violating React's Rules of Hooks (hooks must be called at the top level of the component and in the exact same order on every render).
- **Resolution:** Declared a single `createModeWatch = useWatch({ control, name: 'createMode' })` hook at the level of `TaskCreateModal.tsx` adjacent to other hook declarations, and referenced `createModeWatch` inside the conditional JSX rendering logic instead of calling the inline hook directly.

## ERR-051: Subtasks section visible and throwing validation errors in Task creation mode
- **Task:** T-016-001-02 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 170, 220, 619, 1110
- **Symptom:** When the user selects "สร้างงานหลัก (Tasks)" mode inside the task creation modal, the "รายการงานย่อย (Subtasks)" section is still visible and displays form validation errors ("กรุณาระบุชื่องานย่อย", "กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน", "รูปแบบวันที่ไม่ถูกต้อง") preventing form submission.
- **Root Cause:** The subtasks container Grid was rendered unconditionally in JSX. Additionally, the form defaults and toggle switch initialized the `subtasks` array with one empty subtask object (`[{ subtaskName: '', assignees: [], dueDate: null, isSupportRequest: false }]`). Since the array was not empty, Zod validated the empty subtask element, which failed validation.
- **Resolution:** Wrapped the subtasks grid in a conditional block to only render when `(isEdit || createModeWatch === 'subtask' || isSupportPickup)`. Changed the default form values and toggle onChange reset logic to set `subtasks` to an empty array `[]` when `createMode` is `'task'`.

## ERR-052: Task creation confirmation popup displays empty due date row
- **Task:** T-016-001-03 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 1465
- **Symptom:** The confirmation modal dialog displays a "ครบกำหนด" (Due Date) row showing "-" when submitting a new Task creation, which is unnecessary and confusing as main Tasks are created with no due date initially.
- **Root Cause:** The confirmation dialog JSX rendered the "ครบกำหนด" row unconditionally inside the main task info rendering block.
- **Resolution:** Removed the "ครบกำหนด" row from the confirmation dialog's main task detail view in `TaskCreateModal.tsx`.

## ERR-053: Standard/Outlined MUI buttons next to selectors and titles lacked premium feel
- **Task:** T-016-001-04 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 492, 986, 1064, 1126
- **Symptom:** The add buttons ("สร้างหมวดหมู่หลัก", "สร้างหมวดหมู่ย่อย", "เพิ่มงานย่อย") in the task creation modal looked basic, lacking a premium feel, consistent elevation, and micro-interactions matching the Figma/Reference design.
- **Root Cause:** The buttons were styled with default MUI outlined styles, standard grey/blue colors, and small border radiuses with no shadows or transition effects.
- **Resolution:** Defined a custom `addButtonStyle` in `TaskCreateModal.tsx` specifying white background, rounded corners (border-radius: 12px), slate dark typography, thin border `#e2e8f0`, soft drop shadow `0 2px 6px rgba(0,0,0,0.04)`, and smooth translation scale transition on hover and active. Applied this style to the three add buttons.

## ERR-054: Form inputs and selectors border radius unaligned with premium buttons styling
- **Task:** T-016-001-05 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 473, 821, 915, 1255
- **Symptom:** The form inputs (Location selector, Work Order selector, Category selector, Task Name textfield, and description textarea) in the task creation modal had a smaller border radius (`borderRadius: 2` which maps to 8px), making them look inconsistent next to the new premium 12px rounded buttons.
- **Root Cause:** Border radius on general inputs was configured with standard MUI theme multiplier value `2` under `inputStyles`, and inner DatePicker layouts explicitly set `borderRadius: 2`.
- **Resolution:** Modified `borderRadius` properties to `'12px'` in the central `inputStyles` config, DatePicker inner `InputProps.sx` styles, and the task name editing support button to establish visual consistency.

## ERR-055: DatePicker input fields show bottom underline and sharp bottom corners
- **Task:** T-016-001-06 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 473, 899, 1238
- **Symptom:** The DatePicker input field (Due Date) in the task creation modal shows a grey bottom underline and sharp bottom corners, which does not match the clean, fully-rounded (12px), flat appearance of other form fields.
- **Root Cause:** The DatePicker component used a custom `InputProps` definition with inline styles that conflicted with the main `inputStyles` config, and MUI X's internal input merger ignored the nested `InputProps.sx` styles, leaving the default MUI FilledInput underline and sharp corners active.
- **Resolution:** Removed the conflicting `InputProps` overrides from both DatePicker elements to let them inherit the main `inputStyles` directly. Added explicit corner rules (`borderBottomLeftRadius`, etc.) with `!important` to the central `inputStyles` definition to guarantee rounding over MUI's default overrides.

## ERR-056: Delete subtask button is hidden for newly added subtask rows during task creation
- **Task:** T-016-001-07 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 1136
- **Symptom:** In the task creation modal, after clicking "เพิ่มงานย่อย" (Add Subtask) multiple times, no delete (X) button is displayed next to any of the subtask rows, making it impossible for the user to delete any added rows.
- **Root Cause:** The visibility of the delete button was conditioned on `!item.id`. However, in `react-hook-form`'s `useFieldArray`, `item.id` is an auto-generated unique ID for key rendering which is ALWAYS defined on the client side. Thus, the check evaluated to `false` for every row.
- **Resolution:** Modified the visibility condition of the delete button to check `!item.subtaskId` instead of `!item.id`. Since database-persisted subtasks have `subtaskId` and newly added client-side subtasks do not, this correctly renders the delete button for all newly added subtasks.

## ERR-057: Subtasks not deleted from Firestore database during task editing
- **Task:** T-016-001-08 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 141, 172, 394
- **Symptom:** Subtasks removed from the UI inside the task edit modal were not deleted from the Firestore database, remaining present on the board after the task was saved.
- **Root Cause:** The subtask deletion logic only updated the local react-hook-form state array using `remove(index)`. The modal lacked any database integration or tracking of deleted subtask IDs, so the backend API was never notified to delete the documents.
- **Resolution:** Added a `subtasksToDelete` state in `TaskCreateModal.tsx` to collect subtask IDs removed in Edit mode. Updated `onConfirmSubmit` to sequentially call `taskService.deleteSubtask` for each accumulated ID in `subtasksToDelete` before submitting the task updates.

## ERR-058: Missing taskName and Switch toggle with broken layout due to corrupted replace block in TaskCreateModal.tsx
- **Task:** T-016-001-09 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 929-1367
- **Symptom:** The task edit/create modal failed to compile due to broken JSX tags, the main "ชื่องาน *" text field was missing in the normal workflow, and the toggle switch for subtasks had disappeared.
- **Root Cause:** A corrupted replacement block in the previous turn failed to close the `renderOption` callback in the `categoryName` Autocomplete component and duplicated elements at the bottom of the form, while deleting the `taskName` field entirely.
- **Resolution:** Repaired the layout by cleanly rebuilding the Normal Workflow Layout in `TaskCreateModal.tsx`. Restored `taskName` Controller, properly closed `categoryName` Autocomplete, positioned the iOS-styled toggle Switch below `description`, and arranged the subtask card layout so `ชื่องานย่อย` and `วันที่ครบกำหนด` are side-by-side on Row 1, and `ผู้รับผิดชอบ` takes the full width on Row 2 with consistent curvature (24px) and height (40px) across all elements.

## ERR-059: Tasks without subtasks hidden in Structure Tree and unable to select existing tasks to add subtasks under
- **Task:** T-016-001-10 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/WorkspaceTree.tsx, frontend/src/pages/workspace/index.tsx, frontend/src/pages/workspace/components/TaskCreateModal.tsx
- **Symptom:** 1) Tasks created without subtasks did not show up in the folder structure (Workspace Structure Tree). 2) Toggling 'เพิ่มงานย่อย (Subtasks)' in the task creation dialog required typing a new task name instead of choosing an existing task, which made it impossible to add subtasks to pre-existing tasks from the creation form.
- **Root Cause:** 1) WorkspaceTree.tsx's buildTree logic returned early if subtasks.length === 0, and the categories and work orders filters required subtaskCount > 0. Additionally, filterTasksByRole in index.tsx discarded all tasks with 0 subtasks. 2) TaskCreateModal.tsx rendered a text field instead of a dropdown for taskName when adding subtasks, and always created a new task instead of calling updateTask with the new subtasks list.
- **Resolution:** 1) Modified buildTree in WorkspaceTree.tsx to include tasks with 0 subtasks if they match the department/support view, and updated grouping filters to check cat.tasks.length > 0 and wo.categories.length > 0. Updated filterTasksByRole in index.tsx to retain tasks with 0 subtasks that meet user project permissions. 2) Added state and effects to load project tasks in TaskCreateModal.tsx, watched categoryName, and rendered taskName as an Autocomplete dropdown of tasks in the chosen category. When selected, it locks the name, fetches its existing subtasks, and submits via taskService.updateTask to append the new subtasks.

## ERR-060: Left-side Workspace Structure Tree does not filter dynamically when selecting top workspace filter tabs
- **Task:** T-012-008-22 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/WorkspaceTree.tsx, frontend/src/pages/workspace/index.tsx · **Line:** 36, 47, 59-135 (WorkspaceTree.tsx), 909, 1235 (index.tsx)
- **Symptom:** Selecting top date filter tabs ("This Month", "This Week", "Today") filters the Kanban board cards successfully, but the left-side Workspace Structure Tree (showing Work Orders, Categories, Tasks, and Subtasks) remains static and does not reflect the selected date filters.
- **Root Cause:** The `WorkspaceTree` component received only the raw list of `tasks` and had no reference to the `activeTab` filter state, so its internal `buildTree` logic always rendered all active tasks/subtasks regardless of the selected time range.
- **Resolution:** Modified `WorkspaceTreeProps` to accept `activeTab?: string`. Added a `checkDateMatch` helper function inside `WorkspaceTree.tsx` that replicates the date filtering logic used by the Kanban board columns. Integrated this date check inside the `buildTree` logic to exclude non-matching subtasks, and to hide empty tasks unless they have 0 subtasks and their own due date matches the filter. Finally, updated the dependency arrays of `mainTree` and `supportTree` memoization blocks to include `activeTab`, and passed the `activeTab` state from `index.tsx` into both the desktop and mobile instances of the `WorkspaceTree` component.

## ERR-061: Subtask submission forces users to select an assignee (assignees) even if they don't know who to assign yet
- **Task:** T-012-008-23 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx, backend/src/api/routes/tasks.routes.ts, backend/src/services/TaskService.ts, frontend/src/pages/workspace/components/TaskCard.tsx · **Line:** 57, 829, 1403 (TaskCreateModal), 1330 (tasks.routes.ts), 957, 1086-1135 (TaskService.ts), 456 (TaskCard)
- **Symptom:** When creating or editing subtasks, the form forces users to assign at least one worker/foreman. If they submit the form without selecting an assignee, it displays a validation error ("กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน") and prevents submission. In addition, the backend routes throw a 400 error if `assignees` is missing or empty on single subtask creation.
- **Root Cause:** 1) The Zod validation schema in `TaskCreateModal.tsx` explicitly specified `.min(1, 'กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน')` on the `assignees` array. 2) The backend route `POST /api/tasks/:id/subtasks` validated `assignees.length === 0` and rejected it. 3) The `updateTask` Firestore service code looped over `st.assignees` and used Firestore's `FieldValue.arrayUnion` spreading the assignees array, which would crash at runtime when the list was empty or undefined.
- **Resolution:** 1) Changed `assignees` validation schema in `TaskCreateModal.tsx` to `.optional().default([])` and removed the required asterisks (`*`) from the assignee input labels in JSX. 2) Removed the non-empty assignee checks from the `POST /api/tasks/:id/subtasks` backend route and mapped missing assignees to `[]`. 3) Guarded the assignee loops and Firestore `arrayUnion` calls in `TaskService.ts` to check if `assignees` is defined and contains elements before spreading it into `arrayUnion`. 4) Updated the UI of `TaskCard.tsx` to render an italicized placeholder `"ยังไม่ได้มอบหมาย"` (Unassigned) in grey color instead of rendering a blank area when the subtask has no assignees.

## ERR-062: Category and WorkOrder deletion fails with AxiosError 404 if Firebase A configuration document is missing
- **Task:** T-012-008-21-02 · **Session:** session_current
- **File:** backend/src/services/ProjectConfigService.ts · **Line:** 116, 290
- **Symptom:** Attempting to delete a Category or WorkOrder in the Workspace tree UI fails with a 404 "Request failed with status code 404" popup. This happens if the corresponding configuration document in Firebase A's `categoryConfigs` or `workOrderConfigs` collection has already been deleted, while child structures and tasks still exist in Firebase B's `afterSaleDb`.
- **Root Cause:** The backend deletion methods `deleteCategory` and `deleteWorkOrder` checked for the existence of the Firebase A configuration document first. If missing, they immediately threw an `AppError('...', 404)`. This prevented users from cleaning up and deleting the orphaned tree nodes from the Firebase B database.
- **Resolution:** Modified `deleteCategory` and `deleteWorkOrder` to be resilient to missing Firebase A configuration documents:
  1. For `deleteCategory`: If the A-config is missing, it performs a lookup in B's `categories` subcollection group using the tree node ID (which is the B category ID). It extracts the `catName` and parent `workOrderCode` directly from B. If resolved, it uses this metadata to verify child subtask deletability and batch-deletes all Firebase B tasks/subtasks under it, skipping the Firebase A deletion.
  2. For `deleteWorkOrder`: If the A-config is missing, it verifies if there are matching workOrders in Firebase B. If so, it verifies child subtask deletability and batch-deletes Firebase B records, skipping Firebase A deletions.
  If the records cannot be found in both Firebase A and Firebase B, it throws a 404 error.

