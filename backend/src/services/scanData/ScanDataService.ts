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
import { ScanDataAggregator } from './ScanDataAggregator';

export interface BulkImportRecord {
  rowNumber: number;
  employeeNumber: string;
  scanDateTime: Date;
  rawLine?: string;
  rawData?: Record<string, unknown>;
  rowData?: any;
}

export interface BulkImportOptions {
  projectLocationId: string;
  importedBy: string;
  importNote?: string;
  source: 'excel' | 'dat' | 'text';
  batchId?: string;
  dryRun?: boolean;
}

export interface ImportErrorEntry {
  row: number;
  employeeNumber?: string;
  error: string;
  rowData?: any;
}

export interface RowSummary {
  row: number;
  status: 'success' | 'failed' | 'duplicate';
  employeeNumber?: string;
  data: any;
  error?: string;
}

export interface ImportSummary {
  success: boolean;
  importBatchId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  duplicateRecords?: number;
  errors: ImportErrorEntry[];
  warnings: string[];
  records: RowSummary[];
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
   * Get scan data by date range (all projects)
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<ScanData[]> {
    try {
      const results = await this.query([
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
      logger.error('Error getting scan data by date range:', error);
      throw error;
    }
  }

  /**
   * Get scan data by batch ID
   */
  async getByBatchId(batchId: string): Promise<ScanData[]> {
    try {
      const results = await this.query([
        {
          field: 'importBatchId',
          operator: '==',
          value: batchId,
        },
      ]);
      return results;
    } catch (error: any) {
      logger.error('Error getting scan data by batch ID:', error);
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
    const projectCheckCache = new Map<string, boolean>();
    const processedKeys = new Set<string>();
    const rowSummaries: RowSummary[] = [];

    let successfulRecords = 0;
    let duplicateRecords = 0;
    let failedRecords = 0;
    let batch = db.batch();
    let operationsInBatch = 0;
    const BATCH_WRITE_LIMIT = 400;
    const CHECK_CHUNK_SIZE = 400;

    const commitBatch = async () => {
      if (options.dryRun || operationsInBatch === 0) {
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
          const warning = `ข้ามข้อมูลซ้ำ: ${record.employeeNumber} เวลา ${record.scanDateTime.toISOString()} (แถว ${record.rowNumber})`;
          warnings.push(warning);
          rowSummaries.push({
            row: record.rowNumber,
            status: 'duplicate',
            employeeNumber: record.employeeNumber,
            data: record.rowData || record.rawData,
            error: 'ข้อมูลซ้ำในไฟล์เดียวกัน'
          });
          continue;
        }
        processedKeys.add(uniqueKey);

        // Support deployments where Server Timezone might be UTC instead of UTC+7 (Thailand)
        // Add 7 hours tolerance just in case importedAt (new Date()) falls behind the actual local time 
        // provided by the scan machines (+ an extra minute overlap)
        const timezoneToleranceMs = 7 * 60 * 60 * 1000;
        if (record.scanDateTime.getTime() > importedAt.getTime() + timezoneToleranceMs + 60_000) {
          const errMsg = 'เวลาสแกนอยู่ในอนาคต';
          errors.push({
            row: record.rowNumber,
            employeeNumber: record.employeeNumber,
            error: errMsg,
          });
          rowSummaries.push({
            row: record.rowNumber,
            status: 'failed',
            employeeNumber: record.employeeNumber,
            data: record.rowData || record.rawData,
            error: errMsg
          });
          failedRecords++;
          continue;
        }

        let dailyContractorId: string | null | undefined = employeeCache.get(
          record.employeeNumber
        );

        if (dailyContractorId === undefined) {
          const contractor = await dailyContractorService.findByEmployeeIdOrHistory(record.employeeNumber);

          if (!contractor) {
            dailyContractorId = null;
          } else {
            dailyContractorId = contractor.id;
            // Also cache project match
            const isAssigned = contractor.projectLocationIds?.includes(options.projectLocationId) ?? false;
            projectCheckCache.set(record.employeeNumber, isAssigned);
          }
          employeeCache.set(record.employeeNumber, dailyContractorId);
        }

        if (!dailyContractorId) {
          const errMsg = 'ไม่พบข้อมูลแรงงานที่มีรหัสนี้ (หาจากทุกโครงการแล้ว)';
          errors.push({
            row: record.rowNumber,
            employeeNumber: record.employeeNumber,
            error: errMsg,
          });
          rowSummaries.push({
            row: record.rowNumber,
            status: 'failed',
            employeeNumber: record.employeeNumber,
            data: record.rowData || record.rawData,
            error: errMsg
          });
          failedRecords++;
          continue;
        }

        const isAssignedToProject = projectCheckCache.get(record.employeeNumber);
        if (!isAssignedToProject) {
          const errMsg = 'พบคนงานในระบบแต่ไม่ได้ถูกมอบหมายให้โครงการนี้';
          errors.push({
            row: record.rowNumber,
            employeeNumber: record.employeeNumber,
            error: errMsg,
          });
          rowSummaries.push({
            row: record.rowNumber,
            status: 'failed',
            employeeNumber: record.employeeNumber,
            data: record.rowData || record.rawData,
            error: errMsg
          });
          failedRecords++;
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
          docRef: docRef as any,
          scanData,
        });
      } catch (error: any) {
        logger.error('Error processing scan data record', {
          error: error?.message,
          row: record.rowNumber,
        });
        const errMsg = error?.message || 'ไม่สามารถบันทึกข้อมูลแถวนี้ได้';
        errors.push({
          row: record.rowNumber,
          employeeNumber: record.employeeNumber,
          error: errMsg,
        });
        rowSummaries.push({
          row: record.rowNumber,
          status: 'failed',
          employeeNumber: record.employeeNumber,
          data: record.rowData || record.rawData,
          error: errMsg
        });
        failedRecords++;
      }
    }

    for (let i = 0; i < preparedRecords.length; i += CHECK_CHUNK_SIZE) {
      const chunk = preparedRecords.slice(i, i + CHECK_CHUNK_SIZE);
      const refs = chunk.map((item) => item.docRef);
      const snapshots = await db.getAll(...(refs as any));

      for (let index = 0; index < snapshots.length; index += 1) {
        const item = chunk[index];
        const snapshot = snapshots[index];
        const originalRecord = records.find(r => r.rowNumber === item.rowNumber);

        if (snapshot?.exists) {
          duplicateRecords += 1;
          const warning = `ข้อมูลซ้ำ: ${item.employeeNumber} เวลา ${item.scanData.scanDateTime.toISOString()} (แถว ${item.rowNumber})`;
          warnings.push(warning);
          rowSummaries.push({
            row: item.rowNumber,
            status: 'duplicate',
            employeeNumber: item.employeeNumber,
            data: originalRecord?.rowData || originalRecord?.rawData,
            error: 'ข้อมูลซ้ำในระบบ'
          });
        } else {
          if (!options.dryRun) {
            batch.set(item.docRef as any, item.scanData, { merge: false });
            operationsInBatch += 1;
          }
          successfulRecords += 1;
          rowSummaries.push({
            row: item.rowNumber,
            status: 'success',
            employeeNumber: item.employeeNumber,
            data: originalRecord?.rowData || originalRecord?.rawData
          });
        }

        if (operationsInBatch >= BATCH_WRITE_LIMIT) {
          await commitBatch();
        }
      }
    }

    await commitBatch();

    // Aggregate the successful records for the preview
    const successfulOriginalRecords = records.filter(r => rowSummaries.some(rs => rs.status === 'success' && rs.row === r.rowNumber));
    const aggregatedDailyRows = ScanDataAggregator.aggregate(successfulOriginalRecords);
    
    // Keep failed/duplicate ones as they are
    const finalRowSummaries: RowSummary[] = rowSummaries.filter(rs => rs.status !== 'success');

    for (const group of aggregatedDailyRows) {
      const dailyContractorId = employeeCache.get(group.employeeNumber);
      
      let reportMorningOT = 0;
      let reportEveningOT = 0;
      let reportLunchOT = 0;
      let reportNormalStatus = 0;
      let department = '#N/A';
      let hasReport = false;

      if (dailyContractorId) {
        // Find daily reports for this date
        const d = new Date(group.workDate);
        const reports = await dailyReportService.getByContractorAndDate(dailyContractorId, d, d);
        
        if (reports && reports.length > 0) {
          hasReport = true;
          for (const rep of reports) {
            if (rep.workType === 'regular') reportNormalStatus = 1;
            else if (rep.workType === 'ot_morning') reportMorningOT += rep.netHours;
            else if (rep.workType === 'ot_noon') reportLunchOT += rep.netHours;
            else if (rep.workType === 'ot_evening') reportEveningOT += rep.netHours;
          }
        }
      }

      const otLunchScan = group.lunchStatus === 1 ? 1 : 0; // Assuming 1 hr OT for skipped lunch
      
      const diffLunch = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(otLunchScan - reportLunchOT);
      const diffMorning = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(group.otMorningHours - reportMorningOT);
      const diffEvening = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(group.otEveningHours - reportEveningOT);

      // Use the first source row number as the display row
      const displayRow = group.sourceRowNumbers.length > 0 ? Math.min(...group.sourceRowNumbers) : 0;

      finalRowSummaries.push({
        row: displayRow,
        status: 'success',
        employeeNumber: group.employeeNumber,
        data: {
          EmployeeNumber: group.employeeNumber,
          Date: group.workDate,
          Time1: group.time1 || '',
          Time2: group.time2 || '',
          Time3: group.time3 || '',
          Time4: group.time4 || '',
          Time5: group.time5 || '',
          Time6: group.time6 || '',
          NormalStatus: group.normalStatus,
          LunchStatus: group.lunchStatus,
          MorningOT: group.otMorningHours,
          EveningOT: group.otEveningHours,
          LateMinutes: group.lateMinutes,
          ReportNormalStatus: reportNormalStatus,
          ReportMorningOT: reportMorningOT,
          ReportLunchOT: reportLunchOT,
          ReportEveningOT: reportEveningOT,
          DiffLunch: diffLunch,
          DiffMorning: diffMorning,
          DiffEvening: diffEvening,
          Department: department
        }
      });
    }

    // Sort final summaries by EmployeeNumber then Date (for aggregated) OR Row (for errors)
    finalRowSummaries.sort((a, b) => {
      if (a.employeeNumber && b.employeeNumber) {
        if (a.employeeNumber !== b.employeeNumber) {
          return a.employeeNumber.localeCompare(b.employeeNumber, undefined, { numeric: true });
        }
      }
      
      // If both are success (aggregated), sort by Date
      if (a.status === 'success' && b.status === 'success' && a.data?.Date && b.data?.Date) {
         return a.data.Date.localeCompare(b.data.Date);
      }
      
      return a.row - b.row;
    });

    logger.info(`Bulk scan data import completed ${options.dryRun ? '(Dry Run)' : ''}`, {
      importBatchId,
      totalRecords: records.length,
      successfulRecords: successfulOriginalRecords.length,
      failedRecords,
      warnings: warnings.length,
      duplicateRecords,
    });

    return {
      success: failedRecords === 0,
      importBatchId,
      totalRecords: records.length,
      successfulRecords: successfulOriginalRecords.length,
      failedRecords,
      duplicateRecords,
      errors,
      warnings,
      records: finalRowSummaries
    };
  }

  /**
   * Helper to fetch Overtime Records for a specific project and date range
   */
  async getOvertimeRecords(
    projectLocationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const recordsSnapshot = await db
        .collection('overtime_records')
        .where('projectLocationId', '==', projectLocationId)
        .where('reportDate', '>=', startDate)
        .where('reportDate', '<=', endDate)
        .get();

      return recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      logger.error('Error fetching overtime records for discrepancy check:', error);
      return [];
    }
  }

  /**
   * Analyze daily scans for a single DC to calculate contextual behaviors and scanned hours
   * 
   * Returns calculated regular and OT hours, based on the 7 scan behaviors.
   */
  analyzeDailyScans(dayScans: ScanData[]): {
    scannedRegularHours: number;
    scannedMorningOT: number;
    scannedEveningOT: number;
    scannedNoonOT: number;
    isLate: boolean;
    lateMinutes: number;
  } {
    let scannedRegularHours = 0;
    let scannedMorningOT = 0;
    let scannedEveningOT = 0;
    const scannedNoonOT = 0; // Noon OT is usually detected by Overtime record + missing lunch break
    let isLate = false;
    let lateMinutes = 0;

    if (!dayScans || dayScans.length < 2) {
      return { scannedRegularHours, scannedMorningOT, scannedEveningOT, scannedNoonOT, isLate, lateMinutes };
    }

    // Sort scans chronologically
    const sortedScans = [...dayScans].sort((a, b) => a.scanDateTime.getTime() - b.scanDateTime.getTime());

    // Contextual groupings
    let morningIn: Date | null = null;
    let regularIn: Date | null = null;
    let lunchOut: Date | null = null;
    let lunchIn: Date | null = null;
    let regularOut: Date | null = null;
    let eveningOut: Date | null = null;

    for (const scan of sortedScans) {
      const behavior = scan.scanBehavior;
      const time = scan.scanDateTime;

      if (behavior === 'ot_morning_in' && !morningIn) morningIn = time;
      // If we see another scan during morning OT, it might be the OUT scan for OT Morning, or just IN for regular.
      // E.g., Scan at 05:00, Scan at 07:30
      if ((behavior === 'ot_morning_in' || behavior === 'ot_morning_out' || behavior === 'regular_in') && morningIn && time > morningIn && !regularIn) {
        // Technically, 08:00 is standard IN. If they scan at 07:30, it can act as both OT Morning OUT and Regular IN.
        regularIn = time;
      }

      if (behavior === 'regular_in' && !regularIn && !morningIn) {
        regularIn = time;
        isLate = scan.isLate;
        lateMinutes = scan.lateMinutes;
      }

      // Lunch breaks
      if (behavior === 'lunch_break') {
        if (!lunchOut) lunchOut = time;
        else if (!lunchIn) lunchIn = time;
      }

      // Regular Out
      if (behavior === 'regular_out' && !regularOut) regularOut = time;

      // Evening OT
      if ((behavior === 'ot_evening_in' || behavior === 'ot_evening_out') && time > (regularOut || regularIn || new Date(0))) {
        eveningOut = time;
      }
    }

    // Mathematical Calculation based on Context
    if (morningIn && regularIn) {
      const diffMs = regularIn.getTime() - morningIn.getTime();
      scannedMorningOT = Math.max(0, diffMs / (1000 * 60 * 60));
    }

    if (regularIn && regularOut) {
      let diffMs = regularOut.getTime() - regularIn.getTime();
      // Deduct lunch break
      if (lunchOut && lunchIn) {
        diffMs -= (lunchIn.getTime() - lunchOut.getTime());
      } else {
        // Standard 1 hour deduction if worked over noon
        if (regularIn.getHours() < 12 && regularOut.getHours() >= 13) {
          diffMs -= 60 * 60 * 1000;
        }
      }
      scannedRegularHours = Math.max(0, diffMs / (1000 * 60 * 60));
    }

    if (regularOut && eveningOut) {
      const diffMs = eveningOut.getTime() - regularOut.getTime();
      scannedEveningOT = Math.max(0, diffMs / (1000 * 60 * 60));
    } else if (eveningOut && !regularOut && regularIn) {
      // Missed regular checkout, stayed for OT
      // Assume 17:00 was regular out
      const standardOut = new Date(regularIn);
      standardOut.setHours(17, 0, 0, 0);

      const standardIn = new Date(regularIn);
      standardIn.setHours(8, 0, 0, 0);

      const actualIn = regularIn > standardIn ? regularIn : standardIn;

      if (eveningOut > standardOut) {
        scannedEveningOT = Math.max(0, (eveningOut.getTime() - standardOut.getTime()) / (1000 * 60 * 60));

        // Calculate regular hours up to 17:00
        let regDiffMs = standardOut.getTime() - actualIn.getTime();
        // Deduct lunch if working over noon
        if (actualIn.getHours() < 12 && standardOut.getHours() >= 13) {
            regDiffMs -= 60 * 60 * 1000;
        }
        scannedRegularHours = Math.max(0, regDiffMs / (1000 * 60 * 60));
      } else {
        // They checked out before 17:00 but it was classified as evening OT? Check time.
        let regDiffMs = eveningOut.getTime() - actualIn.getTime();
        if (actualIn.getHours() < 12 && eveningOut.getHours() >= 13) {
            regDiffMs -= 60 * 60 * 1000;
        }
        scannedRegularHours = Math.max(0, regDiffMs / (1000 * 60 * 60));
        scannedEveningOT = 0;
      }
    }

    // Default fallback if scans don't neatly fit the IN/OUT pairs
    if (sortedScans.length >= 2 && scannedRegularHours === 0 && scannedMorningOT === 0 && scannedEveningOT === 0) {
      const first = sortedScans[0].scanDateTime.getTime();
      const last = sortedScans[sortedScans.length - 1].scanDateTime.getTime();
      let diffMs = last - first;
      const firstHour = new Date(first).getHours();
      const lastHour = new Date(last).getHours();

      if (firstHour < 12 && lastHour >= 13) diffMs -= 60 * 60 * 1000;
      scannedRegularHours = Math.max(0, diffMs / (1000 * 60 * 60));
      
      // Cap at 8 regular hours if it exceeds 9 hours (8 working + 1 lunch)
      if (scannedRegularHours > 8) {
          scannedRegularHours = 8;
      }
    }

    // Default fallback if scans don't neatly fit the IN/OUT pairs
    if (sortedScans.length >= 2 && scannedRegularHours === 0 && scannedMorningOT === 0 && scannedEveningOT === 0) {
      const first = sortedScans[0].scanDateTime.getTime();
      const last = sortedScans[sortedScans.length - 1].scanDateTime.getTime();
      let diffMs = last - first;
      const firstHour = new Date(first).getHours();
      const lastHour = new Date(last).getHours();

      if (firstHour < 12 && lastHour >= 13) diffMs -= 60 * 60 * 1000;
      scannedRegularHours = Math.max(0, diffMs / (1000 * 60 * 60));
    }

    return {
      scannedRegularHours,
      scannedMorningOT,
      scannedEveningOT,
      scannedNoonOT,
      isLate,
      lateMinutes
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

      // 2. Fetch all Overtime Records for the range
      const overtimeRecs = await this.getOvertimeRecords(projectLocationId, start, end);

      // 3. Fetch all Scan Data for the range
      const scans = await this.getByProjectAndDate(projectLocationId, start, end);

      // 4. Group by DC and Date
      const reportMap = new Map<string, DailyReport[]>();
      reports.forEach((r: DailyReport) => {
        const key = `${r.dailyContractorId}_${r.workDate.toISOString().split('T')[0]}`;
        if (!reportMap.has(key)) reportMap.set(key, []);
        reportMap.get(key)!.push(r);
      });

      const otMap = new Map<string, any[]>();
      overtimeRecs.forEach((ot: any) => {
        // Need to flatten because OT can have array of dailyContractorIds
        ot.dailyContractorIds?.forEach((dcId: string) => {
          let otDateStr = '';
          if (ot.reportDate?.toDate) otDateStr = ot.reportDate.toDate().toISOString().split('T')[0];
          else if (ot.reportDate instanceof Date) otDateStr = ot.reportDate.toISOString().split('T')[0];
          else if (typeof ot.reportDate === 'string') otDateStr = new Date(ot.reportDate).toISOString().split('T')[0];

          if (otDateStr) {
            const key = `${dcId}_${otDateStr}`;
            if (!otMap.has(key)) otMap.set(key, []);
            otMap.get(key)!.push(ot);
          }
        });
      });

      const scanMap = new Map<string, ScanData[]>();
      scans.forEach((s: ScanData) => {
        const key = `${s.dailyContractorId}_${s.workDate.toISOString().split('T')[0]}`;
        if (!scanMap.has(key)) scanMap.set(key, []);
        scanMap.get(key)!.push(s);
      });

      const allKeys = new Set([...reportMap.keys(), ...otMap.keys(), ...scanMap.keys()]);
      let discrepanciesCreated = 0;
      const now = new Date();

      const batch = db.batch();

      for (const key of allKeys) {
        const [dcId, dateStr] = key.split('_');
        const workDate = new Date(dateStr);
        const dayReports = reportMap.get(key) || [];
        const dayOTs = otMap.get(key) || [];
        const dayScans = scanMap.get(key) || [];

        // Reported Hours calculation
        const reportedRegularHours = dayReports.reduce((sum, r) => sum + (r.netHours || 0), 0);
        const reportedOTHours = dayOTs.reduce((sum, ot) => sum + (ot.workHours || 0), 0);
        const reportedTotalHours = reportedRegularHours + reportedOTHours;

        // Scanned Hours calculation via Contextual Engine
        const analyzedScans = this.analyzeDailyScans(dayScans);
        const scannedRegularHours = analyzedScans.scannedRegularHours;
        const scannedOTHours = analyzedScans.scannedMorningOT + analyzedScans.scannedEveningOT + analyzedScans.scannedNoonOT;
        const scannedTotalHours = scannedRegularHours + scannedOTHours;

        // Compare sums
        const diffTotalHours = reportedTotalHours - scannedTotalHours;
        const diffRegularHours = reportedRegularHours - scannedRegularHours;
        const diffOTHours = reportedOTHours - scannedOTHours;

        let shouldCreate = false;
        let reason = '';
        let discrepancyType: 'Type1' | 'Type2' | 'Type3' = 'Type1';

        // Discrepancy Classification
        if ((dayReports.length > 0 || dayOTs.length > 0) && dayScans.length < 2) {
          // Type 2: Daily Report exists but no Scan Data
          shouldCreate = true;
          discrepancyType = 'Type2';
          reason = 'มี Daily Report หรือ OT Record แต่ข้อมูลสแกนนิ้วน้อยกว่า 2 ครั้ง';
        } else if (dayReports.length === 0 && dayOTs.length === 0 && dayScans.length >= 2) {
          // Type 3: Scan Data exists but no Daily Report
          shouldCreate = true;
          discrepancyType = 'Type3';
          reason = 'มีการสแกนนิ้วเข้า-ออก แต่ไม่มีการกรอก Daily Report / OT';
        } else if (diffTotalHours > 0.5) { // Type 1: Reported > Scanned. Tolerance of 0.5hr (30m)
          // Actually, Type 1 in User request is: Daily Report hours < Scan Data hours.
          // Is it? Let's flag any mismatch over 0.5 hours.
          shouldCreate = true;
          discrepancyType = 'Type1';
          if (diffRegularHours > 0.5 && diffOTHours > 0.5) {
            reason = `ลงชั่วโมงปกติเกิน ${diffRegularHours.toFixed(2)} ชม. และชั่วโมง OT เกิน ${diffOTHours.toFixed(2)} ชม.`;
          } else if (diffRegularHours > 0.5) {
            reason = `ลงชั่วโมงทำงานปกติมากกว่าสแกนจริง ${diffRegularHours.toFixed(2)} ชม.`;
          } else if (diffOTHours > 0.5) {
            reason = `ลงชั่วโมง OT มากกว่าสแกนจริง ${diffOTHours.toFixed(2)} ชม.`;
          } else if (diffTotalHours > 0.5) {
            reason = `ชั่วโมงทำงานรวมไม่ตรงกัน (ส่วนต่าง ${diffTotalHours.toFixed(2)} ชม.)`;
          }
        } else if (diffTotalHours < -0.5) { // Under-reported
          shouldCreate = true;
          discrepancyType = 'Type1';
          reason = `สแกนนิ้วมากกว่าชั่วโมงที่กรอก ${Math.abs(diffTotalHours).toFixed(2)} ชม. (อาจลืมกรอก OT)`;
        }

        if (shouldCreate) {
          const discId = `${dcId}_${dateStr}_disc`;
          const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discId);

          const absDiffVal = Math.abs(diffTotalHours);
          const severity = absDiffVal >= 2 ? 'error' : 'warning'; // If mismatch is >= 2 hours => Red Error

          const discrepancyData: any = {
            dailyReportId: dayReports[0]?.id || 'missing',
            dailyContractorId: dcId,
            projectLocationId,
            workDate,
            discrepancyType,
            reportedHours: reportedTotalHours,
            scannedHours: scannedTotalHours,
            hoursDifference: diffTotalHours, // POSITIVE = Reported > Scanned
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

  /**
   * Resolve discrepancy
   * FR-SD-013: Resolution methods
   */
  async resolveDiscrepancy(
    discrepancyId: string,
    resolutionData: {
      resolutionMethod: 'update_dr' | 'create_dr' | 'verify' | 'ignore';
      resolutionNote: string;
      updatedHours?: number;
    },
    resolvedBy: string
  ): Promise<any> {
    try {
      const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discrepancyId);
      const doc = await discRef.get();
      if (!doc.exists) {
        throw new AppError('Discrepancy not found', 404);
      }

      const discrepancy = doc.data() as any;
      if (discrepancy.status !== 'pending') {
        throw new AppError('Discrepancy is already resolved', 400);
      }

      const now = new Date();
      let newStatus = 'verified';
      let dailyReportId = discrepancy.dailyReportId;

      const { resolutionMethod, resolutionNote, updatedHours } = resolutionData;

      if (resolutionMethod === 'update_dr') {
        if (!dailyReportId || dailyReportId === 'missing') {
          throw new AppError('No Daily Report found to update', 400);
        }

        const report = await dailyReportService.getById(dailyReportId);
        if (!report) {
          throw new AppError('Daily Report not found for update', 404);
        }

        // Use updatedHours to adjust end time if provided
        let newEndTime = report.endTime;
        if (updatedHours !== undefined && updatedHours >= 0) {
          const msToAdd = (updatedHours + report.breakHours) * 60 * 60 * 1000;
          // newEndTime = startTime + msToAdd (converting hours to ms)
          newEndTime = new Date(report.startTime.getTime() + msToAdd);
        }

        await dailyReportService.updateDailyReport(
          dailyReportId,
          {
            endTime: newEndTime,
            notes: `Updated from ScanData Discrepancy resolution: ${resolutionNote}`
          },
          resolvedBy
        );
        newStatus = 'fixed';

      } else if (resolutionMethod === 'create_dr') {
        if (discrepancy.discrepancyType !== 'Type3') {
          throw new AppError('Cannot create Daily Report for this discrepancy type', 400);
        }

        const scans = await this.getByContractorAndDate(
          discrepancy.dailyContractorId,
          new Date(discrepancy.workDate),
          new Date(discrepancy.workDate)
        );

        const workDate = new Date(discrepancy.workDate);
        let startTime = new Date(workDate.setHours(8, 0, 0, 0));
        let endTime = new Date(workDate.setHours(17, 0, 0, 0));

        if (scans && scans.length >= 2) {
          const times = scans.map(s => s.scanDateTime.getTime()).sort();
          startTime = new Date(times[0]);
          endTime = new Date(times[times.length - 1]);
        }

        const newReport = await dailyReportService.createDailyReport(
          {
            projectLocationId: discrepancy.projectLocationId,
            dailyContractorId: discrepancy.dailyContractorId,
            taskName: 'Auto-created from ScanData',
            workDate: new Date(discrepancy.workDate),
            startTime,
            endTime,
            workType: 'regular',
            notes: `Auto-created from ScanData Discrepancy resolution: ${resolutionNote}`,
            status: 'draft',
          },
          resolvedBy
        );
        dailyReportId = newReport.id;
        newStatus = 'fixed';
      } else if (resolutionMethod === 'ignore') {
        newStatus = 'ignored';
      }

      // Update discrepancy document
      const updateData = {
        status: newStatus,
        resolutionMethod,
        resolutionNote,
        resolvedAt: now,
        resolvedBy,
        ...(dailyReportId && dailyReportId !== 'missing' ? { dailyReportId } : {})
      };

      await discRef.update(updateData);

      const updatedDoc = await discRef.get();
      return { id: updatedDoc.id, ...updatedDoc.data() };
    } catch (error: any) {
      logger.error('Error resolving discrepancy:', error);
      throw error;
    }
  }

  /**
   * Get paginated discrepancies
   */
  async getDiscrepancies(options: {
    page: number;
    pageSize: number;
    projectId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ items: any[]; total: number; page: number; pageSize: number; totalPages: number }> {
    try {
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES);

      if (options.projectId) {
        query = query.where('projectLocationId', '==', options.projectId);
      }
      if (options.startDate) {
        query = query.where('workDate', '>=', options.startDate);
      }
      if (options.endDate) {
        query = query.where('workDate', '<=', options.endDate);
      }

      // Order by descending workDate
      query = query.orderBy('workDate', 'desc');

      const snapshot = await query.get();
      const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const total = allItems.length;

      const { page, pageSize } = options;
      const start = (page - 1) * pageSize;
      const pagedData = allItems.slice(start, start + pageSize);

      // Enhance with basic contractor string if missing
      for (const item of pagedData) {
         if (!item.employeeNumber && item.dailyContractorId) {
            const dc = await dailyContractorService.getById(item.dailyContractorId);
            if (dc) {
               item.employeeNumber = dc.employeeId || dc.id;
               item.dailyContractorName = dc.name || `${(dc as any).firstName || ''} ${(dc as any).lastName || ''}`.trim() || 'Unknown';
            }
         }
      }

      return {
        items: pagedData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error: any) {
      logger.error('Error fetching discrepancies:', error);
      throw error;
    }
  }

  /**
   * Get summary of discrepancies for Dashboard
   */
  async getDiscrepancySummary(projectId?: string): Promise<any> {
    try {
      let queryRef: FirebaseFirestore.Query = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
        .where('status', '==', 'pending');

      if (projectId) {
        queryRef = queryRef.where('projectLocationId', '==', projectId);
      }

      const snapshot = await queryRef.get();
      const discrepancies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return {
        totalDiscrepancies: discrepancies.length,
        pendingCount: discrepancies.length,
        type1Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type1').length,
        type2Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type2').length,
        type3Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type3').length,
        highSeverityCount: discrepancies.filter((d: any) => d.severity === 'error').length,
        // Sort by created descending
        recentDiscrepancies: discrepancies
            .sort((a: any, b: any) => {
              const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
              const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 5),
      };
    } catch (error: any) {
      logger.error('Error fetching discrepancy summary:', error);
      throw error;
    }
  }
}

// Singleton instance
export const scanDataService = new ScanDataService();
