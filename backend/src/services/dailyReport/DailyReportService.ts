/**
 * Daily Report Service
 * บริการจัดการรายงานประจำวัน
 *
 * Service for managing daily reports with Edit History tracking
 */

import { collections } from '../../config/collections';
import { CrudService } from '../base/CrudService';
import {
  DailyReport,
  CreateDailyReportInput,
  UpdateDailyReportInput,
  calculateTotalHours,
  calculateNetHours,
} from '../../models/DailyReport';
import { EditHistory, CreateEditHistoryInput } from '../../models/EditHistory';

export class DailyReportService extends CrudService<DailyReport> {
  constructor() {
    super(collections.dailyReports as any, 'dailyReports');
  }

  /**
   * สร้าง Daily Report ใหม่
   * Create new daily report with automatic calculations and edit history
   */
  async createDailyReport(
    input: CreateDailyReportInput,
    createdBy: string
  ): Promise<DailyReport> {
    const now = new Date();

    // คำนวณชั่วโมงอัตโนมัติ
    const totalHours = calculateTotalHours(
      input.startTime,
      input.endTime,
      input.isOvernight || false
    );
    const breakHours = input.workType === 'regular' ? 1.0 : 0;
    const netHours = calculateNetHours(totalHours, input.workType, input.startTime, input.endTime);

    const reportData: Omit<DailyReport, 'id'> = {
      projectLocationId: input.projectLocationId,
      dailyContractorId: input.dailyContractorId,
      taskName: input.taskName,
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: input.endTime,
      workType: input.workType,
      totalHours,
      breakHours,
      netHours,
      isOvernight: input.isOvernight || false,
      notes: input.notes,
      fileAttachmentIds: input.fileAttachmentIds || [],
      status: input.status || 'draft',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
      version: 1,
    };

    const report = await this.create(reportData);

    // บันทึก EditHistory สำหรับการสร้าง
    await this.createEditHistory({
      dailyReportId: report.id,
      previousVersion: 0,
      changeType: 'create',
      changedFields: Object.keys(reportData),
      oldValues: {},
      newValues: reportData as any,
      createdBy,
    });

    return report;
  }

  /**
   * อัปเดท Daily Report พร้อมบันทึก EditHistory
   * Update daily report with edit history tracking
   */
  async updateDailyReport(
    id: string,
    input: UpdateDailyReportInput,
    updatedBy: string
  ): Promise<DailyReport | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const now = new Date();
    const updateData: any = {
      ...input,
      updatedAt: now,
      updatedBy,
      version: existing.version + 1,
    };

    // ถ้ามีการเปลี่ยนเวลา ให้คำนวณใหม่
    if (input.startTime || input.endTime) {
      const startTime = input.startTime || existing.startTime;
      const endTime = input.endTime || existing.endTime;
      const isOvernight = input.isOvernight !== undefined ? input.isOvernight : existing.isOvernight;

      updateData.totalHours = calculateTotalHours(startTime, endTime, isOvernight);
      updateData.netHours = calculateNetHours(
        updateData.totalHours,
        input.workType || existing.workType,
        startTime,
        endTime
      );
    }

    const updated = await this.update(id, updateData);
    if (!updated) {
      return null;
    }

    // บันทึก EditHistory
    const changedFields = Object.keys(input);
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    changedFields.forEach((field) => {
      oldValues[field] = (existing as any)[field];
      newValues[field] = (updated as any)[field];
    });

    await this.createEditHistory({
      dailyReportId: id,
      previousVersion: existing.version,
      changeType: 'update',
      changedFields,
      oldValues,
      newValues,
      createdBy: updatedBy,
    });

    return updated;
  }

  /**
   * ลบ Daily Report (soft delete)
   * Soft delete daily report
   */
  async deleteDailyReport(id: string, deletedBy: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    await this.update(id, {
      isDeleted: true,
      updatedAt: new Date(),
      updatedBy: deletedBy,
    } as any);

    // บันทึก EditHistory
    await this.createEditHistory({
      dailyReportId: id,
      previousVersion: existing.version,
      changeType: 'delete',
      changedFields: ['isDeleted'],
      oldValues: { isDeleted: false },
      newValues: { isDeleted: true },
      createdBy: deletedBy,
    });

    return true;
  }

  /**
   * ดึงประวัติการแก้ไขทั้งหมดของ Daily Report
   * Get edit history for a daily report
   */
  async getEditHistory(dailyReportId: string): Promise<EditHistory[]> {
    const historyDocs = await collections.editHistory
      .where('dailyReportId', '==', dailyReportId)
      .orderBy('createdAt', 'desc')
      .get();

    return historyDocs.docs.map((doc) => doc.data());
  }

  /**
   * ดึง Daily Reports ตาม project และวันที่
   * Get daily reports by project and date range
   */
  async getByProjectAndDate(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyReport[]> {
    const reports = await this.query([
      { field: 'projectLocationId', operator: '==', value: projectId },
      { field: 'workDate', operator: '>=', value: startDate },
      { field: 'workDate', operator: '<=', value: endDate },
      { field: 'isDeleted', operator: '==', value: false },
    ]);

    return reports;
  }

  /**
   * ดึง Daily Reports ตาม DC และวันที่
   * Get daily reports by contractor and date range
   */
  async getByContractorAndDate(
    contractorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyReport[]> {
    const reports = await this.query([
      { field: 'dailyContractorId', operator: '==', value: contractorId },
      { field: 'workDate', operator: '>=', value: startDate },
      { field: 'workDate', operator: '<=', value: endDate },
      { field: 'isDeleted', operator: '==', value: false },
    ]);

    return reports;
  }

  /**
   * บันทึก EditHistory
   * Create edit history record
   */
  private async createEditHistory(input: CreateEditHistoryInput): Promise<void> {
    const historyData = {
      ...input,
      createdAt: new Date(),
    };

    await collections.editHistory.add(historyData as any);
  }
}

// Export singleton instance
export const dailyReportService = new DailyReportService();
