/**
 * checkAfterSaleEmployee.ts
 * ตรวจสอบว่ามี DailyEmployeeTimesheets ของพนักงานนี้วันไหนบ้างใน AfterSale
 * รัน: npx ts-node --transpile-only src/scripts/checkAfterSaleEmployee.ts
 */

import * as admin from 'firebase-admin';
import path from 'path';

const serviceAccount = require(path.resolve(__dirname, '../config/after-sale-key.json'));

const app = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount), projectId: 'after-sale-system' },
  'check-aftersale'
);
const db = app.firestore();

const EMPLOYEE_ID = '200030'; // ← เปลี่ยนตรงนี้

async function check() {
  console.log(`\nค้นหา DailyEmployeeTimesheets ของ ${EMPLOYEE_ID}...\n`);

  const snap = await db
    .collection('DailyEmployeeTimesheets')
    .where('employeeNumber', '==', EMPLOYEE_ID)
    .orderBy('date', 'desc')
    .limit(10)
    .get();

  if (snap.empty) {
    console.log('❌ ไม่พบข้อมูลเลย สำหรับพนักงาน:', EMPLOYEE_ID);
    return;
  }

  console.log(`✅ พบ ${snap.size} records ล่าสุด:\n`);
  snap.forEach((doc) => {
    const d = doc.data();
    console.log(`  📅 Doc ID  : ${doc.id}`);
    console.log(`     date           : ${d.date}`);
    console.log(`     expectedShifts : ${JSON.stringify(d.expectedShifts)}`);
    console.log(`     shiftTimes     : ${JSON.stringify(d.shiftTimes)}`);
    console.log(`     isActive       : ${d.isActive}`);
    console.log('');
  });
}

check()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
