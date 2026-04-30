/**
 * ReconciliationRecord Model
 * บันทึกการ Reconcile ระหว่าง Daily Report และ Scan Data
 *
 * Description: Tracks the reconciliation status of each employee's working hours
 *              per day, comparing Daily Report vs Scan Data sources.
 * Firestore Collection: reconciliationRecords
 * Document ID Format: REC_[employeeId]_[workDate]  e.g. REC_EMP001_2026-04-23
 */

// ---------------------------------------------------------------------------
// Enums & Sub-types
// ---------------------------------------------------------------------------

export type ReconciliationStatus =
  | 'PENDING'              // รอระบบ classify
  | 'MATCHED'              // ข้อมูลทั้ง 2 แหล่งตรงกัน
  | 'CONFLICTED'           // ข้อมูลขัดแย้ง (มีทั้งคู่ แต่ชม. ไม่ตรง)
  | 'MISSING_SCAN'         // มี Daily Report แต่ไม่มี Scan Data
  | 'MISSING_DAILY'        // มีพนักงานในระบบ มี Scan Data แต่ไม่มี Daily Report
  | 'ABSENT'               // ไม่มีข้อมูลทั้งคู่
  | 'LEAVE'                // พนักงานลา (ยืนยันจาก Leave Request)
  | 'HOLIDAY'              // วันหยุดบริษัท
  | 'UNREGISTERED_EMPLOYEE'; // มี Scan Data แต่รหัสพนักงานไม่มีในระบบ

export type ApprovalSource =
  | 'daily_report'  // ยึดตาม Daily Report
  | 'scan_data'     // ยึดตาม Scan Data
  | 'manual';       // Admin กำหนดเอง

/**
 * บันทึกประวัติการเปลี่ยนสถานะ — ใช้ป้องกัน Loop ซ้ำซ้อน
 * ทุกครั้งที่ status เปลี่ยน จะถูก append เข้า statusHistory[]
 */
export interface StatusHistoryEntry {
  status: ReconciliationStatus;
  changedAt: Date;
  changedBy: string;    // 'system' | userId (Admin)
  reason?: string;      // เหตุผลการเปลี่ยน
  note?: string;        // โน้ตเพิ่มเติม (เช่น "daily report ถูกเพิ่มโดย user_05")
}

// ---------------------------------------------------------------------------
// Main Interface
// ---------------------------------------------------------------------------

export interface ReconciliationRecord {
  id: string;                        // REC_{employeeId}_{workDate}
  employeeId: string;
  employeeName?: string;             // Cache สำหรับ UI
  workDate: string;                  // YYYY-MM-DD
  projectLocationId: string;
  projectName?: string;              // Cache สำหรับ UI

  // --- สหรับข้อมูลดิบจากทั้ง 2 แหล่ง ---
  // Timesheet (After-Sale DailyEmployeeTimesheets)
  dailyReportHours?: number;         // ยอดรวม (normal + OT)
  timesheetNormalHours?: number;     // ชม. ปกติ (08:00-17:00)
  timesheetOtMorning?: number;       // OT เช้า (05:00-08:00)
  timesheetOtNoon?: number;          // OT ผ่าเที่ยง (12:00-13:00)
  timesheetOtEvening?: number;       // OT เย็น (17:00-22:00)
  // Scan Data
  scanDataHours?: number;            // ยอดรวม (normal + OT)
  scanNormalHours?: number;          // ชม. ปกติ
  scanOtMorningHours?: number;       // OT เช้า
  scanOtNoonHours?: number;          // OT ผ่าเที่ยง
  scanOtEveningHours?: number;       // OT เย็น
  dailyReportId?: string;            // ref → DailyWorkerReport doc id
  scanDataId?: string;               // ref → scanData doc id
  suggestedHours?: number;           // min(dailyReportHours, scanDataHours) — UI hint เท่านั้น

  // --- สถานะ ---
  status: ReconciliationStatus;
  isHoliday?: boolean;               // วันหยุดบริษัท
  leaveHours?: number;               // จำนวนชั่วโมงที่ลา
  leaveEntries?: any[];              // ข้อมูลการลาเพิ่มเติม

  // --- Locking (ผูกกับงวดงาน — ไม่ใช่ approve รายวัน) ---
  // เมื่อ Admin Approve งวดงาน onWagePeriodApproved จะตั้ง isLocked: true อัตโนมัติ
  isLocked?: boolean;

  // --- Audit Trail ---
  statusHistory: StatusHistoryEntry[];

  // --- Metadata ---
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input Interfaces
// ---------------------------------------------------------------------------

export interface CreateReconciliationRecordInput {
  employeeId: string;
  employeeName?: string;
  workDate: string;
  projectLocationId: string;
  projectName?: string;
  dailyReportHours?: number;
  scanDataHours?: number;
  dailyReportId?: string;
  scanDataId?: string;
  isHoliday?: boolean;
  leaveHours?: number;
  leaveEntries?: { hours: number; attachment?: string; type?: string }[];
}

// ลบ ApproveReconciliationInput ออกแล้ว — ไม่มีการ approve รายวันอีกต่อไป
// ลบ SendCorrectionInput ออกแล้ว — Admin แจ้งนอกระบบเอง

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateReconciliationId(employeeId: string, workDate: string): string {
  return `REC_${employeeId}_${workDate}`;
}

// Note: AWAITING_CORRECTION ถูกลบออกจากระบบแล้ว — Admin แจ้งนอกระบบเอง
// Note: APPROVED ถูกลบออกจากระบบแล้ว — การ Approve ผูกกับงวดงาน (isLocked) ผ่าน onWagePeriodApproved

// ---------------------------------------------------------------------------
// Firestore Converter
// ---------------------------------------------------------------------------

export const reconciliationRecordConverter = {
  toFirestore: (record: Partial<Omit<ReconciliationRecord, 'id'>>): any => {
    const data: any = {};

    if (record.employeeId !== undefined) data.employeeId = record.employeeId;
    if (record.employeeName !== undefined) data.employeeName = record.employeeName;
    if (record.workDate !== undefined) data.workDate = record.workDate;
    if (record.projectLocationId !== undefined) data.projectLocationId = record.projectLocationId;
    if (record.projectName !== undefined) data.projectName = record.projectName;
    if (record.dailyReportHours !== undefined) data.dailyReportHours = record.dailyReportHours;
    if (record.scanDataHours !== undefined) data.scanDataHours = record.scanDataHours;
    if (record.dailyReportId !== undefined) data.dailyReportId = record.dailyReportId;
    if (record.scanDataId !== undefined) data.scanDataId = record.scanDataId;
    if (record.suggestedHours !== undefined) data.suggestedHours = record.suggestedHours;
    if (record.status !== undefined) data.status = record.status;
    if (record.isLocked !== undefined) data.isLocked = record.isLocked;
    if (record.statusHistory !== undefined) data.statusHistory = record.statusHistory;
    if (record.createdAt !== undefined) data.createdAt = record.createdAt;
    if (record.updatedAt !== undefined) data.updatedAt = record.updatedAt;
    
    // Additional properties
    if ('isHoliday' in record) data.isHoliday = record.isHoliday;
    if ('leaveHours' in record) data.leaveHours = record.leaveHours;
    if ('leaveEntries' in record) data.leaveEntries = record.leaveEntries;

    return data;
  },

  fromFirestore: (snapshot: any): ReconciliationRecord => {
    const data = snapshot.data();

    const toDate = (val: any): Date =>
      val?.toDate ? val.toDate() : val instanceof Date ? val : new Date();

    const parseHistory = (arr: any[]): StatusHistoryEntry[] =>
      (arr || []).map((h) => ({
        status: h.status,
        changedAt: toDate(h.changedAt),
        changedBy: h.changedBy,
        reason: h.reason,
        note: h.note,
      }));

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      workDate: data.workDate,
      projectLocationId: data.projectLocationId,
      projectName: data.projectName,
      // Cloud Function เขียนเป็น timesheetHours, backend model ใช้ dailyReportHours
      dailyReportHours:      data.timesheetHours ?? data.dailyReportHours,
      timesheetNormalHours:  data.timesheetNormalHours,
      timesheetOtMorning:    data.timesheetOtMorning,
      timesheetOtNoon:       data.timesheetOtNoon,
      timesheetOtEvening:    data.timesheetOtEvening,
      scanDataHours:         data.scanDataHours,
      scanNormalHours:       data.scanNormalHours,
      scanOtMorningHours:    data.scanOtMorningHours,
      scanOtNoonHours:       data.scanOtNoonHours,
      scanOtEveningHours:    data.scanOtEveningHours,
      dailyReportId: data.dailyReportId,
      scanDataId: data.scanDataId,
      suggestedHours: data.suggestedHours,
      status: data.status || 'PENDING',
      isLocked: data.isLocked ?? false,
      statusHistory: parseHistory(data.statusHistory),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      // Leave & Holiday
      ...(data.isHoliday !== undefined && { isHoliday: data.isHoliday }),
      ...(data.leaveHours !== undefined && { leaveHours: data.leaveHours }),
      ...(data.leaveEntries !== undefined && { leaveEntries: data.leaveEntries }),
    };
  },
};
