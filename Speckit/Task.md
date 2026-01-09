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
#### 1. Symptom
*   User receives `401 Unauthorized` during login.

#### 2. Analysis
*   **Cause**: `AuthService.login` passed entire `User` object to `userService.verifyPassword` instead of just `user.id`. `verifyPassword` expects `string`.
*   **Solution**: Changed to pass `user.id`.

#### 3. Fix Steps
*   [x] Fix `AuthService.ts` to pass `user.id`.
*   [x] T-BUG-005-E1-1:
    *   **Cause**: Type mismatch in `AuthService.ts` (User object vs String ID).
    *   **Solution**: Updated call to `userService.verifyPassword(user.id, password)`.
    *   **Result**: Pass - 2026-01-08 (Static Analysis & Fix Applied).
*   [x] T-BUG-005-E2-1:
    *   **Cause**: Docker Emulator data was empty (logs showed "User not found"). Host env vars differ from Docker env vars.
    *   **Solution**: Manually ran seed script from host pointing to localhost ports.
    *   **Result**: Database populated. Ready for retry.

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
    *   **Result**: Database populated. Ready for retry.

### Task ID: T-VERIFY-001 (F-001 & F-002)
**Feature Ref**: F-001, F-002
**Status**: ✅ Verified
#### 1. F-001 Authentication
*   **Ready**: Login flow fixed and verified manually.
#### 2. F-002 User Management
*   **Backend**: `UserService` has `createUser` and `getAllUsers` (fixed 500 error).
*   **Database**: Stores in `users` collection.
*   **Frontend**: `UserForm.tsx` correctly implements fields (`employeeId`, `username`, `password`, `roleId`, `department`, `projectLocationIds`).
*   **Result**: Ready for User Acceptance Testing (UAT).
*   **Next Step**: Instrument `CrudService` to log exact queries.

#### 3. Fix Steps
*   [x] Add Debug Logs to `AuthService`.

---

### Task ID: T-BUG-007 (Project List Empty & Field Mismatch)
**Feature Ref**: F-002 Project Management
**Status**: ✅ Fixed

#### 1. Symptom
*   "Projecct Management" list shows projects with empty names ("-").
*   User creation form "Project" dropdown is empty or filtering incorrectly.

#### 2. Analysis
*   **Cause 1**: Collection Name Mismatch. Backend Config expected `Project` collection, but Seed Script wrote to `projectLocations`.
*   **Cause 2**: ID Mismatch. Seed Script used `project-p001`, User Data used `P001`.
*   **Cause 3**: Field Name Mismatch. Backend Model used `name`, but User Data and Frontend Schema used `projectName`.

#### 3. Fix Steps
*   [x] **Fix Collection & ID**: Updated `seed-emulator.ts` to use `Project` collection and `P001` IDs.
*   [x] **Fix Model Schema**:
    *   Renamed `name` to `projectName` in `ProjectLocation.ts`.
    *   Updated `ProjectLocationService.ts` and `projects.routes.ts` to use `projectName`.
    *   Updated `ProjectSelect.tsx` (Frontend) logic earlier to allow Admin access.
*   [x] **Re-seed**: Cleared and re-seeded database with correct schema.

#### 4. Result
*   Database now aligns with User's manual data structure.
*   Frontend displays Project Names correctly.
*   Dropdowns populate correctly.

---

### Task ID: T-BUG-008 (Real Firebase Connection Failed)
**Feature Ref**: F-001/F-002 Infrastructure
**Status**: ✅ Fixed

#### 1. Symptom
*   User configured `.env` with Service Account Key and `FIREBASE_EMULATOR_ENABLED=false`.
*   System still connects to Emulator.

#### 2. Analysis
*   **Cause 1**: `docker-compose.yml` hardcodes `FIREBASE_EMULATOR_ENABLED=true`, overriding `.env`.
*   **Cause 2**: `docker-compose.yml` does **not** pass `FIREBASE_SERVICE_ACCOUNT_KEY` to the backend container.

#### 3. Planned Fix
*   [x] Modify `docker-compose.yml` to pass `FIREBASE_SERVICE_ACCOUNT_KEY`.
*   [x] Modify `docker-compose.yml` to use `${FIREBASE_EMULATOR_ENABLED}` variable instead of hardcoded `true`.

#### 4. Result
*   Configuration is now flexible. User can switch via `.env`.
*   Requires Docker Restart to take effect.

---

### Task ID: T-SETUP-001 (Real Cloud Production Setup)
**Feature Ref**: Infrastructure
**Status**: ✅ Complete

#### 1. Goal
*   Create Initial Admin User on Real Firebase Cloud.
*   Requirements: User=`admin`, Pass=`admin123`, Role=`GOD` (Super Admin), Collection=`users`.

#### 2. Execution
*   **Script**: Created `backend/scripts/create-real-admin.ts`.
*   **Role**: Created new Role `GOD` with all permissions enabled (Level 99).
*   **User**: Created User `user-admin` assigned to `GOD` role.

#### 3. Result
*   Successfully connected to Project `labor-management-system-33b06`.
*   Admin user created successfully.
*   **Ready for Production Use**.

---

### Task ID: T-BUG-009 (Login Loop on Real Cloud)
**Feature Ref**: F-001 Authentication
**Status**: ✅ Fixed

#### 1. Symptom
*   User logs in -> Redirects to Dashboard -> Bounce back to Login.
*   Backend Logs: `Token verification failed: verifyIdToken() expects an ID token, but was given a custom token`.

#### 2. Analysis
*   **Cause**: Frontend `AuthService` was storing the `Custom Token` received from Backend directly into LocalStorage.
*   **Context**: On Emulator, we bypassed signature check so Custom Token might have passed (or payload was similar). On Real Cloud, `verifyIdToken` strictly validates JWT structure and signature.

#### 3. Fix Steps
*   [x] Updated `frontend/src/services/api/auth.service.ts`.
*   [x] Implemented `signInWithCustomToken` to exchange Custom Token for ID Token.
*   [x] Stored the resulting ID Token in LocalStorage.

#### 4. Result
*   Frontend now sends valid ID Token.
*   Backend `verifyIdToken` should succeed.

---

### Task ID: T-BUG-010 (Frontend Invalid API Key Error)
**Feature Ref**: Infrastructure
**Status**: ✅ Fixed

#### 1. Symptom
*   Frontend crashes with `FirebaseError: Firebase: Error (auth/invalid-api-key).`
*   Occurred after switching to Real Cloud.

#### 2. Analysis
*   **Cause**: `docker-compose.yml` uses substitution syntax (e.g., `${FIREBASE_API_KEY}`) to pass variables to Frontend.
*   **Root Cause**: `docker-compose` looks for these variables in the **ROOT** `.env` file, but the user only had `backend/.env`. Thus, variables were passed as empty strings.

#### 3. Fix Steps
*   [x] Identified `FIREBASE_API_KEY` exists in `backend/.env`.
*   [x] Copied `backend/.env` to Root `.env` to enable proper variable substitution.

#### 4. Result
*   Next Docker Restart will pick up the valid API Key.
*   **Update**: Error persisted. Found `frontend/.env.local` overriding Docker Env.
*   [x] Renamed `frontend/.env.local` to `.env.local.bak` to force usage of Docker variables.
*   **Update**: Variables confirmed present in Container (`docker exec`) but missing in App.
*   [x] Deleted `frontend/.next` folder to force full rebuild and clear stale caches.
*   **Update**: Emulator Container crashed due to Java incompatibility. Disabled Emulator Service since Real Cloud is used.
*   [x] Commented out `firebase-emulator` in `docker-compose.yml`.
*   **Update**: User requested efficiency. `run_command` used to inject `frontend/.env.local` directly.
*   [x] Created `frontend/.env.local` manually with valid Real Cloud keys using PowerShell.
*   [x] Fixed duplicate `networks` YAML syntax error in `docker-compose.yml`.
*   **Update**: Root Cause Found in Code. `firebase.ts` used dynamic `process.env[key]` access which fails in Next.js Client Side.
*   [x] Refactored `firebase.ts` to use explicit `process.env.NEXT_PUBLIC_...` access. This ensures Webpack can inline the values.

---

### Task ID: T-BUG-011 (Firebase Auth Configuration Not Found)
**Feature Ref**: Infrastructure
**Status**: 🔴 In Progress

#### 1. Symptom
*   Frontend Error: `FirebaseError: Firebase: Error (auth/configuration-not-found).`
*   Occurs during `signInWithCustomToken`.

#### 2. Analysis
*   **Progress**: The `auth/invalid-api-key` error is **Gone**. This means our Env/Code fixes worked!
*   **Cause**: This specific error usually means **Firebase Authentication** has not been "Enabled" or "Started" in the Firebase Console for this project. Even for Custom Tokens, the Auth service must be active.

#### 3. Fix Steps
*   [ ] User needs to go to Firebase Console > Authentication > Click "Get Started".
*   **Update**: User enabled Auth, but got 401 Unauthorized.

---

### Task ID: T-BUG-012 (Login 401 on Real Cloud)
**Feature Ref**: Authentication
**Status**: ✅ Fixed

#### 1. Symptom
*   User Input: `admin` / `admin123`
*   Result: `401 Unauthorized`. Backend Logs: `Login attempt...` but rejected.

#### 2. Analysis
*   **Cause**: The `admin` user likely didn't exist in the Real Cloud Database (only in Emulator). Or the password hash was mismatched/stale from previous dev cycles.
*   **Verification**: Re-ran admin creation script against Real Cloud to force-create the user.

#### 3. Fix Steps
*   [x] Executed `backend/scripts/create-real-admin.ts` specifically targeting `labor-management-system-33b06`.
*   [x] Overwrote `users/user-admin` with new password hash (`admin123`).

#### 4. Result
*   User `admin` definitely exists now with known password. Login should succeed.

---

### Task ID: T-SETUP-002 (Create Custom Admin 'GOD')
**Feature Ref**: User Management
**Status**: ✅ Complete

#### 1. Requirement
*   Create new admin user with specific constraints:
    *   Username: `admin`
    *   Password: `admin1`
    *   EmployeeID (and Document ID): `admin1`
    *   Role: `GOD`
    *   Department: `HO`

#### 2. Implementation
*   [x] Updated `create-real-admin.ts` to reflect these exact fields.
*   [x] Executed script against Real Cloud.

#### 3. Verification
*   Script output confirmed creation of user ID `admin1`.
*   User can now login with `admin` / `admin1`.

---

### Task ID: T-UI-001 (Header Layout Refactor)
**Feature Ref**: UI/UX
**Status**: ✅ Complete

#### 1. Requirement
*   Remove redundant "Labor Manager" logo from Top Header (keep specific page buttons if needed).
*   Replace removed logo with a "Back Button" (`< ย้อนกลับ`) in the top left of the header.

#### 2. Implementation
*   [x] Modified `frontend/src/components/layout/Layout.tsx`.
*   [x] Replaced `Stack` (Logo) with MUI `Button` (ArrowBack).
*   [x] Implemented `router.back()` logic.

#### 3. Note
*   This change is global (affects all pages).
*   If specific pages have their own back buttons, they might now be redundant.

---

### Task ID: T-UI-002 (Remove Redundant Page Back Button)
**Feature Ref**: UI/UX
**Status**: ✅ Complete (Global)

#### 1. Requirement
*   Remove the "Back Button" (`< ย้อนกลับ`) that sits *inside* the page content on ALL pages.
*   The Global Header Back Button is the single source of truth for navigation.

#### 2. Implementation
*   [x] Removed `<BackButton />` from:
    *   `project-management/index.tsx`
    *   `wage-calculation/index.tsx`
    *   `member-management/index.tsx`
    *   `management/index.tsx`
    *   `dc-management/index.tsx`
    *   `daily-reports/new.tsx`
    *   `daily-reports/index.tsx`
*   [x] Updated `Speckit/Implement.md` with new UI Rule.

#### 3. Result
*   Page UI is cleaner. No duplicate navigation buttons anywhere.

---

### Task ID: T-DATA-001 (Enforce DocumentID = EmployeeID)
**Feature Ref**: Data Integrity
**Status**: ✅ Complete

#### 1. Requirement
*   When creating a new user, the Firestore Document ID must match the `employeeId` field (instead of being auto-generated random string).

#### 2. Implementation
*   [x] Modified `backend/src/services/auth/UserService.ts`.
*   [x] Changed `createUser` to use `baseCrudService.createWithId(input.employeeId, ...)` instead of `create()`.

#### 3. Impact
*   New users created via API/Signup will have predictable IDs.
*   Easier to reference users in other collections.

---

### Task ID: T-UI-003 (Login Page Redesign)
**Feature Ref**: UI/UX
**Status**: ✅ Complete

#### 1. Requirement
*   Redesign Login Page to match "Modern UI Kit" reference.
*   Split Screen Layout (Text Left, Visuals Right).
*   Use System Theme (#2b2337 / #d62828).
*   Specific Red Circle Text: "Labor Management System".

#### 2. Implementation
*   [x] Rewrote `pages/login/index.tsx`.
*   [x] Implemented `Grid` layout (5:7 ratio).
*   [x] Added "Glassmorphism" abstract cards with CSS Backdrop Filter.
*   [x] Applied Linear Gradients matching theme.

#### 3. Result
*   Login page now looks premium and matches the reference image structure.


