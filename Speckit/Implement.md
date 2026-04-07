# Master Developer Instruction for AI Agent (Orchestrator)

เอกสารนี้คือ **"Single Source of Truth"** และคู่มือปฏิบัติงานหลักสำหรับ AI Agent และทีมพัฒนา ภายใต้แนวคิด **"Spec-First Development"**
เมื่อได้รับคำสั่ง "เริ่มพัฒนา", "ทำงานต่อ", หรือคำสั่ง "ตรวจสอบปัญหา" ให้ปฏิบัติงานตามขั้นตอนและเรียกใช้ **Skills** ที่เหมาะสมด้านล่างนี้อย่างเคร่งครัด

---

## 🧭 1. Rules of Engagement (กฎไตรภาคี)

### 1.1 The Spec-First Philosophy (เอกสารนำทางโค้ด)
> **"Code is a liability, Documentation is an asset."**
> ห้ามเขียน Code จนกว่าจะมั่นใจว่า `spec.md`, `task.md`, และ `traceability.md` ถูกอัปเดตให้สอดคล้องกับงานใหม่แล้วเท่านั้น

### 1.2 Primary Language (ภาษาหลัก)
- **THAI (ภาษาไทย):** ใช้ภาษาไทยในการสนทนา อธิบายเหตุผล และสรุปงาน **ทุกกรณี**
- **Response Protocol:** โปรดตรวจสอบเสมอว่าคำตอบสุดท้ายเป็นภาษาไทยก่อนส่งเสมอ

### 1.3 Code Documentation
- **Comment Policy:** ทุกการแก้ไข Logic สำคัญ ต้องมี Comment ภาษาไทยอธิบายเสมอ (Inline Comments)

---

## 🧰 2. Skill Mapping (การเรียกใช้ทักษะ)

เพื่อให้การทำงานมีประสิทธิภาพสูงสุด ให้เลือกใช้ **Skill** ตามประเภทของงานที่ได้รับมอบหมาย:

### 🚀 2.1 [Skill: Development Workflow](file:///d:/Labor%20Management%20System/Speckit/skills/dev-workflow.md)
*   **เมื่อไหร่ที่ควรใช้:** เมื่อเริ่มงานใหม่, พัฒนา Feature ใหม่, หรือรับ Requirement เพิ่มเติม
*   **หน้าที่:** ควบคุมลำดับ 8 ขั้นตอน (Context -> Plan -> Exec -> Doc Summary) อย่างเคร่งครัด

### 🕵️ 2.2 [Skill: E2E Troubleshooter & Investigator](file:///d:/Labor%20Management%20System/Speckit/skills/e2e-troubleshooter.md)
*   **เมื่อไหร่ที่ควรใช้:** เมื่อผู้ใช้แจ้ง Error, หน้าจอพัง, ปุ่มกดไม่ได้, หรือ Flow งานขาดตอน
*   **หน้าที่:** วิเคราะห์ Root Cause, หา "จุดเชื่อมต่อที่ขาด", และตรวจสอบ UX Impact Review อย่างเป็นระบบ
*   **📋 Ref:** [Investigation Checklist](file:///d:/Labor%20Management%20System/Speckit/skills/refs/investigation-checklist.md) — ใช้ตรวจสอบ Evidence, Connectivity, Logic, และ Missing Link ตามลำดับ

### 🛡️ 2.3 [Skill: Issue & Incident Management](file:///d:/Labor%20Management%20System/Speckit/skills/issue-management.md)
*   **เมื่อไหร่ที่ควรใช้:** เมื่อพบ Error ระหว่างการพัฒนาที่ต้องบันทึก (Nested Log) หรือเมื่อมี Incident เร่งด่วน
*   **หน้าที่:** บันทึก Traceability ของปัญหา (T-XXX-EX-Y) และสรุปแนวทางการแก้ไข

### 🎨 2.4 [Ref: UX Audit Framework](file:///d:/Labor%20Management%20System/Speckit/skills/refs/ux-audit-framework.md)
*   **เมื่อไหร่ที่ควรใช้:** ก่อนส่งมอบงานทุกครั้ง (Mandatory) และเมื่อมีการออกแบบหรือแก้ไข UI
*   **หน้าที่:** ตรวจสอบ 5 มิติ — System Status, Control & Freedom, Consistency, Error Prevention, และ Interaction Flow เพื่อให้ระบบ "ใช้งานได้" ไม่ใช่แค่ "ทำงานได้"

---

## 🚦 3. Discipline Rules (ระเบียบวินัย)

1.  **ห้ามลัดขั้นตอน:** ขั้นตอนใน `dev-workflow.md` ถือเป็นกฎเหล็ก
2.  **ห้ามเดาสุ่ม:** หากข้อมูลไม่ครบ (เช่น Log ไม่ชัดเจน) ให้ใช้ Skill `e2e-troubleshooter` เพื่อหาทางจำลองเหตุการณ์หรือระบุสมมติฐานที่ชัดเจน
3.  **ความพรีเมียม (Premium UX):** ทุกงานที่ส่งมอบต้องผ่านการตรวจสอบตาม [UX Audit Framework](file:///d:/Labor%20Management%20System/Speckit/skills/refs/ux-audit-framework.md) เสมอ
4.  **สรุปเอกสารเสมอ:** ทุกครั้งที่จบงาน ต้องมีหัวข้อ **Documentation Summary** เพื่อยืนยันว่าเอกสารหลัก (4 ฉบับ) ถูกอัปเดตครบถ้วน
5.  **[NEW] บันทึก Logic Flow บังคับ (Logic Documentation Rule):**
    > **"ถ้าไม่มี Logic อยู่ใน Implement.md ถือว่างาน INCOMPLETE"**
    - ทุก Feature ใหม่หรือการแก้ไข Logic สำคัญ **ต้องบันทึก E2E Flow** ลงใน **Section 7+** ของ `Implement.md` เสมอ
    - รูปแบบที่ต้องบันทึก:
        - **Path ของ User Action**: หน้าจอไหน → ปุ่มไหน → ฟังก์ชันไหน
        - **API Contract**: Endpoint, Method, Payload, Response structure
        - **Backend Logic**: Service/Controller ที่รับผิดชอบ + ขั้นตอนสำคัญ (Validation, Lock Check, DB Write)
        - **Database Schema**: Collection ที่เกี่ยวข้อง + Fields ที่เขียนจริง
        - **Known Issues**: ข้อสังเกตหรือจุดที่ต้องระวังในอนาคต
    - **Format บังคับ:** ใช้ตาราง Markdown + Code Block สำหรับ Flow Diagram
    - **ต้องอัปเดต** เมื่อมีการแก้ไข Logic ที่เกี่ยวข้อง (Living Document)
    - **Naming Convention:** `### 🛣️ [FeatureName] — E2E Flow` หรือ `### 📥 Path [X]: [ชื่อ Path]`

---

## 📚 4. Reference Library

### 📄 Core Documents (เอกสารหลัก)
- [x] [Instruction](file:///d:/Labor%20Management%20System/Speckit/instruction.md) : มาตรฐานเทคนิค
- [x] [Spec](file:///d:/Labor%20Management%20System/Speckit/spec.md) : ฟังก์ชันงาน
- [x] [Task](file:///d:/Labor%20Management%20System/Speckit/task.md) : ความคืบหน้า
- [x] [Traceability](file:///d:/Labor%20Management%20System/Speckit/traceability.md) : ความสัมพันธ์ข้อมูล
**Data Usage**: Entity.field

### 🔖 Skill References (เอกสารอ้างอิง Skill)
- [x] [Investigation Checklist](file:///d:/Labor%20Management%20System/Speckit/skills/refs/investigation-checklist.md) : Checklist สำหรับ E2E Troubleshooter (Evidence / Connectivity / Logic / Missing Link)
- [x] [UX Audit Framework](file:///d:/Labor%20Management%20System/Speckit/skills/refs/ux-audit-framework.md) : กรอบตรวจสอบ UX ก่อนส่งมอบงาน (5 มิติ)

### Step 2.5: Implementation (ลงมือทำ) **[EXECUTION MODE]**
- **GATEKEEPER CHECK**:
  - [ ] implementation_plan.md Approved?
  - [ ] task.md Updated?
  - [ ] traceability.md Updated?
  - [ ] spec.md Updated?
  - [ ] **[NEW] Implement.md Section 7+ Updated?** (บันทึก E2E Flow ของ Feature นี้แล้วหรือยัง?)
  - หากยังไม่ครบ **5 ข้อนี้** ห้ามเริ่มเขียน Code เด็ดขาด!
- เขียน Code ตามแผนที่วางไว้ใน Step 2.3
- ทำทีละ Sub-task เพื่อลดความซับซ้อน

### Step 2.6: Verification (ตรวจสอบ) **[VERIFICATION MODE]**
- รัน Validate Command: npm run lint หรือ Build Check
- **Verification Plan**: ตรวจสอบตาม "Confirmed Behavior" ที่ระบุใน Task

### Step 2.7: Closure & Handoff (จบงาน)
- [x] Mark Task as Completed ใน task.md
- ลบ Temporary Logs หรือ Comments ที่ไม่จำเป็นตอน Production

### Step 2.8: Documentation Summary (สรุปการอัปเดตเอกสาร) **[MANDATORY FINAL CHECK]**
> **[CRITICAL GATEKEEPER]** : หากคุณไม่สรุปหัวข้อนี้ใน Final Response ถือว่างาน **"FAILED"** และผู้ใช้จะตีกลับงานทันที

ในขั้นตอนสุดท้ายของการตอบโต้ (Final Response) หรือเมื่อจะแจ้ง notify_user เพื่อจบงาน **คุณต้อง** สรุปการเปลี่ยนแปลงของเอกสาร **5 ฉบับหลัก** เสมอ:

1. Speckit/instruction.md
2. Speckit/spec.md
3. Speckit/task.md
4. Speckit/traceability.md
5. **[NEW] Speckit/Implement.md** (ต้องระบุว่าอัปเดต E2E Flow Section หรือไม่ พร้อมเหตุผล)

**Format การสรุป (Copy template นี้ไปใช้):**
markdown
### Documentation Summary
1. **instruction.md**: [Updated / No Change] - (ระบุรายละเอียดการแก้ หรือเหตุผลที่ไม่ได้แก้)
2. **spec.md**: [Updated / No Change] - (ระบุรายละเอียดการแก้ หรือเหตุผลที่ไม่ได้แก้)
3. **task.md**: [Updated / No Change] - (ระบุรายละเอียดการแก้ หรือเหตุผลที่ไม่ได้แก้)
4. **traceability.md**: [Updated / No Change] - (ระบุรายละเอียดการแก้ หรือเหตุผลที่ไม่ได้แก้)
5. **Implement.md**: [Updated / No Change] - (ระบุ Section ที่อัปเดต E2E Flow หรือเหตุผลที่ไม่ต้องอัปเดต)
*เหตุผลที่ต้องระบุ "No Change"*: เพื่อยืนยันว่าคุณได้ "คิด" และ "ตรวจสอบ" แล้วจริงๆ ไม่ใช่แค่ลืม

---

## 3. Error Handling & Logging (การบันทึกปัญหา)

หากพบ Error ระหว่างทำงาน ให้บันทึกแบบ **Nested Log** ภายใต้ Task นั้นๆ ใน task.md เสมอ:

### Format: T-XXX-EX-Y
- **`T-XXX` (Task ID)**: รหัสงานหลักที่ปัญหานั้นเกิดขึ้น
- **`EX` (Error Index)**: ลำดับของ "ปัญหา" (Problem) ที่พบ (รันเลข E1, E2, ... ตามลำดับการเจอ)
  - *Note*: หากเป็นปัญหาเรื่องเดิม อาการเดิม หรือ Root Cause เดิม ให้ใช้เลข **E เดิม** เสมอ
- **`Y` (Attempt Count)**: จำนวนครั้งที่พยายามแก้ไข (เริ่มที่ 1)
  - หากแก้ครั้งแรกไม่หาย แล้วต้องแก้ซ้ำ ให้เพิ่มเลขนี้เป็น 2, 3, ... (เช่น E1-2, E1-3)
  - ห้ามเปลี่ยนเลข E ถ้ายังเป็นปัญหาเดิม

**Critical Rule: Bug vs. New Task (The "No New Task" Policy)**
- **ห้ามสร้าง Task ใหม่** ([T-New]) สำหรับการแก้ไขปัญหา (Bug/Fix) ในทุกกรณี ยกเว้นมันคือ Feature ใหม่ 100%
- หากปัญหานั้นเกิดจาก:
  1.  **Immediate Regression**: บั๊กที่เกิดทันทีหลัง Deploy หรือหลังแก้โค้ดจาก Task ล่าสุด
  2.  **Implementation Defect**: การตกหล่นของฟีเจอร์ที่กำลังทำอยู่ (ทำไม่ครบ, ทำแล้วพัง)
  3.  **Config/Env Issue**: ปัญหา Environment ที่ต้องแก้เพื่อให้ Task เดิมผ่าน (เช่น CORS, API Key)
  4.  **Logic Error**: สูตรคำนวณผิด, แสดงผลผิด
- **Action**: ให้บันทึกเป็น **Error Log (Nested List)** ใต้ Task เดิมที่เป็นเจ้าของ Feature นั้นๆ ทันที
  - *เหตุผล*: เพื่อให้เห็น History การแก้ปัญหาอยู่ในจุดเดียว (Traceability) และไม่ทำให้ Task List รกด้วยเศษงานแก้บั๊ก
- **สร้าง Task ใหม่ได้เมื่อ (Exceptions)**:
  - เป็น **Feature Request** ใหม่จาก User ที่ไม่เคยมีใน Spec มาก่อน
  - ต้องการ **Refactor** ใหญ่ที่แยก Module ออกมาอย่างชัดเจน
  - เป็นงาน **Optimization** ที่ไม่ได้เกิดจาก Error แต่ต้องการ Performance ที่ดีขึ้นมาก

### Example Log:
markdown
- [ ] [T-XXX] Implement Feature A
    - **Error Logs**:
      - **[T-XXX-E1-1]**: Import Error
        1. **Root Cause**: วงวนการ Import (Circular Dependency)
        2. **Action**: แยก Type ออกไฟล์กลาง
        3. **Status**: Fixed

---

## 4. Incident Resolution Template (Production Issues)
*(สำหรับปัญหาเร่งด่วน หรือ Critical Bug)*

### A. Symptom (อาการ)
*   **What**: เกิดอะไรขึ้น Error คืออะไร
*   **Where**: Environment ไหน (Dev/Prod)

### B. Analysis (วิเคราะห์)
*   **Root Cause**: สาเหตุทางเทคนิค
*   **Impact**: ผลกระทบ

### C. Solution (การแก้ไข)
*   **Fix Steps**: วิธีแก้ตามลำดับ
*   **Verification**: วิธีตรวจสอบว่าหายจริง

---

## 5. Data Dictionary & System Mapping (โครงสร้างข้อมูลและหน้าจอ)

ข้อมูลที่แสดงอยู่นี้คือโครงสร้างหลักของ Collections ใน Firebase และความเชื่อมโยงกับหน้าจอใช้งาน (Frontend) เพื่อความเข้าใจที่ตรงกันในการพัฒนา

### 🗃️ 5.1 ProjectLocations (ข้อมูลโครงการ/หน่วยงาน)
**Page**: `/project-management` (Project Management)
- **Document ID**: Auto-generated (Firestore)
- **Fields**:
    - `projectCode` (string, **PK**): รหัสโครงการ (เช่น "HO", "P001")
    - `projectName` (string): ชื่อโครงการ
    - `department` (string): ฝ่าย/ส่วนงาน (เช่น "PD01")
    - `status` (string): สถานะ (`active`, `completed`, `suspended`)
    - `isActive` (boolean): สถานะเปิด/ปิดการใช้งาน

### 🗃️ 5.2 DailyContractors (ข้อมูลพนักงานรายวัน)
**Page**: `/dc-management` (Employee Management)
- **Document ID**: Auto-generated (Firestore)
- **Fields**:
    - `employeeId` (string, **PK**): รหัสพนักงาน (ใช้แมตช์ข้อมูลสแกนนิ้ว)
    - `name` (string): ชื่อ-นามสกุล
    - `skillId` (string): รหัสทักษะ (Skill ID)
    - `projectLocationIds` (array of strings): **[CRITICAL]** รายการ ID โครงการที่พนักงานสังกัดอยู่ (One-to-Many)
    - `dailyWageRate` (number): อัตราค่าแรงรายวัน
    - `professionalRate` (number): ค่าวิชาชีพ (ต่อชั่วโมงปกติ)
    - `phoneAllowance` (number): ค่าโทรศัพท์
    - `nationality` (string): สัญชาติ (ไทย/MOU)
    - `isActive` (boolean): สถานะการทำงาน

> [!NOTE]
> **Architectural Note (Financial Fields):**
> เราเก็บค่ารายได้และรายหักพื้นฐานเป็น **Flat Fields** เพื่อประสิทธิภาพในการดึงข้อมูล Defaults ของพนักงาน (Read Performance) โดยระบบจะนำค่าเหล่านี้ไปสร้างเป็นรายการธุรกรรมจริง (Line Items) ใน Sub-collection ของ `WagePeriods` เมื่อมีการคำนวณค่าแรงครับ

### 🗃️ 5.3 DailyReports (รายงานการทำงานรายวัน - Aggregated)
**Page**: `/daily-reports` (Daily Report)
- **Document ID**: `REP_[projectLocationId]_[YYYY-MM-DD]`
- **Fields**:
    - `projectLocationId` (string): เชื่อมโยงกับ ProjectLocation
    - `date` (Date): วันที่ทำงาน
    - `entries` (array): รายการงานย่อย (Work Entries)
        - `id` (UUID): ID ของรายการ
        - `employeeId` (string): รหัสพนักงาน
        - `taskName` (string): ชื่องาน
        - `workType` (string): ประเภทงาน (`regular`, `ot_morning`, `ot_noon`, `ot_evening`)
        - `startTime`/`endTime` (Date): เวลาเริ่ม-จบ
        - `netHours` (number): ชั่วโมงสุทธิ
    - `importFileUrls` (array): **[T-371-5]** ลิงก์ไฟล์ Excel ต้นฉบับที่มาจากการนำเข้า

### 🗃️ 5.4 ScanData (ข้อมูลสแกนนิ้วมือ)
**Page**: `/scan-data` (Scan Data)
- **Document ID**: `SCAN_[employeeId]_[YYYY-MM-DD]`
- **Fields**:
    - `employeeId` (string): รหัสพนักงาน
    - `workDate` (string): วันที่ทำงาน (รูปแบบ YYYY-MM-DD)
    - `punches` (array): รายการเวลาสแกน (เช่น `["08:00", "17:05"]`)
    - `firstIn`/`lastOut` (string): เวลาสแกนเข้าครั้งแรกและออกครั้งสุดท้าย

### 🗃️ 5.5 WagePeriods (งวดการจ่ายค่าแรง)
**Page**: `/wage-calculation` (Wage Calculation)
- **Document ID**: Auto-generated (Firestore)
- **Fields**:
    - `periodCode` (string): รหัสงวด (เช่น "202604-P1")
    - `projectCode` (string): รหัสโครงการ
    - `startDate`/`endDate` (Date): ช่วงวันที่ของงวด (15 วัน)
    - `status` (string): สถานะงวด (`draft`, `calculated`, `approved`, `paid`, `locked`)
    - `dcSummaries` (array): สรุปการจ่ายเงินรายคน (Wage Summary per DC)

---

## 7. Daily Report — E2E Flow Analysis 🕵️
> **Skill ที่ใช้:** E2E Troubleshooter & Investigator | **Investigation Checklist** ✅
> **วันที่วิเคราะห์:** 07/04/2026 | **สถานะ:** Living Document (อัปเดตตามโค้ดจริง)

ระบบ Daily Report มี **2 เส้นทางหลัก** ในการสร้างข้อมูล: (1) กรอก Manual ผ่าน Form และ (2) นำเข้า Excel แบบ Bulk

---

### 🛣️ Path A: Manual Entry (กรอกฟอร์มทีละรายการ)

#### Phase 1: User Action (หน้าจอ)
| ขั้น | ไฟล์ | รายละเอียด |
|---|---|---|
| A1 | `pages/daily-reports/index.tsx` | User กดปุ่ม **"เพิ่มการ์ดงาน"** → `router.push('/daily-reports/new')` |
| A2 | `pages/daily-reports/new.tsx` | Render `DailyReportForm` ใน Create Mode |
| A3 | `components/DailyReportForm.tsx` | User กรอก: โครงการ, วันที่, แรงงาน (multi-select), งาน, เวลาเริ่ม-จบ |

#### Phase 2: Auto-Calculation (Logic ใน Form)
| Logic | กลไก |
|---|---|
| **คำนวณชั่วโมง** | `useEffect` watch `startTime` + `endTime` → เรียก `calculateHours()` + `calculateNetHours()` → set `netHours` อัตโนมัติ |
| **คำนวณค่าแรง** | `useEffect` watch `selectedDCs` + `calculatedHours` → `Σ(hourlyRate × hours + professionalRate)` → set `totalWage` (disabled field) |
| **Validation** | `zodResolver(dailyReportSchema)` — ป้องกันก่อน submit |

#### Phase 3: Frontend → API
```
DailyReportForm.onSubmit(data)
  → dailyReportService.create(data)         [frontend/src/services/dailyReportService.ts]
  → loop dcIds → addWorkEntry({ projectId, date, entry })
  → apiClient.post('/daily-reports/entry', payload)
```

#### Phase 4: Backend Processing
```
POST /api/daily-reports/entry
  → authenticate + authorize(['SE','OE','PE','PM','PD','AM'])
  → dailyReportController.addWorkEntry()    [backend/src/controllers/dailyReportController.ts]
  → dailyReportService.addWorkEntry()       [backend/src/services/dailyReport/DailyReportService.ts]
```

#### Phase 5: Service Logic (Backend)
| ขั้น | Logic |
|---|---|
| **Lock Check** | ตรวจสอบ `wagePeriodService.isDateLocked(workDate, projectCode)` → ถ้า locked จะ throw 403 |
| **Multi-DC** | ถ้ามี DC มากกว่า 1 คน จะ loop สร้าง Document แยกทุกคน |
| **DC Lookup** | `dailyContractorService.getById(dcId)` → ดึง `employeeId` มา denormalize ลง Document |
| **Image Upload** | ถ้ามี `imageUrls` ที่เป็น `data:` → upload ไป Cloudflare R2 |
| **Firestore Write** | `db.collection('daily_reports').doc().set(reportData)` |
| **Audit Trail** | `createEditHistory({ entityId, action: 'create', editedBy })` → เขียนลง `edit_history` collection |

#### Phase 6: Firestore Schema (ที่เขียนจริง)
```json
{
  "projectLocationId": "string",
  "workDate": "Timestamp",
  "dailyContractorId": "string",        // singular (per document)
  "employeeId": "string",               // [T-400] denormalized
  "taskName": "string",
  "workType": "regular|ot_morning|ot_noon|ot_evening",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "netHours": "number",
  "totalWage": "number",
  "isOvernight": "boolean",
  "verificationStatus": "unverified",   // [T-401]
  "status": "submitted",
  "imageUrls": ["string"],
  "version": 1,
  "createdBy": "uid",
  "createdAt": "ServerTimestamp",
  "updatedAt": "ServerTimestamp"
}
```

---

### 📥 Path B: Excel Import (นำเข้าข้อมูลแบบ Bulk)

#### Phase 1: User Action
| ขั้น | ไฟล์ | รายละเอียด |
|---|---|---|
| B1 | `pages/daily-reports/index.tsx` | User กดปุ่ม **"นำเข้า Excel"** → `setIsImportModalOpen(true)` |
| B2 | `components/DailyReportUploadDialog.tsx` | Dialog เปิด — รองรับไฟล์ `.dat`, `.xlsx`, `.xls` |
| B3 | Dialog | User เลือกไฟล์ + (ไม่บังคับ) ใส่หมายเหตุ → กด **Upload** |

#### Phase 2: 2-Phase Upload Flow
```
Step 1 — Upload & Parse (Preview):
  dailyReportService.uploadDailyReportFile(file, projectId, note)
    → apiClient.post('/daily-reports/import-excel', FormData)
    → Controller: importExcel()
      → dailyReportService.parseDailyReportExcel(buffer)    [parse Excel rows]
      → storage.uploadBuffer(buffer, 'daily-reports/imports')  [T-371-5 Audit Trail]
    → Response: { success, data: parsedRows[], importFileUrl }

Step 2 — Commit (Bulk Create):
  filter validData (isValid === true)
    → apiClient.post('/daily-reports/bulk-create', { data: validData, importFileUrl })
    → Controller: bulkCreate()
      → dailyReportService.bulkCreateDailyReports(data, userId)
        → loop: createDailyReport() ต่อแต่ละ row
```

#### Phase 3: Excel Parsing Logic (Backend)
| ขั้น | Logic |
|---|---|
| **อ่าน Excel** | `XLSX.read(buffer)` → `sheet_to_json()` → loop แต่ละแถว |
| **parseExcelRow** | Map column headers → internal fields (Date, EmployeeId, Hours, WorkType) |
| **Lookup Project** | `db.collection('Project').where('code', '==', parsed.projectCode)` |
| **Lookup DC** | `db.collection('daily_contractors').where('employeeId', '==', parsed.employeeId)` |
| **คำนวณชั่วโมง** | ถ้า `hours` มีค่า → ใช้ตรง / ไม่มี → คำนวณจาก startTime-endTime หัก break 1ชม (regular) |
| **isValid Flag** | `!!project && !!dc` — ใช้กรองก่อน Bulk Create |

#### Phase 4: Audit Trail (T-371-5)
- ไฟล์ Excel ต้นฉบับ → upload ไปยัง **Cloudflare R2** ที่ path `daily-reports/imports/`
- URL ที่ได้ (`importFileUrl`) ถูกส่งพ่วงไปกับ `bulk-create` request
- บันทึกไว้ใน field `importFileUrls[]` ของ DailyReport Document (ตาม Data Dict 5.3)

---

### 📊 Path C: Read / Display (การดึงข้อมูลแสดงผล)

```
index.tsx → useQuery(['work-records', filters])
  → Promise.all([
      dailyReportService.getAll({ projectId, date, dcId }),
      overtimeService.getAll({ projectId, date, dcId, otPeriod })
    ])
  → Merge + Sort by date DESC → แสดงใน DataGrid
```

**getAll() Adapter Logic:**
- ถ้ามี `projectId + date` → `getByProjectAndDate()` (1 วัน)
- ถ้ามี `projectId` เท่านั้น → `getByProjectAndMonth()` (เดือนปัจจุบัน)
- ถ้าไม่มี filter → **return `[]` (ไม่ query ทั้ง collection)**
- Flatten entries array → composite ID = `projectId|date|workerId|entryId`

---

### ⚠️ Known Issues / Observations (จากการวิเคราะห์)

| # | สิ่งที่พบ | ระดับ | หมายเหตุ |
|---|---|---|---|
| 1 | `getAll()` ใน `dailyReportService` คืนค่า `[]` ถ้าไม่มี `projectId` — หน้าจอแสดงผลว่างเปล่าโดยไม่มี Empty State | Medium | UX Impact: User อาจคิดว่าไม่มีข้อมูล |
| 2 | `update()` Adapter ทำแบบ Delete-then-Create (Hack) — History Tracking จะขาดตอน | Medium | ควร Refactor เป็น true Update |
| 3 | `getHistory()` คืนค่า `[]` เสมอ — History Page ยังไม่ทำงานในสถาปัตยกรรมใหม่ | Low | Feature ยัง incomplete |
| 4 | `bulkCreateDailyReports()` บันทึก `totalWage: 0` เสมอ — ต้องรอ WagePeriodService คำนวณทีหลัง | Info | By Design แต่ควร document ชัด |
| 5 | `getAllDailyReports()` ใน backend orderBy `reportDate` แต่ field จริงในข้อมูลคือ `workDate` | ⚠️ High | อาจทำให้ Query Error หรือ Sort ผิด |
| 6 | **[FIXED 07/04/2026]** `uploadDailyReportFile()` ส่ง raw parsed rows ไป bulk-create โดยไม่ Expand → `item.hours = 0` เสมอ → ไม่มีข้อมูลถูกบันทึก | 🔴 Critical | แก้แล้วใน `dailyReportService.ts` (frontend) — เพิ่ม `expandRowsToItems()` ที่ Expand 1 row → หลาย items แยกตาม WorkType |
| 7 | **[FIXED 07/04/2026]** `bulkCreateDailyReports()` เกิด Error "Read after Write" ใน Firestore Transaction ทำให้ล่มและข้อมูลบันทึกเป็น 0 แบบเงียบๆ | 🔴 Critical | แก้แล้วใน `DailyReportService.ts` (backend) — แยกวงจร t.get() ทั้งหมดให้ทำงานล่วงหน้า (Pre-fetch) ก่อนที่จะมี t.set() แรกเกิดขึ้น |

---

## 6. Documentation Summary (ประวัติการอัปเดต)
*(ย้ายมาไว้เป็นส่วนหนึ่งของไฟล์เพื่อให้ติดตามได้ง่ายขึ้น)*
| วันที่ | Task ID | ผู้แก้ไข | รายละเอียด |
| :--- | :--- | :--- | :--- |
| 02/04/2026 | T-371 | Antigravity | เพิ่ม Data ট্র Dictionary และ Mapping หน้าจอ (Section 5) |
| 07/04/2026 | - | Antigravity | เพิ่ม Skill Refs (Section 2) และ E2E Flow Analysis Daily Report (Section 7) |
| 07/04/2026 | BUG-FIX | Antigravity | แก้ Excel Import ไม่บันทึกข้อมูล (Known Issue #6) — เพิ่ม expandRowsToItems() ใน frontend |
| 07/04/2026 | BUG-FIX | Antigravity | แก้ Transaction ล่มแบบเงียบใน Add/BulkCreate DailyReport (Known Issue #7) |