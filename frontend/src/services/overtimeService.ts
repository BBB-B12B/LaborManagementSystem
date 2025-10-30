/**
 * Overtime Service
 * บริการสำหรับจัดการข้อมูล OT (โอที)
 *
 * Handles CRUD operations for overtime records:
 * - Create (single/multi-DC)
 * - Read (list/single)
 * - Update (with edit history)
 * - Delete
 * - Get edit history
 * - Check time overlap
 */

import axios from 'axios';
import { type OvertimeFormData, type OTPeriod } from '@/validation/overtimeSchema';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface OvertimeRecord {
  id: string;
  projectLocationId: string;
  projectName?: string;
  reportDate: Date;
  dailyContractorIds: string[];
  dcNames?: string[];
  workDescription: string;
  otPeriod: OTPeriod;
  startTime: string;
  endTime: string;
  workHours: number;
  totalWage: number;
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
  entityType: 'overtime_record';
  action: 'create' | 'update';
  editedBy: string;
  editedByName?: string;
  editedAt: Date;
  changedFields?: Record<string, { before: any; after: any }>;
  notes?: string;
}

export interface OvertimeFilters {
  projectId?: string;
  date?: Date;
  dcId?: string;
  startDate?: Date;
  endDate?: Date;
  otPeriod?: OTPeriod;
}

/**
 * Overtime Service
 */
class OvertimeService {
  /**
   * Get all overtime records with optional filters
   */
  async getAll(filters?: OvertimeFilters): Promise<OvertimeRecord[]> {
    const params = new URLSearchParams();

    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.date) params.append('date', filters.date.toISOString());
    if (filters?.dcId) params.append('dcId', filters.dcId);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters?.otPeriod) params.append('otPeriod', filters.otPeriod);

    const response = await axios.get<OvertimeRecord[]>(
      `${API_URL}/api/overtime?${params.toString()}`
    );

    return response.data.map((record) => ({
      ...record,
      reportDate: new Date(record.reportDate),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }));
  }

  /**
   * Get a single overtime record by ID
   */
  async getById(id: string): Promise<OvertimeRecord> {
    const response = await axios.get<OvertimeRecord>(`${API_URL}/api/overtime/${id}`);

    return {
      ...response.data,
      reportDate: new Date(response.data.reportDate),
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
    };
  }

  /**
   * Create a new overtime record
   *
   * Supports multi-select DCs:
   * - If multiple DCs selected, creates individual records for each
   * - All records share same work description, time, etc.
   */
  async create(data: OvertimeFormData): Promise<OvertimeRecord | OvertimeRecord[]> {
    const response = await axios.post<OvertimeRecord | OvertimeRecord[]>(
      `${API_URL}/api/overtime`,
      data
    );

    if (Array.isArray(response.data)) {
      return response.data.map((record) => ({
        ...record,
        reportDate: new Date(record.reportDate),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
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
   * Update an existing overtime record
   *
   * Creates edit history entry automatically
   */
  async update(id: string, data: Partial<OvertimeFormData>): Promise<OvertimeRecord> {
    const response = await axios.put<OvertimeRecord>(
      `${API_URL}/api/overtime/${id}`,
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
   * Delete an overtime record
   */
  async delete(id: string): Promise<void> {
    await axios.delete(`${API_URL}/api/overtime/${id}`);
  }

  /**
   * Get edit history for an overtime record
   *
   * Returns all changes made to this record
   */
  async getHistory(id: string): Promise<EditHistory[]> {
    const response = await axios.get<EditHistory[]>(
      `${API_URL}/api/overtime/${id}/history`
    );

    return response.data.map((entry) => ({
      ...entry,
      editedAt: new Date(entry.editedAt),
    }));
  }

  /**
   * Get overtime records for a specific date
   */
  async getByDate(date: Date): Promise<OvertimeRecord[]> {
    return this.getAll({ date });
  }

  /**
   * Get overtime records for a specific project
   */
  async getByProject(projectId: string): Promise<OvertimeRecord[]> {
    return this.getAll({ projectId });
  }

  /**
   * Get overtime records for a specific DC
   */
  async getByDC(dcId: string): Promise<OvertimeRecord[]> {
    return this.getAll({ dcId });
  }

  /**
   * Get overtime records for a date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<OvertimeRecord[]> {
    return this.getAll({ startDate, endDate });
  }

  /**
   * Get overtime records by OT period
   */
  async getByPeriod(otPeriod: OTPeriod): Promise<OvertimeRecord[]> {
    return this.getAll({ otPeriod });
  }

  /**
   * Check time overlap with other OT periods or regular work
   *
   * FR-OT-006: OT periods cannot overlap with each other
   * FR-OT-007: OT cannot overlap with regular work hours
   */
  async checkTimeOverlap(
    dcId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeRecordId?: string
  ): Promise<{ hasOverlap: boolean; overlappingRecords: OvertimeRecord[] }> {
    const response = await axios.post<{
      hasOverlap: boolean;
      overlappingRecords: OvertimeRecord[];
    }>(`${API_URL}/api/overtime/check-overlap`, {
      dcId,
      date: date.toISOString(),
      startTime,
      endTime,
      excludeRecordId,
    });

    return {
      hasOverlap: response.data.hasOverlap,
      overlappingRecords: response.data.overlappingRecords.map((record) => ({
        ...record,
        reportDate: new Date(record.reportDate),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })),
    };
  }

  /**
   * Calculate OT wage (1.5x base rate + professional rate)
   */
  calculateOTWage(hourlyRate: number, professionalRate: number, hours: number): number {
    return Math.round(hourlyRate * 1.5 * hours + professionalRate);
  }
}

export const overtimeService = new OvertimeService();
export default overtimeService;
