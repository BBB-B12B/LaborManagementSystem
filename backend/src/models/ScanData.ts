/**
 * ScanData Model
 * ข้อมูลสแกนนิ้ว
 *
 * Description: Fingerprint scan records for tracking DC attendance and work hours.
 * Firestore Collection: scanData
 */

export type ScanBehavior =
  | 'ot_morning' // 05:00-08:00
  | 'regular_in' // 08:00-17:00 (เข้างาน)
  | 'lunch_out' // 12:00-13:00 (ออกพักเที่ยง)
  | 'lunch_in' // 12:00-13:00 (กลับจากพักเที่ยง)
  | 'regular_out' // 08:00-17:00 (เลิกงาน)
  | 'ot_noon' // 12:00-13:00 (OT เที่ยง)
  | 'ot_evening'; // 17:00-22:00

export interface ScanData {
  id: string;
  dailyContractorId: string;
  employeeId: string;
  employeeNumber?: string;
  projectLocationId: string;
  scanDateTime: Date;
  scanBehavior: ScanBehavior;
  workDate: Date; // วันที่ทำงานจริง (อาจต่างจาก scanDateTime ถ้าข้ามวัน)
  roundedTime: Date; // ปัดเศษลง 5 นาที
  isLate: boolean; // มาสายหรือไม่ (>08:00)
  lateMinutes: number; // จำนวนนาทีที่มาสาย
  matchedDailyReportId?: string; // Link to matched DailyReport
  hasDiscrepancy: boolean; // มีความผิดปกติหรือไม่
  notes?: string;
  createdAt: Date;
  importedAt: Date;
  importedBy: string;
  importBatchId: string;
  importSource?: string;
  importNote?: string;
  rawData?: Record<string, unknown>;
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
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / 5) * 5;
  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes);
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
}

/**
 * จำแนกพฤติกรรมการสแกน
 * Classify scan behavior based on time
 */
export function classifyScanBehavior(scanTime: Date): ScanBehavior {
  const hour = scanTime.getHours();
  const minute = scanTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // OT เช้า: 05:00-08:00
  if (timeInMinutes >= 5 * 60 && timeInMinutes < 8 * 60) {
    return 'ot_morning';
  }

  // พักเที่ยง: 12:00-13:00
  if (timeInMinutes >= 12 * 60 && timeInMinutes < 13 * 60) {
    return 'ot_noon'; // Or could be lunch_out/lunch_in based on context
  }

  // OT เย็น: 17:00-22:00
  if (timeInMinutes >= 17 * 60 && timeInMinutes < 22 * 60) {
    return 'ot_evening';
  }

  // เวลาปกติ: 08:00-17:00
  if (timeInMinutes >= 8 * 60 && timeInMinutes < 17 * 60) {
    return timeInMinutes < 12 * 60 ? 'regular_in' : 'regular_out';
  }

  // Default
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
      projectLocationId: scan.projectLocationId,
      scanDateTime: scan.scanDateTime,
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
      employeeNumber: scan.employeeNumber || scan.employeeId,
      rawData: scan.rawData || null,
    };
  },
  fromFirestore: (snapshot: any): ScanData => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      dailyContractorId: data.dailyContractorId,
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber || data.employeeId,
      projectLocationId: data.projectLocationId,
      scanDateTime: data.scanDateTime.toDate(),
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
    };
  },
};
