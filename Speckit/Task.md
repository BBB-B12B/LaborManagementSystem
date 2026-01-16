# Development Tasks (Task.md)

## Project Roadmap & Status (ภาพรวมโครงการ)

### ✅ Phase 1: Backend Foundation (API & Models)
*   **Status**: Complete (42 Endpoints)
*   **Ref**: `PHASE1.3_COMPLETE.md`

### ✅ Phase 2-6: Frontend Foundation
*   **Status**: Complete

### ✅ Phase 7: US2 Daily Report
*   **Status**: Complete

### ✅ Phase 8: US3 Overtime Management
*   **Status**: Complete

### ✅ Phase 9: US5 Member Management
*   **Status**: Complete

### ✅ Phase 10: US6 Daily Contractor Management
*   **Status**: Complete

### 🧪 Phase 10.5: User Acceptance Testing (F-006)
*   [ ] **Test Case 1**: Create Standard DC (ID: `DC001`). Verify success.
*   [ ] **Test Case 2**: Create Social Security Exempt DC (ID: `9001`). Verify "Exempt" badge appears.
*   [ ] **Test Case 3**: Duplicate ID Check. Try creating `DC001` again.
*   [ ] **Test Case 4**: Verify Data in List.

---

## ⚠️ Current Phase: Phase 11 & 12 (Pending Tasks)

### Task ID: T-170 (US7) - Wage Calculation
**Feature Ref**: F-007 Wage Calculation
**Status**: ⚠️ Backend Pending
#### 1. Concept / Goal
*   พัฒนา Calculation Engine ใน Backend สำหรับคำนวณงวดค่าแรง (15 วัน)

### Task ID: T-180 (US8) - Scan Data Import
**Feature Ref**: F-008 Scan Data
**Status**: 📋 Next

---

### Task ID: T-IMP-001 (Localize Import Template)
**Feature Ref**: F-006 / Usability
**Status**: ✅ Complete
#### 1. Requirement
*   Change CSV Import Template headers to Thai.
#### 2. Result
*   Updated template and parser to use Thai headers.

### Task ID: T-IMP-002 (Refine Data Schema & Import)
**Feature Ref**: F-006 / Data Management
**Status**: ✅ Complete
#### 1. Requirement
*   Remove Optional/Unnecessary Fields (Phone, Address, EndDate, etc.) from Import.
*   Change Project ID separator from `|` to `,`.
*   Update Documentation (`DailyContractor_DataSchema.md`).

#### 2. Solution
*   **Backend**: Removed reading of optional fields in `dailyContractors.routes.ts`.
*   **Template**: Updated `dc-labor-data-template.csv` (Removed 6 cols, used comma separator).
*   **Docs**: Updated Schema documentation.

---

### Error Logging Protocol (บันทึก Error ตาม `Implement.md`)
หากพบ Error ให้บันทึกแทรกใน Task ID นั้นๆ ตาม Format: `T-xxx-Ex-x`
*   **Cause**: สาเหตุ
*   **Solution**: วิธีแก้
*   **Result**: ผลลัพธ์ (Pass/Failed + Timestamp)

### Task ID: T-UI-001 (Cleanup DC UI)
*   **T-UI-001-E1-1**:
    *   **Cause**: `DatePicker` component expects `Date | null` but received `undefined` from `react-hook-form`.
    *   **Solution**: Added `field.value ?? null` to ensure value is never undefined.
    *   **Result**: Fixed (2026-01-14).
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
#### 1. Requirement
*   Remove unused fields (Phone, ID Card, Address, Emergency Contact) from "Create Daily Contractor" screen.
*   Remove corresponding column (Phone) from the main table.
*   Ensure UI matches the `DailyContractor_DataSchema.md`.

#### 2. Solution
*   **Frontend**: Removed Contact Info section from `DCForm.tsx` and Phone column from `index.tsx`.
*   **Refinement**: Removed "End Date" field as per user request (T-UI-001-2).
*   **Refinement**: Updated Project Select to save "Project Code" (e.g., HO) instead of UUID (T-UI-001-3).
*   **Validation**: Removed Zod validation rules in `dcSchema.ts` for unused fields.

### Task ID: T-UI-003 (Refine Project Select UI)
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
#### 1. Requirement
*   Remove Project Sequence (default order) and use Project Code (A-Z).
*   Refine UI to match Login Page (Premium/Elegant).
*   Do not change position or layout structure.

#### 2. Solution
*   **Sorting**: Updated `ProjectSelect.tsx` to sort projects by `code` alphabetically.
*   **UI Design**: Implemented custom `renderOption` with:
    *   **Project Code**: Bold, Primary Color (`#2b2337`).
    *   **Separator**: Vertical divider.
    *   **Project Name**: Grey text.
    *   **Department**: Small outlined chip.
*   **Display**: Input field shows `Code : Name` for clarity.

### Task ID: T-UI-004 (Table Styling)
**Feature Ref**: F-006 / User Interface
**Status**: ↩️ Reverted (User Request)
#### 1. Requirement
*   Update Data Grid to match "Clean/Modern" reference.
*   Increase spacing (Padding).
*   Add Amber highlight for selected rows.
*   Rounding corners and Premium Shadow.
*   **Do not** change headers or buttons.

#### 2. Solution
*   **Container**: Added `borderRadius: 4` and soft shadow (`0 12px 24px...`).
*   **Layout**: Increased `rowHeight` to `72px` and `headerHeight` to `64px`.
*   **Visuals**: Removed vertical borders and grid lines (Dashed horizontal only).
*   **Highlight**: Added `#FFF7CD` (Amber) background for selected rows.
*   **Headers**: Made background transparent with bold gray text.

### Task ID: T-UI-002 (Fix Build Errors)
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
*   **T-UI-002-E1-1**:
    *   **Cause**: `SkillSelect` `onChange` expects `string | null` but handler accepted `string`.
    *   **Solution**: Updated `handleSkillChange` in `index.tsx` to accept `string | null`.
    *   **Result**: Fixed (2026-01-16).
*   **T-UI-002-E2-1**:
    *   **Cause**: `SkillSelect` does not have `showAll` prop but it was passed.
    *   **Solution**: Removed `showAll` prop from `index.tsx`.
    *   **Result**: Fixed (2026-01-16).
*   **T-UI-002-E3**:
    *   **Cause**: `ProjectSelect` was passed invalid `showAll` prop.
    *   **Solution**: Removed `showAll` prop from component usage.
    *   **Result**: Fixed (2026-01-16).
