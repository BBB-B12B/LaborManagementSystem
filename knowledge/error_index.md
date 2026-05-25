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

