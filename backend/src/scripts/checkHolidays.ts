import { db } from '../config/firebase';

async function main() {
  console.log('=== COMPANY HOLIDAYS FOR 2026 ===');
  const snap = await db.collection('companyHolidays').doc('2026').collection('holidays').get();
  console.log(`Found ${snap.size} holidays`);
  for (const doc of snap.docs) {
    console.log(`Doc ID: "${doc.id}" | data: ${JSON.stringify(doc.data())}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
