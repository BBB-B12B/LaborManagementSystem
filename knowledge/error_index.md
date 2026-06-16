# Error Index

## ERR-001: AssigneeName Resolves to Null in generateForEmployee
- **Task:** T-001-001-01 · **Session:** session_000
- **File:** backend/src/services/reconciliation/ReconciliationService.ts · **Line:** 1286
- **Symptom:** In the reconciliation records table, the assignee name (ผู้รับผิดชอบ) is blank or displays as `--` for active daily reports, even though Thai names are stored in the database.
- **Root Cause:** The `generateForEmployee` function resolved the assignee name using only English fields `fullNameEn || data.Fullnameen`. If a user document in the `users` collection only had the `name` field set (containing their Thai name, e.g. "มานิตย์ สถิตย์วัฒน์"), the assignee name resolved to `undefined` / `null`.
- **Resolution:** Modified `generateForEmployee` to fetch name using `data.Fullname || data.name || data.fullNameEn || data.Fullnameen`, making it fully robust and consistent with `generateForProject` and Cloud Functions.

## ERR-002: AssigneeName Resolves to Null Due to User Field Case-Sensitivity & Stale Firestore Records
- **Task:** T-001-001-02 · **Session:** session_000
- **File:** backend/src/services/reconciliation/ReconciliationService.ts & functions/src/index.ts · **Line:** 161, 1063, 1277 (Backend) & 518, 1093, 1170, 1642 (Cloud Functions)
- **Symptom:** Even after adding robust fallback name paths, the UI still displays assignee names (ผู้รับผิดชอบ) as `--` / blank for records generated via daily reports.
- **Root Cause:** 
  1. The code attempted to query the `users` collection using the filter `.where('Employeeid', '==', assigneeId)`. However, the user documents store the employee ID as a lowercase `employeeId` field, and their Document IDs are exactly equal to their employee IDs. Because Firestore queries are case-sensitive, this query returned 0 documents, resulting in `null` assignee names.
  2. Stale Firestore documents that were already reconciled prior to the code changes still stored `assigneeName: null`.
- **Resolution:**
  1. Created a robust helper `getAssigneeName(assigneeId)` that performs a direct doc ID lookup first (high performance), with fallbacks to lowercase `employeeId` and uppercase `Employeeid` queries. Updated both Backend Reconciliation Service and Cloud Functions to use this helper.
  2. Wrote and ran a database backfill script `backend/src/scripts/backfillNullAssigneeNames.ts` to retroactively update all 45 existing reconciliation records in the database with the correct resolved assignee names.

## ERR-003: Cloud Functions Out of Sync causing Null Assignee Names
- **Task:** T-001-001-03 · **Session:** session_000
- **File:** functions/lib/index.js & functions/src/index.ts · **Line:** 485
- **Symptom:** After applying the `getAssigneeName` fix (ERR-002), a new reconciliation record (`REC_411435_2026-05-22`) created by automated Cloud Functions still had `assigneeName: null`.
- **Root Cause:** Although the TypeScript source code (`functions/src/index.ts`) was updated, the Cloud Functions running in GCP were not deployed with the compiled JavaScript (`functions/lib/index.js`). Thus, they were still running old logic that failed to resolve names for case-insensitive employee queries.
- **Resolution:** Ran `npm run build` inside `functions/` to compile the TypeScript code to JavaScript. Advised the user to run `firebase deploy --only functions` to deploy the latest compiled logic to GCP.

## ERR-004: Daily Report Photos Displayed for Leave (ลางาน) Segments
- **Task:** T-001-001-04 · **Session:** session_004
- **File:** frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx · **Line:** 760
- **Symptom:** When displaying details for a worker in the reconciliation modal, segments where the worker took leave (e.g. afternoon half-day leave) displayed Daily Report photos (IN/OUT) which actually belonged to the task daily report, causing confusion because the worker did not work during that segment.
- **Root Cause:** In the segment row generation logic `buildSegmentRows`, `photoIn` and `photoOut` were populated using the task's daily report photo map regardless of whether the worker was on leave. Thus, even if `isThisSegmentLeave` was true, the photos were still included and rendered.
- **Resolution:** Modified `buildSegmentRows` to explicitly set `photoIn = null` and `photoOut = null` when `isThisSegmentLeave` is true, ensuring no photos are displayed for segments in which the employee was on leave.

## ERR-005: Incorrect Working Segment Splitting and Leave Time Alignment for Partial-Day Leave
- **Task:** T-001-001-05 · **Session:** session_004
- **File:** frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx · **Line:** 581-766
- **Symptom:** In the reconciliation details modal, if an employee has a partial-day leave (e.g. worked `08:00 - 15:00` and took leave `15:00 - 17:00`), the entire afternoon work segment (`13:00 - 15:00`) is incorrectly labeled as "ลางาน (Leave)", and the leave period itself (`15:00 - 17:00`) is completely missing from the table.
- **Root Cause:** The old logic set the active state of standard work segments (`isMorningActive`, `isAfternoonActive`) by coupling them to `hasMorningLeave` / `hasAfternoonLeave`. If any leave existed in the afternoon (e.g. `15:00 - 17:00`), the entire afternoon work segment (`13:00 - 15:00`) was flagged as a leave segment. In addition, the leave itself was not rendered as its own distinct timeline row.
- **Resolution:** Refactored the segment builder `buildSegmentRows`:
  1. Decoupled leave entries from standard work segment active states. Standard work segments are now activated purely based on actual scheduled work hours (`dayShiftStart`/`dayShiftEnd`).
  2. Implemented an overlap check helper `isSegmentCoveredByLeave` to prevent rendering standard work segments that are fully covered (>=80% overlap) by a leave entry.
  3. Dynamically generated a separate segment for each leave entry in `row.leaveEntries`.
  4. Combined and chronologically sorted all segments (OT, work, and leave) by their expected start time.
  5. Set `isThisSegmentLeave` purely based on `seg.isLeaveSegment` and prevented leave segments from consuming fingerprint punches.

## ERR-006: Inconsistent Late/Early Leave Minutes due to Max Formula instead of Sum
- **Task:** T-001-001-06 · **Session:** session_007
- **File:** backend/src/services/reconciliation/ReconciliationService.ts & functions/src/index.ts · **Line:** 349, 421, 425 (Backend) & 247, 324, 328 (Cloud Functions)
- **Symptom:** In the work hour tracking table, the late/early leave minutes display is inconsistent with the detail modal. For example, if a worker is late in multiple segments (afternoon segment by 5 minutes and evening OT segment by 15 minutes), the table displays `สาย 15 น.`, whereas it should display `สาย 20 น.` (the total sum of all late periods).
- **Root Cause:** The segment-based classification logic in `ReconciliationService.classifyBySegments` and Cloud Functions `classifyBySegments` used `Math.max(maxLateMinutes, late)` and `Math.max(maxEarlyLeaveMinutes, early)` to compute the daily late/early leave minutes. This incorrect formula chose only the maximum late/early leave duration of a single segment instead of summing them up across all shifts/segments of the day.
- **Resolution:**
  1. Refactored the calculation in both backend and cloud function files to sum the late and early leave minutes across all segments of the day using `totalLateMinutes += late` and `totalEarlyLeaveMinutes += early`, and updated the respective variables to `totalLateMinutes` and `totalEarlyLeaveMinutes`.
  2. Modified the frontend table component `WorkHourComparisonTable.tsx` to color-code the capsules differently: kept **LATE (สาย)** as `PURPLE` and updated **EARLY LEAVE (ออกก่อน)** to `ORANGE` for visual distinction, helping admins easily identify different attendance behaviors.

## ERR-007: Mismatch in Summary Card Counts due to Leave Double Counting
- **Task:** T-001-001-07 · **Session:** session_007_summarycard_bugfix
- **File:** backend/src/services/reconciliation/ReconciliationService.ts & frontend/src/components/work-hour-monitoring/NormalBreakdown.tsx · **Line:** 1902 (Backend) & 35 (Frontend)
- **Symptom:** In the work hours monitoring page, the parent "สถานะปกติ" (Normal) card shows a count that is inconsistent with the sum of its three sub-breakdown cards. For example, parent card shows 9, but sub-cards sum to 10 (0 directly matched + 6 leaves + 4 corrected).
- **Root Cause:**
  1. A reconciliation record resolved to a leave state has status `'LEAVE'` and a valid `resolvedAt` timestamp.
  2. The breakdown cards calculated "ข้อมูลตรงกันตั้งแต่แรก" (pureMatchedCount) as `matchedCount - resolvedCount` (where `resolvedCount` is the total count of all records with `resolvedAt != null`). Since `resolvedCount` included resolved leave records, they were double-counted in both "ลา" and "แก้ไขแล้วจนปกติ", and also subtracted incorrectly from "ข้อมูลตรงกันตั้งแต่แรก".
- **Resolution:**
  1. Created a new backend statistic `resolvedMatchedCount` in `ReconciliationService.getStats` to query only corrected records currently having status `'MATCHED'`.
  2. Mapped `'abnormal_fixed'` status queries to strictly filter by `['MATCHED']` in `reconciliationController.ts`.
  3. Updated `NormalBreakdown.tsx` to calculate `pureMatchedCount` as `matchedCount - resolvedMatchedCount` and set the corrected card's count to `resolvedMatchedCount`, ensuring a mathematically perfect MECE partition where sub-cards always sum to the parent card's count.

## ERR-008: 1-Day Timezone Shift Discrepancy in Wage Period Calculation Query
- **Task:** T-003 · **Session:** session_007
- **File:** backend/src/services/wage/WagePeriodService.ts · **Line:** 162-163
- **Symptom:** During wage calculation for a period starting on e.g., April 27, 2026, the backend fetched reconciliation records starting from one day earlier (April 26) instead of the selected starting day.
- **Root Cause:** The code used `period.startDate.toISOString().split('T')[0]` and `period.endDate.toISOString().split('T')[0]` which evaluates using UTC dates. Since `startDate` was stored at local midnight (`2026-04-27 00:00:00 UTC+7`), the UTC representation was `2026-04-26 17:00:00Z`. The split operation extracted the UTC day portion (`'2026-04-26'`), causing a 1-day shift.
- **Resolution:** Replaced `.toISOString().split('T')[0]` with `.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })` which accurately extracts the local calendar day portion (`'2026-04-27'`) in the correct Bangkok timezone without any date shifting.

## ERR-009: Duplicate Wage Periods Filter Display in Work Hour Monitoring Page
- **Task:** T-003-001-01 · **Session:** session_007
- **File:** frontend/src/pages/work-hour-monitoring/index.tsx & frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx · **Line:** 76 (index.tsx) & 1229 (WorkHourComparisonTable.tsx)
- **Symptom:** When filtering by "All Projects" in the work hours tracking page, duplicate wage period date options are displayed in the dropdown since wage periods are created per project. Furthermore, if a wage period for one project was locked but others were not, the global `isLocked` state was insufficient to handle individual row-level locking.
- **Root Cause:**
  1. The page filter logic returned all wage periods directly when no project was selected, resulting in duplicate options for identical date ranges.
  2. The comparison table relied solely on the global `isLocked` prop instead of checking individual row-level locked status (`row.isLocked`).
- **Resolution:**
  1. Deduplicated wage period dropdown options by `startDate` + `endDate` when `project === 'all'`.
  2. Upgraded comparison table edit actions and Dialogs to evaluate both global `isLocked` and row-level `row.isLocked` or `selectedRow?.isLocked`.
## ERR-010: ScanDataMonitoring Page Compilation Fails due to Undefined currentTab Reference
- **Task:** T-008 · **Session:** session_021
- **File:** frontend/src/pages/scan-data-monitoring/index.tsx · **Line:** 313
- **Symptom:** Next.js frontend build fails with error `Cannot find name 'currentTab'`.
- **Root Cause:** A pre-existing tab interface in `ScanDataMonitoringPage` was deprecated and the `currentTab` state variable was removed, but the `handleDeleteRow` function still checked `if (currentTab === 0)` when attempting to prevent deleting reconciliation records.
- **Resolution:** Removed the check `if (currentTab === 0)` from `handleDeleteRow` since the page now only manages scan data, making the call to `deleteScanDataById` direct and resolving the compiler error.

## ERR-011: Confirm by Daily Report Overwrites Raw Scan Data and Reverts to CONFLICTED
- **Task:** T-018-01-01 · **Session:** session_022
- **File:** backend/src/services/scanData/ScanDataService.ts & backend/src/services/reconciliation/ReconciliationService.ts · **Line:** 1197, 1730
- **Symptom:** When clicking "Confirm by Daily Report" in the Work Hour Monitoring page, the employee's original scan punches are overwritten/wiped out, and the record's status reverts back to CONFLICTED shortly after showing MATCHED.
- **Root Cause:**
  1. `ScanDataService.fillFromDailyReport` queried the `scanData` collection using UTC ranges, which missed the Bangkok timezone midnight timestamp. It returned an empty result, making the service overwrite the existing scan data as if it were a new record, thus clearing `devicePunches` and inserting all expected punches.
  2. `ReconciliationService.confirmByDailyReport` did not write the updated `scanPunches` and breakdown hours to the `ReconciliationRecord`. When the `ScanData` document update triggered the automated Cloud Function `reconcile`, the function restored the outdated `scanPunches` from the `ReconciliationRecord` and re-evaluated the status to CONFLICTED.
- **Resolution:**
  1. Updated `ScanDataService.ts` to first query by the exact doc key `SCAN_{employeeNumber}_{workDateStr}` and use Bangkok (+07:00) timezone ranges as a fallback query.
  2. Updated `ReconciliationService.ts` to retrieve the updated scan returned by `fillFromDailyReport` and write `scanPunches` and the computed hours directly into the `ReconciliationRecord`.

## ERR-012: Adjacent OT Morning and Day Shifts Conflict due to Strict Boundary-Sharing and Strict Lateness Check
- **Task:** T-018-01-02 · **Session:** session_022
- **File:** backend/src/services/reconciliation/ReconciliationService.ts & functions/src/index.ts · **Line:** 356, 223
- **Symptom:** Reconciliation results revert to CONFLICTED after confirmation with the note "ไม่พบสแกน IN สำหรับ segment 08:00–12:00", even though the employee has scanned times close to boundaries (e.g. 08:03).
- **Root Cause:**
  1. The boundary-sharing logic `isBoundaryShared` checked for strict minute equality (`closestOut === nextSeg.start`), meaning if a punch at e.g. 08:03 was used as OUT of OT Morning, it could not be shared as IN of the next segment (since 08:03 != 08:00), leading to a missing scan conflict.
  2. More fundamentally, adjacent shifts (OT Morning 06:00 - 08:00 and Day Shift 08:00 - 17:00) are continuous work. Treating them as separate segments forced employees to scan at exactly 08:00, which is physically impossible and unnecessary.
- **Resolution:**
  1. Modified `classifyBySegments` in both `ReconciliationService.ts` and `functions/src/index.ts` to check if `seg.end === nextSeg.start` to determine boundary sharing, allowing transition punches to be shared.
  2. Merged the adjacent OT Morning shift directly into the morning work segment (making it a single continuous `06:00 - 12:00` segment) when `otMorning.end === dayShift.start`. This completely eliminates the need to scan at 08:00, resolving both the 5-minute lateness buffer and the heights-working no-scan conditions requested by the user.

## ERR-013: Frontend Monitoring Modal Mismatches Backend Status due to Missing Segment Bypass and Late Buffer Rules
- **Task:** T-018-01-03 · **Session:** session_022
- **File:** frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx · **Line:** 1021
- **Symptom:** The Work Hour Monitoring details modal displays transition scans at 8:00 as conflicts (e.g., "✗ ขาด IN" or "✗ ขาด OUT") even after successful backend reconciliation, and labels slightly late transition scans (e.g. 08:03) as "⚠ สาย" instead of "✓ ปกติ".
- **Root Cause:** The segment classification logic inside the frontend's `buildSegmentRows` was out of sync with the backend. It lacked the 5-minute late buffer for morning shifts, used a strict punch time match for boundary sharing, and did not implement transition scan bypass rules for adjacent shifts.
- **Resolution:** Updated `buildSegmentRows` and JSX rendering in `WorkHourComparisonTable.tsx` to:
  1. Determine boundary sharing based on segment adjacency (`seg.expectedEnd === nextSeg.expectedStart`).
  2. Implement transition bypass rules for `otMorning` and `morning` segments, marking them as "✓ ปกติ" with remark "ทำงานต่อเนื่อง (ไม่มีสแกนรอยต่อ)" if outer boundary punches exist.
  3. Introduce a 5-minute late buffer for the morning shift starting at 08:00 when preceded by an OT Morning shift.
  4. Clear the display of the same shared transition scan (e.g. `08:03`) on the next segment's check-in (showing `—`) to prevent admin confusion while keeping the segment marked as normal/bypassed.
  5. Check each scan in the details table against `row.devicePunches` to color-code original device scans in black and admin-filled/reconciled scans in orange, accompanied by a color legend in the modal.

## ERR-014: Stale Cloud Functions on GCP causing Reversion to CONFLICTED Status
- **Task:** T-018-01-04 · **Session:** session_022
- **File:** functions/src/index.ts · **Line:** 707, 794-853
- **Symptom:** Reconciliation records manually resolved by the Admin are overwritten back to CONFLICTED by the system with note "ไม่พบสแกน IN สำหรับ segment 08:00–12:00".
- **Root Cause:**
  1. The local fixes for eventual consistency (prioritizing `triggerDocData`) and segment boundary sharing (`seg.end === nextSeg.start`) inside `functions/src/index.ts` were compiled but not deployed to the production Google Cloud Platform (GCP).
  2. The production Cloud Function on GCP, running stale code, triggered on the scanData change and executed the old classification logic using stale data, resulting in a false conflict and overwriting the record status.
- **Resolution:**
  1. Advised the user to run the build and deploy commands (`firebase deploy --only functions`) to update GCP Cloud Functions with the latest fixes.

## ERR-015: ScanData display loses seconds and reverts to 2-digit format after Admin confirmation or edit
- **Task:** T-018-01-05 · **Session:** session_022
- **File:** backend/src/services/scanData/ScanDataService.ts · **Line:** 972, 1186
- **Symptom:** After the admin confirms a daily report or manually edits scans, the ScanData monitoring page renders the entire row of times in 2-digit format (e.g. `17:00`) instead of keeping the original 3-digit format (`07:59:00`). Original scans lose their seconds, becoming `HH:mm`.
- **Root Cause:** When `fillFromDailyReport` and `updateDailyPunches` run, they merge punches in 2-digit `HH:mm` format and overwrite both `allScans` and `Time1`-`Time10`. This strips the original seconds from unmodified scans, and saves new admin punches as `HH:mm` instead of `HH:mm:00`.
- **Resolution:** Modified both `fillFromDailyReport` and `updateDailyPunches` to fetch the existing document, extract `allScans` (which preserves seconds), and match them against incoming `HH:mm` edits. Unchanged punches keep their original seconds, and new admin-added punches are formatted with `:00` padded, preserving the `HH:mm:ss` format for consistent frontend rendering.

## ERR-063: Login failed with AxiosError: Network Error due to backend container crash (Cannot find module 'exceljs')
- **Task:** T-017-001-01 · **Session:** session_current
- **File:** backend/package.json · **Line:** 30
- **Symptom:** User gets AxiosError: Network Error / net::ERR_EMPTY_RESPONSE when trying to send a request to :4000/api/auth/login. The backend container is unhealthy, and docker compose logs backend shows MODULE_NOT_FOUND error: "Cannot find module 'exceljs'".
- **Root Cause:** A new dependency `exceljs` was added to backend/package.json in a previous change, but the Docker Compose backend container had not been restarted/rebuilt since. The backend's `/app/node_modules` volume is mapped as an anonymous volume which persists and shields the container from package.json updates, keeping node_modules in the container outdated and lacking the `exceljs` module.
- **Resolution:** Rebuilt the backend container image using `docker compose up -d --build backend`. Since Docker Compose aggressively caches and reuses anonymous volumes, we performed `docker compose down` (which deletes anonymous volumes) followed by `docker compose up -d` to create fresh volumes containing the newly installed dependencies (including `exceljs`). The backend server started successfully and is now healthy.

## ERR-064: Redundant "วันครบกำหนด (งาน)" column in WBS Excel Template
- **Task:** T-017-002-01 · **Session:** session_current
- **File:** backend/src/api/routes/tasks.routes.ts · **Line:** 988, 1111
- **Symptom:** WBS import template features a redundant "วันครบกำหนด (งาน)" (Task Due Date) column which is not needed because the task's due date is automatically computed from the maximum due date of its subtasks anyway.
- **Root Cause:** The template Excel sheet was initially defined with a dedicated "วันครบกำหนด (งาน)" column, which is unnecessary and confusing to the user.
- **Resolution:** Removed the column "วันครบกำหนด (งาน)" from `wsTemplate.columns` and `dataRows` in `tasks.routes.ts`. Adjusted center-alignment check to apply to the new column index 7 (`subtaskDueDate`). Removed the instruction row for "วันครบกำหนด (งาน)" from the "คู่มือการกรอกข้อมูล WBS" guide sheet in `tasks.routes.ts`. The parser (`wbsParser.ts`) remains backward-compatible since the field is treated as optional.

## ERR-065: Curved dashed focus ring (watermark) artifact showing next to WBS upload dialog and outdated template column headers
- **Task:** T-017-003-01 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/WbsImportModal.tsx · **Line:** 268-284
- **Symptom:** 1) WBS upload dialog displays curved dashed circular lines (crescent shapes) on the left side of the card, looking like a watermark. 2) The Excel template and UI grid columns feature outdated column headers and examples (e.g. WO-01 instead of STR, ARC; Emp001 instead of 6-digit employee IDs; and a redundant "หมายเหตุ" column).
- **Root Cause:** 1) The upload box container in the modal was wrapped in a `<label>` element with a hidden file input inside it. Browser-specific focus/active rings on the hidden input triggered concentric dashed outline arches on the rounded container boundaries, rendering as circular artifacts. 2) The template Excel sheet and DataGrid headers had not been updated to align with the simplified WBS structure and Thai localized examples.
- **Resolution:** 1) Replaced the `component="label"` Box upload container with a standard `div` Box container. Hooked its `onClick` to trigger a click on a hidden input using `useRef`. Used `style={{ display: 'none' }}` on the input and added `overflow: 'hidden'` to the Box to completely eliminate all browser focus outlines. 2) Removed the "หมายเหตุ" (taskDescription) column from `tasks.routes.ts` columns/dataRows and instructions sheet. Shifted aligned column indices. Updated preview grid columns in `WbsImportModal.tsx` and guides/examples with localized values (STR, ARC, EE; งานโครงสร้าง, งานสถาปัตยกรรม; รหัสพนักงานผู้รับผิดชอบ FM (งานย่อย) with 6-digit numeric IDs like 123456).

## ERR-066: Excess outer frame/shadow border in WBS Import modal and single-line truncated preview headers
- **Task:** T-017-003-02 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/WbsImportModal.tsx · **Line:** 138-222, 250-258, 370-410
- **Symptom:** The WBS Excel import dialog displays an unwanted grey shadow/border outline around its container. Behind the preview table, a white card with rounded corners (borderRadius: 12) and shadow is still visible, overlapping with the blue/orange table header. Additionally, the preview table's long column header titles are truncated onto a single line, causing the column widths to be excessively wide and pushing the critical "หมายเหตุ / ข้อผิดพลาด" column off-screen.
- **Root Cause:** 1) The Dialog Paper component was styled with a drop-shadow and a border. 2) The custom DataGrid component wrapper was hardcoded with a Paper container styled with borderRadius: 12 and box-shadow that wasn't customizable from the outside. 3) The custom DataGrid wrapper was not configured with a headerHeight or header title wrapping CSS styles.
- **Resolution:** 1) Removed the border and box shadow from the Dialog PaperProps sx styling. 2) Updated the shared DataGrid component to support an optional paperSx prop, forwarding it to the outer Paper container and resetting shadow elevation when boxShadow: 'none' is set. 3) Passed paperSx={{ borderRadius: 0, boxShadow: 'none', border: 'none', p: 0 }} to DataGrid in WbsImportModal.tsx. Adjusted preview table columns widths to be narrower and set header text wrapping CSS styles on .MuiDataGrid-columnHeaderTitle along with headerHeight={62} and center-justified header title containers.

## ERR-067: Missing WorkOrder and Category configurations in Project A for existing WBS imports
- **Task:** T-018-001-01 · **Session:** session_current
- **File:** backend/src/services/TaskService.ts · **Line:** 2590-2630
- **Symptom:** After importing WBS, the newly imported Work Orders (like STR) and their Categories do not appear in the "สร้างรายการงานใหม่" (Create new task) dropdown in the UI.
- **Root Cause:** The Excel WBS sheet was imported before the sync logic was added to `TaskService.ts`. Since the new code only syncs configurations to Project A during the import process itself, already-imported WBS data remained unsynced and lacked configuration entries in Project A.
- **Resolution:** Created and executed a one-time migration script `sync_project_configs.js` in the backend. The script reads all existing work orders and categories from Project B (afterSaleDb) and successfully backports them as configuration documents in Project A (db) under the collections `Project/{projectId}/workOrderConfigs` and `Project/{projectId}/categoryConfigs`.

## ERR-068: Firestore transaction error "all reads to be executed before all writes" during task approval
- **Task:** T-019-001-01 · **Session:** session_current
- **File:** backend/src/services/TaskService.ts · **Line:** 400-461
- **Symptom:** Approving a task or subtask fails with a 500 Internal Server Error, and the backend logs show "Unhandled error: Firestore transactions require all reads to be executed before all writes".
- **Root Cause:** In the `approveTask` method in `TaskService.ts`, the code performed `transaction.update` on the subtask reference at line 419, and then subsequently performed `transaction.get` on the subtasks collection at line 426. Since Firestore transactions strictly enforce that all read operations (`get`) must occur before any write operations (`set`/`update`/`delete`), this order violation triggered the error.
- **Resolution:** Restructured the transaction block inside `approveTask` to query both `taskRef`, `subtaskRef`, and `subtasks` collection (via `transaction.get`) at the very beginning of the block under a dedicated reads section. All update writes (`transaction.update`) were moved to execute after these reads.

## ERR-069: Redundant vertical stacking of Export and Requests/Daily Reports buttons in requests workspace
- **Task:** T-019-002-01 · **Session:** session_current
- **File:** frontend/src/pages/workspace/requests.tsx · **Line:** 779-824
- **Symptom:** In the schedule table workspace page, the "Export to Excel (CSV)" button and the "Requests / Daily Reports" toggle buttons are stacked vertically, cluttering the layout, and the Export button's border style looks inconsistent with the premium green "Upload" button design.
- **Root Cause:** 1) The layout was wrapped in a Stack configured with direction md: 'column' on desktop screens. 2) The Export button was configured as an outlined button with standard grey borders.
- **Resolution:** 1) Changed the right-side Stack direction to a row on desktop `direction={{ xs: 'column', sm: 'row' }}` with `alignItems="center"`, adjusted the parent Stack vertical alignment to `alignItems={{ xs: 'stretch', md: 'center' }}`, and swapped the child order so the Export button is positioned at the very end of the row. 2) Re-styled the "Export to Excel (CSV)" button to use a green background `#22c55e`, white text/icon, border radius `50px`, height `38px` (aligning with toggle buttons), and premium box shadow `0 4px 14px rgba(34, 197, 94, 0.3)`.

## ERR-070: WorkOrder leaders dropdown shows all system users and doesn't support multiple AssignLD
- **Task:** T-019-001-01 · **Session:** session_current
- **File:** backend/src/services/auth/UserService.ts · **Line:** 143
- **Symptom:** The Leader dropdown in the Work Order edit modal displays all system users instead of filtering by role ID 'LD' and project location. Additionally, only one leader is stored in the `leaderId` field, failing to capture multiple selections (`AssignLD`).
- **Root Cause:** 
  1. The backend API `/api/users` only retrieved page and pageSize, ignoring other query parameters.
  2. `UserService.getAllUsers` had no filtering capability for `roleId`, `department`, `isActive`, or `projectId`.
  3. The work orders config creation/update routes didn't save or cascade the multiple leader assignments array (`AssignLD`).
- **Resolution:** 
  1. Updated `/api/users` route to parse and forward `roleId`, `department`, `isActive`, and `projectId` query parameters.
  2. Implemented dynamic filtering in `UserService.getAllUsers` (using `array-contains` for project location IDs) and sorted/paginated in-memory to prevent composite index requirements.
  3. Added the `AssignLD` array to frontend inputs, backend schemas, and cascaded updates from config in Project A to workOrders collection in Project B.

## ERR-071: Work Order codes WOA and WOP from another system display in dropdowns
- **Task:** T-019-001-02 · **Session:** session_current
- **File:** backend/src/services/ProjectConfigService.ts · **Line:** 35
- **Symptom:** In the "สร้างรายการงานใหม่" (Create new task) modal, the "หมวดหมู่งานหลัก (Work Order)" dropdown shows codes like `WOA` and `WOP` which are from another system, causing confusion.
- **Root Cause:** The `ProjectConfigService.getWorkOrders` method fetched all work orders configurations from the database without excluding codes that belong to the After-Sale system (`WOA` and `WOP`).
- **Resolution:** Added a filter check inside `ProjectConfigService.getWorkOrders` to exclude configurations whose code equals `WOA` or `WOP` (case-insensitive).

## ERR-072: TaskName toggles to select dropdown even when user typed a name before checking subtasks
- **Task:** T-019-001-03 · **Session:** session_current
- **File:** frontend/src/pages/workspace/components/TaskCreateModal.tsx · **Line:** 363, 1044
- **Symptom:** When a user types a new task name in "ชื่องาน" (taskName) and ticks "เพิ่มงานย่อย" (Add Subtasks), the input field changes to "เลือกงานหลัก" (Autocomplete dropdown), causing them to lose the name they typed and preventing them from creating subtasks under the new task name.
- **Root Cause:** The conditional rendering logic strictly checked `!isEdit && hasSubtasks` to switch from TextField to Autocomplete, without checking if the user had already typed a value in the TextField before checking the toggle.
- **Resolution:** 
  1. Destructured `watch` from `useForm` and introduced a state variable `isAddingSubtasksToNewTask`.
  2. In `handleToggleSubtasks`, evaluated if `taskName` has a value. If so, set `isAddingSubtasksToNewTask(true)` to keep the input as a text field. Otherwise, set it to `false` to render the Autocomplete.
  3. Modified the conditional rendering check to `!isEdit && hasSubtasks && !isAddingSubtasksToNewTask`.

## ERR-073: Redundant subtask name in first line of Daily Report TaskSidebarCard
- **Task:** T-020-001-03 · **Session:** session_current
- **File:** backend/src/api/routes/tasks.routes.ts, frontend/src/pages/daily-reports/index.tsx · **Line:** 673 (backend), 1360, 2620 (frontend)
- **Symptom:** The task cards in the left sidebar of the Daily Report page display the subtask name on both the first line (concatenated after the parent task name like `Parent Task > Subtask`) and the second line (standalone).
- **Root Cause:** 1) The backend `/tasks/assigned-subtasks` API route concatenated the subtask name into `taskName`. 2) The frontend search filter only checked `taskName`, meaning that removing it from `taskName` would break subtask searching. 3) The frontend detail view header didn't display the `subtaskName` field, so removing it from `taskName` left the detail view without subtask context.
- **Resolution:** 1) Modified the backend `/tasks/assigned-subtasks` route to return only `parentTask.taskName` in `taskName`. 2) Updated the frontend search filter to check `t.subtaskName` as well. 3) Added a dedicated subtitle rendering `selectedTask.subtaskName` in the main detail header pane.

## ERR-074: Daily Report page redirects to Requests table workspace instead of toggling planning mode locally
- **Task:** T-020-001-04 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx · **Line:** 167, 400, 420, 1310, 2275, 2665
- **Symptom:** Selecting the "Requests" page header tab on `/daily-reports` redirected the user to `/workspace/requests`. There was no way to submit advance planning requests on specific days (today/tomorrow) directly from the daily report workspace itself, and sidebar task cards were not filtered to valid active date ranges.
- **Root Cause:** 1) The page header tabs were hardcoded to redirect to `/workspace/requests`. 2) There was no page state to toggle between daily report and advance plan submission modes. 3) UI modes and submission APIs were dynamically driven purely by future date checks (`reportDate > today`) rather than explicit tab selection.
- **Resolution:** 1) Introduced `pageMode` state (`'daily-report' | 'requests'`) in `daily-reports/index.tsx`. 2) Modified header tabs to switch `pageMode` locally, resetting selected date and clearing selected task. 3) Restrained date selection to today and tomorrow only in Requests mode. 4) Added sidebar task card filtering to only show tasks valid for the selected date range in Requests mode. 5) Updated all request/submission evaluation variables to use `pageMode === 'requests'`.

## ERR-075: Task sidebar is blank/closed and cannot be opened when switching tabs or canceling in daily-reports index
- **Task:** T-020-001-04-01 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx · **Line:** 1265
- **Symptom:** Switching page mode tabs ("Dailyreport" / "Requests") or canceling from the report form resets `selectedTask` to `null` while keeping the sidebar closed (`isSidebarOpen` as `false`). This leaves the user with an empty left side and a centered placeholder, with no way to toggle the sidebar open because the toggle button is only rendered when a task is selected.
- **Root Cause:** 1) `handleSelectTask` closes the sidebar unconditionally on select. 2) The switcher tabs and the cancel button clear `selectedTask` but do not open the sidebar. 3) The sidebar toggle button is conditionally rendered only when `selectedTask` is truthy, so when it is closed and `selectedTask` becomes null, the user is trapped.
- **Resolution:** Added a `useEffect` hook in `daily-reports/index.tsx` that automatically triggers when `selectedTask` is `null` (or becomes `null`) and sets `isSidebarOpen(true)`, guaranteeing that the sidebar is always open and available for task selection when no task is active.

## ERR-076: Daily Report / Request Mode defaults progress to 100% for new revisions
- **Task:** T-020-001-05-02 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx · **Line:** 503, 684
- **Symptom:** When a task is reworked or has a new revision (e.g. `rev01` which should start with 0% progress), entering the Daily Report or Requests page shows the latest/previous progress as `100%` and throws a validation error saying progress must be greater than 100%.
- **Root Cause:** The `taskReportsData` query fetches all daily reports for the task, which includes completed reports from previous revisions (e.g., `rev00` which was completed at 100%). The frontend page did not filter `taskReportsData` by the active revision ID (`currentRevId`) when calculating the latest previous progress (`lastPrevProgress` in `task-report-detail` query) or building `reportsSummaryMap`.
- **Resolution:** Modified `reportsSummaryMap` and the `task-report-detail` query in `index.tsx` to compute `currentRevId` (adjusting for support mode if active) and filter out any reports whose revision ID does not match `currentRevId`.

## ERR-077: Vertical scrollbar visible in Daily Report sidebar task list
- **Task:** T-020-001-05-03 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 2548 (index.tsx), 2244 (reference.tsx)
- **Symptom:** A default browser scrollbar is visible on the right side of the left sidebar "My job" task list, which looks cluttered and unaligned with the premium design theme.
- **Root Cause:** The `<Box>` wrapping the task list items had `overflowY: 'auto'` but did not hide Webkit scrollbars or configure scrollbar-width to none.
- **Resolution:** Added custom `sx` style rules to hide the scrollbar (`&::-webkit-scrollbar: { display: 'none' }`, `msOverflowStyle: 'none'`, `scrollbarWidth: 'none'`) while preserving the scrolling functionality.

## ERR-078: Confusing "Daily Report" header text next to local tabs switcher
- **Task:** T-020-001-05-04 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 2339 (index.tsx), 2099 (reference.tsx)
- **Symptom:** The page title "Daily Report" text is rendered next to the "Dailyreport" and "Requests" tabs capsule. This title is redundant, overlaps the switcher, and reduces the horizontal space on mobile/tablet viewports.
- **Root Cause:** Hardcoded `Typography` header element inside the flex row wrapper.
- **Resolution:** Removed the redundant `Typography` title elements from both files so that the tabs capsule sits directly at the start of the header box.

## ERR-079: Daily Report / Requests tabs switcher too small and unaligned on desktop viewports
- **Task:** T-020-001-05-05 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx · **Line:** 2339
- **Symptom:** The tabs switcher capsule ("Dailyreport" / "Requests") has a small width, which does not match the alignment or width of the left task sidebar card container (320px), looking unaligned and inconsistent.
- **Root Cause:** The `Stack` wrapping the tabs had no explicit desktop width defined, and the child `Button` elements had no flex-grow or flex-basis settings.
- **Resolution:** Modified the parent `Box` width to `{ xs: '100%', lg: 'auto' }`, and the tabs `Stack` width to `{ xs: '100%', lg: 320 }`, setting `flex: 1` on each tab `Button` so they share the 320px width equally.

## ERR-080: Cluttered task metadata and lack of mode indicators in form card header
- **Task:** T-020-001-05-06 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 2623 (index.tsx), 2307 (reference.tsx)
- **Symptom:** The form card header top-left task info is cluttered with too many text lines (Task ID, Category, Parent Task Name, Subtask Name, Work Order Name). Also, there is no visual indicator showing whether the user is recording a Daily Report or a Request, causing confusion.
- **Root Cause:** Hardcoded, unoptimized Typography stacking layout in the header Box, and lack of layout state variables rendering the active pageMode context.
- **Resolution:** Redesigned the card header: (1) Streamlined metadata to show Task ID (as a soft gray pill) + Category on line 1, Subtask Name as the main bold title on line 2, and Parent Task Name as subtitle on line 3, hiding Work Order. (2) Added an absolute-centered mode indicator badge on desktop viewports. (3) Added an inline mode indicator badge on mobile viewports below the task metadata.

## ERR-081: Redundant mode indicator banner centered in desktop form card header
- **Task:** T-020-001-05-07 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 2772 (index.tsx), 2456 (reference.tsx)
- **Symptom:** In desktop view, there is an absolute-centered mode indicator banner ("บันทึกรายงานประจำวัน (Daily Report)" / "บันทึกแผนล่วงหน้า (Requests)") in the card header, which clutter the layout and duplicate the mode switcher button text.
- **Root Cause:** Hardcoded absolute positioned Box in the card header layout of both files.
- **Resolution:** Removed the desktop centered Box mode indicator element completely in both files.

## ERR-082: Lack of calendar restriction and draft vs submitted daily report flow
- **Task:** T-020-001-05-08 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 464 (index.tsx), 2494 (reference.tsx)
- **Symptom:** Users can select future dates (like tomorrow) in Dailyreport mode. FMs have to fill in all photos and progress every time they want to report intermediate updates to their supervisor, which is redundant and heavy.
- **Root Cause:** DatePicker maxDate allowed tomorrow, and there was only a single "บันทึกรายงาน" action that enforced all validations.
- **Resolution:** (1) Clamped DatePicker maxDate to today in Dailyreport mode. (2) Added a `status` field ('draft' | 'submitted') to the daily report document. (3) Split the submit button into "บันทึกฉบับร่าง" (Save Draft) and "ส่งรายงานสมบูรณ์" (Submit Final), bypassing photo validations in draft mode to let FMs update status incrementally. (4) Locked submitted past reports while allowing same-day editing.

## ERR-083: Save Draft button visible for past dates
- **Task:** T-020-001-05-09 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx, frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx · **Line:** 3524 (index.tsx), 3114 (reference.tsx)
- **Symptom:** The "บันทึกฉบับร่าง" (Save Draft) button is visible even when the user selects a past date, which violates the flow that drafts should only be saved for today's active work.
- **Root Cause:** The Save Draft button was conditionally rendered only based on pageMode !== 'requests', without checking if the reportDate is today.
- **Resolution:** Added `isSameDay(reportDate, new Date())` conditional check around the Save Draft button in both files so it only renders when the selected date is today.

## ERR-084: Site photo remove (X) button non-functional for existing photos
- **Task:** T-020-001-05-10 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx (line 3448)
- **Symptom:** กดปุ่มกากบาท (X) เพื่อลบรูปหน้างาน (Existing Photos) ไม่มีผลใดๆ รูปยังคงแสดงอยู่
- **Root Cause:** `renderPhotoGrid` call site ส่ง `onRemove` เป็น `(i) => removePhoto(i, 'site')` โดยไม่ส่ง `isExisting` parameter ทำให้ `removePhoto` เข้า branch `isExisting=false` เสมอ จึงพยายามลบจาก `sitePhotos` (new uploads) แทน `existingPhotos.site` (existing URLs)
- **Resolution:** เปลี่ยน call site เป็น `(i, isExisting) => removePhoto(i, 'site', isExisting)` เพื่อส่ง flag ที่ถูกต้องตาม `item.isExisting` ที่ `renderPhotoGrid` คำนวณไว้

## ERR-085: Overlapping double spinners shown during initial load and authentication redirect
- **Task:** T-001-001-10 · **Session:** session_current
- **File:** frontend/src/components/layout/ProtectedRoute.tsx & frontend/src/pages/index.tsx · **Line:** 88, 28
- **Symptom:** When loading the web page for the first time, two loading spinner elements overlap each other in the center of the viewport.
- **Root Cause:** On initial load, pages wrapped in `ProtectedRoute` and the home page `/` (`index.tsx`) display their own centered `CircularProgress` loaders while checking auth state. Once loading finishes and they redirect the user (via `router.push`), Next.js triggers client-side page transition, displaying the global backdrop spinner ("กำลังโหลดหน้าจอ...") from `_app.tsx`. Since the redirecting page remains visible behind the translucent backdrop, both spinners render on top of each other.
- **Resolution:**
  1. Updated `ProtectedRoute.tsx` to return `null` instead of a spinner in its fallback during client-side redirect. Added an `isRedirecting` state in `index.tsx` which sets to `true` when a redirect is triggered and returns `null` to clear the page spinner.
  2. Consolidated all page transition/initial load spinners to use a unified **Light Glassmorphism Backdrop** style (`rgba(255, 255, 255, 0.7)` with `backdropFilter: 'blur(5px)'`) in `_app.tsx`, `ProtectedRoute.tsx`, and `index.tsx` for consistent, modern visual styling.
  3. Replaced all duplicate backdrop blocks by extending the reusable [LoadingSpinner.tsx](file:///d:/LaborManagementSystem/frontend/src/components/common/LoadingSpinner.tsx) custom component with the full-page backdrop feature, eliminating redundant code blocks.

## ERR-086: Workspace Daily Report Modal shows blank/no report details by default
- **Task:** T-011-003-01 · **Session:** session_current
- **File:** [TaskDailyReportModal.tsx](file:///d:/LaborManagementSystem/frontend/src/pages/workspace/components/TaskDailyReportModal.tsx) · **Line:** 95
- **Symptom:** When opening the Daily Report Log modal for a subtask and selecting dates that have reports (e.g. June 9), the summary card displays "ไม่มีข้อมูลรายงานการทำงาน" (No daily report data) and the calendar shows red "locked/no data" dots.
- **Root Cause:** The frontend was passing a plain subtask ID (e.g., `SRV-0001-001-0001`) to the reports API. Since the ID was not composite, the backend had to query the subtask document using `collectionGroup('subtasks').where('subtaskId', '==', id)`. In the production environment, this query failed with `9 FAILED_PRECONDITION` because the required Collection Group index did not exist in Firestore. The frontend caught the error and silently fallback to an empty reports array, causing the modal to appear empty.
- **Resolution:**
  1. Updated `TaskDailyReportModal.tsx` to construct a composite subtask ID (`resolvedTaskId` = `${task.parentTaskId}__${task.id}`) and used it for report fetching, unlock requests, and approval API calls. The composite ID enables direct document reference resolution in the backend (O(1)), bypassing the index requirement.
  2. Passed the composite ID inside the `task` object to `TaskRejectModal` so that rejection actions also resolve directly.
  3. Removed the auto-selection hook and restored the default start selection to `today` (current date) as requested by the user.
## ERR-087: Search Task Text Field is Squished and Truncated on Laptop Viewports in Daily Report Sidebar
- **Task:** T-020-001-05-12 · **Session:** session_current
- **File:** frontend/src/pages/daily-reports/index.tsx · **Line:** 2569, 2605
- **Symptom:** In laptop viewports (sidebar fixed at 320px width), the search task input field is squished next to the "My job" title block, causing the placeholder "Search tasks..." to be truncated to "Search ta" and rendering the layout cramped and unbalanced.
- **Root Cause:** The header container used a horizontal flex layout (`display: 'flex', justifyContent: 'space-between'`) that forced both "My job" (about 148px wide) and the Search input box (minWidth 120px) to sit side-by-side inside a 272px available space, leaving insufficient width for the search box.
- **Resolution:** Refactored the sidebar header layout by stacking the "My job" title and the Search input box vertically into two separate rows. The Search input box is set to full width (`width: '100%'`), allowing the search placeholder to render completely without truncation.

## ERR-088: Logout UI Freeze and Out-of-Sync Locale Translations
- **Task:** T-015-002-01 · **Session:** session_current
- **File:** frontend/src/components/layout/Layout.tsx & frontend/src/pages/_app.tsx · **Line:** 133 (Layout.tsx) & 23 (_app.tsx)
- **Symptom:** 1) Clicking the logout button freezes the UI and fails to redirect to the login page immediately. 2) The Next.js locale routing prefix (e.g. `/en/workspace`) is present in the URL, but the page content remains in Thai (translations are not updated).
- **Root Cause:**
  1. In `Layout.tsx`, the `handleLogout` function `await`ed a POST request to `/api/auth/logout`. If the backend was unreachable or slow to respond, it blocked the execution of Zustand's `logout()` and `router.push('/login')`, causing the UI to hang during connection timeout. Also, the Firebase user session was not signed out and `authToken` was not removed from `localStorage`.
  2. The `react-i18next` language instance was not synchronized with Next.js router locale changes. When the locale route changed, the language did not update.
- **Resolution:**
  1. Updated `handleLogout` in `Layout.tsx` to call the logout API asynchronously in the background (fire-and-forget, removing `await`), cleared `authToken` and `user` from `localStorage`, called `auth.signOut()` from Firebase, and then updated Zustand's state and redirected to `/login` immediately.
  2. Added a `useEffect` hook in `_app.tsx` that triggers on `router.locale` changes and updates the translation language via `i18n.changeLanguage(router.locale)`.

## ERR-089: N+1 Database reads during wage calculation and redundant updates to daily reports
- **Task:** T-025-02 · **Session:** session_current
- **File:** [WagePeriodService.ts](file:///d:/LaborManagementSystem/backend/src/services/wage/WagePeriodService.ts), [WorkVerificationService.ts](file:///d:/LaborManagementSystem/backend/src/services/wage/WorkVerificationService.ts) · **Line:** 209 (WagePeriodService.ts), 90 (WorkVerificationService.ts)
- **Symptom:** High database read counts (up to 200 reads for 100 contractors) and redundant document write operations on every wage period calculation click.
- **Root Cause:**
  1. `WagePeriodService` fetched compensation details of contractors inside a loop, performing individual queries to subcollections for each contractor (N+1 queries).
  2. `WorkVerificationService` updated the daily report entries and wrote to Firestore unconditionally, regardless of whether their verification status changed.
- **Resolution:**
  1. Implemented a bulk query `getCompensationDetailsBulk` in `DailyContractorService.ts` using a Firestore `collectionGroup` query chunked in batches of 30, reducing reads by up to 97%.
  2. Implemented a dirty check in `WorkVerificationService.ts` to only write daily report updates if the verification status actually changed, and added a write counter safety check to prevent empty Firestore batch commit errors.
