# Work Hour Monitoring — Business Logic Source of Truth

> **วัตถุประสงค์**: ไฟล์นี้คือ "source of truth" ที่บันทึก logic ที่ถูกต้องไว้
> ก่อนแก้ไขโค้ดใดๆ ให้ตรวจสอบไฟล์นี้ก่อนเสมอ เพื่อป้องกันการลบ logic สำคัญออกโดยไม่ตั้งใจ

---

## 1. โครงสร้าง Data (`ReconciliationRecord`)

### ชั่วโมงทำงาน — มีหลาย source ต้องระวัง priority

| Field | ความหมาย | หมายเหตุ |
|---|---|---|
| `timesheetNormalHours` | ชั่วโมงปกติจาก timesheet (Daily Report) | source หลัก |
| `timesheetOtMorning` | ชั่วโมง OT เช้าจาก timesheet | |
| `timesheetOtNoon` | ชั่วโมง OT เที่ยงจาก timesheet | |
| `timesheetOtEvening` | ชั่วโมง OT เย็นจาก timesheet | |
| `approvedNormalHours` | ชั่วโมงปกติที่ approved | อาจเป็น 0 แม้มี timesheet > 0 |
| `approvedOtMorning` | ชั่วโมง OT เช้าที่ approved | อาจเป็น 0 แม้มี timesheet > 0 |
| `approvedOtNoon` | ชั่วโมง OT เที่ยงที่ approved | อาจเป็น 0 แม้มี timesheet > 0 |
| `approvedOtEvening` | ชั่วโมง OT เย็นที่ approved | อาจเป็น 0 แม้มี timesheet > 0 |
| `dailyReportHours` | รวมชั่วโมงทำงานจาก daily report | fallback เก่า |
| `scanNormalHours` | ชั่วโมงปกติจากการสแกน | |
| `scanOtEveningHours` | ชั่วโมง OT เย็นจากการสแกน | |

### ⚠️ CRITICAL: Rule สำหรับการแสดงผลชั่วโมง OT ใน Modal

**ปัญหา**: `approvedOtEvening` อาจเป็น `0` แม้ว่า `timesheetOtEvening` จะมีค่า (เช่น `4`)
ตัวอย่าง: `approvedOtEvening = 0`, `timesheetOtEvening = 4`

**Rule ที่ถูกต้อง**:
- ค่าที่นำมาแสดงใน modal = **timesheet value** เสมอ (ไม่ใช่ approved)
- `approved` คือ "ที่อนุมัติแล้ว" → ใช้แสดงผลในส่วน "approved summary" เท่านั้น
- ใน "Daily Report Reference Panel" → ใช้ `timesheetXxx` เป็นหลัก

**การเขียนโค้ดที่ถูกต้อง**:
```typescript
// ❌ ผิด — ถ้า approvedOtEvening = 0, ?? จะคืน 0 แทน timesheetOtEvening = 4
value: selectedRow?.approvedOtEvening ?? selectedRow?.timesheetOtEvening

// ✅ ถูก — ใช้ timesheet เป็นหลัก, approved เป็น fallback เมื่อไม่มี timesheet
value: selectedRow?.timesheetOtEvening ?? selectedRow?.approvedOtEvening
```

**การตรวจสอบว่า "มีค่า" (hasValue)**:
```typescript
// ❌ ผิด — ถ้า value = 0 จะถือว่าไม่มีค่า ทั้งที่ 0 อาจหมายถึง "ไม่มี OT" จริงๆ
const hasValue = value !== undefined && value !== null && value !== 0;

// ✅ ถูก — ตรวจ nullish เท่านั้น
const hasValue = value !== undefined && value !== null && value > 0;
// ทั้งสองวิธีให้ผลเหมือนกัน แต่ต้องแน่ใจว่า value ที่ส่งมาถูก source ก่อน
```

---

## 2. การแสดงผล Daily Report Reference Panel

### dailyItems array — priority ของค่า

```typescript
const dailyItems = [
  {
    label: 'ชั่วโมงทำงานปกติ',
    value: selectedRow?.timesheetNormalHours ?? selectedRow?.dailyReportHours,
    // NOTE: ไม่ใช้ approvedNormalHours เพราะต้องการแสดงสิ่งที่ timesheet บันทึกไว้
  },
  {
    label: 'OT เช้า',
    value: selectedRow?.timesheetOtMorning,
    // ✅ ใช้ timesheet โดยตรง ไม่ mix กับ approved
  },
  {
    label: 'OT เที่ยง',
    value: selectedRow?.timesheetOtNoon,
  },
  {
    label: 'OT เย็น',
    value: selectedRow?.timesheetOtEvening,
    // ✅ ใช้ timesheet โดยตรง — approved อาจเป็น 0 แม้ timesheet = 4
  },
];
```

### timeRange แสดงจาก shiftTimes

```typescript
// shiftTimes มาจาก backend — format: "HH:MM - HH:MM" (มีช่องว่างรอบ -)
const otEveningRange = selectedRow?.shiftTimes?.otEvening ?? null;
// ตัวอย่าง: "18:00 - 22:00"

// ถ้าต้องการ split → ระวัง format อาจมีหรือไม่มี space
const parts = rangeStr.split('-').map(s => s.trim());
```

---

## 3. shiftTimes Format

| Field | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `shiftTimes.day` | `"08:00 - 17:00"` | ช่วงเวลาทำงานปกติ |
| `shiftTimes.otMorning` | `"06:00 - 08:00"` | OT ก่อนเข้า (อาจ undefined) |
| `shiftTimes.otNoon` | `"12:00 - 13:00"` | OT พักกลางวัน (อาจ undefined) |
| `shiftTimes.otEvening` | `"18:00 - 22:00"` | OT หลังเลิกงาน |

---

## 4. scanPunches vs dailyReportPunches

### หลักการ
- `dailyReportPunches`: ลำดับที่ backend รับประกัน (sorted by time)
- `scanPunches`: backend **ไม่รับประกัน** order → **ต้อง sort ฝั่ง frontend เสมอ**

```typescript
// ✅ ถูกต้อง — sort scanPunches ก่อนใช้งาน
const scanPunches: string[] = [...(selectedRow?.scanPunches || [])].sort(
  (a, b) => toMinutes(a) - toMinutes(b)
);
```

### การ match punches ใน TimeTable
- จับคู่โดย **position** (index ตรงกัน) หลังจาก sort แล้วทั้งคู่
- ไม่ match โดย value เพราะ conflict คือ "เวลาต่าง แต่ตำแหน่งเดียวกัน"

### leaveEntries.description formats
```
"Full Day"       → ลาทั้งวัน — ไม่ต้อง split
"Morning"        → ลาช่วงเช้า — ไม่ต้อง split
"Afternoon"      → ลาช่วงบ่าย — ไม่ต้อง split
"HH:MM-HH:MM"   → ลาช่วงเวลาระบุ → split ได้ใช้ regex: /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/
```

```typescript
// ✅ ถูกต้อง — validate ก่อน split
const TIME_RANGE_RE = /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/;
if (TIME_RANGE_RE.test(entry.description.trim())) {
  leavePunches.push(...entry.description.split('-').map((s: string) => s.trim()));
}
```

---

## 5. Status Types และ Display Logic

| Status | ความหมาย | สี |
|---|---|---|
| `MATCHED` | ข้อมูล scan ตรงกับ Daily Report | Green |
| `CONFLICTED` | มีข้อมูลทั้งสองฝั่งแต่ไม่ตรงกัน | Orange |
| `MISSING_SCAN` | มี Daily Report แต่ไม่มี scan | Red |
| `MISSING_DAILY` | มี scan แต่ไม่มี Daily Report | Red |
| `ABSENT` | ขาดงาน | Red |
| `LEAVE` | ลางาน | Orange |
| `UNREGISTERED_EMPLOYEE` | พนักงานไม่ได้ลงทะเบียน | Red |

### Dialog แสดงผลตาม Status
- `MISSING_DAILY` → แสดงแค่ TimeTable (ไม่มี Daily Report panel), `hideDailyReport = true`
- อื่นๆ → แสดง Daily Report Reference Panel + TimeTable

---

## 6. Manual Resolve

```typescript
// fields ที่ส่งไป backend เมื่อ manual resolve
{
  normalHours: number,
  otMorning: number,
  otNoon: number,
  otEvening: number,
  reason: string,
}

// initial values เมื่อเปิด dialog
manualHours = {
  normal: row.timesheetNormalHours ?? row.dailyReportHours ?? 0,
  otMorning: row.timesheetOtMorning ?? 0,
  otNoon: row.timesheetOtNoon ?? 0,
  otEvening: row.timesheetOtEvening ?? 0,
}
// ✅ ใช้ timesheetXxx เป็น initial value — ไม่ใช้ approvedXxx
```

---

## 7. Optimistic UI (fillMutation)

เมื่อกด "ยืนยันตาม Daily Report":
1. **onMutate** → ลบแถวออกจาก list ทันที + อัปเดต Stats Card ทันที + ปิด Dialog
2. **onError** → rollback ข้อมูลกลับ
3. **onSettled** → invalidate queries จริง (sync กับ backend)

> ⚠️ อย่าย้าย `setCheckDialogOpen(false)` ออกจาก onMutate มาไว้ใน onSuccess
> เพราะจะทำให้ dialog ค้างอยู่จนกว่า API จะตอบกลับ (UX แย่)

---

## 8. Query Keys

```typescript
// main table
['reconciliation', { project, startDate, endDate, filterStatus, page, rowsPerPage }]

// summary stats cards
['reconciliation-stats']

// breakdown cards
['reconciliation-breakdown-stats']
```

> ⚠️ ทุก mutation ที่แก้ไขข้อมูล reconciliation ต้อง invalidate ทั้ง 3 keys

---

## 9. ไฟล์สำคัญ (Work Hour Monitoring)

### Frontend
| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx` | ตารางหลัก + modal รายละเอียด |
| `frontend/src/components/work-hour-monitoring/SummaryStats.tsx` | Summary cards (MATCHED, MISSING_SCAN, ฯลฯ) |
| `frontend/src/components/work-hour-monitoring/AbnormalBreakdown.tsx` | Breakdown ผิดปกติ |
| `frontend/src/components/work-hour-monitoring/NormalBreakdown.tsx` | Breakdown ปกติ |
| `frontend/src/services/reconciliationService.ts` | API calls สำหรับ reconciliation |
| `frontend/src/services/scanDataService.ts` | API calls สำหรับ scan data (fillFromDailyReport) |
| `frontend/src/constants/theme.ts` | RECON_COLORS, MIN_FONT_SIZE, STATUS_LABEL_MAP |

### Backend
| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/routes/reconciliationRoutes.ts` | Routes |
| `backend/src/services/reconciliationService.ts` | Business logic หลัก |
| `backend/src/controllers/reconciliationController.ts` | Controller |

---

## 10. Changelog

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-05-12 | สร้างไฟล์ source of truth |
| 2026-05-12 | Fix bug: OT Evening ไม่แสดงในModal เพราะ `approvedOtEvening=0` บัง `timesheetOtEvening=4` |
