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
*   **Related Entities**: `DailyReport`, `ScanData`, `WagePeriod`
*   **Data Integrity**: Denormalized `employeeId` ใน `DailyReportEntry` เพื่อป้องกันรหัสพนักงานเปลี่ยนแปลงภายหลัง

---

### Feature ID: F-011
**Name**: Daily Report UI (Unified)
**Status**: ✅ Complete
#### 1. User Flow
*   Foreman selects Date & Project.
*   Adds work entries (Task, Time, Workers).
*   **Caching Strategy**: ข้อมูลจะถูก Cache ไว้ในฝั่ง Client และมีอายุจนถึงเที่ยงคืนของวันนั้น (Midnight Reset) เพื่อลดภาระของ Backend
*   **Global Sync**: ผู้ใช้สามารถกดปุ่ม Sync เพื่อล้าง Cache และดึงข้อมูลล่าสุดได้ทุกเมื่อ

#### 2. Architecture
*   **UI**: `pages/daily-reports/index.tsx`
*   **State Management**: React Query (Server State) + Zustand (Client Cache Store)
*   **Performance**: ใช้ `staleTime` แบบไดนามิกตามเวลาที่เหลือจนถึงเที่ยงคืน

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

---

### Feature ID: F-014
**Name**: การเชื่อมต่อระบบหลังการขาย (Sales System Firebase Integration for Task & Daily Report)
**Status**: 🔄 In Progress
#### 1. User Flow
1. ผู้ใช้เข้าหน้า Workspace เพื่อดูงานจากระบบหลังการขาย (Read)
2. ผู้ใช้สร้าง Task ใหม่ ข้อมูลวิ่งไปเก็บที่ Firebase หลังการขาย (Write)
3. ผู้ใช้ทำรายงาน Daily Report ภายใต้ Task ข้อมูลถูกเขียนลง Firebase เป็น Sub-collection ของ Task (Write)
#### 2. Architecture
* **Firebase Path**: `workOrders/{workOrderId}/categories/{categoryId}/tasks/{taskId}/dailyreport`
* **ID Generation Logic**:
    * **WorkOrder**: `[Project]-[Year]-[RunNo]-[WO_Code]` (e.g., `WH-2026-0001-STR`)
    * **Category**: `CAT-xxxx` (Auto-increment globally)
    * **Task**: `TASK-xxxxxxx` (Auto-increment per Project + WorkOrder)
* **Progress Tracking**: แสดงผล `dailyProgress` (0-100%) บน Task Card เพื่อให้หัวหน้างานติดตามความคืบหน้าได้ทันที
* **Logic**: Two-way Integration (Read/Write)

---

### Feature ID: F-016
**Name**: ระบบทบทวนและตีกลับงาน (Task Revision & Reject Workflow)
**Status**: 🔄 In Progress
#### 1. User Flow
1. ระบบสร้าง Revision เริ่มต้น (`rev00`) อัตโนมัติเมื่อสร้าง Task
2. FM ทำงานและส่ง Daily Report (ข้อมูลเก็บเข้า `rev00`)
3. เมื่อ Progress = 100% หัวหน้างานเข้าตรวจสอบ
4. หากไม่ผ่าน หัวหน้ากดปุ่ม "Reject" ใส่ชื่องานที่ให้แก้ไข (Revision Name) และเลือก FM ผู้รับผิดชอบ (Assignees)
5. ระบบสร้าง Revision ใหม่ (`rev01`) รีเซ็ตความคืบหน้ากลับเป็น 0% งานจะกลับไปอยู่ในสถานะ `rework`
6. FM ทำงานแก้ไขและส่ง Daily Report (ข้อมูลจะเก็บเข้า `rev01` แทน)
#### 2. Architecture
* **Endpoints**: `POST /api/tasks/:id/reject`
* **Logic**:
  * Task (Container): เก็บ `taskId` เดิมตลอดกาล พร้อม `currentRevision` ชี้เป้าไปเวอร์ชั่นล่าสุด
  * Visibility: Task จะเก็บ `assignees` สะสม (Cumulative) ของทุกคนที่เคยรับงานนี้ในทุก Rev ไว้ใน `assignees` หลัก เพื่อให้สามารถ Query ค้นหางานบน Workspace ได้
  * Revision Subcollection: บันทึกข้อมูลแยกใน `revisions/{revId}` (`revisionName`, `assignees` สำหรับรอบนั้น)
  * Daily Reports Subcollection: บันทึกภายใต้ `revisions/{revId}/dailyReports/`

---

### Feature ID: F-017
**Name**: ระบบบันทึกการลา (Leave Tracking in Daily Report)
**Status**: ✅ Complete
#### 1. User Flow
1. FM เพิ่มข้อมูลแรงงานที่ "ลา" เข้าไปในแบบฟอร์ม Daily Report
2. FM ระบุช่วงเวลาที่ลา (เช่น ครึ่งเช้า, ครึ่งบ่าย)
3. หากลาป่วย FM สามารถอัปโหลดรูปภาพใบรับรองแพทย์ได้
4. ระบบประมวลผลข้อมูล หากมีใบรับรองแพทย์จะเปลี่ยนสถานะเป็น "ลารับค่าจ้าง" (Paid) อัตโนมัติ หากไม่มีจะเป็น "ลาไม่รับค่าจ้าง" (Unpaid)
5. หากคนงานทำครึ่งวันและลาครึ่งวัน ข้อมูลจะถูกแยกบันทึกลงทั้ง `labor` และ `leave`
#### 2. Architecture
* **Payload Structure**: แยกฟิลด์ `labor` (ข้อมูลทำงาน) และ `leave` (ข้อมูลการลา) ออกจากกันในระดับเดียวกัน
* **Triggers**: Medical Certificate upload triggers the `leaveType` logic.
* **Audit Trail**: ข้อมูลใน `leave` ถูกแบ็คอัพไว้ใน `editHistory` ทุกครั้งที่มีการอัปเดต เช่นเดียวกับ `labor`
