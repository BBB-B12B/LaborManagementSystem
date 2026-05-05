import { db } from '../../config/firebase';
import { COLLECTIONS, collections } from '../../config/collections';
import { ScanData } from '../../models/ScanData';
import { 
  ReconciliationRecord, 
  generateReconciliationId, 
  ReconciliationStatus 
} from '../../models/ReconciliationRecord';
import { logger } from '../../utils/logger';
import { projectBDailyReportService, toTimesheetSummary } from '../external/ProjectBDailyReportService';

export class MatcherService {
  /**
   * Performs reconciliation for a specific employee on a specific date.
   * Compares the aggregated ScanData with the Daily Report (from Project B or Construction).
   */
  async reconcile(employeeNumber: string, workDateStr: string, projectLocationId: string): Promise<ReconciliationRecord | null> {
    try {
      const recordId = generateReconciliationId(employeeNumber, workDateStr);
      const recordRef = db.collection(COLLECTIONS.RECONCILIATION_RECORDS).doc(recordId);

      // 1. Fetch Scan Data (Query by employeeNumber and Date)
      // Note: Assuming we have one aggregated ScanData document per day per employee.
      const scanDateStart = new Date(`${workDateStr}T00:00:00.000Z`);
      const scanDateEnd = new Date(`${workDateStr}T23:59:59.999Z`);

      const scanQuery = await collections.scanData
        .where('employeeNumber', '==', employeeNumber)
        .where('workDate', '>=', scanDateStart)
        .where('workDate', '<=', scanDateEnd)
        .where('isDeleted', '==', false)
        .get();

      // Aggregate scan hours if there are multiple, or just take the first
      let totalScanHours = 0;
      let scanDataId: string | undefined = undefined;
      let scanPunches: string[] | undefined = undefined;

      if (!scanQuery.empty) {
        scanQuery.docs.forEach(doc => {
          const data = doc.data() as ScanData;
          if (!scanDataId) {
            scanDataId = doc.id;

            // ─── Punch Times ─────────────────────────────────────────────
            // punches (HH:mm) = primary — ทุก import path เขียนครบแล้ว
            // allScans (HH:mm:ss) = fallback สำหรับ document เก่าที่อาจยังไม่มี punches
            if (Array.isArray(data.punches) && data.punches.length > 0) {
              scanPunches = data.punches;
            } else {
              const rawTimes: string[] = Array.isArray(data.allScans) && data.allScans.length > 0
                ? data.allScans
                : [data.Time1, data.Time2, data.Time3, data.Time4, data.Time5, data.Time6]
                    .filter((t): t is string => !!t && t !== '-');
              scanPunches = rawTimes.map(t => t.slice(0, 5));
            }
          }

          // ─── Hours Calculation ────────────────────────────────────────
          if ((data.regularHours || 0) + (data.otMorningHours || 0) + (data.otEveningHours || 0) > 0) {
            // ใช้ field ที่ import service คำนวณไว้แล้ว (กรณี CSV bulk import)
            totalScanHours += (data.regularHours || 0) + (data.otMorningHours || 0) + (data.otEveningHours || 0);
          } else {
            // คำนวณจาก allScans เมื่อ hours fields ไม่มี (กรณี manual entry)
            const allTimes: string[] = Array.isArray(data.allScans) && data.allScans.length > 0
              ? data.allScans
              : [data.Time1, data.Time2, data.Time3, data.Time4, data.Time5, data.Time6].filter((t): t is string => !!t && t !== '-');

            if (allTimes.length >= 2) {
              const toMinutes = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + (m || 0);
              };
              const sorted = [...allTimes].sort((a, b) => toMinutes(a) - toMinutes(b));
              const firstInMin = toMinutes(sorted[0]);
              const lastOutMin = toMinutes(sorted[sorted.length - 1]);
              // หักพักเที่ยง 1 ชั่วโมง ถ้าช่วงการทำงานครอบคลุม 12:00-13:00
              const hasLunch = firstInMin < 12 * 60 && lastOutMin > 13 * 60;
              const rawHours = (lastOutMin - firstInMin) / 60;
              totalScanHours += hasLunch ? rawHours - 1 : rawHours;
            }
          }
        });
      }


      // 2. Fetch Daily Report Data (จาก Project B: Aftersale)
      const dailyTimesheet = await projectBDailyReportService.getDailyTimesheet(employeeNumber, workDateStr);

      let totalReportHours = 0;
      let dailyReportId: string | undefined = undefined;
      let dailyReportPhotos: string[] | undefined = undefined;
      let dailyReportPunches: string[] | undefined = undefined;

      const hasReport = !!dailyTimesheet && dailyTimesheet.isActive !== false;

      if (hasReport) {
        const summary = toTimesheetSummary(dailyTimesheet!);
        dailyReportId = projectBDailyReportService.generateDocId(employeeNumber, workDateStr);
        totalReportHours = summary.totalHours;
        dailyReportPhotos = summary.dailyReportPhotos;
        dailyReportPunches = summary.dailyReportPunches;
      }

      // 3. Determine Status
      let status: ReconciliationStatus = 'PENDING';
      const hasScan = !scanQuery.empty;

      if (hasScan && hasReport) {
        if (Math.abs(totalScanHours - totalReportHours) < 0.01) {
          status = 'MATCHED';
        } else {
          status = 'CONFLICTED';
        }
      } else if (hasScan && !hasReport) {
        status = 'MISSING_DAILY';
      } else if (!hasScan && hasReport) {
        status = 'MISSING_SCAN';
      } else {
        status = 'ABSENT';
      }

      // 4. Upsert Reconciliation Record
      const existingRecordDoc = await recordRef.get();
      
      const newStatusEntry = {
        status,
        changedAt: new Date(),
        changedBy: 'system',
        reason: 'Automated Event-Driven Reconciliation'
      };

      if (existingRecordDoc.exists) {
        const existingData = existingRecordDoc.data() as ReconciliationRecord;
        
        // ไม่ update ถ้างวดงานถูกล็อกแล้ว (isLocked: true)
        if (existingData.isLocked === true) {
          return existingData;
        }

        const updates: Partial<ReconciliationRecord> = {
          scanDataHours: hasScan ? totalScanHours : undefined,
          dailyReportHours: hasReport ? totalReportHours : undefined,
          scanDataId,
          dailyReportId,
          dailyReportPhotos,
          dailyReportPunches,
          scanPunches,
          suggestedHours: Math.min(totalScanHours, totalReportHours),
          updatedAt: new Date()
        };

        if (existingData.status !== status) {
          updates.status = status;
          updates.statusHistory = [...(existingData.statusHistory || []), newStatusEntry];

          // ถ้า status กลับมาเป็น abnormal อีกครั้ง → clear resolvedAt
          // (ป้องกัน record ที่เคย "แก้ไขแล้ว" แต่ข้อมูล scan เปลี่ยนใหม่จนผิดปกติอีกครั้ง)
          const abnormalStatuses: ReconciliationStatus[] = [
            'CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'ABSENT', 'UNREGISTERED_EMPLOYEE',
          ];
          if (abnormalStatuses.includes(status)) {
            (updates as any).resolvedAt = null;
            (updates as any).resolvedBy = null;
          }
        }

        await recordRef.update(updates);
        logger.info(`Updated ReconciliationRecord: ${recordId} to status ${status}`);
        
        return { ...existingData, ...updates } as ReconciliationRecord;
      } else {
        const newRecord: Omit<ReconciliationRecord, 'id'> = {
          employeeId: employeeNumber,
          workDate: workDateStr,
          projectLocationId,
          scanDataHours: hasScan ? totalScanHours : undefined,
          dailyReportHours: hasReport ? totalReportHours : undefined,
          scanDataId,
          dailyReportId,
          dailyReportPhotos,
          dailyReportPunches,
          scanPunches,
          suggestedHours: Math.min(totalScanHours, totalReportHours),
          status,
          statusHistory: [newStatusEntry],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await recordRef.set(newRecord);
        logger.info(`Created ReconciliationRecord: ${recordId} with status ${status}`);
        
        return { id: recordId, ...newRecord } as ReconciliationRecord;
      }
      
    } catch (error) {
      logger.error(`Error in MatcherService.reconcile for ${employeeNumber} on ${workDateStr}:`, error);
      throw error;
    }
  }
}

export const matcherService = new MatcherService();
