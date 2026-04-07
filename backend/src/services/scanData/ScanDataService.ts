/**
 * ScanDataService (Daily Aggregation Refactor)
 * บริการจัดการข้อมูลสแกนนิ้วแบบรายวัน
 *
 * Manages aggregated scan data (1 doc per employee per day).
 */

import { randomUUID } from 'crypto';
import { BaseCrudService } from '../base/BaseCrudService';
import {
  ScanData,
  CreateScanDataInput,
  generateScanDocId,
  formatWorkDate,
  formatPunchTime,
} from '../../models/ScanData';
import { collections } from '../../config/collections';
import { AppError } from '../../api/middleware/errorHandler';
import { logger } from '../../utils/logger';
import { db } from '../../config/firebase';
import { dailyContractorService } from '../dailyContractor/DailyContractorService';
import { dailyReportService } from '../dailyReport/DailyReportService';

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

/**
 * ScanDataService
 * Extends CrudService with aggregation operations
 */
class ScanDataService extends BaseCrudService<ScanData> {
  constructor() {
    super(collections.scanData as any, 'scanData');
  }

  /**
   * Import Single Scan (Upsert)
   * Merges new punch time into daily aggregated document.
   */
  async importScanData(
    input: CreateScanDataInput,
    importedBy: string
  ): Promise<ScanData> {
    try {
      const workDateStr = formatWorkDate(input.scanDateTime); // YYYY-MM-DD
      const punchTime = formatPunchTime(input.scanDateTime); // HH:mm
      const docId = generateScanDocId(input.employeeId, workDateStr);
      const now = new Date();

      const docRef = collections.scanData.doc(docId);

      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        let newData: ScanData;

        if (doc.exists) {
          // UPDATE: Merge punch
          const existing = doc.data() as ScanData;
          const currentPunches = existing.punches || [];

          // Avoid duplicates
          if (currentPunches.includes(punchTime)) {
            return existing; // Already exists, return current
          }

          const newPunches = [...currentPunches, punchTime].sort();

          newData = {
            ...existing,
            punches: newPunches,
            firstIn: newPunches[0],
            lastOut: newPunches[newPunches.length - 1],
            updatedAt: now,
            // Keep original Import info, or update? Let's keep original for now
          };

          transaction.set(docRef, newData);
        } else {
          // INSERT: Create new daily record
          // We might need to resolve dailyContractorId first if we want to store it (though Schema removed it for simplicity, using employeeId as key)
          // If we need contractorId, we should look it up. But the new schema focuses on employeeId.

          const punches = [punchTime];
          newData = {
            id: docId,
            employeeId: input.employeeId,
            employeeNumber: input.employeeId,
            projectLocationId: input.projectLocationId,
            workDate: workDateStr,
            punches: punches,
            firstIn: punchTime,
            lastOut: punchTime,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
            importedAt: now,
            importedBy: importedBy,
            importSource: 'manual',
            importNote: input.importNote,
            rawData: { source: 'manual-import' }
          };

          transaction.set(docRef, newData);
        }

        return newData;
      });

      logger.info(`Scan data aggregated for ${input.employeeId} on ${workDateStr}`);
      return result;

    } catch (error: any) {
      logger.error('Error importing scan data:', error);
      throw error;
    }
  }

  /**
   * Bulk Import (Batch Aggregation)
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

    // Group records by User + Day to minimize DB reads
    // Map<"SCAN_ID", { punches: Set<string>, metadata... }>
    const dailyMap = new Map<string, {
      employeeId: string;
      projectLocationId: string;
      workDate: string;
      punches: Set<string>;
      rowNumbers: number[];
    }>();

    // 1. Pre-process and group in memory
    for (const record of records) {
      if (!record.employeeNumber || !record.scanDateTime) {
        errors.push({ row: record.rowNumber, error: 'ข้อมูลไม่ครบถ้วน' });
        continue;
      }

      const workDateStr = formatWorkDate(record.scanDateTime);
      const punchTime = formatPunchTime(record.scanDateTime);
      const docId = generateScanDocId(record.employeeNumber, workDateStr);

      if (!dailyMap.has(docId)) {
        dailyMap.set(docId, {
          employeeId: record.employeeNumber,
          projectLocationId: options.projectLocationId,
          workDate: workDateStr,
          punches: new Set(),
          rowNumbers: [],
        });
      }

      const entry = dailyMap.get(docId)!;
      entry.punches.add(punchTime);
      entry.rowNumbers.push(record.rowNumber);
    }

    let successfulRecords = 0;

    // 2. Process in batches
    const mapEntries = Array.from(dailyMap.entries());
    const CHUNK_SIZE = 100; // max 500 writes per batch, but we need reads too

    for (let i = 0; i < mapEntries.length; i += CHUNK_SIZE) {
      const chunk = mapEntries.slice(i, i + CHUNK_SIZE);
      const docIds = chunk.map(([id]) => id);

      try {
        await db.runTransaction(async (transaction) => {
          // Read all existing docs in chunk
          const docRefs = docIds.map(id => collections.scanData.doc(id));
          const snapshots = await transaction.getAll(...docRefs);

          for (let j = 0; j < chunk.length; j++) {
            const [docId, entry] = chunk[j];
            const snapshot = snapshots[j];

            let punchesToSave: string[];
            let finalData: ScanData;

            if (snapshot.exists) {
              const existing = snapshot.data() as ScanData;
              const existingPunches = new Set(existing.punches || []);

              // Merge
              entry.punches.forEach(p => existingPunches.add(p));
              punchesToSave = Array.from(existingPunches).sort();

              finalData = {
                ...existing,
                punches: punchesToSave,
                firstIn: punchesToSave[0],
                lastOut: punchesToSave[punchesToSave.length - 1],
                updatedAt: importedAt,
              };

              transaction.set(snapshot.ref, finalData);
            } else {
              punchesToSave = Array.from(entry.punches).sort();
              finalData = {
                id: docId,
                employeeId: entry.employeeId,
                employeeNumber: entry.employeeId,
                projectLocationId: entry.projectLocationId,
                workDate: entry.workDate,
                punches: punchesToSave,
                firstIn: punchesToSave[0],
                lastOut: punchesToSave[punchesToSave.length - 1],
                isDeleted: false,
                createdAt: importedAt,
                updatedAt: importedAt,
                importedAt: importedAt,
                importedBy: options.importedBy,
                importBatchId: importBatchId,
                importSource: options.source,
                importNote: options.importNote
              };
              transaction.set(snapshot.ref, finalData);
            }
            successfulRecords += entry.rowNumbers.length;
          }
        });
      } catch (err: any) {
        logger.error(`Batch transaction failed in bulkImport`, err);
        // Fallback: Add error for all rows in this chunk
        chunk.forEach(([, entry]) => {
          entry.rowNumbers.forEach(row => {
            errors.push({ row, employeeNumber: entry.employeeId, error: 'Transaction failed during batch save' });
          });
        });
      }
    }

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
   * Get by Project and Date Range
   * Queries aggregations
   */
  async getByProjectAndDate(
    projectLocationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScanData[]> {
    const startStr = formatWorkDate(startDate);
    const endStr = formatWorkDate(endDate);

    return await this.query([
      { field: 'projectLocationId', operator: '==', value: projectLocationId },
      { field: 'workDate', operator: '>=', value: startStr },
      { field: 'workDate', operator: '<=', value: endStr },
      { field: 'isDeleted', operator: '==', value: false }
    ]);
  }

  /**
   * Get by Contractor and Date Range
   * Requires employeeId lookup first!
   */
  async getByContractorAndDate(
    dailyContractorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScanData[]> {
    // 1. Get Employee ID from Contractor
    const dc = await dailyContractorService.getById(dailyContractorId);
    if (!dc) return [];

    const employeeId = dc.employeeId;
    const startStr = formatWorkDate(startDate);
    const endStr = formatWorkDate(endDate);

    return await this.query([
      { field: 'employeeId', operator: '==', value: employeeId },
      { field: 'workDate', operator: '>=', value: startStr },
      { field: 'workDate', operator: '<=', value: endStr },
      { field: 'isDeleted', operator: '==', value: false }
    ]);
  }

  /**
   * Detect Discrepancies (Logic Update for Aggregation)
   */
  async detectDiscrepancies(
    projectLocationId: string,
    startDate: Date,
    endDate: Date,
    detectedBy: string
  ): Promise<{ detected: number; discrepanciesCreated: number }> {
    // 1. Fetch Aggregated Scans
    const scans = await this.getByProjectAndDate(projectLocationId, startDate, endDate);

    // 2. Fetch Reports
    const reports = await dailyReportService.getByProjectAndDate(projectLocationId, startDate, endDate);

    // Map: Key = "DCID_Date"
    // Note: Scans use EmployeeID, Reports use DCID. match via lookup.

    // Need DC Map: EmployeeId -> DCID
    // const allScans = scans;
    // This lookup loop is expensive if many DCs. Optimization: Fetch all DCs in project.

    // For now, let's assume we can map or reports have empId? No, Report has dailyContractorId.
    // Let's get all DCs for this project.
    const projectDCs = await dailyContractorService.query([{ field: 'projectLocationIds', operator: 'array-contains', value: projectLocationId }]);
    const empIdToDcId = new Map<string, string>();
    const dcIdToEmpId = new Map<string, string>();
    projectDCs.forEach(dc => {
      empIdToDcId.set(dc.employeeId, dc.id);
      dcIdToEmpId.set(dc.id, dc.employeeId);
    });

    const reportMap = new Map<string, DailyReport[]>();
    reports.forEach(r => {
      const dateStr = formatWorkDate(r.workDate);
      const key = `${r.dailyContractorId}_${dateStr}`;
      if (!reportMap.has(key)) reportMap.set(key, []);
      reportMap.get(key)!.push(r);
    });

    const scanMap = new Map<string, ScanData>();
    scans.forEach(s => {
      const dcId = empIdToDcId.get(s.employeeId);
      if (dcId) {
        const key = `${dcId}_${s.workDate}`;
        scanMap.set(key, s);
      }
    });

    const allKeys = new Set([...reportMap.keys(), ...scanMap.keys()]);
    let discrepanciesCreated = 0;
    const batch = db.batch();
    const now = new Date();

    for (const key of allKeys) {
      const [dcId, dateStr] = key.split('_');
      const workDate = new Date(dateStr);
      const dayReports = reportMap.get(key) || [];
      const dayScan = scanMap.get(key); // Just one aggregated doc

      // Calculate Hours
      const reportedHours = dayReports.reduce((sum, r) => sum + (r.netHours || 0), 0);

      let scannedHours = 0;
      if (dayScan && dayScan.punches.length >= 2) {
        const first = this.parseTime(dateStr, dayScan.firstIn);
        const last = this.parseTime(dateStr, dayScan.lastOut);

        // Simple diff logic
        let diffMs = last.getTime() - first.getTime();
        // Lunch Check: If span crosses 12:00-13:00, subtract 1 hr
        const noon = new Date(workDate); noon.setHours(12, 0, 0, 0);
        const afternoon = new Date(workDate); afternoon.setHours(13, 0, 0, 0);

        if (first < noon && last > afternoon) {
          diffMs -= 3600000;
        }
        scannedHours = Math.max(0, diffMs / 3600000);
      }

      const diff = reportedHours - scannedHours;
      const absDiff = Math.abs(diff);

      let type: 'Type1' | 'Type2' | 'Type3' | null = null;
      let reason = '';

      if (dayReports.length > 0 && (!dayScan || dayScan.punches.length < 2)) {
        type = 'Type2'; // Report exists, Scan missing/incomplete
        reason = 'มี Daily Report แต่ข้อมูลสแกนไม่ครบ (น้อยกว่า 2 ครั้ง)';
      } else if (dayReports.length === 0 && dayScan && dayScan.punches.length >= 2) {
        type = 'Type3'; // Scan exists, Report missing
        reason = 'มีข้อมูลสแกนแต่ไม่มี Daily Report';
      } else if (absDiff > 1.0) {
        type = 'Type1'; // Mismatch
        reason = `ชั่วโมงทำงานไม่ตรงกัน (Report: ${reportedHours}, Scan: ${scannedHours.toFixed(2)})`;
      }

      if (type) {
        const discId = `${dcId}_${dateStr}_disc`;
        const ref = collections.scanDataDiscrepancies.doc(discId);
        batch.set(ref, {
          dailyReportId: dayReports[0]?.id || 'missing',
          dailyContractorId: dcId,
          projectLocationId,
          workDate,
          discrepancyType: type,
          reportedHours,
          scannedHours,
          hoursDifference: diff,
          severity: absDiff > 2 ? 'error' : 'warning',
          status: 'pending',
          detectionReason: reason,
          createdAt: now,
          detectedBy
        });
        discrepanciesCreated++;
      }
    }

    if (discrepanciesCreated > 0) await batch.commit();

    return { detected: allKeys.size, discrepanciesCreated };
  }

  private parseTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`);
  }

  async getLateRecords(): Promise<ScanData[]> {
    // TODO: Implement Logic for Late Check on Aggregated Data
    // Scan > 08:00
    // This logic might need to be adjusted: Late is specific to "First In".
    // Query: firstIn > "08:00"
    return await this.query([
      { field: 'firstIn', operator: '>', value: '08:00' },
      { field: 'isDeleted', operator: '==', value: false }
    ]);
  }
}

export const scanDataService = new ScanDataService();
