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
**Status**: ✅ Complete
#### 1. Concept / Goal
*   พัฒนา Calculation Engine ใน Backend สำหรับคำนวณงวดค่าแรง (15 วัน) ตาม Spec `specs/001-labor-daily-report/spec.md`

#### 2. Detailed Sub-tasks
*   **[x] T-170-1**: สร้าง/ตรวจสอบ `WagePeriodService.ts` และ Logic การคำนวณ (Audit).
*   **[x] T-170-2**: Implement ฟังก์ชัน `calculateWages` ใน `WagePeriodService` (Calculation Engine).
*   **[x] T-170-3**: Implement ฟังก์ชัน `updateWagePeriod` (จัดการ Additional Income/Expense).
*   **[x] T-170-4**: เชื่อมต่อ API กับ Frontend (`WageCalculation` page).
*   **[-] T-170-5**: สร้างสคริปต์ Mock Data สำหรับการเตรียมข้อมูลชุดทดสอบ (Cancelled per User Request).

#### 3. Error Logging
*   **T-170-E1-1**:
    *   **Cause**: เส้นทาง API (Endpoint) สำหรับการลบ Additional Income/Expense ใน Frontend ไม่ตรงกับ Backend (ขาด prefix `/wage-periods`)
    *   **Solution**: แก้ไข `wageService.ts` ใน Frontend ให้ใช้เส้นทาง `/api/wage-periods/additional-income/:id` ให้ตรงกับ Backend
    *   **Result**: Pass (2026-01-21 11:15)
*   **T-170-E2-1**:
    *   **Cause**: เกิด Generic Type Mismatch ใน `WagePeriodService` constructor เมื่อส่ง `collections.wagePeriods` เข้าไปใน `super()` เนื่องจากความแตกต่างของรุ่น interface ใน Firestore
    *   **Solution**: ทำการ cast collection reference เป็น `any` เพื่อข้ามการตรวจสอบ Type ที่เข้มงวดเกินไปในชั้นของ BaseCrudService
    *   **Result**: Pass (2026-01-21 11:20)
*   **T-170-E3-1**:
    *   **Cause**: ชื่อฟิลด์สำหรับหักเงินมาสายไม่ตรงกัน ในโมเดลใช้ `lateDeduction` แต่ในโค้ดส่วนคำนวณเรียกใช้ `deductionAmount`
    *   **Solution**: แก้ไข `WagePeriodService.ts` ให้เรียกใช้ `lateDeduction` และทำการ cast ข้อมูลเป็น `any` เพื่อดึงค่าจาก Firestore document ได้ถูกต้อง
    *   **Result**: Pass (2026-01-21 11:25)
*   **T-170-E5-1**:
    *   **Cause**: ขาดการ Import `DCWageSummary` ในไฟล์ `WagePeriodService.ts` ทำให้คอมไพล์ไม่ผ่าน
    *   **Solution**: เพิ่มการ Import `DCWageSummary` จาก `../../models/WagePeriod`
    *   **Result**: Pass (2026-01-21 11:58)
*   **T-170-E6-1**:
    *   **Cause**: TypeScript แจ้งเตือนว่า property `id` ไม่มีอยู่ในออบเจกต์รายได้/รายจ่ายเพิ่มเติม เนื่องจาก Type Inference มองว่าเป็น `Omit<T, "id">`
    *   **Solution**: ทำการ Casting ข้อมูลที่ดึงมาจาก Firestore เป็น `AdditionalIncome[]` และ `AdditionalExpense[]` อย่างชัดเจนเพื่อให้เข้าถึง ID ได้
    *   **Result**: Pass (2026-01-21 11:59)

### Task ID: T-180 (US8) - Scan Data Import
**Feature Ref**: F-008 Scan Data
**Status**: ✅ Complete
*   [x] **T-180-1**: สร้าง API สำหรับ Upload Excel/CSV ข้อมูลสแกนนิ้ว.
*   [x] **T-180-2**: พัฒนา Parser สำหรับแปลงข้อมูลจากเครื่องสแกน (ZKTeco/etc).
*   [x] **T-180-3**: สร้างหน้า UI สำหรับเลือกไฟล์และตรวจสอบผลการ Import.
*   [x] **T-180-4**: Implement Logic ตรวจสอบ Discrepancy (ความแตกต่าง) ระหว่าง Scan และ Report.

### Task ID: T-190 (Fix) - Daily Report Integration & UI Fixes
**Feature Ref**: F-003 Daily Reports / F-007 Wage Calculation
**Status**: [/] Executing Fixes
#### 1. Concept / Goal
*   เชื่อมต่อ `DCAutoComplete` กับ API จริง และปรับโครงสร้างข้อมูล Daily Report ให้สอดคล้องกับ Logic การคำนวณค่าแรง

#### 2. Detailed Sub-tasks
*   **[x] T-190-1**: แก้ไข `DCAutoComplete.tsx` ให้ดึงข้อมูลแรงงานจริงจากฐานข้อมูล (Real API).
*   **[x] T-190-2**: ปรับชื่อฟิลด์ใน `DailyReportForm.tsx` (workDate, taskName, netHours) ให้ตรงกับโมเดล.
*   **[x] T-190-3**: แก้ไข `dailyReportService.ts` (Backend) ให้บันทึกข้อมูลแบบรายคน (Singular DC ID) ตามโมเดล.
*   **[x] T-190-4**: ปรับปรุง Logic การ Query ใน `WagePeriodService.ts` ให้ดึงข้อมูลมาคำนวณได้อย่างถูกต้อง.

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

*   **T-190-E1-1**:
    ... (as before) ...
*   **T-190-E2-1**:
    *   **Cause**: ผู้ใช้ไม่สามารถบันทึกงาน 08:00 - 17:00 ได้ เนื่องจากหน้าบ้านคำนวณได้ 9 ชม. (เกินขีดจำกัด 8 ชม. ใน `regular` work) และไม่ได้หักพักเที่ยงอัตโนมัติ
    *   **Solution**: เพิ่มฟังก์ชัน `calculateNetHours` ใน `TimePicker.tsx` และเรียกใช้ใน `DailyReportForm.tsx` เพื่อหักพักเที่ยง 1 ชม. สำหรับงานปกติ
    *   **Result**: Fixed (2026-01-21 15:15)

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

### Task ID: T-UI-004 (Refactor Project Display)
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
#### 1. Requirement
*   Display `projectCode` (e.g., WH3, HO) instead of `code` (e.g., P001) in Project Select.
*   `code` is just an internal sequence. `projectCode` is the meaningful identifier.

#### 2. Solution
*   **Backend**: Added `projectCode` to `ProjectLocation` model and Firestore converter.
*   **Frontend**: Updated `ProjectSelect` to display `projectCode` : `projectName`.
*   **Fallback**: If `projectCode` is missing, falls back to `code`.

### Task ID: T-UI-005 (Refine DataGrid Focus)
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
#### 1. Requirement
*   Remove black focus outline (border) when clicking on DataGrid row/cell.
*   Apply globally to all pages.

#### 2. Solution
*   **Theme**: Added `MuiDataGrid` style override in `src/theme/index.ts`.
*   **CSS**: Set `outline: none !important` for focus/focus-within states of cells and headers.

### 🧪 Phase 12: UI/UX Refinement & Polish
*   [x] T-UI-006: Pagination & View Options
*   [/] T-UI-007: Premium Project Creation Popup

### Task ID: T-UI-006 (Pagination & View Options)
**Feature Ref**: F-006 / User Interface
**Status**: ✅ Complete
#### 1. Requirement
*   **Project Management**: Remove pagination footer (Single Page View).
*   **Other Pages**: Set default "Records per page" to 10.

#### 2. Solution
*   **Project Management**: Set `hideFooter={true}` and `pageSize=100`.
*   **Member/DC Lists**: Updated default `pageSize` state to 10.
*   **Daily Reports**: Updated common `DataGrid` wrapper to accept `initialState` and `sx` props; set default `pageSize=10`.
*   **Daily Reports**: Updated common `DataGrid` wrapper to accept `initialState` and `sx` props; set default `pageSize=10`.
*   **Fixes**: Removed invalid `showAll` props from `RoleSelect`/`DepartmentSelect` and fixed handler types in Member Management.

#### 3. Error Logging
*   **T-UI-006-E1-1** (MUI Version Mismatch):
    *   **สาเหตุ**: โค้ดใช้ Type ของ `@mui/x-data-grid` v6 (`GridPaginationModel`) แต่โปรเจกต์ติดตั้ง v5 (`^5.17.0`)
    *   **การแก้ไข**: ปรับ `DataGrid.tsx` กลับมาใช้ v5 compatible types (`GridSelectionModel`, `rowsPerPageOptions`) และลบ `slots` (ใช้ `components` แทน)
*   **T-UI-006-E1-2** (GridActionsCellItem Lint):
    *   **สาเหตุ**: Type ของ `GridActionsCellItem` ใน v5 มีปัญหากับ JSX Intrinsic Attributes (ฟ้องว่าขาด `placeholder`, `onResize` ฯลฯ)
    *   **การแก้ไข**: สร้าง Local Alias `GridActionsCellItemAny` (type `any`) เพื่อ Bypass Type Inspection ในไฟล์ `daily-reports/index.tsx`
*   **T-UI-007-E1-1** (Infinite Loop Request):
    *   **สาเหตุ**: `useEffect` ใน `ProjectCreateModal` มี `toast` เป็น dependency ซึ่ง `useToast` return object ใหม่ทุกครั้งที่ render ทำให้เกิด loop
    *   **ผลกระทบ**: ส่ง Request ไปยัง Google Cloud Firestore จำนวนมากจน Quota เต็ม (Resource Exhausted) ทำให้ระบบ Production ล่มชั่วคราว
    *   **การแก้ไข (Code)**: ลบ `toast` ออกจาก dependency array ของ `useEffect`
    *   **การแก้ไข (System)**: สลับไปใช้ Firebase Emulator ใน `docker-compose.yml` ชั่วคราวเพื่อให้ทำงานต่อได้
    *   **Next Step**: รอ Quota Reset แล้วสลับกลับไปใช้ Production Database โดยแก้ `FIREBASE_EMULATOR_ENABLED` เป็น `false`
    *   **Preventive Action**: ตรวจสอบและแก้ไข `ProjectForm.tsx` ที่มี pattern เดียวกันเพื่อป้องกันปัญหาในอนาคตเรียบร้อยแล้ว

*   **Optimization**: แก้ไข `_app.tsx` ให้เรียกใช้ `QueryClient` แบบ Global จาก `src/config/queryClient.ts` ซึ่งตั้งค่า `staleTime: 5 min` และ `refetchOnWindowFocus: false` (ตามกลยุทธ์ Fetch Once)

---

### Task ID: T-INF-001 (Fix Docker Environment)
*   [x] [T-INF-001] **Fix Docker Compose & Firebase Emulator JDK Issue**
    *   **Type**: Infrastructure
    *   **Priority**: High
    *   **Description**: แก้ไขปัญหา Emulator ล่มเนื่องจากต้องการ JDK 21+
    *   **Traceability**: Infrastructure
    *   **Result**: Fixed and Verified (2026-01-22)

### Task ID: T-AUD-001 (Firebase Connection Audit)
**Feature Ref**: Infrastructure
**Status**: ✅ Complete
#### 1. Concept / Goal
*   ตรวจสอบความถูกต้องของการเชื่อมต่อ Firebase (Cloud vs Emulator) ตามขั้นตอนใน `Implement.md`
#### 2. Result
*   Verified: ระบบเชื่อมต่อกับ Firebase Cloud (`labor-management-system-33b06`) เรียบร้อยแล้ว (Emulator Disabled ใน `.env` และ `docker-compose.yml`)

---

### Error Logging Protocol (บันทึก Error ตาม `Implement.md`)

*   **T-INF-E1-1** (Firebase Emulator JDK 21 Requirement):
    *   **Cause**: Firestore emulator เวอร์ชันล่าสุดต้องการ JDK 21+ แต่ Dockerfile เดิมติดตั้ง JDK 17 ทำให้ Emulator ล่มด้วย Exit Code 1
    *   **Solution**: อัปเดต `firebase/Dockerfile` ให้ใช้ `node:20-alpine` และติดตั้ง `openjdk21-jre`
    *   **Result**: Fixed and Verified (2026-01-22)

---

### [CANCELLED] Task ID: T-200 (Wage Calculation Test Data)
*   [-] [T-200] **Create Mock Data for Wage Calculation Testing** (Cancelled by User)

---

### Task ID: T-210
**Feature Ref**: F-010 Integrated Wage Calculation
**Status**: [x] Complete
#### 1. Concept / Goal
* พัฒนา Backend Logic สำหรับการคำนวณค่าแรงที่เชื่อมโยงกับข้อมูลสแกนนิ้วและตรวจสอบความผิดปกติอัตโนมัติ

#### 2. Detailed Sub-tasks
* [x] **T-210-1**: สร้าง `LateRecordService.ts` และ Logic การสร้างบันทึกมาสายอัตโนมัติ
* [x] **T-210-2**: ปรับปรุง `WagePeriodService.calculateWages` ให้เรียกใช้การตรวจสอบ Discrepancy
* [x] **T-210-3**: รวมผลการหักเงินมาสายเข้าในการคำนวณรายจ่ายสุทธิ

### Task ID: T-220
**Feature Ref**: F-010 Integrated Wage Calculation
**Status**: [x] Complete
#### 1. Concept / Goal
* ปรับปรุง Frontend UI ให้แสดงผลการจับคู่ข้อมูลสแกนนิ้วและรายการหักเงินมาสายในหน้ารายละเอียดงวดค่าแรง

#### 2. Detailed Sub-tasks
* [x] **T-220-1**: เพิ่ม Column ในหน้า [id].tsx สำหรับ Discrepancy Status และ Late Deduction
* [x] **T-220-2**: ปรับปรุง UI ให้รองรับการแสดงผลแบบพรีเมียมตามมาตรฐานโปรเจกต์
