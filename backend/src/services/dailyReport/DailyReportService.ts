/**
 * Daily Report Service (Aggregated)
 * บริการจัดการรายงานประจำวัน (แบบรวมตามวัน)
 *
 * Service for managing daily reports with Aggregated Project-Day Schema.
 */

import { collections } from '../../config/collections';
import admin, { db } from '../../config/firebase';
import { BaseCrudService } from '../base/BaseCrudService';
import {
  DailyReport,
  DailyReportEntry,
  calculateTotalHours,
  calculateNetHours,
  dailyReportConverter
} from '../../models/DailyReport';
import { AppError } from '../../api/middleware/errorHandler';
import * as XLSX from 'xlsx';
import { parseExcelRowV2 } from '../../utils/dailyReportExcel';

// Helper for UUID generation (simple fallback)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper Type for return
type DailyReportSource = DailyReport;

export class DailyReportService extends BaseCrudService<DailyReport> {
  constructor() {
    super(collections.dailyReports as any, 'dailyReports');
  }

  /**
   * Generate Custom ID
   */
  private generateId(projectId: string, date: Date): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `REP_${projectId}_${dateStr}`;
  }

  /**
   * Add Work Entry (Upsert Report)
   */
  async addWorkEntry(
    projectId: string,
    date: Date,
    entryInput: Omit<DailyReportEntry, 'id' | 'createdAt' | 'totalHours' | 'netHours'>,
    user: string
  ): Promise<DailyReportSource> {
    const reportId = this.generateId(projectId, date);
    const now = new Date();

    // Calculate Hours
    const totalHours = calculateTotalHours(entryInput.startTime, entryInput.endTime);
    const netHours = calculateNetHours(totalHours, entryInput.workType, entryInput.startTime, entryInput.endTime);

    const newEntry: DailyReportEntry = {
      id: generateUuid(),
      ...entryInput,
      totalHours,
      netHours,
      createdAt: now
    };

    const periodRef = collections.dailyReports.doc(reportId);

    await db.runTransaction(async (t) => {
      const doc = await t.get(periodRef);

      if (!doc.exists) {
        // Create new Aggregated Report
        const newReport: DailyReport = {
          id: reportId,
          projectLocationId: projectId,
          date: date,
          entries: [newEntry],
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          createdBy: user,
          updatedBy: user,
          version: 1
        };
        t.set(periodRef, dailyReportConverter.toFirestore(newReport));
      } else {
        // Append to existing
        const data = doc.data();
        const entries = data?.entries || [];
        entries.push(dailyReportConverter.toFirestore({ ...newEntry } as any));

        t.update(periodRef, {
          entries, // Firestore handles array replacement
          updatedAt: now,
          updatedBy: user,
          version: (data?.version || 0) + 1
        });
      }
    });

    // Return updated document
    const updatedUserDoc = await periodRef.get();
    return dailyReportConverter.fromFirestore(updatedUserDoc);
  }

  /**
   * Remove Work Entry
   */
  async removeWorkEntry(
    projectId: string,
    date: Date,
    entryId: string,
    user: string
  ): Promise<void> {
    const reportId = this.generateId(projectId, date);
    const periodRef = collections.dailyReports.doc(reportId);

    await db.runTransaction(async (t) => {
      const doc = await t.get(periodRef);
      if (!doc.exists) throw new AppError('Report not found', 404);

      const data = doc.data();
      const entries = (data?.entries || []).filter((e: any) => e.id !== entryId);

      const now = new Date();
      t.update(periodRef, {
        entries,
        updatedAt: now,
        updatedBy: user
      });
    });
  }

  /**
   * Get Report by Project & Date
   */
  async getByProjectAndDate(projectId: string, date: Date): Promise<DailyReport | null> {
    const reportId = this.generateId(projectId, date);
    const doc = await collections.dailyReports.doc(reportId).get();

    if (!doc.exists) return null;
    return dailyReportConverter.fromFirestore(doc);
  }

  /**
   * Get Reports by Month (For Calendar/List)
   */
  async getByProjectAndMonth(projectId: string, year: number, month: number): Promise<DailyReport[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const snapshot = await collections.dailyReports
      .where('projectLocationId', '==', projectId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return snapshot.docs.map(doc => dailyReportConverter.fromFirestore(doc));
  }

  /**
   * Parse Excel for Daily Report Import (v2 Split Logic)
   */
  async parseDailyReportExcel(buffer: Buffer): Promise<any[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const results: any[] = [];

    for (const row of rows) {
      const parsed = parseExcelRowV2(row);
      if (!parsed) continue;

      // 1. Lookup Project by Code
      const projectSnapshot = await collections.projectLocations
        .where('projectCode', '==', parsed.projectCode)
        .limit(1)
        .get();
      
      let project = projectSnapshot.empty ? null : projectSnapshot.docs[0];

      // 2. Lookup DC by Employee ID
      const dcSnapshot = await collections.dailyContractors
        .where('employeeId', '==', parsed.employeeId)
        .limit(1)
        .get();
      const dc = dcSnapshot.empty ? null : dcSnapshot.docs[0];

      const baseInfo = {
        date: parsed.date,
        projectCode: parsed.projectCode,
        employeeId: parsed.employeeId,
        workerName: parsed.workerName,
        taskName: parsed.taskName,
        projectLocationId: project?.id || null,
        projectName: (project?.data() as any)?.projectName || 'ไม่พบโครงการ',
        dailyContractorId: dc?.id || null,
        matchedWorkerName: (dc?.data() as any)?.name || 'ไม่พบพนักงาน',
        isValid: !!project && !!dc,
      };

      // 3. Split into Multiple Entries based on Hours (T-371-1)
      const workTypesConfig = [
        { key: 'hoursRegular', type: 'regular', start: '08:00', end: '17:00' },
        { key: 'hoursOTMorning', type: 'ot_morning', start: '05:00', end: '08:00' },
        { key: 'hoursOTNoon', type: 'ot_noon', start: '12:00', end: '13:00' },
        { key: 'hoursOTEvening', type: 'ot_evening', start: '17:00', end: null },
      ];

      for (const config of workTypesConfig) {
        const hours = (parsed as any)[config.key];
        if (hours && hours > 0) {
          let startTime = config.start;
          let endTime = config.end;

          if (!endTime) {
            // Calculate end time for OT Evening based on hours
            const [h, m] = config.start.split(':').map(Number);
            const endH = h + Math.floor(hours);
            const endM = m + (hours % 1) * 60;
            endTime = `${String(endH).padStart(2, '0')}:${String(Math.round(endM)).padStart(2, '0')}`;
          }

          results.push({
            ...baseInfo,
            workType: config.type,
            netHours: hours,
            startTime,
            endTime,
            id: `${parsed.employeeId}_${config.type}_${results.length}`, // Temp ID for Preview
          });
        }
      }
    }

    return results;
  }

  /**
   * Bulk save daily reports (Aggregated)
   */
  async bulkCreateDailyReports(data: any[], user: string, importFileUrl?: string): Promise<number> {
    let successCount = 0;
    // Group by Project + Date to handle importFileUrl efficiently
    const itemsByReport = data.reduce((acc, item) => {
      const reportId = this.generateId(item.projectLocationId, new Date(item.date));
      if (!acc[reportId]) acc[reportId] = [];
      acc[reportId].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    for (const reportId in itemsByReport) {
      const items = itemsByReport[reportId];
      if (items.length === 0) continue;

      try {
        // Process each entry in the report
        for (const item of items) {
          if (!item.isValid) continue;
          await this.addWorkEntry(
            item.projectLocationId,
            new Date(item.date),
            {
              dailyContractorId: item.dailyContractorId,
              employeeId: item.employeeId,
              taskName: item.taskName,
              workType: item.workType,
              startTime: item.startTime,
              endTime: item.endTime,
              verificationStatus: 'unverified',
            } as any,
            user
          );
          successCount++;
        }

        // After adding entries, link the import file to the aggregated report
        if (importFileUrl) {
          await collections.dailyReports.doc(reportId).update({
            importFileUrls: admin.firestore.FieldValue.arrayUnion(importFileUrl),
            updatedAt: new Date(),
            updatedBy: user
          });
        }
      } catch (err) {
        console.error(`Bulk Import Error for report ${reportId}:`, err);
      }
    }
    return successCount;
  }
}

export const dailyReportService = new DailyReportService();
