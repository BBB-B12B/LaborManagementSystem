import * as admin from 'firebase-admin';
import path from 'path';
import { db as lmsDb } from '../config/firebase';

const serviceAccount = require(path.resolve(__dirname, '../config/after-sale-key.json'));
const asApp = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount), projectId: 'after-sale-system' },
  'backfill-missing-dc'
);
const asDb = asApp.firestore();

const DOC_IDS = ['DC-402311', 'DC-405049', 'DC-411634', 'DC-950944', 'DC-950945'];

async function main() {
  for (const docId of DOC_IDS) {
    const lmsDoc = await lmsDb.collection('dailyContractors').doc(docId).get();
    if (!lmsDoc.exists) {
      console.log(`${docId}: SKIP — not found in Labor`);
      continue;
    }
    const d = lmsDoc.data()!;
    const payload = {
      id: docId,
      employeeId: d.employeeId || '',
      name: d.name || '',
      skillId: d.skillId || '',
      department: d.department,
      isActive: d.isActive !== false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await asDb.collection('dailyContractors').doc(docId).set(payload, { merge: true });
    console.log(`${docId}: synced -> employeeId=${payload.employeeId} name=${payload.name}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
