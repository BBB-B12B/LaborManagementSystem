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

## 2. เกณฑ์การกำหนดสถานะ (`classifyBySegments`)

> ⚠️ **BREAKING CHANGE (2026-05-15)**: เปลี่ยน logic จาก "ครอบช่วงเวลา" เป็น "ต้องมีสแกนครบทุก segment"
> ฟังก์ชันเปลี่ยนชื่อจาก `classifyByPunchCoverage()` เป็น `classifyBySegments()`
> **ห้ามเปลี่ยน logic นี้โดยไม่อัปเดตเอกสารนี้พร้อมกัน**

### 2.1 หลักการ: Daily Report คือ Source of Truth

ระบบสร้าง **expected segments** จาก Daily Report ก่อน แล้วตรวจว่า scan ครอบแต่ละ segment ครบไหม

- ไม่ยกเว้นวันหยุดบริษัทหรือวันอาทิตย์
- ถ้าโฟร์แมนส่ง Daily Report วันไหน = วันนั้นมีงาน ระบบเช็คตามปกติทุกกรณี

### 2.2 การสร้าง Expected Segments จาก Daily Report

แต่ละ segment = IN punch + OUT punch 1 คู่

#### กรณีปกติ (ไม่มี OT พิเศษ)

```
[OT เช้า: otStart→normalStart]  (ถ้ามี otMorning)
[เช้า:    normalStart→12:00  ]
[บ่าย:    13:00→normalEnd    ]
[OT เย็น: otEveningStart→otEveningEnd]  (ถ้ามี otEvening)

ตัวอย่าง: OT เช้า 06:00-08:00 + ปกติ 08:00-17:00 + OT เย็น 18:00-21:00
→ segments: [06:00→08:00] [08:00→12:00] [13:00→17:00] [18:00→21:00]
→ expect 8 punch
```

#### กรณีพิเศษ 1: OT ผ่าเที่ยง (`otNoon > 0`)

รวม segment เช้า+บ่ายเป็นอันเดียว ไม่มีสแกนช่วง 12:00-13:00

```
[OT เช้า: otStart→normalStart]  (ถ้ามี)
[ปกติ:    normalStart→normalEnd]   ← รวมเช้า+บ่าย ไม่หยุดพัก
[OT เย็น: otEveningStart→otEveningEnd]  (ถ้ามี)

ตัวอย่าง: OT เช้า 06:00-08:00 + ปกติ 08:00-17:00 + OT เที่ยง + OT เย็น 18:00-21:00
→ segments: [06:00→08:00] [08:00→17:00] [18:00→21:00]
→ expect 6 punch
```

#### กรณีพิเศษ 2: OT ผ่าเย็น (`otEvening.start == normalEnd`)

รวม segment บ่าย+OT เย็นเป็นอันเดียว ไม่มีสแกนช่วง 17:00-18:00

```
[OT เช้า: otStart→normalStart]  (ถ้ามี)
[เช้า:    normalStart→12:00]
[บ่าย+OT เย็น: 13:00→otEveningEnd]   ← รวมบ่าย+OT เย็น ไม่มีพัก 17-18

ตัวอย่าง: OT เช้า 06:00-08:00 + ปกติ 08:00-17:00 + OT เย็น 17:00-21:00
→ segments: [06:00→08:00] [08:00→12:00] [13:00→21:00]
→ expect 6 punch
```

> ⚠️ **ข้อห้าม**: OT ผ่าเที่ยง + OT ผ่าเย็นในวันเดียวกันทำไม่ได้

### 2.3 Base Cases (ตรวจก่อนทุกอย่าง)

```
ไม่มี daily AND ไม่มี scan  →  ABSENT (สร้างโดย Scheduled Job ไม่ใช่ที่นี่)
ไม่มี daily AND มี scan     →  MISSING_DAILY
มี daily AND scan = 0 ครั้ง →  MISSING_SCAN
มี daily AND scan = 1 ครั้ง →  CONFLICTED (มีบางส่วนแต่ไม่รู้เข้าหรือออก)
ไม่มี dailyReportPunches   →  MISSING_DAILY (daily ไม่มีข้อมูลช่วงเวลา)
```

> ⚠️ **Implementation Note**: ตรวจ `scanCount` จาก raw `scanPunches` ก่อน **เสมอ** ก่อนเรียก `makeEvenScanPunches()`
> เพราะ `makeEvenScanPunches([x])` คืน `[]` → scan 1 ครั้งจะกลายเป็น `MISSING_SCAN` แทน `CONFLICTED`

### 2.4 การเช็ค Segment (หลัง Base Cases)

เช็คทีละ segment เทียบกับ scan punches ที่มี:

```
สำหรับแต่ละ expected segment:
  หา scan IN ที่ใกล้เคียง segmentStart ± 30 นาที
  หา scan OUT ที่ใกล้เคียง segmentEnd ± 30 นาที

  ถ้าหาไม่ได้ทั้ง IN หรือ OUT → CONFLICTED (ขาด segment นี้)
  ถ้าหาได้แต่ต่างกัน > 30 นาที → CONFLICTED (สาย/ออกก่อนเกิน threshold)
  ถ้าหาได้และต่างกัน ≤ 30 นาที → segment นี้ผ่าน (บันทึก lateMinutes/earlyLeaveMinutes)

ถ้าทุก segment ผ่าน → MATCHED
```

### 2.5 สถานะและเงื่อนไข

| สถานการณ์ | สถานะ | Admin ทำอะไร |
|---|---|---|
| สแกนครบทุก segment ± 30 นาที | `MATCHED` | — |
| ไม่มีสแกนเลย (0 ครั้ง) | `MISSING_SCAN` | กด "ยืนยันตาม Daily Report" |
| มีสแกน 1 ครั้ง | `CONFLICTED` | เปิด Modal เติมสแกนที่ขาด |
| มีสแกน แต่ขาด segment ใดก็ตาม | `CONFLICTED` | เปิด Modal เติมสแกนที่ขาด |
| สาย/ออกก่อน > 30 นาที ใน segment ใดก็ตาม | `CONFLICTED` | แจ้งโฟร์แมนแก้ Daily Report |
| ไม่มี Daily Report แต่มีสแกน | `MISSING_DAILY` | รอโฟร์แมนส่งรายงาน |

### 2.6 Auto-Penalty Rule (≤ 30 นาที — เฉพาะ MATCHED)

เมื่อทุก segment ผ่าน แต่มีบาง segment ที่สาย/ออกก่อนเล็กน้อย:
- ต่างกัน ≤ 30 นาที → MATCHED + หัก approved hours อัตโนมัติ (ปัดขึ้นทีละ 30 นาที)
- เวลาปกติ (ไม่ใช่ OT) → ไม่หัก เพราะระบบ HR จัดการ penalty เอง

### 2.7 Flow Chart สรุป

```
มี daily? ─No─→  มี scan? ─No─→  (ไม่สร้าง record — ABSENT จัดการโดย Scheduled Job)
   │                  │Yes
   │              MISSING_DAILY
   │Yes
dailyPunches valid? ─No─→  MISSING_DAILY
   │Yes
scan = 0 ครั้ง? ─Yes─→  MISSING_SCAN
   │No
scan = 1 ครั้ง? ─Yes─→  CONFLICTED
   │No
สร้าง expected segments จาก daily report
   │
   ├── ผ่าเที่ยง? (otNoon > 0)            → รวม segment เช้า+บ่าย
   ├── ผ่าเย็น? (otEvening.start=normalEnd) → รวม segment บ่าย+OT เย็น
   │
เช็คทีละ segment vs scan punches
   │
มี segment ที่ขาด หรือ > 30 นาที? ─Yes─→  CONFLICTED
   │No
MATCHED (+ auto-penalty ถ้ามี segment ที่ต่างกัน ≤ 30 นาที ในช่วง OT)
```

---

## 2.8 ABSENT — Scheduled Job (แยกออกจาก Reconciliation ปกติ)

> ABSENT **ไม่ได้สร้างจาก** `classifyBySegments()` แต่สร้างจาก Cloud Function แยกต่างหาก

### หลักการ

| | รายละเอียด |
|---|---|
| Trigger | Cloud Function Scheduled — รันทุกวัน เวลาเที่ยงคืน |
| ตรวจย้อนหลัง | 1 วัน (เที่ยงคืนวันที่ 16 = ตรวจวันที่ 15) |
| เหตุผลที่รอเที่ยงคืน | โฟร์แมนลง Daily Report ได้ถึงคืนวันนั้นหรือเช้าวันถัดไป ต้องรอให้ข้อมูลครบก่อน |

### Logic

```
เที่ยงคืนวันที่ N+1:
→ ดึง active employees ทุกคน (isActive: true)
→ เทียบกับ ReconciliationRecords ของวันที่ N
→ ใครไม่มี record เลย → สร้าง ABSENT record
→ write เฉพาะคนที่ขาดจริง (ไม่ใช่ทุกคน)
```

### Re-classify อัตโนมัติ

ถ้าโฟร์แมนลง Daily Report สาย (เช่น ลงวันที่ 17 สำหรับวันที่ 15):
- ระบบ re-classify ABSENT → สถานะที่ถูกต้องอัตโนมัติ
- Admin ไม่ต้อง manual resolve

### สิ่งที่ Admin ทำได้

Admin เห็น ABSENT แล้วตัดสินใจเองว่าจะตามโฟร์แมนให้ลง Daily Report ไหม ระบบไม่บังคับ เพราะถ้าไม่มี Daily Report admin ก็ไม่สามารถแก้ไขได้ด้วยตัวเองอยู่แล้ว

---

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
| 2026-05-15 | **BREAKING CHANGE**: เปลี่ยน logic จาก "ครอบช่วงเวลา" เป็น "ต้องมีสแกนครบทุก segment" |
| 2026-05-15 | เปลี่ยนชื่อฟังก์ชัน `classifyByPunchCoverage()` → `classifyBySegments()` |
| 2026-05-15 | เพิ่ม segment rules: ปกติ / ผ่าเที่ยง / ผ่าเย็น พร้อม expected punch count แต่ละกรณี |
| 2026-05-15 | ไม่ยกเว้นวันหยุดบริษัทหรือวันอาทิตย์ — เช็คทุกวันที่โฟร์แมนส่ง Daily Report |
| 2026-05-15 | เพิ่ม Section 2.8: ABSENT Scheduled Job — รันเที่ยงคืนทุกวัน เช็คย้อนหลัง 1 วัน |
| 2026-05-15 | ABSENT ไม่สร้างจาก classifyBySegments() อีกต่อไป แยกเป็น Scheduled Job ต่างหาก |