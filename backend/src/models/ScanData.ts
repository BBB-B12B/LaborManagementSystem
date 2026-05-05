/**
 * ScanData Model (Daily Aggregation)
 * ข้อมูลสแกนนิ้วแบบรายวัน (1 คน 1 วัน 1 เอกสาร)
 *
 * Description: Aggregated fingerprint scan records for a specific employee on a specific date.
 * Firestore Collection: scanData
 * Document ID Format: SCAN_[employeeId]_[workDate] (e.g., SCAN_200247_2025-10-21)
 */

// ---------------------------------------------------------------------------
// Audit Trail Types (mirrors Daily Report editHistory pattern)
// ---------------------------------------------------------------------------

export type ScanEditAction =
  | 'manual_fill'    // Admin เติม scan times ที่ขาดหายไป
  | 'manual_create'  // Admin สร้าง document ใหม่ทั้งหมด (ไม่มี scan เดิมเลย)
  | 'delete_ghost'   // Admin ลบ Ghost Scan (สแกนนิ้วที่ไม่ได้ทำงานจริง)
  | 'modify';        // Admin แก้ไข scan times อื่นๆ

export interface ScanEditEntry {
  editedAt: Date;
  editedBy: string;                // Admin userId
  action: ScanEditAction;
  reason: string;                  // เหตุผลที่แก้ไข (บังคับกรอก)
  reconciliationRecordId?: string; // ref กลับไปที่ ReconciliationRecord
  snapshot: {                      // state ก่อนแก้ไข
    punches: string[];             // ['08:01', '12:00', '13:00', '17:02']
    firstIn?: string | null;
    lastOut?: string | null;
    regularHours?: number;
    otMorningHours?: number;
    otEveningHours?: number;
  };
}

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
  id: string; // SCAN_[employeeId]_[workDate]
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
  // Aggregated Metrics
  normalStatus?: 0 | 1;
  regularHours?: number;
  lunchStatus?: 0 | 1;
  otMorningHours?: number;
  otNoonHours?: number;
  otEveningHours?: number;
  // Soft Delete
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;

  // Audit Trail (mirrors Daily Report editHistory pattern)
  isManualEntry?: boolean;     // true = Admin สร้าง document ทั้งหมดด้วยตัวเอง
  isManuallyEdited?: boolean;  // true = มีการแก้ไขโดย Admin อย่างน้อย 1 ครั้ง
  editHistory?: ScanEditEntry[]; // ประวัติการแก้ไขทั้งหมด

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  importedAt: Date;
  importedBy: string;
  importBatchId?: string;
  importSource?: string;
  importNote?: string;

  // Legacy / Compatibility (Optional)
  notes?: string;
  rawData?: Record<string, unknown>;
}

export interface CreateScanDataInput {
  dailyContractorId?: string; // Deprecated but might be needed for lookup
  employeeId: string;
  projectLocationId: string;
  projectCode?: string; // Used by generateScanDocKey to build a consistent document ID
  scanDateTime: Date; // Used to derive workDate and punch time
  importNote?: string;
}

/**
 * Format Date to YYYY-MM-DD
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
 * Generate Document ID
 */
export function generateScanDocId(employeeId: string, workDate: string): string {
  return `SCAN_${employeeId}_${workDate}`;
}

/**
 * Firestore document converter for ScanData
 */
export const scanDataConverter = {
  toFirestore: (scan: Partial<Omit<ScanData, 'id'>>): any => {
    const data: any = {
      employeeId: scan.employeeId,
      employeeNumber: scan.employeeNumber,
      name: scan.name,
      position: scan.position,
      projectLocationId: scan.projectLocationId,
      projectLocationIds: scan.projectLocationIds,
      scanDateTime: scan.scanDateTime,
      scanDate: scan.scanDate,
      scanBehavior: scan.scanBehavior,
      workDate: scan.workDate,
      roundedTime: scan.roundedTime,
      isLate: scan.isLate,
      lateMinutes: scan.lateMinutes,
      matchedDailyReportId: scan.matchedDailyReportId,
      hasDiscrepancy: scan.hasDiscrepancy,
      notes: scan.notes,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
      importedAt: scan.importedAt,
      importedBy: scan.importedBy,
      importBatchId: scan.importBatchId,
      importSource: scan.importSource,
      importNote: scan.importNote,
      rawData: scan.rawData,
      Time1: scan.Time1,
      Time2: scan.Time2,
      Time3: scan.Time3,
      Time4: scan.Time4,
      Time5: scan.Time5,
      Time6: scan.Time6,
      allScans: scan.allScans,
      punches: scan.punches,
      firstIn: scan.firstIn,
      lastOut: scan.lastOut,
      projectCode: scan.projectCode,
      projectName: scan.projectName,
      normalStatus: scan.normalStatus,
      regularHours: scan.regularHours,
      lunchStatus: scan.lunchStatus,
      otMorningHours: scan.otMorningHours,
      otNoonHours: scan.otNoonHours,
      otEveningHours: scan.otEveningHours,
      isDeleted: scan.isDeleted,
      deletedAt: scan.deletedAt,
      deletedBy: scan.deletedBy,
      isManualEntry: scan.isManualEntry,
      isManuallyEdited: scan.isManuallyEdited,
      editHistory: scan.editHistory,
    };

    // Strip undefined out so {merge: true} works correctly without overwriting fields
    Object.keys(data).forEach(k => {
      if (data[k] === undefined) {
        delete data[k];
      }
    });

    return data;
  },
  fromFirestore: (snapshot: any): ScanData => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      employeeNumber: data.employeeNumber || data.employeeId,
      name: data.name,
      position: data.position,
      projectLocationId: data.projectLocationId,
      projectLocationIds: data.projectLocationIds || [],
      scanDateTime: data.scanDateTime?.toDate ? data.scanDateTime.toDate() : (data.scanDateTime instanceof Date ? data.scanDateTime : new Date()),
      scanDate: data.scanDate,
      scanBehavior: data.scanBehavior || 'regular_in',
      workDate: data.workDate?.toDate ? data.workDate.toDate() : (data.workDate instanceof Date ? data.workDate : new Date()),
      roundedTime: data.roundedTime?.toDate ? data.roundedTime.toDate() : (data.roundedTime instanceof Date ? data.roundedTime : new Date()),
      isLate: data.isLate || false,
      lateMinutes: data.lateMinutes || 0,
      matchedDailyReportId: data.matchedDailyReportId,
      hasDiscrepancy: data.hasDiscrepancy || false,
      notes: data.notes,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date()),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt instanceof Date ? data.updatedAt : new Date()),
      importedAt: data.importedAt?.toDate ? data.importedAt.toDate() : (data.importedAt instanceof Date ? data.importedAt : new Date()),
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
      normalStatus: data.normalStatus,
      regularHours: data.regularHours,
      lunchStatus: data.lunchStatus,
      otMorningHours: data.otMorningHours,
      otNoonHours: data.otNoonHours,
      otEveningHours: data.otEveningHours,
      isDeleted: data.isDeleted || false,
      deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : (data.deletedAt instanceof Date ? data.deletedAt : undefined),
      deletedBy: data.deletedBy,
      isManualEntry: data.isManualEntry || false,
      isManuallyEdited: data.isManuallyEdited || false,
      editHistory: (data.editHistory || []).map((entry: any) => ({
        editedAt: entry.editedAt?.toDate ? entry.editedAt.toDate() : new Date(entry.editedAt),
        editedBy: entry.editedBy,
        action: entry.action,
        reason: entry.reason,
        reconciliationRecordId: entry.reconciliationRecordId,
        snapshot: entry.snapshot || { punches: [] },
      })),
    };
  },
};
