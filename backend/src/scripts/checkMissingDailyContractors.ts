import * as admin from 'firebase-admin';
import path from 'path';
import { db as lmsDb } from '../config/firebase';

const serviceAccount = require(path.resolve(__dirname, '../config/after-sale-key.json'));
const asApp = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount), projectId: 'after-sale-system' },
  'check-missing-dc'
);
const asDb = asApp.firestore();

const EMPLOYEE_IDS = ['402311', '405049', '411634', '412116', '412117'];

async function main() {
  const lmsSnap = await lmsDb.collection('dailyContractors').get();
  const byEmployeeId = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  lmsSnap.forEach((d) => {
    const emp = d.data().employeeId;
    if (emp) byEmployeeId.set(String(emp), d);
  });

  for (const empId of EMPLOYEE_IDS) {
    console.log(`\n=== ${empId} ===`);
    const lmsDoc = byEmployeeId.get(empId);
    if (!lmsDoc) {
      console.log(`  LMS dailyContractors: NOT FOUND by employeeId (checking doc-id match too)`);
    } else {
      const d = lmsDoc.data();
      console.log(`  LMS docId=${lmsDoc.id} name=${d.name} department=${d.department} isActive=${d.isActive}`);
      const asDoc = await asDb.collection('dailyContractors').doc(lmsDoc.id).get();
      console.log(`  After Sale doc(${lmsDoc.id}) exists: ${asDoc.exists}`);
      if (asDoc.exists) console.log(`  After Sale data: ${JSON.stringify(asDoc.data())}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
