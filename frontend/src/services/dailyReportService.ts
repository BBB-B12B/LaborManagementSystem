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
  taskName: string;
  workType: WorkType;
  startTime: string; // ISO String
  endTime: string;   // ISO String
  totalHours: number;
  netHours: number;
  notes?: string;
  fileAttachmentIds?: string[];
  createdAt: string; // ISO String
}

export interface DailyReport {
  id: string;
  projectLocationId: string;
  date: string; // ISO String or YYYY-MM-DD
  entries: DailyReportEntry[];
  status: ReportStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface AddEntryInput {
  projectId: string;
  date: Date;
  entry: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>;
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
        startTime: new Date(input.entry.startTime).toISOString(),
        endTime: new Date(input.entry.endTime).toISOString()
      }
    });
    return data;
  }

  /**
   * Remove Work Entry
   */
  async removeWorkEntry(projectId: string, date: Date, entryId: string): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    await apiClient.delete(`/daily-reports/project/${projectId}/date/${dateStr}/entry/${entryId}`);
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
    // If data comes from legacy form, it has dailyContractorIds array
    const dcIds = data.dailyContractorIds || [];

    for (const dcId of dcIds) {
      // Construct entry
      const entryData = {
        dailyContractorId: dcId,
        taskName: data.taskName,
        workType: data.workType || 'regular',
        startTime: typeof data.startTime === 'string'
          ? new Date(`${data.workDate.toISOString().split('T')[0]}T${data.startTime}:00`)
          : data.startTime,
        endTime: typeof data.endTime === 'string'
          ? new Date(`${data.workDate.toISOString().split('T')[0]}T${data.endTime}:00`)
          : data.endTime,
        netHours: data.netHours || 0,
        notes: data.notes,
        fileAttachmentIds: data.imageUrls // Legacy field mapping
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
   * Note: This is an approximation. It tries to fetch by project/date if available.
   * If not, it defaults to current month/project.
   */
  async getAll(filters: any): Promise<any[]> {
    let reports: DailyReport[] = [];

    if (filters?.projectId && filters?.date) {
      const report = await this.getByProjectAndDate(filters.projectId, new Date(filters.date));
      if (report) reports.push(report);
    } else if (filters?.projectId) {
      // Default to current month if only project specified
      const now = new Date();
      reports = await this.getByProjectAndMonth(filters.projectId, now.getFullYear(), now.getMonth() + 1);
    } else {
      // Fallback: Return empty or handle as needed. 
      // Warning: Fetches without project are expensive/not supported by new API efficiently yet.
      return [];
    }

    // Flatten entries to look like old DailyReport objects
    const flattened = [];
    for (const report of reports) {
      if (!report.entries) continue;
      for (const entry of report.entries) {
        flattened.push({
          // Composite ID for legacy actions (delete/update)
          id: `${report.projectLocationId}|${report.date}|${entry.id}`,

          // Fields expected by Index.tsx
          projectLocationId: report.projectLocationId,
          reportDate: new Date(report.date), // Ensure Date object
          dailyContractorIds: [entry.dailyContractorId], // Array of 1
          dcNames: [entry.dailyContractorId], // We don't have names here, might need lookup or UI handles it
          workDescription: entry.taskName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          workHours: entry.netHours,
          totalWage: 0, // Not calculated here
          workType: entry.workType,
          createdAt: entry.createdAt,
          // Add original entry ID for reference
          entryId: entry.id
        });
      }
    }
    return flattened;
  }

  /**
   * Adapter: Delete
   * Expects composite ID: "projectId|date|entryId"
   */
  async delete(compositeId: string): Promise<void> {
    const parts = compositeId.split('|');
    if (parts.length === 3) {
      const [projectId, dateStr, entryId] = parts;
      await this.removeWorkEntry(projectId, new Date(dateStr), entryId);
    } else {
      console.error("Invalid composite ID for delete", compositeId);
      throw new Error("Invalid ID format");
    }
  }

  /**
   * Adapter: Update
   * Expects composite ID
   */
  async update(compositeId: string, data: any): Promise<any> {
    // For update, we actually remove and re-add (as entry update logic)
    // Or implement specific updateEntry endpoint. 
    // Current API only has add (upsert) and remove.
    // We can use addWorkEntry to overwrite? Upsert relies on ID?
    // Wait, AddEntryInput excludes ID. It creates NEW ID.
    // So 'Edit' is tricky without a specific 'updateEntry' endpoint that takes ID.
    // Backend DailyReportService.addWorkEntry adds new entry. It doesn't update existing.

    // We need to implement updateEntry on backend or doing remove+add.
    // Remove+Add is risky (ID changes).

    // TODO: Implement proper updateEntry in backend if Legacy Edit is required.
    // For now, let's throw or warn.
    console.warn("Update not fully supported in legacy adapter yet");


    // Hack: Delete then Create
    await this.delete(compositeId);
    return this.create(data);
  }

  /**
   * Adapter: Get By ID (Legacy Edit Page)
   * Expects composite ID: "projectId|date|entryId"
   */
  async getById(compositeId: string): Promise<any> {
    try {
      const parts = compositeId.split('|');
      if (parts.length !== 3) {
        // Fallback: If it's a UUID (legacy data), this will fail. 
        // We assume new system only uses composite IDs for navigation.
        console.error("Invalid composite ID", compositeId);
        return null;
      }

      const [projectId, dateStr, entryId] = parts;
      const report = await this.getByProjectAndDate(projectId, new Date(dateStr));

      if (!report || !report.entries) return null;

      const entry = report.entries.find(e => e.id === entryId);
      if (!entry) return null;

      // Map to Legacy Format
      return {
        id: compositeId,
        projectLocationId: report.projectLocationId,
        reportDate: new Date(report.date),
        dailyContractorIds: [entry.dailyContractorId],
        workDescription: entry.taskName, // Map back from taskName
        startTime: entry.startTime,
        endTime: entry.endTime,
        workHours: entry.netHours,
        workType: entry.workType,
        notes: entry.notes,
        imageUrls: entry.fileAttachmentIds || [],
        // Extra fields to satisfy type check
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt, // Approximate
        status: report.status
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


}

export const dailyReportService = new DailyReportService();
export default dailyReportService;
