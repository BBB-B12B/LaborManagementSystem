# Traceability Matrix (Full Project)

## 1. RTM (Requirements Traceability Matrix)
Mapping ระหว่าง Feature หลักและไฟล์ Code ที่สำคัญ

| Feature ID | Controller / Route | Model File | Description |
| :--- | :--- | :--- | :--- |
| **F-001** (Auth) | `auth.routes.ts` | `User.ts` | Authentication System |
| **F-002** (User) | `users.routes.ts` | `User.ts`, `Role.ts` | User Administration |
| **F-003** (Report) | `dailyReports.routes.ts` | `DailyReport.ts`, `FileAttachment.ts` | Daily Work Records |
| **F-004** (Project) | `projects.routes.ts` | `ProjectLocation.ts` | Site Management |
| **F-005** (Skill) | `skills.routes.ts` | `Skill.ts` | Skill Categories |
| **F-006** (DC) | `dailyContractors.routes.ts` | `DailyContractor.ts`, `SocialSecurityCalculation.ts` | Contractor Data |
| **F-007** (Wage) | `wagePeriods.routes.ts` | `WagePeriod.ts`, `AdditionalIncome.ts` | Wage Calculation |
| **F-008** (Scan) | `scanData.routes.ts` | `ScanData.ts`, `LateRecord.ts` | Finger Scan Processing |
| **F-007, F-008** | `seedWageTestData.ts` | - | Mock Data for Wage Testing |
| **F-010** (Integrated Wage) | `wagePeriods.routes.ts` | `WagePeriod.ts`, `ScanData.ts`, `LateRecord.ts` | Integrated Wage Calculation |

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

## 3. Infrastructure & Configuration
Mapping ระหว่าง System Config และตัวแปรที่ใช้งาน

| Config File | Env Variable | Related Component | Description |
| :--- | :--- | :--- | :--- |
| `docker-compose.yml` | `FIREBASE_EMULATOR_ENABLED` | `firebase.ts` | Toggles between Emulator/Cloud |
| `backend/.env` | `FIREBASE_SERVICE_ACCOUNT_KEY` | `firebase.ts` | Service Account Credential JSON |
| `backend/src/config/index.ts` | `FIREBASE_PROJECT_ID` | `firebase.ts` | Target Project Identifier |

