/**
 * ProjectBDailyReportService
 * Service for cross-project communication with Project B (After Sale System).
 *
 * Reads from: /DailyEmployeeTimesheets/{employeeNumber}_{date}
 * Doc ID format: "200022_2025-08-25"
 *
 * NOTE: Field names may change in the future. If updated, notify the team.
 */

import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Types — matching Project B's Firestore schema
// ---------------------------------------------------------------------------

export interface ProjectBExpectedHours {
  normal: number;      // ชม. ปกติ
  otMorning: number;   // ชม. OT เช้า
  otNoon: number;      // ชม. OT เที่ยง (ผ่าเที่ยง)
  otEvening: number;   // ชม. OT เย็น
}

export interface ProjectBExpectedShifts {
  normal: boolean;
  otMorning: boolean;
  otNoon: boolean;
  otEvening: boolean;
}

export interface ProjectBShiftTimes {
  day?: string;       // เช่น "08:00 - 17:00"
  otEvening?: string; // เช่น "18:00 - 21:00"
  otMorning?: string;
  otNoon?: string;    // เช่น "12:00 - 13:00"
}

export interface ProjectBWorkLog {
  location?: string;
  taskName?: string;
  otMorningTask?: string;
  otNoonTask?: string;
  otEveningTask?: string;
  subtaskName?: string;
  taskId?: string;
  subtaskId?: string;
  [key: string]: any;
}

/**
 * DailyEmployeeTimesheet document from Project B
 * Collection: DailyEmployeeTimesheets
 * Doc ID: {employeeNumber}_{date}  e.g. "200022_2025-08-25"
 */
export interface DailyEmployeeTimesheet {
  employeeNumber: string;          // รหัสพนักงาน
  date: string;                    // YYYY-MM-DD
  projectLocationId: string;       // เช่น "WH1 : คลังสินค้า MOTORWAY"
  expectedHours: ProjectBExpectedHours;
  expectedShifts: ProjectBExpectedShifts;
  shiftTimes?: ProjectBShiftTimes;
  workLogs?: ProjectBWorkLog[];
  isActive: boolean;
  // Leave Data
  leave?: { hours: number; attachment?: string }[];
  leaveStatus?: {
    isFullDay?: boolean;
    leaveType?: string;
    leaveShifts?: { morning?: boolean; afternoon?: boolean; custom?: boolean };
    leaveTimes?: { custom?: string };
    medCertFileUrl?: string;
  };
  // Fallbacks if they appear at root
  leaveShifts?: { morning?: boolean; afternoon?: boolean; custom?: boolean };
  leaveTimes?: { custom?: string };
  leaveType?: string;
  medCertFileUrl?: string;
  // Photos
  photos?: {
    labor?: string[];
    site?: string[];
    laborByShift?: {
      regular?: string[];
      otMorning?: { in?: string; out?: string };
      otNoon?: { in?: string; out?: string };
      otEvening?: { in?: string; out?: string };
    };
  };
  AssigneesID?: string;
  lastUpdated?: string;            // ISO string
}

/**
 * Computed summary สำหรับ Reconciliation
 */
export interface DailyTimesheetSummary {
  employeeNumber: string;
  date: string;
  projectLocationId: string;
  regularHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
  totalHours: number;              // sum ทั้งหมด = regularHours + otMorning + otNoon + otEvening
  isActive: boolean;
  isLeave: boolean;
  leaveHours: number;
  leaveEntries?: { type: string; hours: number; description?: string; timeRange?: string }[];
  medCertFileUrl?: string;
  assigneeId?: string;
  dailyReportPhotos?: {
    regular?: string[];
    otMorning?: { in?: string; out?: string };
    otNoon?: { in?: string; out?: string };
    otEvening?: { in?: string; out?: string };
  };    // ดึงมาจาก photos.laborByShift
  dailyReportPunches?: string[];   // ดึงมาจาก shiftTimes
  shiftTimes?: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
    otNoon?: string;
  };
  workLogs?: ProjectBWorkLog[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * แปลง DailyEmployeeTimesheet → DailyTimesheetSummary
 * สำหรับส่งเข้า ReconciliationService
 */
export function toTimesheetSummary(doc: DailyEmployeeTimesheet): DailyTimesheetSummary {
  const h = doc.expectedHours;
  const regularHours = h?.normal ?? 0;
  const otMorningHours = h?.otMorning ?? 0;
  const otNoonHours = h?.otNoon ?? 0;
  const otEveningHours = h?.otEvening ?? 0;
  const totalHours = regularHours + otMorningHours + otNoonHours + otEveningHours;

  let leaveHours = 0;
  if (doc.leave && Array.isArray(doc.leave)) {
    leaveHours = doc.leave.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  } else if (doc.leaveStatus || doc.leaveType) {
    if (doc.leaveStatus?.isFullDay) leaveHours = 8;
    else {
      const shifts = doc.leaveStatus?.leaveShifts || doc.leaveShifts;
      const times = doc.leaveStatus?.leaveTimes || doc.leaveTimes;

      if (shifts?.morning) leaveHours += 4;
      if (shifts?.afternoon) leaveHours += 4;
      if (shifts?.custom) {
        if (times?.custom) {
          const parts = times.custom.split('-').map(s => s.trim());
          if (parts.length === 2) {
            const [startH, startM] = parts[0].split(':').map(Number);
            const [endH, endM] = parts[1].split(':').map(Number);
            if (!isNaN(startH) && !isNaN(endH)) {
              let diff = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
              // หักพักเที่ยง (12:00-13:00) ถ้าระยะเวลาครอบคลุม
              if (startH < 12 && endH >= 13) {
                diff -= 1;
              }
              if (diff > 0) leaveHours += diff;
            }
          }
        } else {
          leaveHours += 4; // fallback
        }
      }
    }
  }
  const isLeave = leaveHours > 0;

  let leaveEntries: { type: string; hours: number; description?: string; timeRange?: string }[] | undefined = undefined;
  if (isLeave) {
    const lType = doc.leaveStatus?.leaveType || doc.leaveType || 'Leave';
    const shifts = doc.leaveStatus?.leaveShifts || doc.leaveShifts;
    const times  = doc.leaveStatus?.leaveTimes  || doc.leaveTimes;

    let desc      = 'Full Day';
    let timeRange: string | undefined = undefined;

    if (doc.leaveStatus?.isFullDay) {
      timeRange = '08:00-17:00';
    } else if (times?.custom) {
      desc      = times.custom;
      timeRange = times.custom.replace(/\s/g, ''); // normalise: "13:00 - 17:00" → "13:00-17:00"
    } else if (shifts?.morning) {
      desc      = 'Morning';
      timeRange = '08:00-12:00';
    } else if (shifts?.afternoon) {
      desc      = 'Afternoon';
      timeRange = '13:00-17:00';
    } else {
      desc = 'Partial';
    }

    leaveEntries = [{ type: lType, hours: leaveHours, description: desc, timeRange }];
  }

  let dailyReportPhotos: DailyTimesheetSummary['dailyReportPhotos'] = undefined;
  if (doc.photos?.laborByShift) {
    dailyReportPhotos = doc.photos.laborByShift;
  }

  let dailyReportPunches: string[] | undefined = undefined;
  if (doc.shiftTimes) {
    const punches: string[] = [];
    const extractPunches = (timeStr?: string) => {
      if (!timeStr) return;
      const parts = timeStr.split('-').map(s => s.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        punches.push(parts[0], parts[1]);
      }
    };
    if (doc.expectedShifts) {
      if (doc.expectedShifts.otMorning) extractPunches(doc.shiftTimes.otMorning);
      if (doc.expectedShifts.normal) extractPunches(doc.shiftTimes.day);
      if (doc.expectedShifts.otNoon) extractPunches(doc.shiftTimes.otNoon);
      if (doc.expectedShifts.otEvening) extractPunches(doc.shiftTimes.otEvening);
    } else {
      // Fallback if expectedShifts is somehow missing
      extractPunches(doc.shiftTimes.otMorning);
      extractPunches(doc.shiftTimes.day);
      extractPunches(doc.shiftTimes.otNoon);
      extractPunches(doc.shiftTimes.otEvening);
    }

    if (punches.length > 0) {
      punches.sort((a, b) => a.localeCompare(b));
      dailyReportPunches = punches;
    }
  }

  return {
    employeeNumber: doc.employeeNumber,
    date: doc.date,
    projectLocationId: doc.projectLocationId,
    regularHours,
    otMorningHours,
    otNoonHours,
    otEveningHours,
    totalHours,
    isActive: doc.isActive !== false,
    isLeave,
    leaveHours,
    leaveEntries,
    medCertFileUrl: doc.leaveStatus?.medCertFileUrl || doc.medCertFileUrl,
    assigneeId: doc.AssigneesID,
    dailyReportPhotos,
    dailyReportPunches,
    shiftTimes: doc.shiftTimes,
    workLogs: doc.workLogs || [],
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ProjectBDailyReportService {
  private db: admin.firestore.Firestore | null = null;
  private readonly APP_NAME = 'AfterSaleSystemApp';
  private readonly COLLECTION = 'DailyEmployeeTimesheets';

  constructor() {
    this.initSecondaryApp();
  }

  /**
   * Initialize secondary Firebase Admin instance using service account key
   */
  private initSecondaryApp() {
    try {
      const existingApp = admin.apps.find((app) => app?.name === this.APP_NAME);
      if (existingApp) {
        this.db = existingApp.firestore();
        return;
      }

      const keyPath = path.resolve(process.cwd(), '../keys/after-sale-system-621698fcd44f.json');

      if (!fs.existsSync(keyPath)) {
        console.warn(
          `[ProjectBDailyReportService] Service account key not found at ${keyPath}. ` +
            'Cross-project fetching will fail.',
        );
        return;
      }

      const serviceAccount = require(keyPath);
      const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, this.APP_NAME);
      this.db = app.firestore();
      console.log('[ProjectBDailyReportService] Connected to After-Sale-System (Project B)');
    } catch (error) {
      console.error('[ProjectBDailyReportService] Failed to initialize secondary app:', error);
    }
  }

  private ensureDb(): admin.firestore.Firestore {
    if (!this.db) throw new Error('Project B database connection is not initialized.');
    return this.db;
  }

  // =========================================================================
  // Doc ID helper
  // =========================================================================

  public generateDocId(employeeNumber: string, dateStr: string): string {
    return `${employeeNumber}_${dateStr}`;
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /**
   * ดึง timesheet ของพนักงานคนหนึ่งในวันที่หนึ่ง
   */
  public async getDailyTimesheet(
    employeeNumber: string,
    dateStr: string,
  ): Promise<DailyEmployeeTimesheet | null> {
    const db = this.ensureDb();
    const docId = this.generateDocId(employeeNumber, dateStr);
    const snap = await db.collection(this.COLLECTION).doc(docId).get();

    if (!snap.exists) return null;
    return snap.data() as DailyEmployeeTimesheet;
  }

  /**
   * ดึง timesheets ของพนักงานหลายคนในวันเดียวกัน (Bulk)
   * ใช้ Firestore 'in' query (max 30 per batch)
   */
  public async getBulkDailyTimesheets(
    employeeNumbers: string[],
    dateStr: string,
  ): Promise<Record<string, DailyEmployeeTimesheet>> {
    const db = this.ensureDb();
    if (employeeNumbers.length === 0) return {};

    const results: Record<string, DailyEmployeeTimesheet> = {};
    const collectionRef = db.collection(this.COLLECTION);
    const chunkSize = 30;

    for (let i = 0; i < employeeNumbers.length; i += chunkSize) {
      const chunk = employeeNumbers.slice(i, i + chunkSize);
      const docIds = chunk.map((emp) => this.generateDocId(emp, dateStr));

      const snap = await collectionRef
        .where(admin.firestore.FieldPath.documentId(), 'in', docIds)
        .get();

      snap.forEach((doc) => {
        const data = doc.data() as DailyEmployeeTimesheet;
        if (data.employeeNumber) {
          results[data.employeeNumber] = data;
        }
      });
    }

    return results;
  }

  /**
   * ดึง timesheets ทั้งหมดของ project ในช่วงวันที่ (สำหรับ Reconciliation)
   * @param projectLocationId - เช่น "WH1 : คลังสินค้า MOTORWAY"
   * @param startDate - YYYY-MM-DD
   * @param endDate   - YYYY-MM-DD
   */
  public async getTimesheetsByProjectAndDateRange(
    projectLocationId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyEmployeeTimesheet[]> {
    const db = this.ensureDb();

    // NOTE: ไม่ใช้ isActive filter ใน Firestore query เพราะต้องการ composite index ที่อาจยังไม่ถูกสร้าง — filter ใน memory แทน
    const snap = await db
      .collection(this.COLLECTION)
      .where('projectLocationId', '==', projectLocationId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return snap.docs
      .map((doc) => doc.data() as DailyEmployeeTimesheet)
      .filter((ts) => ts.isActive !== false || ts.leaveStatus != null || ts.leaveType != null || (ts.leave && ts.leave.length > 0));
  }

  /**
   * ดึง timesheets ทั้งหมดของวันที่หนึ่ง (ทุก project)
   * สำหรับ daily reconciliation batch
   */
  public async getTimesheetsByDate(dateStr: string): Promise<DailyEmployeeTimesheet[]> {
    const db = this.ensureDb();

    // NOTE: ไม่ใช้ isActive filter ใน Firestore query เพราะต้องการ composite index — filter ใน memory แทน
    const snap = await db
      .collection(this.COLLECTION)
      .where('date', '==', dateStr)
      .get();

    return snap.docs
      .map((doc) => doc.data() as DailyEmployeeTimesheet)
      .filter((ts) => ts.isActive !== false || ts.leaveStatus != null || ts.leaveType != null || (ts.leave && ts.leave.length > 0));
  }

  // =========================================================================
  // Summary helpers
  // =========================================================================

  /**
   * ดึง timesheets ทั้งหมดในช่วงวันที่ (ทุก project)
   */
  public async getTimesheetsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyEmployeeTimesheet[]> {
    const db = this.ensureDb();
    const snap = await db
      .collection(this.COLLECTION)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return snap.docs
      .map((doc) => doc.data() as DailyEmployeeTimesheet)
      .filter((ts) => ts.isActive !== false || ts.leaveStatus != null || ts.leaveType != null || (ts.leave && ts.leave.length > 0));
  }

  /**
   * ดึงและแปลงเป็น DailyTimesheetSummary[] (ทุก project)
   */
  public async getSummariesByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyTimesheetSummary[]> {
    const timesheets = await this.getTimesheetsByDateRange(startDate, endDate);
    return timesheets.map(toTimesheetSummary);
  }

  /**
   * ดึงและแปลงเป็น DailyTimesheetSummary[] พร้อมส่งให้ ReconciliationService
   */
  public async getSummariesByProjectAndDateRange(
    projectLocationId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyTimesheetSummary[]> {
    const timesheets = await this.getTimesheetsByProjectAndDateRange(
      projectLocationId,
      startDate,
      endDate,
    );
    return timesheets.map(toTimesheetSummary);
  }
}

export const projectBDailyReportService = new ProjectBDailyReportService();
