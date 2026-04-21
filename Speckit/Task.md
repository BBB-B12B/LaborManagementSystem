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
*   [/] **T-804**: [Frontend] Read/Write: Update Daily Report to sync with `workOrders/.../tasks/{id}/dailyreport`.
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
