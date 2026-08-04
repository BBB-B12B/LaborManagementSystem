/**
 * Backfill: re-classify existing reconciliationRecords that have jobSegments,
 * now that jobSegments is authoritative (see jobSegments cutover plan).
 *
 * Usage:
 *   npx ts-node src/scripts/backfillJobSegmentsCutover.ts             (dry-run, no writes)
 *   npx ts-node src/scripts/backfillJobSegmentsCutover.ts --commit    (re-derive + write)
 *
 * Safety exclusions (report, never write):
 *   - isLocked === true records
 *   - records whose workDate falls inside a WagePeriod (matching project) with
 *     status === 'calculated' (numbers frozen for admin review, not yet approved/locked —
 *     isLocked isn't set until the period is actually approved, so this window needs its
 *     own guard here)
 */
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
if (!admin.apps.length) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

import { reconciliationService } from '../services/reconciliation/ReconciliationService';
import { classifyBySegments } from '../services/reconciliation/segmentEngine';

const COMMIT = process.argv.includes('--commit');

interface PendingWageWindow {
  projectLocationIds: Set<string>;
  startDate: Date;
  endDate: Date;
}

/** โหลดงวดค่าจ้างที่ status='calculated' (freeze ยอดแล้วแต่ยังไม่ approve) พร้อม resolve
 *  projectCode -> projectLocationId (id ของ Project doc) แบบเดียวกับที่ WagePeriodService ใช้ตอน calculateWages
 *  เพื่อกันไม่ให้ backfill ไปเขียนทับ record ที่ยอดถูก freeze ไว้รอ admin approve อยู่ */
async function loadPendingWageWindows(db: admin.firestore.Firestore): Promise<PendingWageWindow[]> {
  const periodsSnap = await db.collection('wagePeriods').where('status', '==', 'calculated').get();
  if (periodsSnap.empty) return [];

  const projectsSnap = await db.collection('Project').get();
  const projectIdsByCode = new Map<string, Set<string>>();
  projectsSnap.docs.forEach((p) => {
    const data = p.data();
    [data.code, data.projectCode].filter(Boolean).forEach((code: string) => {
      if (!projectIdsByCode.has(code)) projectIdsByCode.set(code, new Set());
      projectIdsByCode.get(code)!.add(p.id);
    });
  });

  return periodsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      projectLocationIds: projectIdsByCode.get(data.projectCode) ?? new Set<string>(),
      startDate: data.startDate.toDate(),
      endDate: data.endDate.toDate(),
    };
  });
}

function isWithinPendingWageWindow(
  workDate: string,
  projectLocationId: string,
  windows: PendingWageWindow[]
): boolean {
  const d = new Date(`${workDate}T00:00:00`);
  return windows.some(
    (w) => w.projectLocationIds.has(projectLocationId) && d >= w.startDate && d <= w.endDate
  );
}

async function run() {
  const db = admin.firestore();

  console.log('Fetching reconciliationRecords with jobSegments...');
  const candidatesSnap = await db
    .collection('reconciliationRecords')
    .where('jobSegments', '!=', null)
    .get();
  console.log(`Found ${candidatesSnap.size} candidate records.`);

  const shadowSnap = await db
    .collection('reconciliationRecords')
    .where('shadowStatus', '!=', null)
    .get();
  console.log(`(sanity check: ${shadowSnap.size} records have a computed shadowStatus)`);

  const pendingWageWindows = await loadPendingWageWindows(db);
  console.log(`Found ${pendingWageWindows.length} wage period(s) with status='calculated' to guard against.`);

  let skippedLocked = 0;
  let skippedPendingWage = 0;
  let unchanged = 0;
  const statusChanges = new Map<string, number>(); // "OLD->NEW" -> count
  const errors: { id: string; error: string }[] = [];

  for (const doc of candidatesSnap.docs) {
    const record = doc.data() as any;
    const oldStatus: string = record.status;

    if (record.isLocked === true) {
      skippedLocked++;
      continue;
    }
    if (isWithinPendingWageWindow(record.workDate, record.projectLocationId, pendingWageWindows)) {
      skippedPendingWage++;
      continue;
    }

    try {
      let newStatus: string;

      if (!COMMIT) {
        // Dry-run: pure function call ด้วยข้อมูลที่ record เก็บไว้แล้ว — ไม่เขียน DB
        const result = classifyBySegments({
          shiftTimes: record.shiftTimes,
          jobSegments: record.jobSegments,
          scanPunches: record.scanPunches ?? [],
          timesheetNormalHours: record.timesheetNormalHours,
          timesheetOtMorning: record.timesheetOtMorning,
          timesheetOtNoon: record.timesheetOtNoon,
          timesheetOtEvening: record.timesheetOtEvening,
          dailyReportHours: record.dailyReportHours,
          isHoliday: record.isHoliday,
          isLeave: (record.leaveHours ?? 0) > 0,
          leaveHours: record.leaveHours,
        });
        newStatus = result.status;
      } else {
        // Commit: re-derive จากข้อมูลต้นทางจริง (ไม่ใช่ snapshot ที่เก็บไว้) แล้วเขียนจริง
        const updated = await reconciliationService.generateForEmployee(
          record.employeeId,
          record.workDate,
          record.projectLocationId
        );
        newStatus = updated.status;
      }

      if (newStatus === oldStatus) {
        unchanged++;
      } else {
        const key = `${oldStatus} -> ${newStatus}`;
        statusChanges.set(key, (statusChanges.get(key) ?? 0) + 1);
      }
    } catch (e: any) {
      errors.push({ id: doc.id, error: e.message ?? String(e) });
    }
  }

  console.log('\n=== Report =========================================');
  console.log(`Mode: ${COMMIT ? 'COMMIT (writes applied)' : 'DRY-RUN (no writes)'}`);
  console.log(`Total candidates:        ${candidatesSnap.size}`);
  console.log(`Skipped (isLocked):      ${skippedLocked}`);
  console.log(`Skipped (pending wage):  ${skippedPendingWage}`);
  console.log(`Unchanged status:        ${unchanged}`);
  console.log(`Status changes:`);
  if (statusChanges.size === 0) {
    console.log('  (none)');
  } else {
    [...statusChanges.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([change, count]) => console.log(`  ${change}: ${count}`));
  }
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 20).forEach((e) => console.log(`  ${e.id}: ${e.error}`));
  }
  console.log('=====================================================');
  if (!COMMIT) {
    console.log('\nDry-run only — no writes were made. Re-run with --commit to apply.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
