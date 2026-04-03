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
      return await this.query([
        { field: 'dailyContractorId', operator: '==', value: dailyContractorId },
        { field: 'workDate', operator: '>=', value: startDate },
        { field: 'workDate', operator: '<=', value: endDate },
      ]);
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
        { field: 'projectLocationId', operator: '==', value: projectLocationId },
        { field: 'workDate', operator: '>=', value: startDate },
        { field: 'workDate', operator: '<=', value: endDate },
      ]);
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

    for (const record of records) {
      if (!employeeCache.has(record.employeeNumber)) {
        try {
          const contractor = await dailyContractorService.findByEmployeeIdOrHistory(record.employeeNumber);
          employeeCache.set(record.employeeNumber, contractor ? contractor.id : null);
        } catch (e: any) {
          employeeCache.set(record.employeeNumber, null);
        }
      }
    }

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
   * GET /api/scan-data/detailed
   */
  async getDetailedScanReport(options: any): Promise<{ data: any[]; total: number }> {
    try {
      let scans: ScanData[] = [];
      let total = 0;

      if (options.projectId && options.startDate && options.endDate) {
        scans = await this.getByProjectAndDate(options.projectId, options.startDate, options.endDate);
        total = scans.length;
      } else {
        const result = await super.getAll(options);
        scans = result.items;
        total = result.total;
      }

      const enriched = [];
      for (const scan of scans) {
        const workDate = scan.workDate instanceof Date ? scan.workDate : (scan.workDate as any).toDate ? (scan.workDate as any).toDate() : new Date(scan.workDate);
        const dayReports = await dailyReportService.getByContractorAndDate(scan.dailyContractorId, workDate, workDate);

        const reportData = {
          regular: dayReports.some((r: any) => r.workType === 'regular') ? 1 : 0,
          otMorning: dayReports.reduce((sum: number, r: DailyReport) => sum + (r.workType === 'ot_morning' ? r.netHours : 0), 0),
          otNoon: dayReports.some((r: any) => r.workType === 'ot_noon') ? 1 : 0,
          otEvening: dayReports.reduce((sum: number, r: DailyReport) => sum + (r.workType === 'ot_evening' ? r.netHours : 0), 0),
        };

        enriched.push({
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
            scanNormalStatus: (scan as any).normalStatus === 1 ? 'ปกติ' : 'ไม่ครบ',
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
            errorNote: scan.importNote || '-'
          }
        });
      }

      if (options.page && options.pageSize) {
         const start = (options.page - 1) * options.pageSize;
         return { data: enriched.slice(start, start + options.pageSize), total };
      }
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
   * Get summary of discrepancies for Dashboard
   */
  async getDiscrepancySummary(projectId?: string): Promise<any> {
    try {
      let queryRef = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).where('status', '==', 'pending');
      if (projectId) queryRef = queryRef.where('projectLocationId', '==', projectId);
      const snapshot = await queryRef.get();
      const discrepancies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES);
      if (options.projectId) query = query.where('projectLocationId', '==', options.projectId);
      if (options.startDate) query = query.where('workDate', '>=', options.startDate);
      if (options.endDate) query = query.where('workDate', '<=', options.endDate);

      const snapshot = await query.get();
      const items = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        if (data.workDate && data.workDate.toDate) data.workDate = data.workDate.toDate();
        return { id: doc.id, ...data, detailedView: { ...data, date: data.workDate } };
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
    updatedBy: string
  ): Promise<ScanData | null> {
    try {
      const scanDate = this.formatDate(date);
      const uniqueKey = `SCAN_${contractorId}_${scanDate}`;
      const docRef = collections.scanData.doc(uniqueKey);
      const updateData: any = { 
        ...Object.fromEntries(punches.map((p, i) => [`Time${i+1}`, p])),
        updatedAt: new Date(),
        updatedBy
      };
      await docRef.set(updateData, { merge: true });
      const updated = await docRef.get();
      return { id: updated.id, ...updated.data() } as ScanData;
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
    _projectLocationId: string,
    _startDate: Date,
    _endDate: Date,
    _detectedBy: string,
    _projectName?: string,
    _projectCode?: string
  ): Promise<{ detected: number; discrepanciesCreated: number }> {
    try {
      // Logic for discrepancy detection goes here...
      return { detected: 0, discrepanciesCreated: 0 };
    } catch (error: any) {
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
  }): Promise<any[]> {
    let scans: ScanData[] = [];
    if (params.batchId) scans = await this.getByBatchId(params.batchId);
    else if (params.projectLocationId && params.startDate && params.endDate) {
      scans = await this.getByProjectAndDate(params.projectLocationId, params.startDate, params.endDate);
    }
    if (scans.length === 0) return [];

    const records: BulkImportRecord[] = scans.map((s, idx) => ({
      rowNumber: idx + 1,
      employeeNumber: s.employeeNumber || s.employeeId,
      scanDateTime: s.scanDateTime instanceof Date ? s.scanDateTime : (s.scanDateTime as any).toDate(),
    }));

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
