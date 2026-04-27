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
  | 'MATCHED'              // ข้อมูลทั้ง 2 แหล่งตรงกัน รออนุมัติ
  | 'CONFLICTED'           // ข้อมูลขัดแย้ง (มีทั้งคู่ แต่ชม. ไม่ตรง)
  | 'MISSING_SCAN'         // มี Daily Report แต่ไม่มี Scan Data
  | 'MISSING_DAILY'        // มี Scan Data แต่ไม่มี Daily Report
  | 'ABSENT'               // ไม่มีข้อมูลทั้งคู่
  | 'LEAVE'                // พนักงานลา (ยืนยันจาก Leave Request)
  | 'HOLIDAY'              // วันหยุดบริษัท
  | 'AWAITING_CORRECTION'  // Admin แจ้งให้แก้ไข รอผลลัพธ์
  | 'APPROVED';            // อนุมัติแล้ว พร้อมส่งคำนวณค่าจ้าง

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

  // --- ข้อมูลดิบจากทั้ง 2 แหล่ง ---
  dailyReportHours?: number;         // ชม. รวมจาก Daily Report (regularHours + otHours)
  scanDataHours?: number;            // ชม. รวมจาก Scan Data (regularHours + otHours)
  dailyReportId?: string;            // ref → DailyWorkerReport doc id
  scanDataId?: string;               // ref → scanData doc id
  suggestedHours?: number;           // min(dailyReportHours, scanDataHours) — UI hint เท่านั้น

  // --- สถานะ ---
  status: ReconciliationStatus;

  // --- Correction tracking ---
  correctionSentAt?: Date;           // วันที่ Admin ส่งแจ้ง
  correctionSentBy?: string;         // Admin userId ที่ส่งแจ้ง
  correctionNote?: string;           // ข้อความที่ Admin แจ้ง
  correctionExportedAt?: Date;       // วันที่ Export ออกไปแจ้งนอกระบบ

  // --- ป้องกัน Loop (Key Feature) ---
  statusHistory: StatusHistoryEntry[];

  // --- Approval (Admin เท่านั้น — ไม่มี Auto/Force Approve) ---
  approvedHours?: number;
  approvalSource?: ApprovalSource;
  approvedBy?: string;               // Admin userId
  approvedAt?: Date;
  approvalNote?: string;

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
}

export interface ApproveReconciliationInput {
  approvedHours: number;
  approvalSource: ApprovalSource;
  approvalNote?: string;
}

export interface SendCorrectionInput {
  note: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateReconciliationId(employeeId: string, workDate: string): string {
  return `REC_${employeeId}_${workDate}`;
}

/**
 * ตรวจสอบว่า Record นี้เคยมี AWAITING_CORRECTION มาก่อนหรือไม่
 * ใช้สำหรับแสดง Warning Banner ใน UI
 */
export function hadPreviousCorrection(record: ReconciliationRecord): boolean {
  return record.statusHistory.some((h) => h.status === 'AWAITING_CORRECTION');
}

/**
 * ดึง AWAITING_CORRECTION entries ล่าสุดจาก statusHistory
 * เพื่อแสดงรายละเอียดใน Warning Banner
 */
export function getLastCorrectionEntry(
  record: ReconciliationRecord,
): StatusHistoryEntry | undefined {
  return [...record.statusHistory]
    .reverse()
    .find((h) => h.status === 'AWAITING_CORRECTION');
}

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
    if (record.correctionSentAt !== undefined) data.correctionSentAt = record.correctionSentAt;
    if (record.correctionSentBy !== undefined) data.correctionSentBy = record.correctionSentBy;
    if (record.correctionNote !== undefined) data.correctionNote = record.correctionNote;
    if (record.correctionExportedAt !== undefined)
      data.correctionExportedAt = record.correctionExportedAt;
    if (record.statusHistory !== undefined) data.statusHistory = record.statusHistory;
    if (record.approvedHours !== undefined) data.approvedHours = record.approvedHours;
    if (record.approvalSource !== undefined) data.approvalSource = record.approvalSource;
    if (record.approvedBy !== undefined) data.approvedBy = record.approvedBy;
    if (record.approvedAt !== undefined) data.approvedAt = record.approvedAt;
    if (record.approvalNote !== undefined) data.approvalNote = record.approvalNote;
    if (record.createdAt !== undefined) data.createdAt = record.createdAt;
    if (record.updatedAt !== undefined) data.updatedAt = record.updatedAt;

    return data;
  },

  fromFirestore: (snapshot: any): ReconciliationRecord => {
    const data = snapshot.data();

    const toDate = (val: any): Date =>
      val?.toDate ? val.toDate() : val instanceof Date ? val : new Date();

    const toOptionalDate = (val: any): Date | undefined =>
      val ? (val?.toDate ? val.toDate() : val instanceof Date ? val : undefined) : undefined;

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
      dailyReportHours: data.dailyReportHours,
      scanDataHours: data.scanDataHours,
      dailyReportId: data.dailyReportId,
      scanDataId: data.scanDataId,
      suggestedHours: data.suggestedHours,
      status: data.status || 'PENDING',
      correctionSentAt: toOptionalDate(data.correctionSentAt),
      correctionSentBy: data.correctionSentBy,
      correctionNote: data.correctionNote,
      correctionExportedAt: toOptionalDate(data.correctionExportedAt),
      statusHistory: parseHistory(data.statusHistory),
      approvedHours: data.approvedHours,
      approvalSource: data.approvalSource,
      approvedBy: data.approvedBy,
      approvedAt: toOptionalDate(data.approvedAt),
      approvalNote: data.approvalNote,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  },
};
