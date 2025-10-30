/**
 * DailyReport Model
 * รายงานประจำวัน
 *
 * Description: Daily work records for contractors including regular hours and overtime tracking.
 * Firestore Collection: dailyReports
 */

export type WorkType = 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';
export type ReportStatus = 'draft' | 'submitted' | 'verified' | 'locked';

export interface DailyReport {
  id: string;
  projectLocationId: string;
  dailyContractorId: string;
  taskName: string;
  workDate: Date;
  startTime: Date;
  endTime: Date;
  workType: WorkType;
  totalHours: number;
  breakHours: number;
  netHours: number;
  isOvernight: boolean;
  notes?: string;
  fileAttachmentIds?: string[];
  status: ReportStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface CreateDailyReportInput {
  projectLocationId: string;
  dailyContractorId: string;
  taskName: string;
  workDate: Date;
  startTime: Date;
  endTime: Date;
  workType: WorkType;
  isOvernight?: boolean;
  notes?: string;
  fileAttachmentIds?: string[];
  status?: ReportStatus;
}

export interface UpdateDailyReportInput {
  projectLocationId?: string;
  dailyContractorId?: string;
  taskName?: string;
  workDate?: Date;
  startTime?: Date;
  endTime?: Date;
  workType?: WorkType;
  isOvernight?: boolean;
  notes?: string;
  fileAttachmentIds?: string[];
  status?: ReportStatus;
}

/**
 * คำนวณจำนวนชั่วโมงทั้งหมด (รวมการปัดเศษลง 5 นาที)
 * Calculate total hours with 5-minute rounding down
 */
export function calculateTotalHours(
  startTime: Date,
  endTime: Date,
  isOvernight: boolean
): number {
  let hours: number;
  if (isOvernight) {
    // เพิ่ม 24 ชั่วโมงสำหรับการทำงานข้ามวัน
    const milliseconds = endTime.getTime() + 24 * 60 * 60 * 1000 - startTime.getTime();
    hours = milliseconds / (1000 * 60 * 60);
  } else {
    const milliseconds = endTime.getTime() - startTime.getTime();
    hours = milliseconds / (1000 * 60 * 60);
  }

  // ปัดเศษลงเป็น 5 นาที (0.083 ชั่วโมง) ตาม FR-SD-006
  const minutes = Math.floor((hours * 60) / 5) * 5;
  return minutes / 60;
}

/**
 * คำนวณชั่วโมงสุทธิ (หักพักเที่ยง)
 * Calculate net hours (minus break hours)
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

    if (startHour < 13 && endHour > 12) {
      breakHours = 1.0; // พักเที่ยงมาตรฐาน
    }
  }

  return Math.max(0, totalHours - breakHours);
}

/**
 * Firestore document converter for DailyReport
 */
export const dailyReportConverter = {
  toFirestore: (report: Omit<DailyReport, 'id'>): any => {
    return {
      projectLocationId: report.projectLocationId,
      dailyContractorId: report.dailyContractorId,
      taskName: report.taskName,
      workDate: report.workDate,
      startTime: report.startTime,
      endTime: report.endTime,
      workType: report.workType,
      totalHours: report.totalHours,
      breakHours: report.breakHours,
      netHours: report.netHours,
      isOvernight: report.isOvernight,
      notes: report.notes || null,
      fileAttachmentIds: report.fileAttachmentIds || [],
      status: report.status,
      isDeleted: report.isDeleted,
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
      dailyContractorId: data.dailyContractorId,
      taskName: data.taskName,
      workDate: data.workDate.toDate(),
      startTime: data.startTime.toDate(),
      endTime: data.endTime.toDate(),
      workType: data.workType,
      totalHours: data.totalHours,
      breakHours: data.breakHours,
      netHours: data.netHours,
      isOvernight: data.isOvernight || false,
      notes: data.notes,
      fileAttachmentIds: data.fileAttachmentIds || [],
      status: data.status,
      isDeleted: data.isDeleted || false,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      version: data.version || 1,
    };
  },
};
