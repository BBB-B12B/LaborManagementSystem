import apiClient from './api/client';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'CONFLICTED'
  | 'MISSING_SCAN'
  | 'MISSING_DAILY'
  | 'AWAITING_CORRECTION'
  | 'APPROVED'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY';

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
  dailyReportHours?: number;
  scanDataHours?: number;
  suggestedHours?: number;
  status: ReconciliationStatus;
  statusHistory: StatusHistoryEntry[];
  dailyReportId?: string;
  scanDataId?: string;
  correctionSentAt?: string;
  correctionSentBy?: string;
  correctionNote?: string;
  correctionExportedAt?: string;
  approvedHours?: number;
  approvalSource?: ApprovalSource;
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string;
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
   * Admin Approve → ลง ApprovedTimesheets
   */
  approveRecord: async (
    id: string,
    data: { approvedHours: number; approvalSource: ApprovalSource; approvalNote?: string }
  ): Promise<ApprovedTimesheet> => {
    const response = await apiClient.post<{ success: boolean; data: ApprovedTimesheet }>(
      `/reconciliation/${id}/approve`,
      data
    );
    return response.data.data;
  },

  /**
   * Admin แจ้งแก้ไข
   */
  sendCorrection: async (id: string, note: string): Promise<void> => {
    await apiClient.post(`/reconciliation/${id}/correct`, { note });
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
   * Mark รายการว่า Export แจ้งนอกระบบแล้ว
   */
  markAsExported: async (recordIds: string[]): Promise<void> => {
    await apiClient.post('/reconciliation/mark-exported', { recordIds });
  },
};
