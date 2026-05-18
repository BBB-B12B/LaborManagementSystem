import { db } from '../config/firebase';
import * as admin from 'firebase-admin';

function generateReconciliationId(employeeId: string, workDate: string): string {
  return `REC_${employeeId}_${workDate}`;
}

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
        try {
          const userSnap = await db.collection('users').where('Employeeid', '==', maxAssigneeId).limit(1).get();
          if (!userSnap.empty) {
            const uData = userSnap.docs[0].data();
            finalName = uData['Fullname'] || uData['name'] || uData['fullNameEn'] || uData['Fullnameen'] || 'Unknown';
          }
        } catch { /* ignore */ }
      }
      return { id: maxAssigneeId, name: finalName || 'Unknown' };
    }
  } catch (err) {
    console.error(`[getFallbackAssignee] Error for ${employeeId}:`, err);
  }
  return null;
}

async function checkDailyAbsence(workDateStr: string): Promise<void> {
  console.log(`[checkDailyAbsence] Starting for date: ${workDateStr}`);

  const targetDate = new Date(`${workDateStr}T00:00:00.000Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = อาทิตย์

  // ── 1. เช็ควันหยุดบริษัท ────────────────────────────────────────────────────
  const holidaySnap = await db.collection('companyHolidays')
    .where('date', '==', workDateStr)
    .limit(1)
    .get();

  const isGlobalHoliday = !holidaySnap.empty;

  // ── 1.5. ดึงข้อมูล Project Locations เพื่อตรวจสอบการตั้งค่าวันทำงาน ───────────
  const projectsSnap = await db.collection('projectLocations').get();
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
      continue; // มีอยู่แล้ว → ข้าม
    }

    const fallback = await getFallbackAssignee(employeeId);

    currentBatch.set(recordRef, {
      employeeId,
      employeeName:      contractorData['name']          || null,
      workDate:          workDateStr,
      projectLocationId,
      homeProjectId:     projectLocationId,
      dailyReportHours:  null,
      scanDataHours:     null,
      assigneeId:        fallback?.id   || null,
      assigneeName:      fallback?.name || null,
      isFallbackAssignee: fallback != null,
      status:            'ABSENT',
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

    if (batchWriteCount >= 499) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      batchWriteCount = 0;
    }
  }

  if (batchWriteCount > 0) {
    batches.push(currentBatch);
  }

  await Promise.all(batches.map(b => b.commit()));

  console.log(`[checkDailyAbsence] Done for ${workDateStr}: absent=${absentCount}, skipped=${skippedCount}`);
}

async function run() {
  const args = process.argv.slice(2);
  const workDate = args[0];
  if (!workDate) {
    console.error("Please provide a date in YYYY-MM-DD format. Example: npm run ts-node src/scripts/testAbsence.ts 2026-05-17");
    process.exit(1);
  }
  
  // Basic format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    console.error("Invalid date format. Must be YYYY-MM-DD.");
    process.exit(1);
  }

  await checkDailyAbsence(workDate);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
