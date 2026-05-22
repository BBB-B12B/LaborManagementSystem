# Error Index

This catalog lists known errors and bug fix details.

---

## ERR-001: FAILED_PRECONDITION Missing Collection Group Index
- **Task:** T-005-001-01 · **Session:** session_01
- **File:** backend/src/services/TaskService.ts · **Line:** 700
- **Symptom:** API responds with 500 Internal Server Error when querying `collectionGroup('dailyReports')` with `.where('reportDate')`. Console logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index...`
- **Root Cause:** Firebase Firestore does not have an index created for the collection group query on the `reportDate` field.
- **Resolution:** Temporarily reverted to fetching `.get()` without `.where()` and applied an in-memory filter (`filter(...)` using `getTime()`). Additionally, provided the Firebase index creation URL to the user for a permanent fix.

## ERR-002: Cannot edit or view locked cell popup in Backlog/History Grid
- **Task:** T-008-001-01 · **Session:** session_02
- **File:** frontend/src/pages/daily-reports/list.tsx · **Line:** 828
- **Symptom:** Manit Sathitwat (FM) reported that clicking on any worker's cell for Sunday, May 17, 2026 (or any locked cell) in the Backlog / History grid does not open the edit/absent popup.
- **Root Cause:** Cells with `day.allowEdit === false` had their `onClick` handler completely disabled in the list grid view, preventing the popup from showing at all.
- **Resolution:** Removed the check that disabled clicking on non-editable cells. Added `disabled` attributes to all form input components in the popup and disabled the save button when `!selectedCell.day.allowEdit`. Added a prominent warning alert at the top of the popup explaining why it is read-only and instructing how to request an unlock from the Daily Report page if applicable.

## ERR-003: Creator/Foreman information and record update date not shown in Normal/Leave popups
- **Task:** T-001-001-01 · **Session:** session_03
- **File:** frontend/src/pages/daily-reports/list.tsx · **Line:** 885
- **Symptom:** In the Backlog/History grid worker edit popup, the grey badge for a worker with a "Normal" (ปกติ) or "Leave" (ลา) record only displayed the creator's name. It did not have the "ผู้บันทึก:" (Creator) prefix, nor did it show the date when it was recorded/updated, unlike the "Absent" (ขาดงาน) popup which displays both.
- **Root Cause:** The conditional branch rendering the creator info in the dialog header only outputted `selectedCell.day.record.createdByName` without a prefix or the formatted date string. Also, the backend did not include `updatedAt` / `createdAt` formatted as `updatedAtStr` on the record objects in the grid payload.
- **Resolution:** Modified the backend (`backend/src/api/routes/tasks.routes.ts`) to calculate `reportUpdatedAtStr` from the daily report's `updatedAt` (or `createdAt` fallback) and attached it as `updatedAtStr` to both regular and leave record items in the grid payload. Modified the frontend (`frontend/src/pages/daily-reports/list.tsx`) to prepend "ผู้บันทึก: " and display the formatted date from `updatedAtStr` inside the creator information badge in the popup header.

## ERR-004: Popup displays future recorded dates and foreman usage in the past cell context
- **Task:** T-001-001-02 · **Session:** session_04
- **File:** backend/src/api/routes/tasks.routes.ts, frontend/src/pages/daily-reports/list.tsx · **Line:** 372 (backend), 900 (frontend)
- **Symptom:** Opening the backlog cell popup on a past date (e.g. May 13) showed creator or last-used foreman info from a future date (e.g. May 19), which was confusing to users.
- **Root Cause:** The Normal/Leave popup displayed the database transaction update date (`updatedAtStr`), and the Absent popup displayed the absolute latest row-level/worker-level last-used foreman name and date, regardless of whether that usage occurred in the future of the clicked cell's date.
- **Resolution:**
  1. For Normal/Leave popups (ปกติ/ลา), modified the frontend to display the cell's own work date instead of the database update transaction date.
  2. For Absent popups (ขาดงาน), updated the backend to compute a daily relative last-used foreman and date (`lastUsedByName` and `lastUsedDateStr` per cell day) by filtering the task's daily reports to only include entries on or before the cell's date. Modified the frontend to display this day-level relative info.

## ERR-005: Incorrect OT Evening default time and unaligned checkbox time toggling in Backlog popup
- **Task:** T-001-001-03 · **Session:** session_05
- **File:** frontend/src/pages/daily-reports/list.tsx · **Line:** 246, 248, 323, 332, 341, 350, 359
- **Symptom:** In the backlog/history grid worker edit popup, the OT Evening default time was set to 17:30 - 20:30 instead of 18:00 - 21:00. Additionally, checking any shift/OT checkbox did not initialize or align the time ranges with the default times from the Daily Report page.
- **Root Cause:** The state initialization for OT Evening was hardcoded to '17:30 - 20:30' (and fallback values in handleCellClick also used the incorrect ranges). The toggle handlers for the checkboxes (e.g. handleOtEveningChange) only set the boolean states without initializing the corresponding time range string state to the default value.
- **Resolution:** Updated default state values and handleCellClick fallback defaults in list.tsx to use '18:00 - 21:00' for OT Evening and '06:00 - 08:00' for OT Morning. Modified the checkbox change handlers (handleNormalShiftChange, handleOtMorningChange, handleOtNoonChange, handleOtEveningChange, handleLeaveChange) to set the respective time state to its default value when checked is true.

## ERR-006: Axios Error 500 when saving backlog work record (Missing Collection Group Index)
- **Task:** T-001-001-04 · **Session:** session_06
- **File:** backend/src/api/routes/tasks.routes.ts · **Line:** 80
- **Symptom:** Submitting work or OT hour updates in the backlog/history grid edit popup fails with `AxiosError: Request failed with status code 500`. Backend logs show `9 FAILED_PRECONDITION: The query requires a COLLECTION_GROUP_ASC index for collection tasks and field taskId.`
- **Root Cause:** The `/tasks/backlog` endpoint returned raw `taskId` values. When editing records, the frontend called report submission/retrieval endpoints using this raw ID, which triggered a Firestore `collectionGroup('tasks').where('taskId', '==', id)` query. This query requires an index that is missing in the local Firestore emulator.
- **Resolution:** Modified `/api/tasks/backlog` to return the task's composite ID (`woId__catId__taskId`) instead of its raw `taskId`. Since this composite ID contains `__`, the backend's `getDailyReport` and `submitDailyReport` services resolve the task directly by document reference path, bypassing the index requirement and resolving the 500 error.

