import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccount = require(path.resolve(__dirname, '../../../keys/after-sale-system-621698fcd44f.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'after-sale-system',
  });
}

const db = admin.firestore();

async function check() {
  const doc = await db.collection('DailyEmployeeTimesheets').doc('200808_2025-08-30').get();
  console.log('Photos in After Sale DB:', doc.data()?.photos);
}

check().then(() => process.exit(0)).catch(console.error);
