import { db } from '../config/firebase';

async function main() {
  console.log('=== RECONCILIATION RECORDS FOR 2026-05-24 ===');
  const snap = await db
    .collection('reconciliationRecords')
    .where('workDate', '==', '2026-05-24')
    .get();
  console.log(`Found ${snap.size} records`);
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(
      `Doc ID: "${doc.id}" | employeeId: "${data.employeeId}" | employeeName: "${data.employeeName}" | status: "${data.status}" | projectLocationId: "${data.projectLocationId}"`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
