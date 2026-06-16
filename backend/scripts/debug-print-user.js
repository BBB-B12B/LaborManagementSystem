const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
}

async function run() {
  const snapshot = await admin.firestore().collection('users').get();
  console.log(`=== Raw Users in Firestore (${snapshot.size} found) ===`);
  snapshot.forEach(doc => {
    console.log(doc.id, JSON.stringify(doc.data()));
  });
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
