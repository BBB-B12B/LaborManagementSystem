/**
 * ScanDataService
 * บริการจัดการข้อมูลสแกนนิ้ว
 *
 * Manages fingerprint scan data with CRUD operations and processing.
 */

import { randomUUID } from 'crypto';
import { BaseCrudService, PaginatedResult } from '../base/BaseCrudService';
import {
  ScanData,
  CreateScanDataInput,
  classifyScanBehavior,
} from '../../models/ScanData';
// Legacy ScanDataDiscrepancy has been removed in favor of ReconciliationRecord
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { db } from '../../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { dailyContractorService } from '../dailyContractor/DailyContractorService';
import { dailyReportService } from '../dailyReport/DailyReportService';

import { ScanDataAggregator } from './ScanDataAggregator';
import { projectLocationService } from '../project/ProjectLocationService';
import { projectBDailyReportService } from '../external/ProjectBDailyReportService';

export interface BulkImportRecord {
  rowNumber: number;
  employeeNumber: string;
  scanDateTime: Date;
  rawLine?: string;
  rawData?: Record<string, unknown>;
  rowData?: any;
}

export interface BulkImportOptions {
  projectLocationId?: string; // Optional — auto-resolved from contractor homeProjectId if not provided
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
      const contractor = await dailyContractorService.getById(input.dailyContractorId!);
      if (!contractor) {
        throw new AppError('ไม่พบข้อมูลพนักงาน', 404);
      }

      const scanDate = this.formatDate(input.scanDateTime);
      const uniqueKey = ScanDataService.generateScanDocKey(
        input.employeeId,
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

      // punches = HH:mm (ตัดวินาทีออก) ใช้ใน Reconciliation เปรียบเทียบกับ dailyReportPunches
      // allScans = HH:mm:ss (เก็บวินาทีไว้) ใช้คำนวณสาย/OT ได้ละเอียด
      const punches = allScans.map(t => t.slice(0, 5));

      let devicePunches = (existingData as any).devicePunches;
      if (existingDoc.exists && Array.isArray(devicePunches)) {
        const newPunch = scanTimeStr.slice(0, 5);
        if (!devicePunches.includes(newPunch)) {
          devicePunches = [...devicePunches, newPunch].sort((a, b) => a.localeCompare(b));
        }
      } else {
        devicePunches = punches;
      }

      const scanData: Omit<ScanData, 'id'> = {
        ...(existingData as any),
        dailyContractorId: input.dailyContractorId,
        employeeId: input.employeeId,
        employeeNumber: contractor.employeeId || input.employeeId,
        name: contractor.name,
        position: contractor.skillId,
        projectLocationId: input.projectLocationId,
        scanDateTime: input.scanDateTime,
        scanDate,
        scanBehavior: classifyScanBehavior(input.scanDateTime),
        workDate: input.scanDateTime,
        roundedTime: input.scanDateTime,
        isLate: false,
        lateMinutes: 0,
        hasDiscrepancy: false,
        createdAt: existingDoc.exists ? (existingData as any).createdAt : new Date(),
        importedAt: new Date(),
        importedBy,
        importBatchId: existingDoc.exists ? (existingData as any).importBatchId : `manual-${Date.now()}`,
        importNote: input.importNote,
        ...timeSlots,
        allScans,
        punches,
        devicePunches,
        isDeleted: false,
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
   * Get scan data by date range (all projects)
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date,
    onlyDeleted: boolean = false
  ): Promise<ScanData[]> {
    try {
      const scans = await this.queryWithFallback([
        { field: 'workDate', operator: '>=', value: startDate },
        { field: 'workDate', operator: '<=', value: endDate },
      ]);
      return scans.filter(s => onlyDeleted ? (s as any).isDeleted === true : (s as any).isDeleted !== true);
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
    const importErrors: ImportErrorEntry[] = [];
    const warnings: string[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    let projectDepartmentName = '#N/A';
    let projectCode = '';
    let projectName = '';
    try {
      if (options.projectLocationId) {
        const projectLocation = await projectLocationService.getById(options.projectLocationId);
        if (projectLocation) {
          if (projectLocation.department) projectDepartmentName = projectLocation.department;
          projectCode = projectLocation.projectCode || projectLocation.code || '';
          projectName = projectLocation.projectName || '';
        }
      }
    } catch (e) {
      logger.warn(`Could not fetch details for project location ${options.projectLocationId}`);
    }

    const employeeCache = new Map<string, string | null>();
    const rowSummaries: RowSummary[] = [];
    let successfulRecords = 0;
    let skippedRecords = 0;
    let failedRecords = 0;

    // ── Step 1: Fetch all employees in parallel and cache homeProjectId ──────
    const uniqueEmployeeNumbers = Array.from(new Set(records.map(r => r.employeeNumber).filter(Boolean)));
    const homeProjectCache = new Map<string, string>(); // empNo → homeProjectId

    const CHUNK_EMP = 50;
    for (let i = 0; i < uniqueEmployeeNumbers.length; i += CHUNK_EMP) {
      const chunk = uniqueEmployeeNumbers.slice(i, i + CHUNK_EMP);
      await Promise.all(chunk.map(async (empNum) => {
        if (!employeeCache.has(empNum)) {
          try {
            const contractor = await dailyContractorService.findByEmployeeIdOrHistory(empNum);
            employeeCache.set(empNum, contractor ? contractor.id : null);
            const homeProj = (contractor as any)?.projectLocationId || (contractor as any)?.homeProjectId || '';
            homeProjectCache.set(empNum, homeProj);
          } catch (e: any) {
            employeeCache.set(empNum, null);
            homeProjectCache.set(empNum, '');
          }
        }
      }));
    }

    // ── Step 2: Aggregate raw records into daily groups ────────────────────
    const aggregatedDailyRows = ScanDataAggregator.aggregate(records);

    // Build all document refs for pre-fetch
    const allDocRefs = aggregatedDailyRows.map(group => ({
      key: ScanDataService.generateScanDocKey(group.employeeNumber, group.workDate),
      ref: collections.scanData.doc(ScanDataService.generateScanDocKey(group.employeeNumber, group.workDate)),
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
      const snapshots: FirebaseFirestore.DocumentSnapshot[][] = [];
      for (const chunk of chunks) {
        const snap = await db.getAll(...chunk);
        snapshots.push(snap);
      }
      snapshots.flat().forEach(doc => {
        if (doc.exists) existingIds.add(doc.id);
      });
      logger.info(`[bulkImport] Pre-fetch: ${existingIds.size} existing docs found out of ${allDocRefs.length} total`);
    }

    // ── Step 3.5: Fetch approved Wage Periods to block locked dates ────────
    let lockedRanges: { start: Date, end: Date }[] = [];
    try {
      const approvedPeriodsSnap = await db.collection('wagePeriods')
        .where('status', 'in', ['approve', 'approved'])
        .get();
        
      lockedRanges = approvedPeriodsSnap.docs.map(doc => {
        const data = doc.data();
        const start = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
        const end = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      });
    } catch (e) {
      logger.warn('[bulkImport] Failed to fetch wagePeriods for lock validation', e);
    }

    const isLockedDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return lockedRanges.some(range => date >= range.start && date <= range.end);
    };

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
        const uniqueKey = ScanDataService.generateScanDocKey(group.employeeNumber, scanDate);
        const docRef = collections.scanData.doc(uniqueKey);

        const workDate = new Date(group.workDate);
        if (isNaN(workDate.getTime())) {
          logger.warn(`Invalid workDate for ${group.employeeNumber}: ${group.workDate}`);
          failedRecords++;
          continue;
        }
        workDate.setHours(0, 0, 0, 0);

        // ✅ Check if date is locked by an approved wage period
        if (isLockedDate(group.workDate)) {
          failedRecords++;
          const errorMsg = `วันที่ ${group.workDate} อยู่ในงวดงานที่ถูก Approve และปิดไปแล้ว`;
          importErrors.push({
            row: group.sourceRowNumbers[0] || 0,
            employeeNumber: group.employeeNumber,
            error: errorMsg
          });
          if (!warnings.includes(errorMsg)) {
            warnings.push(errorMsg);
          }
          continue;
        }

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

        // Resolve projectLocationId: use provided value OR auto-lookup from contractor's home project
        const resolvedProjectId = options.projectLocationId
          || homeProjectCache.get(group.employeeNumber)
          || '';

        if (!resolvedProjectId) {
          logger.warn(`[bulkImport] No projectLocationId for ${group.employeeNumber} — saving without project, reconciliation will be skipped`);
        }

        const scanData: any = {
          dailyContractorId: contractorId,
          employeeId: group.employeeNumber,
          employeeNumber: group.employeeNumber,
          projectLocationId: resolvedProjectId,
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
          // punches = HH:mm (ตัดวินาทีออก) ใช้ใน Reconciliation เปรียบเทียบกับ dailyReportPunches
          // allScans = HH:mm:ss (เก็บวินาทีไว้) ใช้คำนวณสาย/OT ได้ละเอียด
          punches: group.punches, // HH:mm จาก ScanDataAggregator
          devicePunches: group.punches,
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

    // ── Step 5: Reconciliation is triggered automatically via Firebase Cloud Functions ──

    // ── Step 6: Build row summaries for response ───────────────────────────
    for (const group of aggregatedDailyRows) {
      const rowDepartment = projectCode || projectDepartmentName || '-';
      const uniqueKey = ScanDataService.generateScanDocKey(group.employeeNumber, group.workDate);
      
      rowSummaries.push({
        row: group.sourceRowNumbers[0] || 0,
        status: isLockedDate(group.workDate) ? 'failed' : (existingIds.has(uniqueKey) ? 'duplicate' : 'success'),
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
      errors: importErrors,
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
        punches: punches,
        allScans: punches.map(p => `${p}:00`),
        isManuallyEdited: true, // Flag for highlighting in UI
        updatedAt: new Date(),
        updatedBy
      };

      await docRef.set(updateData, { merge: true });
      const updatedScan = await docRef.get();
      const updatedScanData = updatedScan.data() as ScanData;
      
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

      // Resolve projectLocationId: use provided value, fallback to employee's home project
      const resolvedProjectLocationId =
        (payload.projectLocationId && payload.projectLocationId.trim() !== '')
          ? payload.projectLocationId.trim()
          : (contractor.projectLocationId || '');

      let projectCode = '';
      if (resolvedProjectLocationId) {
        const projectLocation = await projectLocationService.getById(resolvedProjectLocationId);
        projectCode = projectLocation?.projectCode || projectLocation?.code || '';
      }

      const input: CreateScanDataInput = {
        dailyContractorId: contractor.id,
        employeeId: contractor.employeeId || payload.employeeNumber,
        projectLocationId: resolvedProjectLocationId,
        projectCode,
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
   * Fill scan data from Daily Report (Project B)
   */
  async fillFromDailyReport(
    employeeNumber: string,
    workDateStr: string,
    projectLocationId: string,
    adminUserId: string
  ): Promise<ScanData> {
    try {
      const timesheet = await projectBDailyReportService.getDailyTimesheet(employeeNumber, workDateStr);
      if (!timesheet) {
        throw new AppError('ไม่พบข้อมูล Daily Report ใน Aftersale System สำหรับวันนี้', 404);
      }

      /**
       * Segment-aware punch generation
       *
       * Rules:
       *  - otMorning  → contributes IN  (start of otMorning) only — it merges with the regular segment
       *  - day        → contributes OUT (end of day) always
       *                 If day runs across lunch (end > 13:00) → also add 12:00 OUT and 13:00 IN
       *                 If day runs across lunch AND there is an otNoon segment → skip 12:00/13:00
       *  - otNoon     → does NOT add extra punches (covered by the continuous day scan)
       *  - otEvening  → contributes OUT (end of otEvening); the IN is shared with day's OUT (17:00)
       *                 but if day ends before otEvening starts → add otEvening start as IN too
       *
       * In short we build a Set of HH:mm times and deduplicate automatically.
       */
      const punchSet = new Set<string>();
      const shifts = timesheet.expectedShifts;

      const hasOtMorning  = !shifts || shifts.otMorning;
      const hasDay        = !shifts || shifts.normal;
      const hasOtNoon     = !shifts || shifts.otNoon;
      const hasOtEvening  = !shifts || shifts.otEvening;

      const extractPunches = (timeStr?: string, defaultStr?: string) => {
        const target = timeStr || defaultStr;
        if (!target) return;
        const parts = target.split('-').map(s => s.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          punchSet.add(parts[0].slice(0, 5));
          punchSet.add(parts[1].slice(0, 5));
        }
      };

      if (hasOtMorning) extractPunches(timesheet.shiftTimes?.otMorning, '06:00 - 08:00');
      if (hasDay) {
        extractPunches(timesheet.shiftTimes?.day, '08:00 - 17:00');
        // ถ้าปกติทำทั้งวัน (day) และไม่มีการระบุแยกกะ OT เที่ยงไว้ต่างหาก 
        // ให้ซอยย่อย 12:00 และ 13:00 เพื่อให้ตรงตาม segment การพักเที่ยงแบบสากล
        if (!hasOtNoon) {
          punchSet.add('12:00');
          punchSet.add('13:00');
        }
      }
      // พนักงานทำโอเที่ยง (hasOtNoon) จะไม่มีการสแกนนิ้วช่วง 12:00 และ 13:00 ดังนั้นไม่ต้องดึงเวลาส่วนนี้เข้ามาใน punches
      if (hasOtEvening) extractPunches(timesheet.shiftTimes?.otEvening, '18:00 - 21:00');

      const expectedPunches = Array.from(punchSet).sort((a, b) => a.localeCompare(b));

      if (expectedPunches.length === 0) {
        throw new AppError('ไม่พบช่วงเวลา (shiftTimes) ใน Daily Report', 400);
      }

      const scanDateStart = new Date(`${workDateStr}T00:00:00.000Z`);
      const scanDateEnd = new Date(`${workDateStr}T23:59:59.999Z`);

      const scanQuery = await collections.scanData
        .where('employeeNumber', '==', employeeNumber)
        .where('workDate', '>=', scanDateStart)
        .where('workDate', '<=', scanDateEnd)
        .where('isDeleted', '==', false)
        .get();

      let docRef: FirebaseFirestore.DocumentReference;
      let existingData: Partial<ScanData> = {};
      let action: any = 'manual_fill';

      if (!scanQuery.empty) {
        docRef = scanQuery.docs[0].ref;
        existingData = scanQuery.docs[0].data() as ScanData;
      } else {
        const uniqueKey = ScanDataService.generateScanDocKey(employeeNumber, workDateStr);
        docRef = collections.scanData.doc(uniqueKey);
        action = 'manual_create';
      }

      const regularHours = timesheet.expectedHours?.normal ?? 0;
      const otMorningHours = timesheet.expectedHours?.otMorning ?? 0;
      const otNoonHours = timesheet.expectedHours?.otNoon ?? 0;
      const otEveningHours = timesheet.expectedHours?.otEvening ?? 0;

      const snapshot = {
        punches: (existingData as any).punches || (existingData as any).allScans || [],
        firstIn: (existingData as any).firstIn || null,
        lastOut: (existingData as any).lastOut || null,
        regularHours: (existingData as any).regularHours || 0,
        otMorningHours: (existingData as any).otMorningHours || 0,
        otNoonHours: (existingData as any).otNoonHours || 0,
        otEveningHours: (existingData as any).otEveningHours || 0,
      };

      // ── Merge existing punches with expected punches ──
      // To preserve original scan data, we only add expected punches if there isn't an existing punch within 60 minutes.
      const existingPunches: string[] = snapshot.punches;
      const mergedPunches = [...existingPunches];
      const availableExisting = [...existingPunches];

      const toMins = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      for (const ep of expectedPunches) {
        const epMins = toMins(ep);
        
        let closestIdx = -1;
        let minDiff = 61; // Maximum allowed difference is 60 minutes
        
        for (let i = 0; i < availableExisting.length; i++) {
          const diff = Math.abs(toMins(availableExisting[i]) - epMins);
          if (diff <= 60 && diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        
        if (closestIdx !== -1) {
          // Found a close existing punch, mark it as used
          availableExisting.splice(closestIdx, 1);
        } else {
          // No close existing punch, add the expected punch
          mergedPunches.push(ep);
        }
      }

      const finalPunches = mergedPunches.sort((a, b) => a.localeCompare(b));

      const editEntry: any = {
        editedAt: new Date(),
        editedBy: adminUserId,
        action,
        reason: 'ยืนยันข้อมูลปรับตาม Daily Report (เติมเฉพาะเวลาที่ขาดหาย)',
        snapshot,
        // NOTE: reconciliationRecordId intentionally omitted — avoid undefined in Firestore
      };

      const timeSlots: any = {};
      finalPunches.forEach((p, i) => {
        if (i < 10) timeSlots[`Time${i + 1}`] = p;
      });
      // Clear leftover slots from any previous scan data
      for (let i = finalPunches.length + 1; i <= 10; i++) {
        timeSlots[`Time${i}`] = '-';
      }

      const workDateObj = new Date(scanDateStart);

      const updateData: any = {
        employeeId: (existingData as any).employeeId || employeeNumber,
        employeeNumber,
        projectLocationId: (existingData as any).projectLocationId || projectLocationId,
        workDate: (existingData as any).workDate || workDateObj,
        scanDate: workDateStr,
        scanDateTime: (existingData as any).scanDateTime || workDateObj,
        roundedTime: (existingData as any).roundedTime || workDateObj,
        isManuallyEdited: true,
        allScans: finalPunches,
        punches: finalPunches,
        devicePunches: (existingData as any).devicePunches || (existingData as any).punches || [],
        firstIn: finalPunches[0],
        lastOut: finalPunches[finalPunches.length - 1],
        regularHours,
        otMorningHours,
        otNoonHours,
        otEveningHours,
        ...timeSlots,
        updatedAt: new Date(),
        createdAt: (existingData as any).createdAt || new Date(),
        isDeleted: false,
      };

      await docRef.set(updateData, { merge: true });
      // Append editHistory separately using arrayUnion to avoid re-writing old
      // entries that may contain undefined values (Firestore rejects undefined)
      await docRef.update({ editHistory: FieldValue.arrayUnion(editEntry) });
      const updated = await docRef.get();
      const savedScan = { id: updated.id, ...updated.data() } as ScanData;

      // Sync ReconciliationRecord ด้วย breakdown hours ใหม่
      try {
        const { reconciliationService } = await import('../reconciliation/ReconciliationService');
        await reconciliationService.generateForEmployee(
          employeeNumber,
          workDateStr,
          projectLocationId,
        );
      } catch (recErr: any) {
        // Non-critical: log but don't fail the fill operation
        logger.warn('fillFromDailyReport: reconciliation re-sync failed:', recErr?.message);
      }

      return savedScan;
    } catch (error: any) {
      logger.error('Error in fillFromDailyReport:', error);
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
    let fallbackDepartment = '#N/A';
    
    try {
      const resolvedProjectLocId = params.projectLocationId || (scans.length > 0 ? (scans[0] as any).projectLocationId : null);
      if (resolvedProjectLocId) {
        const loc = await projectLocationService.getById(resolvedProjectLocId);
        if (loc) {
          projectCode = loc.projectCode || loc.code || loc.projectName || '';
          if (loc.department) fallbackDepartment = loc.department;
        }
      }
    } catch (e) {
      console.warn('Could not fetch project location for export:', e);
    }

    const contractorCache = new Map<string, any>();
    const timesheetCache = new Map<string, any>();
    const CHUNK_SIZE = 50;

    for (let i = 0; i < aggregated.length; i += CHUNK_SIZE) {
      const chunk = aggregated.slice(i, i + CHUNK_SIZE);
      
      const chunkResults = await Promise.all(chunk.map(async (group) => {
        let contractor = contractorCache.get(group.employeeNumber);
        if (contractor === undefined) {
          contractor = await dailyContractorService.findByEmployeeIdOrHistory(group.employeeNumber);
          contractorCache.set(group.employeeNumber, contractor);
        }

        let reportMorningOT = 0, reportEveningOT = 0, reportLunchOT = 0, reportNormalStatus = 0;
        let department = fallbackDepartment, hasReport = false;

        if (contractor) {
          const dateStr = group.workDate;
          const tsKey = `${group.employeeNumber}_${dateStr}`;
          
          let timesheet = timesheetCache.get(tsKey);
          if (timesheet === undefined) {
            try {
              timesheet = await projectBDailyReportService.getDailyTimesheet(group.employeeNumber, dateStr);
              timesheetCache.set(tsKey, timesheet);
            } catch (e) {
              console.error('Error fetching Project B timesheet:', e);
              timesheetCache.set(tsKey, null);
              timesheet = null;
            }
          }

          if (timesheet) {
             hasReport = true;
             if (timesheet.expectedShifts?.normal) reportNormalStatus = 1;
             reportMorningOT = timesheet.expectedHours?.otMorning || 0;
             reportLunchOT = timesheet.expectedHours?.otNoon || 0;
             reportEveningOT = timesheet.expectedHours?.otEvening || 0;
          }
        }

        const diffLunch = !hasReport ? '-' : (group.lunchStatus - reportLunchOT);
        const diffMorning = !hasReport ? '-' : (group.otMorningHours - reportMorningOT);
        const diffEvening = !hasReport ? '-' : (group.otEveningHours - reportEveningOT);
        const rowDepartment = projectCode || department || '-';

        return {
          EmployeeNumber: group.employeeNumber,
          Date: group.workDate,
          Time1: group.time1 || '', Time2: group.time2 || '', Time3: group.time3 || '',
          Time4: group.time4 || '', Time5: group.time5 || '', Time6: group.time6 || '',
          Time7: group.time7 || '', Time8: group.time8 || '', Time9: group.time9 || '', Time10: group.time10 || '',
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
        };
      }));
      results.push(...chunkResults);
    }
    return results;
  }

  /**
   * Single source of truth for scanData document IDs.
   * Format: SCAN_[employeeNumber]_[projectCode]_[YYYY-MM-DD]
  /**
   * Generate a consistent document key for a scan record.
   * Format: SCAN_{employeeNumber}_{workDate}
   *
   * Note: projectCode is no longer part of the key. One scan record per employee per day.
   * Used by bulkImport and importScanData to guarantee consistent keys.
   */
  static generateScanDocKey(
    employeeNumber: string,
    workDate: string | Date, // accepts YYYY-MM-DD string or Date
  ): string {
    const dateStr = typeof workDate === 'string'
      ? workDate
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(workDate);
    return `SCAN_${employeeNumber}_${dateStr}`;
  }

}

export const scanDataService = new ScanDataService();
