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
import { projectLocationService } from '../project/ProjectLocationService';

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
/**
 * ScanDataService
 * Extends CrudService with scan data operations
 */
class ScanDataService extends BaseCrudService<ScanData> {
  constructor() {
    super(collections.scanData as any, 'scanData');
  }

  /**
   * Import scan data (Single Record - merges into daily summary)
   */
  async importScanData(
    input: CreateScanDataInput,
    importedBy: string
  ): Promise<ScanData> {
    try {
      
      // 1. Get contractor info for enrichment
      const contractor = await dailyContractorService.getById(input.dailyContractorId);
      if (!contractor) {
        throw new AppError('ไม่พบข้อมูลพนักงาน', 404);
      }

      const scanDate = this.formatDate(input.scanDateTime);
      const uniqueKey = this.buildUniqueKey(
        input.employeeId,
        input.scanDateTime
      );

      const docRef = collections.scanData.doc(uniqueKey);
      const existingDoc = await docRef.get();
      
      let allScans: string[] = [];
      let existingData: Partial<ScanData> = {};
      
      if (existingDoc.exists) {
        existingData = existingDoc.data() as ScanData;
        allScans = (existingData as any).allScans || [];
      }

      const scanTimeStr = this.formatTime(input.scanDateTime);
      if (!allScans.includes(scanTimeStr)) {
        allScans.push(scanTimeStr);
      }
      allScans.sort();

      // Determine which Time slot to fill (Time1 to Time6)
      const timeSlots: any = {};
      allScans.slice(0, 6).forEach((time, index) => {
        timeSlots[`Time${index + 1}`] = time;
      });

      const scanData: Omit<ScanData, 'id'> = {
        ...(existingData as any),
        dailyContractorId: input.dailyContractorId,
        employeeId: input.employeeId,
        employeeNumber: contractor.employeeId || input.employeeId,
        name: contractor.name,
        position: contractor.skillId,
        projectLocationId: input.projectLocationId,
        projectLocationIds: contractor.projectLocationIds || [input.projectLocationId],
        scanDateTime: input.scanDateTime,
        scanDate,
        scanBehavior: classifyScanBehavior(input.scanDateTime),
        workDate: input.scanDateTime,
        roundedTime: input.scanDateTime,
        isLate: checkLate(input.scanDateTime).isLate,
        lateMinutes: checkLate(input.scanDateTime).lateMinutes,
        hasDiscrepancy: false,
        createdAt: existingDoc.exists ? (existingData as any).createdAt : new Date(),
        importedAt: new Date(),
        importedBy,
        importBatchId: existingDoc.exists ? (existingData as any).importBatchId : `manual-${Date.now()}`,
        importNote: input.importNote,
        ...timeSlots,
        allScans
      };

      await docRef.set(scanData, { merge: true });
      const updated = await docRef.get();
      return { id: updated.id, ...updated.data() } as ScanData;
    } catch (error: any) {
      logger.error('Error importing scan data:', error);
      throw error;
    }
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTime(d: Date): string {
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${hour}:${min}:${sec}`;
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
      return await this.queryWithFallback([
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
    } catch (error: any) {
      if (error.code === 9 || error.message?.includes('index')) {
        logger.warn('Index missing for getByProjectAndDate, falling back to in-memory filtering', { projectLocationId });
        // Fallback: Query by project only and filter by date in memory
        const allProjectScans = await this.query([
          {
            field: 'projectLocationId',
            operator: '==',
            value: projectLocationId,
          }
        ]);
        
        return allProjectScans.filter(s => {
          const d = s.workDate instanceof Date ? s.workDate : (s.workDate as any).toDate();
          return d >= startDate && d <= endDate;
        });
      }
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
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    
    console.log(`[ScanDataService] bulkImport started. Version: 2026-03-30_1540. Aggregating ${records.length} records.`);
    
    let projectDepartmentName = '#N/A';
    let projectCode = '';
    let projectName = '';
    try {
      const projectLocation = await projectLocationService.getById(options.projectLocationId);
      if (projectLocation) {
        if (projectLocation.department) projectDepartmentName = projectLocation.department;
        projectCode = projectLocation.projectCode || projectLocation.code || '';
        projectName = projectLocation.projectName || '';
      }
    } catch (e) {
      logger.warn(`Could not fetch details for project location ${options.projectLocationId}`);
    }
    const employeeCache = new Map<string, string | null>();
    const rowSummaries: RowSummary[] = [];

    let successfulRecords = 0;
    let failedRecords = 0;
    let batch = db.batch();
    let operationsInBatch = 0;
    const BATCH_WRITE_LIMIT = 400;

    const commitBatch = async () => {
      if (options.dryRun || operationsInBatch === 0) {
        return;
      }

      await batch.commit();
      batch = db.batch();
      operationsInBatch = 0;
    };

    // Pre-populate contractor cache for performance and validation
    for (const record of records) {
      if (!employeeCache.has(record.employeeNumber)) {
        try {
          const contractor = await dailyContractorService.findByEmployeeIdOrHistory(record.employeeNumber);
          employeeCache.set(record.employeeNumber, contractor ? contractor.id : null);
          
          if (!contractor) {
            rowSummaries.push({
              row: record.rowNumber,
              status: 'failed',
              employeeNumber: record.employeeNumber,
              data: record.rowData || {},
              error: 'ไม่พบข้อมูลพนักงานในระบบ (หรือไม่อยู่ในโครงการที่เลือก)'
            });
          }
        } catch (e: any) {
          employeeCache.set(record.employeeNumber, null);
          rowSummaries.push({
             row: record.rowNumber,
             status: 'failed',
             employeeNumber: record.employeeNumber,
             data: record.rowData || {},
             error: `Error checking contractor: ${e.message}`
          });
        }
      }
    }

    const aggregatedDailyRows = ScanDataAggregator.aggregate(records);
    
    // Process each aggregated day
    for (const group of aggregatedDailyRows) {
      try {
        const contractor = await dailyContractorService.findByEmployeeIdOrHistory(group.employeeNumber);
        
        if (!contractor) {
          failedRecords++;
          continue;
        }

        const scanDate = group.workDate; // Aggregator returns YYYY-MM-DD
        const uniqueKey = `SCAN_${group.employeeNumber}_${projectCode}_${scanDate}`;
        const docRef = collections.scanData.doc(uniqueKey);

        const workDate = new Date(group.workDate);
        workDate.setHours(0, 0, 0, 0);

        const primaryScan = group.timeScans.length > 0 ? group.timeScans[0] : null;

        const scanData: Omit<ScanData, 'id'> = {
          dailyContractorId: contractor.id,
          employeeId: group.employeeNumber,
          employeeNumber: group.employeeNumber,
          name: contractor.name,
          position: contractor.skillId,
          projectLocationId: options.projectLocationId, // Primary project for this import
          projectLocationIds: contractor.projectLocationIds || [options.projectLocationId],
          scanDateTime: primaryScan || workDate, // Fallback to workDate start if no time records
          scanDate,
          scanBehavior: primaryScan ? classifyScanBehavior(primaryScan) : 'regular_in',
          workDate,
          roundedTime: group.timeScans[0],
          isLate: group.lateMinutes > 0,
          lateMinutes: group.lateMinutes,
          hasDiscrepancy: false,
          createdAt: importedAt,
          importedAt,
          importedBy: options.importedBy,
          importBatchId,
          importSource: options.source,
          importNote: options.importNote,
          Time1: group.time1,
          Time2: group.time2,
          Time3: group.time3,
          Time4: group.time4,
          Time5: group.time5,
          Time6: group.time6,
          allScans: group.timeScans.map(t => this.formatTime(t)),
          punches: group.punches,
          firstIn: group.firstIn,
          lastOut: group.lastOut,
          projectCode: projectCode,
          projectName: projectName,
          isDeleted: false,
          rawData: {
            importSource: options.source,
            aggregated: true
          }
        };

        // Track date range for discrepancy detection
        if (!minDate || workDate < minDate) minDate = new Date(workDate);
        if (!maxDate || workDate > maxDate) maxDate = new Date(workDate);

        if (!options.dryRun) {
          batch.set(docRef, scanData, { merge: true });
          operationsInBatch++;
        }
        successfulRecords++;

        if (operationsInBatch >= BATCH_WRITE_LIMIT) {
          await commitBatch();
        }
      } catch (err: any) {
        logger.error('Error saving aggregated scan data:', err);
        failedRecords++;
      }
    }

    await commitBatch();

    // Trigger automatic discrepancy detection for the imported date range
    if (!options.dryRun && minDate && maxDate) {
      try {
        console.log(`[ScanDataService] Triggering auto discrepancy detection: ${options.projectLocationId} from ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
        await this.detectDiscrepancies(
          options.projectLocationId,
          minDate,
          maxDate,
          options.importedBy
        );
      } catch (detectErr) {
        logger.error('Error in automatic discrepancy detection after import:', detectErr);
        warnings.push('Auto-discrepancy detection failed. Please run manually if needed.');
      }
    }

    // Map failed components
    const failedOrDuplicate = rowSummaries.filter(rs => rs.status !== 'success');
    const rowStatusMap = new Map<number, { status: string, error?: string }>();
    for (const rs of failedOrDuplicate) {
      if (!rowStatusMap.has(rs.row)) {
         rowStatusMap.set(rs.row, { status: rs.status, error: rs.error });
      }
    }
    
    const finalRowSummaries: RowSummary[] = [];

    for (const group of aggregatedDailyRows) {
      const dailyContractorId = employeeCache.get(group.employeeNumber);
      
      let reportMorningOT = 0;
      let reportEveningOT = 0;
      let reportLunchOT = 0;
      let reportNormalStatus = 0;
      let department = projectDepartmentName;
      let hasReport = false;

      if (dailyContractorId) {
        // Find daily reports for this date
        const d = new Date(group.workDate);
        try {
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
        } catch (reportErr: any) {
          logger.warn(`Could not fetch daily reports for contractor ${dailyContractorId} on ${group.workDate}: ${reportErr?.message}`);
          // Continue with hasReport = false (treat as no report)
        }
      }

      const otLunchScan = group.lunchStatus === 1 ? 1 : 0; // Assuming 1 hr OT for skipped lunch
      
      const diffLunch = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(otLunchScan - reportLunchOT);
      const diffMorning = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(group.otMorningHours - reportMorningOT);
      const diffEvening = !hasReport ? 'ไม่พบข้อมูลใน Report' : Math.abs(group.otEveningHours - reportEveningOT);

      // Determine if this grouped row has any errors
      let groupStatus: 'success' | 'failed' | 'duplicate' = 'success';
      let groupError: string | undefined;
      
      for (const r of group.sourceRowNumbers) {
         if (rowStatusMap.has(r)) {
            const err = rowStatusMap.get(r)!;
            groupStatus = err.status as any;
            groupError = err.error;
            break; // Grab the most prominent error
         }
      }

      // Use the first source row number as the display row
      const displayRow = group.sourceRowNumbers.length > 0 ? Math.min(...group.sourceRowNumbers) : 0;

      finalRowSummaries.push({
        row: displayRow,
        status: groupStatus,
        employeeNumber: group.employeeNumber,
        error: groupError,
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

    // Capture standalone parse errors or skipped rows that failed before records abstraction
    for (const rs of failedOrDuplicate) {
      // If none of its sourceRowNumbers made it to aggregatedDailyRows, 
      // (like if `timeScan` array is empty or Employee number is missing), append manually.
      // But aggregatedDailyRows groups by Employee, so if employee exists, it's covered above!
      const covered = aggregatedDailyRows.some(g => g.sourceRowNumbers.includes(rs.row));
      if (!covered) {
        finalRowSummaries.push(rs);
      }
    }

    // Sort final summaries by EmployeeNumber then Date (for aggregated) OR Row (for errors)
    finalRowSummaries.sort((a, b) => {
      // Safe access
      const empA = String(a.employeeNumber || '');
      const empB = String(b.employeeNumber || '');
      
      if (empA && empB && empA !== empB) {
        return empA.localeCompare(empB, undefined, { numeric: true });
      }
      
      // If both are success (aggregated), sort by Date
      const dateA = a.data?.Date || '';
      const dateB = b.data?.Date || '';
      if (a.status === 'success' && b.status === 'success' && dateA && dateB) {
         return String(dateA).localeCompare(String(dateB));
      }
      
      const rowA = Number(a.row) || 0;
      const rowB = Number(b.row) || 0;
      return rowA - rowB;
    });

    // Deduplicate errors and warnings by row
    const uniqueErrors: ImportErrorEntry[] = [];
    const seenErrorRows = new Set<number>();
    for (const err of errors) {
      if (!seenErrorRows.has(err.row)) {
        seenErrorRows.add(err.row);
        uniqueErrors.push(err);
      }
    }
    
    // For warnings, just simple array deduplication
    const uniqueWarnings = Array.from(new Set(warnings));
    
    // Calculate accurate metrics based on distinct rows
    const uniqueInputRows = new Set(records.map(r => r.rowNumber));
    const totalUniqueRows = uniqueInputRows.size;
    
    let uniqueFailedRows = 0;
    let uniqueDuplicateRows = 0;
    
    for (const rs of finalRowSummaries) {
      if (rs.status === 'failed') uniqueFailedRows++;
      if (rs.status === 'duplicate') uniqueDuplicateRows++;
    }
    
    const successfulUniqueRows = aggregatedDailyRows.length; // Each aggregated group is exactly one successful row representation

    logger.info(`Bulk scan data import completed ${options.dryRun ? '(Dry Run)' : ''}`, {
      importBatchId,
      totalRecords: totalUniqueRows,
      successfulRecords: successfulUniqueRows,
      failedRecords: uniqueFailedRows,
      warnings: uniqueWarnings.length,
      duplicateRecords: uniqueDuplicateRows,
    });

    return {
      success: uniqueFailedRows === 0,
      importBatchId,
      totalRecords: totalUniqueRows,
      successfulRecords: successfulUniqueRows,
      failedRecords: uniqueFailedRows,
      duplicateRecords: uniqueDuplicateRows,
      errors: uniqueErrors,
      warnings: uniqueWarnings,
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
      // Try with index first
      const recordsSnapshot = await db
        .collection('overtime_records')
        .where('projectLocationId', '==', projectLocationId)
        .where('reportDate', '>=', startDate)
        .where('reportDate', '<=', endDate)
        .get();

      return recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
      // Fallback for missing index: Fetch by projectLocationId only and filter in memory
      if (error?.code === 9 || error?.message?.includes('FAILED_PRECONDITION') || error?.message?.includes('index')) {
        console.warn(`[ScanDataService] Missing index for overtime_records. Falling back to in-memory filtering.`);
        const snapshot = await db.collection('overtime_records')
          .where('projectLocationId', '==', projectLocationId)
          .limit(5000)
          .get();
        
        const start = startDate.getTime();
        const end = endDate.getTime();

        return snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(ot => {
            const rd = ot.reportDate;
            const itemTime = (rd instanceof Date) ? rd.getTime() : 
                            (rd && typeof rd === 'object' && rd.toDate) ? rd.toDate().getTime() : 0;
            return itemTime >= start && itemTime <= end;
          });
      }
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

        // Scanned Hours calculation via same logic as Import Preview (ScanDataAggregator)
        const forAggregator = dayScans.map(s => ({
          employeeNumber: dcId,
          scanDateTime: s.scanDateTime,
          rowNumber: 0
        }));

        const aggregated = ScanDataAggregator.aggregate(forAggregator);
        const daySummary = aggregated.length > 0 ? aggregated[0] : null;

        const scanNormalStatus = daySummary?.normalStatus || 0;
        const scanStatusLabel = scanNormalStatus === 1 ? 'ปกติ' : 'ไม่ครบ';

        // Scanned Hours breakdowns (used for diff calculation)
        const scannedRegularHours = daySummary?.normalStatus ? 8.0 : 0.0;
        const scannedOTHours = (daySummary?.otMorningHours || 0) + (daySummary?.otEveningHours || 0) + (daySummary?.lunchStatus ? 1.0 : 0.0);
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
        } else if (dayReports.length === 0 && dayOTs.length === 0 && dayScans.length >= 1) {
          // Type 3: Scan Data exists but no Daily Report
          shouldCreate = true;
          discrepancyType = 'Type3';
          reason = dayScans.length === 1 
            ? 'มีการสแกนนิ้วเพียง 1 ครั้ง และไม่มีการกรอก Daily Report / OT' 
            : 'มีการสแกนนิ้วเข้า-ออก แต่ไม่มีการกรอก Daily Report / OT';
        } else if (Math.abs(diffTotalHours) > 0.5) { // Any mismatch over 0.5 hours
          shouldCreate = true;
          discrepancyType = 'Type1';
          if (diffRegularHours > 0.5) {
            reason = `ชั่วโมงปกติใน DR (${reportedRegularHours}) ไม่ตรงกับที่สแกนได้ (${scannedRegularHours})`;
          } else if (diffOTHours > 0.5) {
            reason = `ชั่วโมง OT ใน DR/OT Record (${reportedOTHours}) ไม่ตรงกับที่สแกนได้ (${scannedOTHours})`;
          } else {
            reason = `ชั่วโมงการทำงานรวมไม่ตรงกัน (ส่วนต่าง ${diffTotalHours.toFixed(2)} ชม.)`;
          }
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
            scanNormalStatus,
            scanStatusLabel,
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
    employeeId: string,
    scanDate: string | Date
  ): string {
    const d = scanDate instanceof Date ? scanDate : new Date(scanDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${dateStr}_${employeeId}`;
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

      // Manual index fallback for multiple where clauses
      let snapshot;
      try {
        // Try the full composite query (requires index)
        snapshot = await query.orderBy('workDate', 'desc').get();
      } catch (error: any) {
        if (error?.code === 9 || error?.message?.includes('FAILED_PRECONDITION') || error?.message?.includes('index')) {
          console.warn('[ScanDataService] Missing index for discrepancies. Falling back to in-memory filtering.');
          
          // Use only projectLocationId if available (most efficient single-field index)
          let fallbackQuery: FirebaseFirestore.Query = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES);
          if (options.projectId) {
            fallbackQuery = fallbackQuery.where('projectLocationId', '==', options.projectId);
          } else if (options.startDate) {
            fallbackQuery = fallbackQuery.where('workDate', '>=', options.startDate);
          }
          
          snapshot = await fallbackQuery.limit(5000).get(); // Pull a reasonable chunk
        } else {
          throw error;
        }
      }

      let allItems = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      // Mandatory in-memory filtering (to cover the fields skipped in fallback query)
      if (options.projectId) {
         allItems = allItems.filter(item => item.projectLocationId === options.projectId);
      }
      if (options.startDate) {
         const start = options.startDate.getTime();
         allItems = allItems.filter(item => {
            const d = item.workDate?.toDate ? item.workDate.toDate() : new Date(item.workDate);
            return d.getTime() >= start;
         });
      }
      if (options.endDate) {
         const end = options.endDate.getTime();
         allItems = allItems.filter(item => {
            const d = item.workDate?.toDate ? item.workDate.toDate() : new Date(item.workDate);
            return d.getTime() <= end;
         });
      }

      // Manual Sort
      allItems.sort((a, b) => {
        const dateA = a.workDate?.toDate ? a.workDate.toDate().getTime() : new Date(a.workDate).getTime();
        const dateB = b.workDate?.toDate ? b.workDate.toDate().getTime() : new Date(b.workDate).getTime();
        return dateB - dateA; // Descending
      });

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
  /**
   * Delete scan data by batch ID
   * @param batchId The import batch ID to delete
   */
  async deleteByBatchId(batchId: string): Promise<number> {
    try {
      const records = await this.getByBatchId(batchId);
      if (records.length === 0) return 0;

      // Firestore batch limit is 500
      let deletedCount = 0;
      const chunks = [];
      for (let i = 0; i < records.length; i += 500) {
        chunks.push(records.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((doc) => {
          batch.delete(collections.scanData.doc(doc.id));
        });
        await batch.commit();
        deletedCount += chunk.length;
      }

      logger.info(`Deleted ${deletedCount} scan records for batch ${batchId}`);
      return deletedCount;
    } catch (error: any) {
      logger.error(`Error deleting scan data by batch ID ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * Delete scan data by project and date range
   * @param projectLocationId The project ID
   * @param startDate Start date (inclusive)
   * @param endDate End date (inclusive)
   */
  async deleteByProjectAndDateRange(
    projectLocationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const records = await this.getByProjectAndDate(projectLocationId, startDate, endDate);
      if (records.length === 0) return 0;

      let deletedCount = 0;
      const chunks = [];
      for (let i = 0; i < records.length; i += 500) {
        chunks.push(records.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((doc) => {
          batch.delete(collections.scanData.doc(doc.id));
        });
        await batch.commit();
        deletedCount += chunk.length;
      }

      logger.info(
        `Deleted ${deletedCount} scan records for project ${projectLocationId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );
      return deletedCount;
    } catch (error: any) {
      logger.error('Error deleting scan data by project/date:', error);
      throw error;
    }
  }

  /**
   * Add a manual scan record
   */
  async addManualScan(
    payload: {
      employeeNumber: string;
      projectLocationId: string;
      scanDateTime: Date;
      notes?: string;
    },
    addedBy: string
  ): Promise<ScanData> {
    try {
      // Find contractor by employee number
      const contractor = await dailyContractorService.findByEmployeeIdOrHistory(payload.employeeNumber);
      if (!contractor) {
        throw new AppError(`ไม่พบข้อมูลพนักงานที่มีรหัส ${payload.employeeNumber}`, 404);
      }

      const input: CreateScanDataInput = {
        dailyContractorId: contractor.id,
        employeeId: contractor.employeeId || payload.employeeNumber,
        projectLocationId: payload.projectLocationId,
        scanDateTime: payload.scanDateTime,
        importNote: payload.notes || 'Manual Entry',
      };

      const result = await this.importScanData(input, addedBy);

      // Trigger discrepancy detection for this day
      const workDate = new Date(payload.scanDateTime);
      await this.detectDiscrepancies(payload.projectLocationId, workDate, workDate, addedBy);

      return result;
    } catch (error: any) {
      logger.error('Error adding manual scan:', error);
      throw error;
    }
  }

  /**
   * Update a single scan record
   */
  async updateScanData(
    id: string,
    updates: Partial<ScanData>,
    updatedBy: string
  ): Promise<ScanData> {
    try {
      const existing = await this.getById(id);
      if (!existing) throw new AppError('Scan data not found', 404);

      const result = await this.update(id, updates);

      // Re-trigger discrepancy detection for the affected date
      if (existing.workDate || updates.workDate) {
        const date = updates.workDate || existing.workDate;
        await this.detectDiscrepancies(
          updates.projectLocationId || existing.projectLocationId,
          new Date(date),
          new Date(date),
          updatedBy
        );
      }

      return result!;
    } catch (error: any) {
      logger.error('Error updating scan data:', error);
      throw error;
    }
  }

  /**
   * Re-open a resolved discrepancy
   */
  async reopenDiscrepancy(discrepancyId: string, reopenedBy: string): Promise<any> {
    try {
      const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discrepancyId);
      const doc = await discRef.get();
      if (!doc.exists) throw new AppError('Discrepancy not found', 404);

      await discRef.update({
        status: 'pending',
        reopenedAt: new Date(),
        reopenedBy,
        resolutionMethod: null,
        resolutionNote: `Re-opened for editing by ${reopenedBy}`
      });

      const updated = await discRef.get();
      return { id: updated.id, ...updated.data() };
    } catch (error: any) {
      logger.error('Error re-opening discrepancy:', error);
      throw error;
    }
  }
}

// Singleton instance
export const scanDataService = new ScanDataService();
