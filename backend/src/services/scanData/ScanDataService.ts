/**
 * ScanDataService
 * บริการจัดการข้อมูลสแกนนิ้ว
 *
 * Manages fingerprint scan data with CRUD operations and processing.
 */

import { randomUUID } from 'crypto';
import { BaseCrudService } from '../base/BaseCrudService';
import {
  ScanData,
  CreateScanDataInput,
  roundDownToFiveMinutes,
  classifyScanBehavior,
  checkLate,
} from '../../models/ScanData';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { db } from '../../config/firebase';
import { dailyContractorService } from '../dailyContractor/DailyContractorService';
import { dailyReportService } from '../dailyReport/DailyReportService';
import { COLLECTIONS } from '../../config/collections';
import { DailyReport } from '../../models/DailyReport';

export interface BulkImportRecord {
  rowNumber: number;
  employeeNumber: string;
  scanDateTime: Date;
  rawLine?: string;
  rawData?: Record<string, unknown>;
}

export interface BulkImportOptions {
  projectLocationId: string;
  importedBy: string;
  importNote?: string;
  source: 'excel' | 'dat' | 'text';
  batchId?: string;
}

export interface ImportErrorEntry {
  row: number;
  employeeNumber?: string;
  error: string;
}

export interface ImportSummary {
  success: boolean;
  importBatchId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: ImportErrorEntry[];
  warnings: string[];
}
interface PreparedImportRecord {
  uniqueKey: string;
  rowNumber: number;
  employeeNumber: string;
  docRef: FirebaseFirestore.DocumentReference<ScanData>;
  scanData: Omit<ScanData, 'id'>;
}

/**
 * ScanDataService
 * Extends CrudService with scan data operations
 */
class ScanDataService extends BaseCrudService<ScanData> {
  constructor() {
    super(collections.scanData as any, 'scanData');
  }

  /**
   * Import scan data
   */
  async importScanData(
    input: CreateScanDataInput,
    importedBy: string
  ): Promise<ScanData> {
    try {
      const now = new Date();
      const importBatchId = `manual-${randomUUID()}`;
      const uniqueKey = this.buildUniqueKey(
        input.projectLocationId,
        input.employeeId,
        input.scanDateTime
      );

      // Round time down to 5 minutes
      const roundedTime = roundDownToFiveMinutes(input.scanDateTime);

      // Classify scan behavior
      const scanBehavior = classifyScanBehavior(input.scanDateTime);

      // Check if late
      const { isLate, lateMinutes } = checkLate(input.scanDateTime);

      // Work date is same as scan date (unless logic changes for overnight)
      const workDate = new Date(input.scanDateTime);
      workDate.setHours(0, 0, 0, 0);

      const scanData: Omit<ScanData, 'id'> = {
        dailyContractorId: input.dailyContractorId,
        employeeId: input.employeeId,
        projectLocationId: input.projectLocationId,
        scanDateTime: input.scanDateTime,
        scanBehavior,
        workDate,
        roundedTime,
        isLate,
        lateMinutes,
        hasDiscrepancy: false,
        createdAt: now,
        importedAt: now,
        importedBy,
        importBatchId,
        importSource: 'manual',
        importNote: input.importNote,
        employeeNumber: input.employeeId,
        rawData: {
          source: 'manual-form',
        },
      };
      const docRef = collections.scanData.doc(uniqueKey);
      const existing = await docRef.get();
      if (existing.exists) {
        await docRef.set(scanData);
        logger.info(`Scan data updated for DC: ${input.employeeId}`, { scanId: existing.id });
        const updatedDoc = await docRef.get();
        return updatedDoc.data() as ScanData;
      }

      await docRef.set(scanData);
      const created = await docRef.get();
      const scan = created.data() as ScanData;
      logger.info(`Scan data imported for DC: ${scan.employeeId}`, { scanId: docRef.id });

      return scan;
    } catch (error: any) {
      logger.error('Error importing scan data:', error);
      throw error;
    }
  }

  /**
   * Get scan data by contractor and date range
   */
  async getByContractorAndDate(
    dailyContractorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScanData[]> {
    try {
      const results = await this.query([
        {
          field: 'dailyContractorId',
          operator: '==',
          value: dailyContractorId,
        },
        {
          field: 'workDate',
          operator: '>=',
          value: startDate,
        },
        {
          field: 'workDate',
          operator: '<=',
          value: endDate,
        },
      ]);

      return results;
    } catch (error: any) {
      logger.error('Error getting scan data by contractor:', error);
      throw error;
    }
  }

  /**
   * Get scan data by project and date range
   */
  async getByProjectAndDate(
    projectLocationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScanData[]> {
    try {
      const results = await this.query([
        {
          field: 'projectLocationId',
          operator: '==',
          value: projectLocationId,
        },
        {
          field: 'workDate',
          operator: '>=',
          value: startDate,
        },
        {
          field: 'workDate',
          operator: '<=',
          value: endDate,
        },
      ]);

      return results;
    } catch (error: any) {
      logger.error('Error getting scan data by project:', error);
      throw error;
    }
  }

  /**
   * Get late records
   */
  async getLateRecords(
    projectLocationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ScanData[]> {
    try {
      const filters: any[] = [
        {
          field: 'isLate',
          operator: '==',
          value: true,
        },
      ];

      if (projectLocationId) {
        filters.push({
          field: 'projectLocationId',
          operator: '==',
          value: projectLocationId,
        });
      }

      if (startDate) {
        filters.push({
          field: 'workDate',
          operator: '>=',
          value: startDate,
        });
      }

      if (endDate) {
        filters.push({
          field: 'workDate',
          operator: '<=',
          value: endDate,
        });
      }

      return await this.query(filters);
    } catch (error: any) {
      logger.error('Error getting late records:', error);
      throw error;
    }
  }

  /**
   * Get unmatched scans (no linked daily report)
   */
  async getUnmatchedScans(projectLocationId?: string): Promise<ScanData[]> {
    try {
      const filters: any[] = [];

      if (projectLocationId) {
        filters.push({
          field: 'projectLocationId',
          operator: '==',
          value: projectLocationId,
        });
      }

      // Get all scans and filter by matchedDailyReportId
      const allScans = await this.query(filters);
      return allScans.filter((scan) => !scan.matchedDailyReportId);
    } catch (error: any) {
      logger.error('Error getting unmatched scans:', error);
      throw error;
    }
  }

  /**
   * Match scan data to daily report
   */
  async matchToDailyReport(
    scanId: string,
    dailyReportId: string
  ): Promise<ScanData | null> {
    try {
      const updateData: Partial<ScanData> = {
        matchedDailyReportId: dailyReportId,
      };

      const updated = await this.update(scanId, updateData);
      if (updated) {
        logger.info(`Scan data matched to daily report`, { scanId, dailyReportId });
      }

      return updated;
    } catch (error: any) {
      logger.error('Error matching scan to daily report:', error);
      throw error;
    }
  }

  /**
   * Bulk import scan data records
   */
  async bulkImport(
    records: BulkImportRecord[],
    options: BulkImportOptions
  ): Promise<ImportSummary> {
    if (!Array.isArray(records) || records.length === 0) {
      throw new AppError('ไม่พบข้อมูลสำหรับ import', 400);
    }

    const MAX_IMPORT_RECORDS = 100_000;
    if (records.length > MAX_IMPORT_RECORDS) {
      throw new AppError(`รองรับสูงสุด ${MAX_IMPORT_RECORDS.toLocaleString('th-TH')} รายการต่อครั้ง`, 400);
    }

    const importBatchId = options.batchId || `batch-${randomUUID()}`;
    const importedAt = new Date();
    const errors: ImportErrorEntry[] = [];
    const warnings: string[] = [];
    const employeeCache = new Map<string, string | null>();
    const processedKeys = new Set<string>();

    let successfulRecords = 0;
    let duplicateRecords = 0;
    let batch = db.batch();
    let operationsInBatch = 0;
    const BATCH_WRITE_LIMIT = 400;
    const CHECK_CHUNK_SIZE = 400;

    const commitBatch = async () => {
      if (operationsInBatch === 0) {
        return;
      }

      await batch.commit();
      batch = db.batch();
      operationsInBatch = 0;
    };

    const preparedRecords: PreparedImportRecord[] = [];

    for (const record of records) {
      try {
        const uniqueKey = this.buildUniqueKey(
          options.projectLocationId,
          record.employeeNumber,
          record.scanDateTime
        );
        if (processedKeys.has(uniqueKey)) {
          warnings.push(
            `ข้ามข้อมูลซ้ำ: ${record.employeeNumber} เวลา ${record.scanDateTime.toISOString()} (แถว ${record.rowNumber})`
          );
          continue;
        }
        processedKeys.add(uniqueKey);

        if (record.scanDateTime.getTime() > importedAt.getTime() + 60_000) {
          errors.push({
            row: record.rowNumber,
            employeeNumber: record.employeeNumber,
            error: 'เวลาสแกนอยู่ในอนาคต',
          });
          continue;
        }

        let dailyContractorId: string | null | undefined = employeeCache.get(
          record.employeeNumber
        );

        if (dailyContractorId === undefined) {
          const contractor =
            await dailyContractorService.findByEmployeeIdOrHistory(record.employeeNumber);
          dailyContractorId = contractor?.id ?? null;
          employeeCache.set(record.employeeNumber, dailyContractorId);
        }

        if (!dailyContractorId) {
          errors.push({
            row: record.rowNumber,
            employeeNumber: record.employeeNumber,
            error: 'ไม่พบข้อมูลแรงงานที่มีรหัสนี้',
          });
          continue;
        }

        const scanBehavior = classifyScanBehavior(record.scanDateTime);
        const { isLate, lateMinutes } = checkLate(record.scanDateTime);
        const workDate = new Date(record.scanDateTime);
        workDate.setHours(0, 0, 0, 0);
        const roundedTime = roundDownToFiveMinutes(record.scanDateTime);

        const scanData: Omit<ScanData, 'id'> = {
          dailyContractorId,
          employeeId: record.employeeNumber,
          employeeNumber: record.employeeNumber,
          projectLocationId: options.projectLocationId,
          scanDateTime: record.scanDateTime,
          scanBehavior,
          workDate,
          roundedTime,
          isLate,
          lateMinutes,
          hasDiscrepancy: false,
          createdAt: importedAt,
          importedAt,
          importedBy: options.importedBy,
          importBatchId,
          importSource: options.source,
          importNote: options.importNote,
          rawData:
            record.rawData ||
            (record.rawLine
              ? {
                line: record.rawLine,
              }
              : undefined),
        };

        const docRef = collections.scanData.doc(uniqueKey) as any;
        preparedRecords.push({
          uniqueKey,
          rowNumber: record.rowNumber,
          employeeNumber: record.employeeNumber,
          docRef,
          scanData,
        });
      } catch (error: any) {
        logger.error('Error processing scan data record', {
          error: error?.message,
          row: record.rowNumber,
        });
        errors.push({
          row: record.rowNumber,
          employeeNumber: record.employeeNumber,
          error: error?.message || 'ไม่สามารถบันทึกข้อมูลแถวนี้ได้',
        });
      }
    }

    for (let i = 0; i < preparedRecords.length; i += CHECK_CHUNK_SIZE) {
      const chunk = preparedRecords.slice(i, i + CHECK_CHUNK_SIZE);
      const refs = chunk.map((item) => item.docRef);
      const snapshots = await db.getAll(...refs);

      for (let index = 0; index < snapshots.length; index += 1) {
        const item = chunk[index];
        const snapshot = snapshots[index];

        if (snapshot?.exists) {
          duplicateRecords += 1;
          warnings.push(
            `ข้อมูลซ้ำ: ${item.employeeNumber} เวลา ${item.scanData.scanDateTime.toISOString()} (แถว ${item.rowNumber})`
          );
        } else {
          batch.set(item.docRef, item.scanData, { merge: false });
          operationsInBatch += 1;
          successfulRecords += 1;
        }

        if (operationsInBatch >= BATCH_WRITE_LIMIT) {
          await commitBatch();
        }
      }
    }

    await commitBatch();

    logger.info('Bulk scan data import completed', {
      importBatchId,
      totalRecords: records.length,
      successfulRecords,
      failedRecords: errors.length,
      warnings: warnings.length,
      duplicateRecords,
    });

    return {
      success: errors.length === 0,
      importBatchId,
      totalRecords: records.length,
      successfulRecords,
      failedRecords: errors.length,
      errors,
      warnings,
    };
  }

  /**
   * Detect discrepancies between Scan Data and Daily Reports
   */
  async detectDiscrepancies(
    projectLocationId: string,
    startDate: Date,
    endDate: Date,
    detectedBy: string
  ): Promise<{ detected: number; discrepanciesCreated: number }> {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // 1. Fetch all Daily Reports for the range
      const reports = await dailyReportService.getByProjectAndDate(projectLocationId, start, end);

      // 2. Fetch all Scan Data for the range
      const scans = await this.getByProjectAndDate(projectLocationId, start, end);

      // 3. Group by DC and Date
      const reportMap = new Map<string, DailyReport[]>();
      reports.forEach((r: DailyReport) => {
        const key = `${r.dailyContractorId}_${r.workDate.toISOString().split('T')[0]}`;
        if (!reportMap.has(key)) reportMap.set(key, []);
        reportMap.get(key)!.push(r);
      });

      const scanMap = new Map<string, ScanData[]>();
      scans.forEach((s: ScanData) => {
        const key = `${s.dailyContractorId}_${s.workDate.toISOString().split('T')[0]}`;
        if (!scanMap.has(key)) scanMap.set(key, []);
        scanMap.get(key)!.push(s);
      });

      const allKeys = new Set([...reportMap.keys(), ...scanMap.keys()]);
      let discrepanciesCreated = 0;
      const now = new Date();

      const batch = db.batch();

      for (const key of allKeys) {
        const [dcId, dateStr] = key.split('_');
        const workDate = new Date(dateStr);
        const dayReports = reportMap.get(key) || [];
        const dayScans = scanMap.get(key) || [];

        const reportedHours = dayReports.reduce((sum, r) => sum + (r.netHours || 0), 0);
        let scannedHours = 0;

        if (dayScans.length >= 2) {
          // Calculate from first and last scan
          const times = dayScans.map(s => s.scanDateTime.getTime()).sort();
          const first = times[0];
          const last = times[times.length - 1];
          let diffMs = last - first;

          // Deduct lunch if span covers 12:00-13:00
          const firstDate = new Date(first);
          const lastDate = new Date(last);
          if (firstDate.getHours() < 12 && lastDate.getHours() >= 13) {
            diffMs -= 60 * 60 * 1000;
          }

          scannedHours = Math.max(0, diffMs / (1000 * 60 * 60));
        }

        const hoursDifference = reportedHours - scannedHours;
        const absDiff = Math.abs(hoursDifference);

        // Logic check: if diff > 1 hour, or one exists while other doesn't
        let shouldCreate = false;
        let reason = '';
        let discrepancyType: 'Type1' | 'Type2' | 'Type3' = 'Type1';

        if (dayReports.length > 0 && dayScans.length < 2) {
          shouldCreate = true;
          discrepancyType = 'Type2';
          reason = 'มี Daily Report แต่ข้อมูลสแกนไม่ครบถ้วน (ต้องการอย่างน้อย 2 ครั้ง)';
        } else if (dayReports.length === 0 && dayScans.length >= 2) {
          shouldCreate = true;
          discrepancyType = 'Type3';
          reason = 'มีข้อมูลสแกนแต่ไม่มี Daily Report';
        } else if (absDiff > 1.0) {
          shouldCreate = true;
          discrepancyType = 'Type1';
          reason = `ชั่วโมงทำงานไม่ตรงกัน (ส่วนต่าง ${hoursDifference.toFixed(2)} ชม.)`;
        }

        if (shouldCreate) {
          const discId = `${dcId}_${dateStr}_disc`;
          const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discId);

          const absDiffVal = Math.abs(hoursDifference);
          const severity = absDiffVal > 2 ? 'error' : 'warning';

          const discrepancyData: any = {
            dailyReportId: dayReports[0]?.id || 'missing',
            dailyContractorId: dcId,
            projectLocationId,
            workDate,
            discrepancyType,
            reportedHours,
            scannedHours,
            hoursDifference,
            severity,
            status: 'pending',
            detectionReason: reason,
            createdAt: now,
            detectedBy,
          };

          batch.set(discRef, discrepancyData);
          discrepanciesCreated++;
        }
      }

      if (discrepanciesCreated > 0) {
        await batch.commit();
      }

      return { detected: allKeys.size, discrepanciesCreated };
    } catch (error: any) {
      logger.error('Error detecting discrepancies:', error);
      throw error;
    }
  }

  private buildUniqueKey(
    projectLocationId: string,
    employeeId: string,
    scanDateTime: Date
  ): string {
    const normalizedTimestamp = scanDateTime.toISOString().replace(/[:.]/g, '-');
    return `${projectLocationId}_${employeeId}_${normalizedTimestamp}`;
  }

  /**
   * Soft delete scan data
   */
  async softDelete(id: string, deletedBy?: string): Promise<boolean> {
    try {
      const result = await super.softDelete(id, deletedBy);
      if (result) {
        logger.info(`Scan data soft deleted`, { id, deletedBy });
      }
      return result;
    } catch (error: any) {
      logger.error('Error soft deleting scan data:', error);
      throw error;
    }
  }
}

// Singleton instance
export const scanDataService = new ScanDataService();
