/**
 * Migration Script: Backfill homeProjectId and workLocationIds
 * ใน reconciliationRecords ที่ยังไม่มี homeProjectId
 *
 * Usage: npx ts-node src/scripts/migrateHomeProjectId.ts
 *
 * Logic:
 *   1. ดึง reconciliationRecords ทั้งหมดที่ homeProjectId == null/undefined
 *   2. สำหรับแต่ละ record ค้นหา dailyContractors ด้วย employeeId
 *   3. อัปเดต homeProjectId = contractor.projectLocationId
 *   4. อัปเดต workLocationIds = [projectLocationId] ถ้ายังว่าง
 */

import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

// ลบ emulator env vars ก่อนเสมอ — script นี้รันตรงกับ Production Firestore
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function migrate() {
  console.log('[migrate] 🚀 Starting homeProjectId migration...');

  // 1. โหลด dailyContractors ทั้งหมดเป็น map: employeeId → projectLocationId
  console.log('[migrate] Loading dailyContractors...');
  const dcSnap = await db.collection('dailyContractors').get();
  const contractorHomeMap = new Map<string, string>();

  for (const doc of dcSnap.docs) {
    const data = doc.data();
    const empId: string = data.employeeId;
    let projectId: string = data.projectLocationId;

    // Support legacy array field
    if (!projectId && Array.isArray(data.projectLocationIds) && data.projectLocationIds.length > 0) {
      projectId = data.projectLocationIds[0];
    }

    if (empId && projectId) {
      contractorHomeMap.set(empId, projectId);
    }
  }
  console.log(`[migrate] Loaded ${contractorHomeMap.size} contractors`);

  // 2. ดึง reconciliationRecords ที่ยังไม่มี homeProjectId
  //    Firestore ไม่ support != null ตรงๆ จึงต้องดึงทั้งหมดและ filter ใน memory
  console.log('[migrate] Loading reconciliationRecords (all)...');
  const recSnap = await db.collection('reconciliationRecords').get();
  const allDocs = recSnap.docs;

  const needsMigration = allDocs.filter((doc) => {
    const data = doc.data();
    return !data.homeProjectId; // ยังไม่มี homeProjectId
  });

  console.log(`[migrate] Found ${needsMigration.length} records to migrate (out of ${allDocs.length})`);

  if (needsMigration.length === 0) {
    console.log('[migrate] ✅ Nothing to migrate. Done.');
    return;
  }

  // 3. Batch update ใน chunk ขนาด 500 (Firestore limit)
  const BATCH_SIZE = 500;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < needsMigration.length; i += BATCH_SIZE) {
    const chunk = needsMigration.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      const data = doc.data();
      const empId: string = data.employeeId;
      const workProjectId: string = data.projectLocationId;

      const homeProjectId = contractorHomeMap.get(empId);

      if (!homeProjectId) {
        // ไม่เจอ contractor สำหรับ employee นี้ — ข้าม
        skipped++;
        continue;
      }

      const updateData: Record<string, any> = {
        homeProjectId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // workLocationIds: ถ้ายังว่างอยู่ ให้ตั้งเป็น [projectLocationId] ของ record นั้น
      if (!data.workLocationIds || data.workLocationIds.length === 0) {
        updateData.workLocationIds = workProjectId ? [workProjectId] : [];
      }

      batch.update(doc.ref, updateData);
      updated++;
    }

    await batch.commit();
    console.log(`[migrate] Batch ${Math.floor(i / BATCH_SIZE) + 1}: committed ${chunk.length} docs`);
  }

  console.log(`\n[migrate] ✅ Migration complete!`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped} (no contractor found)`);
  console.log(`  Total   : ${needsMigration.length}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] ❌ Error:', err);
    process.exit(1);
  });
