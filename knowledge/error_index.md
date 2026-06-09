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
