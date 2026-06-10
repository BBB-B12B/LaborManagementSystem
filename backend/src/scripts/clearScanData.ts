import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
  });
}

const db = admin.firestore();

async function clearScanData() {
  console.log('Preparing to clear all scanData documents...');

  const collectionRef = db.collection('scanData');
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log('No documents found in scanData.');
    return;
  }

  console.log(`Found ${snapshot.size} documents. Starting deletion...`);

  const batchSize = 500;
  let batch = db.batch();
  let count = 0;
  let totalDeleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    totalDeleted++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`Deleted ${totalDeleted} documents...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Deleted ${totalDeleted} documents...`);
  }

  console.log('\nSuccess: scanData collection has been cleared.');
  process.exit(0);
}

clearScanData().catch((err) => {
  console.error('Failed to clear scanData:', err);
  process.exit(1);
});
