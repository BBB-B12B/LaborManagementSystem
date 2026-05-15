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

---

## 7. E2E Flow Documentation (Logic Flow)

### 🛣️ [F-014] Sales System Sync — E2E Flow & Schema Structure

| มิติการทำงาน | รายละเอียด (Labor System -> Sales System) |
| :--- | :--- |
| **User Action Path** | `Workspace Kanban` -> `Add New Task` -> เลือก Project/Category -> `Submit` |
| **API/SDK Contract** | ยิงตรงสู่ Firebase Collection: <br> `workOrders/{workOrderId}/categories/{catId}/tasks/{taskId}` |
| **Database Schema** | **โครงสร้างแบบลำดับขั้น (Hierarchy):** <br> 1. `workOrders` (Collection) -> Document: `VH-2026-0001-STR` <br> 2. `categories` (Subcol) -> Document: `CAT-0001` (Fields: `catId`, `catName`) <br> 3. `tasks` (Subcol) -> Document: `TASK-0000001` <br> 4. `dailyreport` (Subcol) -> Document: `day-0000001` |
| **Data Fields (Task)** | ข้อมูลที่จะบันทึกและแก้ไขผ่าน UI: <br> - `taskId`: "TASK-0000001" (Auto-gen) <br> - `taskName`: "งานผูกเหล็ก" (User กรอก) <br> - `assignees`: `[{ employeeId, name, roleId }]` (User เลือก) <br> - `dailyProgress`: 0 (Default) <br> - **`description`**: "หมายเหตุ" (User กรอกผ่าน TextArea ลำดับสุดท้าย) <br> - `dueDate`, `status`, `createdAt` (System/User) |
| **Backend/Client Logic** | 1. อ่านข้อมูล (Read): `getDocs()` จาก Sales Firebase ตาม Hierarchy <br> 2. เขียนข้อมูล (Write): `setDoc()` หรือ `addDoc()` เข้า Sales Firebase พร้อมรหัส `CAT-xxxx` และ `TASK-xxxxxxx` |

### 🛣️ [F-014] Hierarchical Task Creation — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Workspace Kanban` -> `Add New Task` -> เลือก Location (Project) -> เลือก Work Order -> พิมพ์ Category -> พิมพ์ Task Name -> `Submit` |
| **API Contract** | `POST /api/tasks` <br> **Payload**: `{ taskName, projectId, workOrderCode, categoryName, assignees, dueDate }` |
| **Backend Logic (T-840)** | **TaskService.createTask (Counter + Upsert Logic)**: <br> ดำเนินการผ่าน `db.runTransaction()` เพื่อความปลอดภัย: <br> 1. **WorkOrder**: Query `projectId` + `woCode` ถ้าไม่พบ สร้าง ID `${projectId}-${workOrderCode}` <br> 2. **Category**: Query ชื่อ `catName` ในหมวดนี้ ถ้าไม่พบ ให้อ่านและอัปเดต Counter เพื่อสร้าง `CAT-XXXX` <br> 3. **Task**: Query ชื่อ `taskName` ในหมวดนี้ ถ้าไม่พบ ให้อ่านและอัปเดต Counter เพื่อสร้าง `TASK-XXXXXXX` <br> 4. ใช้คำสั่ง `transaction.set({ merge: true })` กับทุกระดับชั้นเพื่ออัปเดตข้อมูลและหลีกเลี่ยงการสร้างซ้ำซ้อน |
| **Database Structure** | `workOrders/{woId}/categories/{catId}/tasks/{taskId}` <br> (Note: ข้อมูลที่ใช้ชื่อเดียวกันจะเข้าไปแก้ไข Document เดิม และหากสร้างใหม่จะรันเลข Running Number ได้อย่างถูกต้อง) |
| **Global Uniqueness** | **Composite ID Strategy**: เพื่อป้องกัน Key ชนกันใน UI และการอัปเดตผิดใบใน Backend -> ให้ใช้รหัส `workOrderId` + `categoryId` + `taskId` เชื่อมกันด้วย `__` เป็นรหัส `id` หลักสำหรับ API และ React Key |
| **UI/UX Audit (T-807)** | **Consistency Check**: All input fields (Autocomplete & TextField) ต้องใช้ชุด Style เดียวกันผ่าน `sx` ที่ตัว Root ของ `TextField` โดยเจาะจงไปที่คลาส `.MuiFilledInput-root` เพื่อป้องกันการถูก Override จากสี Default ของ Browser หรือ MUI Theme |

### 🛣️ [T-810 & T-812] Workspace Dashboard (Fetch & Filter) — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Workspace Page` -> เปิดหน้าจอ / เปลี่ยน Tab (`All Tasks`, `This Month`, `This Week`, `Today`) |
| **API Contract** | `GET /api/tasks?projectId={id}` <br> Response: Array ของ Task |
| **Security (T-811)** | **Authentication Mandatory**: ต้องใช้ `authenticate` middleware เพื่อยืนยันตัวตนก่อนเข้าถึงข้อมูล (ห้ามใช้ fallback 'system') |
| **Backend Logic (T-810)** | **TaskService.getTasks**: <br> 1. กรอง `isActive` และ `projectId` ใน Memory ชั่วคราว (เพื่อเลี่ยง Error: FAILED_PRECONDITION กรณีที่ยังไม่ได้สร้าง Index) <br> 2. กรองข้อมูลตามผู้ที่ได้รับมอบหมาย (Assignee) |
| **Client Logic (T-812)** | **Active Tab Filter**: <br> เมื่อได้รับ tasks มาแล้ว จะนำมาเข้ากระบวนการกรองอีกชั้นตาม `activeTab` ก่อนแสดงผลใน Column: <br> - **Today**: กรอง `dueDate` ที่ตรงกับวันปัจจุบัน <br> - **This Week**: กรอง `dueDate` ที่อยู่ในสัปดาห์นี้ <br> - **This Month**: กรอง `dueDate` ที่อยู่ในเดือนนี้ <br> - **All Tasks**: ข้ามการกรองวันที่ |

---

## 8. 🛠️ Task Management (Edit/Delete & Audit Trail)

### 🛣️ [T-816 & T-818] Backend Update & Soft Delete — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **API Contract** | `PATCH /api/tasks/:id` (Update) <br> `DELETE /api/tasks/:id` (Soft Delete) |
| **Soft Delete Logic** | ปรับ `isActive: false` เพื่อซ่อนข้อมูลจากการดึงผลลัพธ์ปกติ (Omit from memory filter in `getTasks`) |
| **Audit Trail (T-818)** | บันทึกประวัติลงใน `TaskEditHistory` (Subcollection): <br> - `oldValues`: ข้อมูลก่อนแก้ไข <br> - `newValues`: ข้อมูลหลังแก้ไข <br> - `changedBy`: userId ของผู้แก้ไข |
| **Category Migration (T-818)** | หากมีการเปลี่ยน `categoryName`: <br> 1. คำนวณ `categoryId` ใหม่ (หรือใช้ที่มีอยู่) <br> 2. ย้าย Document ไปยัง Path ใหม่ (Delete old, Create new) เพื่อรักษาโครงสร้าง Hierarchy |

### 🎨 [T-817] Frontend Edit Task UI

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **Component** | `TaskCreateModal.tsx` (Reuse) |
| **Edit Mode** | เมื่อเปิดในโหมด Edit: <br> 1. รับ `task` object ผ่าน props <br> 2. ล็อคฟิลด์ `Project` และ `Work Order` ให้เป็น Read-only <br> 3. แสดง Checkbox "ขอความช่วยเหลือ" เพื่อให้สามารถเรียกทีม Support ได้ภายหลัง <br> 4. เปลี่ยนปุ่ม Submit เป็น "บันทึกการแก้ไข" |
| **Confirmation** | เมื่อกด Delete: <br> - แสดง Dialog ยืนยัน "คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้?" |

---

### 🛣️ [F-015] Daily Report Form & Labor Management — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Daily Report Page` -> `Select Task` -> `Select Date` -> `Add DC Labor (Popup)` -> `Adjust Individual Hours` -> `Fill Progress & Upload Photos` -> `Submit` |
| **Business Logic: Retroactive & Lock** | **1. การลงเวลาย้อนหลัง (Retroactive):**<br>- ย้อนหลัง <= 3 วัน: แก้ไขได้ทุกฟิลด์ รวม Progress<br>- ย้อนหลัง > 3 วัน: ล็อคฟิลด์ `Progress` (Read-only) แต่แก้ไข `แรงงาน DC` และ `ชั่วโมงทำงาน` ได้<br>**2. การล็อคตามงวดค่าแรง (Wage Period Lock):**<br>- ถ้าระยะเวลาของวันนั้น อยู่ในงวดค่าแรงที่ถูก `อนุมัติ` หรือ `นำจ่ายแล้ว` -> ล็อคไม่ให้แก้ไขหรือบันทึกข้อมูลใดๆ ทั้งสิ้น (Logic เชื่อมต่อกับระบบคำนวณค่าแรง) |
| **UI/UX: Labor Selection Popup** | - กดปุ่ม `+ เลือกแรงงาน DC` แสดง Popup รายชื่อแรงงาน<br>- **รายชื่อพนักงาน:** แสดงในรูปแบบ `employeeId : name` และกรองเฉพาะพนักงานที่อยู่ใน `projectLocationIds` เดียวกับ Task<br>- **กำหนดเวลา:** เลือกระบุเวลาทำงานส่วนกลาง (Day, OT เช้า/เที่ยง/เย็น) ไว้ใน Popup<br>- เมื่อกดยืนยัน ข้อมูลรายชื่อพร้อมเวลาจะไปแสดงที่ตารางหลัก และผู้ใช้สามารถ Edit เวลาของ "แต่ละบุคคล" แยกกันในหน้าหลักได้ |
| **Media Requirements** | บังคับอัปโหลดรูปภาพ 4 รูป (รูปถ่ายหน้างาน 2 รูป, รูปถ่ายแรงงาน 2 รูป) |

### 🎨 [T-822] Task Card Progress UI — Logic Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **Data Field** | `dailyProgress` (number: 0 - 100) |
| **UI Component** | MUI `LinearProgress` + `Typography` (Percentage) |
| **Visual Logic** | 1. แสดงอยู่ระหว่าง Description และ Due Date <br> 2. ความสูง 6px, ขอบมน (borderRadius: 3) <br> 3. สี: ตาม Theme (Primary) หรือเปลี่ยนตามช่วง (เช่น <30% ส้ม, >70% เขียว) |
| **Fallback** | หากค่าเป็น undefined หรือ null ให้แสดงเป็น 0% |

### 🛣️ [F-016] Task Revision & Reject Workflow — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Workspace Kanban` -> `Reject Button (Supervisor)` -> ใส่ชื่องานที่ให้แก้และระบุ FM -> `Submit` |
| **API Contract** | `POST /api/tasks/:id/reject` <br> Payload: `{ revisionName, assignees }` |
| **Database Schema** | **1. Task Document (Container):** ไม่ถูกสร้างใหม่ แต่เก็บ `assignees` สะสมทุกคนจากทุก Rev ไว้เพื่อใช้ Filter และเก็บ `currentRevision: "rev0X"` ชี้ไปยังเวอร์ชั่นล่าสุด <br> **2. Revision Document (Subcollection):** ซ้อนอยู่ใต้ `revisions/{revId}` เก็บประวัติของรอบนั้นๆ (`revisionName`, `assignees` เฉพาะรอบนั้น, `createdAt`) |
| **Backend Logic (T-852/T-853)** | 1. **Task Model Setup:** `Task` model has `currentRevision` defaulting to `rev00`. <br> 2. **Create Trigger:** In `TaskService.createTask`, `revisions/rev00` is generated atomically. <br> 3. **Reject Action (`POST /api/tasks/:id/reject`):** Increment `currentRevision` (e.g., `rev01`), union `assignees` to main task, reset `dailyProgress = 0`. <br> 4. **Daily Report Dynamic Routing:** Change daily report write/read paths to `revisions/{currentRevision}/dailyReports/{dateStr}`. <br> 5. **Cross-Revision Intelligence:** `getAllDailyReports` query reports across ALL revisions to show full history on calendar. |
| **Daily Report Logic** | 1. **Task Expansion (Frontend):** หาก Task มี Revision > rev00 ระบบจะสร้าง Virtual Task Items สำหรับรอบเก่าๆ และแสดงในแถบ `Finish` อัตโนมัติ <br> 2. **UI Labeling:** แสดงรหัส Revision นำหน้าชื่อ (e.g. `rev01 : "..."`) <br> 3. **Conflict Protection:** ระบบบล็อกการลงรายงานในรอบปัจจุบัน (rev01) หากพบว่าวันนั้นมีรายงานอยู่ในรอบเก่า (rev00) แล้ว เพื่อป้องกันข้อมูลทับซ้อน |

---

### 🛣️ [F-020] Cross-Site Collaborative Workflow (Support Request) — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Workspace Kanban (Site)` -> สร้างงานใหม่ติ๊ก `isSupportRequest` -> <br> `Workspace Kanban (Support)` -> กด `Add New` -> เลือกรายการจาก Dropdown `existingTasks` -> ระบุชื่อและมอบหมาย -> Submit |
| **API Contract** | `POST /api/tasks/:id/support` <br> Payload: `{ supportTaskName, assignees }` |
| **Database Schema** | **1. Task Document (Container):** งานยังคงอิงอ้างอิงกับ `taskId` ฝั่ง Site เสมอ (Composite ID: `woId__catId__taskId`) <br> **2. Support Data Flags:** เพิ่มฟิลด์ `isSupportRequest`, `isPickedUpBySupport`, `supportTaskName`, `supportDailyProgress` และ `supportAssignees` แยกต่างหากจาก `assignees` ปกติ<br> **3. Held Document (Subcollection):** เก็บ `held00` ไว้ใต้ `held/{heldId}` เพื่อแยก Version Control ของฝั่ง Support ออกจาก Rev ของ Site |
| **Backend Logic** | 1. ค้นหาเอกสารผ่าน `.includes('__')` สำหรับ Composite Path Navigation <br> 2. `runTransaction` ทำงานแบบ Atomic อ่านข้อมูลจาก `revisions/rev00` และคัดลอกมาสร้างเป็น `held/held00` <br> 3. แก้ไข `supportAssignees` กลับไปที่เอกสารหลัก เพื่ออำนวยความสะดวกในการกรองผล |
| **Frontend UI/UX** | 1. **Data Isolation:** การแสดงผลในการ์ดงานจะแยกชื่อ Assignees อย่างเด็ดขาด (`site` เห็นเฉพาะของตัวเอง, `support` เห็นเฉพาะ `supportAssignees`) <br> 2. **Task Board Rule:** งาน Support จะไม่ปรากฏใน Kanban Board จนกว่า `isPickedUpBySupport` จะเป็น `true` |

---

### 🛣️ [F-021] Image Display & Preview Carousel — Logic Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Request** | ปรับปรุงการแสดงผลรูปภาพในหน้าสรุปข้อมูล (Modal) ให้ดู Premium และใช้งานง่ายขึ้น |
| **UI/UX Update** | 1. **Single Image Summary:** ในหน้า `TaskDailyReportModal` และ `Summary View` ของหน้าสร้างรายงาน จะรวมรูปถ่าย `site` และ `labor` เข้าด้วยกันและแสดงเพียงรูปแรกรูปเดียว <br> 2. **Dynamic Header:** เปลี่ยนหัวข้อเป็น "รูปแนบทั้งหมด 1/N" โดย N คือจำนวนรูปทั้งหมดที่มีในวันนั้น <br> 3. **Image Counter:** มีการแสดงตัวเลขกำกับตำแหน่งรูปปัจจุบัน (เช่น 1/5) ในหน้า Preview |
| **Preview Mechanism** | เมื่อคลิกที่รูปภาพ ระบบจะเปิด `Dialog` แสดงรูปขนาดใหญ่ พร้อมปุ่ม `ChevronLeft` และ `ChevronRight` (Carousel) เพื่อเลื่อนดูรูปทั้งหมดในรายการนั้นๆ |
| **Technical Implementation** | 1. **State Management:** เพิ่ม `previewImages` (string[]) และ `previewIndex` (number) เพื่อจัดการลำดับรูปภาพใน Carousel <br> 2. **Shared Logic:** ใช้ `getImageUrl` helper เพื่อจัดการ Path ของรูปภาพทั้งแบบ Local และ Cloud Storage |

### 🛣️ [F-016] Daily Report Task Visibility — E2E Flow

| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **Logic Objective** | แก้ไขปัญหางานหายในหน้า Daily Report โดยเฉพาะในแถบ "Finish" เพื่อให้ FM ตรวจสอบงานย้อนหลังได้ |
| **Visibility Rules** | **1. Admin/God:** มองเห็นงานทั้งหมดที่ `isActive: true` <br> **2. FM/Support:** มองเห็นงานที่ตัวเองมีส่วนร่วม โดยเช็คจาก: <br> - `assignees` (Site Team) <br> - `supportAssignees` (Support Team) <br> - `historicalAssigneeIds` (ประวัติการทำงานใน Revision ก่อนหน้า) |
| **Tab Filtering (UI)** | **1. Active Tasks Tab:** แสดงงานที่ `status !== 'completed'` (หรือยังทำไม่เสร็จ) <br> **2. Finish Tab:** แสดงงานที่ `status === 'completed'` (เพื่อให้เข้าไปแก้ไขแรงงานย้อนหลังได้) |
| **Historical Data** | งานในทุก `revisions` จะถูกดึงมาแสดงผลหาก User เคยมีส่วนร่วม เพื่อให้ประวัติการทำงานไม่ขาดตอน แม้จะมีการ Reject และสร้าง Revision ใหม่ก็ตาม |

## 7.5 [F-017] Task Caching Strategy (Zustand + React Query + Midnight Reset)

กลยุทธ์การจัดการข้อมูลด้วยระบบ Cache เพื่อลดการเรียก API ซ้ำซ้อน (Redundant Requests) และเพิ่มประสิทธิภาพในการตอบสนองของ UI:

### 1. Storage & Expiry Logic
- **Store:** ใช้ `TaskCacheStore` (Zustand) สำหรับเก็บรายการ Task และใช้ `React Query` สำหรับข้อมูลระดับ Report Detail และ Worker List.
- **Expiry:** กำหนด `staleTime` และ `gcTime` ให้มีอายุจนถึง **"เวลาเที่ยงคืนของวันปัจจุบัน" (Midnight Reset)** เพื่อให้ระบบรีเฟรชข้อมูลใหม่โดยอัตโนมัติในวันถัดไป
- **Evaluation:** คำนวณเวลาที่เหลือจนถึงเที่ยงคืนผ่าน `remainingStaleTime` และนำไปใช้ใน Hook `useQuery` ทุกตัวในหน้า Daily Report.

### 2. Manual Invalidation (Global Sync)
- เมื่อผู้ใช้กดปุ่ม **Sync (Refresh)** บน Navbar ระบบจะทำงานดังนี้:
  1. เรียก `dailyReportService.clearCache()` เพื่อล้างข้อมูล Metadata.
  2. เรียก `taskCache.invalidate()` เพื่อล้างข้อมูล Task ใน Zustand Store.
  3. เรียก `queryClient.invalidateQueries()` เพื่อล้างข้อมูลทั้งหมดใน React Query Cache.
  4. ยิง Event `globalSync` เพื่อแจ้งให้ทุก Page ที่เปิดอยู่ทำการ Fetch ข้อมูลใหม่แบบ Silent Refresh.

### 3. Submission Invalidation
- หลังการบันทึกรายงานสำเร็จ (Submit) ระบบจะเรียก `invalidate()` ทุกจุดเพื่อให้มั่นใจว่าข้อมูลล่าสุด (เช่น Progress หรือ Status) จะถูกดึงมาแสดงผลใน Workspace ทันทีโดยไม่ต้องโหลดหน้าใหม่.

### 🛣️ [F-017] Caching & Global Sync — E2E Flow
| มิติการทำงาน | รายละเอียด |
| :--- | :--- |
| **User Action Path** | `Navbar` -> `Sync Button` หรือ `Daily Report` -> `Submit` |
| **State Management** | Zustand (`useTaskCacheStore`) + React Query (`useQueryClient`) |
| **Cache Duration** | Dynamic (Until 24:00:00 Local Time) |
| **Invalidation Flow** | 1. Clear Zustand Store -> 2. Invalidate React Query -> 3. Emit `globalSync` Event -> 4. `useQuery` refetch automatically |
| **UI Impact** | ข้อมูล Task และ Report โหลดเร็วขึ้น 80% หลังจากการเข้าถึงครั้งแรก และมีสถานะการโหลด (Global Backdrop) ที่ชัดเจนตอน Sync |

### 🛠️ Critical Bug Fix: Infinite Loop Resolution (Zustand + React Query)
- **Issue:** พบปัญหา "Maximum update depth exceeded" เมื่อ `isFetching` ของ React Query เปลี่ยนสถานะ
- **Root Cause:** การเรียกใช้ Zustand Store แบบ `const s = useStore()` (ทั้ง Object) ทำให้ Component Re-render ทุกครั้งที่ Store มีการขยับ และ `useEffect` ที่เรียก `showLoading()` กระตุ้นให้เกิดการวนลูปซ้ำซ้อน
- **Fix:** 
  1. เปลี่ยนการเรียกใช้เป็นแบบ **Selectors** (e.g., `const user = useAuthStore(s => s.user)`) เพื่อลดการ Re-render
  2. เพิ่ม **Defensive Updates** ใน Store actions (ตรวจสอบค่าเดิมก่อน `set`) เพื่อป้องกันการอัปเดตสถานะที่ไม่มีการเปลี่ยนแปลงจริง

---
