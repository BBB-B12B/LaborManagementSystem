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
  isActive: boolean;
  projectLocationId: string;
  lastUpdated: string;
  workLogs?: any[];
  leave?: LeaveEntry[];   // ถ้ามี entries → สถานะ LEAVE
  // New Leave Structure
  leaveStatus?: { isFullDay?: boolean };
  leaveShifts?: { morning?: boolean; afternoon?: boolean };
  leaveTimes?: { morning?: string; afternoon?: string };
  leaveType?: string;
  medCertFileUrl?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateReconciliationId(employeeId: string, workDate: string): string {
  return `REC_${employeeId}_${workDate}`;
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

  const recordId = generateReconciliationId(employeeNumber, workDateStr);
  const recordRef = db.collection('reconciliationRecords').doc(recordId);

  // ── 0. ตรวจสอบสถานะการล็อกงวดงาน (isLocked) ──────────────────────────────────
  // ถ้า Admin กด Approve งวดงานแล้ว เอกสารนี้จะมี isLocked: true ห้ามแก้ไขเด็ดขาด
  const initialDoc = await recordRef.get();
  if (initialDoc.exists) {
    const existing = initialDoc.data() as any;
    if (existing['isLocked'] === true) {
      console.log(`[reconcile] ${employeeNumber} on ${workDateStr} isLocked (Wage Period Approved) — skip all processing`);
      return;
    }
  }

  // ── 1. ตรวจสอบว่าพนักงานมีในระบบ (dailyContractors) ─────────────────────
  const contractorSnap = await db.collection('dailyContractors')
    .where('employeeId', '==', employeeNumber)
    .limit(1)
    .get();

  let employeeName = '';
  if (!contractorSnap.empty) {
    employeeName = contractorSnap.docs[0].data()['name'] || '';
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
    if (!scanDataId) scanDataId = doc.id; // ใช้ ID ของตัวแรกเป็นตัวแทน
    scanNormalHours += (data['regularHours']    || 0);
    scanOtMorning   += (data['otMorningHours']  || 0);
    scanOtNoon      += (data['otNoonHours']      || 0);
    scanOtEvening   += (data['otEveningHours']  || 0);
  }

  let totalScanHours = scanNormalHours + scanOtMorning + scanOtNoon + scanOtEvening;

  // ── hasScan: ถ้า trigger มาจาก onScanDataChanged จะมี triggerDocId เสมอ
  // ใช้เป็น fallback กรณี query พลาดเพราะ field type ไม่ตรง
  let hasScan = activeScanDocs.length > 0;

  if (!hasScan && triggerDocId && triggerDocData && triggerDocData['isDeleted'] !== true) {
    console.warn(`[reconcile] Query ไม่เจอ scan docs สำหรับ ${employeeNumber} วันที่ ${workDateStr} — ใช้ข้อมูลจาก trigger doc แทน`);
    hasScan       = true;
    scanDataId    = triggerDocId;
    scanNormalHours = (triggerDocData['regularHours']   || 0);
    scanOtMorning   = (triggerDocData['otMorningHours'] || 0);
    scanOtNoon      = (triggerDocData['otNoonHours']    || 0);
    scanOtEvening   = (triggerDocData['otEveningHours'] || 0);
    totalScanHours  = scanNormalHours + scanOtMorning + scanOtNoon + scanOtEvening;
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

  if (timesheetDoc.exists) {
    timesheet = timesheetDoc.data() as DailyEmployeeTimesheet;

    tsNormalHours = (timesheet.expectedHours?.normal    || 0);
    tsOtMorning   = (timesheet.expectedHours?.otMorning || 0);
    tsOtNoon      = (timesheet.expectedHours?.otNoon    || 0);
    tsOtEvening   = (timesheet.expectedHours?.otEvening || 0);
    totalTimesheetHours = tsNormalHours + tsOtMorning + tsOtNoon + tsOtEvening;

    // Handle legacy 'leave' array if present
    if (timesheet.leave && Array.isArray(timesheet.leave)) {
      leaveEntries = timesheet.leave;
      totalLeaveHours = leaveEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    }
    // Handle new leave structure (leaveType / leaveStatus / leaveShifts)
    else if (timesheet.leaveStatus || timesheet.leaveType) {
      const isFullDay = timesheet.leaveStatus?.isFullDay;
      const morningShift = timesheet.leaveShifts?.morning;
      const afternoonShift = timesheet.leaveShifts?.afternoon;
      
      let calculatedHours = 0;
      if (isFullDay) {
        calculatedHours = 8;
      } else {
        if (morningShift) calculatedHours += 4;
        if (afternoonShift) calculatedHours += 4;
      }
      
      if (calculatedHours > 0) {
        totalLeaveHours = calculatedHours;
        leaveEntries.push({
          hours: calculatedHours,
          attachment: timesheet.medCertFileUrl || '',
          type: timesheet.leaveType || 'Unknown'
        });
      }
    }
  }

  const hasTimesheet = timesheetDoc.exists;
  const isLeave      = leaveEntries.length > 0 && totalLeaveHours > 0;

  // ── 4. ตัดสิน Status ──────────────────────────────────────────────────────
  let status: ReconciliationStatus;

  if (isMultipleProjects) {
    // ตรวจจับ Anomaly: พบข้อมูลจากหลายโครงการ
    status = 'CONFLICTED';
  } else if (!isRegistered && hasScan) {
    // ไม่มีในระบบเลย — Admin ต้องไปเพิ่มข้อมูลพนักงานก่อน
    status = 'UNREGISTERED_EMPLOYEE';
  } else if (isHoliday) {
    // วันหยุดบริษัท — ถึงแม้จะมีการสแกน ให้ถือว่า HOLIDAY
    status = 'HOLIDAY';
  } else if (isLeave) {
    // foreman mark ว่าลา (leave array มี entries)
    status = 'LEAVE';
  } else if (hasScan && hasTimesheet) {
    // มีทั้งสองแหล่ง — เปรียบเทียบชั่วโมง (tolerance ±6 นาที = 0.1 ชม.)
    const diff = Math.abs(totalScanHours - totalTimesheetHours);
    status = diff <= 0.1 ? 'MATCHED' : 'CONFLICTED';
  } else if (hasScan && !hasTimesheet) {
    // มี scan แต่ไม่มี timesheet — รอ foreman ลงข้อมูล
    status = 'MISSING_DAILY';
  } else if (!hasScan && hasTimesheet) {
    // มี timesheet แต่ไม่มี scan
    status = 'MISSING_SCAN';
  } else {
    // ไม่มีทั้งคู่ — ABSENT จะถูก generate โดย Scheduled Function แยกต่างหาก
    // กรณีนี้ไม่ควรเกิดขึ้นใน onScanDataChanged (เพราะ trigger จาก scan เสมอ)
    status = 'ABSENT';
  }

  // ── 5. Upsert ReconciliationRecord ────────────────────────────────────────
  const now = new Date();
  const newStatusEntry = {
    status,
    changedAt: now,
    changedBy: 'system',
    reason: isMultipleProjects ? multipleProjectsReason : 'Automated reconciliation via Cloud Function',
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
      // ── Scan hours (แยก field) ────────────────────────────────────────────
      scanDataHours:        hasScan      ? totalScanHours  : null,  // ยอดรวม
      scanNormalHours:      hasScan      ? scanNormalHours : null,
      scanOtMorningHours:   hasScan      ? scanOtMorning   : null,
      scanOtNoonHours:      hasScan      ? scanOtNoon      : null,
      scanOtEveningHours:   hasScan      ? scanOtEvening   : null,
      // ── Timesheet hours (แยก field) ──────────────────────────────────────
      timesheetHours:       hasTimesheet ? totalTimesheetHours : null,  // ยอดรวม
      timesheetNormalHours: hasTimesheet ? tsNormalHours   : null,
      timesheetOtMorning:   hasTimesheet ? tsOtMorning     : null,
      timesheetOtNoon:      hasTimesheet ? tsOtNoon        : null,
      timesheetOtEvening:   hasTimesheet ? tsOtEvening     : null,
      // ── Leave & Holiday ──────────────────────────────────────────────────
      leaveHours:           isLeave      ? totalLeaveHours : null,
      leaveEntries:         isLeave      ? leaveEntries    : null,
      scanDataId:           scanDataId   ?? null,
      timesheetId:          hasTimesheet ? timesheetId     : null,
      isHoliday,
      updatedAt: now,
    };

    if (existing['status'] !== status) {
      updates['status'] = status;
      updates['statusHistory'] = [
        ...(existing['statusHistory'] || []),
        newStatusEntry,
      ];
    }

    await recordRef.update(updates);

  } else {
    await recordRef.set({
      employeeId:           employeeNumber,
      employeeNumber,
      workDate:             workDateStr,
      projectLocationId,
      employeeName:         employeeName || null,
      // ── Scan hours ───────────────────────────────────────────────────────
      scanDataHours:        hasScan      ? totalScanHours  : null,
      scanNormalHours:      hasScan      ? scanNormalHours : null,
      scanOtMorningHours:   hasScan      ? scanOtMorning   : null,
      scanOtNoonHours:      hasScan      ? scanOtNoon      : null,
      scanOtEveningHours:   hasScan      ? scanOtEvening   : null,
      // ── Timesheet hours ──────────────────────────────────────────────────
      timesheetHours:       hasTimesheet ? totalTimesheetHours : null,
      timesheetNormalHours: hasTimesheet ? tsNormalHours   : null,
      timesheetOtMorning:   hasTimesheet ? tsOtMorning     : null,
      timesheetOtNoon:      hasTimesheet ? tsOtNoon        : null,
      timesheetOtEvening:   hasTimesheet ? tsOtEvening     : null,
      // ── Leave & Holiday ──────────────────────────────────────────────────
      leaveHours:           isLeave      ? totalLeaveHours : null,
      leaveEntries:         isLeave      ? leaveEntries    : null,
      scanDataId:           scanDataId   ?? null,
      timesheetId:          hasTimesheet ? timesheetId     : null,
      isHoliday,
      status,
      statusHistory:        [newStatusEntry],
      createdAt:            now,
      updatedAt:            now,
    });
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

  // ── 0. เช็คว่าเป็นวันอาทิตย์หรือเปล่า (ไม่ต้อง loop เลย) ─────────────────
  const targetDate = new Date(`${workDateStr}T00:00:00.000Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = อาทิตย์
  if (dayOfWeek === 0) {
    console.log(`[checkDailyAbsence] ${workDateStr} is Sunday — skip`);
    return;
  }

  // ── 1. เช็ควันหยุดบริษัท ────────────────────────────────────────────────────
  const holidaySnap = await db.collection('companyHolidays')
    .where('date', '==', workDateStr)
    .limit(1)
    .get();

  if (!holidaySnap.empty) {
    console.log(`[checkDailyAbsence] ${workDateStr} is a company holiday — skip`);
    return;
  }

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

    // ตรวจว่ามี record อยู่แล้วไหม
    const existingSnap = await recordRef.get();
    if (existingSnap.exists) {
      skippedCount++;
      continue; // มีอยู่แล้ว (MATCHED / MISSING_SCAN / CONFLICTED ฯลฯ) → ข้าม
    }

    // ไม่มีข้อมูลเลย → ABSENT
    currentBatch.set(recordRef, {
      employeeId,
      employeeName:      contractorData['name']          || null,
      workDate:          workDateStr,
      projectLocationId,
      dailyReportHours:  null,
      scanDataHours:     null,
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
