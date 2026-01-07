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
