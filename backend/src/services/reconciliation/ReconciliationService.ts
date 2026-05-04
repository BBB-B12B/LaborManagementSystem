/**
 * ReconciliationService
 * ระบบ Reconcile ข้อมูลระหว่าง Daily Report และ Scan Data
 *
 * Business Rules:
 * - ทุกการ Approve ต้องมาจาก Admin เท่านั้น (ไม่มี Auto/Force Approve)
 * - statusHistory[] บันทึกทุกการเปลี่ยนสถานะ เพื่อป้องกัน Loop ซ้ำซ้อน
 * - เมื่อ Admin ยืนยันตาม Daily Report → ระบบเติม Scan Data พร้อม editHistory
 * - Conservative Rule (min hours) แสดงเป็น suggestedHours — UI hint เท่านั้น
 */

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import {
  ReconciliationRecord,
  ReconciliationStatus,
  StatusHistoryEntry,
  CreateReconciliationRecordInput,
  generateReconciliationId,
  reconciliationRecordConverter,
} from '../../models/ReconciliationRecord';
import { ScanEditEntry, generateScanDocId, scanDataConverter } from '../../models/ScanData';
import { COLLECTIONS } from '../../config/collections';
import {
  projectBDailyReportService,
} from '../external/ProjectBDailyReportService';
import { scanDataService } from '../scanData/ScanDataService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'reconciliationRecords';
const SCAN_COLLECTION = 'scanData';

// Hour tolerance — ถ้าต่างกันไม่เกินนี้ ถือว่า "ตรงกัน"
const HOURS_MATCH_TOLERANCE = 0.1; // 6 นาที

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationFilter {
  projectLocationId?: string;
  allowedProjects?: string[];
  status?: ReconciliationStatus | ReconciliationStatus[];
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  isLocked?: boolean;
  isResolved?: boolean;  // true = resolvedAt != null (แก้ไขแล้ว), false = resolvedAt == null
  page?: number;
  pageSize?: number;
}

export interface PaginatedReconciliationResult {
  records: ReconciliationRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClassifyResult {
  status: ReconciliationStatus;
  suggestedHours?: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// ReconciliationService
// ---------------------------------------------------------------------------

export class ReconciliationService {
  private db = getFirestore();

  private get collection() {
    return this.db.collection(COLLECTION);
  }

  // =========================================================================
  // Core: Classify
  // =========================================================================

  /**
   * กำหนดสถานะเริ่มต้นจากข้อมูลที่มี
   * Logic:
   *   dailyExists  scanExists  hoursMatch → Status
   *   ✅           ✅           ✅          → MATCHED
   *   ✅           ✅           ❌          → CONFLICTED
   *   ✅           ❌            -          → MISSING_SCAN
   *   ❌           ✅            -          → MISSING_DAILY
   *   ❌           ❌            -          → ABSENT
   */
  classify(
    dailyReportHours?: number,
    scanDataHours?: number,
    isHoliday?: boolean,
    isLeave?: boolean,
  ): ClassifyResult {
    const dailyExists = dailyReportHours !== undefined && dailyReportHours > 0;
    const scanExists = scanDataHours !== undefined && scanDataHours > 0;

    // ถ้าไม่มีข้อมูลการทำงานเลย ถึงจะมาเช็คว่าเป็นวันหยุดหรือวันลา
    if (!dailyExists && !scanExists) {
      if (isHoliday) return { status: 'HOLIDAY' };
      if (isLeave) return { status: 'LEAVE' };
      return { status: 'ABSENT' };
    }

    if (!dailyExists && scanExists) {
      return { status: 'MISSING_DAILY' };
    }

    if (dailyExists && !scanExists) {
      return {
        status: 'MISSING_SCAN',
        suggestedHours: 0, // ถ้าไม่มี scan เลย suggested = 0
      };
    }

    // ทั้งคู่มีข้อมูล — เช็คว่าตรงกันไหม
    const diff = Math.abs(dailyReportHours! - scanDataHours!);
    if (diff <= HOURS_MATCH_TOLERANCE) {
      return {
        status: 'MATCHED',
        suggestedHours: dailyReportHours,
      };
    }

    // ขัดแย้ง — เสนอค่าที่น้อยกว่า
    return {
      status: 'CONFLICTED',
      suggestedHours: Math.min(dailyReportHours!, scanDataHours!),
      note: `ต่างกัน ${diff.toFixed(2)} ชม. (Daily: ${dailyReportHours}, Scan: ${scanDataHours})`,
    };
  }

  // =========================================================================
  // CRUD
  // =========================================================================

  /**
   * สร้างหรืออัปเดต ReconciliationRecord
   * ถ้ามีอยู่แล้ว: อัปเดตเฉพาะข้อมูลดิบ + re-classify
   * ถ้ายังไม่มี: สร้างใหม่ พร้อม statusHistory entry แรก
   */
  async upsertRecord(
    input: CreateReconciliationRecordInput,
    isHoliday?: boolean,
    isLeave?: boolean,
  ): Promise<ReconciliationRecord> {
    const id = generateReconciliationId(input.employeeId, input.workDate);
    const ref = this.collection.doc(id);
    const snap = await ref.get();
    const now = new Date();

    const isLeaveCalculated = input.leaveHours !== undefined ? input.leaveHours > 0 : undefined;
    const classified = this.classify(
      input.dailyReportHours,
      input.scanDataHours,
      input.isHoliday ?? isHoliday,
      isLeaveCalculated ?? isLeave,
    );

    if (!snap.exists) {
      // สร้างใหม่
      const historyEntry: StatusHistoryEntry = {
        status: classified.status,
        changedAt: now,
        changedBy: 'system',
        reason: 'สร้างอัตโนมัติโดยระบบ',
        note: classified.note,
      };

      const record: Omit<ReconciliationRecord, 'id'> = {
        ...input,
        status: classified.status,
        suggestedHours: classified.suggestedHours,
        statusHistory: [historyEntry],
        createdAt: now,
        updatedAt: now,
      };

      await ref.set(reconciliationRecordConverter.toFirestore(record));
      return { id, ...record };
    }

    // อัปเดต — re-classify ถ้างวดงานยังไม่ถูกล็อก
    const existing = reconciliationRecordConverter.fromFirestore(snap);

    // ถ้างวดงานถูกล็อกแล้ว (isLocked: true) ไม่ต้อง re-classify
    if (existing.isLocked === true) {
      return existing;
    }

    const newStatus = classified.status;
    const statusChanged = newStatus !== existing.status;

    const updates: Partial<ReconciliationRecord> = {
      dailyReportHours: input.dailyReportHours,
      scanDataHours: input.scanDataHours,
      dailyReportId: input.dailyReportId,
      scanDataId: input.scanDataId,
      dailyReportPhotos: input.dailyReportPhotos,
      suggestedHours: classified.suggestedHours,
      status: newStatus,
      updatedAt: now,
    };

    if (input.isHoliday !== undefined) updates.isHoliday = input.isHoliday;
    else if (isHoliday !== undefined) updates.isHoliday = isHoliday;

    if (input.leaveHours !== undefined) updates.leaveHours = input.leaveHours;
    if (input.leaveEntries !== undefined) updates.leaveEntries = input.leaveEntries;

    if (statusChanged) {
      const newEntry: StatusHistoryEntry = {
        status: newStatus,
        changedAt: now,
        changedBy: 'system',
        reason: 'Re-classify อัตโนมัติหลังได้รับข้อมูลใหม่',
        note: classified.note,
      };

      (updates as any).statusHistory = FieldValue.arrayUnion(
        this.toFirestoreHistoryEntry(newEntry),
      );

      // ถ้า status กลับมาเป็น abnormal อีกครั้ง → clear resolvedAt
      const abnormalStatuses: ReconciliationStatus[] = [
        'CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'ABSENT', 'UNREGISTERED_EMPLOYEE',
      ];
      if (abnormalStatuses.includes(newStatus)) {
        (updates as any).resolvedAt = null;
        (updates as any).resolvedBy = null;
      }
    }

    await ref.update(reconciliationRecordConverter.toFirestore(updates as any));
    return { ...existing, ...updates };
  }

  /**
   * Generate ReconciliationRecords โดยดึงข้อมูลจากทั้ง 2 แหล่งอัตโนมัติ
   * - Daily Report hours: จาก Project B (DailyEmployeeTimesheets)
   * - Scan Data hours:   จาก Local Firestore (scanData)
   *
   * @param projectLocationId - เช่น "WH1 : คลังสินค้า MOTORWAY"
   * @param startDate - YYYY-MM-DD
   * @param endDate   - YYYY-MM-DD
   */
  async generateForProject(
    projectLocationId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ succeeded: number; failed: number; total: number }> {
    // 1. ดึง Daily Report summaries จาก Project B
    const dailySummaries = await projectBDailyReportService.getSummariesByProjectAndDateRange(
      projectLocationId,
      startDate,
      endDate,
    );

    // 2. ดึง Scan Data จาก Local Firestore
    const scanRecords = await scanDataService.getByProjectAndDate(
      projectLocationId,
      new Date(startDate),
      new Date(endDate),
    );

    // 3. สร้าง Map ของ Scan Data: key = "{employeeId}_{workDate}"
    const scanMap = new Map<string, { hours: number; id: string }>();
    for (const scan of scanRecords) {
      if (scan.isDeleted) continue;
      const dateKey =
        scan.scanDate ||
        (scan.workDate instanceof Date
          ? scan.workDate.toISOString().split('T')[0]
          : String(scan.workDate).split('T')[0]);
      const key = `${scan.employeeId}_${dateKey}`;
      const totalScanHours =
        (scan.regularHours ?? 0) +
        (scan.otMorningHours ?? 0) +
        (scan.otEveningHours ?? 0);
      scanMap.set(key, { hours: totalScanHours, id: scan.id });
    }

    // 4. Upsert ReconciliationRecord สำหรับทุก daily summary
    const results = await Promise.allSettled(
      dailySummaries.map((summary) => {
        const key = `${summary.employeeNumber}_${summary.date}`;
        const scanEntry = scanMap.get(key);

        return this.upsertRecord({
          employeeId: summary.employeeNumber,
          workDate: summary.date,
          projectLocationId: summary.projectLocationId,
          dailyReportHours: summary.totalHours,
          dailyReportId: `${summary.employeeNumber}_${summary.date}`, // Project B doc id
          scanDataHours: scanEntry?.hours,
          scanDataId: scanEntry?.id,
          dailyReportPhotos: summary.dailyReportPhotos,
          leaveHours: summary.leaveHours,
        }, false, summary.isLeave);
      }),
    );

    // 5. Handle scan records ที่ไม่มี daily report (MISSING_DAILY)
    //    หา scan records ที่ยังไม่ถูก match กับ daily summary
    const matchedKeys = new Set(dailySummaries.map((s) => `${s.employeeNumber}_${s.date}`));
    const unmatchedScans = scanRecords.filter((scan) => {
      if (scan.isDeleted) return false;
      const dateKey =
        scan.scanDate ||
        (scan.workDate instanceof Date
          ? scan.workDate.toISOString().split('T')[0]
          : String(scan.workDate).split('T')[0]);
      return !matchedKeys.has(`${scan.employeeId}_${dateKey}`);
    });

    const unmatchedResults = await Promise.allSettled(
      unmatchedScans.map((scan) => {
        const dateKey =
          scan.scanDate ||
          (scan.workDate instanceof Date
            ? scan.workDate.toISOString().split('T')[0]
            : String(scan.workDate).split('T')[0]);
        const totalScanHours =
          (scan.regularHours ?? 0) +
          (scan.otMorningHours ?? 0) +
          (scan.otEveningHours ?? 0);

        return this.upsertRecord({
          employeeId: scan.employeeId,
          workDate: dateKey,
          projectLocationId: scan.projectLocationId,
          dailyReportHours: undefined,   // ไม่มี daily → MISSING_DAILY
          scanDataHours: totalScanHours,
          scanDataId: scan.id,
        });
      }),
    );

    const allResults = [...results, ...unmatchedResults];
    const succeeded = allResults.filter((r) => r.status === 'fulfilled').length;
    const failed = allResults.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, total: allResults.length };
  }

  /**
   * ดึง ReconciliationRecord เดียวตาม ID
   */
  async getById(id: string): Promise<ReconciliationRecord | null> {
    const snap = await this.collection.doc(id).get();
    if (!snap.exists) return null;
    return reconciliationRecordConverter.fromFirestore(snap);
  }

  /**
   * สร้าง Firestore Query จาก filter (ไม่รวม ordering / offset / limit)
   * ใช้ร่วมกันระหว่าง getRecords (paginated) และ getAnomaliesForExport (unlimited)
   */
  private buildBaseQuery(filter: Omit<ReconciliationFilter, 'page' | 'pageSize'>): FirebaseFirestore.Query {
    let query: FirebaseFirestore.Query = this.collection;

    if (filter.projectLocationId) {
      query = query.where('projectLocationId', '==', filter.projectLocationId);
    } else if (filter.allowedProjects && filter.allowedProjects.length > 0) {
      query = query.where('projectLocationId', 'in', filter.allowedProjects);
    }
    if (filter.employeeId) {
      query = query.where('employeeId', '==', filter.employeeId);
    }
    if (filter.startDate) {
      query = query.where('workDate', '>=', filter.startDate);
    }
    if (filter.endDate) {
      query = query.where('workDate', '<=', filter.endDate);
    }
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        if (filter.status.length === 1) {
          query = query.where('status', '==', filter.status[0]);
        } else {
          query = query.where('status', 'in', filter.status);
        }
      } else {
        query = query.where('status', '==', filter.status);
      }
    }
    if (filter.isLocked !== undefined) {
      query = query.where('isLocked', '==', filter.isLocked);
    }
    // isResolved: true  → resolvedAt != null  (ใช้ > Timestamp(0) trick เพราะ Firestore ไม่ support != null โดยตรง)
    // isResolved: false → resolvedAt == null
    if (filter.isResolved === true) {
      query = query.where('resolvedAt', '>', new Date(0));
    } else if (filter.isResolved === false) {
      query = query.where('resolvedAt', '==', null);
    }

    return query;
  }

  /**
   * ดึงรายการตาม filter พร้อม server-side pagination
   * ใช้ Firestore Count Aggregate สำหรับ total และ offset+limit สำหรับ paging
   */
  async getRecords(filter: ReconciliationFilter): Promise<PaginatedReconciliationResult> {
    const page = filter.page ?? 0;
    const pageSize = filter.pageSize ?? 100;

    const baseQuery = this.buildBaseQuery(filter);

    // Count total (Firestore Aggregate Query — ไม่คิดค่า read เต็ม)
    const countSnap = await baseQuery.count().get();
    const total = countSnap.data().count;

    // ดึงข้อมูลหน้าปัจจุบัน
    const dataSnap = await baseQuery
      .orderBy('workDate', 'desc')
      .offset(page * pageSize)
      .limit(pageSize)
      .get();

    return {
      records: dataSnap.docs.map((doc) => reconciliationRecordConverter.fromFirestore(doc)),
      total,
      page,
      pageSize,
    };
  }

  // =========================================================================
  // Admin Actions
  // =========================================================================

  // ลบ approveRecord ออกแล้ว — ไม่มีการ approve รายวันอีกต่อไป การล็อกข้อมูลทำผ่านงวดงาน (onWagePeriodApproved)
  // ลบ sendCorrection ออกแล้ว — Admin แจ้งนอกระบบเอง

  /**
   * Admin ยืนยันตาม Daily Report → เติม Scan Data พร้อม editHistory
   * ใช้เมื่อ: พนักงานทำงานจริงตาม Daily Report แต่ลืม scan
   */
  async confirmByDailyReport(
    recordId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const ref = this.collection.doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`ReconciliationRecord ${recordId} not found`);

    const record = reconciliationRecordConverter.fromFirestore(snap);
    if (!record.dailyReportHours) {
      throw new Error('ไม่มีข้อมูล Daily Report สำหรับ Record นี้');
    }

    const now = new Date();

    // อัปเดต Scan Data — เติม editHistory
    if (record.scanDataId) {
      const scanRef = this.db.collection(SCAN_COLLECTION).doc(record.scanDataId);
      const scanSnap = await scanRef.get();

      if (scanSnap.exists) {
        const scanData = scanDataConverter.fromFirestore(scanSnap);
        const editEntry: ScanEditEntry = {
          editedAt: now,
          editedBy: adminId,
          action: 'manual_fill',
          reason,
          reconciliationRecordId: recordId,
          snapshot: {
            punches: scanData.punches || [],
            firstIn: scanData.firstIn,
            lastOut: scanData.lastOut,
            regularHours: scanData.regularHours,
            otMorningHours: scanData.otMorningHours,
            otEveningHours: scanData.otEveningHours,
          },
        };

        await scanRef.update({
          isManuallyEdited: true,
          updatedAt: Timestamp.fromDate(now),
          editHistory: FieldValue.arrayUnion(this.toFirestoreScanEditEntry(editEntry)),
        });
      }
    } else {
      // ไม่มี scan record เลย — สร้างใหม่เป็น manual entry
      const scanId = generateScanDocId(record.employeeId, record.workDate);
      const scanRef = this.db.collection(SCAN_COLLECTION).doc(scanId);
      const editEntry: ScanEditEntry = {
        editedAt: now,
        editedBy: adminId,
        action: 'manual_create',
        reason,
        reconciliationRecordId: recordId,
        snapshot: { punches: [] }, // ไม่มีข้อมูลเดิม
      };

      await scanRef.set({
        employeeId: record.employeeId,
        workDate: new Date(record.workDate),
        scanDate: record.workDate,
        projectLocationId: record.projectLocationId,
        regularHours: record.dailyReportHours,
        isManualEntry: true,
        isManuallyEdited: false,
        editHistory: [this.toFirestoreScanEditEntry(editEntry)],
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        importedAt: Timestamp.fromDate(now),
        importedBy: adminId,
        importSource: 'manual_reconciliation',
        hasDiscrepancy: false,
        isLate: false,
        lateMinutes: 0,
        isDeleted: false,
      });
    }

    // อัปเดต ReconciliationRecord → re-classify
    const historyEntry: StatusHistoryEntry = {
      status: 'MATCHED',
      changedAt: now,
      changedBy: adminId,
      reason: `Admin ยืนยันตาม Daily Report: ${reason}`,
      note: `Scan Data ถูกเติมอัตโนมัติ ${record.dailyReportHours} ชม.`,
    };

    await ref.update({
      status: 'MATCHED',
      scanDataHours: record.dailyReportHours,
      suggestedHours: record.dailyReportHours,
      resolvedAt: Timestamp.fromDate(now),
      resolvedBy: adminId,
      updatedAt: Timestamp.fromDate(now),
      statusHistory: FieldValue.arrayUnion(this.toFirestoreHistoryEntry(historyEntry)),
    });
  }

  /**
   * Admin ลบ Ghost Scan → บันทึก editHistory แล้ว soft-delete
   */
  async deleteGhostScan(
    recordId: string,
    adminId: string,
    reason: string,
  ): Promise<void> {
    const ref = this.collection.doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`ReconciliationRecord ${recordId} not found`);

    const record = reconciliationRecordConverter.fromFirestore(snap);
    const now = new Date();

    if (record.scanDataId) {
      const scanRef = this.db.collection(SCAN_COLLECTION).doc(record.scanDataId);
      const scanSnap = await scanRef.get();

      if (scanSnap.exists) {
        const scanData = scanDataConverter.fromFirestore(scanSnap);
        const editEntry: ScanEditEntry = {
          editedAt: now,
          editedBy: adminId,
          action: 'delete_ghost',
          reason,
          reconciliationRecordId: recordId,
          snapshot: {
            punches: scanData.punches || [],
            firstIn: scanData.firstIn,
            lastOut: scanData.lastOut,
            regularHours: scanData.regularHours,
          },
        };

        // Soft delete scan + บันทึก editHistory
        await scanRef.update({
          isDeleted: true,
          deletedAt: Timestamp.fromDate(now),
          deletedBy: adminId,
          isManuallyEdited: true,
          updatedAt: Timestamp.fromDate(now),
          editHistory: FieldValue.arrayUnion(this.toFirestoreScanEditEntry(editEntry)),
        });
      }
    }

    // Re-classify เป็น ABSENT
    const historyEntry: StatusHistoryEntry = {
      status: 'ABSENT',
      changedAt: now,
      changedBy: adminId,
      reason: `Admin ลบ Ghost Scan: ${reason}`,
    };

    await ref.update({
      status: 'ABSENT',
      scanDataHours: 0,
      scanDataId: null,
      suggestedHours: 0,
      updatedAt: Timestamp.fromDate(now),
      statusHistory: FieldValue.arrayUnion(this.toFirestoreHistoryEntry(historyEntry)),
    });
  }

  // ลบ markAsExported ออกแล้ว — Admin Export ใช้ getAnomaliesForExport แล้ว Export เอง

  // =========================================================================
  // Stats (Aggregate Counts — ใช้ Firestore Count เพื่อประหยัด reads)
  // =========================================================================

  /**
   * ดึงจำนวนสถิติสำหรับ SummaryStats card
   * ใช้ Firestore Count Aggregate — ไม่คิดค่า read เต็ม, เร็ว
   *
   * @returns totalRows, normalCount, pendingCount, resolvedCount, employeeCount, ...
   */
  async getStats(filter: {
    projectLocationId?: string;
    allowedProjects?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalRows: number;
    normalCount: number;      // MATCHED + LEAVE
    absentCount: number;      // ABSENT เฉพาะ
    leaveCount: number;       // LEAVE เฉพาะ
    pendingCount: number;
    resolvedCount: number;
    missingDailyCount: number;
    missingScanCount: number;
    conflictedCount: number;
    unregisteredCount: number;
    employeeCount: number;
  }> {
    const abnormalStatuses: ReconciliationStatus[] = [
      'CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'UNREGISTERED_EMPLOYEE', 'ABSENT',
    ];

    // Base project/date filter (ไม่ใส่ status)
    const buildProjectDateQuery = () => {
      let q: FirebaseFirestore.Query = this.collection;
      if (filter.projectLocationId) {
        q = q.where('projectLocationId', '==', filter.projectLocationId);
      } else if (filter.allowedProjects && filter.allowedProjects.length > 0) {
        q = q.where('projectLocationId', 'in', filter.allowedProjects);
      }
      if (filter.startDate) q = q.where('workDate', '>=', filter.startDate);
      if (filter.endDate) q = q.where('workDate', '<=', filter.endDate);
      return q;
    };

    // Run all queries concurrently
    const baseQ = buildProjectDateQuery();
    const [
      totalSnap,
      normalSnap,
      pendingSnap,
      resolvedSnap,
      missingDailySnap,
      missingScanSnap,
      conflictedSnap,
      unregisteredSnap,
      absentSnap,
      leaveSnap,
      holidaySnap,
      employeeCountSnap,
    ] = await Promise.all([
      baseQ.count().get(),
      baseQ.where('status', '==', 'MATCHED').count().get(),
      baseQ.where('status', 'in', abnormalStatuses).count().get(),
      baseQ.where('resolvedAt', '>', new Date(0)).count().get(),
      baseQ.where('status', '==', 'MISSING_DAILY').count().get(),
      baseQ.where('status', '==', 'MISSING_SCAN').count().get(),
      baseQ.where('status', '==', 'CONFLICTED').count().get(),
      baseQ.where('status', '==', 'UNREGISTERED_EMPLOYEE').count().get(),
      baseQ.where('status', '==', 'ABSENT').count().get(),
      baseQ.where('status', '==', 'LEAVE').count().get(),
      baseQ.where('status', '==', 'HOLIDAY').count().get(),
      // นับพนักงานจาก dailyContractors ที่ isActive: true + filter project
      (() => {
        let dcQ: FirebaseFirestore.Query = this.db.collection(COLLECTIONS.DAILY_CONTRACTORS)
          .where('isActive', '==', true);
        if (filter.projectLocationId) {
          dcQ = dcQ.where('projectLocationId', '==', filter.projectLocationId);
        } else if (filter.allowedProjects && filter.allowedProjects.length > 0) {
          dcQ = dcQ.where('projectLocationId', 'in', filter.allowedProjects);
        }
        return dcQ.count().get();
      })(),
    ]);

    return {
      totalRows:          totalSnap.data().count - holidaySnap.data().count,
      normalCount:        normalSnap.data().count + leaveSnap.data().count,
      absentCount:        absentSnap.data().count,
      leaveCount:         leaveSnap.data().count,
      pendingCount:       pendingSnap.data().count,
      resolvedCount:      resolvedSnap.data().count,
      missingDailyCount:  missingDailySnap.data().count,
      missingScanCount:   missingScanSnap.data().count,
      conflictedCount:    conflictedSnap.data().count,
      unregisteredCount:  unregisteredSnap.data().count,
      employeeCount:      employeeCountSnap.data().count,
    };
  }

  // =========================================================================
  // Export Anomalies
  // =========================================================================

  /**
   * ดึงข้อมูลรายการผิดปกติเพื่อ Export CSV
   * Admin นำไปแจ้งโฟรแมนนอกระบบเอง
   */
  async getAnomaliesForExport(filter: ReconciliationFilter): Promise<
    Array<{
      employeeId: string;
      employeeName?: string;
      workDate: string;
      projectName?: string;
      status: string;
      dailyReportHours?: number;
      scanDataHours?: number;
      suggestedHours?: number;
    }>
  > {
    const anomalyStatuses: ReconciliationStatus[] = [
      'CONFLICTED',
      'MISSING_SCAN',
      'MISSING_DAILY',
      'ABSENT',
    ];

    // ใช้ buildBaseQuery โดยตรง — ไม่ paginate เพื่อ export ข้อมูลทั้งหมด
    const query = this.buildBaseQuery({
      ...filter,
      status: anomalyStatuses,
    });

    const snap = await query.orderBy('workDate', 'desc').get();
    const records = snap.docs.map((doc) => reconciliationRecordConverter.fromFirestore(doc));

    return records.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      workDate: r.workDate,
      projectName: r.projectName,
      status: r.status,
      dailyReportHours: r.dailyReportHours,
      scanDataHours: r.scanDataHours,
      suggestedHours: r.suggestedHours,
    }));
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private toFirestoreHistoryEntry(entry: StatusHistoryEntry): Record<string, any> {
    return {
      status: entry.status,
      changedAt: Timestamp.fromDate(entry.changedAt),
      changedBy: entry.changedBy,
      ...(entry.reason && { reason: entry.reason }),
      ...(entry.note && { note: entry.note }),
    };
  }

  private toFirestoreScanEditEntry(entry: ScanEditEntry): Record<string, any> {
    return {
      editedAt: Timestamp.fromDate(entry.editedAt),
      editedBy: entry.editedBy,
      action: entry.action,
      reason: entry.reason,
      ...(entry.reconciliationRecordId && {
        reconciliationRecordId: entry.reconciliationRecordId,
      }),
      snapshot: entry.snapshot,
    };
  }
}

export const reconciliationService = new ReconciliationService();
