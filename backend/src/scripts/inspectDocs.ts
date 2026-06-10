import { db } from '../config/firebase';

async function main() {
  const ids = ['REC_200022_2026-05-21', 'REC_200030_2026-05-21'];

  for (const id of ids) {
    const doc = await db.collection('reconciliationRecords').doc(id).get();
    if (doc.exists) {
      console.log(`=== DOCUMENT ${id} ===`);
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log(`=== DOCUMENT ${id} NOT FOUND ===`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
