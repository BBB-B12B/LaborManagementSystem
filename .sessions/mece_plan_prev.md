# MECE Plan — Dropdown Task Selection in Absent Popup & Task Filtering Alignment

Status: completed

## Goal
Implement job/task selection dropdown in the "Absent" edit popup on the Backlog/History page. Ensure the tasks shown in this dropdown align exactly with the conditions used to display tasks on the Daily Report page (only showing active tasks that are assigned to, supported by, or historically associated with the logged-in Field Manager).

## Proposed Changes

### Component 1: Backend API Route
#### [MODIFY] [tasks.routes.ts](file:///d:/Labor%20Management%20System/backend/src/api/routes/tasks.routes.ts)
- Modify the `/backlog` endpoint (`GET /api/tasks/backlog`) to filter tasks for users with role `FM`.
- In addition to filtering by `projectId` matching `authReq.user?.projectLocationIds`, filter tasks to only include active ones (`isActive !== false`) where the FM's employeeId or uid is listed in the task's `assignees`, `supportAssignees`, or `historicalAssigneeIds` (matching the frontend logic on the Daily Report page).

### Component 2: Frontend Backlog Grid Page
#### [MODIFY] [list.tsx](file:///d:/Labor%20Management%20System/frontend/src/pages/daily-reports/list.tsx)
- Modify the edit dialog JSX to render the task selection dropdown field unconditionally (i.e. remove the `recordType === 'regular' &&` conditional wrapping, or change it to show when `recordType` is `'regular' || recordType === 'leave' || recordType === 'absent'`).
- Ensure that the dropdown is populated with `backlogData?.tasks` as before.
- Ensure that if `recordType === 'absent'`, the task selection is still editable so that the user can choose a task before switching the record type, but does not block saving if they keep the status as absent (which does not require a task).

## Definition of Done (DoD)
- [x] Absent popup displays the task selection dropdown by default.
- [x] Tasks in the dropdown for an FM user are filtered to match the Daily Report page (only active and assigned/joined tasks).
- [x] Selecting a task and checking a shift updates the worker's status and successfully saves the work record to the chosen task.
- [x] Keeping the status as absent and saving correctly processes the absent record without triggering task validation errors.
- [x] TypeScript check and ESLint pass without issues.

## Estimation
- Time estimate: 30 minutes
