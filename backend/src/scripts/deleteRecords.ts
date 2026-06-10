import { db } from '../config/firebase';

async function main() {
  console.log('=== DELETING RECONCILIATION RECORDS FOR 2026-06-03 ===');
  const snap = await db
    .collection('reconciliationRecords')
    .where('workDate', '==', '2026-06-03')
    .get();
  for (const doc of snap.docs) {
    await doc.ref.delete();
    console.log(`Deleted record: ${doc.id}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
