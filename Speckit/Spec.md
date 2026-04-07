# Specification (Spec.md)

## Feature List (รวม Feature ทั้งหมดในโปรเจกต์)

*Note: อ้างอิงจาก Source Code จริงใน Backend Models และ Routes*

### Feature ID: F-001
**Name**: ระบบยืนยันตัวตน (Authentication & Authorization)
**Status**: ✅ Complete
#### 1. User Flow
*   Login/Logout
*   Token Management (Refresh Token)
*   Role-Based Access Control (8 Roles)

#### 2. Architecture
*   **Endpoints**: `/api/auth/*`
*   **Entities**: `User`, `Role`
*   **Security**: `bcrypt` (10 rounds), JWT

---

### Feature ID: F-002
**Name**: การจัดการผู้ใช้ (User Management)
**Status**: ✅ Complete
#### 1. User Flow
*   CRUD User
*   กำหนด Role และ Department
*   Soft Delete (isActive)

#### 2. Architecture
*   **Endpoints**: `/api/users/*`
*   **Entities**: `User`

---

### Feature ID: F-003
**Name**: รายงานประจำวัน (Daily Reports)
**Status**: ✅ Complete
#### 1. User Flow
*   บันทึกงานรายวัน (Project, Date, DC, Hours)
*   แนบไฟล์ภาพ (FileAttachment)
*   ติดตามประวัติการแก้ไข (EditHistory)

#### 2. Architecture
*   **Endpoints**: `/api/daily-reports/*`
*   **Entities**: `DailyReport`, `EditHistory`, `FileAttachment`

---

### Feature ID: F-004
**Name**: โครงการ (Project Locations)
**Status**: ✅ Complete
#### 1. User Flow
*   จัดการ Site งานก่อสร้าง
*   ระบุแผนก (Department)

#### 2. Architecture
*   **Endpoints**: `/api/projects/*`
*   **Entities**: `ProjectLocation`

---

### Feature ID: F-005
**Name**: ทักษะงานช่าง (Skills)
**Status**: ✅ Complete
#### 1. User Flow
*   จัดการประเภทงานและค่าแรงมาตรฐาน

#### 2. Architecture
*   **Endpoints**: `/api/skills/*`
*   **Entities**: `Skill`

---

### Feature ID: F-006
**Name**: คนงานรายวัน (Daily Contractors)
**Status**: ✅ Complete
#### 1. User Flow
*   ทะเบียนประวัติ (Address, ID Card)
*   ตั้งรหัสผ่าน (Hashed)
*   ระบุข้อยกเว้นประกันสังคม (Social Security Calculation)
*   **Single Action**: จัดการค่าแรงและรายการหัก (Wage Configuration) รวมในหน้าเดียวกัน (Unified Modal)

#### 2. Architecture
*   **Endpoints**: `/api/daily-contractors/*`
*   **Entities**: `DailyContractor`
*   **ID Format**: `DC-[EmployeeID]` (e.g., `DC-200247`)
*   **New Fields**:
    *   `dailyWageRate` (Manual)
    *   `professionalRate` (Manual)
    *   `phoneAllowance` (Manual)
    *   `otherIncome` (Manual)
    *   `housingFee` (Manual)
    *   `followerCount` (Manual -> Auto Calc Fee x300)
    *   `refrigeratorFee` (Manual)
    *   `soundSystemFee` (Manual)
    *   `tvFee` (Manual)
    *   `laundryFee` (Manual)
    *   `airConFee` (Manual)
    *   `otherDeduction` (Manual)
    *   `nationality` (Def: 'ไทย')
*   **Related Entities**: `SocialSecurityCalculation`

---

### Feature ID: F-007
**Name**: ค่าแรงและรายได้เสริม (Wage & Income)
**Status**: ✅ Complete
#### 1. User Flow
*   จัดการงวดค่าแรง (WagePeriod)
*   บันทึกรายได้พิเศษ (AdditionalIncome)
*   บันทึกรายจ่าย/หัก (AdditionalExpense)
*   การลบงวดค่าแรง (Soft Delete)
*   อ้างอิงโครงการด้วย Code และ Name (Refactor T-360)

#### 2. Architecture
*   **Endpoints**: `/api/wage-periods/*`
*   **Entities**: `WagePeriod` (ใช้ `projectCode` & `projectName`), `AdditionalIncome`, `AdditionalExpense`

---

### Feature ID: F-008
**Name**: ข้อมูลสแกนนิ้วและการเข้างาน (Scan Data & Late Records)
**Status**: ✅ Complete
#### 1. User Flow
*   Import Excel จากเครื่องสแกน (ScanData)
*   ตรวจสอบรายการสาย (LateRecord)
*   จับคู่กับ Daily Report (ScanDataDiscrepancy)

#### 2. Architecture
*   **Endpoints**: `/api/scan-data/*`
*   **Entities**: `ScanData`, `LateRecord`, `ScanDataDiscrepancy`

---
### Feature ID: F-009
**Name**: การจัดการล่วงเวลา (Overtime)
**Status**: ✅ Complete
#### 1. User Flow
*   บันทึก OT ตามช่วงเวลา
*   คำนวณ Multiplier 1.5x

#### 2. Architecture
*   **Endpoints**: `/api/overtime/*`
*   **Entities**: `OvertimeRecord` (รวมอยู่ใน Logic ของ DailyReport หรือแยกตาม Design)

---
### Feature ID: F-010
**Name**: การคำนวณค่าแรงแบบบูรณาการ (Integrated Wage Calculation)
**Status**: 🔄 In Progress (Refining Mapping Logic)
#### 1. User Flow
1. Admin เลือกงวดค่าแรง (Flexible Period) และโครงการที่ต้องการ
2. เมื่อกดปุ่ม "คำนวณ":
   - ระบบดึงข้อมูล Daily Report (วันทำงาน, OT) ในช่วงงวดนั้น
   - **Verification Step**: ระบบทำกระบวนการ "ประกบข้อมูล" (Auto-Matching) ระหว่าง Daily Report Entry กับ Scan Data ผ่านรหัส `employeeId` ที่บันทึกไว้ใน Entry
   - ระบบอัปเดต `verificationStatus` (auto_verified / discrepancy)
   - ระบบระบุความผิดปกติ (Discrepancy) เช่น ชั่วโมงไม่ตรง หรือข้อมูลขาดหาย
   - ระบบตรวจสอบการมาสาย และสร้างรายการหักเงินมาสายอัตโนมัติ
3. ระบบสรุปยอดรายบุคคล **เฉพาะรายการที่ผ่านการตกลง (Verified)** หรือรายการที่ได้รับการยืนยันด้วยมือ (Manual Verified)
4. แสดงผลในตาราง 1 แถวต่อ 1 คน

#### 2. Architecture
*   **Related Entities| **T-360** | Wage Mapping Refinement | Denormalize employeeId & Link Scans | `DailyReport.ts`, `DailyReportService.ts`, `WagePeriodService.ts` |
| **T-370** | Daily Report Excel Import | Build Excel parsing and bulk upload | `dailyReportRoutes.ts`, `DailyReportService.ts`, `ExcelImportModal.tsx` |
*   **Data Integrity**: Denormalized `employeeId` ใน `DailyReportEntry` เพื่อป้องกันรหัสพนักงานเปลี่ยนแปลงภายหลัง

---

### Feature ID: F-011
**Name**: Daily Report UI (Unified)
**Status**: [ ] Planned
#### 1. User Flow
*   Foreman selects Date & Project.
*   Adds work entries (Task, Time, Workers).
*   **Unified Experience**: Same UI for Mobile and Desktop.
*   **Logic**: 1 Doc per Project-Day (Aggregated).
*   **Constraint**: Noon OT locked to 1 hour.
#### 2. Architecture
*   **UI**: `pages/daily-reports/new.tsx` (Wraps `MobileDailyReportView`)
*   **Data**: `DailyReport` (Aggregated Schema)

---

### Feature ID: F-012
**Name**: การจัดการเกณฑ์ประกันสังคม (Social Security Rules Management)
**Status**: ✅ Complete
#### 1. User Flow
*   Admin เข้าเมนู "การจัดการ" (Management Hub) > "การจัดการเกณฑ์ประกันสังคม"
*   เพิ่ม/ลบ/แก้ไข กฎเกณฑ์การหักเงินประกันสังคม (ระบุเงื่อนไขรายได้, % หรือยอดเงินคงที่, ขั้นต่ำ/สูงสุด)
*   ระบบนำกฎเหล่านี้ไปใช้ในการคำนวณงวดค่าแรง (Wage Calculation) แทนแบบ Hardcode เดิม

#### 2. Architecture
*   **Endpoints**: `/api/social-security-rules/*`
*   **Entities**: `SocialSecurityRule`

---

---

### Feature ID: F-013
**Name**: การนำเข้ารายงานประจำวันจาก Excel (Excel Import v2)
**Status**: [ ] Refactoring (v2)
#### 1. User Flow
1. Admin/Foreman พิมพ์รหัสโครงการและรหัสพนักงานในแถวเดียวกัน
2. กรอกชั่วโมงในช่วงเวลาต่างๆ (ปกติ, OT เช้า/เที่ยง/เย็น) ลงใน 9 คอลัมน์มาตรฐาน
3. ระบบ "แยกข้อมูล (Split Entries)" บันทึกลงฐานข้อมูลแยกตามประเภทงานโดยอัตโนมัติ
4. มีปุ่ม Download Template จากระบบเพื่อให้หัวตารางถูกต้อง
#### 2. Architecture
* **Endpoints**: `POST /api/daily-reports/import-excel`, `GET /api/daily-reports/template`
* **Logic**: Split Row into aggregated Multiple Entries inside DailyReport document.
