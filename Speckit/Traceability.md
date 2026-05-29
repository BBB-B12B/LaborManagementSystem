# Traceability Matrix (Full Project)

- **2026-04-06 09:36Z:** **PHASE 1.5 AUDIT & POLISH STARTED.** Addressing frontend instructions and backend API consistency based on UX Framework.
- **2026-04-06 09:46Z:** **PHASE 1.6 BULLETPROOF IMPORT ACTIVATED.** Implemented multi-sheet scanning and fuzzy header matching for maximum reliability.

## 1. RTM (Requirements Traceability Matrix)
Mapping ระหว่าง Feature หลักและไฟล์ Code ที่สำคัญ

| Feature ID | Task ID | Controller / Route | Model File | Description |
| :--- | :--- | :--- | :--- | :--- |
| **F-013** | **T-709, T-710** | `DailyReportService.ts` | - | Multi-sheet & Fuzzy Parsing Logic |
| **F-013** | **T-711** | `dailyReportService.ts` (FE) | - | Descriptive Error Messaging |
| **F-001** (Auth) | - | `auth.routes.ts` | `User.ts` | Authentication System |
| **F-002** (User) | - | `users.routes.ts` | `User.ts`, `Role.ts` | User Administration |
| **F-003** (Report) | - | `dailyReports.routes.ts` | `DailyReport.ts`, `FileAttachment.ts` | Daily Work Records |
| **F-004** (Project) | - | `projects.routes.ts` | `ProjectLocation.ts` | Site Management |
| **F-005** (Skill) | - | `skills.routes.ts` | `Skill.ts` | Skill Categories |
| **F-013** | **T-706** | `backend/src/api/routes/dailyReports.routes.ts` | - | Fix removal route matching |
| **F-013** | **T-707** | `backend/src/utils/dailyReportExcel.ts` | - | Robust Excel Parsing logic |
| **F-013** | **T-708** | `frontend/src/pages/daily-reports/components/DailyReportUploadDialog.tsx` | - | UX Refinement and Update Help Text |
| **F-006** (DC) | - | `dailyContractors.routes.ts` | `DailyContractor.ts`, `SocialSecurityCalculation.ts` | Contractor Data |
| **F-007** (Wage) | - | `wagePeriods.routes.ts` | `WagePeriod.ts`, `AdditionalIncome.ts` | Wage Calculation |
| **F-008** (Scan) | - | `scanData.routes.ts` | `ScanData.ts`, `LateRecord.ts` | Finger Scan Processing |
| **F-007, F-008** | - | `seedWageTestData.ts` | - | Mock Data for Wage Testing |
| **F-010** (Integrated Wage) | - | `wagePeriods.routes.ts` | `WagePeriod.ts`, `ScanData.ts`, `LateRecord.ts` | Integrated Wage Calculation |
| **F-012** (SS Rules) | - | `socialSecurityRules.routes.ts` | `SocialSecurityRule.ts` | Social Security Rules Config |

## 2. Data & Component Traceability
Mapping ระหว่าง Entity และความหมายในระบบ

| Entity / Concept | File (`backend/src/models`) | Description & Usage |
| :--- | :--- | :--- |
| **User** | `User.ts` | ผู้ใช้งานระบบ (Admin, Foreman) |
| **Role** | `Role.ts` | สิทธิ์การเข้าถึง (8 Levels) |
| **DailyReport** | `DailyReport.ts` | เอกสารรายงาน 1 วัน |
| **EditHistory** | `EditHistory.ts` | ประวัติการแก้ไข (Audit Trail) |
| **FileAttachment** | `FileAttachment.ts` | ไฟล์แนบ (รูปภาพ/เอกสาร) |
| **DailyContractor** | `DailyContractor.ts` | รายชื่อคนงาน |
| **SocialSecurity** | `SocialSecurityCalculation.ts` | ตรรกะคำนวณประกันสังคม |
| **ScanData** | `ScanData.ts` | ข้อมูลดิบจากเครื่องสแกน |
| **ScanDataDiscrepancy** | `ScanDataDiscrepancy.ts` | ผลต่างระหว่าง Report vs Scan |
| **LateRecord** | `LateRecord.ts` | บันทึกการเข้างานสาย |
| **WagePeriod** | `WagePeriod.ts` | งวดการจ่ายเงิน (15 วัน) |
| **AdditionalIncome** | `AdditionalIncome.ts` | รายได้อื่นๆ (เบี้ยขยัน, ค่ารถ) |
| **AdditionalExpense** | `AdditionalExpense.ts` | รายจ่ายอื่นๆ (ค่าหัก) |
| **SocialSecurityRule** | `SocialSecurityRule.ts` | กฎเกณฑ์การหักเงินประกันสังคม แบบไดนามิก |

## 3. Infrastructure & Configuration
Mapping ระหว่าง System Config และตัวแปรที่ใช้งาน

| `backend/.env` | `FIREBASE_SERVICE_ACCOUNT_KEY` | `firebase.ts` | Service Account Credential JSON |
| `backend/src/config/index.ts` | `FIREBASE_PROJECT_ID` | `firebase.ts` | Target Project Identifier |

## 4. Task Traceability
| Task ID | Name | Goal | key Components |
| :--- | :--- | :--- | :--- |
| **T-300** | Mobile Daily Report | Schema Refactor & Unified UI | `DailyReport.ts`, `DailyReportService.ts`, `new.tsx`, `MobileDailyReportView.tsx` |
| **T-301** | Daily Report UI Lift & Shift | Mock rendering of Post-Sale UI components | `new.tsx`, `WorkOrderContext.tsx`, `legacy.ts`, `imageCompression.ts` |
| **T-330** | Master Form Modal | Multi-section Form (Regular, OT Morning/Noon/Evening), Worker Subset Logic, Batch Save | `DailyReportEntryModal.tsx` |
| **T-350** | Wage Period Soft Delete | Implement Soft Delete for Wage Periods | `WagePeriod.ts`, `WagePeriodService.ts`, `wagePeriods.routes.ts` |
| **T-360** | Refactor Project Identity | projectCode & projectName | `WagePeriod.ts`, `WagePeriodService.ts` |
| **T-361** | Wage Calculation UI Refinement | Adjust button color and table display | `index.tsx` (frontend) |
| **T-362** | Wage Detail UI Refinement | Full width table and button color | `[id].tsx` (frontend) |
| **F-013** | Excel Import | Import Daily Reports from Excel | `dailyReportRoutes.ts`, `DailyReportService.ts` |
| **T-302** | Workspace Kanban UI | Mock rendering of Task Board with Gradient borders based on UX Audit | `workspace/index.tsx`, `Navbar.tsx` |
| **T-303** | Workspace API Integration | Real data integration, Task creation logic with running number, Modal UI | `TaskService.ts`, `Task.ts`, `TaskCreateModal.tsx`, `workspace/index.tsx` |
| **T-304** | UserForm DatePicker Fix | Fix LocalizationProvider crash by using custom DatePicker component | `UserForm.tsx` |
