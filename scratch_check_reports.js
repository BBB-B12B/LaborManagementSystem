const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, './.env') });

const useEmulator = process.env.FIREBASE_EMULATOR_ENABLED === 'true';

if (!useEmulator) {
  console.log('Connecting to PRODUCTION Firestore...');
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_EMULATOR_HOST;
} else {
  console.log('Connecting to EMULATOR Firestore...');
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST.replace('firebase-emulator', 'localhost');
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST.replace('firebase-emulator', 'localhost');
  }
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function run() {
  console.log('Listing top-level collections...');
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} collections:`, collections.map(c => c.id));

  for (const coll of collections) {
    const snap = await coll.limit(5).get();
    console.log(`Collection "${coll.id}" has approx size/limit docs: ${snap.size}`);
    snap.docs.forEach(doc => {
      console.log(`  - Doc ID: ${doc.id}`);
    });
  }
}

run().catch(console.error);
