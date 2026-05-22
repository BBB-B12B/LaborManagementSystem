# โครงสร้าง Database ของ Collection Work Order (Updated)

ในระบบนี้ ข้อมูลที่เกี่ยวกับ Work Order จะถูกจัดเก็บแยกส่วนกันตามฐานข้อมูล 2 ส่วนหลักคือ **Labor Management DB (db)** และ **After-Sale DB (afterSaleDb)** ดังนี้:

## 1. ฐานข้อมูล Labor Management (Firestore: db)
ใช้สำหรับจัดเก็บ Configuration ของ Work Order และ Category ที่ผูกอยู่กับแต่ละโครงการ (Project)

### 1.1 Collection: `Project/{projectId}/workOrderConfigs`
เก็บข้อมูลหลักของ Work Order ประจำโปรเจกต์
- **Document ID**: `code` ของ Work Order เป็นตัวพิมพ์ใหญ่ (เช่น "STR")
- **Field ที่จัดเก็บ**:
  - `code` (string): รหัสของ Work Order
  - `name` (string): ชื่อของ Work Order (เช่น "โครงสร้าง")
  - `createdAt` (timestamp): วันเวลาที่สร้าง
  - `createdBy` (string): UID ของผู้สร้าง
  - `updatedAt` (timestamp): วันเวลาที่แก้ไขล่าสุด
  - `updatedBy` (string): UID ของผู้แก้ไขล่าสุด

### 1.2 Collection: `Project/{projectId}/categoryConfigs`
เก็บหมวดหมู่ย่อย (Category) ที่อยู่ภายใต้ Work Order
- **Document ID**: Auto-generated ID
- **Field ที่จัดเก็บ**:
  - `workOrderCode` (string): รหัส Work Order ที่หมวดหมู่นี้สังกัดอยู่ (เช่น "STR")
  - `name` (string): ชื่อของหมวดหมู่ (เช่น "งานฐานราก")
  - `createdAt` (timestamp): วันเวลาที่สร้าง
  - `createdBy` (string): UID ของผู้สร้าง
  - `updatedAt` (timestamp): วันเวลาที่แก้ไขล่าสุด
  - `updatedBy` (string): UID ของผู้แก้ไขล่าสุด

## 2. ฐานข้อมูล After-Sale (Firestore: afterSaleDb)
เป็นฐานข้อมูลที่ใช้จัดเก็บ Task งานจริง โดยใช้โครงสร้างแบบ Hierarchical ที่รวม Work Order, Category, Task, และ Subtask ไว้ด้วยกัน

### โครงสร้าง Path: `workOrders/{woId}/categories/{catId}/tasks/{taskId}/subtasks/{subtaskId}`

---

### 2.1 Collection: `workOrders`
- **Document ID**: `woId`
- **Field หลัก**:
  - `projectId` (string): ID ของโปรเจกต์ที่ Task นี้สังกัด
  - `workOrderCode` (string): รหัสอ้างอิงจาก Work Order Config

### 2.2 Sub-collection: `categories` (อยู่ภายใต้ `workOrders/{woId}`)
- **Document ID**: `catId`
- **Field หลัก**:
  - `catName` (string): ชื่อหมวดหมู่ (Category Name)

### 2.3 Sub-collection: `tasks` (อยู่ภายใต้ `categories/{catId}`)
เป็นส่วนที่เก็บรายละเอียดของงานหลัก (Task) ซึ่งรวบรวมภาพรวมของความคืบหน้า (คำนวณจาก Subtasks ทั้งหมด)
- **Document ID**: `taskId` (เช่น "STR-0001-001")
- **Field หลัก**:
  - `id` (string): ID เต็มที่รวม Path ทั้งหมด (เช่น `woId__catId__taskId`)
  - `taskId` (string): รหัสงาน
  - `taskName` (string): ชื่อของงาน
  - `workOrderId` (string), `workOrderCode` (string), `workOrderName` (string): ข้อมูล Work Order ที่สังกัด
  - `categoryId` (string), `categoryName` (string): ข้อมูล Category ที่สังกัด
  - `projectId` (string): ID โปรเจกต์
  - `dueDate` (timestamp): วันกำหนดส่ง
  - `status` (string): สถานะของงาน ('upcoming', 'in-progress', 'for-checking', 'done', 'approved', 'rejected')
  - `dailyProgress` (number): เปอร์เซ็นต์ความคืบหน้ารวมของ Task (เฉลี่ยจาก Subtasks)
  - `assignees` (array): รายชื่อผู้รับผิดชอบหลัก
    - `employeeId` (string), `name` (string), `roleId` (string)
  - `historicalAssigneeIds` (array of string): รวบรวม Employee ID ของคนที่เคยเกี่ยวข้องทั้งหมด
  - `currentRevision` (string), `revisionId` (string), `revisionName` (string)
  - `isSupportRequest` (boolean), `attachmentsCount` (number), `isActive` (boolean)
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (timestamp/string)

### 2.4 Sub-collection: `subtasks` (อยู่ภายใต้ `tasks/{taskId}`)
ใช้แบ่งงานย่อยภายใน Task หลัก หรือเอาไว้ห่อหุ้มงานแต่ละรอบให้ชัดเจนขึ้น
- **Document ID**: `subtaskId` (เช่น "STR-0001-001-0001")
- **Field หลัก**:
  - `id` (string): ID เต็ม (เช่น `woId__catId__taskId__subtaskId`)
  - `subtaskId` (string): รหัส Subtask (เช่น "STR-0001-001-0001")
  - `subtaskName` (string): ชื่องานย่อย
  - `status` (string): สถานะการทำงาน
  - `dailyProgress` (number): ความคืบหน้าของ Subtask นี้
  - `assignees` (array): รายชื่อผู้รับผิดชอบงานย่อยนี้
  - `historicalAssigneeIds` (array of string): ผู้ที่เกี่ยวข้อง
  - `currentRevision` (string): Revision ล่าสุดที่ทำงานอยู่ (เช่น "rev00")
  - `isPickedUpBySupport` (boolean): ทีม Support รับไปทำหรือไม่
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (timestamp/string)

### 2.5 Sub-collection: `revisions` (อยู่ภายใต้ `subtasks/{subtaskId}`)
ประวัติการแก้ไขงาน (Revision) ของ Subtask แต่ละตัว (เช่น rev00, rev01) เมื่อมีการตีกลับงาน (Reject) จะเกิด Document ใหม่
- **Document ID**: `revisionId` (เช่น "rev00", "rev01")
- **Field หลัก**:
  - `revisionId` (string): รหัสของ Revision
  - `revisionName` (string): ชื่อของการแก้ไข
  - `taskName` (string): ชื่องานที่แก้ไข
  - `assignees` (array): รายชื่อผู้รับผิดชอบงานใน Revision นั้น
  - `createdAt`, `createdBy` (timestamp/string)

### 2.6 Sub-collection: `help` (อยู่ภายใต้ `subtasks/{subtaskId}`)
ข้อมูลสำหรับ **ทีม Support** ที่เข้ามาช่วยทำงานคู่ขนานกับทีมหลัก (เช่น help00)
- **Document ID**: `helpId` (เช่น "help00")
- **Field หลัก**: (เหมือนกับ `revisions`)
  - `revisionId` (string), `revisionName` (string), `taskName` (string)
  - `assignees` (array)
  - `createdAt`, `createdBy` (timestamp/string)

### 2.7 Sub-collection: `requests` (อยู่ภายใต้ `revisions/{revisionId}` และ `help/{helpId}`)
เก็บข้อมูล **การวางแผนงานล่วงหน้า (Advance Request)** หรือเป้าหมายการทำงานวันพรุ่งนี้
- **Document ID**: `YYYY-MM-DD` (วันที่วางแผน เช่น "2026-05-14")
- **Field หลัก**:
  - `requestId` (string): วันที่ขอทำแผนงาน เช่น "2026-05-14"
  - `reportDate` (timestamp): เวลาที่เป็น Timestamp ของวันที่เลือก
  - `progress` (number): แผนงานความคืบหน้าที่คาดว่าจะทำได้
  - `note` (string): หมายเหตุเพิ่มเติม
  - `labor` (array): แผนการใช้ทีมงาน
    - `workerId` (string), `workerName` (string), `employeeId` (string)
    - `shiftTimes` (object), `shifts` (object)
  - `leave` (array): ข้อมูลการลางานล่วงหน้า
  - `isSupportReport` (boolean): เช็คว่าเป็นคำขอของทีม Support หรือไม่
  - `status` (string): สถานะเช่น "pending"
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (timestamp/string)

### 2.8 Sub-collection: `dailyReports` (อยู่ภายใต้ `revisions/{revisionId}` และ `help/{helpId}`)
เก็บข้อมูล **รายงานการปฏิบัติงานจริงประจำวัน**
- **Document ID**: `YYYY-MM-DD` (วันที่ลงงาน เช่น "2026-05-14")
- **Field หลัก**:
  - `reportDate` (timestamp): วันที่ของรายงาน
  - `progress` (number): ความคืบหน้าที่ทำได้จริง (สะสม)
  - `note` (string): หมายเหตุการทำงาน
  - `photos` (object): รูปภาพหน้างาน
    - `site` (array of urls), `laborByShift` (object แยกกะ)
  - `labor` (array): ข้อมูลแรงงานที่ลงเวลาจริง
  - `leave` (array): ข้อมูลการลางานของแรงงานจริง
  - `isSupportReport` (boolean): ใช่รายงานของ Support ไหม
  - `editHistory` (array): ประวัติการย้อนแก้ไขเอกสารการลงแรงงาน
    - `editedAt`, `editedBy`, `snapshot`
  - `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (timestamp/string)

---

## 3. Structure Tree (แผนผังโครงสร้างแบบเต็ม)

```text
📦 After-Sale DB (afterSaleDb)
 ┗ 📂 workOrders
    ┗ 📜 {woId}
       ┣ 🏷️ projectId: string
       ┣ 🏷️ workOrderCode: string
       ┗ 📂 categories
          ┗ 📜 {catId}
             ┣ 🏷️ catName: string
             ┗ 📂 tasks
                ┗ 📜 {taskId} (เช่น "STR-0001-005")
                   ┣ 🏷️ id: string
                   ┣ 🏷️ taskId: string
                   ┣ 🏷️ taskName: string
                   ┣ 🏷️ workOrderId: string
                   ┣ 🏷️ workOrderCode: string
                   ┣ 🏷️ workOrderName: string
                   ┣ 🏷️ categoryId: string
                   ┣ 🏷️ categoryName: string
                   ┣ 🏷️ projectId: string
                   ┣ ⏳ dueDate: timestamp
                   ┣ 🏷️ status: string
                   ┣ 📊 dailyProgress: number
                   ┣ 👥 assignees: array [ { employeeId, name, roleId } ]
                   ┣ 👥 historicalAssigneeIds: array
                   ┣ 🏷️ currentRevision: string
                   ┣ 🏷️ revisionId: string
                   ┣ 🏷️ revisionName: string
                   ┣ 🏷️ isSupportRequest: boolean
                   ┣ 🔢 attachmentsCount: number
                   ┣ 🏷️ isActive: boolean
                   ┣ ⏳ createdAt, updatedAt, createdBy, updatedBy
                   ┗ 📂 subtasks
                      ┗ 📜 {subtaskId} (เช่น "STR-0001-005-0001")
                         ┣ 🏷️ id: string
                         ┣ 🏷️ subtaskId: string
                         ┣ 🏷️ subtaskName: string
                         ┣ 🏷️ status: string
                         ┣ 📊 dailyProgress: number
                         ┣ 👥 assignees: array
                         ┣ 👥 historicalAssigneeIds: array
                         ┣ 🏷️ currentRevision: string
                         ┣ 🏷️ isPickedUpBySupport: boolean
                         ┣ ⏳ createdAt, updatedAt, createdBy, updatedBy
                         ┣ 📂 revisions
                         ┃  ┗ 📜 {revisionId} (เช่น "rev00")
                         ┃     ┣ 🏷️ revisionId: string
                         ┃     ┣ 🏷️ revisionName: string
                         ┃     ┣ 🏷️ taskName: string
                         ┃     ┣ 👥 assignees: array
                         ┃     ┣ ⏳ createdAt, createdBy
                         ┃     ┣ 📂 requests (Advance Request)
                         ┃     ┃  ┗ 📜 {YYYY-MM-DD} (เช่น "2026-05-14")
                         ┃     ┃     ┣ 🏷️ requestId: string
                         ┃     ┃     ┣ ⏳ reportDate: timestamp
                         ┃     ┃     ┣ 📊 progress: number
                         ┃     ┃     ┣ 📝 note: string
                         ┃     ┃     ┣ 👥 labor: array
                         ┃     ┃     ┣ 🏖️ leave: array
                         ┃     ┃     ┣ 🏷️ isSupportReport: boolean
                         ┃     ┃     ┣ 🏷️ status: string
                         ┃     ┃     ┗ ⏳ createdAt, updatedAt, createdBy, updatedBy
                         ┃     ┗ 📂 dailyReports (Actual Report)
                         ┃        ┗ 📜 {YYYY-MM-DD}
                         ┃           ┣ ⏳ reportDate: timestamp
                         ┃           ┣ 📊 progress: number
                         ┃           ┣ 📝 note: string
                         ┃           ┣ 🖼️ photos: object { site, laborByShift }
                         ┃           ┣ 👥 labor: array
                         ┃           ┣ 🏖️ leave: array
                         ┃           ┣ 🏷️ isSupportReport: boolean
                         ┃           ┣ 🕰️ editHistory: array
                         ┃           ┗ ⏳ createdAt, updatedAt, createdBy, updatedBy
                         ┗ 📂 help
                            ┗ 📜 {helpId} (เช่น "help00")
                               ┣ 🏷️ revisionId: string
                               ┣ 🏷️ revisionName: string
                               ┣ 🏷️ taskName: string
                               ┣ 👥 assignees: array
                               ┣ ⏳ createdAt, createdBy
                               ┣ 📂 requests (เหมือนด้านบน)
                               ┗ 📂 dailyReports (เหมือนด้านบน)
```
