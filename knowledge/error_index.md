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

