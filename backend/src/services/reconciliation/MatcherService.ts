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
            scanDataId = doc.id; // Store first id for reference
            scanPunches = data.punches;
          }
          
          // Basic normal + OT calculation
          totalScanHours += (data.regularHours || 0) + (data.otMorningHours || 0) + (data.otEveningHours || 0);
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
