/**
 * ScanData Model
 * ข้อมูลสแกนนิ้ว
 *
 * Description: Fingerprint scan records for tracking DC attendance and work hours.
 * Firestore Collection: scanData
 */

export type ScanBehavior =
  | 'ot_morning_in' // 03:00-07:30
  | 'ot_morning_out'
  | 'regular_in' // 07:30-12:00 (เข้างาน / สายเกิน 08:00)
  | 'lunch_break' // 12:00-13:00 (พักเที่ยง)
  | 'regular_out' // 13:00-18:00 (เลิกงาน)
  | 'ot_noon' // OT เที่ยง (Requires OT record logic later)
  | 'ot_evening_in' // 18:00-24:00
  | 'ot_evening_out'; // 18:00-24:00

export interface ScanData {
  id: string;
  dailyContractorId: string;
  employeeId: string;
  employeeNumber?: string;
  name?: string;
  position?: string;
  projectLocationId: string; // Legacy field
  projectLocationIds?: string[]; // New Array field (WH1, P002, etc.)
  scanDateTime: Date; // Keep for legacy/internal purposes
  scanDate?: string; // YYYY-MM-DD
  scanBehavior: ScanBehavior; // Keep legacy behavior classification
  workDate: Date;
  roundedTime: Date;
  isLate: boolean;
  lateMinutes: number;
  matchedDailyReportId?: string;
  hasDiscrepancy: boolean;
  notes?: string;
  createdAt: Date;
  importedAt: Date;
  importedBy: string;
  importBatchId: string;
  importSource?: string;
  importNote?: string;
  rawData?: Record<string, unknown>;
  // New Time Slots
  // New Time Slots
  Time1?: string | null;
  Time2?: string | null;
  Time3?: string | null;
  Time4?: string | null;
  Time5?: string | null;
  Time6?: string | null;
  allScans?: string[]; // Array of HH:mm:ss strings
  punches?: string[]; // Array of HH:mm strings
  firstIn?: string | null;
  lastOut?: string | null;
  projectCode?: string;
  projectName?: string;
  // Soft Delete
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface CreateScanDataInput {
  dailyContractorId: string;
  employeeId: string;
  projectLocationId: string;
  scanDateTime: Date;
  importNote?: string;
}

/**
 * ปัดเศษเวลาลง 5 นาที
 * Round time down to nearest 5 minutes
 */
export function roundDownToFiveMinutes(date: Date): Date {
  // User requested exact time without rounding.
  return new Date(date);
}

/**
 * การจำแนกพฤติกรรมการสแกนพื้นฐาน (Stateless Time-based Classification)
 * Contextual classification (e.g., differentiating 'in' vs 'out' for OT) 
 * will be handled by analyzeDailyScans later.
 */
export function classifyScanBehavior(scanTime: Date): ScanBehavior {
  if (!scanTime || !(scanTime instanceof Date)) {
    return 'regular_in';
  }
  const hour = scanTime.getHours();
  const minute = scanTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // OT เช้า: 03:00-07:30
  if (timeInMinutes >= 3 * 60 && timeInMinutes < 7 * 60 + 30) {
    return 'ot_morning_in'; // Default to 'in' base class for this period
  }

  // เข้างาน (เวลาปกติ): 07:30-12:00
  if (timeInMinutes >= 7 * 60 + 30 && timeInMinutes < 12 * 60) {
    return 'regular_in';
  }

  // พักเที่ยง: 12:00-13:00
  if (timeInMinutes >= 12 * 60 && timeInMinutes < 13 * 60) {
    return 'lunch_break';
  }

  // เลิกงานปกติ / ออก OT เช้า / เริ่ม OT เย็น: 13:00-18:00
  // (Assuming >=17:00 is regular out, Contextual engine can override to OT evening in)
  if (timeInMinutes >= 13 * 60 && timeInMinutes < 18 * 60) {
    return 'regular_out';
  }

  // OT เย็น: 18:00-24:00
  if (timeInMinutes >= 18 * 60 && timeInMinutes < 24 * 60) {
    return 'ot_evening_out'; // Default to 'out' base class
  }

  // Default fallback
  return 'regular_in';
}

/**
 * ตรวจสอบการมาสาย
 */
export function checkLate(scanTime: Date): { isLate: boolean; lateMinutes: number } {
  const hour = scanTime.getHours();
  const minute = scanTime.getMinutes();
  const scanMinutes = hour * 60 + minute;
  const workStartMinutes = 8 * 60; // 08:00

  const isLate = scanMinutes > workStartMinutes;
  const lateMinutes = isLate ? scanMinutes - workStartMinutes : 0;

  return { isLate, lateMinutes };
}

/**
 * Firestore document converter for ScanData
 */
export const scanDataConverter = {
  toFirestore: (scan: Omit<ScanData, 'id'>): any => {
    return {
      dailyContractorId: scan.dailyContractorId,
      employeeId: scan.employeeId,
      employeeNumber: scan.employeeNumber || scan.employeeId,
      name: scan.name || null,
      position: scan.position || null,
      projectLocationId: scan.projectLocationId,
      projectLocationIds: scan.projectLocationIds || [],
      scanDateTime: scan.scanDateTime,
      scanDate: scan.scanDate || null,
      scanBehavior: scan.scanBehavior,
      workDate: scan.workDate,
      roundedTime: scan.roundedTime,
      isLate: scan.isLate,
      lateMinutes: scan.lateMinutes,
      matchedDailyReportId: scan.matchedDailyReportId || null,
      hasDiscrepancy: scan.hasDiscrepancy,
      notes: scan.notes || null,
      createdAt: scan.createdAt,
      importedAt: scan.importedAt,
      importedBy: scan.importedBy,
      importBatchId: scan.importBatchId,
      importSource: scan.importSource || null,
      importNote: scan.importNote || null,
      rawData: scan.rawData || null,
      Time1: scan.Time1 || null,
      Time2: scan.Time2 || null,
      Time3: scan.Time3 || null,
      Time4: scan.Time4 || null,
      Time5: scan.Time5 || null,
      Time6: scan.Time6 || null,
      allScans: scan.allScans || null,
      punches: scan.punches || [],
      firstIn: scan.firstIn || null,
      lastOut: scan.lastOut || null,
      projectCode: scan.projectCode || null,
      projectName: scan.projectName || null,
      isDeleted: scan.isDeleted || false,
      deletedAt: scan.deletedAt || null,
      deletedBy: scan.deletedBy || null,
    };
  },
  fromFirestore: (snapshot: any): ScanData => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyContractorId: data.dailyContractorId,
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber || data.employeeId,
      name: data.name,
      position: data.position,
      projectLocationId: data.projectLocationId,
      projectLocationIds: data.projectLocationIds || [],
      scanDateTime: data.scanDateTime.toDate(),
      scanDate: data.scanDate,
      scanBehavior: data.scanBehavior,
      workDate: data.workDate.toDate(),
      roundedTime: data.roundedTime.toDate(),
      isLate: data.isLate || false,
      lateMinutes: data.lateMinutes || 0,
      matchedDailyReportId: data.matchedDailyReportId,
      hasDiscrepancy: data.hasDiscrepancy || false,
      notes: data.notes,
      createdAt: data.createdAt.toDate(),
      importedAt: data.importedAt.toDate(),
      importedBy: data.importedBy,
      importBatchId: data.importBatchId,
      importSource: data.importSource || undefined,
      importNote: data.importNote || undefined,
      rawData: data.rawData || undefined,
      Time1: data.Time1,
      Time2: data.Time2,
      Time3: data.Time3,
      Time4: data.Time4,
      Time5: data.Time5,
      Time6: data.Time6,
      allScans: data.allScans,
      punches: data.punches || [],
      firstIn: data.firstIn,
      lastOut: data.lastOut,
      projectCode: data.projectCode,
      projectName: data.projectName,
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt,
      deletedBy: data.deletedBy,
    };
  },
};
