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

import axios from 'axios';
import { type DailyReportFormData } from '@/validation/dailyReportSchema';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
    const params = new URLSearchParams();

    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.date) params.append('date', filters.date.toISOString());
    if (filters?.dcId) params.append('dcId', filters.dcId);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters?.workType) params.append('workType', filters.workType);

    const response = await axios.get<DailyReport[]>(
      `${API_URL}/api/daily-reports?${params.toString()}`
    );

    return response.data.map((report) => ({
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
    const response = await axios.get<DailyReport>(`${API_URL}/api/daily-reports/${id}`);

    return {
      ...response.data,
      reportDate: new Date(response.data.reportDate),
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
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
    const response = await axios.post<DailyReport | DailyReport[]>(
      `${API_URL}/api/daily-reports`,
      data
    );

    if (Array.isArray(response.data)) {
      return response.data.map((report) => ({
        ...report,
        reportDate: new Date(report.reportDate),
        createdAt: new Date(report.createdAt),
        updatedAt: new Date(report.updatedAt),
      }));
    }

    return {
      ...response.data,
      reportDate: new Date(response.data.reportDate),
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
    };
  }

  /**
   * Update an existing daily report
   *
   * Creates edit history entry automatically
   */
  async update(id: string, data: Partial<DailyReportFormData>): Promise<DailyReport> {
    const response = await axios.put<DailyReport>(
      `${API_URL}/api/daily-reports/${id}`,
      data
    );

    return {
      ...response.data,
      reportDate: new Date(response.data.reportDate),
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
    };
  }

  /**
   * Delete a daily report
   *
   * Note: May implement soft delete in backend
   */
  async delete(id: string): Promise<void> {
    await axios.delete(`${API_URL}/api/daily-reports/${id}`);
  }

  /**
   * Get edit history for a daily report
   *
   * Returns all changes made to this report
   */
  async getHistory(id: string): Promise<EditHistory[]> {
    const response = await axios.get<EditHistory[]>(
      `${API_URL}/api/daily-reports/${id}/history`
    );

    return response.data.map((entry) => ({
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
    const response = await axios.post<{
      hasOverlap: boolean;
      overlappingReports: DailyReport[];
    }>(`${API_URL}/api/daily-reports/check-overlap`, {
      dcId,
      date: date.toISOString(),
      startTime,
      endTime,
      excludeReportId,
    });

    return {
      hasOverlap: response.data.hasOverlap,
      overlappingReports: response.data.overlappingReports.map((report) => ({
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
