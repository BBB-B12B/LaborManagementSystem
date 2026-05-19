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
  ApprovalSource,
  StatusHistoryEntry,
  CreateReconciliationRecordInput,
  generateReconciliationId,
  reconciliationRecordConverter,
} from '../../models/ReconciliationRecord';
import { ScanEditEntry, generateScanDocId, scanDataConverter } from '../../models/ScanData';
import { COLLECTIONS } from '../../config/collections';
import {
  projectBDailyReportService,
  toTimesheetSummary,
} from '../external/ProjectBDailyReportService';
import { scanDataService } from '../scanData/ScanDataService';
import { dailyContractorService } from '../dailyContractor/DailyContractorService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'reconciliationRecords';
const SCAN_COLLECTION = 'scanData';



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * ดึง punch times (HH:mm) จาก ScanData document
 * Priority: punches → allScans (trim to HH:mm) → Time1-Time6
 * เหมือน logic ใน MatcherService — ใช้ร่วมกันทุกที่
 */
function extractScanPunches(data: Record<string, any>): string[] {
  // 1. punches (HH:mm) — primary field ที่ new imports เขียนไว้
  if (Array.isArray(data.punches) && data.punches.length > 0) {
    return data.punches as string[];
  }

  // 2. allScans (HH:mm:ss) — fallback สำหรับ docs เก่าที่ยังไม่มี punches
  if (Array.isArray(data.allScans) && data.allScans.length > 0) {
    return (data.allScans as string[]).map((t) => t.slice(0, 5));
  }

  // 3. Time1-Time6 — legacy fields จาก bulk import เก่า
  const times = [data.Time1, data.Time2, data.Time3, data.Time4, data.Time5, data.Time6]
    .filter((t): t is string => !!t && t !== '-' && t !== '');
  if (times.length > 0) {
    return times.map((t) => t.slice(0, 5));
  }

  return [];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationFilter {
  projectLocationId?: string;        // กรองตาม work location (โครงการที่ทำงานวันนั้น)
  allowedProjects?: string[];        // multi work-location filter
  homeProjectId?: string;            // กรองตามสังกัด — ใช้สำหรับ RBAC หลัก
  allowedHomeProjects?: string[];    // multi สังกัด — ใช้สำหรับ RBAC หลัก
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
  note?: string | null;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  isLate?: boolean;
  isEarlyLeave?: boolean;
  approvedNormalHours?: number;
  approvedOtMorning?: number;
  approvedOtNoon?: number;
  approvedOtEvening?: number;
  totalApprovedHours?: number;
  approvalSource?: ApprovalSource;
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

  private async getFallbackAssignee(employeeId: string): Promise<{ id: string; name: string } | null> {
    try {
      let targetDoc = await this.db.collection('dailyContractors').doc(`DC-${employeeId}`).get();
      if (!targetDoc.exists) {
        targetDoc = await this.db.collection('dailyContractors').doc(employeeId).get();
        if (!targetDoc.exists) {
          const qSnap = await this.db.collection('dailyContractors').where('employeeId', '==', employeeId).limit(1).get();
          if (qSnap.empty) return null;
          targetDoc = qSnap.docs[0];
        }
      }
      const data = targetDoc.data();
      if (!data?.foremanUsage) return null;

      let maxCount = -1;
      let maxAssigneeId: string | null = null;
      let maxAssigneeName: string | null = null;

      for (const [foremanId, usage] of Object.entries(data.foremanUsage)) {
        const u = usage as { count: number; name: string };
        if (u.count > maxCount) {
          maxCount = u.count;
          maxAssigneeId = foremanId;
          maxAssigneeName = u.name;
        }
      }

      if (maxAssigneeId && maxCount > 0) {
        let finalName = maxAssigneeName;
        if (!finalName || finalName === 'Unknown') {
          try {
            const userSnap = await this.db.collection('users').where('Employeeid', '==', maxAssigneeId).limit(1).get();
            if (!userSnap.empty) {
              const uData = userSnap.docs[0].data();
              finalName = uData['Fullname'] || uData['name'] || uData['fullNameEn'] || uData['Fullnameen'] || 'Unknown';
            }
          } catch { /* ignore */ }
        }
        return { id: maxAssigneeId, name: finalName || 'Unknown' };
      }
    } catch (err) {
      console.error(`[ReconciliationService.getFallbackAssignee] Error for ${employeeId}:`, err);
    }
    return null;
  }

  /**
   * แปลง HH:mm เป็นจำนวนนาทีจากเที่ยงคืน
   */
  private punchToMinutes(punch: string): number {
    const [h, m] = punch.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }



  /**
   * [PRIMARY] กำหนดสถานะโดยเปรียบเทียบจาก Segments
   * ใช้ shiftTimes เป็น source of truth ในการสร้างช่วงเวลาที่ควรจะมีการสแกน
   */
  classifyBySegments(params: {
    shiftTimes?: { day?: string; otMorning?: string; otNoon?: string; otEvening?: string; };
    scanPunches: string[];
    timesheetNormalHours?: number;
    timesheetOtMorning?: number;
    timesheetOtNoon?: number;
    timesheetOtEvening?: number;
    dailyReportHours?: number;
    isHoliday?: boolean;
    isLeave?: boolean;
    leaveHours?: number;
  }): ClassifyResult {
    const {
      shiftTimes,
      scanPunches,
      timesheetNormalHours,
      timesheetOtMorning,
      timesheetOtNoon,
      timesheetOtEvening,
      dailyReportHours,
      isHoliday,
      isLeave,
      leaveHours,
    } = params;

    const scanCount = (scanPunches || []).length;

    // --- Base cases ---
    const isFullDayLeave = isLeave === true && (leaveHours ?? 0) >= 8;
    const isPartialLeave = isLeave === true && (leaveHours ?? 0) > 0 && (leaveHours ?? 0) < 8;
    const noWorkHours = !dailyReportHours || dailyReportHours === 0;
    
    const dailyWorkExists = !!shiftTimes?.day || (dailyReportHours !== undefined && dailyReportHours > 0);
    const dailyExists = dailyWorkExists || isPartialLeave;

    if (isFullDayLeave && noWorkHours) {
      return { status: 'LEAVE' };
    }

    if (isHoliday && noWorkHours) {
      if (scanCount > 0) {
        return { status: 'CONFLICTED', suggestedHours: 0, note: `วันหยุดแต่พบข้อมูลการสแกนนิ้ว (${scanCount} ครั้ง)` };
      }
      return { status: 'HOLIDAY' };
    }

    if (isPartialLeave && !dailyWorkExists) {
      if (scanCount > 0) {
        return { status: 'CONFLICTED', suggestedHours: 0, note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ และพบข้อมูลสแกนนิ้ว (${scanCount} ครั้ง)` };
      }
      return { status: 'MISSING_DAILY', suggestedHours: 0, note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ` };
    }

    if (!dailyExists && scanCount === 0) return { status: 'ABSENT' };
    if (!dailyExists && scanCount > 0) return { status: 'MISSING_DAILY' };
    
    if (dailyExists && scanCount === 0) {
      return { status: 'MISSING_SCAN', suggestedHours: 0, note: 'ไม่พบข้อมูลการสแกนนิ้ว' };
    }
    
    if (dailyExists && scanCount === 1) {
      return { status: 'CONFLICTED', suggestedHours: 0, note: `ข้อมูลสแกนนิ้วไม่เพียงพอ (พบเพียงครั้งเดียว: ${scanPunches[0]}) — Admin ต้องเติมเวลาที่ขาด` };
    }

    if (!shiftTimes || !shiftTimes.day) {
      return { status: 'MISSING_DAILY', note: 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)' };
    }

    // --- Parse Segments ---
    const parseTime = (timeStr?: string): { start: number; end: number } | null => {
      if (!timeStr) return null;
      const parts = timeStr.split('-').map(s => s.trim());
      if (parts.length !== 2) return null;
      return { start: this.punchToMinutes(parts[0]), end: this.punchToMinutes(parts[1]) };
    };

    const segments: { start: number; end: number; type: string }[] = [];
    const dayShift = parseTime(shiftTimes.day);
    const otMorning = parseTime(shiftTimes.otMorning);
    const otNoon = parseTime(shiftTimes.otNoon);
    const otEvening = parseTime(shiftTimes.otEvening);

    if (!dayShift) {
       return { status: 'MISSING_DAILY', note: 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)' };
    }

    if (otMorning) {
      segments.push({ start: otMorning.start, end: otMorning.end, type: 'otMorning' });
    }

    const hasOtNoon = !!otNoon;
    const hasOtEveningConnected = otEvening && otEvening.start === dayShift.end;

    if (hasOtNoon) {
      segments.push({ start: dayShift.start, end: dayShift.end, type: 'normal' });
    } else {
      if (dayShift.end <= 12 * 60) {
        segments.push({ start: dayShift.start, end: dayShift.end, type: 'morning' });
      } else if (dayShift.start >= 13 * 60) {
        if (hasOtEveningConnected) {
          segments.push({ start: dayShift.start, end: otEvening.end, type: 'combined_afternoon_evening' });
        } else {
          segments.push({ start: dayShift.start, end: dayShift.end, type: 'afternoon' });
        }
      } else {
        segments.push({ start: dayShift.start, end: 12 * 60, type: 'morning' });
        if (hasOtEveningConnected) {
          segments.push({ start: 13 * 60, end: otEvening.end, type: 'combined_afternoon_evening' });
        } else {
          segments.push({ start: 13 * 60, end: dayShift.end, type: 'afternoon' });
        }
      }
    }

    if (otEvening) {
      if (!(hasOtEveningConnected && !hasOtNoon)) {
        segments.push({ start: otEvening.start, end: otEvening.end, type: 'otEvening' });
      }
    }

    // --- Segment Checking ---
    const sortedScans = scanPunches.map(p => this.punchToMinutes(p)).sort((a, b) => a - b);
    
    let isConflicted = false;
    let conflictNote = '';
    let maxLateMinutes = 0;
    let maxEarlyLeaveMinutes = 0;
    let penaltyOtMorning = 0;
    let penaltyOtEvening = 0;

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60).toString().padStart(2, '0');
      const m = (mins % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const usedPunches = new Set<number>();

    const conflictNotes: string[] = [];

    for (const seg of segments) {
      const available = sortedScans.filter(t => !usedPunches.has(t));

      let closestIn = -1;
      let minInDiff = Infinity;
      for (const t of available) {
        if (t > seg.end) continue;
        const diff = Math.abs(t - seg.start);
        if (diff < minInDiff) { minInDiff = diff; closestIn = t; }
        else if (diff === minInDiff && t < closestIn) { closestIn = t; }
      }

      let closestOut = -1;
      let minOutDiff = Infinity;
      for (const t of available) {
        if (t <= closestIn) continue;
        const diff = Math.abs(t - seg.end);
        if (diff < minOutDiff) { minOutDiff = diff; closestOut = t; }
        else if (diff === minOutDiff && t > closestOut) { closestOut = t; }
      }

      if (closestIn !== -1) usedPunches.add(closestIn);
      // Only mark closestOut as "used" if it is NOT the exact start of the next segment
      // (boundary-shared punch: e.g. 08:00 is both OUT of otMorning and IN of morning)
      if (closestOut !== -1) {
        const segIndex = segments.indexOf(seg);
        const nextSeg = segments[segIndex + 1];
        const isBoundaryShared = nextSeg && closestOut === nextSeg.start;
        if (!isBoundaryShared) {
          usedPunches.add(closestOut);
        }
      }

      if (closestIn === -1 || minInDiff > 90) {
        isConflicted = true;
        conflictNotes.push(`ไม่พบสแกน IN สำหรับ segment ${formatTime(seg.start)}–${formatTime(seg.end)}`);
        continue;
      }
      if (closestOut === -1 || minOutDiff > 90) {
        isConflicted = true;
        conflictNotes.push(`ไม่พบสแกน OUT สำหรับ segment ${formatTime(seg.start)}–${formatTime(seg.end)}`);
        continue;
      }

      const late = closestIn - seg.start;
      const early = seg.end - closestOut;

      if (late > 30) {
        isConflicted = true;
        conflictNotes.push(`สแกนเข้าสายเกิน 30 นาทีในรอบ ${formatTime(seg.start)} (${late} นาที)`);
      }
      if (early > 30) {
        isConflicted = true;
        conflictNotes.push(`สแกนออกก่อนเกิน 30 นาทีในรอบ ${formatTime(seg.end)} (${early} นาที)`);
      }

      if (late > 0) {
        maxLateMinutes = Math.max(maxLateMinutes, late);
        if (seg.type === 'otMorning') penaltyOtMorning += late;
      }
      if (early > 0) {
        maxEarlyLeaveMinutes = Math.max(maxEarlyLeaveMinutes, early);
        if (seg.type === 'otEvening' || seg.type === 'combined_afternoon_evening') {
          penaltyOtEvening += early;
        }
      }
    }

    if (conflictNotes.length > 0) {
      conflictNote = conflictNotes.join(', ');
    }

    if (isConflicted) {
      return {
        status: 'CONFLICTED',
        suggestedHours: dailyReportHours,
        approvedNormalHours: timesheetNormalHours,
        approvedOtMorning: timesheetOtMorning,
        approvedOtNoon: timesheetOtNoon,
        approvedOtEvening: timesheetOtEvening,
        totalApprovedHours: (timesheetNormalHours || 0) + (timesheetOtMorning || 0) + (timesheetOtNoon || 0) + (timesheetOtEvening || 0),
        approvalSource: 'daily_report',
        lateMinutes: maxLateMinutes,
        earlyLeaveMinutes: maxEarlyLeaveMinutes,
        isLate: maxLateMinutes > 0,
        isEarlyLeave: maxEarlyLeaveMinutes > 0,
        note: conflictNote
      };
    }

    // --- MATCHED Case ---
    let approvedNormal = timesheetNormalHours ?? dailyReportHours ?? 0;
    let approvedMorning = timesheetOtMorning ?? 0;
    let approvedNoon = timesheetOtNoon ?? 0;
    let approvedEvening = timesheetOtEvening ?? 0;
    let autoNote = '';

    if (penaltyOtMorning > 0 && approvedMorning > 0) {
      const penaltyMins = Math.ceil(penaltyOtMorning / 30) * 30;
      approvedMorning = Math.max(0, approvedMorning - (penaltyMins / 60));
      autoNote += `สายช่วง OT เช้า ${penaltyOtMorning} นาที (หัก ${penaltyMins} นาที) `;
    }

    if (penaltyOtEvening > 0 && approvedEvening > 0) {
      const penaltyMins = Math.ceil(penaltyOtEvening / 30) * 30;
      approvedEvening = Math.max(0, approvedEvening - (penaltyMins / 60));
      autoNote += `ออกก่อนช่วง OT เย็น ${penaltyOtEvening} นาที (หัก ${penaltyMins} นาที) `;
    }

    const totalApproved = approvedNormal + approvedMorning + approvedNoon + approvedEvening;

    return {
      status: 'MATCHED',
      suggestedHours: dailyReportHours,
      approvedNormalHours: approvedNormal,
      approvedOtMorning: approvedMorning,
      approvedOtNoon: approvedNoon,
      approvedOtEvening: approvedEvening,
      totalApprovedHours: totalApproved,
      approvalSource: 'daily_report',
      lateMinutes: maxLateMinutes,
      earlyLeaveMinutes: maxEarlyLeaveMinutes,
      isLate: maxLateMinutes > 0,
      isEarlyLeave: maxEarlyLeaveMinutes > 0,
      note: autoNote || null,
    };
  }

  /**
   * [PRIMARY] กำหนดสถานะโดยเปรียบ punch coverage
   * เอา dailyReportPunches เป็น source of truth
   * เช็คว่า scan ครอบช่วงเวลาทำงานทั้งหมดไหม (รวม OT)
   *
   * CONFLICTED: มี OT (เช้า/เย็น) แต่ scan ไม่ครอบ boundary ของ OT
   * MATCHED:    ทุกกรณีอื่น + เก็บ lateMinutes / earlyLeaveMinutes
   */
  classifyByPunchCoverage(params: {
    dailyReportPunches: string[];
    scanPunches: string[];
    timesheetNormalHours?: number;
    timesheetOtMorning?: number;
    timesheetOtNoon?: number;
    timesheetOtEvening?: number;
    dailyReportHours?: number;   // ใช้เป็น suggestedHours
    isHoliday?: boolean;
    isLeave?: boolean;
    leaveHours?: number;          // จำนวนชั่วโมงที่ลา (ใช้แยกลาเต็มวัน vs บางส่วน)
  }): ClassifyResult {
    const {
      dailyReportPunches,
      scanPunches,
      timesheetNormalHours,
      timesheetOtMorning,
      timesheetOtNoon,
      timesheetOtEvening,
      dailyReportHours,
      isHoliday,
      isLeave,
      leaveHours,
    } = params;

    const dailyPunchesValid = Array.isArray(dailyReportPunches) && dailyReportPunches.length >= 2;
    const scanCount = (scanPunches || []).length;
    const scanValid = scanCount >= 2;

    // --- Base cases ---
    // ลาเต็มวัน = ลา >= 8 ชั่วโมง (8 ชม. ปกติ ไม่นับ OT)
    const isFullDayLeave = isLeave === true && (leaveHours ?? 0) >= 8;
    // ลาบางส่วน = มี leaveHours แต่ < 8 → ยังต้องทำงานบางส่วน
    const isPartialLeave = isLeave === true && (leaveHours ?? 0) > 0 && (leaveHours ?? 0) < 8;
    const noWorkHours = !dailyReportHours || dailyReportHours === 0;
    
    // ตรวจสอบว่ามีการลง "งาน" (Work) ใน Daily Report หรือยัง
    const dailyWorkExists = dailyPunchesValid || (dailyReportHours !== undefined && dailyReportHours > 0);
    
    // ถ้าลาบางส่วน ให้ถือว่า daily report มีอยู่เสมอ (แม้จะเป็นแค่ข้อมูลลา)
    const dailyExists = dailyWorkExists || isPartialLeave;

    // 1. ลาเต็มวัน (>= 8 ชั่วโมง) และไม่มีชั่วโมงทำงานเลย (รวม OT)
    if (isFullDayLeave && noWorkHours) {
      return { status: 'LEAVE' };
    }

    // 2. ถ้าเป็นวันหยุดและไม่มีชั่วโมงทำงาน (ไม่มาทำ OT)
    if (isHoliday && noWorkHours) {
      if (scanCount > 0) {
        return { 
          status: 'CONFLICTED', 
          suggestedHours: 0,
          note: `วันหยุดแต่พบข้อมูลการสแกนนิ้ว (${scanCount} ครั้ง)`
        };
      }
      return { status: 'HOLIDAY' };
    }

    // 3. กรณีลาบางส่วน แต่ไม่มีการลงเวลาทำงานใน Daily Report (Incomplete Report)
    if (isPartialLeave && !dailyWorkExists) {
      if (scanCount > 0) {
        return { 
          status: 'CONFLICTED', 
          suggestedHours: 0,
          note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ และพบข้อมูลสแกนนิ้ว (${scanCount} ครั้ง)` 
        };
      }
      return { 
        status: 'MISSING_DAILY', 
        suggestedHours: 0,
        note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ` 
      };
    }

    // 3. Fallback สำหรับ Base cases ปกติ
    if (!dailyExists && !scanValid) {
      return { status: 'ABSENT' };
    }
    if (!dailyExists && scanValid) return { status: 'MISSING_DAILY' };
    if (dailyExists && !scanValid) {
      // กรณีมี daily แต่สแกนไม่พอ
      if (scanCount === 0) {
        return { 
          status: 'MISSING_SCAN', 
          suggestedHours: 0,
          note: 'ไม่พบข้อมูลการสแกนนิ้ว'
        };
      } else {
        // มี 1 ครั้ง -> CONFLICTED (กรณี B)
        return { 
          status: 'CONFLICTED', 
          suggestedHours: 0,
          note: `ข้อมูลสแกนนิ้วไม่เพียงพอ (พบเพียงครั้งเดียว: ${scanPunches[0]}) — Admin ต้องเติมเวลาที่ขาด`
        };
      }
    }

    // --- Punch Coverage Check ---
    if (!dailyPunchesValid) {
      return { status: 'MISSING_DAILY', note: 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)' };
    }

    // หาจุดเริ่มและจุดจบที่ขอมา (รวม OT ทุกช่วง)
    const sortedReportPunches = [...dailyReportPunches].sort();
    const reportStart = this.punchToMinutes(sortedReportPunches[0]);
    const reportEnd   = this.punchToMinutes(sortedReportPunches[sortedReportPunches.length - 1]);

    // หาจุดสแกนจริง (หัว-ท้าย) — ไม่สนใจจำนวนสแกนตรงกลาง
    const sortedScan = [...(scanPunches || [])].sort();
    const scanFirstIn  = this.punchToMinutes(sortedScan[0]);
    const scanLastOut  = this.punchToMinutes(sortedScan[sortedScan.length - 1]);

    const lateMinutes       = Math.max(0, scanFirstIn - reportStart);
    const earlyLeaveMinutes = Math.max(0, reportEnd - scanLastOut);

    // --- CONFLICT Threshold (30 นาที) ---
    // ไม่ว่าจะเป็นเวลาปกติ หรือ OT ถ้าสาย/ออกก่อนเกิน 30 นาที -> CONFLICTED (กรณี A)
    const CONFLICT_THRESHOLD = 30;
    const isLateConflict = lateMinutes > CONFLICT_THRESHOLD;
    const isEarlyLeaveConflict = earlyLeaveMinutes > CONFLICT_THRESHOLD;

    if (isLateConflict || isEarlyLeaveConflict) {
      return {
        status: 'CONFLICTED',
        lateMinutes,
        earlyLeaveMinutes,
        isLate: isLateConflict,
        isEarlyLeave: isEarlyLeaveConflict,
        note: isEarlyLeaveConflict
          ? `ออกก่อนเกิน ${CONFLICT_THRESHOLD} นาที (${earlyLeaveMinutes} นาที) — ต้องตรวจสอบ Daily Report`
          : `สายเกิน ${CONFLICT_THRESHOLD} นาที (${lateMinutes} นาที) — ต้องตรวจสอบ Daily Report`,
      };
    }

    // --- MATCHED Case ---
    // เมื่อผ่านการเช็ค Conflict มาได้ (สาย/ออกก่อน <= 30 นาที)
    let approvedNormalHours = timesheetNormalHours ?? dailyReportHours ?? 0;
    let approvedOtMorning = timesheetOtMorning ?? 0;
    let approvedOtNoon = timesheetOtNoon ?? 0;
    let approvedOtEvening = timesheetOtEvening ?? 0;
    let autoNote = '';

    // Auto-Penalty สำหรับ OT (ถ้าสาย/ออกก่อนไม่เกิน 30 นาที)
    const isLateForOT = lateMinutes > 0 && (timesheetOtMorning ?? 0) > 0;
    const isEarlyLeaveFromOT = earlyLeaveMinutes > 0 && (timesheetOtEvening ?? 0) > 0;

    if (isLateForOT) {
      const penaltyMins = Math.ceil(lateMinutes / 30) * 30;
      approvedOtMorning = Math.max(0, (timesheetOtMorning ?? 0) - (penaltyMins / 60));
      autoNote += `สายช่วง OT เช้า ${lateMinutes} นาที (หัก ${penaltyMins} นาที) `;
    }

    if (isEarlyLeaveFromOT) {
      const penaltyMins = Math.ceil(earlyLeaveMinutes / 30) * 30;
      approvedOtEvening = Math.max(0, (timesheetOtEvening ?? 0) - (penaltyMins / 60));
      autoNote += `ออกก่อนช่วง OT เย็น ${earlyLeaveMinutes} นาที (หัก ${penaltyMins} นาที) `;
    }

    // หมายเหตุ: สำหรับเวลาปกติ (08:00-17:00) ไม่ต้องหัก approvedNormalHours เพราะระบบ HR จัดการเอง

    const totalApproved = approvedNormalHours + approvedOtMorning + approvedOtNoon + approvedOtEvening;

    return {
      status: 'MATCHED',
      suggestedHours: dailyReportHours,
      approvedNormalHours,
      approvedOtMorning,
      approvedOtNoon,
      approvedOtEvening,
      totalApprovedHours: totalApproved,
      approvalSource: 'daily_report',
      lateMinutes,
      earlyLeaveMinutes,
      isLate: lateMinutes > 0,
      isEarlyLeave: earlyLeaveMinutes > 0,
      note: autoNote || null,
    };
  }

  // =========================================================================
  // CRUD
  // =========================================================================

  /**
   * รวมข้อมูลและหาผลลัพธ์ของ Status ก่อนเขียนลง Database (ไม่ต้องดึงจาก DB เอง)
   */
  private mergeAndClassify(
    input: CreateReconciliationRecordInput,
    existing: ReconciliationRecord | undefined,
    now: Date,
    isHoliday?: boolean,
    isLeave?: boolean,
  ): Partial<ReconciliationRecord> | null {
    if (!existing) {
      // สร้างใหม่
      const isLeaveCalculated = input.leaveHours !== undefined ? input.leaveHours > 0 : undefined;
      const classified = this.classifyByPunchCoverage({
        dailyReportPunches: input.dailyReportPunches ?? [],
        scanPunches: input.scanPunches ?? [],
        timesheetNormalHours: input.timesheetNormalHours,
        timesheetOtMorning: input.timesheetOtMorning,
        timesheetOtNoon: input.timesheetOtNoon,
        timesheetOtEvening: input.timesheetOtEvening,
        dailyReportHours: input.dailyReportHours,
        isHoliday: input.isHoliday ?? isHoliday,
        isLeave: isLeaveCalculated ?? isLeave,
        leaveHours: input.leaveHours,
      });

      const historyEntry: StatusHistoryEntry = {
        status: classified.status,
        changedAt: now,
        changedBy: 'system',
        reason: 'สร้างอัตโนมัติโดยระบบ',
        note: classified.note,
      };

      return {
        ...input,
        status: classified.status,
        suggestedHours: classified.suggestedHours,
        approvedNormalHours: classified.approvedNormalHours,
        approvedOtMorning: classified.approvedOtMorning,
        approvedOtNoon: classified.approvedOtNoon,
        approvedOtEvening: classified.approvedOtEvening,
        totalApprovedHours: classified.totalApprovedHours,
        approvalSource: classified.approvalSource,
        lateMinutes: classified.lateMinutes,
        earlyLeaveMinutes: classified.earlyLeaveMinutes,
        isLate: classified.isLate,
        isEarlyLeave: classified.isEarlyLeave,
        note: classified.note,
        statusHistory: [historyEntry],
        createdAt: now,
        updatedAt: now,
        hasLeave: (isLeaveCalculated ?? isLeave) === true,
        assigneeId: input.assigneeId,
        assigneeName: input.assigneeName,
      };
    }

    // ถ้างวดงานถูกล็อกแล้ว (isLocked: true) ไม่ต้อง re-classify
    if (existing.isLocked === true) {
      return null; // ข้ามการทำงาน
    }



    const isLeaveCalculated = input.leaveHours !== undefined ? input.leaveHours > 0 : undefined;
    const effectiveIsHoliday = input.isHoliday ?? isHoliday ?? existing.isHoliday;
    const effectiveIsLeave = isLeaveCalculated ?? isLeave ?? (existing.leaveHours !== undefined ? existing.leaveHours > 0 : undefined);

    // เลือก punch data ที่ดีที่สุด — ใช้ input ถ้ามี มิฉะนั้น fallback existing
    const effectiveDailyPunches = (input.dailyReportPunches?.length ?? 0) > 0
      ? input.dailyReportPunches!
      : (existing.dailyReportPunches ?? []);
    const effectiveScanPunches = (input.scanPunches?.length ?? 0) > 0
      ? input.scanPunches!
      : (existing.scanPunches ?? []);
      
    const inputShiftTimes = input.shiftTimes ?? existing?.shiftTimes;

    let classified: ClassifyResult;
    
    if (inputShiftTimes && inputShiftTimes.day) {
      classified = this.classifyBySegments({
        shiftTimes: inputShiftTimes,
        scanPunches: effectiveScanPunches,
        timesheetNormalHours: input.timesheetNormalHours ?? existing.timesheetNormalHours,
        timesheetOtMorning: input.timesheetOtMorning ?? existing.timesheetOtMorning,
        timesheetOtNoon: input.timesheetOtNoon ?? existing.timesheetOtNoon,
        timesheetOtEvening: input.timesheetOtEvening ?? existing.timesheetOtEvening,
        dailyReportHours: input.dailyReportHours ?? existing.dailyReportHours,
        isHoliday: effectiveIsHoliday,
        isLeave: effectiveIsLeave,
        leaveHours: input.leaveHours ?? existing.leaveHours,
      });
    } else {
      // Fallback for legacy data that doesn't have shiftTimes
      classified = this.classifyByPunchCoverage({
        dailyReportPunches: effectiveDailyPunches,
        scanPunches: effectiveScanPunches,
        timesheetNormalHours: input.timesheetNormalHours ?? existing.timesheetNormalHours,
        timesheetOtMorning: input.timesheetOtMorning ?? existing.timesheetOtMorning,
        timesheetOtNoon: input.timesheetOtNoon ?? existing.timesheetOtNoon,
        timesheetOtEvening: input.timesheetOtEvening ?? existing.timesheetOtEvening,
        dailyReportHours: input.dailyReportHours ?? existing.dailyReportHours,
        isHoliday: effectiveIsHoliday,
        isLeave: effectiveIsLeave,
        leaveHours: input.leaveHours ?? existing.leaveHours,
      });
    }

    const newStatus = classified.status;
    const statusChanged = newStatus !== existing.status;

    const updates: Partial<ReconciliationRecord> = {
      projectLocationId: input.projectLocationId,
      homeProjectId: input.homeProjectId ?? existing.homeProjectId,
      workLocationIds: input.workLocationIds ?? existing.workLocationIds,
      employeeName: input.employeeName ?? existing.employeeName,
      // Daily-report side
      dailyReportHours:       input.dailyReportHours      ?? existing.dailyReportHours,
      timesheetNormalHours:   input.timesheetNormalHours  ?? existing.timesheetNormalHours,
      timesheetOtMorning:     input.timesheetOtMorning    ?? existing.timesheetOtMorning,
      timesheetOtNoon:        input.timesheetOtNoon        ?? existing.timesheetOtNoon,
      timesheetOtEvening:     input.timesheetOtEvening    ?? existing.timesheetOtEvening,
      dailyReportId:          input.dailyReportId         ?? existing.dailyReportId,
      dailyReportPhotos:      input.dailyReportPhotos     ?? existing.dailyReportPhotos,
      dailyReportPunches:     input.dailyReportPunches    ?? existing.dailyReportPunches,
      // Scan-data side
      scanDataHours:          input.scanDataHours         ?? existing.scanDataHours,
      scanNormalHours:        input.scanNormalHours       ?? existing.scanNormalHours,
      scanOtMorningHours:     input.scanOtMorningHours   ?? existing.scanOtMorningHours,
      scanOtNoonHours:        input.scanOtNoonHours       ?? existing.scanOtNoonHours,
      scanOtEveningHours:     input.scanOtEveningHours   ?? existing.scanOtEveningHours,
      scanDataId:             input.scanDataId            ?? existing.scanDataId,
      scanPunches:            input.scanPunches           ?? existing.scanPunches,
      // Classify result
      suggestedHours:         classified.suggestedHours,
      status:                 newStatus,
      approvedNormalHours:    classified.approvedNormalHours,
      approvedOtMorning:      classified.approvedOtMorning,
      approvedOtNoon:         classified.approvedOtNoon,
      approvedOtEvening:      classified.approvedOtEvening,
      totalApprovedHours:     classified.totalApprovedHours,
      approvalSource:         classified.approvalSource,
      lateMinutes:            classified.lateMinutes       ?? 0,
      earlyLeaveMinutes:      classified.earlyLeaveMinutes  ?? 0,
      isLate:                 classified.isLate            ?? false,
      isEarlyLeave:           classified.isEarlyLeave      ?? false,
      note:                   classified.note,
      updatedAt:              now,
      hasLeave:               effectiveIsLeave === true,
      assigneeId:             input.assigneeId    ?? existing.assigneeId,
      assigneeName:           input.assigneeName  ?? existing.assigneeName,
    };

    if (input.isHoliday !== undefined) updates.isHoliday = input.isHoliday;
    else if (isHoliday !== undefined) updates.isHoliday = isHoliday;

    if (input.leaveHours !== undefined) updates.leaveHours = input.leaveHours;
    if (input.leaveEntries !== undefined) updates.leaveEntries = input.leaveEntries;
    if (input.medCertFileUrl !== undefined) updates.medCertFileUrl = input.medCertFileUrl;

    if (statusChanged) {
      const newEntry: StatusHistoryEntry = {
        status: newStatus,
        changedAt: now,
        changedBy: 'system',
        reason: 'Re-classify อัตโนมัติหลังได้รับข้อมูลใหม่',
        note: classified.note,
      };

      // สร้าง array ใหม่ต่อท้ายของเดิม สำหรับ return object ให้ไปแปลงเป็น arrayUnion ในตอน set/update ทีหลัง
      // ในกรณีนี้จะ return เป็น Object array แบบสมบูรณ์ เพื่อให้ใช้กับ bulkWriter หรือ update ได้
      (updates as any).statusHistory = existing.statusHistory ? [...existing.statusHistory, newEntry] : [newEntry];
    }

    const abnormalStatuses: ReconciliationStatus[] = [
      'CONFLICTED', 'MISSING_SCAN', 'MISSING_DAILY', 'ABSENT', 'UNREGISTERED_EMPLOYEE',
    ];
    const normalStatuses: ReconciliationStatus[] = ['MATCHED', 'LEAVE', 'HOLIDAY'];

    if (abnormalStatuses.includes(newStatus)) {
      (updates as any).resolvedAt = null;
      (updates as any).resolvedBy = null;
    } else if (normalStatuses.includes(newStatus)) {
      const wasEverAbnormal =
        abnormalStatuses.includes(existing.status) ||
        existing.statusHistory.some((h) => abnormalStatuses.includes(h.status));

      if (wasEverAbnormal && !existing.resolvedAt) {
        (updates as any).resolvedAt = now;
      }
    }

    return updates;
  }

  /**
   * สร้างหรืออัปเดต ReconciliationRecord (แบบทีละ Record)
   * ใช้สำหรับการทำงานแบบ Real-time
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

    const existing = snap.exists ? reconciliationRecordConverter.fromFirestore(snap) : undefined;
    const resultData = this.mergeAndClassify(input, existing, now, isHoliday, isLeave);

    if (!resultData) {
      return existing!;
    }

    if (!existing) {
      await ref.set(reconciliationRecordConverter.toFirestore(resultData as any));
      return { id, ...resultData } as ReconciliationRecord;
    } else {
      // update
      await ref.update(reconciliationRecordConverter.toFirestore(resultData as any));
      return { ...existing, ...resultData } as ReconciliationRecord;
    }
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
    const isAllProjects = projectLocationId === 'all';

    // 1. ดึง Daily Report summaries จาก Project B
    const dailySummaries = isAllProjects
      ? await projectBDailyReportService.getSummariesByDateRange(startDate, endDate)
      : await projectBDailyReportService.getSummariesByProjectAndDateRange(
          projectLocationId,
          startDate,
          endDate,
        );

    // 2. ดึง Scan Data จาก Local Firestore
    const scanRecords = isAllProjects
      ? await scanDataService.getByDateRange(new Date(startDate), new Date(endDate))
      : await scanDataService.getByProjectAndDate(
          projectLocationId,
          new Date(startDate),
          new Date(endDate),
        );

    // 2.5 ดึง existing Reconciliation Records มาทั้งหมดในช่วงนี้
    let query = this.db.collection(COLLECTION)
      .where('workDate', '>=', startDate)
      .where('workDate', '<=', endDate);
    
    if (!isAllProjects) {
      query = query.where('projectLocationId', '==', projectLocationId);
    }

    const existingRecordsSnap = await query.get();
    
    const existingMap = new Map<string, ReconciliationRecord>();
    existingRecordsSnap.docs.forEach((doc) => {
      existingMap.set(doc.id, reconciliationRecordConverter.fromFirestore(doc as any));
    });

    // 3. สร้าง Map ของ Scan Data: key = "{employeeId}_{workDate}"
    const scanMap = new Map<string, { 
      hours: number; 
      id: string; 
      punches: string[];
      name?: string;
      scanNormalHours?: number;
      scanOtMorningHours?: number;
      scanOtNoonHours?: number;
      scanOtEveningHours?: number;
    }>();

    const addToScanMap = (scan: any) => {
      const dateKey =
        scan.scanDate ||
        (scan.workDate instanceof Date
          ? scan.workDate.toISOString().split('T')[0]
          : String(scan.workDate).split('T')[0]);
      const key = `${scan.employeeId}_${dateKey}`;
      const totalScanHours =
        (scan.regularHours ?? 0) +
        (scan.otMorningHours ?? 0) +
        (scan.otNoonHours ?? 0) +
        (scan.otEveningHours ?? 0);
      scanMap.set(key, { 
        hours: totalScanHours, 
        id: scan.id,
        punches: extractScanPunches(scan as any),
        name: scan.name,
        scanNormalHours: scan.regularHours,
        scanOtMorningHours: scan.otMorningHours,
        scanOtNoonHours: scan.otNoonHours,
        scanOtEveningHours: scan.otEveningHours
      });
    };

    for (const scan of scanRecords) {
      if (scan.isDeleted) continue;
      addToScanMap(scan);
    }

    // 3.1 ตรวจหา Cross-Project Scans: 
    // ถ้าพนักงานมี Daily Report ในโครงการนี้ แต่ไม่มี Scan Record ที่ระบุโครงการนี้ 
    // ให้ลองดึงข้อมูลสแกนด้วย ID (SCAN_{empId}_{date}) เผื่อเขาสแกนไว้ที่โครงการอื่น
    const crossProjectTargets: { empId: string, date: string }[] = [];
    for (const summary of dailySummaries) {
      const key = `${summary.employeeNumber}_${summary.date}`;
      if (!scanMap.has(key)) {
        crossProjectTargets.push({ empId: summary.employeeNumber, date: summary.date });
      }
    }

    if (crossProjectTargets.length > 0) {
      console.log(`[ReconciliationService] Checking ${crossProjectTargets.length} potential cross-project scans...`);
      // Batch fetch by IDs (db.getAll() is efficient)
      const BATCH_SIZE = 100;
      for (let i = 0; i < crossProjectTargets.length; i += BATCH_SIZE) {
        const batch = crossProjectTargets.slice(i, i + BATCH_SIZE);
        const refs = batch.map(t => this.db.collection(SCAN_COLLECTION).doc(generateScanDocId(t.empId, t.date)));
        const snaps = await this.db.getAll(...refs);
        snaps.forEach(snap => {
          if (snap.exists && !snap.data()?.isDeleted) {
            addToScanMap({ id: snap.id, ...snap.data() });
          }
        });
      }
    }


    const writer = this.db.bulkWriter();
    let succeeded = 0;
    let failed = 0;
    // หยุด retry หลัง 3 ครั้ง และ log error ออกมา เพื่อป้องกัน silent hang
    writer.onWriteError((error) => {
      console.error(
        `[ReconciliationService][BulkWriter] Write FAILED for ${error.documentRef.path}` +
        ` (attempt ${error.failedAttempts}): ${error.message}`
      );
      if (error.failedAttempts >= 3) {
        failed++;
        return false; // หยุด retry
      }
      return true; // retry ต่อ
    });
    const now = new Date();
    const employeeIds = new Set<string>();
    dailySummaries.forEach(s => employeeIds.add(s.employeeNumber));
    scanRecords.forEach(s => employeeIds.add(s.employeeId));

    const contractorMap = new Map<string, string>();
    const contractorHomeProjectMap = new Map<string, string>(); // empId → homeProjectId
    await Promise.all(
      Array.from(employeeIds).map(async (empId) => {
        try {
          const contractor = await dailyContractorService.findByEmployeeIdOrHistory(empId);
          if (contractor) {
            if (contractor.name) contractorMap.set(empId, contractor.name);
            if (contractor.projectLocationId) contractorHomeProjectMap.set(empId, contractor.projectLocationId);
          }
        } catch (err) {
          // Ignore if not found
        }
      })
    );
    
    // 3.6 ดึงข้อมูลโฟร์แมน (Assignees) จาก users collection
    // ใช้ Employeeid (ตัว E ใหญ่) ตาม schema จริงใน Firestore
    const assigneeIds = new Set<string>();
    dailySummaries.forEach(s => { if (s.assigneeId) assigneeIds.add(s.assigneeId); });

    const assigneeMap = new Map<string, string>(); // empId -> fullNameEn
    if (assigneeIds.size > 0) {
      console.log(`[ReconciliationService] Looking up ${assigneeIds.size} assignee(s): [${Array.from(assigneeIds).join(', ')}]`);
      const timeoutMs = 5000; // 5 วินาที ต่อ 1 query หาก hang จะ skip ไปเลย
      await Promise.all(Array.from(assigneeIds).map(async (empId) => {
        try {
          const queryPromise = this.db.collection('users')
            .where('Employeeid', '==', empId)
            .limit(1)
            .get();
          const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), timeoutMs)
          );
          const snap = await Promise.race([queryPromise, timeoutPromise]);
          if (snap && 'empty' in snap && !snap.empty) {
            const data = snap.docs[0].data();
            assigneeMap.set(empId, data.Fullname || data.name || data.fullNameEn || data.Fullnameen || '');
          } else if (!snap) {
            console.warn(`[ReconciliationService] Assignee lookup timed out for empId=${empId} — skipping`);
          }
        } catch (e) {
          console.warn(`[ReconciliationService] Assignee lookup failed for empId=${empId}:`, e);
        }
      }));
      console.log(`[ReconciliationService] Assignee lookup done. Found ${assigneeMap.size} name(s)`);
    }

    // 4. Upsert ReconciliationRecord สำหรับทุก daily summary
    console.log(`[ReconciliationService] Step 4: Processing ${dailySummaries.length} daily summaries...`);
    for (const summary of dailySummaries) {
      const key = `${summary.employeeNumber}_${summary.date}`;
      const scanEntry = scanMap.get(key);
      const id = generateReconciliationId(summary.employeeNumber, summary.date);
      const existing = existingMap.get(id);

      const input: CreateReconciliationRecordInput = {
        employeeId: summary.employeeNumber,
        employeeName: contractorMap.get(summary.employeeNumber) || scanEntry?.name,
        workDate: summary.date,
        projectLocationId: summary.projectLocationId,
        homeProjectId: contractorHomeProjectMap.get(summary.employeeNumber),
        workLocationIds: (() => {
          const existingLocs = existing?.workLocationIds ?? [];
          const newLoc = summary.projectLocationId;
          return Array.from(new Set([...existingLocs, newLoc]));
        })(),
        dailyReportHours: summary.totalHours,
        timesheetNormalHours: summary.regularHours,
        timesheetOtMorning: summary.otMorningHours,
        timesheetOtNoon: summary.otNoonHours,
        timesheetOtEvening: summary.otEveningHours,
        dailyReportId: `${summary.employeeNumber}_${summary.date}`,
        scanDataHours: scanEntry?.hours,
        scanNormalHours: scanEntry?.scanNormalHours,
        scanOtMorningHours: scanEntry?.scanOtMorningHours,
        scanOtNoonHours: scanEntry?.scanOtNoonHours,
        scanOtEveningHours: scanEntry?.scanOtEveningHours,
        scanDataId: scanEntry?.id,
        dailyReportPhotos: summary.dailyReportPhotos,
        dailyReportPunches: summary.dailyReportPunches,
        shiftTimes: summary.shiftTimes,
        scanPunches: scanEntry?.punches,
        leaveHours: summary.leaveHours,
        leaveEntries: summary.leaveEntries,
        medCertFileUrl: summary.medCertFileUrl,
        assigneeId: summary.assigneeId,
        assigneeName: summary.assigneeId ? assigneeMap.get(summary.assigneeId) : undefined,
      };

      try {
        const resultData = this.mergeAndClassify(input, existing, now, false, summary.isLeave);
        if (resultData) {
          if (summary.employeeNumber === '200022') {
             console.log(`[ReconciliationService] Generating for 200022:`, {
                inputName: input.employeeName,
                existingName: existing?.employeeName,
                resultName: resultData.employeeName,
                contractorMapValue: contractorMap.get('200022')
             });
          }
          const ref = this.collection.doc(id);
          writer.set(ref, reconciliationRecordConverter.toFirestore(resultData as any), { merge: true });
          succeeded++;
        }
      } catch (err) {
        console.error(`[ReconciliationService] mergeAndClassify error for ${summary.employeeNumber} ${summary.date}:`, err);
        failed++;
      }
    }
    console.log(`[ReconciliationService] Step 4 done: ${succeeded} queued, ${failed} failed`);

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

    for (const scan of unmatchedScans) {
      const dateKey =
        scan.scanDate ||
        (scan.workDate instanceof Date
          ? scan.workDate.toISOString().split('T')[0]
          : String(scan.workDate).split('T')[0]);
      
      const fallback = await this.getFallbackAssignee(scan.employeeId);
      const totalScanHours =
        (scan.regularHours ?? 0) +
        (scan.otMorningHours ?? 0) +
        (scan.otNoonHours ?? 0) +
        (scan.otEveningHours ?? 0);

      const id = generateReconciliationId(scan.employeeId, dateKey);
      const existing = existingMap.get(id);

      const input: CreateReconciliationRecordInput = {
        employeeId: scan.employeeId,
        employeeName: scan.name || contractorMap.get(scan.employeeId),
        workDate: dateKey,
        projectLocationId: scan.projectLocationId,
        homeProjectId: contractorHomeProjectMap.get(scan.employeeId),
        workLocationIds: (() => {
          const existingLocs = existing?.workLocationIds ?? [];
          const newLoc = scan.projectLocationId;
          return Array.from(new Set([...existingLocs, newLoc]));
        })(),
        dailyReportHours: undefined,   // ไม่มี daily → MISSING_DAILY
        scanDataHours: totalScanHours,
        scanNormalHours: scan.regularHours,
        scanOtMorningHours: scan.otMorningHours,
        scanOtNoonHours: scan.otNoonHours,
        scanOtEveningHours: scan.otEveningHours,
        scanDataId: scan.id,
        scanPunches: extractScanPunches(scan as any),
        assigneeId: fallback?.id || undefined,
        assigneeName: fallback?.name || undefined,
      };

      try {
        const resultData = this.mergeAndClassify(input, existing, now);
        if (resultData) {
          const ref = this.collection.doc(id);
          writer.set(ref, reconciliationRecordConverter.toFirestore(resultData as any), { merge: true });
          succeeded++;
        }
      } catch (err) {
        failed++;
      }
    }

    // ปิด writer เพื่อ commit ชุดข้อมูลทั้งหมด
    console.log(`[ReconciliationService] Step 6: writer.close() starting (${succeeded} writes queued)...`);
    await writer.close();
    console.log(`[ReconciliationService] Step 6: writer.close() DONE`);

    return {
      succeeded,
      failed,
      total: dailySummaries.length + unmatchedScans.length,
    };
  }

  /**
   * Generate ReconciliationRecord สำหรับพนักงาน 1 คนในวันที่ระบุ (Optimized)
   */
  async generateForEmployee(
    employeeId: string,
    workDateStr: string,
    projectLocationId: string,
    initialScanData?: any // รับข้อมูลสแกนชุดล่าสุดมาโดยตรง เพื่อเลี่ยงปัญหา Stale Data จากการ Query
  ): Promise<ReconciliationRecord> {
    // 1. ดึง Daily Report 1 record
    const timesheet = await projectBDailyReportService.getDailyTimesheet(employeeId, workDateStr);
    const summary = timesheet ? toTimesheetSummary(timesheet) : null;

    // 2. ดึง Scan Data (ใช้จาก initialScanData หรือดึงตรงจาก Firestore ด้วย ID)
    let scanData = initialScanData;
    let activeScanDocId: string | undefined = initialScanData?.id;

    if (!scanData) {
      // ถ้าไม่มีข้อมูลส่งมา ให้ดึงตรงด้วย ID (เสถียรกว่าการใช้ where query)
      const scanDataId = generateScanDocId(employeeId, workDateStr);
      const scanDoc = await this.db.collection(SCAN_COLLECTION).doc(scanDataId).get();
      
      if (scanDoc.exists) {
        scanData = scanDoc.data();
        activeScanDocId = scanDoc.id;
        // กรองเบื้องต้น
        if (scanData.isDeleted) scanData = null;
      }
    }

    const totalScanHours = scanData ? 
      (scanData.regularHours ?? 0) + (scanData.otMorningHours ?? 0) + (scanData.otNoonHours ?? 0) + (scanData.otEveningHours ?? 0) : undefined;

    let employeeName = scanData?.name;
    if (!employeeName) {
      try {
        const contractor = await dailyContractorService.findByEmployeeIdOrHistory(employeeId);
        if (contractor && contractor.name) {
          employeeName = contractor.name;
        }
      } catch (err) {
        // ignore
      }
    }

    let assigneeName: string | undefined = undefined;
    let assigneeId: string | undefined = summary?.assigneeId;
    let isFallbackAssignee = false;

    if (summary?.assigneeId) {
      try {
        const timeoutMs = 5000;
        const queryPromise = this.db.collection('users')
          .where('Employeeid', '==', summary.assigneeId)
          .limit(1)
          .get();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), timeoutMs)
        );
        const snap = await Promise.race([queryPromise, timeoutPromise]);
        if (snap && 'empty' in snap && !snap.empty) {
          const data = snap.docs[0].data();
          assigneeName = data.fullNameEn || data.Fullnameen;
        } else if (!snap) {
          console.warn(`[ReconciliationService] Assignee lookup timed out for empId=${summary.assigneeId}`);
        }
      } catch {
        // ignore
      }
    } else if (!summary) {
      // ใช้ Fallback Assignee กรณีไม่มี Daily Report
      try {
        let targetDoc = await this.db.collection('dailyContractors').doc(`DC-${employeeId}`).get();
        if (!targetDoc.exists) {
          targetDoc = await this.db.collection('dailyContractors').doc(employeeId).get();
          if (!targetDoc.exists) {
            const qSnap = await this.db.collection('dailyContractors').where('employeeId', '==', employeeId).limit(1).get();
            if (!qSnap.empty) {
              targetDoc = qSnap.docs[0];
            }
          }
        }
        
        if (targetDoc.exists) {
          const data = targetDoc.data();
          if (data?.foremanUsage) {
            let maxCount = -1;
            for (const [foremanId, usage] of Object.entries(data.foremanUsage)) {
              const u = usage as { count: number; name: string };
              if (u.count > maxCount) {
                maxCount = u.count;
                assigneeId = foremanId;
                assigneeName = u.name;
              }
            }
            if (assigneeId && maxCount > 0) {
              isFallbackAssignee = true;
            } else {
              assigneeId = undefined;
              assigneeName = undefined;
            }
          }
        }
      } catch (err) {
        console.warn(`[ReconciliationService] Fallback Assignee lookup failed for empId=${employeeId}`, err);
      }
    }

    return this.upsertRecord({
      employeeId,
      employeeName,
      workDate: workDateStr,
      projectLocationId,
      dailyReportHours: summary?.totalHours,
      timesheetNormalHours: summary?.regularHours,
      timesheetOtMorning: summary?.otMorningHours,
      timesheetOtNoon: summary?.otNoonHours,
      timesheetOtEvening: summary?.otEveningHours,
      dailyReportId: summary ? `${summary.employeeNumber}_${summary.date}` : undefined,
      scanDataHours: scanData ? totalScanHours : undefined,
      scanNormalHours: scanData?.regularHours,
      scanOtMorningHours: scanData?.otMorningHours,
      scanOtNoonHours: scanData?.otNoonHours,
      scanOtEveningHours: scanData?.otEveningHours,
      scanDataId: scanData ? (activeScanDocId || generateScanDocId(employeeId, workDateStr)) : undefined,
      dailyReportPhotos: summary?.dailyReportPhotos,
      dailyReportPunches: summary?.dailyReportPunches,
      // fallback: allScans (HH:mm:ss) หรือ Time1-6 ถ้า punches ยังว่าง (docs เก่าจาก bulk import)
      scanPunches: scanData ? extractScanPunches(scanData) : [],
      leaveHours: summary?.leaveHours,
      leaveEntries: summary?.leaveEntries,
      medCertFileUrl: summary?.medCertFileUrl,
      assigneeId: assigneeId,
      assigneeName: assigneeName,
      isFallbackAssignee: isFallbackAssignee,
    }, false, summary?.isLeave);
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

    // กรองตามสังกัด (RBAC หลัก) — กรองเฉพาะ homeProjectId เท่านั้น
    if (filter.homeProjectId) {
      query = query.where('homeProjectId', '==', filter.homeProjectId);
    } else if (filter.allowedHomeProjects && filter.allowedHomeProjects.length > 0) {
      // กรณี "ทั้งหมด" ใช้ homeProjectId IN
      query = query.where('homeProjectId', 'in', filter.allowedHomeProjects);
    } else if (filter.projectLocationId) {
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
      note: `ยึดตามข้อมูล Daily Report ต้นทาง (${record.dailyReportHours} ชม.)`,
    };

    await ref.update({
      status: 'MATCHED',
      approvalSource: 'daily_report',
      approvedNormalHours: record.timesheetNormalHours,
      approvedOtMorning: record.timesheetOtMorning,
      approvedOtNoon: record.timesheetOtNoon,
      approvedOtEvening: record.timesheetOtEvening,
      totalApprovedHours: record.dailyReportHours,
      scanDataHours: record.dailyReportHours, // เติม scanDataHours ให้เท่ากับ daily เพื่อให้ summary ตรงกัน
      suggestedHours: record.dailyReportHours,
      resolvedAt: Timestamp.fromDate(now),
      resolvedBy: adminId,
      updatedAt: Timestamp.fromDate(now),
      statusHistory: FieldValue.arrayUnion(this.toFirestoreHistoryEntry(historyEntry)),
    });
  }

  /**
   * Admin แก้ไขชั่วโมงทำงานด้วยตนเอง (Manual Resolve)
   * ใช้ในกรณีที่ Daily และ Scan ไม่ตรงกัน และ Admin ต้องการระบุยอดที่ถูกต้องเอง (เช่น หักเวลาสาย OT)
   */
  async resolveManual(
    recordId: string,
    adminId: string,
    payload: {
      normalHours?: number;
      otMorning?: number;
      otNoon?: number;
      otEvening?: number;
      reason?: string;
    }
  ): Promise<void> {
    const ref = this.collection.doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`ReconciliationRecord ${recordId} not found`);

    const now = new Date();
    const total = (payload.normalHours ?? 0) + (payload.otMorning ?? 0) + (payload.otNoon ?? 0) + (payload.otEvening ?? 0);

    const historyEntry: StatusHistoryEntry = {
      status: 'MATCHED',
      changedAt: now,
      changedBy: adminId,
      reason: `Admin แก้ไขชั่วโมงด้วยตนเอง: ${payload.reason || 'ปรับปรุงข้อมูลให้ถูกต้อง'}`,
      note: `ปรับยอดรวมเป็น ${total} ชม. (เดิม Daily: ${snap.data()?.dailyReportHours || 0} ชม.)`,
    };

    await ref.update({
      status: 'MATCHED',
      approvalSource: 'manual',
      approvedNormalHours: payload.normalHours,
      approvedOtMorning: payload.otMorning,
      approvedOtNoon: payload.otNoon,
      approvedOtEvening: payload.otEvening,
      totalApprovedHours: total,
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

  /**
   * Admin แก้ไขรายการสแกนนิ้ว (เพิ่ม/ลบ/แก้ไข Punch)
   */
  async updateScanPunches(
    recordId: string,
    adminId: string,
    punches: string[],
    reason: string
  ): Promise<void> {
    const ref = this.collection.doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`ReconciliationRecord ${recordId} not found`);

    const record = reconciliationRecordConverter.fromFirestore(snap);
    const now = new Date();

    // 1. คำนวณชั่วโมงสแกนใหม่จาก punches
    const workDate = new Date(record.workDate);
    const timeScans = punches.map(p => {
      const [h, m] = p.split(':').map(Number);
      const d = new Date(workDate);
      d.setHours(h, m, 0, 0);
      return d;
    });

    const scanMins = timeScans.map(s => s.getHours() * 60 + s.getMinutes());
    let scanNormal = 0;
    let scanOtMorning = 0;
    let scanOtNoon = 0;
    let scanOtEvening = 0;

    if (scanMins.length >= 2) {
      const first = scanMins[0];
      const last = scanMins[scanMins.length - 1];
      const start = Math.max(first, 480);
      const end = Math.min(last, 1020);
      if (end > start) {
        let mins = end - start;
        if (start < 720 && end > 780) mins -= 60;
        scanNormal = Math.floor(mins / 30) * 0.5;
      }
      const morning = scanMins.filter(m => m <= 480);
      if (morning.length >= 2) scanOtMorning = Math.floor((morning[morning.length - 1] - morning[0]) / 30) * 0.5;
      const hasLunchScan = scanMins.some(m => m >= 690 && m <= 810);
      if (first < 720 && last > 780 && !hasLunchScan) scanOtNoon = 1.0;
      if (last >= 1110) scanOtEvening = Math.floor((last - 1080) / 30) * 0.5;
    }
    const totalScanHours = scanNormal + scanOtMorning + scanOtNoon + scanOtEvening;

    // 2. อัปเดต ScanData document (ถ้ามี)
    if (record.scanDataId) {
      const scanRef = this.db.collection(SCAN_COLLECTION).doc(record.scanDataId);
      await scanRef.update({
        punches,
        allScans: timeScans.map(s => s.toTimeString().split(' ')[0]),
        regularHours: scanNormal,
        otMorningHours: scanOtMorning,
        otEveningHours: scanOtEvening,
        otNoonHours: scanOtNoon,
        isManuallyEdited: true,
        updatedAt: Timestamp.fromDate(now),
      });
    }

    // 3. Re-classify record
    const classified = this.classifyByPunchCoverage({
      dailyReportPunches: record.dailyReportPunches || [],
      scanPunches: punches,
      timesheetNormalHours: record.timesheetNormalHours,
      timesheetOtMorning: record.timesheetOtMorning,
      timesheetOtNoon: record.timesheetOtNoon,
      timesheetOtEvening: record.timesheetOtEvening,
      dailyReportHours: record.dailyReportHours,
      isHoliday: record.isHoliday,
      isLeave: record.hasLeave,
    });

    const historyEntry: StatusHistoryEntry = {
      status: classified.status,
      changedAt: now,
      changedBy: adminId,
      reason: `Admin ปรับปรุงรายการสแกนนิ้ว: ${reason}`,
      note: `Punches ใหม่: [${punches.join(', ')}] -> ${classified.status}`,
    };

    // 4. บันทึก ReconciliationRecord
    await ref.update({
      scanPunches: punches,
      scanDataHours: totalScanHours,
      scanNormalHours: scanNormal,
      scanOtMorningHours: scanOtMorning,
      scanOtNoonHours: scanOtNoon,
      scanOtEveningHours: scanOtEvening,
      status: classified.status,
      approvedNormalHours: classified.approvedNormalHours,
      approvedOtMorning: classified.approvedOtMorning,
      approvedOtNoon: classified.approvedOtNoon,
      approvedOtEvening: classified.approvedOtEvening,
      totalApprovedHours: classified.totalApprovedHours,
      approvalSource: classified.approvalSource,
      note: classified.note,
      lateMinutes: classified.lateMinutes,
      earlyLeaveMinutes: classified.earlyLeaveMinutes,
      isLate: classified.isLate,
      isEarlyLeave: classified.isEarlyLeave,
      resolvedAt: Timestamp.fromDate(now),
      resolvedBy: adminId,
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
    homeProjectId?: string;            // กรองตามสังกัด (RBAC หลัก)
    allowedHomeProjects?: string[];    // multi สังกัด
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalRows: number;
    normalCount: number;      // MATCHED + LEAVE
    absentCount: number;      // ABSENT เฉพาะ
    matchedCount: number;     // MATCHED เฉพาะ
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
      // กรองตามสังกัด (RBAC หลัก) — กรองเฉพาะ homeProjectId เท่านั้น
      if (filter.homeProjectId) {
        q = q.where('homeProjectId', '==', filter.homeProjectId);
      } else if (filter.allowedHomeProjects && filter.allowedHomeProjects.length > 0) {
        // กรณี "ทั้งหมด" ใช้ homeProjectId IN
        q = q.where('homeProjectId', 'in', filter.allowedHomeProjects);
      } else if (filter.projectLocationId) {
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
      // นับพนักงานจาก dailyContractors ที่ isActive: true + filter project (สังกัด)
      (() => {
        let dcQ: FirebaseFirestore.Query = this.db.collection(COLLECTIONS.DAILY_CONTRACTORS)
          .where('isActive', '==', true);
        const homeProject = filter.homeProjectId ?? filter.projectLocationId;
        const homeProjects = filter.allowedHomeProjects ?? filter.allowedProjects;
        if (homeProject) {
          dcQ = dcQ.where('projectLocationId', '==', homeProject);
        } else if (homeProjects && homeProjects.length > 0) {
          dcQ = dcQ.where('projectLocationId', 'in', homeProjects);
        }
        return dcQ.count().get();
      })(),
    ]);


    return {
      totalRows:          totalSnap.data().count - holidaySnap.data().count,
      normalCount:        normalSnap.data().count + leaveSnap.data().count, // MATCHED + LEAVE (ใช้ใน SummaryStats การ์ดใหญ่)
      matchedCount:       normalSnap.data().count,                          // MATCHED อย่างเดียว (ใช้ใน NormalBreakdown)
      absentCount:        absentSnap.data().count,
      leaveCount:         leaveSnap.data().count, // status=LEAVE เท่านั้น
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
