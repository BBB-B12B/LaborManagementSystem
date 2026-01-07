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
*   **Entities**: `DailyContractor`, `SocialSecurityCalculation`

---

### Feature ID: F-007
**Name**: ค่าแรงและรายได้เสริม (Wage & Income)
**Status**: ⚠️ Implementation Pending
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
**Status**: 📋 Next Phase
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
