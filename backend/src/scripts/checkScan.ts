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

async function checkScan() {
  const snap = await db.collection('scanData').where('employeeNumber', '==', '410481').get();
  if (snap.empty) {
    console.log('NO SCAN DATA FOR 410481');
  } else {
    snap.forEach(d => console.log('Scan:', d.id, d.data().workDate));
  }
}

checkScan().then(() => process.exit(0));
