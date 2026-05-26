# MECE Plan - Supervisor requests & reports table workspace

## Goal
Implement a table view for Supervisors to monitor work records and advance requests across their responsible sites, with filters, Excel export, and status locking actions. Update the workspace header buttons according to user layout instructions.

---

## Plan Sections

### Section 1: Backend API Support
- **Task**: Create endpoints for fetching aggregated work records and requests.
- **DoD**:
  - `GET /api/tasks/requests-all` fetches all requests across a date range and projects.
  - `GET /api/tasks/reports-all` fetches all actual daily reports across a date range and projects.
  - Both endpoints compile without errors.
- **Est**: 15 mins

### Section 2: Frontend Service wrapper
- **Task**: Add API client endpoints to `frontend/src/services/taskService.ts`.
- **DoD**:
  - `getAdvanceRequestsAll(params)` and `getDailyReportsAll(params)` added and typed.
- **Est**: 5 mins

### Section 3: Frontend Header UI Changes
- **Task**: Modify `frontend/src/pages/workspace/index.tsx`.
- **DoD**:
  - Move `Add New` button next to the filters/tabs.
  - Rename it to `+ Newtasks`.
  - Place a new button `ตรวจสอบกำลังพล & แผนงาน` in the original button position on the right that routes to `/workspace/requests`.
- **Est**: 10 mins

### Section 4: Frontend Supervisor Requests Table Workspace
- **Task**: Create `/workspace/requests` page (`frontend/src/pages/workspace/requests.tsx`).
- **DoD**:
  - Page has Filters: Date Range, Project Selection, Data Type Toggle (Requests vs Reports).
  - Table shows: Date, Task, Foreman Name, Labor ID/Name, Shift Hours (Regular, OT Morning/Noon/Evening), Total Hours, Progress (Expected vs Actual), and Status.
  - Actions:
    - **Export to Excel**: Generate Excel sheet and trigger browser download.
    - **Lock/Export Selected Requests**: Call backend PATCH status API to lock requests.
- **Est**: 30 mins

### Section 5: Verification
- **Task**: Run TypeScript type checks and verify build and functionality.
- **DoD**:
  - Frontend type checks pass (`npm run type-check`).
  - Backend type checks pass (`npm run type-check`).
- **Est**: 10 mins
