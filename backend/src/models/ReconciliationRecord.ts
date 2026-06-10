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
  | 'PENDING' // รอระบบ classify
  | 'MATCHED' // ข้อมูลทั้ง 2 แหล่งตรงกัน
  | 'CONFLICTED' // ข้อมูลขัดแย้ง (มีทั้งคู่ แต่ชม. ไม่ตรง)
  | 'MISSING_SCAN' // มี Daily Report แต่ไม่มี Scan Data
  | 'MISSING_DAILY' // มีพนักงานในระบบ มี Scan Data แต่ไม่มี Daily Report
  | 'ABSENT' // ไม่มีข้อมูลทั้งคู่
  | 'LEAVE' // พนักงานลา (ยืนยันจาก Leave Request)
  | 'PENDING_LEAVE_REVIEW' // รอ Admin ตรวจสอบใบรับรองแพทย์
  | 'HOLIDAY' // วันหยุดบริษัท
  | 'UNREGISTERED_EMPLOYEE'; // มี Scan Data แต่รหัสพนักงานไม่มีในระบบ

export type ApprovalSource =
  | 'daily_report' // ยึดตาม Daily Report
  | 'scan_data' // ยึดตาม Scan Data
  | 'manual'; // Admin กำหนดเอง

/**
 * บันทึกประวัติการเปลี่ยนสถานะ — ใช้ป้องกัน Loop ซ้ำซ้อน
 * ทุกครั้งที่ status เปลี่ยน จะถูก append เข้า statusHistory[]
 */
export interface StatusHistoryEntry {
  status: ReconciliationStatus;
  changedAt: Date;
  changedBy: string; // 'system' | userId (Admin)
  reason?: string; // เหตุผลการเปลี่ยน
  note?: string | null; // โน้ตเพิ่มเติม (เช่น "daily report ถูกเพิ่มโดย user_05")
}

export interface DailyReportHistoryEntry {
  editedAt: Date;
  editedBy: string;
  snapshot: {
    labor: any[];
    leave?: any[];
  };
}

export interface ScanEditHistoryEntry {
  editedAt: Date;
  editedBy: string;
  action: 'manual_fill' | 'manual_create' | 'delete_ghost' | 'modify';
  reason: string;
  reconciliationRecordId?: string;
  snapshot: {
    punches: string[];
    firstIn?: string | null;
    lastOut?: string | null;
    regularHours?: number;
    otMorningHours?: number;
    otEveningHours?: number;
  };
}

// ---------------------------------------------------------------------------
// Main Interface
// ---------------------------------------------------------------------------

export interface ReconciliationRecord {
  id: string; // REC_{employeeId}_{workDate}
  employeeId: string;
  employeeName?: string; // Cache สำหรับ UI
  workDate: string; // YYYY-MM-DD
  projectLocationId: string; // โครงการที่ทำงานจริงวันนั้น (work location — จาก dailyReport)
  homeProjectId?: string; // สังกัดถาวรของพนักงาน (จาก dailyContractors.projectLocationId)
  // ใช้สำหรับ RBAC filter ในหน้าติดตามชั่วโมงการทำงาน
  workLocationIds?: string[]; // รายการโครงการที่ทำงานในวันนั้น (อาจมีมากกว่า 1 ถ้าไปช่วยหลายที่)
  projectName?: string; // Cache สำหรับ UI

  // --- สหรับข้อมูลดิบจากทั้ง 2 แหล่ง ---
  // Timesheet (After-Sale DailyEmployeeTimesheets)
  dailyReportHours?: number; // ยอดรวม (normal + OT)
  timesheetNormalHours?: number; // ชม. ปกติ (08:00-17:00)
  timesheetOtMorning?: number; // OT เช้า (05:00-08:00)
  timesheetOtNoon?: number; // OT ผ่าเที่ยง (12:00-13:00)
  timesheetOtEvening?: number; // OT เย็น (17:00-22:00)
  // Scan Data
  scanDataHours?: number; // ยอดรวม (normal + OT)
  scanNormalHours?: number; // ชม. ปกติ
  scanOtMorningHours?: number; // OT เช้า
  scanOtNoonHours?: number; // OT ผ่าเที่ยง
  scanOtEveningHours?: number; // OT เย็น

  shiftTimes?: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
    otNoon?: string;
  };

  dailyReportId?: string; // ref → DailyWorkerReport doc id
  scanDataId?: string; // ref → scanData doc id
  suggestedHours?: number; // min(dailyReportHours, scanDataHours) — UI hint เท่านั้น
  dailyReportPhotos?: {
    regular?: string[]; // [IN 08:00, OUT 12:00, IN 13:00, OUT 17:00]
    otMorning?: { in?: string; out?: string };
    otNoon?: { in?: string; out?: string };
    otEvening?: { in?: string; out?: string };
  }; // รูปถ่ายอ้างอิงจาก Daily Report (Aftersale)
  dailyReportPunches?: string[]; // Array ของเวลาจาก Daily Report เช่น ["08:00", "17:00"]
  scanPunches?: string[]; // Array ของเวลาสแกนนิ้ว
  devicePunches?: string[]; // Array ของเวลาสแกนนิ้วดิบจากเครื่อง

  // --- Punch Coverage Analysis (logic ใหม่ แทน hours comparison) ---
  lateMinutes?: number; // สายกี่นาที (scanFirstIn > reportStart)
  earlyLeaveMinutes?: number; // ออกก่อนกี่นาที (scanLastOut < reportEnd)
  isLate?: boolean; // flag สำหรับ filter/query
  isEarlyLeave?: boolean; // flag สำหรับ filter/query
  note?: string | null; // หมายเหตุจากระบบ (เช่น สาเหตุที่ขัดแย้ง)

  // --- สถานะ ---
  status: ReconciliationStatus;
  isHoliday?: boolean; // วันหยุดบริษัท
  leaveHours?: number; // จำนวนชั่วโมงที่ลา
  leaveEntries?: any[]; // ข้อมูลการลาเพิ่มเติม
  hasLeave?: boolean; // Flag ระบุว่ามีการลางาน (ใช้ฟิลเตอร์)
  medCertFileUrl?: string; // รูปภาพเอกสารการลา
  isLeaveReviewed?: boolean; // Admin กดยืนยันใบลาแล้วหรือยัง

  // --- Approved Hours (ยอดที่ใช้คิดเงินจริง หลังจากการ Resolve) ---
  // ถ้า Admin แก้ไขเอง จะใช้ค่าเหล่านี้แทนค่าจาก Daily/Scan
  approvedNormalHours?: number;
  approvedOtMorning?: number;
  approvedOtNoon?: number;
  approvedOtEvening?: number;
  totalApprovedHours?: number; // ยอดรวมทั้งหมดที่อนุมัติ
  approvalSource?: ApprovalSource; // 'daily_report' | 'scan_data' | 'manual'

  // --- Locking (ผูกกับงวดงาน — ไม่ใช่ approve รายวัน) ---
  // เมื่อ Admin Approve งวดงาน onWagePeriodApproved จะตั้ง isLocked: true อัตโนมัติ
  isLocked?: boolean;

  // --- Resolution Tracking ---
  // set เมื่อ Admin ยืนยันแก้ไข record ที่เคยผิดปกติ (status สำเร็จเป็น MATCHED)
  // null = ยังไม่เคยแก้ไข (หรือปกติตั้งแต่แรก)
  resolvedAt?: Date; // Timestamp ที่แก้ไขสำเร็จ
  resolvedBy?: string; // userId ของ Admin ที่แก้ไข

  // --- Audit Trail ---
  statusHistory: StatusHistoryEntry[];
  dailyReportHistory?: DailyReportHistoryEntry[];
  scanEditHistory?: ScanEditHistoryEntry[];

  // --- Metadata ---
  assigneeId?: string; // รหัสโฟร์แมนที่รับผิดชอบ (AssigneesID จาก After-Sale)
  assigneeName?: string; // ชื่อโฟร์แมน (fullNameEn จาก users collection)
  isFallbackAssignee?: boolean; // ถูกดึงมาจาก foremanUsage (สถิติ) แทนที่จะเป็นข้อมูลจริงหรือไม่
  workLogs?: any[];
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
  projectLocationId: string; // โครงการที่ทำงานจริงวันนั้น
  homeProjectId?: string; // สังกัดถาวรของพนักงาน
  workLocationIds?: string[]; // รายการโครงการที่ทำงานในวันนั้น
  projectName?: string;
  dailyReportHours?: number;
  timesheetNormalHours?: number;
  timesheetOtMorning?: number;
  timesheetOtNoon?: number;
  timesheetOtEvening?: number;
  scanDataHours?: number;
  scanNormalHours?: number;
  scanOtMorningHours?: number;
  scanOtNoonHours?: number;
  scanOtEveningHours?: number;
  shiftTimes?: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
    otNoon?: string;
  };
  dailyReportId?: string;
  scanDataId?: string;
  dailyReportPhotos?: {
    regular?: string[];
    otMorning?: { in?: string; out?: string };
    otNoon?: { in?: string; out?: string };
    otEvening?: { in?: string; out?: string };
  };
  dailyReportPunches?: string[];
  scanPunches?: string[];
  devicePunches?: string[];
  note?: string | null;
  isHoliday?: boolean;
  leaveHours?: number;
  leaveEntries?: {
    type: string;
    hours: number;
    description?: string;
  }[];
  medCertFileUrl?: string; // Add medCertFileUrl
  isLeaveReviewed?: boolean;
  hasLeave?: boolean;
  assigneeId?: string;
  assigneeName?: string;
  isFallbackAssignee?: boolean;
  workLogs?: any[];
  dailyReportHistory?: any[];
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
    if (record.homeProjectId !== undefined) data.homeProjectId = record.homeProjectId;
    if (record.workLocationIds !== undefined) data.workLocationIds = record.workLocationIds;
    if (record.projectName !== undefined) data.projectName = record.projectName;
    if (record.dailyReportHours !== undefined) data.dailyReportHours = record.dailyReportHours;
    if (record.timesheetNormalHours !== undefined)
      data.timesheetNormalHours = record.timesheetNormalHours;
    if (record.timesheetOtMorning !== undefined)
      data.timesheetOtMorning = record.timesheetOtMorning;
    if (record.timesheetOtNoon !== undefined) data.timesheetOtNoon = record.timesheetOtNoon;
    if (record.timesheetOtEvening !== undefined)
      data.timesheetOtEvening = record.timesheetOtEvening;
    if (record.scanDataHours !== undefined) data.scanDataHours = record.scanDataHours;
    if (record.scanNormalHours !== undefined) data.scanNormalHours = record.scanNormalHours;
    if (record.scanOtMorningHours !== undefined)
      data.scanOtMorningHours = record.scanOtMorningHours;
    if (record.scanOtNoonHours !== undefined) data.scanOtNoonHours = record.scanOtNoonHours;
    if (record.scanOtEveningHours !== undefined)
      data.scanOtEveningHours = record.scanOtEveningHours;
    if (record.shiftTimes !== undefined) data.shiftTimes = record.shiftTimes;
    if (record.dailyReportId !== undefined) data.dailyReportId = record.dailyReportId;
    if (record.scanDataId !== undefined) data.scanDataId = record.scanDataId;
    if (record.dailyReportPhotos !== undefined) data.dailyReportPhotos = record.dailyReportPhotos;
    if (record.dailyReportPunches !== undefined)
      data.dailyReportPunches = record.dailyReportPunches;
    if (record.scanPunches !== undefined) data.scanPunches = record.scanPunches;
    if (record.devicePunches !== undefined) data.devicePunches = record.devicePunches;
    if (record.suggestedHours !== undefined) data.suggestedHours = record.suggestedHours;
    if (record.lateMinutes !== undefined) data.lateMinutes = record.lateMinutes;
    if (record.earlyLeaveMinutes !== undefined) data.earlyLeaveMinutes = record.earlyLeaveMinutes;
    if (record.isLate !== undefined) data.isLate = record.isLate;
    if (record.isEarlyLeave !== undefined) data.isEarlyLeave = record.isEarlyLeave;
    if (record.note !== undefined) data.note = record.note;
    if (record.status !== undefined) data.status = record.status;
    if (record.isLocked !== undefined) data.isLocked = record.isLocked;
    if (record.resolvedAt !== undefined) data.resolvedAt = record.resolvedAt;
    if (record.resolvedBy !== undefined) data.resolvedBy = record.resolvedBy;
    if (record.statusHistory !== undefined) {
      data.statusHistory = record.statusHistory.map((entry) => {
        const cleanEntry: any = { ...entry };
        if (cleanEntry.reason === undefined) delete cleanEntry.reason;
        if (cleanEntry.note === undefined) delete cleanEntry.note;
        return cleanEntry;
      });
    }
    if (record.dailyReportHistory !== undefined) {
      data.dailyReportHistory = record.dailyReportHistory.map((entry) => ({
        editedAt: entry.editedAt,
        editedBy: entry.editedBy,
        snapshot: entry.snapshot,
      }));
    }
    if (record.scanEditHistory !== undefined) {
      data.scanEditHistory = record.scanEditHistory.map((entry) => ({
        editedAt: entry.editedAt,
        editedBy: entry.editedBy,
        action: entry.action,
        reason: entry.reason,
        reconciliationRecordId: entry.reconciliationRecordId,
        snapshot: entry.snapshot,
      }));
    }

    if (record.createdAt !== undefined) data.createdAt = record.createdAt;
    if (record.updatedAt !== undefined) data.updatedAt = record.updatedAt;
    if (record.assigneeId !== undefined) data.assigneeId = record.assigneeId;
    if (record.assigneeName !== undefined) data.assigneeName = record.assigneeName;
    if (record.isFallbackAssignee !== undefined)
      data.isFallbackAssignee = record.isFallbackAssignee;
    if (record.workLogs !== undefined) data.workLogs = record.workLogs;

    // Approved Hours
    if (record.approvedNormalHours !== undefined)
      data.approvedNormalHours = record.approvedNormalHours;
    if (record.approvedOtMorning !== undefined) data.approvedOtMorning = record.approvedOtMorning;
    if (record.approvedOtNoon !== undefined) data.approvedOtNoon = record.approvedOtNoon;
    if (record.approvedOtEvening !== undefined) data.approvedOtEvening = record.approvedOtEvening;
    if (record.totalApprovedHours !== undefined)
      data.totalApprovedHours = record.totalApprovedHours;
    if (record.approvalSource !== undefined) data.approvalSource = record.approvalSource;

    // Additional properties
    if ('isHoliday' in record) data.isHoliday = record.isHoliday;
    if ('leaveHours' in record) data.leaveHours = record.leaveHours;
    if ('leaveEntries' in record) data.leaveEntries = record.leaveEntries;
    if ('medCertFileUrl' in record) data.medCertFileUrl = record.medCertFileUrl;
    if ('isLeaveReviewed' in record) data.isLeaveReviewed = record.isLeaveReviewed;
    if ('hasLeave' in record) data.hasLeave = record.hasLeave;

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

    const parseDailyReportHistory = (arr: any[]): DailyReportHistoryEntry[] =>
      (arr || []).map((h) => ({
        editedAt: toDate(h.editedAt),
        editedBy: h.editedBy,
        snapshot: h.snapshot || { labor: [], leave: [] },
      }));

    const parseScanEditHistory = (arr: any[]): ScanEditHistoryEntry[] =>
      (arr || []).map((h) => ({
        editedAt: toDate(h.editedAt),
        editedBy: h.editedBy,
        action: h.action,
        reason: h.reason,
        reconciliationRecordId: h.reconciliationRecordId,
        snapshot: h.snapshot || { punches: [] },
      }));

    const parsedScanEditHistory = parseScanEditHistory(data.scanEditHistory);
    let devicePunches = data.devicePunches || [];
    if (devicePunches.length === 0) {
      if (parsedScanEditHistory && parsedScanEditHistory.length > 0) {
        const sortedHistory = [...parsedScanEditHistory].sort((a, b) => {
          const dateA = a.editedAt instanceof Date ? a.editedAt : new Date(a.editedAt);
          const dateB = b.editedAt instanceof Date ? b.editedAt : new Date(b.editedAt);
          return dateA.getTime() - dateB.getTime();
        });
        const earliestEdit = sortedHistory[0];
        devicePunches = earliestEdit?.snapshot?.punches || [];
      } else {
        devicePunches = data.scanPunches || [];
      }
    }

    return {
      id: snapshot.id,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      workDate: data.workDate,
      projectLocationId: data.projectLocationId,
      homeProjectId: data.homeProjectId,
      workLocationIds: data.workLocationIds,
      projectName: data.projectName,
      // Cloud Function เขียนเป็น timesheetHours, backend model ใช้ dailyReportHours
      dailyReportHours: data.timesheetHours ?? data.dailyReportHours,
      timesheetNormalHours: data.timesheetNormalHours,
      timesheetOtMorning: data.timesheetOtMorning,
      timesheetOtNoon: data.timesheetOtNoon,
      timesheetOtEvening: data.timesheetOtEvening,
      scanDataHours: data.scanDataHours,
      scanNormalHours: data.scanNormalHours,
      scanOtMorningHours: data.scanOtMorningHours,
      scanOtNoonHours: data.scanOtNoonHours,
      scanOtEveningHours: data.scanOtEveningHours,
      shiftTimes: data.shiftTimes,
      dailyReportId: data.dailyReportId,
      scanDataId: data.scanDataId,
      dailyReportPhotos: data.dailyReportPhotos,
      dailyReportPunches: data.dailyReportPunches,
      scanPunches: data.scanPunches,
      devicePunches: devicePunches,
      suggestedHours: data.suggestedHours,
      lateMinutes: data.lateMinutes,
      earlyLeaveMinutes: data.earlyLeaveMinutes,
      isLate: data.isLate,
      isEarlyLeave: data.isEarlyLeave,
      note: data.note,
      status: data.status || 'PENDING',
      isLocked: data.isLocked ?? false,
      resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : undefined,
      resolvedBy: data.resolvedBy,
      statusHistory: parseHistory(data.statusHistory),
      dailyReportHistory: parseDailyReportHistory(data.dailyReportHistory),
      scanEditHistory: parsedScanEditHistory,
      createdAt: toDate(data.createdAt),

      updatedAt: toDate(data.updatedAt),
      assigneeId: data.assigneeId,
      assigneeName: data.assigneeName,
      isFallbackAssignee: data.isFallbackAssignee,
      workLogs: data.workLogs,
      // Approved Hours
      approvedNormalHours: data.approvedNormalHours,
      approvedOtMorning: data.approvedOtMorning,
      approvedOtNoon: data.approvedOtNoon,
      approvedOtEvening: data.approvedOtEvening,
      totalApprovedHours: data.totalApprovedHours,
      approvalSource: data.approvalSource,
      // Leave & Holiday
      ...(data.isHoliday !== undefined && { isHoliday: data.isHoliday }),
      ...(data.leaveHours !== undefined && { leaveHours: data.leaveHours }),
      ...(data.leaveEntries !== undefined && { leaveEntries: data.leaveEntries }),
      ...(data.medCertFileUrl !== undefined && { medCertFileUrl: data.medCertFileUrl }),
      ...(data.isLeaveReviewed !== undefined && { isLeaveReviewed: data.isLeaveReviewed }),
      ...(data.hasLeave !== undefined && { hasLeave: data.hasLeave }),
    };
  },
};
