# Implement Plan: Export ข้อมูลความผิดปกติสำหรับโฟร์แมน

> **วัตถุประสงค์ของเอกสารนี้**: สรุป business logic, การตัดสินใจ, และ spec ทั้งหมดที่ได้จากการออกแบบร่วมกัน
> ให้ AI ที่รับงานต่ออ่านแล้วเข้าใจบริบทได้ครบ และ implement ได้อย่างถูกต้องโดยไม่ต้องถามซ้ำ

---

## 1. บริบทและวัตถุประสงค์

ระบบ Work Hour Monitoring มีหน้า Admin ที่ใช้ตรวจสอบความผิดปกติของชั่วโมงทำงานพนักงาน
Admin ต้องการ export ข้อมูลความผิดปกติออกมาเพื่อ **ส่งให้โฟร์แมนตรวจสอบลูกน้องของตัวเอง**

### โฟร์แมนคือใคร

- โฟร์แมน **ไม่มีสิทธิ์เข้าระบบ** — รับข้อมูลผ่านกระดาษ print เท่านั้น
- โฟร์แมนต้องการรู้แค่: **ลูกน้องคนไหน / วันที่อะไร / ผิดปกติอย่างไร**
- โฟร์แมน **ไม่ต้องการ** ทราบชั่วโมงทำงาน, OT, หรือรายละเอียด scan

### สิ่งที่โฟร์แมนต้องดำเนินการหลัง print

| สถานะ | โฟร์แมนต้องทำ |
|---|---|
| ขาดงาน | เช็คกับลูกน้องและ Daily Report ว่าไม่มาจริงไหม |
| ไม่มี Daily Report | เช็คกับลูกน้องและส่ง Daily Report ย้อนหลัง |
| ข้อมูลขัดแย้ง (สาย/ออกก่อน) | ตามหาว่าช่วงเวลาที่หายไป พนักงานไปไหน ถ้าลาต้องแก้ Daily Report |
| ลาแต่มีสแกนนิ้ว | ตรวจสอบ Daily Report ว่าลงผิดวันหรือเปล่า |

---

## 2. สถานะที่ต้อง Export (เฉพาะสถานะที่โฟร์แมนรับผิดชอบ)

### สถานะที่รวมใน Export

| Status Code | ชื่อที่แสดง | มีเวลาเพิ่มไหม |
|---|---|---|
| `ABSENT` | ขาดงาน | ไม่มี |
| `MISSING_DAILY` | ไม่มี Daily Report | ไม่มี |
| `CONFLICTED` (เฉพาะ B1/B2) | ข้อมูลขัดแย้ง | มี (เวลา Daily Report vs สแกนจริง) |
| LEAVE + มีสแกน (C2) | ลาแต่มีสแกน | มี (บอกช่วงลา + เวลาสแกน) |

### สถานะที่ **ไม่รวม** ใน Export

| Status Code | เหตุผลที่ไม่รวม |
|---|---|
| `MATCHED` | ปกติ ไม่มีอะไรต้องทำ |
| `LEAVE` (ไม่มีสแกน) | ปกติ ไม่มีอะไรต้องทำ |
| `HOLIDAY` | ปกติ ไม่มีอะไรต้องทำ |
| `CONFLICTED` (ขาดสแกน) | Admin จัดการเองได้ผ่านรูปภาพยืนยันใน Daily Report |
| `MISSING_SCAN` | Admin จัดการเองได้ผ่านรูปภาพยืนยันใน Daily Report |
| `UNREGISTERED_EMPLOYEE` | เป็นหน้าที่ Admin ลงทะเบียนพนักงาน ไม่ใช่โฟร์แมน |

### การแยก CONFLICTED ที่ Export vs ไม่ Export

CONFLICTED ที่ **Export** (โฟร์แมนรับผิดชอบ):
- **B1**: สาย > 30 นาที ใน segment ใดก็ตาม — เช่น ขอ OT เช้า 06:00 แต่สแกนเข้า 06:45
- **B2**: ออกก่อน > 30 นาที ใน segment ใดก็ตาม — เช่น ขอ OT เย็นถึง 21:00 แต่สแกนออก 19:30

CONFLICTED ที่ **ไม่ Export** (Admin รับผิดชอบ):
- scan 1 ครั้ง (ไม่รู้เข้าหรือออก)
- มี scan แต่ขาด segment ใด segment หนึ่งไปเลย

**วิธีแยก B1/B2**: ตรวจจาก `lateMinutes > 30` หรือ `earlyLeaveMinutes > 30` บน record

---

## 3. โครงสร้าง CSV (Column Spec)

### Sheet 1 — สรุปความผิดปกติทั้งหมด

Sort order: **ชื่อโฟร์แมน ASC → วันที่ ASC**

| คอลัมน์ | Field ใน ReconciliationRecord | หมายเหตุ |
|---|---|---|
| โฟร์แมน | `assigneeName` | ชื่อโฟร์แมนที่รับผิดชอบพนักงานคนนั้น |
| ชื่อพนักงาน | `employeeName` | |
| รหัสพนักงาน | `employeeId` | กันสับสนกรณีชื่อซ้ำ |
| วันที่ | `workDate` | format: DD/MM/YYYY |
| สถานะ | `status` | แปลงเป็นภาษาไทย (ดู mapping ด้านล่าง) |
| เวลาตาม Daily Report | `shiftTimes.day` + OT | แสดงเฉพาะ CONFLICTED B1/B2 และ LEAVE+สแกน, ว่างสำหรับสถานะอื่น |
| เวลาสแกนจริง | `scanPunches` (first/last) | แสดงเฉพาะ CONFLICTED B1/B2 และ LEAVE+สแกน, ว่างสำหรับสถานะอื่น |
| หมายเหตุ | computed | แสดงเฉพาะ LEAVE+สแกน: "มีสแกนนิ้วในช่วงที่ลา" |

### Status Label Mapping (ภาษาไทย)

```typescript
const STATUS_LABEL_TH: Record<string, string> = {
  ABSENT: 'ขาดงาน',
  MISSING_DAILY: 'ไม่มี Daily Report',
  CONFLICTED: 'ข้อมูลขัดแย้ง',
  LEAVE_WITH_SCAN: 'ลาแต่มีสแกน', // computed case ไม่ใช่ status จริง
};
```

### การคำนวณคอลัมน์ "เวลาตาม Daily Report"

```typescript
// สำหรับ CONFLICTED B1/B2
// ดึงจาก shiftTimes และรวม OT ทั้งหมด
function getDailyReportTimeRange(record: ReconciliationRecord): string {
  const times: string[] = [];
  if (record.shiftTimes?.otMorning) times.push(record.shiftTimes.otMorning);
  if (record.shiftTimes?.day) times.push(record.shiftTimes.day);
  if (record.shiftTimes?.otEvening) times.push(record.shiftTimes.otEvening);
  // ดึง start จาก segment แรก และ end จาก segment สุดท้าย
  // format: "HH:MM–HH:MM"
  return times.length > 0 ? `${getStartTime(times)}–${getEndTime(times)}` : '';
}
```

### การคำนวณคอลัมน์ "เวลาสแกนจริง"

```typescript
// ดึง scan แรกสุดและสุดท้าย หลัง sort
function getScanTimeRange(record: ReconciliationRecord): string {
  const sorted = [...(record.scanPunches || [])].sort(
    (a, b) => toMinutes(a) - toMinutes(b)
  );
  if (sorted.length === 0) return '';
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}
```

---

## 4. Export Options (UI)

เพิ่ม modal/dialog เมื่อ Admin กดปุ่ม Export โดยให้เลือก:

```
[ Export ทั้งหมด (1 ไฟล์) ]
[ Export แยกตามโฟร์แมน (zip หลายไฟล์) ]
```

### Parameter ที่ส่งไป Backend

```typescript
interface ExportForemanParams {
  homeProjectId?: string;
  startDate?: string;
  endDate?: string;
  splitByForeman?: boolean; // true = แยก zip, false = 1 ไฟล์
}
```

### กรณี splitByForeman = true

- สร้าง Excel แยกไฟล์ต่อโฟร์แมน 1 คน
- ชื่อไฟล์: `รายงาน_[ชื่อโฟร์แมน]_[startDate]_[endDate].xlsx`
- zip รวมทุกไฟล์: `รายงานความผิดปกติ_[startDate]_[endDate].zip`

### กรณี splitByForeman = false

- ไฟล์เดียว sort ตามโฟร์แมน → วันที่
- ชื่อไฟล์: `รายงานความผิดปกติ_[startDate]_[endDate].xlsx`

---

## 5. โครงสร้าง Excel (xlsx)

### หน้าตาของไฟล์

**Header row** (freeze pane):
- สีพื้นหลัง: เทาเข้ม (#374151)
- สีตัวอักษร: ขาว
- font weight: bold

**Section header row** (คั่นระหว่างโฟร์แมน — เฉพาะกรณี 1 ไฟล์):
- แทรก row พิเศษ: "โฟร์แมน: [ชื่อ]"
- สีพื้นหลัง: เทาอ่อน (#F3F4F6)
- colspan ทั้งแถว

**Data rows**:
- สีสลับแถว: ขาว / เทาอ่อนมาก (#F9FAFB)
- สถานะแสดงเป็น text ภาษาไทย (ไม่ใช้ badge)

**Summary row** (ท้ายไฟล์หรือท้ายกลุ่มโฟร์แมน):
```
ขาดงาน: X | ไม่มี Daily Report: X | ข้อมูลขัดแย้ง: X | ลาแต่มีสแกน: X | รวม: X รายการ
```

**Legend row** (ท้ายสุด):
```
* ข้อมูลขัดแย้ง = มีเวลาทั้ง 2 ฝั่งให้ตรวจสอบ
* ลาแต่มีสแกน = ตรวจสอบ Daily Report ว่าลงผิดหรือเปล่า
* ขาดงาน / ไม่มี Daily Report = ตรวจสอบกับลูกน้องโดยตรง
```

---

## 6. Filter ที่รองรับ

Export รองรับ filter เดียวกับหน้า Monitoring:

| Filter | Parameter |
|---|---|
| โครงการ | `homeProjectId` |
| วันที่เริ่ม | `startDate` (YYYY-MM-DD) |
| วันที่สิ้นสุด | `endDate` (YYYY-MM-DD) |
| แยกตามโฟร์แมน | `splitByForeman` (boolean) |

**ไม่ต้องส่ง** `filterStatus` เพราะ export นี้กรองสถานะให้อัตโนมัติตาม spec ข้อ 2

---

## 7. Backend Implementation

### ไฟล์ที่ต้องแก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/routes/reconciliation.routes.ts` | เพิ่ม route `GET /reconciliation/export-foreman` |
| `backend/src/controllers/reconciliationController.ts` | เพิ่ม handler `exportForeman` |
| `backend/src/services/reconciliation/ReconciliationService.ts` | เพิ่ม method `generateForemanExport()` |

### Logic ใน generateForemanExport()

```typescript
async generateForemanExport(params: ExportForemanParams): Promise<Buffer | { files: {name: string, buffer: Buffer}[] }> {
  // 1. ดึง records ทั้งหมดตาม filter (ไม่ paginate)
  const allRecords = await this.getAllRecords({
    homeProjectId: params.homeProjectId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  // 2. กรองเฉพาะสถานะที่โฟร์แมนต้องรู้
  const filtered = allRecords.filter(r => shouldIncludeInForemanExport(r));

  // 3. sort: assigneeName ASC → workDate ASC
  filtered.sort((a, b) =>
    (a.assigneeName ?? '').localeCompare(b.assigneeName ?? '') ||
    a.workDate.localeCompare(b.workDate)
  );

  // 4. แปลง record → row
  const rows = filtered.map(r => toExportRow(r));

  // 5. สร้าง Excel
  if (params.splitByForeman) {
    return buildZipByForeman(rows);
  } else {
    return buildSingleExcel(rows);
  }
}
```

### ฟังก์ชัน shouldIncludeInForemanExport()

```typescript
function shouldIncludeInForemanExport(record: ReconciliationRecord): boolean {
  const { status, lateMinutes, earlyLeaveMinutes, hasLeave, scanPunches } = record;

  if (status === 'ABSENT') return true;
  if (status === 'MISSING_DAILY') return true;

  // CONFLICTED เฉพาะ B1/B2 (สาย/ออกก่อน > 30 นาที)
  if (status === 'CONFLICTED') {
    return (lateMinutes ?? 0) > 30 || (earlyLeaveMinutes ?? 0) > 30;
  }

  // LEAVE + มีสแกนนิ้ว (C2)
  if (status === 'LEAVE' && (scanPunches?.length ?? 0) > 0) return true;

  return false;
}
```

### ฟังก์ชัน toExportRow()

```typescript
function toExportRow(record: ReconciliationRecord): ExportRow {
  const isConflictedBB = record.status === 'CONFLICTED' &&
    ((record.lateMinutes ?? 0) > 30 || (record.earlyLeaveMinutes ?? 0) > 30);
  const isLeaveWithScan = record.status === 'LEAVE' &&
    (record.scanPunches?.length ?? 0) > 0;

  const showTime = isConflictedBB || isLeaveWithScan;

  return {
    foreman: record.assigneeName ?? '',
    employeeName: record.employeeName ?? '',
    employeeId: record.employeeId,
    workDate: formatDate(record.workDate), // DD/MM/YYYY
    status: getStatusLabelTH(record),
    dailyReportTime: showTime ? getDailyReportTimeRange(record) : '',
    scanTime: showTime ? getScanTimeRange(record) : '',
    note: isLeaveWithScan ? 'มีสแกนนิ้วในช่วงที่ลา — ตรวจสอบ Daily Report' : '',
  };
}
```

---

## 8. Frontend Implementation

### ไฟล์ที่ต้องแก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `frontend/src/services/reconciliationService.ts` | เพิ่ม method `exportForemanReport()` |
| `frontend/src/pages/work-hour-monitoring/index.tsx` | เพิ่ม export dialog + handler |

### เพิ่มใน reconciliationService.ts

```typescript
exportForemanReport: async (params: {
  homeProjectId?: string;
  startDate?: string;
  endDate?: string;
  splitByForeman?: boolean;
}): Promise<Blob> => {
  const response = await apiClient.get('/reconciliation/export-foreman', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
},
```

### Export Dialog (index.tsx)

เพิ่มปุ่ม "Export สำหรับโฟร์แมน" แยกจากปุ่ม Export เดิม
เมื่อกดเปิด Dialog ให้เลือก:

```tsx
<Dialog open={exportDialogOpen}>
  <DialogTitle>Export รายงานสำหรับโฟร์แมน</DialogTitle>
  <DialogContent>
    <RadioGroup value={splitMode} onChange={setSplitMode}>
      <FormControlLabel value="single" label="ไฟล์เดียว (ทุกโฟร์แมนรวมกัน)" />
      <FormControlLabel value="split" label="แยกไฟล์ตามโฟร์แมน (zip)" />
    </RadioGroup>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleForemanExport}>Export</Button>
  </DialogActions>
</Dialog>
```

---

## 9. ข้อควรระวัง

### เรื่อง scanPunches

- `scanPunches` **ต้อง sort ฝั่ง frontend/service ก่อนใช้เสมอ** — backend ไม่รับประกัน sort
- ใช้: `[...record.scanPunches].sort((a, b) => toMinutes(a) - toMinutes(b))`

### เรื่อง assigneeName

- ถ้า `assigneeName` เป็น null/undefined ให้แสดงเป็น "ไม่ระบุโฟร์แมน" และจัดกลุ่มไว้ด้านล่างสุด

### เรื่อง CONFLICTED classification

- อย่าใช้ `timesheetOtNoon` หรือ `timesheetOtMorning` มาตัดสินว่ามี segment ไหนบ้าง
- ใช้ `shiftTimes` จาก Daily Report เท่านั้น (ตาม source of truth .md)

### เรื่อง lateMinutes / earlyLeaveMinutes

- ถ้า field เหล่านี้ยังไม่ถูก populate โดย backend ใน CONFLICTED records ต้องแจ้ง backend team ให้เพิ่มก่อน
- ตรวจสอบว่า `classifyBySegments()` เขียน `lateMinutes` และ `earlyLeaveMinutes` ลง record จริง

---

## 10. Changelog

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-05-19 | สร้าง implement plan จากการออกแบบร่วมกัน |