/**
 * backfillAbsentAssignee.ts
 *
 * Patch script: ค้นหา reconciliationRecords ที่:
 *   - status = 'ABSENT'
 *   - assigneeId = null หรือ undefined (ถูกสร้างโดย checkDailyAbsence ก่อนแก้ bug)
 * แล้วดึง assigneeId / assigneeName จาก foremanUsage ใน dailyContractors
 * (โฟร์แมนที่ใช้พนักงานคนนั้นบ่อยที่สุด)
 *
 * วิธีรัน (dry-run ดูก่อน):
 *   npx ts-node src/scripts/backfillAbsentAssignee.ts --dry-run
 * รันจริง:
 *   npx ts-node src/scripts/backfillAbsentAssignee.ts
 */

import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

// ต้องลบ emulator env vars ก่อนเสมอ — script นี้รันตรงกับ Production Firestore
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const RECON_COLLECTION = 'reconciliationRecords';
const DC_COLLECTION = 'dailyContractors';
const PAGE_SIZE = 300;
const isDryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helper: ดึง fallback assignee จาก foremanUsage
// ---------------------------------------------------------------------------

interface FallbackAssignee {
  id: string;
  name: string;
}

// Cache dailyContractor docs เพื่อลด Firestore reads
const dcCache = new Map<string, admin.firestore.DocumentData | null>();

async function getFallbackAssignee(employeeId: string): Promise<FallbackAssignee | null> {
  // ตรวจ cache ก่อน
  if (dcCache.has(employeeId)) {
    const cached = dcCache.get(employeeId);
    if (!cached) return null;
    return await extractBestForeman(cached);
  }

  // ลองหา doc ด้วย ID รูปแบบต่างๆ
  let data: admin.firestore.DocumentData | null = null;

  const tryDoc = async (docId: string) => {
    const snap = await db.collection(DC_COLLECTION).doc(docId).get();
    if (snap.exists) return snap.data() ?? null;
    return null;
  };

  data = await tryDoc(`DC-${employeeId}`);
  if (!data) data = await tryDoc(employeeId);
  if (!data) {
    const qSnap = await db
      .collection(DC_COLLECTION)
      .where('employeeId', '==', employeeId)
      .limit(1)
      .get();
    if (!qSnap.empty) data = qSnap.docs[0].data();
  }

  dcCache.set(employeeId, data);
  if (!data) return null;
  return await extractBestForeman(data);
}

async function extractBestForeman(
  data: admin.firestore.DocumentData
): Promise<FallbackAssignee | null> {
  const foremanUsage = data['foremanUsage'];
  if (!foremanUsage || typeof foremanUsage !== 'object') return null;

  let maxCount = -1;
  let bestId: string | null = null;
  let bestName: string | null = null;

  for (const [foremanId, usage] of Object.entries(foremanUsage)) {
    const u = usage as { count: number; name: string };
    if (typeof u?.count === 'number' && u.count > maxCount) {
      maxCount = u.count;
      bestId = foremanId;
      bestName = u.name || null;
    }
  }

  if (bestId && maxCount > 0) {
    let finalName = bestName;
    if (!finalName || finalName === 'Unknown') {
      try {
        const userSnap = await db
          .collection('users')
          .where('Employeeid', '==', bestId)
          .limit(1)
          .get();
        if (!userSnap.empty) {
          const uData = userSnap.docs[0].data();
          finalName =
            uData['Fullname'] ||
            uData['name'] ||
            uData['fullNameEn'] ||
            uData['Fullnameen'] ||
            'Unknown';
        }
      } catch {
        /* ignore */
      }
    }
    return { id: bestId, name: finalName || 'Unknown' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfill() {
  console.log('\n🔍 Backfill assigneeId/assigneeName สำหรับ ABSENT records ที่ขาด field นี้');
  console.log(`   Mode: ${isDryRun ? '🧪 DRY-RUN (ไม่ได้บันทึกจริง)' : '✍️  WRITE'}\n`);

  let totalScanned = 0;
  let totalEligible = 0;
  let totalUpdated = 0;
  let totalNoFallback = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | undefined;

  while (true) {
    // ดึง records ทั้งหมดแบบ paginate แล้วกรอง ABSENT ใน code
    // (หลีกเลี่ยงการสร้าง composite index สำหรับ status + workDate)
    let query = db.collection(RECON_COLLECTION).orderBy('workDate', 'desc').limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    lastDoc = snap.docs[snap.docs.length - 1];
    totalScanned += snap.docs.length;

    // กรองเฉพาะ ABSENT docs ที่ยังไม่มี assigneeId
    const toUpdate: Array<{
      ref: admin.firestore.DocumentReference;
      assigneeId: string;
      assigneeName: string;
    }> = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      // กรองเฉพาะ ABSENT
      if (data['status'] !== 'ABSENT') continue;

      // ข้ามถ้ามี assigneeId อยู่แล้ว
      if (data['assigneeId']) continue;

      const employeeId: string = data['employeeId'] || '';
      if (!employeeId) {
        console.warn(`   ⚠️  ${doc.id} ไม่มี employeeId — ข้าม`);
        continue;
      }

      const fallback = await getFallbackAssignee(employeeId);
      if (!fallback) {
        totalNoFallback++;
        if (isDryRun) {
          console.log(`   ℹ️  ${doc.id} (emp: ${employeeId}) — ไม่พบ foremanUsage`);
        }
        continue;
      }

      totalEligible++;
      if (isDryRun) {
        console.log(
          `   ✅ ${doc.id} (emp: ${employeeId}) → assignee: ${fallback.name} (${fallback.id})`
        );
      }

      toUpdate.push({
        ref: doc.ref,
        assigneeId: fallback.id,
        assigneeName: fallback.name,
      });
    }

    console.log(
      `   📄 Scanned ${totalScanned} total records | ` +
        `Eligible this batch: ${toUpdate.length} | No fallback so far: ${totalNoFallback}`
    );

    if (!isDryRun && toUpdate.length > 0) {
      // แบ่งเป็น chunk ไม่เกิน 500 ต่อ batch
      for (let i = 0; i < toUpdate.length; i += 500) {
        const chunk = toUpdate.slice(i, i + 500);
        const batch = db.batch();
        for (const { ref, assigneeId, assigneeName } of chunk) {
          batch.update(ref, {
            assigneeId,
            assigneeName,
            isFallbackAssignee: true,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
        await batch.commit();
        totalUpdated += chunk.length;
        console.log(`   💾 Committed batch: ${totalUpdated} updated so far...`);
      }
    }

    if (snap.docs.length < PAGE_SIZE) break;
  }

  console.log('\n✅ เสร็จสิ้น');
  console.log(`   Total records scanned     : ${totalScanned}`);
  console.log(`   Has foremanUsage (eligible): ${totalEligible}`);
  console.log(`   No foremanUsage found      : ${totalNoFallback}`);
  if (isDryRun) {
    console.log(`   Would update               : ${totalEligible} records (dry-run)`);
    console.log('\n   รันจริงด้วย: npx ts-node src/scripts/backfillAbsentAssignee.ts');
  } else {
    console.log(`   Total updated              : ${totalUpdated}`);
  }

  process.exit(0);
}

backfill().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
