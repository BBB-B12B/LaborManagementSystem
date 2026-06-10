import { getFirestore } from 'firebase-admin/firestore';

// Initialize firebase-admin if not already done
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  // Use emulator if configured
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  admin.initializeApp({
    projectId: 'after-sale-system',
  });
}

const db = getFirestore();

async function main() {
  const id = 'REC_950948_2026-05-25';
  const doc = await db.collection('reconciliationRecords').doc(id).get();
  if (doc.exists) {
    console.log(`=== DOCUMENT ${id} ===`);
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log(`=== DOCUMENT ${id} NOT FOUND ===`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
