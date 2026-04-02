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
  employeeId?: string; // Denormalized ID for scan matching (T-400)
  verificationStatus?: 'unverified' | 'auto_verified' | 'manual_verified' | 'discrepancy'; // (T-401)
  taskName: string;
  workType: WorkType;
  startTime: Date;
  endTime: Date;
  totalHours: number;
  netHours: number;
  notes?: string;
  fileAttachmentIds?: string[];
  createdAt: Date;
}

export interface DailyReport {
  id: string; // REP_[projectId]_[YYYY-MM-DD]
  projectLocationId: string;
  date: Date; // YYYY-MM-DD 00:00:00
  entries: DailyReportEntry[]; // Array of work entries
  status: ReportStatus;
  notes?: string;
  importFileUrls?: string[]; // URLs to source Excel files (Audit Trail)

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
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
export function calculateTotalHours(
  startTime: Date,
  endTime: Date
): number {
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
 * Firestore document converter for DailyReport
 */
export const dailyReportConverter = {
  toFirestore: (report: Omit<DailyReport, 'id'>): any => {
    return {
      projectLocationId: report.projectLocationId,
      date: report.date,
      entries: report.entries.map(e => ({
        ...e,
        startTime: e.startTime,
        endTime: e.endTime,
        createdAt: e.createdAt
      })),
      status: report.status,
      notes: report.notes || null,
      importFileUrls: report.importFileUrls || [],
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      createdBy: report.createdBy,
      updatedBy: report.updatedBy,
      version: report.version,
    };
  },
  fromFirestore: (snapshot: any): DailyReport => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      projectLocationId: data.projectLocationId,
      date: data.date.toDate(),
      entries: (data.entries || []).map((e: any) => ({
        ...e,
        startTime: e.startTime.toDate(),
        endTime: e.endTime.toDate(),
        createdAt: e.createdAt.toDate()
      })),
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
