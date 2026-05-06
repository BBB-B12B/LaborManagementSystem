/**
 * backfillResolvedAt.ts
 *
 * Backfill script: ค้นหา reconciliationRecords ที่:
 *   - status ปัจจุบัน = ปกติ (MATCHED / LEAVE / HOLIDAY)
 *   - resolvedAt = null (ยังไม่ถูก set)
 *   - statusHistory มีประวัติผิดปกติอยู่
 * แล้ว set resolvedAt ให้อัตโนมัติ
 *
 * วิธีรัน:
 *   npx ts-node src/scripts/backfillResolvedAt.ts
 *   หรือ (dry-run เพื่อตรวจสอบก่อน):
 *   npx ts-node src/scripts/backfillResolvedAt.ts --dry-run
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'reconciliationRecords';
const BATCH_SIZE = 400; // Firestore batch write limit = 500

const ABNORMAL_STATUSES = new Set([
  'CONFLICTED',
  'MISSING_SCAN',
  'MISSING_DAILY',
  'ABSENT',
  'UNREGISTERED_EMPLOYEE',
]);

const NORMAL_STATUSES = new Set(['MATCHED', 'LEAVE', 'HOLIDAY']);

const isDryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAbnormalHistory(statusHistory: any[]): boolean {
  if (!Array.isArray(statusHistory)) return false;
  return statusHistory.some((h) => ABNORMAL_STATUSES.has(h.status));
}

/**
 * หา timestamp ที่ควรใช้เป็น resolvedAt
 * = changedAt ของ entry สุดท้ายใน statusHistory ที่เป็นสถานะปกติ
 * ถ้าหาไม่เจอ → ใช้ updatedAt ของ document แทน
 */
function findResolvedAt(statusHistory: any[], updatedAt: any): Date {
  const normalEntries = (statusHistory || []).filter((h) => NORMAL_STATUSES.has(h.status));

  if (normalEntries.length > 0) {
    const last = normalEntries[normalEntries.length - 1];
    // changedAt อาจเป็น Firestore Timestamp หรือ string
    if (last.changedAt?.toDate) return last.changedAt.toDate();
    if (last.changedAt) return new Date(last.changedAt);
  }

  // fallback: updatedAt ของ document
  if (updatedAt?.toDate) return updatedAt.toDate();
  if (updatedAt) return new Date(updatedAt);

  return new Date();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfill() {
  console.log(`\n🔍 Backfill resolvedAt สำหรับ reconciliationRecords`);
  console.log(`   Mode: ${isDryRun ? '🧪 DRY-RUN (ไม่ได้บันทึกจริง)' : '✍️  WRITE'}\n`);

  let totalScanned = 0;
  let totalEligible = 0;
  let totalUpdated = 0;
  let lastDoc: admin.firestore.DocumentSnapshot | undefined;

  // วน paginate ทีละ batch เพื่อไม่ให้ memory เยอะเกินไป
  while (true) {
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

    const eligible: Array<{ ref: admin.firestore.DocumentReference; resolvedAt: Date }> = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const currentStatus: string = data.status;

      // ข้ามถ้า resolvedAt มีแล้ว
      if (data.resolvedAt != null) continue;

      // ต้องเป็นสถานะปกติปัจจุบัน
      if (!NORMAL_STATUSES.has(currentStatus)) continue;

      // ต้องเคยมีประวัติผิดปกติ
      if (!hasAbnormalHistory(data.statusHistory)) continue;

      const resolvedAt = findResolvedAt(data.statusHistory, data.updatedAt);
      eligible.push({ ref: doc.ref, resolvedAt });
    }

    totalEligible += eligible.length;

    console.log(
      `   📄 Scanned ${totalScanned} docs | ` +
      `Eligible this batch: ${eligible.length}`
    );

    if (!isDryRun && eligible.length > 0) {
      // แบ่ง eligible เป็น chunk ไม่เกิน 500 ต่อ batch
      for (let i = 0; i < eligible.length; i += 500) {
        const chunk = eligible.slice(i, i + 500);
        const batch = db.batch();
        for (const { ref, resolvedAt } of chunk) {
          batch.update(ref, {
            resolvedAt: admin.firestore.Timestamp.fromDate(resolvedAt),
          });
        }
        await batch.commit();
        totalUpdated += chunk.length;
      }
    }

    // ถ้าเอกสารน้อยกว่า BATCH_SIZE แสดงว่าถึงหน้าสุดท้ายแล้ว
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log('\n✅ เสร็จสิ้น');
  console.log(`   Total scanned : ${totalScanned}`);
  console.log(`   Total eligible: ${totalEligible}`);
  if (isDryRun) {
    console.log(`   Would update  : ${totalEligible} records (dry-run)`);
    console.log('\n   รัน --write จริงด้วย: npx ts-node src/scripts/backfillResolvedAt.ts');
  } else {
    console.log(`   Total updated : ${totalUpdated}`);
  }

  process.exit(0);
}

backfill().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
