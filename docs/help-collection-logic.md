# Help Collection — Logic & Field Reference

> เอกสารนี้สรุป Logic การเกิด Collection `help` ใน Firestore ทั้งหมด
> อัปเดต: 2026-06-16

---

## 1. โครงสร้าง Path ใน Firestore

```
afterSaleDb
└── workOrders/{woId}
    └── categories/{catId}
        └── tasks/{taskId}
            └── subtasks/{subtaskId}
                ├── revisions/{revisionId}          ← งานหลัก
                │   └── dailyReports/{dateStr}
                └── help/{helpId}                   ← งาน Support
                    ├── dailyReports/{dateStr}
                    └── requests/{dateStr}
```

> **หมายเหตุ:** `help` เป็น subcollection ที่ขนานกับ `revisions`  
> เกิดขึ้นเมื่อทีม Support เข้ามาช่วยงาน (Join Support Task)

---

## 2. ตรรกะการเกิด Help Document

### 2.1 Trigger — เมื่อไหรที่สร้าง?

| เงื่อนไข | Endpoint | ไฟล์ |
|---|---|---|
| ทีม Support Join งาน **ระดับ Subtask** | `POST /api/tasks/:id/support` | `TaskService.ts` line ~564 |
| ทีม Support Join งาน **ระดับ Task** (Backward Compat) | `POST /api/tasks/:id/support` | `TaskService.ts` line ~620 |

### 2.2 การตั้งชื่อ HelpId

```
helpId = currentRevisionId.replace("rev", "help")
```

| revisionId | helpId |
|---|---|
| `rev00` | `help00` |
| `rev01` | `help01` |
| `rev02` | `help02` |

### 2.3 กระบวนการสร้าง (Transaction)

```typescript
// เรียกใน joinSupportTask() — TaskService.ts
const helpRef = subtaskRef.collection('help').doc(helpId);
transaction.set(helpRef, {
  revisionId: helpId,         // "help00", "help01", ...
  revisionName: supportTaskName,
  taskName: supportTaskName,
  assignees: supportAssignees,
  createdAt: now,
  createdBy: updatedBy,
});
```

---

## 3. Field ของ Help Document (Root Document)

| Field | Type | ค่าที่เก็บ | ตัวอย่าง |
|---|---|---|---|
| `revisionId` | `string` | ID ของ help document | `"help00"` |
| `revisionName` | `string` | ชื่องาน Support ที่กำหนด | `"ทีม B ช่วยงานไฟฟ้า"` |
| `taskName` | `string` | ชื่องานเดิม (Task ต้นทาง) | `"งานไฟฟ้าชั้น 3"` |
| `assignees` | `TaskAssignee[]` | รายชื่อคนในทีม Support | ดู Section 3.1 |
| `createdAt` | `Date` (Timestamp) | วันที่ Support Join | `2026-05-01T08:00:00Z` |
| `createdBy` | `string` | userId ผู้ที่กด Join | `"emp_00123"` |

### 3.1 TaskAssignee Object

| Field | Type | ค่าที่เก็บ |
|---|---|---|
| `employeeId` | `string` | รหัสพนักงาน |
| `name` | `string` | ชื่อ-นามสกุล |
| `roleId` | `string` | รหัส Role ของพนักงาน |

---

## 4. Subcollection: `dailyReports/{dateStr}`

ใช้บันทึก Daily Report ประจำวันของทีม Support  
`dateStr` = `YYYY-MM-DD` เช่น `2026-05-15`

| Field | Type | ค่าที่เก็บ |
|---|---|---|
| `reportDate` | `string` | วันที่รายงาน (`YYYY-MM-DD`) |
| `progress` | `number` | % ความคืบหน้า (0–100) |
| `labor` | `object[]` | รายการแรงงานประจำวัน |
| `leave` | `object[]` | รายการลาหยุด |
| `note` | `string` | หมายเหตุเพิ่มเติม |
| `photos` | `string[]` | URL รูปถ่ายประจำวัน |
| `editHistory` | `object[]` | ประวัติการแก้ไข |
| `createdAt` | `Date` | วันที่สร้าง |
| `updatedAt` | `Date` | วันที่แก้ไขล่าสุด |

---

## 5. Subcollection: `requests/{dateStr}`

ใช้บันทึก Advance / Planning Request ของทีม Support  
`dateStr` = `YYYY-MM-DD`

| Field | Type | ค่าที่เก็บ |
|---|---|---|
| `reportDate` | `string` | วันที่ขอ |
| `labor` | `object[]` | แผนแรงงานที่ขอ |
| `leave` | `object[]` | แผนลาหยุด |
| `progress` | `number` | % ความคืบหน้าที่วางแผน |
| `status` | `string` | สถานะ (`pending` / `approved` / `rejected`) |
| `createdAt` | `Date` | วันที่สร้าง |
| `updatedAt` | `Date` | วันที่แก้ไขล่าสุด |

---

## 6. Field ที่เกี่ยวข้องใน Task Document (Parent)

Task Document จะมี field เหล่านี้เพิ่มขึ้นหลังจาก Support Join:

| Field | Type | ค่าที่เก็บ |
|---|---|---|
| `isPickedUpBySupport` | `boolean` | มีทีม Support Join แล้ว |
| `supportTaskName` | `string` | ชื่องาน Support |
| `supportDailyProgress` | `number` | % ความคืบหน้าของ Support (แยกจากงานหลัก) |
| `supportAssignees` | `TaskAssignee[]` | ทีม Support |
| `supportCreatedAt` | `Date` | วันที่ Support Join |
| `supportedRevisionIds` | `string[]` | Revision ที่มี Support (เช่น `["rev00"]`) |
| `supportUnlockedDates` | `Record<string, {...}>` | วันที่ Unlock สำหรับ Support |
| `supportUnlockRequests` | `Record<string, {...}>` | คำขอ Unlock ของ Support |

---

## 7. API Endpoints ที่เกี่ยวข้อง

| Method | Endpoint | การกระทำกับ help |
|---|---|---|
| `POST` | `/api/tasks/:id/support` | **สร้าง** help document |
| `POST` | `/api/tasks/:id/reports` | เขียน dailyReport ใน help |
| `GET` | `/api/tasks/:id/reports` | อ่าน dailyReports จาก help |
| `GET` | `/api/tasks/:id/reports/:date` | อ่าน dailyReport วันเดียวจาก help |
| `POST` | `/api/tasks/:id/requests` | สร้าง request ใน help |
| `GET` | `/api/tasks/:id/requests` | อ่าน requests จาก help |
| `PATCH` | `/api/tasks/:id/requests/:date/status` | อัปเดต status ของ request ใน help |
| `POST` | `/api/tasks/:id/unlock-report` | Unlock วันที่ใน help |
| `GET` | `/api/tasks/backlog` | ดึง report ทั้งหมดรวม help |

> flag ที่ใช้แยกว่าเป็น Support Report: `isSupportReport=true` (query param)

---

## 8. ไฟล์ที่เกี่ยวข้องหลัก

| ไฟล์ | บทบาท |
|---|---|
| `backend/src/services/TaskService.ts` | Logic ทั้งหมด (joinSupportTask, submitDailyReport, getAdvanceRequests) |
| `backend/src/api/routes/tasks.routes.ts` | Express routes |
| `backend/src/models/Task.ts` | TypeScript Interface (`TaskRevision`, `TaskAssignee`) |
| `backend/src/services/ProjectConfigService.ts` | Cleanup เมื่อลบ WorkOrder / Category |
| `frontend/src/pages/daily-reports/index.tsx` | UI อ่าน/แสดง support reports |

---

## 9. สรุป Diagram

```
POST /api/tasks/:id/support
        │
        ▼
joinSupportTask() ─── Transaction ───► สร้าง help/{helpId} ใน subtask
        │                               (helpId = revId.replace("rev","help"))
        │
        ├── Case A: มี subtaskId → สร้าง help ใต้ subtask นั้น
        └── Case B: ไม่มี subtaskId → สร้าง help ใต้ทุก subtask ใน task

หลัง Support Join:
  ทีม Support submit daily report → เขียนลง help/{helpId}/dailyReports/{date}
  ทีม Support submit advance request → เขียนลง help/{helpId}/requests/{date}
```
