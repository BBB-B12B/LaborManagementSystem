import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

async function checkRecord() {
  const doc = await db.collection('reconciliationRecords').doc('REC_410481_2025-09-06').get();
  if (doc.exists) {
    console.log('REC_410481_2025-09-06 exists:', doc.data());
  } else {
    console.log('REC_410481_2025-09-06 NOT FOUND');
    // Check if it exists with space
    const docSpace = await db.collection('reconciliationRecords').doc('REC_410481 _2025-09-06').get();
    if (docSpace.exists) {
      console.log('REC_410481 _2025-09-06 exists:', docSpace.data());
    } else {
      console.log('NO RECORD FOUND AT ALL');
      const snap = await db.collection('reconciliationRecords').where('employeeId', '==', '410481').get();
      snap.forEach(d => console.log('Found by employeeId:', d.id, d.data()));
    }
  }
}

checkRecord().then(() => process.exit(0));
