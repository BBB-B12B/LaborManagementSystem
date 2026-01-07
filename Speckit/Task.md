# Development Tasks (Task.md)

## Project Roadmap & Status (ภาพรวมโครงการ)

### ✅ Phase 1: Backend Foundation (API & Models)
*   **Status**: Complete (42 Endpoints)
*   **Features**: Auth, Users, Projects, Skills, DC, DailyReports
*   **Ref**: `PHASE1.3_COMPLETE.md`

### ✅ Phase 2-6: Frontend Foundation
*   **Status**: Complete
*   **Deliverables**: Login, Navbar, Layout, Specialized Components (DatePicker, AutoComplete)

### ✅ Phase 7: US2 Daily Report
*   **Status**: Complete
*   **Deliverables**: Daily Report CRUD, Edit History, Multi-DC Selection

### ✅ Phase 8: US3 Overtime Management
*   **Status**: Complete
*   **Deliverables**: OT Periods (Morning/Noon/Evening), 1.5x Rate Logic

### ✅ Phase 9: US5 Member Management
*   **Status**: Complete
*   **Deliverables**: User CRUD, Role Management, Password Security

### ✅ Phase 10: US6 Daily Contractor Management
*   **Status**: Complete
*   **Deliverables**: DC CRUD, Skill Assignment, Social Security Logic

---

## ⚠️ Current Phase: Phase 11 & 12 (Pending Tasks)

### Task ID: T-170 (US7) - Wage Calculation
**Feature Ref**: F-007 Wage Calculation
**Status**: ⚠️ Backend Pending
#### 1. Concept / Goal
*   พัฒนา Calculation Engine ใน Backend สำหรับคำนวณงวดค่าแรง (15 วัน)

#### 2. Implementation Details
*   `WagePeriodService.calculateWages(periodId)`
*   Logic:
    *   ดึง `DailyReport` ทั้งหมดในช่วงเวลา
    *   ดึง `OvertimeRecord` ทั้งหมด
    *   รวมยอดตาม `EmployeeID`
    *   หัก `LateRecord` (ถ้ามี)
    *   บันทึกลง `WageSummary`

### Task ID: T-180 (US8) - Scan Data Import
**Feature Ref**: F-008 Scan Data
**Status**: 📋 Next
#### 1. Concept / Goal
*   ระบบ Import Excel จากเครื่องสแกนนิ้ว

#### 2. Implementation Details
*   `ScanDataService.import(file)`
*   Parse Excel ด้วย `xlsx`
*   Round Down เวลาทุก 5 นาที
*   สร้าง `ScanDataDiscrepancy` เมื่อเทียบกับ Report

---

### Error Logging Protocol (บันทึก Error ตาม `Implement.md`)
หากพบ Error ให้บันทึกแทรกใน Task ID นั้นๆ ตาม Format: `T-xxx-Ex-x`
*   **Cause**: สาเหตุ
*   **Solution**: วิธีแก้
*   **Result**: ผลลัพธ์ (Pass/Failed + Timestamp)

---

### Task ID: T-BUG-001
**Feature Ref**: F-001 Authentication
**Status**: 🧪 Verifying (Refactor Completed)
#### 1. Symptom
*   Login Failed with Status 400 (Bad Request)

#### 2. Analysis
*   **Backend**: Expects `idToken` (Firebase Token).
*   **Frontend**: `LoginForm` collects `username` and `password`.
*   **Root Cause**: Mismatch in payload. Frontend likely sending `{username, password}` directly.
*   **Solution**: Update `auth.service.ts` to login via Firebase first (if email based) OR Update Backend to accept `username/password` and handle Firebase login (Admin SDK) or Custom Token.

#### 3. Fix Steps
*   [x] Check `auth.service.ts` implementation.
*   [x] If Username based, backend must handle login or Frontend must resolve email.
*   [x] Implemented Custom Token Minting in Backend.
*   [x] Implemented Token Exchange in Frontend.

---

### Task ID: T-BUG-002 (Hydration Error)
**Feature Ref**: F-001 Authentication (Login Page)
**Status**: ✅ Fixed
#### 1. Symptom
*   Text content does not match server-rendered HTML.
*   Server: "ชื่อผู้ใช้" (Thai), Client: "Username" (English).

#### 2. Analysis
*   **Cause**: `i18next` initialization mismatch.
*   **Solution**: Ensure consistent default language OR use `next-i18next` properly.

#### 3. Fix Steps
*   [x] Check `i18n` config.
*   [x] Force consistent initial language (`th`) to prevent Hydration Error.

---

### Task ID: T-BUG-003 (Critical 500 Errors)
**Feature Ref**: Multiple
**Status**: ✅ Fixed
#### 1. Symptom
*   500 Internal Server Error on multiple GET endpoints.

#### 2. Analysis
*   **Hypothesis**: Auth Middleware failing to verify token?
*   **Solution**: Check Backend Logs.

#### 3. Fix Steps
*   [x] Check `docker logs labor-backend`.
*   [x] Fix Middleware logic (Added Try-Catch & Logging).

---

### Task ID: T-BUG-004 (Login Loop/Bounce)
**Feature Ref**: F-001 Authentication
**Status**: 🧪 Verifying (Verified by User manual step)
#### 1. Symptom
*   User logs in -> Redirects to Dashboard -> Immediately redirects back to Login.

#### 2. Analysis
*   **Likely Cause**: Issuer Mismatch (Localhost vs Container Hostname) in Firebase Emulator.

#### 3. Fix Steps
*   [x] Fix Backend Code: Implemented Manual Token Decoding for Emulator Environment to bypass Signature Verification.
*   [x] Restart Backend.

---

### Task ID: T-BUG-005 (Login 401 Unauthorized)
**Feature Ref**: F-001 Authentication
**Status**: ✅ Fixed

---

### Task ID: T-BUG-006 (Project List 500 Error)
**Feature Ref**: F-002 Project Management
**Status**: ✅ Fixed
#### 1. Symptom
*   Project page shows "No rows" and 500 Error.
*   Logs indicate crash when parsing dates.

#### 2. Analysis
*   **Cause**: `ProjectLocation` model expects Firestore Timestamp but received String (from JSON seed or import). `toDate()` failed.
*   **Solution**: Update `projectLocationConverter` to safely handle String or Timestamp.

#### 3. Fix Steps
*   [x] Modify `ProjectLocation.ts` to use safe `toDate` helper.
#### 1. Symptom
*   User receives `401 Unauthorized`.
*   **New Blocker**: `CrudService.ts` compilation error `TS1005` preventing backend startup.


#### 2. Analysis
*   **Possibilities**:
    1.  Wrong Username/Password (User error or Seed data mismatch) -> Rule out, verified seed data.
    2.  `AuthService` cannot find user in Firestore -> **CONFIRMED**.
    3.  Emulator configuration mismatch -> **FIXED** (forced env vars), but problem persists.
    4.  Query filters misbehaving?
*   **Next Step**: Instrument `CrudService` to log exact queries.

#### 3. Fix Steps
*   [x] Add Debug Logs to `AuthService`.
*   [x] **Refactor**: Replaced `CrudService` with `BaseCrudService`.
*   [x] Verify Fix via Login (Verified via Script/Curl).

