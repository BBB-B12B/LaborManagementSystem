/**
 * patchAbsentHomeProjectId.ts
 *
 * Patch script: ค้นหา reconciliationRecords ที่:
 *   - status = 'ABSENT'
 *   - homeProjectId = null หรือ undefined (ถูกสร้างโดย Cloud Function ก่อน fix)
 * แล้ว set homeProjectId ให้ = projectLocationId (เพราะ dailyContractors ใช้ field เดียวกัน)
 *
 * วิธีรัน (dry-run ดูก่อน):
 *   npx ts-node src/scripts/patchAbsentHomeProjectId.ts --dry-run
 * รันจริง:
 *   npx ts-node src/scripts/patchAbsentHomeProjectId.ts
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

const COLLECTION = 'reconciliationRecords';
const BATCH_SIZE = 400;
const isDryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function patch() {
  console.log('\n🔍 Patch homeProjectId สำหรับ ABSENT records ที่ขาด field นี้');
  console.log(`   Mode: ${isDryRun ? '🧪 DRY-RUN (ไม่ได้บันทึกจริง)' : '✍️  WRITE'}\n`);

  let totalScanned = 0;
  let totalEligible = 0;
  let totalUpdated = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | undefined;

  while (true) {
    // Query ทุก records แล้วกรอง ABSENT ใน code (หลีกเลี่ยงการต้องสร้าง composite index)
    let query = db
      .collection(COLLECTION)
      .orderBy('workDate')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    if (snap.empty) break;

    lastDoc = snap.docs[snap.docs.length - 1];
    totalScanned += snap.docs.length;

    // กรองเฉพาะ docs ที่ยังไม่มี homeProjectId
    const toUpdate: Array<{ ref: admin.firestore.DocumentReference; homeProjectId: string }> = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      // กรองเฉพาะ ABSENT
      if (data['status'] !== 'ABSENT') continue;

      // ข้ามถ้ามี homeProjectId แล้ว
      if (data['homeProjectId']) continue;

      // ใช้ projectLocationId เป็น homeProjectId (ค่าเดียวกันใน dailyContractors)
      const projectLocationId: string = data['projectLocationId'] || '';
      if (!projectLocationId) {
        console.warn(`   ⚠️  ${doc.id} ไม่มีทั้ง homeProjectId และ projectLocationId — ข้าม`);
        continue;
      }

      toUpdate.push({ ref: doc.ref, homeProjectId: projectLocationId });
    }

    totalEligible += toUpdate.length;

    console.log(
      `   📄 Scanned ${totalScanned} ABSENT docs | ` +
      `Need patch this batch: ${toUpdate.length}`
    );

    if (!isDryRun && toUpdate.length > 0) {
      // แบ่งเป็น chunk ไม่เกิน 500 ต่อ batch
      for (let i = 0; i < toUpdate.length; i += 500) {
        const chunk = toUpdate.slice(i, i + 500);
        const batch = db.batch();
        for (const { ref, homeProjectId } of chunk) {
          batch.update(ref, {
            homeProjectId,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
        await batch.commit();
        totalUpdated += chunk.length;
      }
    }

    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log('\n✅ เสร็จสิ้น');
  console.log(`   Total ABSENT scanned : ${totalScanned}`);
  console.log(`   Total need patch     : ${totalEligible}`);
  if (isDryRun) {
    console.log(`   Would update         : ${totalEligible} records (dry-run)`);
    console.log('\n   รันจริงด้วย: npx ts-node src/scripts/patchAbsentHomeProjectId.ts');
  } else {
    console.log(`   Total updated        : ${totalUpdated}`);
  }

  process.exit(0);
}

patch().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
