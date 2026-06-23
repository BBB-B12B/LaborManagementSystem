import {
  DailyReport,
  DailyReportEntry,
  DailyWorkerReport,
  dailyReportConverter,
} from '../../models/DailyReport';
import * as XLSX from 'xlsx';
import { parseExcelRowV2 } from '../../utils/dailyReportExcel';
import admin, { db } from '../../config/firebase';
import { collections } from '../../config/collections';
import { BaseCrudService } from '../base/BaseCrudService';

// Helper for UUID generation (simple fallback)
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class DailyReportService extends BaseCrudService<DailyReport> {
  constructor() {
    super(collections.dailyReports as any, 'dailyReports');
  }

  /**
   * Generate Custom ID (Normalized to Local Date)
   */
  private generateId(projectId: string, date: Date): string {
    // T-712: Use local date parts to avoid UTC drift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return `REP_${projectId}_${dateStr}`;
  }

  /**
   * Helper: Update Summary Cache for a report using Deltas (High Performance)
   */
  private async updateSummaryCacheWithDeltas(
    t: admin.firestore.Transaction,
    reportRef: admin.firestore.DocumentReference,
    deltas: {
      workerCountDelta: number;
      totalNetHoursDelta: number;
      regularHoursDelta: number;
      otHoursDelta: number;
    }
  ) {
    t.set(
      reportRef,
      {
        summary: {
          workerCount: admin.firestore.FieldValue.increment(deltas.workerCountDelta),
          totalNetHours: admin.firestore.FieldValue.increment(deltas.totalNetHoursDelta),
          regularHours: admin.firestore.FieldValue.increment(deltas.regularHoursDelta),
          otHours: admin.firestore.FieldValue.increment(deltas.otHoursDelta),
          lastImportAt: new Date(),
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );
  }

  /**
   * Add Work Entry (Upsert Worker Report & Summary)
   */
  async addWorkEntry(
    projectId: string,
    date: Date,
    entryInput: Omit<DailyReportEntry, 'id' | 'createdAt'>,
    user: string
  ): Promise<DailyReport> {
    const reportId = this.generateId(projectId, date);
    const workerId = entryInput.dailyContractorId;
    const now = new Date();

    const newEntry: DailyReportEntry = {
      id: generateUuid(),
      ...entryInput,
      createdAt: now,
    };

    const fmEntry = !!entryInput.fmSelfPerformed;
    const reportRef = collections.dailyReports.doc(reportId);
    const workerRef = reportRef.collection('workerEntries').doc(workerId);

    await db.runTransaction(async (t) => {
      // 1. ALL READS FIRST
      const reportDoc = await t.get(reportRef);
      const workerDoc = await t.get(workerRef);
      // ถ้า worker ยังไม่มี ต้องดึงข้อมูลชื่อพนักงานล่วงหน้า (ก่อนเกิด Write ใดๆ)
      // FM entries skip the dailyContractors lookup — sentinel ID doesn't exist in that collection
      let dcData: any = null;
      if (!workerDoc.exists && !fmEntry) {
        const dcDoc = await t.get(collections.dailyContractors.doc(workerId));
        dcData = dcDoc.data();
      } else if (!workerDoc.exists && fmEntry) {
        dcData = { name: 'FM', employeeId: '' };
      }

      // 2. ALL WRITES
      // FM entries are pure performance records — do NOT count toward summary hours or worker count
      const deltas = {
        workerCountDelta: 0,
        totalNetHoursDelta: fmEntry ? 0 : newEntry.hours,
        regularHoursDelta: fmEntry ? 0 : (newEntry.workType === 'regular' ? newEntry.hours : 0),
        otHoursDelta: fmEntry ? 0 : (newEntry.workType !== 'regular' ? newEntry.hours : 0),
      };

      if (!reportDoc.exists) {
        const newReport: DailyReport = {
          id: reportId,
          projectLocationId: projectId,
          date: date,
          status: 'draft',
          summary: { workerCount: 0, totalNetHours: 0, regularHours: 0, otHours: 0 },
          createdAt: now,
          updatedAt: now,
          createdBy: user,
          updatedBy: user,
          version: 1,
        };
        t.set(reportRef, dailyReportConverter.toFirestore(newReport));
      }

      const hDelta = {
        regular: newEntry.workType === 'regular' ? newEntry.hours : 0,
        otMorning: newEntry.workType === 'ot_morning' ? newEntry.hours : 0,
        otNoon: newEntry.workType === 'ot_noon' ? newEntry.hours : 0,
        otEvening: newEntry.workType === 'ot_evening' ? newEntry.hours : 0,
      };

      if (!workerDoc.exists) {
        if (!fmEntry) deltas.workerCountDelta = 1;
        const workerName = dcData?.name || 'Unknown';
        const employeeId = dcData?.employeeId || '';

        const newWorkerReport: DailyWorkerReport = {
          id: workerId,
          dailyContractorId: workerId,
          employeeId,
          workerName,
          regularHours: hDelta.regular,
          otMorningHours: hDelta.otMorning,
          otNoonHours: hDelta.otNoon,
          otEveningHours: hDelta.otEvening,
          totalNetHours: newEntry.hours,
          entries: [newEntry],
          editHistory: [
            {
              action: 'create',
              timestamp: now,
              userId: user,
              details: `Initial ${newEntry.workType}: ${newEntry.hours}h`,
            },
          ],
          updatedAt: now,
        };
        t.set(workerRef, newWorkerReport);
      } else {
        t.update(workerRef, {
          regularHours: admin.firestore.FieldValue.increment(hDelta.regular),
          otMorningHours: admin.firestore.FieldValue.increment(hDelta.otMorning),
          otNoonHours: admin.firestore.FieldValue.increment(hDelta.otNoon),
          otEveningHours: admin.firestore.FieldValue.increment(hDelta.otEvening),
          totalNetHours: admin.firestore.FieldValue.increment(newEntry.hours),
          entries: admin.firestore.FieldValue.arrayUnion(newEntry),
          updatedAt: now,
          editHistory: admin.firestore.FieldValue.arrayUnion({
            action: 'update',
            timestamp: now,
            userId: user,
            details: `Added ${newEntry.workType}: ${newEntry.hours}h`,
          }),
        });
      }

      await this.updateSummaryCacheWithDeltas(t, reportRef, deltas);
    });

    const updatedDoc = await reportRef.get();
    return dailyReportConverter.fromFirestore(updatedDoc);
  }

  /**
   * Remove Work Entry
   */
  async removeWorkEntry(
    projectId: string,
    date: Date,
    workerId: string,
    entryId: string,
    user: string
  ): Promise<void> {
    const reportId = this.generateId(projectId, date);
    const reportRef = collections.dailyReports.doc(reportId);
    const workerRef = reportRef.collection('workerEntries').doc(workerId);

    await db.runTransaction(async (t) => {
      const workerDoc = await t.get(workerRef);
      if (!workerDoc.exists) return;

      const workerData = workerDoc.data() as DailyWorkerReport;
      const entryToRemove = workerData.entries.find((e) => e.id === entryId);
      if (!entryToRemove) return;

      const deltas = {
        workerCountDelta: 0,
        totalNetHoursDelta: -entryToRemove.hours,
        regularHoursDelta: entryToRemove.workType === 'regular' ? -entryToRemove.hours : 0,
        otHoursDelta: entryToRemove.workType !== 'regular' ? -entryToRemove.hours : 0,
      };

      const hDelta = {
        regular: entryToRemove.workType === 'regular' ? -entryToRemove.hours : 0,
        otMorning: entryToRemove.workType === 'ot_morning' ? -entryToRemove.hours : 0,
        otNoon: entryToRemove.workType === 'ot_noon' ? -entryToRemove.hours : 0,
        otEvening: entryToRemove.workType === 'ot_evening' ? -entryToRemove.hours : 0,
      };

      const remainingEntries = workerData.entries.filter((e) => e.id !== entryId);

      if (remainingEntries.length === 0) {
        deltas.workerCountDelta = -1;
        t.delete(workerRef);
      } else {
        t.update(workerRef, {
          regularHours: admin.firestore.FieldValue.increment(hDelta.regular),
          otMorningHours: admin.firestore.FieldValue.increment(hDelta.otMorning),
          otNoonHours: admin.firestore.FieldValue.increment(hDelta.otNoon),
          otEveningHours: admin.firestore.FieldValue.increment(hDelta.otEvening),
          totalNetHours: admin.firestore.FieldValue.increment(-entryToRemove.hours),
          entries: remainingEntries,
          updatedAt: new Date(),
          editHistory: admin.firestore.FieldValue.arrayUnion({
            action: 'delete',
            timestamp: new Date(),
            userId: user,
            details: `Removed ${entryToRemove.workType}: ${entryToRemove.hours}h`,
          }),
        });
      }

      await this.updateSummaryCacheWithDeltas(t, reportRef, deltas);
    });
  }

  /**
   * Get Report by Project & Date (Returns Summary + Entries)
   */
  async getByProjectAndDate(projectId: string, date: Date): Promise<DailyReport | null> {
    const reportId = this.generateId(projectId, date);
    const reportRef = collections.dailyReports.doc(reportId);

    const doc = await reportRef.get();
    if (!doc.exists) return null;

    const report = dailyReportConverter.fromFirestore(doc);

    // Fetch all worker entries to rebuild the legacy combined view
    const workerSnapshot = await reportRef.collection('workerEntries').get();
    const allEntries: DailyReportEntry[] = [];

    workerSnapshot.forEach((wDoc) => {
      const wData = wDoc.data() as DailyWorkerReport;
      if (wData.entries) {
        allEntries.push(...wData.entries);
      }
    });

    // Attach entries for UI compatibility (even if not in main doc)
    (report as any).entries = allEntries;
    return report;
  }

  /**
   * Get Reports by Month (Uses Summary Cache - Fast!)
   */
  async getByProjectAndMonth(
    projectId: string,
    year: number,
    month: number
  ): Promise<DailyReport[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const snapshot = await collections.dailyReports
      .where('projectLocationId', '==', projectId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return snapshot.docs.map((doc) => dailyReportConverter.fromFirestore(doc));
  }

  /**
   * Parse Excel for Daily Report Import (v3 Bulletproof Version)
   */
  async getByProjectAndDateRange(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyReport[]> {
    const reports = await this.queryWithFallback([
      { field: 'projectLocationId', operator: '==', value: projectId },
      { field: 'workDate', operator: '>=', value: startDate },
      { field: 'workDate', operator: '<=', value: endDate },
    ]);

    return reports;
  }

  /**
   * ดึง Daily Reports ตามวันที่ (ทุกโครงการ)
   * Get daily reports by date range (all projects)
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<DailyReport[]> {
    const reports = await this.queryWithFallback([
      { field: 'workDate', operator: '>=', value: startDate },
      { field: 'workDate', operator: '<=', value: endDate },
    ]);
    return reports;
  }

  /**
   * Parse Excel for Daily Report Import (v3 Bulletproof Version)
   */
  async parseDailyReportExcel(buffer: Buffer): Promise<any[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const allResults: any[] = [];

    // T-709: Scan all sheets until data is found
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const fullRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      let headerRowIndex = -1;

      // T-710: Fuzzy Header Detection (Fuzzy scan up to 30 rows)
      for (let i = 0; i < Math.min(fullRows.length, 30); i++) {
        const row = fullRows[i];
        if (!row || !Array.isArray(row)) continue;

        const rowStr = row.join('|').toLowerCase();

        // Match Keywords: รหัสพนักงาน, รหัส, Employee, ID, Code, วันที่, Date
        const matchesEmp =
          rowStr.includes('รหัส') ||
          rowStr.includes('emp') ||
          rowStr.includes('id') ||
          rowStr.includes('code');
        const matchesDate = rowStr.includes('วันท') || rowStr.includes('date');

        if (matchesEmp && matchesDate) {
          headerRowIndex = i;
          console.log(`[ParseExcel] SUCCESS: Detected header at sheet "${sheetName}", row ${i}`);
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.log(`[ParseExcel] INFO: No valid headers found in sheet "${sheetName}". Skipping.`);
        continue;
      }

      // Parse starting from the detected header row
      const rows = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });

      for (const [index, row] of rows.entries()) {
        const parsed = parseExcelRowV2(row);
        if (!parsed) continue;

        // 1. Lookup DC by Employee ID
        const dcSnapshot = await collections.dailyContractors
          .where('employeeId', '==', parsed.employeeId)
          .limit(1)
          .get();

        const dcDoc = dcSnapshot.empty ? null : dcSnapshot.docs[0];
        const dcData = dcDoc?.data() as any;

        // Add more metadata for the preview UI
        allResults.push({
          ...parsed,
          workerName: dcData?.name || parsed.workerName,
          dailyContractorId: dcDoc?.id,
          projectLocationId: dcData?.projectLocationId,
          isValid: !!dcDoc,
          row: headerRowIndex + index + 2, // Excel 1-indexed row number
          error: dcDoc ? null : 'ไม่พบรหัสพนักงานในฐานข้อมูล',
        });
      }

      // If we found data in this sheet, we can stop (or continue to collect all)
      if (allResults.length > 0) break;
    }

    console.log(`[ParseExcel] FINAL: Total records extracted: ${allResults.length}`);
    return allResults;
  }

  /**
   * Bulk save daily reports (High-Performance Sub-collection Refactor)
   */
  async getByContractorAndDate(
    contractorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyReport[]> {
    const reports = await this.queryWithFallback([
      { field: 'dailyContractorId', operator: '==', value: contractorId },
      { field: 'workDate', operator: '>=', value: startDate },
      { field: 'workDate', operator: '<=', value: endDate },
    ]);
    return reports;
  }

  async bulkCreateDailyReports(data: any[], user: string, importFileUrl?: string): Promise<number> {
    let successCount = 0;
    console.log(`[BulkCreate] Received ${data.length} items from frontend.`);

    // 1. Group by Report (Project + Date)
    const itemsByReport = data.reduce(
      (acc: Record<string, any[]>, item: any) => {
        // T-712: Ensure date is parsed correctly from string or date object
        const itemDate = new Date(item.date);
        const reportId = this.generateId(item.projectLocationId, itemDate);
        if (!acc[reportId]) acc[reportId] = [];
        acc[reportId].push(item);
        return acc;
      },
      {} as Record<string, any[]>
    );

    console.log(
      `[BulkCreate] Grouped into ${Object.keys(itemsByReport).length} reports (Project-Day docs).`
    );

    for (const reportId in itemsByReport) {
      const items = itemsByReport[reportId];
      if (items.length === 0) continue;

      const projectId = items[0].projectLocationId;
      const date = new Date(items[0].date);
      const reportRef = collections.dailyReports.doc(reportId);

      console.log(`[BulkCreate] Processing report ${reportId} (${items.length} items)...`);

      try {
        console.log(`[BulkCreate] Starting transaction for ${reportId}...`);
        await db.runTransaction(async (t) => {
          // 1. ALL READS FIRST (Firestore Rule)
          const reportDoc = await t.get(reportRef);

          const itemsByWorker = items.reduce(
            (acc: Record<string, any[]>, item: any) => {
              if (!item.isValid) return acc;
              const workerId = item.dailyContractorId;
              if (!workerId) return acc;
              if (!acc[workerId]) acc[workerId] = [];
              acc[workerId].push(item);
              return acc;
            },
            {} as Record<string, any[]>
          );

          const workerIds = Object.keys(itemsByWorker);
          const workerDocsMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();

          // Pre-fetch all worker docs before any set/update
          for (const workerId of workerIds) {
            const workerRef = reportRef.collection('workerEntries').doc(workerId);
            const wDoc = await t.get(workerRef);
            workerDocsMap.set(workerId, wDoc);
          }

          // 2. ALL WRITES
          if (!reportDoc.exists) {
            console.log(`[BulkCreate] Report ${reportId} not found, initializing new summary doc.`);
            const newReport: DailyReport = {
              id: reportId,
              projectLocationId: projectId,
              date: date,
              status: 'draft',
              summary: {
                workerCount: 0,
                totalNetHours: 0,
                regularHours: 0,
                otHours: 0,
                lastImportAt: new Date(),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user,
              updatedBy: user,
              version: 1,
            };
            t.set(reportRef, dailyReportConverter.toFirestore(newReport));
          }

          const deltas = {
            workerCountDelta: 0,
            totalNetHoursDelta: 0,
            regularHoursDelta: 0,
            otHoursDelta: 0,
          };

          for (const workerId of workerIds) {
            const workerItems = itemsByWorker[workerId];
            const workerRef = reportRef.collection('workerEntries').doc(workerId);
            const workerDoc = workerDocsMap.get(workerId)!;

            console.log(`[BulkCreate] Worker ${workerId}: Processing ${workerItems.length} units.`);

            const hDelta = {
              regular: 0,
              otMorning: 0,
              otNoon: 0,
              otEvening: 0,
              total: 0,
            };

            const newEntries: DailyReportEntry[] = workerItems.map((item: any) => {
              const hours = Number(item.hours || 0);

              hDelta.total += hours;
              if (item.workType === 'regular') {
                hDelta.regular += hours;
                deltas.regularHoursDelta += hours;
              } else {
                if (item.workType === 'ot_morning') hDelta.otMorning += hours;
                if (item.workType === 'ot_noon') hDelta.otNoon += hours;
                if (item.workType === 'ot_evening') hDelta.otEvening += hours;
                deltas.otHoursDelta += hours;
              }
              deltas.totalNetHoursDelta += hours;

              return {
                id: generateUuid(),
                dailyContractorId: item.dailyContractorId,
                employeeId: item.employeeId || '',
                taskName: item.taskName || 'นำเข้าข้อมูล',
                workType: item.workType,
                hours,
                notes: item.notes || '',
                createdAt: new Date(),
              };
            });

            if (!workerDoc.exists) {
              deltas.workerCountDelta += 1;
              console.log(`[BulkCreate] Worker ${workerId}: Creating new worker report doc.`);
              const newWorkerReport: DailyWorkerReport = {
                id: workerId,
                dailyContractorId: workerId,
                employeeId: workerItems[0].employeeId || '',
                workerName:
                  workerItems[0].matchedWorkerName || workerItems[0].workerName || 'Unknown',
                regularHours: hDelta.regular,
                otMorningHours: hDelta.otMorning,
                otNoonHours: hDelta.otNoon,
                otEveningHours: hDelta.otEvening,
                totalNetHours: hDelta.total,
                entries: newEntries,
                editHistory: [
                  {
                    action: 'import',
                    timestamp: new Date(),
                    userId: user,
                    details: `Bulk Import: ${newEntries.length} entries`,
                  },
                ],
                updatedAt: new Date(),
              };
              t.set(workerRef, newWorkerReport);
            } else {
              console.log(
                `[BulkCreate] Worker ${workerId}: Appending to existing worker report doc.`
              );
              t.update(workerRef, {
                regularHours: admin.firestore.FieldValue.increment(hDelta.regular),
                otMorningHours: admin.firestore.FieldValue.increment(hDelta.otMorning),
                otNoonHours: admin.firestore.FieldValue.increment(hDelta.otNoon),
                otEveningHours: admin.firestore.FieldValue.increment(hDelta.otEvening),
                totalNetHours: admin.firestore.FieldValue.increment(hDelta.total),
                entries: admin.firestore.FieldValue.arrayUnion(...newEntries),
                updatedAt: new Date(),
                editHistory: admin.firestore.FieldValue.arrayUnion({
                  action: 'import',
                  timestamp: new Date(),
                  userId: user,
                  details: `Bulk Import Append: ${newEntries.length} entries`,
                }),
              });
            }
            successCount += newEntries.length;
          }

          console.log(`[BulkCreate] Applying summary deltas for ${reportId}:`, deltas);
          await this.updateSummaryCacheWithDeltas(t, reportRef, deltas);

          if (importFileUrl) {
            console.log(`[BulkCreate] Linking import source file: ${importFileUrl}`);
            t.set(
              reportRef,
              {
                importFileUrls: admin.firestore.FieldValue.arrayUnion(importFileUrl),
                updatedAt: new Date(),
              },
              { merge: true }
            );
          }
        });
        console.log(`[BulkCreate] Transaction successfully committed for ${reportId}.`);
      } catch (err) {
        console.error(`Bulk Import Transaction Failure [${reportId}]:`, err);
      }
    }
    return successCount;
  }
}

export const dailyReportService = new DailyReportService();
