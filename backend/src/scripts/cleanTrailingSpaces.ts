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

async function cleanTrailingSpaces() {
  console.log('Starting trailing spaces cleanup...');
  let batch = db.batch();
  let fixCount = 0;

  // 1. Clean scanData
  console.log('--- Cleaning scanData ---');
  const scanSnap = await db.collection('scanData').get();
  console.log(`Found ${scanSnap.size} scanData records.`);

  for (const doc of scanSnap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    let updates: any = {};

    const rawEmpNum = data.employeeNumber || '';
    if (rawEmpNum !== rawEmpNum.trim()) {
      updates.employeeNumber = rawEmpNum.trim();
      needsUpdate = true;
    }

    const rawEmpId = data.employeeId || '';
    if (rawEmpId !== rawEmpId.trim()) {
      updates.employeeId = rawEmpId.trim();
      needsUpdate = true;
    }

    if (needsUpdate) {
      batch.update(doc.ref, updates);
      fixCount++;

      if (fixCount % 500 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${fixCount} scanData fixes...`);
      }
    }
  }

  if (fixCount % 500 !== 0) {
    await batch.commit();
    batch = db.batch();
  }
  console.log(`Finished fixing ${fixCount} scanData records.`);

  // 2. Clean reconciliationRecords (Delete those with wrong ID format)
  console.log('\n--- Cleaning reconciliationRecords ---');
  let deleteCount = 0;
  const recSnap = await db.collection('reconciliationRecords').get();
  console.log(`Found ${recSnap.size} reconciliation records.`);

  for (const doc of recSnap.docs) {
    const data = doc.data();
    const rawId = data.employeeId || '';
    const trimmedId = rawId.trim();

    // The document ID might have been generated with the space
    const expectedId = `REC_${trimmedId}_${data.workDate}`;

    // If the actual document ID does NOT match the expected clean ID,
    // it means it was created with a space.
    if (doc.id !== expectedId) {
      // Create the clean document if it doesn't exist?
      // Actually, since the UI can regenerate them automatically or we can just run the cloud function,
      // the safest is to DELETE the dirty ones and let the system regenerate it.
      batch.delete(doc.ref);
      deleteCount++;

      if (deleteCount % 500 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Committed ${deleteCount} reconciliation deletions...`);
      }
    }
  }

  if (deleteCount % 500 !== 0) {
    await batch.commit();
  }
  console.log(`Finished deleting ${deleteCount} bad reconciliation records.`);

  console.log(
    '\nCleanup complete! Please use the "Auto Process" button in the UI to regenerate the missing records.'
  );
}

cleanTrailingSpaces()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
