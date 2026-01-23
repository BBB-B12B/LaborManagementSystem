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

#### 2. Architecture
*   **Endpoints**: `/api/wage-periods/*`
*   **Entities**: `WagePeriod`, `AdditionalIncome`, `AdditionalExpense`, `DCIncomeDetails`, `DCExpenseDetails`

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
**Status**: ✅ Complete
#### 1. User Flow
1. Admin เลือกงวดค่าแรง (15 วัน) และโครงการที่ต้องการ
2. เมื่อกดปุ่ม "คำนวณ":
   - ระบบดึงข้อมูล Daily Report (วันทำงาน, OT) ในช่วงงวดนั้น
   - ระบบดึงข้อมูลสแกนนิ้ว (Scan Data) มาเปรียบเทียบ (Requirement 2)
   - ระบบระบุความผิดปกติ (Discrepancy) เช่น ชั่วโมงไม่ตรง หรือข้อมูลขาดหาย
   - ระบบตรวจสอบการมาสาย และสร้างรายการหักเงินมาสายอัตโนมัติ ( Requirement 2)
3. ระบบสรุปยอดรายบุคคล (รายได้ + รายได้พิเศษ - รายจ่าย - รายจ่ายพิเศษ - หักประกันสังคม - หักมาสาย)
4. แสดงผลในตาราง 1 แถวต่อ 1 คน (Requirement 3)

#### 2. Architecture
*   **Endpoints**: `/api/wage-periods/:id/calculate`
*   **Related Entities**: `WagePeriod`, `DailyReport`, `ScanData`, `LateRecord`, `ScanDataDiscrepancy`
*   **Logic**: `WagePeriodService.calculateWages` + `ScanDataService.detectDiscrepancies`

---

## 4. Task Traceability
| Task ID | Name | Goal | key Components |
| :--- | :--- | :--- | :--- |
| **T-230** | DC Migration & Update | Migrate IDs & Add Wage Schema | `DailyContractor.ts`, `DailyContractorService.ts`, `migrateDCIds.ts`, `index.tsx` |
