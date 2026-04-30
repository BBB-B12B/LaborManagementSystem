import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Ignore emulator, force production connection
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : undefined,
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
  });
}

const db = admin.firestore();

async function fixNames() {
  console.log('Starting reconciliation records name fix...');
  
  // 1. Get all daily contractors
  const contractorsSnap = await db.collection('dailyContractors').get();
  const contractorMap = new Map<string, string>();
  contractorsSnap.forEach(doc => {
    const data = doc.data();
    if (data.employeeId && data.name) {
      contractorMap.set(data.employeeId.trim(), data.name);
    }
  });
  console.log(`Loaded ${contractorMap.size} contractors.`);

  // 2. Get all reconciliation records
  const recordsSnap = await db.collection('reconciliationRecords').get();
  console.log(`Found ${recordsSnap.size} reconciliation records.`);

  let fixCount = 0;
  let batch = db.batch();

  for (const doc of recordsSnap.docs) {
    const data = doc.data();
    const rawId = data.employeeId || '';
    const trimmedId = rawId.trim();
    const name = contractorMap.get(trimmedId);

    // If name is missing or ID has space, update it
    if ((data.employeeName !== name && name) || rawId !== trimmedId) {
      batch.update(doc.ref, {
        employeeName: name || null,
        employeeId: trimmedId // Fix trailing spaces too
      });
      fixCount++;
      
      // Batch commit every 500
      if (fixCount % 500 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${fixCount} fixes...`);
      }
    }
  }

  if (fixCount % 500 !== 0) {
    await batch.commit();
  }

  console.log(`Finished fixing ${fixCount} records.`);
}

fixNames().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
