/**
 * Daily Report Service (Aggregated)
 * บริการจัดการรายงานประจำวัน (แบบรวมตามวัน)
 *
 * Service for managing daily reports with Aggregated Project-Day Schema.
 */

import { collections } from '../../config/collections';
import { db } from '../../config/firebase';
import { BaseCrudService } from '../base/BaseCrudService';
import {
  DailyReport,
  DailyReportEntry,
  calculateTotalHours,
  calculateNetHours,
  dailyReportConverter
} from '../../models/DailyReport';
import { AppError } from '../../api/middleware/errorHandler';

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
}

export const dailyReportService = new DailyReportService();
