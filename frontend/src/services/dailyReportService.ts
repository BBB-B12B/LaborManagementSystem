/**
 * Daily Report Service
 * บริการสำหรับจัดการข้อมูลรายงานการทำงานรายวัน
 *
 * Handles CRUD operations for daily reports:
 * - Create (single/multi-DC)
 * - Read (list/single)
 * - Update (with edit history)
 * - Delete
 * - Get edit history
 */

import apiClient from './api/client';
import { type DailyReportFormData } from '@/validation/dailyReportSchema';

export interface DailyReport {
  id: string;
  projectLocationId: string;
  projectName?: string;
  reportDate: Date;
  dailyContractorIds: string[];
  dcNames?: string[];
  workDescription: string;
  startTime: string;
  endTime: string;
  workHours: number;
  totalWage: number;
  workType: 'regular' | 'ot_morning' | 'ot_noon' | 'ot_evening';
  isOvernight: boolean;
  notes?: string;
  imageUrls?: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EditHistory {
  id: string;
  entityId: string;
  entityType: 'daily_report';
  action: 'create' | 'update';
  editedBy: string;
  editedByName?: string;
  editedAt: Date;
  changedFields?: Record<string, { before: any; after: any }>;
  notes?: string;
}

export interface DailyReportFilters {
  projectId?: string;
  date?: Date;
  dcId?: string;
  startDate?: Date;
  endDate?: Date;
  workType?: string;
}

/**
 * Daily Report Service
 */
class DailyReportService {
  /**
   * Get all daily reports with optional filters
   */
  async getAll(filters?: DailyReportFilters): Promise<DailyReport[]> {
    const params: Record<string, string> = {};

    if (filters?.projectId) params.projectId = filters.projectId;
    if (filters?.date) params.date = filters.date.toISOString();
    if (filters?.dcId) params.dcId = filters.dcId;
    if (filters?.startDate) params.startDate = filters.startDate.toISOString();
    if (filters?.endDate) params.endDate = filters.endDate.toISOString();
    if (filters?.workType) params.workType = filters.workType;

    const { data } = await apiClient.get<DailyReport[]>('/daily-reports', { params });

    return data.map((report) => ({
      ...report,
      reportDate: new Date(report.reportDate),
      createdAt: new Date(report.createdAt),
      updatedAt: new Date(report.updatedAt),
    }));
  }

  /**
   * Get a single daily report by ID
   */
  async getById(id: string): Promise<DailyReport> {
    const { data } = await apiClient.get<DailyReport>(`/daily-reports/${id}`);

    return {
      ...data,
      reportDate: new Date(data.reportDate),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Create a new daily report
   *
   * Supports multi-select DCs:
   * - If multiple DCs selected, creates individual reports for each
   * - All reports share same work description, time, etc.
   */
  async create(data: DailyReportFormData): Promise<DailyReport | DailyReport[]> {
    const { data: response } = await apiClient.post<DailyReport | DailyReport[]>(
      '/daily-reports',
      data
    );

    if (Array.isArray(response)) {
      return response.map((report) => ({
        ...report,
        reportDate: new Date(report.reportDate),
        createdAt: new Date(report.createdAt),
        updatedAt: new Date(report.updatedAt),
      }));
    }

    return {
      ...response,
      reportDate: new Date(response.reportDate),
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.updatedAt),
    };
  }

  /**
   * Update an existing daily report
   *
   * Creates edit history entry automatically
   */
  async update(id: string, data: Partial<DailyReportFormData>): Promise<DailyReport> {
    const { data: response } = await apiClient.put<DailyReport>(
      `/daily-reports/${id}`,
      data
    );

    return {
      ...response,
      reportDate: new Date(response.reportDate),
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.updatedAt),
    };
  }

  /**
   * Delete a daily report
   *
   * Note: May implement soft delete in backend
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/daily-reports/${id}`);
  }

  /**
   * Get edit history for a daily report
   *
   * Returns all changes made to this report
   */
  async getHistory(id: string): Promise<EditHistory[]> {
    const { data } = await apiClient.get<EditHistory[]>(
      `/daily-reports/${id}/history`
    );

    return data.map((entry) => ({
      ...entry,
      editedAt: new Date(entry.editedAt),
    }));
  }

  /**
   * Get daily reports for a specific date
   */
  async getByDate(date: Date): Promise<DailyReport[]> {
    return this.getAll({ date });
  }

  /**
   * Get daily reports for a specific project
   */
  async getByProject(projectId: string): Promise<DailyReport[]> {
    return this.getAll({ projectId });
  }

  /**
   * Get daily reports for a specific DC
   */
  async getByDC(dcId: string): Promise<DailyReport[]> {
    return this.getAll({ dcId });
  }

  /**
   * Get daily reports for a date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<DailyReport[]> {
    return this.getAll({ startDate, endDate });
  }

  /**
   * Validate time overlap
   *
   * Check if new report overlaps with existing OT
   */
  async checkTimeOverlap(
    dcId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeReportId?: string
  ): Promise<{ hasOverlap: boolean; overlappingReports: DailyReport[] }> {
    const { data } = await apiClient.post<{
      hasOverlap: boolean;
      overlappingReports: DailyReport[];
    }>('/daily-reports/check-overlap', {
      dcId,
      date: date.toISOString(),
      startTime,
      endTime,
      excludeReportId,
    });

    return {
      hasOverlap: data.hasOverlap,
      overlappingReports: data.overlappingReports.map((report) => ({
        ...report,
        reportDate: new Date(report.reportDate),
        createdAt: new Date(report.createdAt),
        updatedAt: new Date(report.updatedAt),
      })),
    };
  }
}

export const dailyReportService = new DailyReportService();
export default dailyReportService;
