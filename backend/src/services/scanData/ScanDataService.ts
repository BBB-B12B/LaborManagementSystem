/**
 * ScanDataService
 * บริการจัดการข้อมูลสแกนนิ้ว
 *
 * Manages fingerprint scan data with CRUD operations and processing.
 */

import { randomUUID } from 'crypto';
import type { FirebaseFirestore } from 'firebase-admin/firestore';
import { CrudService } from '../base/CrudService';
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
  source: 'excel' | 'dat';
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
class ScanDataService extends CrudService<ScanData> {
  constructor() {
    super(collections.scanData);
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
            await dailyContractorService.findByEmployeeId(record.employeeNumber);
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

        const docRef = collections.scanData.doc(uniqueKey);
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

  private buildUniqueKey(
    projectLocationId: string,
    employeeId: string,
    scanDateTime: Date
  ): string {
    const normalizedTimestamp = scanDateTime.toISOString().replace(/[:.]/g, '-');
    return `${projectLocationId}_${employeeId}_${normalizedTimestamp}`;
  }
}

// Singleton instance
export const scanDataService = new ScanDataService();
