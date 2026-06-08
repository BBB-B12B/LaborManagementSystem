import apiClient from './api/client';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'CONFLICTED'
  | 'MISSING_SCAN'
  | 'MISSING_DAILY'
  | 'ABSENT'
  | 'LEAVE'
  | 'PENDING_LEAVE_REVIEW'
  | 'HOLIDAY'
  | 'UNREGISTERED_EMPLOYEE';

// ลบ AWAITING_CORRECTION — Admin แจ้งนอกระบบเอง
// ลบ APPROVED — การล็อกข้อมูลทำผ่านงวดงาน (isLocked)

export type ApprovalSource = 'daily_report' | 'scan_data' | 'manual';

export interface StatusHistoryEntry {
  status: ReconciliationStatus;
  changedAt: string;
  changedBy: string;
  reason?: string;
  note?: string;
}

export interface ScanEditHistoryEntry {
  editedAt: string;
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


export interface ReconciliationRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  workDate: string;
  projectLocationId: string;   // โครงการที่ทำงานวันนั้น (work location)
  homeProjectId?: string;      // สังกัดถาวรของพนักงาน (ใช้ RBAC filter)
  workLocationIds?: string[];  // ทุกโครงการที่ทำงานในวันนั้น (แสดงใน UI)
  projectName?: string;
  dailyReportHours?: number;   // ยอดรวม (alias ใช้ใน UI)
  timesheetHours?: number;      // field จริงที่ Cloud Function เขียนลง Firestore
  timesheetNormalHours?: number;
  timesheetOtMorning?: number;
  timesheetOtNoon?: number;
  timesheetOtEvening?: number;
  scanDataHours?: number;       // ยอดรวม scan
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
  suggestedHours?: number;
  status: ReconciliationStatus;
  originalStatus?: ReconciliationStatus;
  isLocked?: boolean;
  resolvedAt?: string;          // Timestamp ISO string — set เมื่อ Admin แก้ไขสำเร็จ
  resolvedBy?: string;          // userId ของ Admin ที่แก้ไข
  statusHistory: StatusHistoryEntry[];
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
  createdAt: string;
  updatedAt: string;
  isHoliday?: boolean;
  leaveHours?: number;
  leaveEntries?: {
    type: string;
    hours: number;
    description?: string;
  }[];
  medCertFileUrl?: string; // Add medCertFileUrl
  hasLeave?: boolean;
  assigneeId?: string;
  assigneeName?: string;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  isLate?: boolean;
  isEarlyLeave?: boolean;
  note?: string;

  // --- Approved Hours (ยอดที่ใช้คิดเงินจริง หลังจากการ Resolve) ---
  approvedNormalHours?: number;
  approvedOtMorning?: number;
  approvedOtNoon?: number;
  approvedOtEvening?: number;
  totalApprovedHours?: number;
  approvalSource?: ApprovalSource;

  // --- Work Logs (บันทึกข้อมูลงานจาก Daily Report / After-Sale) ---
  workLogs?: {
    taskId?: string;
    taskName?: string;
    subtaskId?: string;
    subtaskName?: string;
    location?: string;
  }[];
  dailyReportHistory?: {
    editedAt: string;
    editedBy: string;
    snapshot: {
      labor: any[];
      leave?: any[];
    };
  }[];
  scanEditHistory?: ScanEditHistoryEntry[];
}


export interface ReconciliationFilter {
  projectLocationId?: string;   // กรองตาม work location (fallback)
  homeProjectId?: string;       // กรองตามสังกัด (RBAC หลัก)
  status?: string;
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  filterStatus?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedReconciliationResponse {
  records: ReconciliationRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApprovedTimesheet {
  id: string;
  employeeId: string;
  workDate: string;
  approvedHours: number;
}

export const reconciliationService = {
  /**
   * ดึงรายการ ReconciliationRecords ตาม filter พร้อม server-side pagination
   */
  getRecords: async (filter: ReconciliationFilter): Promise<PaginatedReconciliationResponse> => {
    const response = await apiClient.get<{
      success: boolean;
      data: ReconciliationRecord[];
      total: number;
      page: number;
      pageSize: number;
    }>('/reconciliation', { params: filter });
    return {
      records: response.data.data,
      total: response.data.total ?? 0,
      page: response.data.page ?? 0,
      pageSize: response.data.pageSize ?? 100,
    };
  },

  /**
   * ดึง record เดียว
   */
  getRecordById: async (id: string): Promise<ReconciliationRecord> => {
    const response = await apiClient.get<{ success: boolean; data: ReconciliationRecord }>(
      `/reconciliation/${id}`
    );
    return response.data.data;
  },

  /**
   * Auto-generate records (Project B + Local Scan)
   */
  generateForProjectAuto: async (params: {
    projectLocationId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ succeeded: number; failed: number; total: number }> => {
    const response = await apiClient.post<{
      success: boolean;
      succeeded: number;
      failed: number;
      total: number;
    }>('/reconciliation/generate-auto', params, { timeout: 60000 });
    return response.data;
  },

  /**
   * Admin ยืนยันตาม Daily Report (เติม Scan Data)
   */
  confirmByDailyReport: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/confirm-daily`, { reason });
  },

  /**
   * Admin แก้ไขชั่วโมงทำงานด้วยตนเอง (Manual Resolve)
   */
  resolveManual: async (
    id: string,
    payload: {
      normalHours?: number;
      otMorning?: number;
      otNoon?: number;
      otEvening?: number;
      reason?: string;
    }
  ): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/resolve-manual`, payload);
  },

  /**
   * Admin ลบ Ghost Scan
   */
  deleteGhostScan: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/delete-scan`, { reason });
  },
  
  /**
   * Admin แก้ไขเวลาสแกนนิ้ว
   */
  updateScanPunches: async (id: string, punches: string[], reason?: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/update-scan`, { punches, reason });
  },

  /**
   * Admin ตรวจสอบใบรับรองแพทย์ (Review Leave Status)
   */
  reviewLeaveStatus: async (id: string, isApproved: boolean, reason?: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/review-leave`, { isApproved, reason });
  },

  /**
   * Export รายการผิดปกติเป็น JSON
   */
  exportAnomalies: async (params: {
    projectLocationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(
      '/reconciliation/export',
      { params }
    );
    return response.data.data;
  },

  /**
   * Export ข้อมูล Reconciliation เป็นไฟล์ Excel (.xlsx)
   * @param params filterStatus, projectLocationId, startDate, endDate
   * @returns Blob ของไฟล์ Excel
   */
  exportToExcel: async (params: {
    filterStatus?: string;
    homeProjectId?: string;       // กรองตามสังกัด (RBAC หลัก)
    projectLocationId?: string;  // backward compat
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> => {
    const response = await apiClient.get('/reconciliation/export-excel', {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },



  /**
   * Helper: Trigger การดาวน์โหลดไฟล์ Excel จาก Blob
   */
  downloadExcelFile: (blob: Blob, filename: string): void => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * ดึงสถิติ aggregate counts สำหรับ SummaryStats
   * ใช้ Firestore Count Aggregate — ไม่โหลดข้อมูลทั้งหมด
   */
  getStats: async (params: {
    homeProjectId?: string;       // กรองตามสังกัด (RBAC หลัก)
    projectLocationId?: string;  // backward compat
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalRows: number;
    normalCount: number;
    matchedCount: number;
    otherCount: number;
    absentCount: number;
    leaveCount: number;
    pendingCount: number;
    resolvedCount: number;
    resolvedMatchedCount: number;
    resolvedLeaveCount: number;
    missingDailyCount: number;
    missingScanCount: number;
    conflictedCount: number;
    unregisteredCount: number;
    pendingLeaveCount: number;
    employeeCount: number;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      data: {
        totalRows: number;
        normalCount: number;
        matchedCount: number;
        otherCount: number;
        absentCount: number;
        leaveCount: number;
        pendingCount: number;
        resolvedCount: number;
        resolvedMatchedCount: number;
        resolvedLeaveCount: number;
        missingDailyCount: number;
        missingScanCount: number;
        conflictedCount: number;
        unregisteredCount: number;
        pendingLeaveCount: number;
        employeeCount: number;
      };
    }>('/reconciliation/stats', { params });
    return response.data.data;
  },

};
