import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
process.env.GOOGLE_CLOUD_DISABLE_GRPC = 'true';
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;

const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function verify() {
  console.log('Verifying Wage Data Import...');
  const snapshot = await db.collection('Wage Calculation system').limit(1).get();
  if (snapshot.empty) {
    console.log('Collection is empty!');
    return;
  }

  snapshot.forEach((doc) => {
    console.log('Found Document ID:', doc.id);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });
}

verify().catch(console.error);
