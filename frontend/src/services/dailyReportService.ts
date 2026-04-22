/**
 * Daily Report Service (Frontend)
 * บริการสำหรับจัดการข้อมูลรายงานการทำงานรายวัน
 */

import apiClient from './api/client';

export type WorkType = 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';
export type ReportStatus = 'draft' | 'submitted' | 'verified' | 'locked';

export interface DailyReportEntry {
  id: string; // UUID
  dailyContractorId: string;
  employeeId?: string;
  taskId?: string; // [T-400] เชื่อมโยงกับ Task ID
  taskName: string;
  workType: WorkType;
  hours: number; // [PIVOT] เราจะเก็บ "ชั่วโมงทำงาน" ทันที ไม่ใช้ช่วงเวลา
  notes?: string;
  createdAt: string; // ISO String
}

export interface DailyReportSummary {
  workerCount: number;
  totalNetHours: number;
  regularHours: number;
  otHours: number;
  lastImportAt?: string;
}

export interface DailyWorkerReport {
  id: string; // dailyContractorId
  dailyContractorId: string;
  employeeId: string;
  workerName: string;
  
  // [ALIGNMENT] ฟิลด์ที่สอดคล้องกับ ScanData ของทีม
  regularHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
  totalNetHours: number;

  entries: DailyReportEntry[];
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  projectLocationId: string;
  date: string; // ISO String or YYYY-MM-DD
  status: ReportStatus;
  summary: DailyReportSummary; // [CACHE] ข้อมูลสรุปภาพรวม
  notes?: string;
  importFileUrls?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface AddEntryInput {
  projectId: string;
  date: Date;
  entry: Omit<DailyReportEntry, 'id' | 'createdAt'>;
}

export interface DailyReportImportResult {
  success: boolean;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{ row: number; error: string; employeeNumber?: string }>;
  warnings: string[];
  importBatchId?: string;
}

class DailyReportService {

  /**
   * Get Report by Project & Date
   */
  async getByProjectAndDate(projectId: string, date: Date): Promise<DailyReport | null> {
    const dateStr = date.toISOString().split('T')[0];
    const { data } = await apiClient.get<DailyReport | null>(`/daily-reports/project/${projectId}/date/${dateStr}`);
    return data;
  }

  /**
   * Add Work Entry (Upsert Report)
   */
  async addWorkEntry(input: AddEntryInput): Promise<DailyReport> {
    const { data } = await apiClient.post<DailyReport>('/daily-reports/entry', {
      projectId: input.projectId,
      date: input.date.toISOString(),
      entry: {
        ...input.entry,
        hours: Number(input.entry.hours || 0)
      }
    });
    return data;
  }

  /**
   * Remove Work Entry
   */
  async removeWorkEntry(projectId: string, date: Date, workerId: string, entryId: string): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    await apiClient.delete(`/daily-reports/project/${projectId}/date/${dateStr}/worker/${workerId}/entry/${entryId}`);
  }

  /**
   * Get Reports by Month (For List/Calendar)
   */
  async getByProjectAndMonth(projectId: string, year: number, month: number): Promise<DailyReport[]> {
    const { data } = await apiClient.get<DailyReport[]>(`/daily-reports/project/${projectId}/month/${year}/${month}`);
    return data;
  }

  // ==========================================
  // Legacy Adapter Methods (For Desktop UI Compatibility)
  // ==========================================

  /**
   * Adapter: Create (Maps to addWorkEntry loop)
   */
  async create(data: any): Promise<any> {
    const results = [];
    const dcIds = data.dailyContractorIds || [];

    for (const dcId of dcIds) {
      const entryData = {
        dailyContractorId: dcId,
        taskId: data.taskId,
        taskName: data.taskName,
        workType: data.workType || 'regular',
        hours: Number(data.workHours || 0),
        notes: data.notes
      };

      const result = await this.addWorkEntry({
        projectId: data.projectLocationId,
        date: data.workDate,
        entry: entryData as any
      });
      results.push(result);
    }
    return results;
  }

  /**
   * Adapter: GetAll (Flattens aggregated reports)
   */
  async getAll(filters: any): Promise<any[]> {
    let reports: DailyReport[] = [];

    if (filters?.projectId && filters?.date) {
      const report = await this.getByProjectAndDate(filters.projectId, new Date(filters.date));
      if (report) reports.push(report);
    } else if (filters?.projectId) {
      const now = new Date();
      reports = await this.getByProjectAndMonth(filters.projectId, now.getFullYear(), now.getMonth() + 1);
    } else {
      return [];
    }

    const flattened = [];
    for (const report of reports) {
      const entries = (report as any).entries || [];
      for (const entry of entries) {
        flattened.push({
          // Composite ID: [projectId]|[date]|[workerId]|[entryId]
          id: `${report.projectLocationId}|${report.date}|${entry.dailyContractorId}|${entry.id}`,
          projectLocationId: report.projectLocationId,
          reportDate: new Date(report.date),
          dailyContractorIds: [entry.dailyContractorId],
          dcNames: [entry.dailyContractorId],
          taskId: entry.taskId,
          workDescription: entry.taskName,
          workHours: entry.hours,
          workType: entry.workType,
          createdAt: entry.createdAt,
          entryId: entry.id
        });
      }
    }
    return flattened;
  }

  /**
   * Adapter: Delete
   */
  async delete(compositeId: string): Promise<void> {
    const parts = compositeId.split('|');
    if (parts.length === 4) {
      const [projectId, dateStr, workerId, entryId] = parts;
      await this.removeWorkEntry(projectId, new Date(dateStr), workerId, entryId);
    }
  }

  /**
   * Adapter: Update
   */
  async update(compositeId: string, data: any): Promise<any> {
    // Hack: Delete then Create
    await this.delete(compositeId);
    return this.create(data);
  }

  /**
   * Adapter: Get By ID
   */
  async getById(compositeId: string): Promise<any> {
    try {
      const parts = compositeId.split('|');
      if (parts.length !== 3) return null;

      const [projectId, dateStr, entryId] = parts;
      const report = await this.getByProjectAndDate(projectId, new Date(dateStr));

      const entries = (report as any)?.entries || [];
      const entry = entries.find((e: any) => e.id === entryId);
      if (!entry) return null;

      return {
        id: compositeId,
        projectLocationId: report?.projectLocationId,
        reportDate: new Date(report?.date || ''),
        dailyContractorIds: [entry.dailyContractorId],
        workDescription: entry.taskName,
        workHours: entry.hours,
        workType: entry.workType,
        notes: entry.notes,
        createdAt: entry.createdAt,
        status: report?.status
      };

    } catch (error) {
      console.error("Failed to get report by ID", error);
      return null;
    }
  }

  /**
   * Adapter: Get History (Legacy History Page)
   * Returning empty array as History Tracking is not yet implemented in Aggregated Schema
   */
  async getHistory(id: string): Promise<any[]> {
    return [];
  }



  /**
   * Upload and Commit Daily Report Excel
   * กระบวนการ 2 จังหวะ: Upload (Preview) -> Commit (Bulk Create)
   * เพื่อความสอดคล้องกับ UX ของ ScanData
   */
  async uploadDailyReportFile(file: File, projectId: string, note?: string): Promise<DailyReportImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (note) formData.append('importNote', note);

    // Step 1: Upload & Parse
    const { data: uploadResp } = await apiClient.post('/daily-reports/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!uploadResp.success) {
      throw new Error(uploadResp.error || 'Failed to parse Excel file');
    }

    const previewData = uploadResp.data || [];
    const importFileUrl = uploadResp.importFileUrl;

    const validRows = previewData.filter((row: any) => row.isValid);
    const failedData = previewData.filter((row: any) => !row.isValid);

    if (validRows.length === 0 && failedData.length === 0) {
      return {
        success: false,
        totalRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        errors: [{
          row: 0,
          error: 'ไม่พบ Sheet ที่มีหัวตารางที่ถูกต้อง (เช่น รหัสพนักงาน, วันที่) กรุณาตรวจสอบไฟล์อีกครั้ง'
        }],
        warnings: []
      };
    }

    // [FIX] T-EX-IMPORT-1: Expand rows ก่อน commit
    // Excel row 1 แถว = หลาย WorkType → ต้อง Expand เป็น items แยก 1 ต่อ 1
    // เพราะ backend bulkCreateDailyReports รอรับ { hours, workType, taskName } ต่อ item
    const expandedItems = this.expandRowsToItems(validRows);

    if (expandedItems.length === 0) {
      return {
        success: false,
        totalRecords: previewData.length,
        successfulRecords: 0,
        failedRecords: failedData.length,
        errors: [{ row: 0, error: 'ไม่พบรายการที่มีชั่วโมงทำงาน กรุณาตรวจสอบข้อมูลในไฟล์ Excel' }],
        warnings: []
      };
    }

    // Step 2: Commit (Bulk Create) ด้วย expanded items
    const { data: commitResp } = await apiClient.post('/daily-reports/bulk-create', {
      data: expandedItems,
      importFileUrl: importFileUrl
    });

    return {
      success: commitResp.success,
      totalRecords: previewData.length,
      successfulRecords: commitResp.count || 0,
      failedRecords: failedData.length,
      errors: failedData.map((row: any) => ({
        row: row.row || 0,
        error: 'ข้อมูลโครงการหรือพนักงานไม่ถูกต้อง',
        employeeNumber: row.employeeId
      })),
      warnings: [],
      importBatchId: importFileUrl
    };
  }

  /**
   * [FIX] Expand Excel Rows → Flat Work Items (1 per WorkType)
   *
   * Excel row format (v3): { hoursRegular, hoursOTMorning, hoursOTNoon, hoursOTEvening, ... }
   * Backend expected per item: { hours, workType, taskName, date, dailyContractorId, projectLocationId }
   *
   * แก้ข้อผิดพลาด: item.hours = 0 เสมอ เพราะ field ชื่อ "hours" ไม่มีใน parsed row โดยตรง
   */
  private expandRowsToItems(rows: any[]): any[] {
    const items: any[] = [];

    for (const row of rows) {
      // ข้อมูลพื้นฐานที่ทุก item ใช้ร่วมกัน
      const base = {
        date: row.date,
        employeeId: row.employeeId,
        dailyContractorId: row.dailyContractorId,
        projectLocationId: row.projectLocationId,
        workerName: row.workerName,
        matchedWorkerName: row.matchedWorkerName || row.workerName,
        isValid: true,
      };

      // Regular Work — ชั่วโมงปกติ
      if (row.hoursRegular && Number(row.hoursRegular) > 0) {
        items.push({
          ...base,
          hours: Number(row.hoursRegular),
          workType: 'regular',
          taskName: row.taskRegular || 'งานทั่วไป',
        });
      }

      // OT Morning — โอทีเช้า
      if (row.hoursOTMorning && Number(row.hoursOTMorning) > 0) {
        items.push({
          ...base,
          hours: Number(row.hoursOTMorning),
          workType: 'ot_morning',
          taskName: row.taskOTMorning || 'โอทีเช้า',
        });
      }

      // OT Noon — โอทีเที่ยง
      if (row.hoursOTNoon && Number(row.hoursOTNoon) > 0) {
        items.push({
          ...base,
          hours: Number(row.hoursOTNoon),
          workType: 'ot_noon',
          taskName: row.taskOTNoon || 'โอทีเที่ยง',
        });
      }

      // OT Evening — โอทีเย็น
      if (row.hoursOTEvening && Number(row.hoursOTEvening) > 0) {
        items.push({
          ...base,
          hours: Number(row.hoursOTEvening),
          workType: 'ot_evening',
          taskName: row.taskOTEvening || 'โอทีเย็น',
        });
      }
    }

    return items;
  }

  /**
   * Submit Daily Report for a specific Task (Task-Centric)
   * [F-015] workOrders/{woId}/categories/{catId}/tasks/{taskId}/dailyReports/{dateStr}
   */
  async submitTaskReport(taskId: string, data: any): Promise<any> {
    const { data: response } = await apiClient.post(`/tasks/${taskId}/reports`, data);
    return response;
  }

  /**
   * Fetch Daily Report for a specific Task and Date
   */
  async getTaskReport(taskId: string, dateStr: string): Promise<any> {
    const { data: response } = await apiClient.get(`/tasks/${taskId}/reports/${dateStr}`);
    return response.data;
  }

  /**
   * Upload multiple photos
   */
  async uploadPhotos(files: File[], folder: string = 'daily-reports'): Promise<string[]> {
    if (files.length === 0) return [];
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('folder', folder);

    const { data: response } = await apiClient.post('/media/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (!response.success) throw new Error(response.error || 'Failed to upload photos');
    
    return response.data.map((item: any) => item.url);
  }
}


export const dailyReportService = new DailyReportService();
export default dailyReportService;

