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

import { reconciliationService } from '../services/reconciliation/ReconciliationService';

async function generate() {
  console.log('Generating for P003, 2026-05-05...');
  await reconciliationService.generateForProject(
    'P003',
    '2026-05-05',
    '2026-05-05',
  );
  console.log('Generation complete. Checking database...');

  const doc = await db.collection('reconciliationRecords').doc('REC_200022_2026-05-05').get();
  const data = doc.data() as any;
  console.log('medCertFileUrl:', data?.medCertFileUrl);
  console.log('hasLeave:', data?.hasLeave);
  console.log('leaveHours:', data?.leaveHours);
}

generate().then(() => process.exit(0));
