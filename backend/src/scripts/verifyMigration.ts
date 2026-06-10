import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;
if (!admin.apps.length)
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
  });
const db = admin.firestore();

async function check() {
  console.log('Checking Firestore scanData collection...');
  const snap = await db.collection('scanData').limit(3).get();
  if (snap.empty) {
    console.log('No scanData documents found.');
    return;
  }
  snap.forEach((doc) => {
    console.log('ID:', doc.id);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}
check().catch((err) => {
  console.error(err);
  process.exit(1);
});
