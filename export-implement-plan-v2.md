# แผนการดำเนินงาน: ระบบ Export รายงานสำหรับโฟร์แมน (Foreman Report Export System) v2

> **วัตถุประสงค์ของเอกสารนี้**: สรุป business logic, การตัดสินใจ, และ spec ทั้งหมดที่ได้จากการออกแบบร่วมกัน
> ให้ AI ที่รับงานต่ออ่านแล้วเข้าใจบริบทได้ครบ และ implement ได้อย่างถูกต้องโดยไม่ต้องถามซ้ำ
>
> **v2 เปลี่ยนแปลงจาก v1**:
> - Admin เลือกสถานะที่จะ export ได้เองผ่าน checkbox (ไม่ filter ตายตัวในระบบ)
> - เพิ่ม `MISSING_SCAN` เป็นตัวเลือก checkbox
> - default tick คือ 4 สถานะที่โฟร์แมนควรรู้ตาม recommended

---

## 1. บริบทและวัตถุประสงค์

ระบบ Work Hour Monitoring มีหน้า Admin ที่ใช้ตรวจสอบความผิดปกติของชั่วโมงทำงานพนักงาน
Admin ต้องการ export ข้อมูลความผิดปกติออกมาเพื่อ **ส่งให้โฟร์แมนตรวจสอบลูกน้องของตัวเอง**

### โฟร์แมนคือใคร

- โฟร์แมน **ไม่มีสิทธิ์เข้าระบบ** — รับข้อมูลผ่านกระดาษ print เท่านั้น
- โฟร์แมนต้องการรู้แค่: **ลูกน้องคนไหน / วันที่อะไร / ผิดปกติอย่างไร**
- โฟร์แมน **ไม่ต้องการ** ทราบชั่วโมงทำงาน, OT, หรือรายละเอียด scan

### หลักการ export (v2)

**Admin เป็นคนตัดสินใจเองว่าจะให้โฟร์แมนเห็นอะไร** เพราะ Admin รู้บริบทของโครงการตัวเองดีที่สุด
- บางโครงการ Admin จัดการ CONFLICTED จากสแกนเองหมดก่อนแล้วค่อย export
- บางโครงการอยากให้โฟร์แมนช่วยดูทุกอย่าง
- ระบบไม่บังคับ filter ตายตัว แต่มี **recommended default** ให้

---

## 2. สถานะทั้งหมดที่เป็นตัวเลือก Export

### Checkbox ใน Export Dialog

| สถานะ | ชื่อที่แสดง | Default | เหตุผล default |
|---|---|---|---|
| `ABSENT` | ขาดงาน | ☑ ติ๊ก | โฟร์แมนต้องเช็คกับลูกน้องโดยตรง |
| `MISSING_DAILY` | ไม่มี Daily Report | ☑ ติ๊ก | โฟร์แมนต้องส่ง Daily Report ย้อนหลัง |
| `CONFLICTED` (B1/B2) | ข้อมูลขัดแย้ง | ☑ ติ๊ก | โฟร์แมนต้องตามหาว่าช่วงที่หายไปพนักงานไปไหน |
| `LEAVE` + มีสแกนทับ | ลาแต่มีสแกน | ☑ ติ๊ก | โฟร์แมนต้องตรวจสอบ Daily Report ว่าลงผิดหรือเปล่า |
| `MISSING_SCAN` | ไม่มีสแกนนิ้ว | ☐ ไม่ติ๊ก | Admin จัดการเองได้ แต่เปิดได้ถ้าอยากให้โฟร์แมนเห็นพฤติกรรมลูกน้อง |
| `MATCHED` | ปกติ | ☐ ไม่ติ๊ก | ไม่มีอะไรต้องทำ |
| `LEAVE` (ไม่มีสแกนทับ) | ลา | ☐ ไม่ติ๊ก | ไม่มีอะไรต้องทำ |
| `HOLIDAY` | วันหยุด | ☐ ไม่ติ๊ก | ไม่มีอะไรต้องทำ |

> **หมายเหตุ `UNREGISTERED_EMPLOYEE`**: ไม่รวมในตัวเลือก เพราะเป็นหน้าที่ Admin ลงทะเบียนพนักงาน ไม่เกี่ยวกับโฟร์แมน

### การแยก CONFLICTED B1/B2 vs CONFLICTED อื่น

CONFLICTED ที่แสดงใน checkbox "ข้อมูลขัดแย้ง" คือเฉพาะ **B1/B2 เท่านั้น**:
- **B1**: `lateMinutes > 30` — สายเกิน 30 นาทีใน segment ใดก็ตาม
- **B2**: `earlyLeaveMinutes > 30` — ออกก่อนเกิน 30 นาทีใน segment ใดก็ตาม

CONFLICTED ที่ **ไม่รวม** (Admin จัดการเองได้ผ่านรูปภาพยืนยัน):
- scan 1 ครั้ง (ไม่รู้เข้าหรือออก)
- มี scan แต่ขาด segment ใด segment หนึ่งไปเลย

```typescript
function isConflictedForForeman(record: ReconciliationRecord): boolean {
  return record.status === 'CONFLICTED' &&
    ((record.lateMinutes ?? 0) > 30 || (record.earlyLeaveMinutes ?? 0) > 30);
}
```

### การตรวจ LEAVE + มีสแกนทับ (C2)

ตรวจว่า scan punch ใดๆ **ตกในช่วงเวลาที่ลาจริง** ไม่ใช่แค่มีสแกนในวันนั้น
เพราะพนักงานที่ลาครึ่งเช้าแต่สแกนช่วงบ่าย = ปกติ ไม่ใช่ความผิดปกติ

```typescript
function hasLeaveOverlapWithScan(record: ReconciliationRecord): boolean {
  for (const leave of record.leaveEntries ?? []) {
    const leaveRange = parseLeaveRange(leave.description);
    // "Full Day" / "Morning" / "Afternoon" / "HH:MM-HH:MM"
    for (const punch of record.scanPunches ?? []) {
      if (isInRange(toMinutes(punch), leaveRange)) return true;
    }
  }
  return false;
}

// leaveEntries.description formats (จาก source of truth .md):
// "Full Day"     → ลาทั้งวัน (00:00–23:59)
// "Morning"      → ลาช่วงเช้า (00:00–12:00)
// "Afternoon"    → ลาช่วงบ่าย (12:00–23:59)
// "HH:MM-HH:MM" → ลาช่วงเวลาระบุ → split ด้วย regex
const TIME_RANGE_RE = /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/;
```

---

## 3. โครงสร้าง CSV/Excel (Column Spec)

### คอลัมน์ทั้งหมด

Sort order: **ชื่อโฟร์แมน ASC → วันที่ ASC** (assigneeName = null/undefined → จัดไว้ล่างสุดในกลุ่ม "ไม่ระบุโฟร์แมน")

| # | คอลัมน์ | Field | หมายเหตุ |
|---|---|---|---|
| 1 | โฟร์แมน | `assigneeName` | null → "ไม่ระบุโฟร์แมน" |
| 2 | ชื่อพนักงาน | `employeeName` | |
| 3 | รหัสพนักงาน | `employeeId` | กันสับสนกรณีชื่อซ้ำ |
| 4 | วันที่ | `workDate` | format: DD/MM/YYYY |
| 5 | สถานะ | computed | ภาษาไทย (ดู mapping ด้านล่าง) |
| 6 | เวลาตาม Daily Report | computed | แสดงเฉพาะ CONFLICTED B1/B2 และ LEAVE+สแกน |
| 7 | เวลาสแกนจริง | computed | แสดงเฉพาะ CONFLICTED B1/B2 และ LEAVE+สแกน |
| 8 | หมายเหตุ | computed | แสดงเฉพาะ LEAVE+สแกน: "มีสแกนนิ้วในช่วงที่ลา — ตรวจสอบ Daily Report" |

### Status Label Mapping (ภาษาไทย)

```typescript
function getStatusLabelTH(record: ReconciliationRecord): string {
  if (record.status === 'ABSENT') return 'ขาดงาน';
  if (record.status === 'MISSING_DAILY') return 'ไม่มี Daily Report';
  if (record.status === 'MISSING_SCAN') return 'ไม่มีสแกนนิ้ว';
  if (record.status === 'MATCHED') return 'ปกติ';
  if (record.status === 'LEAVE') {
    return hasLeaveOverlapWithScan(record) ? 'ลาแต่มีสแกน' : 'ลา';
  }
  if (record.status === 'CONFLICTED') return 'ข้อมูลขัดแย้ง';
  if (record.status === 'HOLIDAY') return 'วันหยุด';
  return record.status;
}
```

### การคำนวณคอลัมน์เวลา

```typescript
// เวลาตาม Daily Report — ดึงช่วงรวมจาก shiftTimes
// ⚠️ ใช้ shiftTimes เท่านั้น ห้ามใช้ timesheetOtMorning/Noon/Evening (มาจาก scan aggregator)
function getDailyReportTimeRange(record: ReconciliationRecord): string {
  const parts: string[] = [];
  if (record.shiftTimes?.otMorning) parts.push(record.shiftTimes.otMorning);
  if (record.shiftTimes?.day) parts.push(record.shiftTimes.day);
  if (record.shiftTimes?.otEvening) parts.push(record.shiftTimes.otEvening);
  if (parts.length === 0) return '';
  const start = parts[0].split(/\s*-\s*/)[0].trim();
  const end = parts[parts.length - 1].split(/\s*-\s*/)[1].trim();
  return `${start}–${end}`;
}

// เวลาสแกนจริง — scan แรกสุดและสุดท้าย
// ⚠️ ต้อง sort scanPunches ก่อนเสมอ (backend ไม่รับประกัน sort)
function getScanTimeRange(record: ReconciliationRecord): string {
  const sorted = [...(record.scanPunches ?? [])].sort(
    (a, b) => toMinutes(a) - toMinutes(b)
  );
  if (sorted.length === 0) return '';
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}
```

---

## 4. Export Options (UI — Export Dialog)

เมื่อ Admin กดปุ่ม "Export สำหรับโฟร์แมน" เปิด Dialog ที่มี 3 ส่วน:

### ส่วนที่ 1 — เลือกสถานะที่จะรวมใน Export

```
สถานะที่จะ Export (เลือกได้หลายรายการ)

☑ ขาดงาน
☑ ไม่มี Daily Report
☑ ข้อมูลขัดแย้ง (สาย/ออกก่อนเกิน 30 นาที)
☑ ลาแต่มีสแกนนิ้ว
☐ ไม่มีสแกนนิ้ว
☐ ปกติ
☐ ลา
```

### ส่วนที่ 2 — รูปแบบไฟล์

```
( ) ไฟล์เดียว — ทุกโฟร์แมนรวมกัน (.xlsx)
( ) แยกไฟล์ตามโฟร์แมน — บีบอัดเป็น ZIP (.zip)
```

### ส่วนที่ 3 — ปุ่ม Action

```
[ ยกเลิก ]  [ Export ]
```

---

## 5. Parameter ที่ส่งไป Backend

```typescript
interface ExportForemanParams {
  homeProjectId?: string;
  startDate?: string;           // YYYY-MM-DD
  endDate?: string;             // YYYY-MM-DD
  splitByForeman?: boolean;     // true = zip แยกโฟร์แมน, false = 1 ไฟล์
  includeStatuses: string[];    // สถานะที่ Admin เลือก เช่น ['ABSENT', 'MISSING_DAILY', 'CONFLICTED', 'LEAVE_WITH_SCAN']
}

// หมายเหตุ: 'LEAVE_WITH_SCAN' คือ computed status ไม่ใช่ ReconciliationStatus จริง
// backend ต้องแปลงเป็น LEAVE + hasLeaveOverlapWithScan() === true เอง
```

---

## 6. Backend Implementation

### ไฟล์ที่ต้องแก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/package.json` | เพิ่ม `exceljs`, `archiver`, `@types/archiver` |
| `backend/src/routes/reconciliation.routes.ts` | เพิ่ม `GET /reconciliation/export-foreman` |
| `backend/src/controllers/reconciliationController.ts` | เพิ่ม handler `exportForemanReport` |
| `backend/src/services/reconciliation/ReconciliationService.ts` | เพิ่ม `generateForemanExport()`, `shouldInclude()`, helper functions |

### Logic หลัก

```typescript
async generateForemanExport(params: ExportForemanParams): Promise<Buffer | ZipResult> {

  // 1. ดึง records ทั้งหมดตาม filter (ไม่ paginate)
  const allRecords = await this.getAllRecords({
    homeProjectId: params.homeProjectId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  // 2. กรองตาม includeStatuses ที่ Admin เลือก
  const filtered = allRecords.filter(r => shouldInclude(r, params.includeStatuses));

  // 3. sort: assigneeName ASC (null ไว้ท้าย) → workDate ASC
  filtered.sort((a, b) => {
    const nameA = a.assigneeName ?? '\uFFFF'; // null → sort ท้ายสุด
    const nameB = b.assigneeName ?? '\uFFFF';
    return nameA.localeCompare(nameB, 'th') || a.workDate.localeCompare(b.workDate);
  });

  // 4. สร้าง Excel
  if (params.splitByForeman) {
    return buildZipByForeman(filtered, params);
  } else {
    return buildSingleExcel(filtered, params);
  }
}
```

### ฟังก์ชัน shouldInclude()

```typescript
function shouldInclude(record: ReconciliationRecord, includeStatuses: string[]): boolean {
  // ABSENT
  if (includeStatuses.includes('ABSENT') && record.status === 'ABSENT') return true;

  // MISSING_DAILY
  if (includeStatuses.includes('MISSING_DAILY') && record.status === 'MISSING_DAILY') return true;

  // MISSING_SCAN
  if (includeStatuses.includes('MISSING_SCAN') && record.status === 'MISSING_SCAN') return true;

  // MATCHED
  if (includeStatuses.includes('MATCHED') && record.status === 'MATCHED') return true;

  // HOLIDAY
  if (includeStatuses.includes('HOLIDAY') && record.status === 'HOLIDAY') return true;

  // CONFLICTED — เฉพาะ B1/B2 (สาย/ออกก่อน > 30 นาที)
  if (includeStatuses.includes('CONFLICTED') && record.status === 'CONFLICTED') {
    return (record.lateMinutes ?? 0) > 30 || (record.earlyLeaveMinutes ?? 0) > 30;
  }

  // LEAVE_WITH_SCAN — ลาแต่มีสแกนทับช่วงที่ลา
  if (includeStatuses.includes('LEAVE_WITH_SCAN') && record.status === 'LEAVE') {
    return hasLeaveOverlapWithScan(record);
  }

  // LEAVE ปกติ (ไม่มีสแกนทับ)
  if (includeStatuses.includes('LEAVE') && record.status === 'LEAVE') {
    return !hasLeaveOverlapWithScan(record);
  }

  return false;
}
```

### Excel Styling

```
แถว Header:    พื้นหลัง #374151, ตัวอักษรขาว, ตัวหนา, Freeze Pane แถวที่ 1
แถว Section:   "โฟร์แมน: [ชื่อ]" — Merge 8 คอลัมน์, พื้นหลัง #F3F4F6, ตัวหนา
แถวข้อมูล:    Zebra striping — ขาว / #F9FAFB สลับกัน
แถว Summary:   ท้ายกลุ่มโฟร์แมน — สรุปจำนวนแยกตามประเภท
แถว Legend:    ท้ายสุด — อธิบายความหมายแต่ละสถานะ 1 บรรทัด
```

### Controller

```typescript
async exportForemanReport(req: Request, res: Response) {
  const { homeProjectId, startDate, endDate, splitByForeman, includeStatuses } = req.query;

  const result = await reconciliationService.generateForemanExport({
    homeProjectId: homeProjectId as string,
    startDate: startDate as string,
    endDate: endDate as string,
    splitByForeman: splitByForeman === 'true',
    includeStatuses: JSON.parse(includeStatuses as string), // array
  });

  const dateRange = `${startDate}_${endDate}`;

  if (splitByForeman === 'true') {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="รายงานความผิดปกติ_${dateRange}.zip"`);
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="รายงานความผิดปกติ_${dateRange}.xlsx"`);
  }

  res.send(result);
}
```

---

## 7. Frontend Implementation

### ไฟล์ที่ต้องแก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `frontend/src/services/reconciliationService.ts` | เพิ่ม `exportForemanReport()` |
| `frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx` | เพิ่มปุ่ม "Export สำหรับโฟร์แมน" |
| `frontend/src/pages/work-hour-monitoring/index.tsx` | เพิ่ม state + Export Dialog |

### reconciliationService.ts

```typescript
exportForemanReport: async (params: {
  homeProjectId?: string;
  startDate?: string;
  endDate?: string;
  splitByForeman?: boolean;
  includeStatuses: string[];
}): Promise<Blob> => {
  const response = await apiClient.get('/reconciliation/export-foreman', {
    params: {
      ...params,
      includeStatuses: JSON.stringify(params.includeStatuses),
    },
    responseType: 'blob',
  });
  return response.data as Blob;
},
```

### Export Dialog State (index.tsx)

```typescript
const DEFAULT_INCLUDE_STATUSES = ['ABSENT', 'MISSING_DAILY', 'CONFLICTED', 'LEAVE_WITH_SCAN'];

const [foremanExportOpen, setForemanExportOpen] = useState(false);
const [includeStatuses, setIncludeStatuses] = useState<string[]>(DEFAULT_INCLUDE_STATUSES);
const [splitByForeman, setSplitByForeman] = useState(false);
const [isExportingForeman, setIsExportingForeman] = useState(false);

const handleForemanExport = async () => {
  setIsExportingForeman(true);
  try {
    const blob = await reconciliationService.exportForemanReport({
      homeProjectId: project !== 'all' ? project : undefined,
      startDate: startDate?.toISOString().split('T')[0],
      endDate: endDate?.toISOString().split('T')[0],
      splitByForeman,
      includeStatuses,
    });
    const filename = splitByForeman
      ? `รายงานความผิดปกติ_${startDate}_${endDate}.zip`
      : `รายงานความผิดปกติ_${startDate}_${endDate}.xlsx`;
    reconciliationService.downloadExcelFile(blob, filename);
    toast.success('Export สำเร็จ');
  } catch (error: any) {
    toast.error(error.message || 'Export ล้มเหลว');
  } finally {
    setIsExportingForeman(false);
    setForemanExportOpen(false);
  }
};
```

---

## 8. ข้อควรระวัง

### lateMinutes / earlyLeaveMinutes

ตรวจสอบก่อน implement ว่า `classifyBySegments()` เขียน field เหล่านี้ลง Firestore จริง
ถ้ายังไม่มี ต้องแก้ให้เพิ่ม default value ใน `mergeAndClassify` กรณีสร้าง record ใหม่:

```typescript
lateMinutes: classified.lateMinutes ?? 0,
earlyLeaveMinutes: classified.earlyLeaveMinutes ?? 0,
isLate: classified.isLate ?? false,
isEarlyLeave: classified.isEarlyLeave ?? false,
```

### scanPunches

ต้อง sort ก่อนใช้เสมอ — backend ไม่รับประกัน sort:

```typescript
const sorted = [...(record.scanPunches ?? [])].sort(
  (a, b) => toMinutes(a) - toMinutes(b)
);
```

### shiftTimes

ใช้ `shiftTimes` จาก Daily Report เท่านั้นในการคำนวณเวลา Daily Report
ห้ามใช้ `timesheetOtMorning`, `timesheetOtNoon`, `timesheetOtEvening` — field เหล่านี้มาจาก scan aggregator

### assigneeName = null

จัดกลุ่มไว้ล่างสุดภายใต้ชื่อ "ไม่ระบุโฟร์แมน" ทั้งใน single file และ zip
กรณี zip ให้สร้างไฟล์ชื่อ `รายงาน_ไม่ระบุโฟร์แมน_[startDate]_[endDate].xlsx`

---

## 9. แผนการทดสอบ

### Automated

1. `npm run lint` — backend และ frontend
2. `npm run type-check` — ตรวจ TypeScript ทั้งสองฝั่ง
3. `npm run build` — ทดสอบ build ก่อน deploy

### Manual Testing

| กรณีทดสอบ | ผลที่คาดหวัง |
|---|---|
| ลาเต็มวัน + มีสแกน | แสดงเป็น "ลาแต่มีสแกน" |
| ลาครึ่งเช้า + สแกนช่วงบ่าย | **ไม่แสดง** (สแกนไม่ทับช่วงลา) |
| ลาครึ่งเช้า + สแกนตอน 09:30 | แสดงเป็น "ลาแต่มีสแกน" |
| CONFLICTED สาย 45 นาที | แสดงพร้อมเวลา Daily Report vs สแกนจริง |
| CONFLICTED ขาด segment (admin จัดการ) | **ไม่แสดง** แม้ติ๊ก CONFLICTED |
| assigneeName = null | จัดกลุ่มล่างสุด "ไม่ระบุโฟร์แมน" |
| export zip | จำนวนไฟล์ = จำนวนโฟร์แมน + 1 (ถ้ามี null) |
| export single | sort ตามโฟร์แมน → วันที่ ถูกต้อง |
| ไม่ติ๊กสถานะใดเลย | แจ้งเตือน "กรุณาเลือกอย่างน้อย 1 สถานะ" |

---

## 10. Changelog

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-05-19 | v1: สร้าง implement plan เบื้องต้น — filter ตายตัว 4 สถานะ |
| 2026-05-19 | v2: เปลี่ยนเป็น Admin เลือกสถานะเองผ่าน checkbox, เพิ่ม MISSING_SCAN เป็นตัวเลือก |
