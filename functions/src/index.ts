/**
 * Firebase Cloud Functions — Labor Management System
 *
 * onScanDataChanged: Trigger เมื่อมีการเขียน scanData
 * - อ่าน DailyEmployeeTimesheets จาก After-Sale Project (cross-project)
 * - อ่าน companyHolidays + dailyContractors จาก Labor Management Project
 * - เขียน reconciliationRecords ใน Labor Management Project
 *
 * Deploy: firebase deploy --only functions
 */

import * as admin from 'firebase-admin';
import { firestore } from 'firebase-functions';

// ─── Initialize Firebase Admin — Labor Management (default) ─────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── Initialize Firebase Admin — After-Sale Project (cross-project read) ────
const afterSaleApp = admin.apps.find(a => a?.name === 'afterSale')
  ?? admin.initializeApp({ projectId: 'after-sale-system' }, 'afterSale');

const db = admin.firestore();                    // Labor Management Firestore
const afterSaleDb = admin.firestore(afterSaleApp); // After-Sale Firestore

// ─── Types ───────────────────────────────────────────────────────────────────

type ReconciliationStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'CONFLICTED'
  | 'MISSING_SCAN'
  | 'MISSING_DAILY'
  | 'ABSENT'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'UNREGISTERED_EMPLOYEE';

interface LeaveEntry {
  hours: number;
  attachment?: string; // ชื่อไฟล์หลักฐานการลา (optional)
  type?: string;
}

interface DailyEmployeeTimesheet {
  date: string;
  employeeNumber: string;
  expectedHours: {
    normal: number;
    otEvening: number;
    otMorning: number;
    otNoon: number;
  };
  expectedShifts?: {
    normal: boolean;
    otEvening: boolean;
    otMorning: boolean;
    otNoon: boolean;
  };
  shiftTimes?: {
    day?: string;
    otEvening?: string;
    otMorning?: string;
    otNoon?: string;
  };
  isActive: boolean;
  projectLocationId: string;
  lastUpdated: string;
  workLogs?: any[];
  leave?: LeaveEntry[];   // ถ้ามี entries → สถานะ LEAVE
  // New Leave Structure
  leaveStatus?: { isFullDay?: boolean; leaveShifts?: any; leaveTimes?: any; leaveType?: string; medCertFileUrl?: string };
  leaveShifts?: { morning?: boolean; afternoon?: boolean; custom?: boolean };
  leaveTimes?: { morning?: string; afternoon?: string; custom?: string };
  leaveType?: string;
  medCertFileUrl?: string;
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
  editHistory?: any[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateReconciliationId(employeeId: string, workDate: string): string {
  return `REC_${employeeId}_${workDate}`;
}

/** แปลง HH:mm เป็นจำนวนนาทีจากเที่ยงคืน */
function punchToMinutes(punch: string): number {
  const [h, m] = punch.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}


interface PunchClassifyResult {
  status: ReconciliationStatus;
  approvedNormalHours: number;
  approvedOtMorning: number;
  approvedOtNoon: number;
  approvedOtEvening: number;
  totalApprovedHours: number;
  approvalSource: 'daily_report' | 'scan_data' | 'manual';
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  note?: string | null;
}

interface ClassifyBySegmentsParams {
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
}

/**
 * [PRIMARY] กำหนดสถานะโดยเปรียบเทียบจาก Segments
 * ใช้ shiftTimes เป็น source of truth ในการสร้างช่วงเวลาที่ควรจะมีการสแกน
 */
function classifyBySegments(params: ClassifyBySegmentsParams): PunchClassifyResult {
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

  const isFullDayLeave = isLeave === true && (leaveHours ?? 0) >= 8;
  const isPartialLeave = isLeave === true && (leaveHours ?? 0) > 0 && (leaveHours ?? 0) < 8;
  const noWorkHours = !dailyReportHours || dailyReportHours === 0;
  
  const dailyWorkExists = !!shiftTimes?.day || (dailyReportHours !== undefined && dailyReportHours > 0);
  const dailyExists = dailyWorkExists || isPartialLeave;

  if (isFullDayLeave && noWorkHours) {
    return { status: 'LEAVE', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false };
  }

  if (isHoliday && noWorkHours) {
    if (scanCount > 0) {
      return { status: 'CONFLICTED', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: `วันหยุดแต่พบข้อมูลการสแกนนิ้ว (${scanCount} ครั้ง)` };
    }
    return { status: 'HOLIDAY', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false };
  }

  if (isPartialLeave && !dailyWorkExists) {
    if (scanCount > 0) {
      return { status: 'CONFLICTED', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ และพบข้อมูลสแกนนิ้ว (${scanCount} ครั้ง)` };
    }
    return { status: 'MISSING_DAILY', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: `แจ้งลา ${leaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ` };
  }

  if (!dailyExists && scanCount === 0) return { status: 'ABSENT', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false };
  if (!dailyExists && scanCount > 0) return { status: 'MISSING_DAILY', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false };
  
  if (dailyExists && scanCount === 0) {
    return { status: 'MISSING_SCAN', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: 'ไม่พบข้อมูลการสแกนนิ้ว' };
  }
  
  if (dailyExists && scanCount === 1) {
    return { status: 'CONFLICTED', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: `ข้อมูลสแกนนิ้วไม่เพียงพอ (พบเพียงครั้งเดียว: ${scanPunches[0]}) — Admin ต้องเติมเวลาที่ขาด` };
  }

  if (!shiftTimes || !shiftTimes.day) {
    return { status: 'MISSING_DAILY', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)' };
  }

  const parseTime = (timeStr?: string): { start: number; end: number } | null => {
    if (!timeStr) return null;
    const parts = timeStr.split('-').map(s => s.trim());
    if (parts.length !== 2) return null;
    return { start: punchToMinutes(parts[0]), end: punchToMinutes(parts[1]) };
  };

  const segments: { start: number; end: number; type: string }[] = [];
  const dayShift = parseTime(shiftTimes.day);
  const otMorning = parseTime(shiftTimes.otMorning);
  const otNoon = parseTime(shiftTimes.otNoon);
  const otEvening = parseTime(shiftTimes.otEvening);

  if (!dayShift) {
      return { status: 'MISSING_DAILY', approvedNormalHours: 0, approvedOtMorning: 0, approvedOtNoon: 0, approvedOtEvening: 0, totalApprovedHours: 0, approvalSource: 'daily_report', lateMinutes: 0, earlyLeaveMinutes: 0, isLate: false, isEarlyLeave: false, note: 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)' };
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

  const sortedScans = scanPunches.map(p => punchToMinutes(p)).sort((a, b) => a - b);
  
  let isConflicted = false;
  let conflictNote = '';
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;
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
    // Allow boundary-shared punches to be reused as IN of the next segment
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

    if (Math.abs(late) > 90 || Math.abs(early) > 90) {
      isConflicted = true;
      conflictNotes.push(`ไม่พบสแกนเข้า/ออกที่สอดคล้องกับช่วงเวลา ${formatTime(seg.start)} - ${formatTime(seg.end)}`);
      continue;
    }

    if (late > 30) {
      isConflicted = true;
      conflictNotes.push(`สแกนเข้าสายเกิน 30 นาทีในรอบ ${formatTime(seg.start)} (${late} นาที)`);
    }
    if (early > 30) {
      isConflicted = true;
      conflictNotes.push(`สแกนออกก่อนเกิน 30 นาทีในรอบ ${formatTime(seg.end)} (${early} นาที)`);
    }

    if (late > 0) {
      totalLateMinutes += late;
      if (seg.type === 'otMorning') penaltyOtMorning += late;
    }
    if (early > 0) {
      totalEarlyLeaveMinutes += early;
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
      approvedNormalHours: timesheetNormalHours ?? 0,
      approvedOtMorning: timesheetOtMorning ?? 0,
      approvedOtNoon: timesheetOtNoon ?? 0,
      approvedOtEvening: timesheetOtEvening ?? 0,
      totalApprovedHours: (timesheetNormalHours || 0) + (timesheetOtMorning || 0) + (timesheetOtNoon || 0) + (timesheetOtEvening || 0),
      approvalSource: 'daily_report',
      lateMinutes: totalLateMinutes,
      earlyLeaveMinutes: totalEarlyLeaveMinutes,
      isLate: totalLateMinutes > 0,
      isEarlyLeave: totalEarlyLeaveMinutes > 0,
      note: conflictNote
    };
  }

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
    approvedNormalHours: approvedNormal,
    approvedOtMorning: approvedMorning,
    approvedOtNoon: approvedNoon,
    approvedOtEvening: approvedEvening,
    totalApprovedHours: totalApproved,
    approvalSource: 'daily_report',
    lateMinutes: totalLateMinutes,
    earlyLeaveMinutes: totalEarlyLeaveMinutes,
    isLate: totalLateMinutes > 0,
    isEarlyLeave: totalEarlyLeaveMinutes > 0,
    note: autoNote || null,
  };
}

/**
 * [PRIMARY] กำหนดสถานะด้วย punch coverage
 * CONFLICTED: มี OT เช้า/เย็น แต่ scan ไม่ครอบ boundary
 * MATCHED:    ทุกกรณีอื่น + เก็บ lateMinutes / earlyLeaveMinutes
 */
function classifyByPunchCoverage(params: {
  dailyReportPunches: string[];
  scanPunches: string[];
  normalHours: number;
  otMorningHours: number;
  otNoonHours: number;
  otEveningHours: number;
}): PunchClassifyResult {
  const { dailyReportPunches, scanPunches, normalHours, otMorningHours, otNoonHours, otEveningHours } = params;

  const sortedReport = [...dailyReportPunches].sort();
  const reportStart = punchToMinutes(sortedReport[0]);
  const reportEnd   = punchToMinutes(sortedReport[sortedReport.length - 1]);

  // หาจุดสแกนจริง (หัว-ท้าย) — ยึดตามหลัก Coverage (เอกสาร Section 2.3)
  const sortedScan = [...scanPunches].sort();
  const scanFirstIn  = sortedScan.length > 0 ? punchToMinutes(sortedScan[0]) : 0;
  const scanLastOut  = sortedScan.length > 0 ? punchToMinutes(sortedScan[sortedScan.length - 1]) : 0;

  const lateMinutes       = Math.max(0, scanFirstIn - reportStart);
  const earlyLeaveMinutes = Math.max(0, reportEnd - scanLastOut);

  // --- CONFLICT Threshold (30 นาที) ---
  // หากสายหรือออกก่อนเกิน 30 นาที ให้เป็น CONFLICTED (ทั้งเวลาปกติและ OT)
  const CONFLICT_THRESHOLD = 30;
  const isLateConflict = lateMinutes > CONFLICT_THRESHOLD;
  const isEarlyLeaveConflict = earlyLeaveMinutes > CONFLICT_THRESHOLD;

  if (isLateConflict || isEarlyLeaveConflict) {
    return {
      status: 'CONFLICTED',
      approvedNormalHours: normalHours,
      approvedOtMorning: otMorningHours,
      approvedOtNoon: otNoonHours,
      approvedOtEvening: otEveningHours,
      totalApprovedHours: normalHours + otMorningHours + otNoonHours + otEveningHours,
      approvalSource: 'daily_report',
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
  // เมื่อผ่านการเช็ค Conflict (สาย/ออกก่อน <= 30 นาที)
  let approvedNormal  = normalHours;
  let approvedMorning = otMorningHours;
  let approvedNoon    = otNoonHours;
  let approvedEvening = otEveningHours;
  let autoNote = '';

  const isLateForOT = lateMinutes > 0 && otMorningHours > 0;
  const isEarlyLeaveFromOT = earlyLeaveMinutes > 0 && otEveningHours > 0;

  if (isLateForOT) {
    const penaltyMins = Math.ceil(lateMinutes / 30) * 30;
    approvedMorning = Math.max(0, otMorningHours - (penaltyMins / 60));
    autoNote += `สายช่วง OT เช้า ${lateMinutes} นาที (หัก ${penaltyMins} นาที) `;
  }

  if (isEarlyLeaveFromOT) {
    const penaltyMins = Math.ceil(earlyLeaveMinutes / 30) * 30;
    approvedEvening = Math.max(0, otEveningHours - (penaltyMins / 60));
    autoNote += `ออกก่อนช่วง OT เย็น ${earlyLeaveMinutes} นาที (หัก ${penaltyMins} นาที) `;
  }

  const totalApproved = approvedNormal + approvedMorning + approvedNoon + approvedEvening;

  return {
    status: 'MATCHED',
    approvedNormalHours: approvedNormal,
    approvedOtMorning: approvedMorning,
    approvedOtNoon: approvedNoon,
    approvedOtEvening: approvedEvening,
    totalApprovedHours: totalApproved,
    approvalSource: 'daily_report',
    lateMinutes,
    earlyLeaveMinutes,
    isLate: lateMinutes > 0,
    isEarlyLeave: earlyLeaveMinutes > 0,
    note: autoNote || null,
  };
}

async function getAssigneeName(assigneeId: string): Promise<string | null> {
  try {
    // 1. Try direct document lookup (doc ID = assigneeId)
    const doc = await db.collection('users').doc(assigneeId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data) {
        const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
        if (name) return name;
      }
    }
    // 2. Fallback: query by lowercase 'employeeId'
    const lowercaseSnap = await db.collection('users')
      .where('employeeId', '==', assigneeId)
      .limit(1)
      .get();
    if (!lowercaseSnap.empty) {
      const data = lowercaseSnap.docs[0].data();
      const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
      if (name) return name;
    }
    // 3. Fallback: query by uppercase 'Employeeid'
    const uppercaseSnap = await db.collection('users')
      .where('Employeeid', '==', assigneeId)
      .limit(1)
      .get();
    if (!uppercaseSnap.empty) {
      const data = uppercaseSnap.docs[0].data();
      const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
      if (name) return name;
    }
  } catch (err) {
    console.warn(`[getAssigneeName] failed for ${assigneeId}:`, err);
  }
  return null;
}

// ─── Fallback Assignee Helper ──────────────────────────────────────────────────
async function getFallbackAssignee(employeeId: string): Promise<{ id: string; name: string } | null> {
  try {
    let targetDoc = await db.collection('dailyContractors').doc(`DC-${employeeId}`).get();
    if (!targetDoc.exists) {
      targetDoc = await db.collection('dailyContractors').doc(employeeId).get();
      if (!targetDoc.exists) {
        const qSnap = await db.collection('dailyContractors').where('employeeId', '==', employeeId).limit(1).get();
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
        const resolvedName = await getAssigneeName(maxAssigneeId);
        if (resolvedName) {
          finalName = resolvedName;
        }
      }
      return { id: maxAssigneeId, name: finalName || 'Unknown' };
    }
  } catch (err) {
    console.error(`[getFallbackAssignee] Error for ${employeeId}:`, err);
  }
  return null;
}

// ─── Core Reconcile Function ──────────────────────────────────────────────────

/**
 * reconcile()
 * เปรียบเทียบ ScanData กับ DailyEmployeeTimesheet แล้วเขียน/อัปเดต ReconciliationRecord
 */
async function reconcile(
  employeeNumber: string,
  workDateStr: string,          // YYYY-MM-DD
  projectLocationId: string,
  triggerDocId?: string,        // doc id ที่ trigger ฟังก์ชัน (รับประกันว่า scan มีอยู่)
  triggerDocData?: Record<string, any> // ข้อมูลจาก trigger doc (ใช้คำนวณชั่วโมงเผื่อ query พลาด)
): Promise<void> {

  let updatesObj: Record<string, any> = {};
  const recordId = generateReconciliationId(employeeNumber, workDateStr);
  const recordRef = db.collection('reconciliationRecords').doc(recordId);

  let preserveManualScan = false;
  let existingRecord: any = null;

  const initialDoc = await recordRef.get();
  if (initialDoc.exists) {
    existingRecord = initialDoc.data() as any;
    if (existingRecord['isLocked'] === true) {
      console.log(`[reconcile] ${employeeNumber} on ${workDateStr} isLocked (Wage Period Approved) — skip all processing`);
      return;
    }
    
    // หาก Admin เคยแก้ไขเวลาสแกนนิ้วด้วยตนเอง หรือกดยืนยันข้อมูลไปแล้ว จะต้องสงวนข้อมูลชุดนั้นไว้ ไม่ให้ถูกทับด้วยข้อมูลดิบ
    if (existingRecord['approvalSource'] === 'manual' || existingRecord['resolvedAt'] != null) {
      preserveManualScan = true;
      console.log(`[reconcile] ${employeeNumber} on ${workDateStr} was manually resolved. Preserving manual scan data.`);
    }
  }

  // ── 1. ตรวจสอบว่าพนักงานมีในระบบ (dailyContractors) ─────────────────────
  const contractorSnap = await db.collection('dailyContractors')
    .where('employeeId', '==', employeeNumber)
    .limit(1)
    .get();

  let employeeName = '';
  let homeProjectId = '';
  if (!contractorSnap.empty) {
    const data = contractorSnap.docs[0].data();
    employeeName = data['name'] || '';
    homeProjectId = data['projectLocationId'] || '';
  }
  const isRegistered = !contractorSnap.empty;

  // ── 1. ดึง Scan Data ────────────────────────────────────────────────────────
  // Query 1: workDate เป็น Timestamp — ใช้ Bangkok timezone (+07:00) เพื่อไม่ให้ range ครอบ doc วันผิด
  // Bangkok midnight Sept 5 = 2025-09-04T17:00:00Z → ถ้าใช้ UTC range จะ miss วันนี้และ return วันถัดไปแทน
  const scanDateStart = new Date(`${workDateStr}T00:00:00.000+07:00`);  // midnight Bangkok
  const scanDateEnd   = new Date(`${workDateStr}T23:59:59.999+07:00`);  // 23:59 Bangkok

  const [scanByTimestamp, scanByString] = await Promise.all([
    db.collection('scanData')
      .where('employeeNumber', '==', employeeNumber)
      .where('workDate', '>=', scanDateStart)
      .where('workDate', '<=', scanDateEnd)
      .get(),
    // Query 2: scanDate เป็น string (YYYY-MM-DD) — รองรับทั้ง 2 รูปแบบ
    db.collection('scanData')
      .where('employeeNumber', '==', employeeNumber)
      .where('scanDate', '==', workDateStr)
      .get(),
  ]);

  // รวม docs จากทั้ง 2 query โดยไม่ซ้ำกัน
  const seenIds = new Set<string>();
  const allScanDocs = [...scanByTimestamp.docs, ...scanByString.docs].filter(doc => {
    if (seenIds.has(doc.id)) return false;
    seenIds.add(doc.id);
    return true;
  });

  const activeScanDocs = allScanDocs.filter(doc => doc.data()['isDeleted'] !== true);

  // [DEBUG] log IDs ที่เจอ — ใช้เช็คว่ามี doc ซ้ำไหม (ลบออกหลัง debug เสร็จ)
  console.log(`[reconcile][DEBUG] ${employeeNumber} ${workDateStr}: found ${activeScanDocs.length} scan doc(s): [${activeScanDocs.map(d => d.id).join(', ')}]`);

  let scanNormalHours   = 0;
  let scanOtMorning     = 0;
  let scanOtNoon        = 0;
  let scanOtEvening     = 0;
  let scanDataId: string | undefined;
  let scanPunches: string[] = [];

  // Anomaly Detection: เช็คว่ามีการสแกนจากหลายโครงการในวันเดียวกันหรือไม่
  let isMultipleProjects = false;
  let multipleProjectsReason = '';

  if (activeScanDocs.length > 1) {
    const projects = activeScanDocs.map(d => d.data()['projectLocationId'] || 'Unknown');
    const uniqueProjects = [...new Set(projects)];
    if (uniqueProjects.length > 1) {
      isMultipleProjects = true;
      multipleProjectsReason = `พบข้อมูลสแกนนิ้วจากหลายโครงการในวันเดียวกัน: [${uniqueProjects.join(', ')}]`;
    }
  }

  // วนลูปบวกเวลาทั้งหมด (รองรับเคสทำงาน 2 โครงการในวันเดียว เช่น เช้า 4 ชม. บ่าย 4 ชม.)
  for (const doc of activeScanDocs) {
    const data = doc.data();
    if (!scanDataId) {
      scanDataId = doc.id; // ใช้ ID ของตัวแรกเป็นตัวแทน

      // ── อ่าน punch times ─────────────────────────────────────────────
      // punches (HH:mm) = primary | allScans (HH:mm:ss) = fallback
      if (Array.isArray(data['punches']) && data['punches'].length > 0) {
        scanPunches = data['punches'];
      } else if (Array.isArray(data['allScans']) && data['allScans'].length > 0) {
        scanPunches = (data['allScans'] as string[]).map((t: string) => t.slice(0, 5));
      } else {
        const slots = ['Time1','Time2','Time3','Time4','Time5','Time6'];
        scanPunches = slots
          .map(k => data[k] as string | undefined)
          .filter((t): t is string => !!t && t !== '-')
          .map(t => t.slice(0, 5));
      }
    }

    // ── คำนวณชั่วโมง ─────────────────────────────────────────────────
    const storedHours = (data['regularHours'] || 0) + (data['otMorningHours'] || 0)
      + (data['otNoonHours'] || 0) + (data['otEveningHours'] || 0);

    if (storedHours > 0) {
      // ใช้ field ที่ import service คำนวณไว้แล้ว (กรณี CSV bulk import)
      scanNormalHours += (data['regularHours']   || 0);
      scanOtMorning   += (data['otMorningHours'] || 0);
      scanOtNoon      += (data['otNoonHours']    || 0);
      scanOtEvening   += (data['otEveningHours'] || 0);
    } else {
      // คำนวณจาก punch times เมื่อ precomputed hours fields ไม่มี
      // Priority: punches (HH:mm) → allScans (HH:mm:ss) → Time1-6 (legacy)
      let allTimes: string[] = [];
      if (Array.isArray(data['punches']) && data['punches'].length > 0) {
        allTimes = data['punches'] as string[];             // HH:mm — ใช้โดยตรง
      } else if (Array.isArray(data['allScans']) && data['allScans'].length > 0) {
        allTimes = data['allScans'] as string[];            // HH:mm:ss — toMins รับได้อยู่แล้ว
      } else {
        allTimes = (['Time1','Time2','Time3','Time4','Time5','Time6'] as const)
          .map(k => data[k] as string | undefined)
          .filter((t): t is string => !!t && t !== '-');
      }

      if (allTimes.length >= 2) {
        // แปลง HH:mm หรือ HH:mm:ss → นาทีนับจากเที่ยงคืน (รองรับทศนิยมวินาที)
        const toMins = (t: string) => {
          const parts = t.split(':').map(Number);
          return parts[0] * 60 + (parts[1] || 0) + ((parts[2] || 0) / 60);
        };
        const scanMins = allTimes.map(toMins).sort((a, b) => a - b);
        const firstScan = scanMins[0];
        const lastScan  = scanMins[scanMins.length - 1];

        // ── Regular hours (08:00–17:00 หักพักกลางวัน 1 ชม.) ──────────────
        if (firstScan < 720 && lastScan >= 1020) {
          const effectiveStart = Math.max(firstScan, 480);  // ไม่นับก่อน 08:00
          const effectiveEnd   = Math.min(lastScan, 1020);  // ไม่นับหลัง 17:00
          if (effectiveEnd > effectiveStart) {
            let workMins = effectiveEnd - effectiveStart;
            if (effectiveStart < 720 && effectiveEnd > 780) workMins -= 60; // หักพักกลางวัน
            scanNormalHours += Math.floor(workMins / 30) * 0.5;
          }
        }

        // ── OT Morning (ก่อน 08:00) ────────────────────────────────────────
        const morningMins = scanMins.filter(m => m <= 480);
        if (morningMins.length >= 2) {
          const duration = morningMins[morningMins.length - 1] - morningMins[0];
          scanOtMorning += Math.floor(duration / 30) * 0.5;
        }

        // ── OT Evening (หลัง 18:00 ต้องอยู่ถึง 18:30 ขึ้นไป) ──────────────
        if (lastScan >= 1110) { // 18:30
          const otDuration = lastScan - 1080; // นับจาก 18:00
          if (otDuration >= 30) {
            scanOtEvening += Math.floor(otDuration / 30) * 0.5;
          }
        }
      }
    }
  }

  let totalScanHours = scanNormalHours + scanOtMorning + scanOtNoon + scanOtEvening;

  // ── hasScan: ถ้า trigger มาจาก onScanDataChanged จะมี triggerDocId เสมอ
  // ใช้เป็น fallback กรณี query พลาดเพราะ field type ไม่ตรง
  let hasScan = activeScanDocs.length > 0;

  if (!hasScan && triggerDocId && triggerDocData && triggerDocData['isDeleted'] !== true) {
    console.warn(`[reconcile] Query ไม่เจอ scan docs สำหรับ ${employeeNumber} วันที่ ${workDateStr} — ใช้ข้อมูลจาก trigger doc แทน`);
    hasScan    = true;
    scanDataId = triggerDocId;

    // อ่าน punch times จาก trigger doc
    if (Array.isArray(triggerDocData['punches']) && triggerDocData['punches'].length > 0) {
      scanPunches = triggerDocData['punches'];
    } else if (Array.isArray(triggerDocData['allScans']) && triggerDocData['allScans'].length > 0) {
      scanPunches = (triggerDocData['allScans'] as string[]).map((t: string) => t.slice(0, 5));
    }

    const storedHours = (triggerDocData['regularHours'] || 0) + (triggerDocData['otMorningHours'] || 0)
      + (triggerDocData['otNoonHours'] || 0) + (triggerDocData['otEveningHours'] || 0);

    if (storedHours > 0) {
      scanNormalHours = (triggerDocData['regularHours']   || 0);
      scanOtMorning   = (triggerDocData['otMorningHours'] || 0);
      scanOtNoon      = (triggerDocData['otNoonHours']    || 0);
      scanOtEvening   = (triggerDocData['otEveningHours'] || 0);
    } else {
      // Priority: punches (HH:mm) → allScans (HH:mm:ss) → Time1-6 (legacy)
      let allTimes: string[] = [];
      if (Array.isArray(triggerDocData['punches']) && triggerDocData['punches'].length > 0) {
        allTimes = triggerDocData['punches'] as string[];
      } else if (Array.isArray(triggerDocData['allScans']) && triggerDocData['allScans'].length > 0) {
        allTimes = triggerDocData['allScans'] as string[];
      } else {
        allTimes = (['Time1','Time2','Time3','Time4','Time5','Time6'] as const)
          .map(k => triggerDocData[k] as string | undefined)
          .filter((t): t is string => !!t && t !== '-');
      }

      if (allTimes.length >= 2) {
        const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
        const sorted = [...allTimes].sort((a, b) => toMinutes(a) - toMinutes(b));
        const rawHours = (toMinutes(sorted[sorted.length - 1]) - toMinutes(sorted[0])) / 60;
        const hasLunch = toMinutes(sorted[0]) < 12 * 60 && toMinutes(sorted[sorted.length - 1]) > 13 * 60;
        scanNormalHours = hasLunch ? rawHours - 1 : rawHours;
      }
    }
    totalScanHours = scanNormalHours + scanOtMorning + scanOtNoon + scanOtEvening;
  }

  // ── Restore Manual Scan Data ─────────────────────────────────────────────
  // หาก Admin เคยแก้ไขข้อมูลสแกนนิ้วด้วยตนเองแล้ว เราจะยึดข้อมูลนั้นเป็นหลัก ไม่เอาข้อมูลดิบมาเขียนทับ
  if (preserveManualScan && existingRecord) {
    hasScan = Array.isArray(existingRecord['scanPunches']) && existingRecord['scanPunches'].length > 0;
    scanPunches = existingRecord['scanPunches'] || [];
    scanNormalHours = existingRecord['scanNormalHours'] || 0;
    scanOtMorning = existingRecord['scanOtMorningHours'] || 0;
    scanOtNoon = existingRecord['scanOtNoonHours'] || 0;
    scanOtEvening = existingRecord['scanOtEveningHours'] || 0;
    totalScanHours = existingRecord['scanDataHours'] || 0;
    scanDataId = existingRecord['scanDataId'] || scanDataId;
  }


  // ── 2. เช็ควันหยุดบริษัท (companyHolidays) ────────────────────────────────
  // Document ID = YYYY-MM-DD หรือ query by date field
  const holidayDoc = await db.collection('companyHolidays')
    .where('date', '==', workDateStr)
    .limit(1)
    .get();

  const isHoliday = !holidayDoc.empty;

  // ── 3. ดึง DailyEmployeeTimesheet จาก After-Sale Project ─────────────────
  // Document ID format: {employeeNumber}_{YYYY-MM-DD}
  const timesheetId = `${employeeNumber}_${workDateStr}`;
  const timesheetDoc = await afterSaleDb
    .collection('DailyEmployeeTimesheets')
    .doc(timesheetId)
    .get();

  let timesheet: DailyEmployeeTimesheet | null = null;
  // แยกชั่วโมง timesheet แต่ละประเภท
  let tsNormalHours = 0;
  let tsOtMorning   = 0;
  let tsOtNoon      = 0;
  let tsOtEvening   = 0;
  let totalTimesheetHours = 0;
  let leaveEntries: LeaveEntry[] = [];
  let totalLeaveHours = 0;
  let dailyReportPhotos: string[] | null = null;
  let dailyReportPunches: string[] = [];

  if (timesheetDoc.exists) {
    timesheet = timesheetDoc.data() as DailyEmployeeTimesheet;

    tsNormalHours = (timesheet.expectedHours?.normal    || 0);
    tsOtMorning   = (timesheet.expectedHours?.otMorning || 0);
    tsOtNoon      = (timesheet.expectedHours?.otNoon    || 0);
    tsOtEvening   = (timesheet.expectedHours?.otEvening || 0);
    totalTimesheetHours = tsNormalHours + tsOtMorning + tsOtNoon + tsOtEvening;

    // สกัด punches จาก shiftTimes (เหมือนใน ReconciliationService)
    if (timesheet.shiftTimes) {
      const punches: string[] = [];
      const extractPunches = (timeStr?: string) => {
        if (!timeStr) return;
        const parts = timeStr.split('-').map(s => s.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
          punches.push(parts[0], parts[1]);
        }
      };
      if (timesheet.expectedShifts) {
        if (timesheet.expectedShifts.otMorning) extractPunches(timesheet.shiftTimes.otMorning);
        if (timesheet.expectedShifts.normal)    extractPunches(timesheet.shiftTimes.day);
        if (timesheet.expectedShifts.otNoon)    extractPunches(timesheet.shiftTimes.otNoon);
        if (timesheet.expectedShifts.otEvening) extractPunches(timesheet.shiftTimes.otEvening);
      } else {
        extractPunches(timesheet.shiftTimes.otMorning);
        extractPunches(timesheet.shiftTimes.day);
        extractPunches(timesheet.shiftTimes.otNoon);
        extractPunches(timesheet.shiftTimes.otEvening);
      }
      if (punches.length > 0) {
        dailyReportPunches = punches.sort((a, b) => a.localeCompare(b));
      }
    }

    // Handle legacy 'leave' array if present
    if (timesheet.leave && Array.isArray(timesheet.leave)) {
      leaveEntries = timesheet.leave;
      totalLeaveHours = leaveEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    }
    // Handle new leave structure (leaveType / leaveStatus / leaveShifts)
    else if (timesheet.leaveStatus || timesheet.leaveType) {
      const isFullDay = timesheet.leaveStatus?.isFullDay;
      const shifts = timesheet.leaveStatus?.leaveShifts || timesheet.leaveShifts;
      const times = timesheet.leaveStatus?.leaveTimes || timesheet.leaveTimes;
      const lType = timesheet.leaveStatus?.leaveType || timesheet.leaveType || 'Leave';
      
      let calculatedHours = 0;
      let desc = 'Full Day';
      let timeRange: string | undefined = undefined;

      if (isFullDay) {
        calculatedHours = 8;
        timeRange = '08:00-17:00';
      } else if (times?.custom) {
        desc = times.custom;
        timeRange = times.custom.replace(/\s/g, '');
        const parts = times.custom.split('-').map((s: string) => s.trim());
        if (parts.length === 2) {
          const [startH, startM] = parts[0].split(':').map(Number);
          const [endH, endM] = parts[1].split(':').map(Number);
          if (!isNaN(startH) && !isNaN(endH)) {
            let diff = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
            if (startH < 12 && endH >= 13) diff -= 1;
            if (diff > 0) calculatedHours += diff;
          }
        }
      } else if (shifts?.morning) {
        calculatedHours = 4;
        desc = 'Morning';
        timeRange = '08:00-12:00';
      } else if (shifts?.afternoon) {
        calculatedHours = 4;
        desc = 'Afternoon';
        timeRange = '13:00-17:00';
      } else if (shifts?.custom) {
        calculatedHours = 4;
        desc = 'Partial';
      } else {
        desc = 'Partial';
      }

      if (calculatedHours > 0) {
        totalLeaveHours = calculatedHours;
        leaveEntries.push({
          hours: calculatedHours,
          type: lType,
          description: desc,
          timeRange,
        } as any);
      }
    }

    if (timesheet.photos?.laborByShift) {
      dailyReportPhotos = timesheet.photos.laborByShift as any;
    } else {
      dailyReportPhotos = null;
    }
  }

  // ── 4. ตัดสิน Status — punch coverage logic ────────────────────────────────
  let status: ReconciliationStatus;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let isLate = false;
  let isEarlyLeave = false;
  let conflictNote: string | null | undefined;

  const hasTimesheet = timesheetDoc.exists;
  const isLeave      = leaveEntries.length > 0 && totalLeaveHours > 0;
  const isFullDayLeave = isLeave && totalLeaveHours >= 8;
  const isPartialLeave = isLeave && totalLeaveHours > 0 && totalLeaveHours < 8;
  const noWorkHours = !totalTimesheetHours || totalTimesheetHours === 0;

  // ตรวจสอบว่ามีการลง "งาน" (Work) ใน Daily Report หรือยัง
  const dailyWorkExists = (hasTimesheet && totalTimesheetHours > 0);
  
  // ถ้าลาบางส่วน ให้ถือว่า daily report มีอยู่เสมอ (แม้จะเป็นแค่ข้อมูลลา)
  const dailyExists = dailyWorkExists || isPartialLeave;

  if (isMultipleProjects) {
    status = 'CONFLICTED';
    conflictNote = multipleProjectsReason;
  } else if (!isRegistered && hasScan) {
    status = 'UNREGISTERED_EMPLOYEE';
  } else if (isFullDayLeave && noWorkHours) {
    // --- Full Day Leave Priority ---
    status = 'LEAVE';
    if (hasScan) {
      status = 'CONFLICTED';
      conflictNote = 'ลางานเต็มวันแต่พบข้อมูลการสแกนนิ้ว';
    }
  } else if (isHoliday && noWorkHours) {
    // --- Holiday Priority ---
    status = 'HOLIDAY';
    if (hasScan) {
      status = 'CONFLICTED';
      conflictNote = 'วันหยุดแต่พบข้อมูลการสแกนนิ้ว';
    }
  } else if (isPartialLeave && !dailyWorkExists) {
    // --- Incomplete Report (Leave only, no work) ---
    if (hasScan) {
      status = 'CONFLICTED';
      conflictNote = `แจ้งลา ${totalLeaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ และพบข้อมูลสแกนนิ้ว`;
    } else {
      status = 'MISSING_DAILY';
      conflictNote = `แจ้งลา ${totalLeaveHours} ชม. แต่ใน Daily Report ไม่มีการลงเวลาทำงานส่วนที่เหลือ`;
    }
  } else if (!hasScan && !dailyExists) {
    status = 'ABSENT';
  } else if (hasScan && !dailyExists) {
    status = 'MISSING_DAILY';
  } else if (!hasScan && dailyExists) {
    status = 'MISSING_SCAN';
    if (isPartialLeave) {
      conflictNote = `ลา ${totalLeaveHours} ชม. แต่ไม่พบข้อมูลการสแกนนิ้วในช่วงเวลาทำงานที่เหลือ`;
    }
  } else {
    // มีทั้งสองแหล่ง — ใช้ punch coverage
    const effectiveScan = scanPunches;

    if (dailyReportPunches.length >= 2) {
      if (effectiveScan.length >= 2) {
        let result: PunchClassifyResult;
        if (timesheet?.shiftTimes?.day) {
          result = classifyBySegments({
            shiftTimes: timesheet.shiftTimes,
            scanPunches: effectiveScan,
            timesheetNormalHours: tsNormalHours,
            timesheetOtMorning: tsOtMorning,
            timesheetOtNoon: tsOtNoon,
            timesheetOtEvening: tsOtEvening,
            dailyReportHours: totalTimesheetHours,
            isHoliday,
            isLeave,
            leaveHours: totalLeaveHours,
          });
        } else {
          result = classifyByPunchCoverage({
            dailyReportPunches,
            scanPunches: effectiveScan,
            normalHours: tsNormalHours,
            otMorningHours: tsOtMorning,
            otNoonHours: tsOtNoon,
            otEveningHours: tsOtEvening,
          });
        }
        status = result.status;
        lateMinutes = result.lateMinutes;
        earlyLeaveMinutes = result.earlyLeaveMinutes;
        isLate = result.isLate;
        isEarlyLeave = result.isEarlyLeave;
        conflictNote = result.note;
        
        // เก็บยอดที่อนุมัติ
        updatesObj = {
          approvedNormalHours: result.approvedNormalHours,
          approvedOtMorning: result.approvedOtMorning,
          approvedOtNoon: result.approvedOtNoon,
          approvedOtEvening: result.approvedOtEvening,
          totalApprovedHours: result.totalApprovedHours,
          approvalSource: result.approvalSource,
        };
      } else {
        // มีสแกน แต่ไม่ครบ 2 ครั้ง (ไม่มีคู่เข้า-ออก) — ถือว่า CONFLICTED (กรณี B)
        status = 'CONFLICTED';
        conflictNote = effectiveScan.length === 1 
          ? `ข้อมูลสแกนนิ้วไม่เพียงพอ (พบเพียงครั้งเดียว: ${effectiveScan[0]}) — Admin ต้องเติมเวลาที่ขาด`
          : 'ไม่พบข้อมูลการสแกนนิ้ว';
        
        if (effectiveScan.length === 0) {
           status = 'MISSING_SCAN'; // ถ้าไม่มีเลยจริงๆ ค่อยเป็น MISSING_SCAN
        }
      }
    } else {
      // ไม่มีข้อมูลช่วงเวลาใน Daily Report
      status = 'MISSING_DAILY';
      conflictNote = 'Daily Report ไม่มีข้อมูลช่วงเวลาทำงาน (Shift Times)';
    }
  }

  // ── 5. Upsert ReconciliationRecord ────────────────────────────────────────
  const now = new Date();
  const newStatusEntry = {
    status,
    changedAt: now,
    changedBy: 'system',
    reason: conflictNote ?? 'Automated reconciliation via Cloud Function',
  };

  const finalDoc = await recordRef.get();

  if (finalDoc.exists) {
    const existing = finalDoc.data() as any;

    // ถ้างวดถูกปิดระหว่างที่กำลังประมวลผล — ให้หยุด
    if (existing['isLocked'] === true) {
      console.log(`[reconcile] ${employeeNumber} on ${workDateStr} became locked during processing — skip`);
      return;
    }

    const updates: Record<string, any> = {
      // ── Employee Name ────────────────────────────────────────────────────
      employeeName:         employeeName || null,
      homeProjectId:        homeProjectId || null,
      // ── Scan hours (แยก field) ────────────────────────────────────────────
      scanDataHours:        hasScan      ? totalScanHours  : null,  // ยอดรวม
      scanNormalHours:      hasScan      ? scanNormalHours : null,
      scanOtMorningHours:   hasScan      ? scanOtMorning   : null,
      scanOtNoonHours:      hasScan      ? scanOtNoon      : null,
      scanOtEveningHours:   hasScan      ? scanOtEvening   : null,
      scanPunches:          hasScan      ? scanPunches     : [],
      // ── Timesheet hours (แยก field) ──────────────────────────────────────
      timesheetHours:       hasTimesheet ? totalTimesheetHours : null,  // ยอดรวม
      timesheetNormalHours: hasTimesheet ? tsNormalHours   : null,
      timesheetOtMorning:   hasTimesheet ? tsOtMorning     : null,
      timesheetOtNoon:      hasTimesheet ? tsOtNoon        : null,
      timesheetOtEvening:   hasTimesheet ? tsOtEvening     : null,
      dailyReportPunches:   hasTimesheet ? dailyReportPunches : [],
      shiftTimes:           hasTimesheet ? timesheet?.shiftTimes : null,
      lateMinutes,
      earlyLeaveMinutes,
      isLate,
      isEarlyLeave,
      note:                 conflictNote || null,
      // ── Leave & Holiday ──────────────────────────────────────────────────
      leaveHours:           isLeave      ? totalLeaveHours : null,
      leaveEntries:         isLeave      ? leaveEntries    : null,
      medCertFileUrl:       hasTimesheet ? (timesheet?.leaveStatus?.medCertFileUrl || timesheet?.medCertFileUrl || null) : null,
      hasLeave:             isLeave      === true,
      scanDataId:           scanDataId   ?? null,
      timesheetId:          hasTimesheet ? timesheetId     : null,
      dailyReportPhotos:    hasTimesheet ? dailyReportPhotos : null,
      workLogs:             hasTimesheet ? (timesheet?.workLogs || []) : [],
      assigneeId:           hasTimesheet ? (timesheet?.AssigneesID || null) : null,
      dailyReportHistory:   hasTimesheet ? (timesheet?.editHistory || []) : [],
      isHoliday,
      updatedAt: now,
      ...updatesObj,
    };

    if (hasTimesheet && timesheet?.AssigneesID) {
      const resolvedName = await getAssigneeName(timesheet.AssigneesID);
      if (resolvedName) {
        updates['assigneeName'] = resolvedName;
      }
    } else if (!hasTimesheet) {
      // ใช้ Fallback Assignee กรณีไม่มี Daily Report
      const fallback = await getFallbackAssignee(employeeNumber);
      if (fallback) {
        updates['assigneeId'] = fallback.id;
        updates['assigneeName'] = fallback.name;
        updates['isFallbackAssignee'] = true;
      }
    }

    if (existing['status'] !== status) {
      updates['status'] = status;
      updates['statusHistory'] = [
        ...(existing['statusHistory'] || []),
        newStatusEntry,
      ];
    }

    await recordRef.update(updates);

  } else {
    const setObj: any = {
      employeeId:           employeeNumber,
      employeeNumber,
      workDate:             workDateStr,
      projectLocationId,
      homeProjectId:        homeProjectId || null,
      employeeName:         employeeName || null,
      // ── Scan hours ───────────────────────────────────────────────────────
      scanDataHours:        hasScan      ? totalScanHours  : null,
      scanNormalHours:      hasScan      ? scanNormalHours : null,
      scanOtMorningHours:   hasScan      ? scanOtMorning   : null,
      scanOtNoonHours:      hasScan      ? scanOtNoon      : null,
      scanOtEveningHours:   hasScan      ? scanOtEvening   : null,
      scanPunches:          hasScan      ? scanPunches     : [],
      // ── Timesheet hours ──────────────────────────────────────────────────
      timesheetHours:       hasTimesheet ? totalTimesheetHours : null,
      timesheetNormalHours: hasTimesheet ? tsNormalHours   : null,
      timesheetOtMorning:   hasTimesheet ? tsOtMorning     : null,
      timesheetOtNoon:      hasTimesheet ? tsOtNoon        : null,
      timesheetOtEvening:   hasTimesheet ? tsOtEvening     : null,
      dailyReportPunches:   hasTimesheet ? dailyReportPunches : [],
      shiftTimes:           hasTimesheet ? timesheet?.shiftTimes : null,
      lateMinutes,
      earlyLeaveMinutes,
      isLate,
      isEarlyLeave,
      note:                 conflictNote || null,
      // ── Leave & Holiday ──────────────────────────────────────────────────
      leaveHours:           isLeave      ? totalLeaveHours : null,
      leaveEntries:         isLeave      ? leaveEntries    : null,
      medCertFileUrl:       hasTimesheet ? (timesheet?.leaveStatus?.medCertFileUrl || timesheet?.medCertFileUrl || null) : null,
      hasLeave:             isLeave      === true,
      scanDataId:           scanDataId   ?? null,
      timesheetId:          hasTimesheet ? timesheetId     : null,
      dailyReportPhotos:    hasTimesheet ? dailyReportPhotos : null,
      workLogs:             hasTimesheet ? (timesheet?.workLogs || []) : [],
      assigneeId:           hasTimesheet ? (timesheet?.AssigneesID || null) : null,
      assigneeName:         null, // จะอัปเดตด้านล่าง
      isFallbackAssignee:   false, // จะอัปเดตด้านล่าง
      dailyReportHistory:   hasTimesheet ? (timesheet?.editHistory || []) : [],
      isHoliday,
      status,
      statusHistory:        [newStatusEntry],
      createdAt:            now,
      updatedAt:            now,
      ...updatesObj,
    };

    if (hasTimesheet && timesheet?.AssigneesID) {
      const resolvedName = await getAssigneeName(timesheet.AssigneesID);
      if (resolvedName) {
        setObj['assigneeName'] = resolvedName;
      }
    } else if (!hasTimesheet) {
      // ใช้ Fallback Assignee กรณีไม่มี Daily Report
      const fallback = await getFallbackAssignee(employeeNumber);
      if (fallback) {
        setObj['assigneeId'] = fallback.id;
        setObj['assigneeName'] = fallback.name;
        setObj['isFallbackAssignee'] = true;
      }
    }

    await recordRef.set(setObj);
  }

  console.log(`[onScanDataChanged] Reconciled ${employeeNumber} on ${workDateStr} → ${status} (scan:${totalScanHours}h / timesheet:${totalTimesheetHours}h)`);
}

// ─── Cloud Function Export ────────────────────────────────────────────────────

export const onScanDataChanged = firestore
  .onDocumentWritten('scanData/{docId}', async (event) => {
    const docId = event.params['docId'];

    // Document ถูกลบ → ข้าม
    if (!event.data?.after.exists) {
      console.log(`[onScanDataChanged] ${docId} deleted — skip`);
      return null;
    }

    const data = event.data.after.data();
    if (!data) return null;

    // isDeleted = true → ข้าม
    if (data['isDeleted'] === true) {
      console.log(`[onScanDataChanged] ${docId} marked deleted — skip`);
      return null;
    }

    const employeeNumber: string = String(data['employeeNumber'] || data['employeeId'] || '').trim();
    const projectLocationId: string = String(data['projectLocationId'] || '').trim();

    // แปลง workDate → YYYY-MM-DD
    let workDateStr = '';
    if (data['scanDate'] && typeof data['scanDate'] === 'string') {
      workDateStr = data['scanDate'];
    } else if (data['workDate']) {
      const raw = data['workDate'];
      const wd  = raw?.toDate ? raw.toDate() : new Date(raw as string);
      workDateStr = wd.toISOString().split('T')[0];
    }

    if (!employeeNumber || !workDateStr) {
      console.warn(`[onScanDataChanged] Missing required fields for ${docId}: emp="${employeeNumber}" date="${workDateStr}"`);
      return null;
    }

    try {
      // ส่ง docId + data เพื่อ guarantee hasScan = true แม้ date query พลาด
      await reconcile(employeeNumber, workDateStr, projectLocationId, docId, data);
    } catch (err) {
      console.error(`[onScanDataChanged] Error for ${employeeNumber} on ${workDateStr}:`, err);
    }

    return null;
  });

// ─── onEmployeeChanged ────────────────────────────────────────────────────────

/**
 * onEmployeeChanged
 * Trigger เมื่อมีการเพิ่ม/แก้ไขพนักงาน (dailyContractors)
 * - ดึง employeeId ที่เปลี่ยนแปลง
 * - ค้นหา reconciliationRecords ของพนักงานคนที่สถานะ = 'UNREGISTERED_EMPLOYEE'
 * - สั่งประมวลผลใหม่โดยใช้ข้อมูลจากอดีต (snapshot)
 */
export const onEmployeeChanged = firestore
  .onDocumentWritten('dailyContractors/{docId}', async (event) => {
    if (!event.data?.after.exists) return null;

    const afterData = event.data.after.data();
    if (!afterData) return null;

    const employeeId = String(afterData['employeeId'] || event.params['docId'] || '').trim();
    if (!employeeId) return null;

    // ค้นหาเรคคอร์ดที่ค้างอยู่ที่สถานะ UNREGISTERED_EMPLOYEE 
    // ใช้ 'in' query เพื่อเผื่อเคสที่ข้อมูลเก่ามี space ต่อท้ายหลุดเข้ามา
    const possibleIds = [employeeId, `${employeeId} `];
    const recordsSnap = await db.collection('reconciliationRecords')
      .where('employeeId', 'in', possibleIds)
      .where('status', '==', 'UNREGISTERED_EMPLOYEE')
      .get();

    if (recordsSnap.empty) return null;

    console.log(`[onEmployeeChanged] Found ${recordsSnap.size} UNREGISTERED_EMPLOYEE records for ${employeeId}. Reconciling...`);

    // วนลูปสั่งประมวลผลใหม่
    for (const doc of recordsSnap.docs) {
      const recordData = doc.data();
      const workDateStr = String(recordData['workDate'] || '');
      // ดึง projectLocationId จากอดีตที่ติดมากับ record ไม่ดึงจาก profile ปัจจุบัน
      const projectLocationId = String(recordData['projectLocationId'] || '');

      if (!workDateStr) continue;

      try {
        console.log(`[onEmployeeChanged] Reconciling past record: ${employeeId} on ${workDateStr} (Project: ${projectLocationId})`);
        await reconcile(employeeId, workDateStr, projectLocationId);
      } catch (err) {
        console.error(`[onEmployeeChanged] Failed to reconcile ${employeeId} on ${workDateStr}:`, err);
      }
    }

    return null;
  });

// ─── checkDailyAbsence ────────────────────────────────────────────────────────

/**
 * checkDailyAbsence(workDateStr)
 * ตรวจหาพนักงาน Active ที่ไม่มีข้อมูลใดๆ ในวันที่กำหนด แล้วเขียนสถานะ ABSENT
 *
 * Logic:
 *  1. ดึง dailyContractors ที่ isActive = true ทั้งหมด
 *  2. เช็คว่าวันนั้นเป็นวันอาทิตย์หรือวันหยุดบริษัทไหม → ถ้าใช่ หยุดทำงานเลย (ไม่ต้อง loop)
 *  3. สำหรับแต่ละพนักงาน:
 *     - ถ้า reconciliationRecord วันนั้นมีอยู่แล้ว (ไม่ว่า status อะไร) → ข้าม
 *     - ถ้ายังไม่มี → เขียน ABSENT
 */
async function checkDailyAbsence(workDateStr: string): Promise<void> {
  console.log(`[checkDailyAbsence] Starting for date: ${workDateStr}`);

  const targetDate = new Date(`${workDateStr}T00:00:00.000Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = อาทิตย์

  // ── 1. เช็ควันหยุดบริษัท (ดึงตามปีและเปรียบเทียบในระดับวันแบบ UTC) ──────────────
  const targetYear = new Date(`${workDateStr}T00:00:00.000Z`).getUTCFullYear();
  const holidaySnap = await db.collection('companyHolidays')
    .doc(String(targetYear))
    .collection('holidays')
    .get();

  const isGlobalHoliday = holidaySnap.docs.some(doc => {
    const data = doc.data();
    if (!data.date) return false;
    const d = typeof data.date.toDate === 'function' ? data.date.toDate() : new Date(data.date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === workDateStr;
  });

  // ── 1.5. ดึงข้อมูล Project Locations เพื่อตรวจสอบการตั้งค่าวันทำงาน ───────────
  const projectsSnap = await db.collection('Project').get();
  const projectConfigMap = new Map<string, { workDays: number[], followCompanyHoliday: boolean }>();
  
  projectsSnap.docs.forEach(doc => {
    const data = doc.data();
    projectConfigMap.set(doc.id, {
      workDays: data.workDays !== undefined ? data.workDays : [1, 2, 3, 4, 5, 6], // default จันทร์-เสาร์
      followCompanyHoliday: data.followCompanyHoliday !== undefined ? data.followCompanyHoliday : true, // default หยุดตามบริษัท
    });
  });

  // ── 2. ดึงพนักงาน Active ทั้งหมด ───────────────────────────────────────────
  const contractorsSnap = await db.collection('dailyContractors')
    .where('isActive', '==', true)
    .get();

  if (contractorsSnap.empty) {
    console.log(`[checkDailyAbsence] No active contractors found`);
    return;
  }

  console.log(`[checkDailyAbsence] Checking ${contractorsSnap.size} active employees for ${workDateStr}`);

  const now = admin.firestore.Timestamp.now();
  let absentCount = 0;
  let skippedCount = 0;

  // ── 3. Loop แต่ละพนักงาน ────────────────────────────────────────────────────
  // ใช้ batch เพื่อ performance (max 500 writes ต่อ batch)
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchWriteCount = 0;

  for (const contractorDoc of contractorsSnap.docs) {
    const contractorData = contractorDoc.data();
    const employeeId: string = contractorData['employeeId'] || contractorDoc.id;
    const projectLocationId: string = contractorData['projectLocationId'] || '';

    const recordId = generateReconciliationId(employeeId, workDateStr);
    const recordRef = db.collection('reconciliationRecords').doc(recordId);

    // ตรวจสอบการตั้งค่าของโครงการ
    const pConfig = projectConfigMap.get(projectLocationId) || { workDays: [1, 2, 3, 4, 5, 6], followCompanyHoliday: true };

    // ถ้าวันนี้ไม่ใช่วันทำงานของโครงการนี้ → ข้าม
    if (!pConfig.workDays.includes(dayOfWeek)) {
      skippedCount++;
      continue;
    }

    // ถ้าวันนี้เป็นวันหยุดบริษัท และโครงการนี้หยุดตามบริษัท → ข้าม
    if (isGlobalHoliday && pConfig.followCompanyHoliday) {
      skippedCount++;
      continue;
    }

    // ตรวจว่ามี record อยู่แล้วไหม
    const existingSnap = await recordRef.get();
    if (existingSnap.exists) {
      skippedCount++;
      continue; // มีอยู่แล้ว (MATCHED / MISSING_SCAN / CONFLICTED ฯลฯ) → ข้าม
    }

    // ไม่มีข้อมูลเลย → ABSENT
    // หมายเหตุ: projectLocationId จาก dailyContractors = homeProjectId (สังกัดถาวร)
    // ต้อง set homeProjectId ด้วย เพื่อให้ backend query (buildBaseQuery) กรองเจอ

    // ดึง fallback assignee จาก foremanUsage ก่อน write
    const fallback = await getFallbackAssignee(employeeId);

    currentBatch.set(recordRef, {
      employeeId,
      employeeName:      contractorData['name']          || null,
      workDate:          workDateStr,
      projectLocationId,
      homeProjectId:     projectLocationId,              // ← ใช้ค่าเดียวกัน (สังกัดถาวร)
      dailyReportHours:  null,
      scanDataHours:     null,
      assigneeId:        fallback?.id   || null,
      assigneeName:      fallback?.name || null,
      isFallbackAssignee: fallback != null,
      status:            'ABSENT' as ReconciliationStatus,
      statusHistory: [{
        status:    'ABSENT',
        changedAt: now,
        changedBy: 'system',
        reason:    'No scan and no daily report found for this workday',
      }],
      createdAt: now,
      updatedAt: now,
    });

    batchWriteCount++;
    absentCount++;

    // Firestore batch limit = 500 writes
    if (batchWriteCount >= 499) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      batchWriteCount = 0;
    }
  }

  // Commit batch ที่เหลือ
  if (batchWriteCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map(b => b.commit()));

  console.log(`[checkDailyAbsence] Done for ${workDateStr}: absent=${absentCount}, skipped=${skippedCount}`);
}

// ─── Scheduled Function — รันทุกวัน 23:00 Bangkok Time (+07:00) ──────────────

export const scheduledAbsenceCheck = (
  require('firebase-functions') as typeof import('firebase-functions')
).scheduler
  .onSchedule({
    schedule: '0 16 * * *',  // 23:00 Bangkok = 16:00 UTC
    timeZone: 'UTC',
  }, async () => {
    // workDate = วันปัจจุบัน (Bangkok time)
    const now = new Date();
    // แปลงเป็น Bangkok time (UTC+7)
    const bangkokOffset = 7 * 60 * 60 * 1000;
    const bangkokNow = new Date(now.getTime() + bangkokOffset);
    const workDateStr = bangkokNow.toISOString().split('T')[0];

    try {
      await checkDailyAbsence(workDateStr);
    } catch (err) {
      console.error(`[scheduledAbsenceCheck] Error for ${workDateStr}:`, err);
    }
  });

// ─── Wage Period Lock Trigger ──────────────────────────────────────────────────

/**
 * onWagePeriodApproved
 * เมื่อ admin เปลี่ยนสถานะ wagePeriod เป็น 'approve' (หรือ 'approved')
 * ให้ไปไล่ล็อก (isLocked: true) reconciliationRecords ทุกตัวในช่วงวันที่นั้น
 */
export const onWagePeriodApproved = firestore
  .onDocumentUpdated('wagePeriods/{periodId}', async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) return null;

    const beforeStatus = beforeData['status'];
    const afterStatus = afterData['status'];

    // ทำงานเฉพาะเมื่อ status ถูกเปลี่ยนเป็น approve หรือ approved
    if (beforeStatus !== afterStatus && (afterStatus === 'approve' || afterStatus === 'approved')) {
      const startDateRaw = afterData['startDate'];
      const endDateRaw = afterData['endDate'];

      if (!startDateRaw || !endDateRaw) {
        console.error(`[onWagePeriodApproved] Missing startDate or endDate for period ${event.params['periodId']}`);
        return null;
      }

      const startDate = startDateRaw.toDate ? startDateRaw.toDate() : new Date(startDateRaw);
      const endDate = endDateRaw.toDate ? endDateRaw.toDate() : new Date(endDateRaw);

      // ปรับให้ครอบคลุมเวลา 00:00:00 ถึง 23:59:59 (เวลาไทย)
      // แต่เนื่องจาก workDate ใน reconciliationRecords เป็น string YYYY-MM-DD
      // เราสามารถ query ง่ายๆ ด้วยการเปรียบเทียบ string ได้เลย (YYYY-MM-DD เรียงลำดับได้)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`[onWagePeriodApproved] Locking period ${event.params['periodId']}: ${startDateStr} to ${endDateStr}`);

      // Query reconciliationRecords ระหว่างวันที่
      const recordsSnap = await db.collection('reconciliationRecords')
        .where('workDate', '>=', startDateStr)
        .where('workDate', '<=', endDateStr)
        .get();

      if (recordsSnap.empty) {
        console.log(`[onWagePeriodApproved] No reconciliation records found to lock.`);
        return null;
      }

      const batches: admin.firestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let count = 0;

      for (const doc of recordsSnap.docs) {
        // Skip ถ้า lock อยู่แล้ว
        if (doc.data()['isLocked'] === true) continue;

        currentBatch.update(doc.ref, { 
          isLocked: true,
          updatedAt: admin.firestore.Timestamp.now()
        });
        count++;

        if (count >= 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          count = 0;
        }
      }

      if (count > 0) {
        batches.push(currentBatch);
      }

      await Promise.all(batches.map(b => b.commit()));
      console.log(`[onWagePeriodApproved] Successfully locked ${recordsSnap.size} records.`);
    }

    return null;
  });

// ─── HTTP Webhook for Timesheet Changes ───────────────────────────────────────

/**
 * webhookTimesheetChanged
 * รับ HTTP Post Request จากโปรเจกต์ After-Sale เมื่อมีการแก้ไข Daily Report
 * Body คาดหวัง: { employeeNumber: 'xxx', workDate: 'YYYY-MM-DD', projectLocationId: 'xxx' }
 */
export const webhookTimesheetChanged = (
  require('firebase-functions') as typeof import('firebase-functions')
).https.onRequest(async (req, res) => {
  // รองรับเฉพาะ POST request
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { employeeNumber, workDate, projectLocationId } = req.body;

  if (!employeeNumber || !workDate) {
    res.status(400).send('Missing required fields: employeeNumber, workDate');
    return;
  }

  console.log(`[webhookTimesheetChanged] Received update for ${employeeNumber} on ${workDate}`);

  try {
    // รันกระบวนการ reconcile ใหม่ทันที
    await reconcile(String(employeeNumber), String(workDate), String(projectLocationId || ''));
    res.status(200).send({ success: true, message: 'Reconciliation triggered successfully' });
  } catch (error: any) {
    console.error(`[webhookTimesheetChanged] Error:`, error);
    res.status(500).send({ success: false, error: error.message });
  }
});

// ─── Reconciliation Records Trigger (Foreman Usage Tracking) ───────────────────

/**
 * onReconciliationChanged
 * เมื่อมีการสร้าง แก้ไข หรือลบ reconciliationRecords จะทำการอัปเดตสถิติการถูกใช้งานโดย Foreman (foremanUsage)
 * ใน collection dailyContractors แบบอัตโนมัติ
 */
export const onReconciliationChanged = firestore
  .onDocumentWritten('reconciliationRecords/{docId}', async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    const employeeId = afterData?.employeeId || beforeData?.employeeId;
    if (!employeeId) return null;

    const beforeAssigneeId = beforeData?.assigneeId;
    const afterAssigneeId = afterData?.assigneeId;
    const afterAssigneeName = afterData?.assigneeName;

    // ถ้าไม่มีการเปลี่ยนแปลงของ assigneeId ให้ข้าม
    if (beforeAssigneeId === afterAssigneeId) {
      return null;
    }

    const dcRef = db.collection('dailyContractors').doc(`DC-${employeeId}`);
    
    // หา Document Reference ของ DailyContractor
    let targetRef = dcRef;
    const dcDoc = await dcRef.get();
    if (!dcDoc.exists) {
      const altDoc = await db.collection('dailyContractors').doc(employeeId).get();
      if (altDoc.exists) {
        targetRef = db.collection('dailyContractors').doc(employeeId);
      } else {
         const qSnap = await db.collection('dailyContractors').where('employeeId', '==', employeeId).limit(1).get();
         if (!qSnap.empty) {
            targetRef = qSnap.docs[0].ref;
         } else {
            console.warn(`[onReconciliationChanged] DailyContractor not found for employeeId=${employeeId}`);
            return null; // ข้ามการทำงานถ้าไม่เจอพนักงาน
         }
      }
    }

    const updates: Record<string, any> = {};

    // 1. Decrement old assignee if exists
    if (beforeAssigneeId) {
      updates[`foremanUsage.${beforeAssigneeId}.count`] = admin.firestore.FieldValue.increment(-1);
    }

    // 2. Increment new assignee if exists
    if (afterAssigneeId) {
      updates[`foremanUsage.${afterAssigneeId}.count`] = admin.firestore.FieldValue.increment(1);
      
      let finalAssigneeName = afterAssigneeName;
      if (!finalAssigneeName || finalAssigneeName === 'Unknown') {
        const resolvedName = await getAssigneeName(afterAssigneeId);
        if (resolvedName) {
          finalAssigneeName = resolvedName;
        }
      }

      if (finalAssigneeName && finalAssigneeName !== 'Unknown') {
        updates[`foremanUsage.${afterAssigneeId}.name`] = finalAssigneeName;
      } else if (afterAssigneeName) {
        updates[`foremanUsage.${afterAssigneeId}.name`] = afterAssigneeName;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await targetRef.update(updates);
        console.log(`[onReconciliationChanged] Updated foremanUsage for ${employeeId}. Old: ${beforeAssigneeId}, New: ${afterAssigneeId}`);
      } catch (err) {
        console.error(`[onReconciliationChanged] Error updating foremanUsage for ${employeeId}:`, err);
      }
    }

    return null;
  });

