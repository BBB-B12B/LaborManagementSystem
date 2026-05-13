# Work Hour Monitoring — Business Logic Source of Truth

> **วัตถุประสงค์**: ไฟล์นี้คือ "source of truth" ที่บันทึก logic ที่ถูกต้องไว้
> ก่อนแก้ไขโค้ดใดๆ ให้ตรวจสอบไฟล์นี้ก่อนเสมอ เพื่อป้องกันการลบ logic สำคัญออกโดยไม่ตั้งใจ

---

## 1. สถานะการ Reconcile (Reconciliation Status)

### ตารางสรุป

| Status | ความหมาย | สี UI | Admin ต้องทำ |
|---|---|---|---|
| `MATCHED` | scan ครอบคลุมช่วงเวลาทำงานทั้งหมด | Green | — |
| `CONFLICTED` | มีข้อมูลทั้งสองฝั่ง แต่ไม่สอดคล้องกัน | Orange | ตรวจสอบและแก้ไข |
| `MISSING_SCAN` | มี Daily Report แต่ไม่มี scan เลย | Red | ยืนยันตาม Daily Report |
| `MISSING_DAILY` | มี scan แต่ไม่มี Daily Report | Red | รอโฟร์แมนส่งรายงาน |
| `ABSENT` | Active employee ไม่มีทั้ง scan และ Daily Report | Red | — |
| `LEAVE` | ลางาน | Orange | — |
| `HOLIDAY` | วันหยุด | Gray | — |
| `UNREGISTERED_EMPLOYEE` | มี scan แต่ไม่พบพนักงานในระบบ | Red | ลงทะเบียนพนักงาน |

---

## 2. เกณฑ์การกำหนดสถานะ (`classifyByPunchCoverage`)

ฟังก์ชันหลักที่กำหนดสถานะคือ `classifyByPunchCoverage()` ใน `ReconciliationService`
**ห้ามเปลี่ยน logic นี้โดยไม่อัปเดตเอกสารนี้พร้อมกัน**

### 2.1 Base Cases (ตรวจก่อนทุกอย่าง)

```
ไม่มี daily AND ไม่มี scan  →  ABSENT (หรือ HOLIDAY / LEAVE ถ้าตรงเงื่อนไข)
ไม่มี daily AND มี scan     →  MISSING_DAILY
มี daily AND ไม่มี scan     →  MISSING_SCAN
ไม่มี dailyReportPunches   →  MISSING_DAILY (daily ไม่มีข้อมูลช่วงเวลา)
```

### 2.2 CONFLICTED — กรณีที่ต้องให้ Admin ตรวจสอบ

> **หลักการ**: ระบบตัดสินใจแทน Admin ไม่ได้ในกรณีที่ข้อมูลขัดแย้งกันอย่างมีนัยสำคัญ

#### กรณี B: สแกนนิ้วไม่ครบ (Insufficient Punch Count)

| จำนวนสแกน | สถานะ | เหตุผล | Admin ทำอะไร |
|---|---|---|---|
| 0 ครั้ง | `MISSING_SCAN` | ไม่มีข้อมูลเลย → ยืนยันตาม Daily Report ได้ทันที | กด "ยืนยันตาม Daily Report" |
| 1 ครั้ง | `CONFLICTED` | มีข้อมูลบางส่วน แต่ไม่รู้เวลาเข้าหรือออก → ต้องเติมให้ครบก่อน | เปิด Modal แก้ไขสแกนนิ้ว |
| ≥ 2 ครั้ง | ตรวจต่อ | ระบบเทียบได้ → เข้าสู่การเช็ค threshold | — |

> ⚠️ scan 3 ครั้งที่เวลาแรก–ท้ายครอบช่วงเวลาทำงานได้ → **ไม่ใช่กรณีนี้** ผ่านไปเช็ค threshold ต่อ

```typescript
// ตรวจก่อน punch coverage check — แยก 0 กับ 1 ออกจากกัน
const scanCount = (scanPunches || []).length;

if (scanCount === 0) {
  return {
    status: 'MISSING_SCAN',
    note: 'ไม่พบข้อมูลการสแกนนิ้ว',
  };
}

if (scanCount === 1) {
  return {
    status: 'CONFLICTED',
    note: `พบการสแกนเพียง 1 ครั้ง (${scanPunches[0]}) — Admin ต้องเติมเวลาที่ขาด`,
  };
}
```

> ⚠️ **Implementation Note**: ต้องตรวจ `scanCount` จาก `scanPunches` ดิบก่อน **เสมอ** ก่อนเรียก `makeEvenScanPunches()`
> เพราะ `makeEvenScanPunches()` ตัด punch สุดท้ายออกเมื่อจำนวนคี่ ทำให้ scan 1 ครั้ง → array ว่าง → โดนดักเป็น `MISSING_SCAN` แทน
>
> ```typescript
> // ❌ ผิด — makeEvenScanPunches([x]) คืน [] → scanValid = false → MISSING_SCAN (ไม่ใช่ CONFLICTED)
> const effectiveScanPunches = this.makeEvenScanPunches(scanPunches || []);
> const scanValid = effectiveScanPunches.length >= 2;
> if (dailyExists && !scanValid) return { status: 'MISSING_SCAN' };
>
> // ✅ ถูก — ตรวจ raw count ก่อน แล้วค่อย makeEven
> const scanCount = (scanPunches || []).length;
> if (scanCount === 0) return { status: 'MISSING_SCAN', ... };
> if (scanCount === 1) return { status: 'CONFLICTED', ... };
> const effectiveScanPunches = this.makeEvenScanPunches(scanPunches);
> // ... ตรวจ threshold ต่อ
> ```

#### กรณี A: สาย/ออกก่อน เกิน Threshold (Time Boundary Conflict)
ไม่ว่าจะเป็นเวลาปกติหรือ OT หากสแกนเข้าสายหรือออกก่อนเกินกว่า 30 นาที → ต้องสืบหาความจริง

```typescript
const CONFLICT_THRESHOLD = 30; // นาที

const isLateConflict      = lateMinutes > CONFLICT_THRESHOLD;
const isEarlyLeaveConflict = earlyLeaveMinutes > CONFLICT_THRESHOLD;

if (isLateConflict || isEarlyLeaveConflict) {
  return {
    status: 'CONFLICTED',
    lateMinutes,
    earlyLeaveMinutes,
    note: isEarlyLeaveConflict
      ? `ออกก่อนเกิน ${CONFLICT_THRESHOLD} นาที — ต้องตรวจสอบ Daily Report`
      : `สายเกิน ${CONFLICT_THRESHOLD} นาที — ต้องตรวจสอบ Daily Report`,
  };
}
```

**สิ่งที่ Admin ต้องทำ**:
- หากเป็นเวลาปกติ (08:00–17:00): ตรวจสอบว่าพนักงานมาจริงหรือไม่ (อาจลืมสแกน)
- หากเป็น OT: แจ้งโฟร์แมนให้แก้ Daily Report ให้ตรงกับความเป็นจริง

### 2.3 MATCHED — กรณีที่ผ่านได้อัตโนมัติ

เมื่อผ่าน Base Cases และ CONFLICTED checks แล้ว ระบบคำนวณ lateMinutes / earlyLeaveMinutes แล้ว return MATCHED พร้อม auto-penalty สำหรับ OT ที่ต่างกัน ≤ 30 นาที

```
มี daily + มี scan (≥ 2 ครั้ง) + สาย/ออกก่อน ≤ 30 นาที  →  MATCHED
```

#### Auto-Penalty Rule (≤ 30 นาที)
- สายช่วง OT เช้า → `approvedOtMorning` ถูกหักอัตโนมัติ (ปัดขึ้นทีละ 30 นาที)
- ออกก่อนช่วง OT เย็น → `approvedOtEvening` ถูกหักอัตโนมัติ (ปัดขึ้นทีละ 30 นาที)
- สาย/ออกก่อนในเวลาปกติ (08:00–17:00) → **ไม่ถือว่าขัดแย้ง** เพราะระบบ HR จัดการ penalty เอง

```typescript
// ตัวอย่าง: ออกก่อน OT เย็น 20 นาที (≤ 30 → MATCHED)
const penaltyMins = Math.ceil(20 / 30) * 30; // = 30 นาที
approvedOtEvening = Math.max(0, timesheetOtEvening - (30 / 60)); // หัก 0.5 ชม.
```

### 2.4 Flow Chart สรุป

```
มี scan?  ─No─→  มี daily? ─No─→  ABSENT / HOLIDAY / LEAVE
   │                 │Yes
   │              MISSING_SCAN
   │Yes
มี daily? ─No─→  MISSING_DAILY
   │Yes
dailyPunches valid? ─No─→  MISSING_DAILY
   │Yes
scan count < 2? ─Yes─→  CONFLICTED (กรณี B)
   │No
สาย หรือ ออกก่อน > 30 นาที? ─Yes─→  CONFLICTED (กรณี A)
   │No
MATCHED (+ auto-penalty ถ้าสาย/ออกก่อน ≤ 30 นาที ในช่วง OT)
```

---

## 3. โครงสร้าง Data (`ReconciliationRecord`)

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

**Rule ที่ถูกต้อง**:
- ค่าที่นำมาแสดงใน modal = **timesheet value** เสมอ (ไม่ใช่ approved)
- `approved` คือ "ที่อนุมัติแล้ว" → ใช้แสดงผลในส่วน "approved summary" เท่านั้น

```typescript
// ❌ ผิด — ถ้า approvedOtEvening = 0, ?? จะคืน 0 แทน timesheetOtEvening = 4
value: selectedRow?.approvedOtEvening ?? selectedRow?.timesheetOtEvening

// ✅ ถูก — ใช้ timesheet เป็นหลัก
value: selectedRow?.timesheetOtEvening ?? selectedRow?.approvedOtEvening
```

---

## 4. การแสดงผล Daily Report Reference Panel

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

### Dialog แสดงผลตาม Status

- `MISSING_DAILY` → แสดงแค่ TimeTable (ไม่มี Daily Report panel), `hideDailyReport = true`
- `CONFLICTED` + `MISSING_SCAN` ที่มี scan บางส่วน → แสดงปุ่ม **"แก้ไขเวลาสแกนนิ้ว"**
- `MISSING_SCAN` ที่ไม่มี scan เลย → แสดงปุ่ม **"ยืนยันตาม Daily Report"**
- อื่นๆ → แสดง Daily Report Reference Panel + TimeTable

```typescript
// ✅ เงื่อนไขปุ่ม action ที่ถูกต้อง
const hasSomeScan = (selectedRow?.scanPunches?.length ?? 0) > 0;
const canEditScan = status === 'CONFLICTED' || (status === 'MISSING_SCAN' && hasSomeScan);
const canFillFromDaily = status === 'MISSING_SCAN' && !hasSomeScan;
```

---

## 5. shiftTimes Format

| Field | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `shiftTimes.day` | `"08:00 - 17:00"` | ช่วงเวลาทำงานปกติ |
| `shiftTimes.otMorning` | `"06:00 - 08:00"` | OT ก่อนเข้า (อาจ undefined) |
| `shiftTimes.otNoon` | `"12:00 - 13:00"` | OT พักกลางวัน (อาจ undefined) |
| `shiftTimes.otEvening` | `"18:00 - 22:00"` | OT หลังเลิกงาน |

```typescript
// format: "HH:MM - HH:MM" (มีช่องว่างรอบ -)
const parts = rangeStr.split('-').map(s => s.trim());
```

---

## 6. scanPunches vs dailyReportPunches

- `dailyReportPunches`: backend รับประกัน sorted
- `scanPunches`: **ต้อง sort ฝั่ง frontend เสมอ** ก่อนใช้งาน

```typescript
// ✅ ถูกต้อง
const scanPunches = [...(selectedRow?.scanPunches || [])].sort(
  (a, b) => toMinutes(a) - toMinutes(b)
);
```

การ match punches ใน TimeTable → จับคู่โดย **position** (index) หลัง sort แล้วทั้งคู่

### leaveEntries.description formats

```
"Full Day"     → ลาทั้งวัน
"Morning"      → ลาช่วงเช้า
"Afternoon"    → ลาช่วงบ่าย
"HH:MM-HH:MM" → ลาช่วงเวลาระบุ → split ด้วย regex
```

```typescript
const TIME_RANGE_RE = /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/;
if (TIME_RANGE_RE.test(entry.description.trim())) {
  leavePunches.push(...entry.description.split('-').map((s: string) => s.trim()));
}
```

---

## 7. Manual Resolve

```typescript
// fields ที่ส่งไป backend
{ normalHours, otMorning, otNoon, otEvening, reason }

// initial values เมื่อเปิด dialog — ใช้ timesheet เสมอ ไม่ใช้ approved
manualHours = {
  normal:    row.timesheetNormalHours ?? row.dailyReportHours ?? 0,
  otMorning: row.timesheetOtMorning ?? 0,
  otNoon:    row.timesheetOtNoon ?? 0,
  otEvening: row.timesheetOtEvening ?? 0,
}
```

---

## 8. Optimistic UI (fillMutation)

เมื่อกด "ยืนยันตาม Daily Report":
1. **onMutate** → ลบแถวออกจาก list ทันที + อัปเดต Stats Card + ปิด Dialog
2. **onError** → rollback ข้อมูลกลับ
3. **onSettled** → invalidate queries (sync กับ backend)

> ⚠️ อย่าย้าย `setCheckDialogOpen(false)` ออกจาก onMutate มาไว้ใน onSuccess

---

## 9. Query Keys

```typescript
['reconciliation', { project, startDate, endDate, filterStatus, page, rowsPerPage }]
['reconciliation-stats']
['reconciliation-breakdown-stats']
```

> ⚠️ ทุก mutation ต้อง invalidate ทั้ง 3 keys

---

## 10. ไฟล์สำคัญ

### Backend
| ไฟล์ | หน้าที่ |
|---|---|
| `backend/src/services/reconciliation/ReconciliationService.ts` | Business logic หลัก — `classifyByPunchCoverage()` |
| `backend/src/routes/reconciliation.routes.ts` | Routes |
| `backend/src/controllers/reconciliationController.ts` | Controller |

### Frontend
| ไฟล์ | หน้าที่ |
|---|---|
| `frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx` | ตารางหลัก + modal รายละเอียด |
| `frontend/src/components/work-hour-monitoring/SummaryStats.tsx` | Summary cards |
| `frontend/src/components/work-hour-monitoring/AbnormalBreakdown.tsx` | Breakdown ผิดปกติ |
| `frontend/src/components/work-hour-monitoring/NormalBreakdown.tsx` | Breakdown ปกติ |
| `frontend/src/services/reconciliationService.ts` | API calls สำหรับ reconciliation |
| `frontend/src/services/scanDataService.ts` | API calls สำหรับ scan data |
| `frontend/src/constants/theme.ts` | RECON_COLORS, MIN_FONT_SIZE, STATUS_LABEL_MAP |

---

## 11. Changelog

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-05-12 | สร้างไฟล์ source of truth |
| 2026-05-12 | Fix bug: OT Evening ไม่แสดงในModal เพราะ `approvedOtEvening=0` บัง `timesheetOtEvening=4` |
| 2026-05-12 | เพิ่ม Section 2: เกณฑ์การกำหนดสถานะ CONFLICTED / MATCHED ฉบับสมบูรณ์ |
| 2026-05-12 | บันทึก bug: `classifyByPunchCoverage()` ไม่เคย return CONFLICTED — ต้องเพิ่ม logic กรณี A และ B |
| 2026-05-12 | กำหนด OT_CONFLICT_THRESHOLD = 30 นาที: เกินกว่านี้ → CONFLICTED, ไม่เกิน → MATCHED + auto-penalty |
| 2026-05-12 | กำหนด scan count < 2 → CONFLICTED (กรณี B) — scan 3 ครั้งที่ครอบช่วงเวลาได้ไม่ใช่ CONFLICTED |
| 2026-05-12 | ขยาย threshold ครอบคลุมทุกช่วงเวลา ไม่ใช่แค่ OT (สาย/ออกก่อน > 30 นาที → CONFLICTED เสมอ) |
| 2026-05-13 | เพิ่ม Implementation Note: ต้องตรวจ raw scanCount ก่อน makeEvenScanPunches() เสมอ ไม่งั้น scan 1 ครั้งจะกลายเป็น MISSING_SCAN แทน CONFLICTED |