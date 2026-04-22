/**
 * ScanDataService
 * บริการจัดการข้อมูลสแกนนิ้ว
 *
 * Manages fingerprint scan data with CRUD operations and processing.
 */

import { randomUUID } from 'crypto';
import { BaseCrudService, PaginatedResult, PaginationOptions } from '../base/BaseCrudService';
import {
  ScanData,
  CreateScanDataInput,
  classifyScanBehavior,
  checkLate,
} from '../../models/ScanData';
import { 
  ScanDataDiscrepancy, 
  calculateSeverity 
} from '../../models/ScanDataDiscrepancy';
import { COLLECTIONS, collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { db } from '../../config/firebase';
import { dailyContractorService } from '../dailyContractor/DailyContractorService';
import { dailyReportService } from '../dailyReport/DailyReportService';
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
 * Extends BaseCrudService with scan data operations
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
      const contractor = await dailyContractorService.getById(input.dailyContractorId);
      if (!contractor) {
        throw new AppError('ไม่พบข้อมูลพนักงาน', 404);
      }

      const scanDate = this.formatDate(input.scanDateTime);
      const projectCodeSafe = String(input.projectCode || '').replace(/\//g, '-');
      const uniqueKey = ScanDataService.generateScanDocKey(
        input.employeeId,
        projectCodeSafe,
        scanDate,
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

      const timeSlots: any = {};
      allScans.slice(0, 10).forEach((time, index) => {
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
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  private formatTime(d: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
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
      const scans = await this.query([
        { field: 'dailyContractorId', operator: '==', value: dailyContractorId },
        { field: 'workDate', operator: '>=', value: startDate },
        { field: 'workDate', operator: '<=', value: endDate },
      ]);
      // Filter in-memory to include documents where isDeleted is missing or false
      return scans.filter(s => (s as any).isDeleted !== true);
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
    endDate: Date,
    onlyDeleted: boolean = false
  ): Promise<ScanData[]> {
    try {
      const scans = await this.queryWithFallback([
        { field: 'projectLocationId', operator: '==', value: projectLocationId },
        { field: 'workDate', operator: '>=', value: startDate },
        { field: 'workDate', operator: '<=', value: endDate },
      ]);
      // Filter in-memory to include documents based on onlyDeleted flag
      return scans.filter(s => onlyDeleted ? (s as any).isDeleted === true : (s as any).isDeleted !== true);
    } catch (error: any) {

      logger.error('Error getting scan data by project:', error);
      throw error;
    }
  }

  /**
   * Get scan data by batch ID
   */
  async getByBatchId(batchId: string): Promise<ScanData[]> {
    try {
      return await this.query([{ field: 'importBatchId', operator: '==', value: batchId }]);
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
      const filters: any[] = [{ field: 'isLate', operator: '==', value: true }];
      if (projectLocationId) filters.push({ field: 'projectLocationId', operator: '==', value: projectLocationId });
      if (startDate) filters.push({ field: 'workDate', operator: '>=', value: startDate });
      if (endDate) filters.push({ field: 'workDate', operator: '<=', value: endDate });
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
        filters.push({ field: 'projectLocationId', operator: '==', value: projectLocationId });
      }
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
      return await this.update(scanId, { matchedDailyReportId: dailyReportId });
    } catch (error: any) {
      logger.error('Error matching scan to daily report:', error);
      throw error;
    }
  }

  /**
   * Get all scan data with complex filtering and proper pagination
   */
  async getAllFiltered(options: any): Promise<PaginatedResult<ScanData>> {
    const page = parseInt(options.page || '1', 10);
    const pageSize = parseInt(options.pageSize || '50', 10);
    const orderBy = options.orderBy || 'workDate';
    const orderDirection = options.orderDirection || 'desc';
    const onlyDeleted = options.onlyDeleted === true || options.onlyDeleted === 'true';

    const filters: any[] = [];
    if (options.projectId) filters.push({ field: 'projectLocationId', operator: '==', value: options.projectId });
    if (options.startDate) filters.push({ field: 'workDate', operator: '>=', value: options.startDate });
    if (options.endDate) filters.push({ field: 'workDate', operator: '<=', value: options.endDate });
    
    // Total count for these filters
    // Note: We use queryWithFallback style logic if needed, but for now we'll assume indexes exist or use base query
    const total = await this.count([
      ...filters,
      { field: 'isDeleted', operator: '==', value: onlyDeleted }
    ]).catch(() => this.count(filters)); // Fallback if isDeleted index is missing

    // Get paginated items
    const items = await this.queryWithFallback([
      ...filters,
      { field: 'isDeleted', operator: '==', value: onlyDeleted }
    ], {
      page,
      pageSize,
      orderBy,
      orderDirection
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Bulk import scan data records
   *
   * Strategy: Insert-only — if a document with the same ID already exists,
   * skip it entirely. The database is the source of truth.
   * Uses BulkWriter for automatic batching, parallel writes, and retry.
   */
  async bulkImport(
    records: BulkImportRecord[],
    options: BulkImportOptions
  ): Promise<ImportSummary> {
    if (!Array.isArray(records) || records.length === 0) {
      throw new AppError('ไม่พบข้อมูลสำหรับ import', 400);
    }

    const importBatchId = options.batchId || `batch-${randomUUID()}`;
    const importedAt = new Date();
    const errors: ImportErrorEntry[] = [];
    const warnings: string[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

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
    let skippedRecords = 0;
    let failedRecords = 0;

    // ── Step 1: Fetch all employees in parallel ────────────────────────────
    const uniqueEmployeeNumbers = Array.from(new Set(records.map(r => r.employeeNumber).filter(Boolean)));
    await Promise.all(uniqueEmployeeNumbers.map(async (empNum) => {
      if (!employeeCache.has(empNum)) {
        try {
          const contractor = await dailyContractorService.findByEmployeeIdOrHistory(empNum);
          employeeCache.set(empNum, contractor ? contractor.id : null);
        } catch (e: any) {
          employeeCache.set(empNum, null);
        }
      }
    }));

    // ── Step 2: Aggregate raw records into daily groups ────────────────────
    const aggregatedDailyRows = ScanDataAggregator.aggregate(records);
    const projectCodeSafe = String(projectCode).replace(/\//g, '-');

    // Build all document refs for pre-fetch
    const allDocRefs = aggregatedDailyRows.map(group => ({
      key: ScanDataService.generateScanDocKey(group.employeeNumber, projectCodeSafe, group.workDate),
      ref: collections.scanData.doc(ScanDataService.generateScanDocKey(group.employeeNumber, projectCodeSafe, group.workDate)),
    }));

    // ── Step 3: Chunked getAll() to find which docs already exist ──────────
    // Parallel fetch in chunks of 500 (Firestore getAll limit per call)
    const CHUNK_SIZE = 500;
    const existingIds = new Set<string>();
    if (allDocRefs.length > 0) {
      const chunks: FirebaseFirestore.DocumentReference[][] = [];
      for (let i = 0; i < allDocRefs.length; i += CHUNK_SIZE) {
        chunks.push(allDocRefs.slice(i, i + CHUNK_SIZE).map(d => d.ref));
      }
      const snapshots = await Promise.all(chunks.map(chunk => db.getAll(...chunk)));
      snapshots.flat().forEach(doc => {
        if (doc.exists) existingIds.add(doc.id);
      });
      logger.info(`[bulkImport] Pre-fetch: ${existingIds.size} existing docs found out of ${allDocRefs.length} total`);
    }

    // ── Step 4: Write only NEW records using BulkWriter ───────────────────
    const newlyInsertedIds = new Set<string>(); // track what was actually inserted
    const writer = db.bulkWriter();

    for (const group of aggregatedDailyRows) {
      try {
        const contractorId = employeeCache.get(group.employeeNumber);
        if (!contractorId) {
          if (!warnings.includes(`ไม่พบข้อมูลพนักงานรหัส ${group.employeeNumber} ในระบบ (บันทึกไว้ชั่วคราว)`)) {
            warnings.push(`ไม่พบข้อมูลพนักงานรหัส ${group.employeeNumber} ในระบบ (บันทึกไว้ชั่วคราว)`);
          }
        }

        const scanDate = group.workDate;
        const uniqueKey = ScanDataService.generateScanDocKey(group.employeeNumber, projectCodeSafe, scanDate);
        const docRef = collections.scanData.doc(uniqueKey);

        const workDate = new Date(group.workDate);
        if (isNaN(workDate.getTime())) {
          logger.warn(`Invalid workDate for ${group.employeeNumber}: ${group.workDate}`);
          failedRecords++;
          continue;
        }
        workDate.setHours(0, 0, 0, 0);

        // ✅ Insert-only: skip records that already exist in the database
        if (existingIds.has(uniqueKey)) {
          skippedRecords++;
          // Do NOT count as successfulRecords anymore, treat it purely as a skipped duplicate
          continue;
        }

        if (!minDate || workDate < minDate) minDate = new Date(workDate);
        if (!maxDate || workDate > maxDate) maxDate = new Date(workDate);

        const primaryScan = group.timeScans.length > 0 ? group.timeScans[0] : null;
        const scanDateTime = (primaryScan && !isNaN(primaryScan.getTime())) ? primaryScan : workDate;

        const scanData: any = {
          dailyContractorId: contractorId,
          employeeId: group.employeeNumber,
          employeeNumber: group.employeeNumber,
          projectLocationId: options.projectLocationId,
          scanDateTime,
          scanDate,
          workDate,
          roundedTime: scanDateTime,
          scanBehavior: classifyScanBehavior(scanDateTime),
          isLate: (group.lateMinutes || 0) > 0,
          lateMinutes: isNaN(group.lateMinutes) ? 0 : group.lateMinutes,
          hasDiscrepancy: false,
          createdAt: importedAt,
          importedAt,
          importedBy: options.importedBy,
          importBatchId,
          Time1: group.time1 || '',
          Time2: group.time2 || '',
          Time3: group.time3 || '',
          Time4: group.time4 || '',
          Time5: group.time5 || '',
          Time6: group.time6 || '',
          Time7: group.time7 || '',
          Time8: group.time8 || '',
          Time9: group.time9 || '',
          Time10: group.time10 || '',
          allScans: group.timeScans.map(t => isNaN(t.getTime()) ? '??:??:??' : this.formatTime(t)),
          normalStatus: isNaN(group.normalStatus) ? 0 : group.normalStatus,
          regularHours: isNaN(group.regularHours) ? 0 : group.regularHours,
          lunchStatus: isNaN(group.lunchStatus) ? 0 : group.lunchStatus,
          otMorningHours: isNaN(group.otMorningHours) ? 0 : group.otMorningHours,
          otEveningHours: isNaN(group.otEveningHours) ? 0 : group.otEveningHours,
          projectName,
          projectCode,
          isDeleted: false,
        };

        // Strip undefined/NaN fields before writing to Firestore
        Object.keys(scanData).forEach(key => {
          if (scanData[key] === undefined || (typeof scanData[key] === 'number' && isNaN(scanData[key]))) {
            delete scanData[key];
          }
        });

        if (!options.dryRun) {
          writer.set(docRef, scanData);
          newlyInsertedIds.add(uniqueKey);
        }
        successfulRecords++;

      } catch (err: any) {
        logger.error(`Failed to process record ${group.employeeNumber}:`, err);
        failedRecords++;
      }
    }

    // BulkWriter handles batching, parallelism, and retry automatically
    if (!options.dryRun) {
      await writer.close();
    }

    logger.info(`[bulkImport] Done: ${successfulRecords} success, ${skippedRecords} skipped, ${failedRecords} failed`);

    // ── Step 5: Detect discrepancies ONLY for newly inserted records ───────
    if (!options.dryRun && newlyInsertedIds.size > 0 && minDate && maxDate) {
      try {
        await this.detectDiscrepancies(
          options.projectLocationId,
          minDate,
          maxDate,
          options.importedBy,
          projectName,
          projectCode,
          newlyInsertedIds,
        );
      } catch (detectErr) {
        warnings.push('Auto-discrepancy detection failed.');
        logger.error('[bulkImport] detectDiscrepancies error:', detectErr);
      }
    }

    // ── Step 6: Build row summaries for response ───────────────────────────
    for (const group of aggregatedDailyRows) {
      const rowDepartment = projectCode || projectDepartmentName || '-';
      const uniqueKey = ScanDataService.generateScanDocKey(group.employeeNumber, projectCodeSafe, group.workDate);
      
      rowSummaries.push({
        row: group.sourceRowNumbers[0] || 0,
        status: existingIds.has(uniqueKey) ? 'duplicate' : 'success',
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
          Time7: group.time7 || '',
          Time8: group.time8 || '',
          Time9: group.time9 || '',
          Time10: group.time10 || '',
          NormalStatus: group.normalStatus,
          RegularHours: group.regularHours,
          LunchStatus: group.lunchStatus,
          MorningOT: group.otMorningHours,
          EveningOT: group.otEveningHours,
          LateMinutes: group.lateMinutes,
          Department: rowDepartment,
        },
      });
    }

    return {
      success: failedRecords === 0,
      importBatchId,
      totalRecords: aggregatedDailyRows.length,
      successfulRecords,
      failedRecords,
      duplicateRecords: skippedRecords,
      errors: [],
      warnings,
      records: rowSummaries,
    };
  }

  /**
   * Soft delete scan data
   */
  async softDelete(id: string, deletedBy?: string): Promise<boolean> {
    try {
      const result = await super.softDelete(id, deletedBy);
      return result;
    } catch (error: any) {
      logger.error('Error soft deleting scan data:', error);
      throw error;
    }
  }

  /**
   * Restore soft-deleted scan data
   */
  async restore(id: string): Promise<boolean> {
    try {
      await this.update(id, { isDeleted: false } as any);
      return true;
    } catch (error: any) {
      logger.error('Error restoring scan data:', error);
      throw error;
    }
  }


  /**
   * GET /api/scan-data/detailed
   */
  async getDetailedScanReport(options: any): Promise<{ data: any[]; total: number }> {
    try {
      let scans: ScanData[] = [];
      let total = 0;

      // Extract filter parameters
      const projectLocationId = options.projectLocationId || options.projectId;
      const startDate = options.startDate;
      const endDate = options.endDate;
      const onlyDeleted = options.onlyDeleted === true || options.onlyDeleted === 'true';

      const page = parseInt(options.page || '1', 10);
      const pageSize = parseInt(options.pageSize || '100', 10);
      const offset = (page - 1) * pageSize;

      const result = await this.getAllFiltered({
        ...options,
        projectId: projectLocationId,
        startDate,
        endDate,
        onlyDeleted,
      });

      scans = result.items;
      total = result.total;

      // ── Fix #2: Pre-fetch all daily reports in 1 query (eliminates N+1) ─────
      // Build a Map keyed by `${projectLocationId}_YYYY-MM-DD` for O(1) lookup
      const reportMap = new Map<string, any[]>();
      if (projectLocationId && startDate && endDate) {
        try {
          const allReports = await dailyReportService.getByProjectAndDateRange(
            projectLocationId,
            new Date(startDate),
            new Date(endDate),
          );
          (allReports || []).forEach((r: any) => {
            const rDate = r.date instanceof Date ? r.date : r.date?.toDate?.();
            if (!rDate) return;
            const dateKey = rDate.toISOString().split('T')[0];
            const key = `${projectLocationId}_${dateKey}`;
            reportMap.set(key, [...(reportMap.get(key) || []), r]);
          });
        } catch (e) {
          logger.warn('[getDetailedScanReport] Could not pre-fetch daily reports for enrichment');
        }
      }

      // ── Map lookup per record — O(1) instead of 1 Firestore call per row ──
      const enriched = scans.map((scan) => {
        const workDate = scan.workDate instanceof Date
          ? scan.workDate
          : (scan.workDate as any)?.toDate?.()
            ?? new Date(scan.workDate as any);

        const dateKey = workDate.toISOString().split('T')[0];
        const dayReports: any[] = reportMap.get(`${projectLocationId}_${dateKey}`) || [];

        const reportData = {
          regular:  dayReports.some((r: any) => r.workType === 'regular') ? 1 : 0,
          otMorning: dayReports
            .filter((r: any) => r.workType === 'ot_morning')
            .reduce((sum: number, r: any) => sum + (r.netHours || 0), 0),
          otNoon:  dayReports.some((r: any) => r.workType === 'ot_noon') ? 1 : 0,
          otEvening: dayReports
            .filter((r: any) => r.workType === 'ot_evening')
            .reduce((sum: number, r: any) => sum + (r.netHours || 0), 0),
        };

        return {
          ...scan,
          detailedView: {
            row: 0,
            status: scan.hasDiscrepancy ? 'pending' : 'verified',
            employeeNumber: scan.employeeNumber,
            date: workDate,
            time1:  (scan as any).Time1  || '-',
            time2:  (scan as any).Time2  || '-',
            time3:  (scan as any).Time3  || '-',
            time4:  (scan as any).Time4  || '-',
            time5:  (scan as any).Time5  || '-',
            time6:  (scan as any).Time6  || '-',
            time7:  (scan as any).Time7  || '-',
            time8:  (scan as any).Time8  || '-',
            time9:  (scan as any).Time9  || '-',
            time10: (scan as any).Time10 || '-',
            scanNormalStatus: (scan as any).normalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
            scanRegularHours: (scan as any).regularHours || 0,
            regularHours:     (scan as any).regularHours || 0,
            scanLunchStatus:  String((scan as any).lunchStatus || 0),
            scanOTMorning:    (scan as any).otMorningHours || 0,
            scanOTEvening:    (scan as any).otEveningHours || 0,
            lateMinutes:      scan.lateMinutes || 0,
            reportRegularStatus: reportData.regular === 1 ? 'ปกติ' : 'ไม่มีข้อมูล',
            reportOTMorning:  reportData.otMorning,
            reportOTEvening:  reportData.otEvening,
            reportOTNoon:     reportData.otNoon,
            morningOTDiff: '-',
            eveningOTDiff: '-',
            lunchOTDiff:   '-',
            projectName:   scan.projectName || '-',
            errorNote:     scan.importNote  || '-',
            isManuallyEdited: (scan as any).isManuallyEdited || false,
          },
        };
      });

      // Sort by date ascending
      enriched.sort((a, b) => {
        const dateA = a.detailedView.date.getTime();
        const dateB = b.detailedView.date.getTime();
        return dateA - dateB;
      });

      // Update row numbers taking pagination into account
      enriched.forEach((scan, index) => {
        scan.detailedView.row = offset + index + 1;
      });

      return { data: enriched, total };
    } catch (err) {
      logger.error('Error getting detailed scan report:', err);
      throw err;
    }
  }

  /**
   * Re-open a resolved discrepancy
   */
  async reopenDiscrepancy(discrepancyId: string, reopenedBy: string): Promise<any> {
    try {
      const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discrepancyId);
      await discRef.update({
        status: 'pending',
        reopenedAt: new Date(),
        reopenedBy,
        resolutionNote: `Re-opened by ${reopenedBy}`
      });
      const updated = await discRef.get();
      return { id: updated.id, ...updated.data() };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Delete a discrepancy record
   */
  async deleteDiscrepancy(discrepancyId: string, deletedBy: string): Promise<boolean> {
    try {
      const docRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discrepancyId);
      const doc = await docRef.get();
      if (!doc.exists) return false;

      await docRef.update({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy
      });
      return true;
    } catch (error) {
      logger.error('Error deleting discrepancy:', error);
      throw error;
    }
  }

  /**
   * Get summary of discrepancies for Dashboard
   */
  async getDiscrepancySummary(projectId?: string): Promise<any> {
    try {
      let queryRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
        .where('status', '==', 'pending');
      if (projectId) queryRef = queryRef.where('projectLocationId', '==', projectId);
      const snapshot = await queryRef.get();
      const discrepancies = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => d.isDeleted !== true);
      return {
        totalDiscrepancies: discrepancies.length,
        pendingCount: discrepancies.length,
        type1Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type1').length,
        type2Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type2').length,
        type3Count: discrepancies.filter((d: any) => d.discrepancyType === 'Type3').length,
      };
    } catch (error: any) {
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
      const projectLocationId = options.projectId;
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES);
      if (projectLocationId) query = query.where('projectLocationId', '==', projectLocationId);
      if (options.startDate) query = query.where('workDate', '>=', options.startDate);
      if (options.endDate) query = query.where('workDate', '<=', options.endDate);

      const snapshot = await query.get();
      const items = snapshot.docs
        .map(doc => {
          const data = doc.data() as any;
          if (data.workDate && data.workDate.toDate) data.workDate = data.workDate.toDate();
          return { 
            id: doc.id, 
            ...data, 
            detailedView: { 
              ...data, 
              date: data.workDate,
              isManuallyEdited: data.isManuallyEdited || false
            } 
          };
        })
        .filter(item => item.isDeleted !== true);

      // Sort by workDate ascending (oldest first)
      items.sort((a, b) => {
        const dateA = a.workDate instanceof Date ? a.workDate.getTime() : (a.workDate as any).toDate().getTime();
        const dateB = b.workDate instanceof Date ? b.workDate.getTime() : (b.workDate as any).toDate().getTime();
        return dateA - dateB;
      });

      const total = items.length;
      const start = (options.page - 1) * options.pageSize;
      const pagedData = items.slice(start, start + options.pageSize);

      return {
        items: pagedData,
        total,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(total / options.pageSize)
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Delete by batch
   */
  async deleteByBatchId(batchId: string): Promise<number> {
    const scans = await this.getByBatchId(batchId);
    if (scans.length === 0) return 0;
    const batch = db.batch();
    scans.forEach(s => batch.delete(collections.scanData.doc(s.id)));
    await batch.commit();
    return scans.length;
  }

  /**
   * Delete by project and date range
   */
  async deleteByProjectAndDateRange(projectLocationId: string, startDate: Date, endDate: Date): Promise<number> {
    const scans = await this.getByProjectAndDate(projectLocationId, startDate, endDate);
    if (scans.length === 0) return 0;
    const batch = db.batch();
    scans.forEach(s => batch.delete(collections.scanData.doc(s.id)));
    await batch.commit();
    return scans.length;
  }

  /**
   * Update scan data
   */
  async updateScanData(
    id: string,
    data: Partial<ScanData>,
    _updatedBy: string
  ): Promise<ScanData | null> {
    try {
      return await this.update(id, data);
    } catch (error: any) {
      logger.error('Error updating scan data:', error);
      throw error;
    }
  }

  /**
   * Update daily punches (Time1-Time6)
   */
  async updateDailyPunches(
    contractorId: string,
    date: Date,
    punches: any[],
    updatedBy: string,
    scanDataId?: string
  ): Promise<ScanData | null> {
    try {
      const scanDate = this.formatDate(date);
      const uniqueKey = scanDataId || `SCAN_${contractorId}_${scanDate}`;
      const docRef = collections.scanData.doc(uniqueKey);

      // Recalculate metrics based on new punches
      let metrics: any = {
        normalStatus: 0,
        regularHours: 0,
        lunchStatus: 0,
        otMorningHours: 0,
        otEveningHours: 0,
        lateMinutes: 0
      };

      if (punches.length > 0) {
        const records: BulkImportRecord[] = punches.map((p, i) => {
          const [h, m] = p.split(':').map(Number);
          const scanTime = new Date(date);
          scanTime.setHours(h, m, 0, 0);
          return {
            rowNumber: i,
            employeeNumber: contractorId,
            scanDateTime: scanTime
          };
        });

        const aggregated = ScanDataAggregator.aggregate(records);
        if (aggregated.length > 0) {
          const agg = aggregated[0];
          metrics = {
            normalStatus: agg.normalStatus,
            regularHours: agg.regularHours,
            lunchStatus: agg.lunchStatus,
            otMorningHours: agg.otMorningHours,
            otEveningHours: agg.otEveningHours,
            lateMinutes: agg.lateMinutes
          };
        }
      }

      const updateData: any = { 
        ...Object.fromEntries(punches.map((p, i) => [`Time${i+1}`, p])),
        // Clear remaining slots if any
        ...Object.fromEntries(Array.from({ length: 10 - punches.length }, (_, i) => [`Time${punches.length + i + 1}`, '-'])),
        ...metrics,
        isManuallyEdited: true, // Flag for highlighting in UI
        updatedAt: new Date(),
        updatedBy
      };

      await docRef.set(updateData, { merge: true });
      const updatedScan = await docRef.get();
      const updatedScanData = updatedScan.data() as ScanData;
      
      // Update discrepancy record if it exists
      try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Use the actual employeeNumber from the record, not the contractor UUID
        const empCode = updatedScanData.employeeNumber || updatedScanData.employeeId;
        
        if (empCode) {
          const discQuery = await db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
            .where('employeeNumber', '==', empCode)
            .where('workDate', '>=', startOfDay)
            .where('workDate', '<=', endOfDay)
            .limit(1)
            .get();
          
          if (!discQuery.empty) {
            await discQuery.docs[0].ref.update({ 
              isManuallyEdited: true,
              updatedAt: new Date()
            });
            logger.info(`Updated discrepancy highlight for ${empCode} on ${scanDate}`);
          }
        }
      } catch (discErr) {
        logger.warn('Could not update discrepancy highlight flag:', discErr);
      }

      return { ...updatedScanData, id: updatedScan.id } as ScanData;
    } catch (error: any) {
      logger.error('Error updating daily punches:', error);
      throw error;
    }
  }

  /**
   * Analyze daily scans to extract metrics
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
    let scannedNoonOT = 0;
    let isLate = false;
    let lateMinutes = 0;

    if (!dayScans || dayScans.length < 2) {
      return { scannedRegularHours, scannedMorningOT, scannedEveningOT, scannedNoonOT, isLate, lateMinutes };
    }

    // Sort scans by time
    const sorted = [...dayScans].sort((a, b) => {
      const timeA = a.scanDateTime instanceof Date ? a.scanDateTime.getTime() : (a.scanDateTime as any).toDate().getTime();
      const timeB = b.scanDateTime instanceof Date ? b.scanDateTime.getTime() : (b.scanDateTime as any).toDate().getTime();
      return timeA - timeB;
    });

    const firstScan = sorted[0].scanDateTime instanceof Date ? sorted[0].scanDateTime : (sorted[0].scanDateTime as any).toDate();

    // Check lateness (08:00 threshold)
    const startOfDay = new Date(firstScan);
    startOfDay.setHours(8, 0, 0, 0);
    if (firstScan > startOfDay) {
      isLate = true;
      lateMinutes = Math.floor((firstScan.getTime() - startOfDay.getTime()) / 60000);
    }

    // Logic for hours (Simplified for now to match the existing behavior)
    scannedRegularHours = 8.0;
    
    // Check for lunch scan (12:00-13:00)
    const hasLunchScan = sorted.some(s => {
      const d = s.scanDateTime instanceof Date ? s.scanDateTime : (s.scanDateTime as any).toDate();
      const h = d.getHours();
      return h >= 12 && h < 13;
    });
    if (!hasLunchScan) scannedNoonOT = 1.0;

    return { scannedRegularHours, scannedMorningOT, scannedEveningOT, scannedNoonOT, isLate, lateMinutes };
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
      const contractor = await dailyContractorService.findByEmployeeIdOrHistory(payload.employeeNumber);
      if (!contractor) throw new AppError(`ไม่พบข้อมูลพนักงานรหัส ${payload.employeeNumber}`, 404);

      const input: CreateScanDataInput = {
        dailyContractorId: contractor.id,
        employeeId: contractor.employeeId || payload.employeeNumber,
        projectLocationId: payload.projectLocationId,
        scanDateTime: payload.scanDateTime,
        importNote: payload.notes || 'Manual Entry',
      };

      const result = await this.importScanData(input, addedBy);
      return result;
    } catch (error: any) {
      logger.error('Error adding manual scan:', error);
      throw error;
    }
  }

  /**
   * Resolve discrepancy
   */
  async resolveDiscrepancy(discrepancyId: string, resolutionData: any, resolvedBy: string): Promise<any> {
    const discRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).doc(discrepancyId);
    await discRef.update({ ...resolutionData, status: 'resolved', resolvedAt: new Date(), resolvedBy });
    const updated = await discRef.get();
    return { id: updated.id, ...updated.data() };
  }

  /**
   * Detect discrepancies for newly imported scan records.
   *
   * Strategy:
   * - Only evaluates records in `newlyInsertedIds` (if provided), avoiding
   *   redundant re-processing of existing records (Insert-only pattern).
   * - Never deletes existing discrepancy records. Uses insert-only for
   *   discrepancy creation — skips if a record already exists (any status).
   * - When called without `newlyInsertedIds` (e.g., manual trigger), falls
   *   back to scanning all records in the date range.
   */
  async detectDiscrepancies(
    projectLocationId: string,
    startDate: Date,
    endDate: Date,
    detectedBy: string,
    projectName?: string,
    projectCode?: string,
    newlyInsertedIds?: Set<string>,
  ): Promise<{ detected: number; discrepanciesCreated: number }> {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // ── Step 1: Fetch scan records to analyse ─────────────────────────────
      // If newlyInsertedIds is provided, fetch only those specific docs (fast).
      // Otherwise fall back to querying the full date range (manual trigger).
      let scansToAnalyse: ScanData[] = [];

      if (newlyInsertedIds && newlyInsertedIds.size > 0) {
        // Point-lookup for newly inserted docs only — O(n) where n = new records
        const CHUNK_SIZE = 500;
        const refs = Array.from(newlyInsertedIds).map(id => collections.scanData.doc(id));
        const chunks: FirebaseFirestore.DocumentReference[][] = [];
        for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
          chunks.push(refs.slice(i, i + CHUNK_SIZE));
        }
        const snapshots = await Promise.all(chunks.map(chunk => db.getAll(...chunk)));
        snapshots.flat().forEach(doc => {
          if (doc.exists) {
            const data = doc.data() as ScanData;
            if (!data.isDeleted) scansToAnalyse.push({ ...data, id: doc.id });
          }
        });
      } else {
        // Fallback: query full date range (used when called manually)
        const scansSnapshot = await collections.scanData
          .where('projectLocationId', '==', projectLocationId)
          .where('workDate', '>=', start)
          .where('workDate', '<=', end)
          .get();
        scansSnapshot.docs.forEach(doc => {
          const data = doc.data() as ScanData;
          if (!data.isDeleted) scansToAnalyse.push({ ...data, id: doc.id });
        });
      }

      if (scansToAnalyse.length === 0) {
        return { detected: 0, discrepanciesCreated: 0 };
      }

      // ── Step 2: Fetch existing discrepancies for this project + range ──────
      // Used to implement insert-only: skip if a discrepancy already exists.
      const existingDiscSnapshot = await collections.scanDataDiscrepancies
        .where('projectLocationId', '==', projectLocationId)
        .get();

      const existingDiscKeys = new Set<string>(); // key: `${employeeNumber}_${YYYY-MM-DD}`
      existingDiscSnapshot.docs.forEach(doc => {
        const d = doc.data() as ScanDataDiscrepancy;
        const workDate = d.workDate instanceof Date ? d.workDate : (d.workDate as any).toDate();
        if (workDate >= start && workDate <= end) {
          const dateStr = workDate.toISOString().split('T')[0];
          existingDiscKeys.add(`${d.employeeNumber}_${dateStr}`);
        }
      });

      // ── Step 3: Fetch DailyReports for the date range (for Type3 detection) ─
      const reportsSnapshot = await collections.dailyReports
        .where('projectLocationId', '==', projectLocationId)
        .get();

      const reportMap = new Map<string, DailyReport[]>();
      reportsSnapshot.docs.forEach(doc => {
        const data = doc.data() as DailyReport;
        const workDate = data.date instanceof Date ? data.date : (data.date as any)?.toDate?.() ?? new Date();
        if (workDate < start || workDate > end) return;
        const dateStr = workDate.toISOString().split('T')[0];
        const key = `${(data as any).employeeId}_${dateStr}`;
        const existing = reportMap.get(key) || [];
        reportMap.set(key, [...existing, { ...data, id: doc.id }]);
      });

      // ── Step 4: Detect discrepancies ───────────────────────────────────────
      const discrepanciesToCreate: Omit<ScanDataDiscrepancy, 'id'>[] = [];

      for (const scan of scansToAnalyse) {
        const workDate = scan.workDate instanceof Date ? scan.workDate : (scan.workDate as any).toDate();
        const dateStr = workDate.toISOString().split('T')[0];
        const discKey = `${scan.employeeNumber}_${dateStr}`;

        // ✅ Insert-only: skip if a discrepancy already exists for this employee+date
        if (existingDiscKeys.has(discKey)) continue;

        const reports = reportMap.get(`${scan.employeeId || scan.employeeNumber}_${dateStr}`) || [];
        const reportedRegularHours = reports.filter((r: any) => r.workType === 'regular').reduce((sum: number, r: any) => sum + (r.netHours || 0), 0);
        const reportedMorningOT = reports.filter((r: any) => r.workType === 'ot_morning').reduce((sum: number, r: any) => sum + (r.netHours || 0), 0);
        const reportedEveningOT = reports.filter((r: any) => r.workType === 'ot_evening').reduce((sum: number, r: any) => sum + (r.netHours || 0), 0);
        const scannedHours = scan.regularHours || 0;
        const scanNormalStatus = scan.normalStatus || 0;

        let detectionReason = '';
        let type: 'Type1' | 'Type2' | 'Type3' = 'Type2';

        // Case B: Abnormal Scan (Type 2 — missing in/out)
        if (scan.normalStatus === 0) {
          type = 'Type2';
          detectionReason = 'สแกนไม่ครบ (ไม่มีเวลาสแกนเข้า หรือ สแกนออก)';
        }
        // Case C: Hours mismatch with DailyReport (Type 3)
        else if (reports.length > 0) {
          const hoursDiff = Math.abs(scannedHours - reportedRegularHours);
          if (hoursDiff > 0.01) {
            type = 'Type3';
            detectionReason = `ชั่วโมงงานไม่ตรงกัน (สแกนนิ้ว: ${scannedHours} ชม., รายงาน: ${reportedRegularHours} ชม.)`;
          }
        }

        if (!detectionReason) continue;

        const hoursDifference = reportedRegularHours - scannedHours;
        discrepanciesToCreate.push({
          dailyReportId: reports[0]?.id || 'NONE',
          dailyContractorId: (scan as any).dailyContractorId || '',
          projectLocationId,
          workDate,
          discrepancyType: type,
          reportedHours: reportedRegularHours,
          scannedHours,
          scanNormalStatus,
          scanStatusLabel: scanNormalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
          hoursDifference,
          severity: calculateSeverity(hoursDifference),
          status: 'pending',
          detectionReason,
          detectedBy,
          projectName: projectName || scan.projectName,
          projectCode: projectCode || scan.projectCode,
          employeeNumber: scan.employeeNumber,
          createdAt: new Date(),
          time1: scan.Time1,
          time2: scan.Time2,
          time3: scan.Time3,
          time4: scan.Time4,
          time5: scan.Time5,
          time6: scan.Time6,
          lateMinutes: scan.lateMinutes || 0,
          reportNormalStatus: reportedRegularHours > 0 ? 1 : 0,
          reportOTMorning: reportedMorningOT,
          reportOTEvening: reportedEveningOT,
          scanOTMorning: scan.otMorningHours || 0,
          scanOTEvening: scan.otEveningHours || 0,
        });
      }

      // ── Step 5: Save new discrepancies with BulkWriter ────────────────────
      if (discrepanciesToCreate.length > 0) {
        const discWriter = db.bulkWriter();
        for (const disc of discrepanciesToCreate) {
          discWriter.set(collections.scanDataDiscrepancies.doc(), disc);
        }
        await discWriter.close();
      }

      logger.info(`[detectDiscrepancies] Scanned ${scansToAnalyse.length} records, created ${discrepanciesToCreate.length} new discrepancies`);
      return {
        detected: scansToAnalyse.length,
        discrepanciesCreated: discrepanciesToCreate.length,
      };
    } catch (error: any) {
      logger.error('Error in detectDiscrepancies:', error);
      throw error;
    }
  }

  /**
   * Get aggregated data for export
   */
  async getAggregatedDataForExport(params: {
    projectLocationId?: string;
    startDate?: Date;
    endDate?: Date;
    batchId?: string;
    onlyDeleted?: boolean;
  }): Promise<any[]> {
    let scans: ScanData[] = [];
    if (params.batchId) scans = await this.getByBatchId(params.batchId);
    else if (params.projectLocationId && params.startDate && params.endDate) {
      scans = await this.getByProjectAndDate(params.projectLocationId, params.startDate, params.endDate, params.onlyDeleted);
    }

    if (scans.length === 0) return [];

    const records: BulkImportRecord[] = [];
    scans.forEach((s, sIdx) => {
      const baseDate = s.scanDateTime instanceof Date ? s.scanDateTime : (s.scanDateTime as any).toDate();
      const empNo = s.employeeNumber || s.employeeId;
      
      // Look for Time1 through Time10 fields in the record
      for (let i = 1; i <= 10; i++) {
        const timeKey = `Time${i}`;
        const timeStr = (s as any)[timeKey];
        
        if (timeStr && timeStr !== '-' && timeStr !== '') {
          try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              const punchDate = new Date(baseDate);
              punchDate.setHours(hours, minutes, 0, 0);
              
              records.push({
                rowNumber: sIdx * 10 + i,
                employeeNumber: empNo,
                scanDateTime: punchDate
              });
            }
          } catch (e) {
            // Skip invalid times
          }
        }
      }
      
      // fallback if no TimeX fields found, use scanDateTime
      if (records.filter(r => r.employeeNumber === empNo).length === 0) {
        records.push({
          rowNumber: sIdx + 1,
          employeeNumber: empNo,
          scanDateTime: baseDate
        });
      }
    });


    const aggregated = ScanDataAggregator.aggregate(records);
    const results: any[] = [];
    
    let projectCode = '';
    if (params.projectLocationId) {
      const loc = await projectLocationService.getById(params.projectLocationId);
      if (loc) projectCode = loc.projectCode || loc.code || loc.projectName || '';
    }

    for (const group of aggregated) {
      const contractor = await dailyContractorService.findByEmployeeIdOrHistory(group.employeeNumber);
      let reportMorningOT = 0, reportEveningOT = 0, reportLunchOT = 0, reportNormalStatus = 0;
      let department = '#N/A', hasReport = false;

      if (contractor) {
        const d = new Date(group.workDate);
        try {
          const reports = await dailyReportService.getByContractorAndDate(contractor.id, d, d);
          if (reports && reports.length > 0) {
             hasReport = true;
             for (const rep of reports) {
               if (rep.workType === 'regular') reportNormalStatus = 1;
               else if (rep.workType === 'ot_morning') reportMorningOT += rep.netHours;
               else if (rep.workType === 'ot_noon') reportLunchOT += rep.netHours;
               else if (rep.workType === 'ot_evening') reportEveningOT += rep.netHours;
             }
          }
          const loc = await projectLocationService.getById(params.projectLocationId || (scans[0] as any).projectLocationId);
          if (loc?.department) department = loc.department;
        } catch (e) {}
      }

      const diffLunch = !hasReport ? '-' : (group.lunchStatus - reportLunchOT);
      const diffMorning = !hasReport ? '-' : (group.otMorningHours - reportMorningOT);
      const diffEvening = !hasReport ? '-' : (group.otEveningHours - reportEveningOT);
      const rowDepartment = projectCode || department || '-';

      results.push({
        EmployeeNumber: group.employeeNumber,
        Date: group.workDate,
        Time1: group.time1 || '', Time2: group.time2 || '', Time3: group.time3 || '',
        Time4: group.time4 || '', Time5: group.time5 || '', Time6: group.time6 || '',
        NormalStatus: group.normalStatus,
        RegularHours: group.regularHours,
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
        Department: rowDepartment
      });
    }
    return results;
  }

  /**
   * Single source of truth for scanData document IDs.
   * Format: SCAN_[employeeNumber]_[projectCode]_[YYYY-MM-DD]
   *
   * Used by bulkImport and importScanData to guarantee consistent keys.
   */
  static generateScanDocKey(
    employeeNumber: string,
    projectCode: string,
    workDate: string, // expects YYYY-MM-DD
  ): string {
    const safeCode = String(projectCode || 'NOPROJ').replace(/\//g, '-');
    return `SCAN_${employeeNumber}_${safeCode}_${workDate}`;
  }

}

export const scanDataService = new ScanDataService();
