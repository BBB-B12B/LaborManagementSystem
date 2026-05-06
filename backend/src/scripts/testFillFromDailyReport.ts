/**
 * testFillFromDailyReport.ts
 *
 * ทดสอบ fillFromDailyReport โดยตรง ไม่ผ่าน HTTP / token
 * รัน: npx ts-node --transpile-only src/scripts/testFillFromDailyReport.ts
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── ป้องกัน emulator ────────────────────────────────────────────────────────
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
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// ── Import service หลังจาก Firebase init แล้วเท่านั้น ─────────────────────
import('../services/scanData/ScanDataService').then(async ({ scanDataService }) => {

  // ══════════════════════════════════════════════════════
  // 🔧 ปรับค่าตรงนี้ก่อนรัน
  const EMPLOYEE_ID       = '200030';
  const WORK_DATE         = '2026-05-02';
  const PROJECT_LOCATION_ID = 'P002';
  const ADMIN_USER_ID     = 'test-script';
  // ══════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('🧪 testFillFromDailyReport');
  console.log(`   Employee : ${EMPLOYEE_ID}`);
  console.log(`   Date     : ${WORK_DATE}`);
  console.log(`   Project  : ${PROJECT_LOCATION_ID}`);
  console.log('═══════════════════════════════════════════════════\n');

  try {
    const result = await scanDataService.fillFromDailyReport(
      EMPLOYEE_ID,
      WORK_DATE,
      PROJECT_LOCATION_ID,
      ADMIN_USER_ID
    );

    console.log('✅ fillFromDailyReport สำเร็จ\n');
    console.log('📋 punches (กะที่ดึงมา):');
    console.log('   ', result.punches || (result as any).allScans || []);

    console.log('\n⏱️  Time slots:');
    for (let i = 1; i <= 10; i++) {
      const val = (result as any)[`Time${i}`];
      if (val && val !== '-' && val !== '') {
        console.log(`   Time${i}: ${val}`);
      }
    }

    console.log('\n📊 Hours:');
    console.log(`   regularHours    : ${(result as any).regularHours}`);
    console.log(`   otMorningHours  : ${(result as any).otMorningHours}`);
    console.log(`   otNoonHours     : ${(result as any).otNoonHours}`);
    console.log(`   otEveningHours  : ${(result as any).otEveningHours}`);

    console.log('\n🔖 Flags:');
    console.log(`   isManuallyEdited: ${(result as any).isManuallyEdited}`);
    console.log(`   scanData doc ID : ${result.id}`);

  } catch (err: any) {
    console.error('❌ เกิด Error:', err.message || err);
    if (err.statusCode === 404) {
      console.error('   → ไม่พบ DailyEmployeeTimesheet สำหรับพนักงาน/วันที่นี้ใน AfterSale System');
    }
  }

  process.exit(0);
});
