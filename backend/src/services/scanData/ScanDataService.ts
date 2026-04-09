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
    let failedRecords = 0;
    let batch = db.batch();
    let operationsInBatch = 0;
    const BATCH_WRITE_LIMIT = 400;

    const commitBatch = async () => {
      if (!options.dryRun && operationsInBatch > 0) {
        await batch.commit();
        batch = db.batch();
        operationsInBatch = 0;
      }
    };

    // 1. Optimize employee lookup: collect unique employee numbers first
    const uniqueEmployeeNumbers = Array.from(new Set(records.map(r => r.employeeNumber).filter(Boolean)));
    
    // 2. Fetch all unique employees in parallel to prevent timeouts
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


    const aggregatedDailyRows = ScanDataAggregator.aggregate(records);
    
    for (const group of aggregatedDailyRows) {
      try {
        const contractorId = employeeCache.get(group.employeeNumber);
        if (!contractorId) {
          // Warning: Employee not found, but we STILL save it so user can edit later
          if (!warnings.includes(`ไม่พบข้อมูลพนักงานรหัส ${group.employeeNumber} ในระบบ (บันทึกไว้ชั่วคราว)`)) {
            warnings.push(`ไม่พบข้อมูลพนักงานรหัส ${group.employeeNumber} ในระบบ (บันทึกไว้ชั่วคราว)`);
          }
        }

        const scanDate = group.workDate;
        const projectCodeSafe = String(projectCode).replace(/\//g, '-');
        const uniqueKey = `SCAN_${group.employeeNumber}_${projectCodeSafe}_${scanDate}`;
        const docRef = collections.scanData.doc(uniqueKey);

        const workDate = new Date(group.workDate);
        if (isNaN(workDate.getTime())) {
          logger.warn(`Invalid workDate found for row ${group.employeeNumber}: ${group.workDate}`);
          failedRecords++;
          continue;
        }
        workDate.setHours(0, 0, 0, 0);

        const primaryScan = group.timeScans.length > 0 ? group.timeScans[0] : null;
        if (primaryScan && isNaN(primaryScan.getTime())) {
          logger.warn(`Invalid primaryScan time found for row ${group.employeeNumber}`);
        }

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
          isDeleted: false
        };

        // Explicitly strip out any undefined fields just to be safe with Firestore
        Object.keys(scanData).forEach(key => {
          if (scanData[key] === undefined || (typeof scanData[key] === 'number' && isNaN(scanData[key]))) {
            delete scanData[key];
          }
        });

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
        logger.error(`Failed to save record ${group.employeeNumber}:`, err);
        failedRecords++;
      }
    }

    await commitBatch();

    if (!options.dryRun && minDate && maxDate) {
      try {
        await this.detectDiscrepancies(options.projectLocationId, minDate, maxDate, options.importedBy, projectName, projectCode);
      } catch (detectErr) {
        warnings.push('Auto-discrepancy detection failed.');
      }
    }

    for (const group of aggregatedDailyRows) {
      // We allow it to continue even if dailyContractorId is null, since we now save them
      // We allow it to continue even if dailyContractorId is null, since we now save them

      const rowDepartment = projectCode || projectDepartmentName || '-';

      rowSummaries.push({
        row: group.sourceRowNumbers[0] || 0,
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

          Department: rowDepartment
        }
      });
    }

    return {
      success: errors.length === 0 && failedRecords === 0,
      importBatchId,
      totalRecords: aggregatedDailyRows.length,
      successfulRecords,
      failedRecords,
      errors,
      warnings,
      records: rowSummaries
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

      // Always use the robust getAllFiltered which handles pagination and fallbacks correctly
      const result = await this.getAllFiltered({
        ...options,
        projectId: projectLocationId,
        startDate,
        endDate,
        onlyDeleted
      });
      
      scans = result.items;
      total = result.total;


      // Optimize: Fetch all supplementary data in parallel
      const enriched = await Promise.all(scans.map(async (scan) => {
        const workDate = scan.workDate instanceof Date ? scan.workDate : (scan.workDate as any).toDate ? (scan.workDate as any).toDate() : new Date(scan.workDate);
        
        let reportData = { regular: 0, otMorning: 0, otNoon: 0, otEvening: 0 };
        
        try {
          const dayReports = await dailyReportService.getByContractorAndDate(scan.dailyContractorId, workDate, workDate);
          reportData = {
            regular: dayReports.some((r: any) => r.workType === 'regular') ? 1 : 0,
            otMorning: dayReports.reduce((sum: number, r: DailyReport) => sum + (r.workType === 'ot_morning' ? r.netHours : 0), 0),
            otNoon: dayReports.some((r: any) => r.workType === 'ot_noon') ? 1 : 0,
            otEvening: dayReports.reduce((sum: number, r: DailyReport) => sum + (r.workType === 'ot_evening' ? r.netHours : 0), 0),
          };
        } catch (err) {
          // Keep defaults if fetch fails
        }

        return {
          ...scan,
          detailedView: {
            row: 0,
            status: scan.hasDiscrepancy ? 'pending' : 'verified',
            employeeNumber: scan.employeeNumber,
            date: workDate,
            time1: (scan as any).Time1 || '-',
            time2: (scan as any).Time2 || '-',
            time3: (scan as any).Time3 || '-',
            time4: (scan as any).Time4 || '-',
            time5: (scan as any).Time5 || '-',
            time6: (scan as any).Time6 || '-',
            time7: (scan as any).Time7 || '-',
            time8: (scan as any).Time8 || '-',
            time9: (scan as any).Time9 || '-',
            time10: (scan as any).Time10 || '-',
            scanNormalStatus: (scan as any).normalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
            scanRegularHours: (scan as any).regularHours || 0,
            regularHours: (scan as any).regularHours || 0,
            scanLunchStatus: String((scan as any).lunchStatus || 0),
            scanOTMorning: (scan as any).otMorningHours || 0,
            scanOTEvening: (scan as any).otEveningHours || 0,
            lateMinutes: scan.lateMinutes || 0,
            reportRegularStatus: reportData.regular === 1 ? 'ปกติ' : 'ไม่มีข้อมูล',
            reportOTMorning: reportData.otMorning,
            reportOTEvening: reportData.otEvening,
            reportOTNoon: reportData.otNoon,
            morningOTDiff: '-',
            eveningOTDiff: '-',
            lunchOTDiff: '-',
            projectName: scan.projectName || '-',
            errorNote: scan.importNote || '-',
            isManuallyEdited: (scan as any).isManuallyEdited || false
          }
        };
      }));

      // Sort by date ascending
      enriched.sort((a, b) => {
        const dateA = a.detailedView.date.getTime();
        const dateB = b.detailedView.date.getTime();
        return dateA - dateB;
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
   * Detect discrepancies
   */
  async detectDiscrepancies(
    projectLocationId: string,
    startDate: Date,
    endDate: Date,
    detectedBy: string,
    projectName?: string,
    projectCode?: string
  ): Promise<{ detected: number; discrepanciesCreated: number }> {
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // 1. Delete existing discrepancies for this project and range to avoid duplicates
      // Use a simpler query to avoid index requirement
      const existingQuery = collections.scanDataDiscrepancies
        .where('projectLocationId', '==', projectLocationId);

      const existingDocs = await existingQuery.get();
      const docsToDelete = existingDocs.docs.filter(doc => {
        const d = doc.data() as ScanDataDiscrepancy;
        const workDate = d.workDate instanceof Date ? d.workDate : (d.workDate as any).toDate();
        return workDate >= start && workDate <= end;
      });

      if (docsToDelete.length > 0) {
        const delBatch = db.batch();
        docsToDelete.forEach(doc => delBatch.delete(doc.ref));
        await delBatch.commit();
      }

      // 2. Fetch ScanData records
      // Use simpler query for ScanData too if possible, but let's see if it works as is
      const scansSnapshot = await collections.scanData
        .where('projectLocationId', '==', projectLocationId)
        .get();

      const scansSnapshotFiltered = scansSnapshot.docs.filter(doc => {
        const d = doc.data() as ScanData;
        const workDate = d.workDate instanceof Date ? d.workDate : (d.workDate as any).toDate();
        return workDate >= start && workDate <= end && d.isDeleted === false;
      });

      // 3. Fetch DailyReports
      const reportsSnapshot = await collections.dailyReports
        .where('projectLocationId', '==', projectLocationId)
        .get();

      const reportsSnapshotFiltered = reportsSnapshot.docs.filter(doc => {
        const d = doc.data() as DailyReport;
        const workDate = d.workDate instanceof Date ? d.workDate : (d.workDate as any).toDate();
        return workDate >= start && workDate <= end;
      });

      const scanMap = new Map<string, ScanData>();
      scansSnapshotFiltered.forEach(doc => {
        const data = doc.data() as ScanData;
        const workDate = data.workDate instanceof Date ? data.workDate : (data.workDate as any).toDate();
        const key = `${data.employeeNumber}_${workDate.toISOString().split('T')[0]}`;
        scanMap.set(key, { ...data, id: doc.id });
      });

      const reportMap = new Map<string, DailyReport[]>();
      reportsSnapshotFiltered.forEach(doc => {
        const data = doc.data() as DailyReport;
        const workDate = data.workDate instanceof Date ? data.workDate : (data.workDate as any).toDate();
        const key = `${data.employeeId}_${workDate.toISOString().split('T')[0]}`;
        const existing = reportMap.get(key) || [];
        reportMap.set(key, [...existing, { ...data, id: doc.id }]);
      });

      // 4. Collect all unique employee/date keys
      const allKeys = new Set([...scanMap.keys(), ...reportMap.keys()]);
      const discrepanciesToCreate: Omit<ScanDataDiscrepancy, 'id'>[] = [];

      for (const key of allKeys) {
        const scan = scanMap.get(key);
        const reports = reportMap.get(key) || [];
        const [empNum, dateStr] = key.split('_');

        let discrepancy: Omit<ScanDataDiscrepancy, 'id' | 'createdAt' | 'status' | 'severity' | 'hoursDifference'> | null = null;
        let detectionReason = '';
        let type: 'Type1' | 'Type2' | 'Type3' = 'Type1';

        const workDate = scan ? (scan.workDate instanceof Date ? scan.workDate : (scan.workDate as any).toDate()) : new Date(dateStr);
        
        // Sum reported hours
        const reportedRegularHours = reports.filter(r => r.workType === 'regular').reduce((sum, r) => sum + (r.netHours || 0), 0);
        const reportedMorningOT = reports.filter(r => r.workType === 'ot_morning').reduce((sum, r) => sum + (r.netHours || 0), 0);
        const reportedEveningOT = reports.filter(r => r.workType === 'ot_evening').reduce((sum, r) => sum + (r.netHours || 0), 0);
        const totalReportedHours = reports.reduce((sum, r) => sum + (r.netHours || 0), 0);

        const scannedHours = scan ? (scan.regularHours || 0) : 0;
        const scanNormalStatus = scan ? (scan.normalStatus || 0) : 0;

        // --- DETECTION LOGIC ---
        
        // Case A: Missing Scan Data for a reported day (Type 1)
        if (!scan && reports.length > 0) {
          type = 'Type1';
          detectionReason = 'มีชื่อในรายงานการทำงานประจำวัน แต่ไม่พบข้อมูลการสแกนนิ้ว';
        }
        // Case B: Abnormal Scan (Type 2 - Missing in/out)
        else if (scan && scan.normalStatus === 0) {
          type = 'Type2';
          detectionReason = 'สแกนไม่ครบ (ไม่มีเวลาสแกนเข้า หรือ สแกนออก)';
        }
        // Case C: Hours mismatch (Type 3)
        else if (scan && reports.length > 0) {
          const hoursDiff = Math.abs(scannedHours - reportedRegularHours);
          if (hoursDiff > 0.01) {
             type = 'Type3';
             detectionReason = `ชั่วโมงงานไม่ตรงกัน (สแกนนิ้ว: ${scannedHours} ชม., รายงาน: ${reportedRegularHours} ชม.)`;
          }
        }

        if (detectionReason) {
          discrepancy = {
            dailyReportId: reports[0]?.id || 'NONE',
            dailyContractorId: scan?.dailyContractorId || reports[0]?.dailyContractorId || '',
            projectLocationId,
            workDate,
            discrepancyType: type,
            reportedHours: reportedRegularHours,
            scannedHours: scannedHours,
            scanNormalStatus,
            scanStatusLabel: scanNormalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
            detectionReason,
            detectedBy,
            projectName: projectName || scan?.projectName,
            projectCode: projectCode || scan?.projectCode,
            employeeNumber: empNum,
            
            // Detailed metrics for UI display
            time1: scan?.Time1,
            time2: scan?.Time2,
            time3: scan?.Time3,
            time4: scan?.Time4,
            time5: scan?.Time5,
            time6: scan?.Time6,
            lateMinutes: scan?.lateMinutes || 0,
            reportNormalStatus: reportedRegularHours > 0 ? 1 : 0,
            reportOTMorning: reportedMorningOT,
            reportOTEvening: reportedEveningOT,
            scanOTMorning: scan?.otMorningHours || 0,
            scanOTEvening: scan?.otEveningHours || 0,
          };

          const hoursDifference = discrepancy.reportedHours - discrepancy.scannedHours;
          discrepanciesToCreate.push({
            ...discrepancy,
            hoursDifference,
            severity: calculateSeverity(hoursDifference),
            status: 'pending',
            createdAt: new Date(),
          });
        }
      }

      // 5. Batch save discrepancies
      if (discrepanciesToCreate.length > 0) {
        let batch = db.batch();
        let ops = 0;
        for (const disc of discrepanciesToCreate) {
          const docRef = collections.scanDataDiscrepancies.doc();
          batch.set(docRef, disc);
          ops++;
          if (ops >= 500) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
          }
        }
        await batch.commit();
      }

      return { 
        detected: allKeys.size, 
        discrepanciesCreated: discrepanciesToCreate.length 
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

  private buildUniqueKey(employeeId: string, scanDate: string | Date): string {
    const d = scanDate instanceof Date ? scanDate : new Date(scanDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${dateStr}_${employeeId}`;
  }
}

export const scanDataService = new ScanDataService();
