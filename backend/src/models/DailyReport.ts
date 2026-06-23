/**
 * DailyReport Model (Aggregated)
 * รายงานประจำวัน (รวมตามวันและโครงการ)
 *
 * Description: Aggregated daily work records per Project-Day.
 * Firestore Collection: dailyReports
 * Document ID: REP_[projectId]_[YYYY-MM-DD]
 */

export type WorkType = 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';
export type ReportStatus = 'draft' | 'submitted' | 'verified' | 'locked';

export interface DailyReportEntry {
  id: string; // UUID
  dailyContractorId: string;
  employeeId?: string;
  taskId?: string; // [T-400] เชื่อมโยงกับ Task ID
  workOrderId?: string; // [NEW] เชื่อมโยงกับ Work Order (AS System)
  categoryId?: string; // [NEW] เชื่อมโยงกับ Category (AS System)
  taskName: string;
  workType: WorkType;
  hours: number; // [PIVOT] เราจะเก็บ "ชั่วโมงทำงาน" ทันที ไม่ใช้ช่วงเวลา
  notes?: string;
  fmSelfPerformed?: boolean;
  createdAt: Date;
}

export interface DailyReportSummary {
  workerCount: number; // จำนวนคน
  totalNetHours: number; // ชั่วโมงสุทธิรวม
  regularHours: number; // ชั่วโมงปกติรวม
  otHours: number; // ชั่วโมง OT ทุกประเภท
  lastImportAt?: Date; // วันที่นำเข้าล่าสุด
}

export interface DailyReport {
  id: string; // REP_[projectId]_[YYYY-MM-DD]
  projectLocationId: string;
  date: Date; // YYYY-MM-DD 00:00:00
  status: ReportStatus;
  summary: DailyReportSummary; // [CACHE] ข้อมูลสรุปภาพรวม
  notes?: string;
  importFileUrls?: string[]; // URLs ของไฟล์ต้นฉบับ

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface DailyWorkerReportLog {
  action: 'import' | 'create' | 'update' | 'delete';
  timestamp: Date;
  userId: string;
  details: string;
}

export interface DailyWorkerReport {
  id: string; // dailyContractorId
  dailyContractorId: string;
  employeeId: string;
  workerName: string;

  // [ALIGNMENT] ฟิลด์ที่สอดคล้องกับ ScanData ของทีม
  regularHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
  totalNetHours: number;

  entries: DailyReportEntry[]; // ข้อมูลดิบรายคน
  editHistory: DailyWorkerReportLog[]; // ประวัติ Audit Log
  updatedAt: Date;
}

export interface CreateDailyReportInput {
  projectLocationId: string;
  date: Date;
  entries: DailyReportEntry[];
  status?: ReportStatus;
  notes?: string;
}

export interface UpdateDailyReportInput {
  entries?: DailyReportEntry[];
  status?: ReportStatus;
  notes?: string;
}

/**
 * คำนวณจำนวนชั่วโมงทั้งหมด (รวมการปัดเศษลง 5 นาที)
 */
export function calculateTotalHours(startTime: Date, endTime: Date): number {
  const milliseconds = endTime.getTime() - startTime.getTime();
  const hours = milliseconds / (1000 * 60 * 60);

  // ปัดเศษลงเป็น 5 นาที (0.083 ชั่วโมง) ตาม FR-SD-006
  const minutes = Math.floor((hours * 60) / 5) * 5;
  return minutes / 60;
}

/**
 * คำนวณชั่วโมงสุทธิ (หักพักเที่ยง)
 */
export function calculateNetHours(
  totalHours: number,
  workType: WorkType,
  startTime: Date,
  endTime: Date
): number {
  let breakHours = 0;

  // หักพักกลางวันสำหรับงานปกติที่คร่อม 12:00-13:00
  if (workType === 'regular') {
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();

    if (startHour <= 12 && endHour >= 13) {
      breakHours = 1.0; // พักเที่ยงมาตรฐาน
    }
  }

  // Noon OT Constraints handled in Service/Frontend logic (Fixed 1hr)

  return Math.max(0, totalHours - breakHours);
}

/**
 * Firestore document converter for DailyReport (Summary Cache)
 */
export const dailyReportConverter = {
  toFirestore: (report: Partial<DailyReport>): any => {
    const data: any = {};
    if (report.projectLocationId !== undefined) data.projectLocationId = report.projectLocationId;
    if (report.date !== undefined) data.date = report.date;
    if (report.summary !== undefined) data.summary = report.summary;
    if (report.status !== undefined) data.status = report.status;
    if (report.notes !== undefined) data.notes = report.notes;
    if (report.importFileUrls !== undefined) data.importFileUrls = report.importFileUrls;
    if (report.createdAt !== undefined) data.createdAt = report.createdAt;
    if (report.updatedAt !== undefined) data.updatedAt = report.updatedAt;
    if (report.createdBy !== undefined) data.createdBy = report.createdBy;
    if (report.updatedBy !== undefined) data.updatedBy = report.updatedBy;
    if (report.version !== undefined) data.version = report.version;
    return data;
  },
  fromFirestore: (snapshot: any): DailyReport => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      projectLocationId: data.projectLocationId,
      date: data.date.toDate(),
      summary: data.summary || {
        workerCount: 0,
        totalNetHours: 0,
        regularHours: 0,
        otHours: 0,
      },
      status: data.status,
      notes: data.notes,
      importFileUrls: data.importFileUrls || [],
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      version: data.version || 1,
    };
  },
};
