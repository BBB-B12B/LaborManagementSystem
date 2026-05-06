/**
 * verifyFillResult.ts
 * ตรวจสอบ scanData + reconciliationRecord หลัง fillFromDailyReport
 * รัน: npx ts-node --transpile-only src/scripts/verifyFillResult.ts
 */

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({ credential: sa ? admin.credential.cert(sa) : admin.credential.applicationDefault() });
}
const db = admin.firestore();

// ══════════════════════════════════════
const SCAN_DOC_ID    = 'SCAN_200030_WH_2026-05-02';
const EMPLOYEE_NUM   = '200030';
const WORK_DATE      = '2026-05-02';
// ══════════════════════════════════════

async function verify() {
  console.log('\n═══════════════════════════════════════════');
  console.log('🔍 verifyFillResult');
  console.log(`   ScanDoc : ${SCAN_DOC_ID}`);
  console.log('═══════════════════════════════════════════\n');

  // ── ตรวจ scanData ──────────────────────────────────
  const scanSnap = await db.collection('scanData').doc(SCAN_DOC_ID).get();
  if (!scanSnap.exists) {
    console.log('❌ ไม่พบ scanData document:', SCAN_DOC_ID);
  } else {
    const sd = scanSnap.data()!;
    console.log('📦 scanData');
    console.log('   punches   :', sd.punches || sd.allScans);
    console.log('   Time1     :', sd.Time1 || '-');
    console.log('   Time2     :', sd.Time2 || '-');
    console.log('   Time3     :', sd.Time3 || '-',  '← ควรเป็น "-" ถ้า fix ถูกต้อง');
    console.log('   Time4     :', sd.Time4 || '-');
    console.log('   isManual  :', sd.isManuallyEdited);
    console.log('   regularHrs:', sd.regularHours, '| OT morning:', sd.otMorningHours, '| OT evening:', sd.otEveningHours);
  }

  // ── ตรวจ Reconciliation ────────────────────────────
  console.log('\n🔄 Reconciliation');
  const recSnap = await db.collection('reconciliationRecords')
    .where('employeeNumber', '==', EMPLOYEE_NUM)
    .where('workDate', '==', WORK_DATE)
    .limit(1)
    .get();

  if (recSnap.empty) {
    console.log('   ⚠️  ไม่พบ reconciliationRecord — reconciliation อาจยังไม่ถูก trigger');
  } else {
    const r = recSnap.docs[0].data();
    const statusIcon = r.status === 'MATCHED' ? '✅' : r.status === 'CONFLICTED' ? '❌' : '⚠️';
    console.log(`   ${statusIcon} status          : ${r.status}`);
    console.log('   scanPunches    :', r.scanPunches);
    console.log('   dailyPunches   :', r.dailyReportPunches);
    console.log('   scanNormalHrs  :', r.scanNormalHours ?? r.scanDataHours);
    console.log('   timesheetNormal:', r.timesheetNormalHours ?? r.timesheetHours);
  }
}

verify().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
