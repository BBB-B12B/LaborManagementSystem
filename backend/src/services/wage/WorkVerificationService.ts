/**
 * WorkVerificationService
 * บริการตรวจสอบความถูกต้องของงาน (Daily Report vs Scan Data)
 */

import { db } from '../../config/firebase';
import { collections } from '../../config/collections';
import { logger } from '../../utils/logger';
import { ScanData } from '../../models/ScanData';
import { DailyReportEntry } from '../../models/DailyReport';

/** Local helper: format a Date to YYYY-MM-DD string */
function formatWorkDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface VerificationResult {
  totalEntries: number;
  autoVerified: number;
  discrepancies: number;
}

class WorkVerificationService {
  /**
   * Sync verification status for a project and date range
   */
  async syncVerification(
    projectLocationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VerificationResult> {
    try {
      logger.info(
        `Starting work verification for project: ${projectLocationId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // 1. Fetch Daily Reports for the period
      const reportsSnapshot = await collections.dailyReports
        .where('projectLocationId', '==', projectLocationId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

      if (reportsSnapshot.empty) {
        return { totalEntries: 0, autoVerified: 0, discrepancies: 0 };
      }

      // 2. Fetch Scan Data for the same period
      const startStr = formatWorkDateStr(startDate);
      const endStr = formatWorkDateStr(endDate);
      const scansSnapshot = await collections.scanData
        .where('projectLocationId', '==', projectLocationId)
        .where('workDate', '>=', startStr)
        .where('workDate', '<=', endStr)
        .where('isDeleted', '==', false)
        .get();

      const scanMap = new Map<string, ScanData>();
      scansSnapshot.docs.forEach((doc) => {
        const data = doc.data() as ScanData;
        const key = `${data.employeeId}_${data.workDate}`;
        scanMap.set(key, data);
      });

      let totalEntries = 0;
      let autoVerified = 0;
      let discrepancies = 0;
      let writeCount = 0;

      const batch = db.batch();

      // 3. Process each Report
      for (const reportDoc of reportsSnapshot.docs) {
        const reportData = reportDoc.data();
        // [T-401] Handle both Date and Timestamp correctly
        const rawDate = reportData.date;
        const reportDate = rawDate instanceof Date ? rawDate : (rawDate as any).toDate();
        const reportDateStr = formatWorkDateStr(reportDate);
        const entries = (reportData as any).entries as DailyReportEntry[];
        let updated = false;

        const updatedEntries = entries.map((entry) => {
          totalEntries++;

          // Use denormalized employeeId (T-400)
          const empId = entry.employeeId;
          if (!empId) {

            if ((entry as any).verificationStatus !== 'discrepancy') {
              (entry as any).verificationStatus = 'discrepancy';
              updated = true;
            }
            discrepancies++;
            return entry;
          }

          const scanKey = `${empId}_${reportDateStr}`;
          const scan = scanMap.get(scanKey);

          // Verification Logic
          const expectedStatus = (scan && (scan.punches ?? []).length >= 2) ? 'auto_verified' : 'discrepancy';
          if (expectedStatus === 'auto_verified') {
            autoVerified++;
          } else {
            discrepancies++;
          }

          if ((entry as any).verificationStatus !== expectedStatus) {
            (entry as any).verificationStatus = expectedStatus;
            updated = true;
          }


          return entry;
        });

        if (updated) {
          batch.update(reportDoc.ref, {
            entries: updatedEntries,
            updatedAt: new Date(),
          });
          writeCount++;
        }
      }

      if (writeCount > 0) {
        await batch.commit();
      }


      logger.info(
        `Work verification completed: ${autoVerified} auto-verified, ${discrepancies} discrepancies.`
      );
      return { totalEntries, autoVerified, discrepancies };
    } catch (error) {
      logger.error('Error in WorkVerificationService:', error);
      throw error;
    }
  }
}

export const workVerificationService = new WorkVerificationService();
