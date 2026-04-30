import apiClient from './api/client';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'CONFLICTED'
  | 'MISSING_SCAN'
  | 'MISSING_DAILY'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'UNREGISTERED_EMPLOYEE';

// ลบ AWAITING_CORRECTION — Admin แจ้งนอกระบบเอง
// ลบ APPROVED — การล็อกข้อมูลทำผ่านงวดงาน (isLocked)

export type ApprovalSource = 'DAILY_REPORT' | 'SCAN_DATA' | 'MANUAL';

export interface StatusHistoryEntry {
  status: ReconciliationStatus;
  changedAt: string;
  changedBy: string;
  reason?: string;
  note?: string;
}

export interface ReconciliationRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  workDate: string;
  projectLocationId: string;
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
  suggestedHours?: number;
  status: ReconciliationStatus;
  isLocked?: boolean;           // ถูกล็อกโดยงวดงาน (onWagePeriodApproved)
  statusHistory: StatusHistoryEntry[];
  dailyReportId?: string;
  scanDataId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationFilter {
  projectLocationId?: string;
  status?: string; // Comma separated or single status
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

export interface ApprovedTimesheet {
  id: string;
  employeeId: string;
  workDate: string;
  approvedHours: number;
}

export const reconciliationService = {
  /**
   * ดึงรายการ ReconciliationRecords ตาม filter
   */
  getRecords: async (filter: ReconciliationFilter): Promise<ReconciliationRecord[]> => {
    const response = await apiClient.get<{ success: boolean; data: ReconciliationRecord[] }>(
      '/reconciliation',
      { params: filter }
    );
    return response.data.data;
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
    }>('/reconciliation/generate-auto', params);
    return response.data;
  },

  /**
   * Admin ยืนยันตาม Daily Report (เติม Scan Data)
   */
  confirmByDailyReport: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/confirm-daily`, { reason });
  },

  /**
   * Admin ลบ Ghost Scan
   */
  deleteGhostScan: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/delete-scan`, { reason });
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
   * สร้าง/อัปเดตข้อมูลอัตโนมัติ สำหรับโปรเจกต์และช่วงวันที่
   */
  generateForProjectAuto: async (data: {
    projectLocationId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; summary?: any }> => {
    const response = await apiClient.post('/reconciliation/generate-auto', data);
    return response.data;
  },
};

