### ✅ Phase 1: Daily Report System Evolution (Hours-only v3)
- [x] **T-371-1**: (Backend) อัปเดต Schema ให้รองรับ Hourly Input (Regular/OT)
- [x] **T-371-2**: (Backend) ปรับปรุง Excel Parsing ให้ตรงความต้องการของ ScanData
- [x] **T-371-3**: (Frontend) ปรับปรุงหน้าจอ Upload ให้ระบุชั่วโมงทำงานโดยตรง
- [x] **T-371-4**: (Frontend) ปรับปรุง Preview Table ให้แสดงผล Flattened Data
- [x] **T-371-5**: (Backend) ระบบจัดเก็บไฟล์ Excel ต้นฉบับลง Storage (File Persistence)

### ✅ Phase 1.5: Final Quality Audit & Polish (Hours-only v3)
*   **Status**: [x] Quality Audit & UX Refinement Completed
*   [x] **T-706**: [Backend] Fix `removeWorkEntry` (API Routes & Controller) to include `workerId`.
*   [x] **T-707**: [Backend] Robust Excel Parsing (Dynamic header search & String trimming).
*   [x] **T-708**: [Frontend] UX Refinement (Update instruction text & Thai labels).

### ✅ Phase 1.6: Bulletproof Excel Import (Reliability Focused)
*   **Status**: [x] Multi-Sheet & Fuzzy Detection Completed
*   [x] **T-709**: [Backend] Multi-sheet scanning logic (workbook.SheetNames loop).
*   [x] **T-710**: [Backend] Fuzzy header matching (Keywords: "รหัส", "ID", "Code").
*   [x] **T-711**: [Frontend] Improved Error feedback (Inform user if NO valid sheet found).

### ✅ Phase 1: Daily Report System Evolution (Hours-only v3)
- [x] **T-371-1**: (Backend) อัปเดต Schema ให้รองรับ Hourly Input (Regular/OT)
- [x] **T-371-2**: (Backend) ปรับปรุง Excel Parsing ให้ตรงความต้องการของ ScanData
- [x] **T-371-3**: (Frontend) ปรับปรุงหน้าจอ Upload ให้ระบุชั่วโมงทำงานโดยตรง
- [x] **T-371-4**: (Frontend) ปรับปรุง Preview Table ให้แสดงผล Flattened Data
- [x] **T-371-5**: (Backend) ระบบจัดเก็บไฟล์ Excel ต้นฉบับลง Storage (File Persistence)

### ✅ Phase 1.5: Final Quality Audit & Polish (Hours-only v3)
*   **Status**: [x] Quality Audit & UX Refinement Completed
*   [x] **T-706**: [Backend] Fix `removeWorkEntry` (API Routes & Controller) to include `workerId`.
*   [x] **T-707**: [Backend] Robust Excel Parsing (Dynamic header search & String trimming).
*   [x] **T-708**: [Frontend] UX Refinement (Update instruction text & Thai labels).

### ✅ Phase 1.6: Bulletproof Excel Import (Reliability Focused)
*   **Status**: [x] Multi-Sheet & Fuzzy Detection Completed
*   [x] **T-709**: [Backend] Multi-sheet scanning logic (workbook.SheetNames loop).
*   [x] **T-710**: [Backend] Fuzzy header matching (Keywords: "รหัส", "ID", "Code").
*   [x] **T-711**: [Frontend] Improved Error feedback (Inform user if NO valid sheet found).

### ✅ Phase 1.7: Persistence & Date Integrity
*   **Status**: [x] ID Normalization & Transactional Safety Completed
*   [x] **T-712**: [Backend] Fix Date Drift (Timezone normalization to Local Date).
*   [x] **T-713**: [Backend] Implement Transactional Save for Daily Reports.
*   [x] **T-714**: [Frontend] Add "Save Confirmation" and Loading State for Persistence.

### 🔄 Phase 2.0: Sales System Firebase Integration (Task & Daily Report)
*   **Status**: 🔄 In Progress
*   [x] **T-801**: [Setup] Initialize Firebase Client/SDK connection to Sales System.
*   [x] **T-802**: [Frontend] Read: Update Workspace Kanban to fetch tasks from `workOrders/{id}/categories/{id}/tasks`.
*   [x] **T-803**: [Frontend] Write: Update Create Task flow to save to Firebase.
    - **Error Logs**:
      - **[T-803-E1-1]**: Support team can edit Due Date when picking up cross-project tasks
        1. **Root Cause**: The `onChange` for picking up an existing task did not auto-fill `dueDate` and the field was not disabled for cross-project support tasks.
        2. **Action**: Added logic to populate `dueDate` and set `disabled={true}` when `isHelperUser` selects a cross-project task.
        3. **Status**: Fixed
      - **[T-803-E1-2]**: Support team cannot see assigned cross-project tasks in Workspace and sees Approve/Reject buttons
        1. **Root Cause**: `WorkspacePage` filtered out tasks not matching `projectId` and not directly assigned. `TaskDailyReportModal` did not hide Approve/Reject for cross-project tasks.
        2. **Action**: Added `isSupportForMe` condition in `WorkspacePage` and hid Approve/Reject buttons for Support users in `TaskDailyReportModal`.
        3. **Status**: Fixed
      - **[T-803-E1-3]**: Support task assignees disabled for Support team and missing from Daily Report
        1. **Root Cause**: `TaskCreateModal` disabled assignees if `isSupportRequest` was true regardless of user role. Daily Report queries mismatched `uid` stored in `employeeId` field with the local `employeeId`.
        2. **Action**: Allowed Support users to edit assignees by checking `!isHelperUser`. Updated `DailyReport` and `Workspace` to compare both `id` and `employeeId` fields across `uid` and `employeeId` values to prevent mismatch.
        3. **Status**: Fixed
      - **[T-803-E1-4]**: Workspace Task Daily Report Progress Bar UI
        1. **Root Cause**: The progress bar only showed a single color and didn't clearly separate past accumulated progress from newly added progress on the selected date.
        2. **Action**: Updated `TaskDailyReportModal` to sort reports chronologically and compute `pastProgress` and `progressAdded`. Styled the bar with 2 distinct green tones (light for past, dark for newly added).
        3. **Status**: Fixed
*   [/] **T-804**: [Frontend] Task-based Reporting UI (Sidebar + Form) in Daily Report Page.
*   [ ] **T-820**: [Frontend] Add "View Summary Table" button and redirect logic.
*   [ ] **T-821**: [Frontend] Sync Task Progress (dailyProgress & status) after report submission.
*   [x] **T-805**: [Backend] Hierarchical Schema & ID Generation (STR/ARC per WorkOrder)
*   [x] **T-806**: [Frontend] UI Flow Reorder (Location -> WO -> Category -> Task)
*   [/] **T-807**: [Frontend] UX Audit - Fix Grey Background Issue (Consistency & Standards)
    - **Error Logs**:
      - **[T-807-E1-1]**: Persistent Grey Background on TextFields
        1. **Root Cause**: Specificity issue when applying `sx` to `InputProps` vs `TextField` root.
        2. **Action**: Unified all field styling to use `sx` on `TextField` root targeting `.MuiFilledInput-root`.
        3. **Status**: Fixed (but E1-2 found)
      - **[T-807-E1-2]**: Typed-in fields still grey (Autocomplete vs TextField divergence)
        1. **Root Cause**: Standard TextField and Autocomplete render different DOM structures for Filled variant.
        2. **Action**: Replace standard TextFields with `freeSolo` Autocomplete to ensure 100% UI consistency.
        3. **Status**: Fixed
      - **[T-808-E1-1]**: Duplicate React Keys (TASK-0000001) in Workspace
        1. **Root Cause**: taskId is only unique within a WorkOrder/Category, but Workspace shows tasks from multiple scopes using taskId as React key.
        2. **Action**: Implement Composite ID (WO_ID|CAT_ID|TASK_ID) in Backend to ensure global uniqueness.
        3. **Status**: In Progress
*   [ ] **T-809**: [Backend] Composite ID Implementation (models/converter & services/update).

### 🔄 Phase 2.1: Data Synchronization Implementation (Sales System)
*   **Status**: 📝 Planned
*   [ ] **T-830**: [Setup] ขอรับ Firebase Credentials (Config/Service Account) ของฝั่ง Sales System และตั้งค่า `salesDb` Instance ให้แยกจาก DB หลัก
*   [ ] **T-831**: [Service] พัฒนา `salesSyncService.ts` โดยลบ Mock Data ออก และเชื่อมต่อ API `addDoc/setDoc` เข้ากับ `salesDb`
*   [ ] **T-832**: [Backend] ผูก Trigger การทำงาน (Double Write) ใน `TaskService.ts` ให้ยิงข้อมูลข้ามระบบเมื่อมีการ Create Task หรือ Submit Daily Report
*   [ ] **T-833**: [Architecture] ออกแบบระบบป้องกันความผิดพลาด (Retry Mechanism/Error Handling) กรณีที่ Sales System ไม่สามารถเชื่อมต่อได้

### 🔄 Phase 2.2: ID Generation Revert (Counter-based Upsert)
*   **Status**: 🔄 In Progress
*   [x] **T-840**: [Backend] Refactor `TaskService.ts` (createTask) to use `db.runTransaction`
*   [x] **T-841**: [Backend] Query existing Category/Task by name before using Counter
*   [x] **T-842**: [Backend] Implement atomic system_counters increments for new IDs
*   [ ] **T-843**: [Documentation] Update `Implement.md` with the new Counter + Upsert E2E flow

### 🚀 Phase 2.5: Workspace UX & Performance Audit
*   **Status**: ✅ Completed
*   [x] **T-810**: [Backend] Fix `TaskService.getTasks` performance issue (Remove full table scan, use `.where` instead).
    - **Error Logs**:
      - **[T-810-E1-1]**: 500 Internal Server Error (FAILED_PRECONDITION)
        1. **Root Cause**: `collectionGroup().where()` query requires manual index creation in Firebase Console.
        2. **Action**: Revert to memory filtering temporarily to restore service.
        3. **Status**: Fixed
*   [x] **T-811**: [Backend] Remove fallback to 'system' user in `tasks.routes.ts` (Throw 401 instead).
    - **Error Logs**:
      - **[T-811-E1-1]**: Automatic Redirect to Login on Task Submission
        1. **Root Cause**: `tasks.routes.ts` is missing `authenticate` middleware, leading to `req.user` being undefined and throwing 401.
        2. **Action**: Apply `authenticate` middleware to task routes.
        3. **Status**: Fixed
*   [x] **T-812**: [Frontend] Fix Dead Tabs in Workspace (`activeTab` filtering logic based on date).
*   [x] **T-813**: [Frontend] Add Edit/Delete actions in `TaskCard`.
*   [x] **T-814**: [Frontend] Fix Quick Filters button (Add functionality or hide it).
*   [x] **T-815**: [Backend] Localized Category ID Implementation (Change from global to per-WorkOrder counter).

### 🛠️ Phase 2.6: Task Management (Edit/Delete & Audit Trail)
*   **Status**: ✅ Completed
*   [x] **T-816**: [Backend] Implement Update & Soft Delete API with Audit Trail (EditHistory).
*   [x] **T-817**: [Frontend] Implement Edit Task Modal & Confirmation Dialog.
*   [x] **T-818**: [Backend] Category Migration Logic (Handle task movement between categories).

### 🚀 Phase 2.7: Task UI Refinement (User Request)
*   **Status**: ✅ Completed
*   [x] **T-819**: [Frontend] Add "Description" (หมายเหตุ) field to TaskCreateModal UI.

### 🚀 Phase 2.8: Task UI Refinement (Progress Indicator)
*   **Status**: ✅ Completed
*   [x] **T-822**: [Frontend] Implement Progress Bar in `TaskCard.tsx` (using `dailyProgress`).
*   [x] **T-823**: [Frontend] Style Progress Bar with premium aesthetics and percentage label.

### 🔄 Phase 2.9: Task Revision & Reject Workflow (F-016)
*   **Status**: 🔄 In Progress
*   [x] **T-850**: [Documentation] Update Implement.md, spec.md, and traceability.md with Revision logic.
*   [x] **T-851**: [Backend] Update `Task` model with `currentRevision` and cumulative `assignees`.
*   [x] **T-852**: [Backend] Modify `createTask` in `TaskService` to generate `revisions/rev00`.
*   [x] **T-853**: [Backend] Implement `POST /api/tasks/:id/reject` for Supervisor reject workflow.
*   [x] **T-854**: [Backend] Modify `dailyReportService` to save reports under `revisions/{currentRevision}`.

### 🔄 Phase 3.0: Daily Report Form & Labor Management (F-015)
*   **Status**: ✅ Completed
*   [x] **T-901**: [Frontend] Implement Date Selection Logic (3-day retroactive rule & Progress field locking).
*   [x] **T-902**: [Frontend] Implement Wage Period Lock (Disable form if date is within approved/paid period).
*   [x] **T-903**: [Frontend] Create Labor Selection Popup (Bulk selection + Central time config).
*   [x] **T-904**: [Frontend] Update WorkerRow to allow individual time adjustments on main screen.
*   [x] **T-905**: [Frontend] Implement Media Validation (Force 2 site photos + 2 labor photos).
*   [x] **T-906**: [Frontend] Filter Labor list by `projectLocationIds` (Same site only).
*   [x] **T-907**: [Frontend] Format Labor list as `employeeId : name`.

### 🔄 Phase 3.1: Leave Tracking in Daily Report (F-017)
*   **Status**: ✅ Completed
*   [x] **T-910**: [Documentation] Update `spec.md`, `Implement.md`, `traceability.md` for Leave Management feature.
*   [x] **T-911**: [Frontend] Add Leave tab/section to `WorkerRow` (morning/afternoon) and medical certificate upload UI.
*   [x] **T-912**: [Frontend] Update Daily Report submission payload to separate `labor` and `leave`.
*   [x] **T-913**: [Backend] Process `leave` array in `TaskService.submitDailyReport` and store medical certificate URLs.
*   [x] **T-914**: [Backend] Ensure `leave` history is tracked in `editHistory` similar to `labor`.
