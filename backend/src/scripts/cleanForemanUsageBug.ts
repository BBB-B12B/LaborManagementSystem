import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Do not delete emulator variables so it connects to local emulator
// delete process.env.FIRESTORE_EMULATOR_HOST;
// delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
// delete process.env.FIREBASE_EMULATOR_HOST;

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : undefined,
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
  });
}

const db = admin.firestore();

async function cleanForemanUsageBug() {
  console.log('Starting cleanup of broken foremanUsage fields...');
  const snapshot = await db.collection('dailyContractors').get();
  
  let batch = db.batch();
  let updatedDocsCount = 0;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const keys = Object.keys(data);
    const updates: Record<any, any> = {};
    let hasUpdates = false;

    for (const key of keys) {
      // Find fields that literally start with "foremanUsage."
      if (key.startsWith('foremanUsage.')) {
        // Use FieldPath with a single argument to target literal dots in field names
        const fieldPath = new admin.firestore.FieldPath(key);
        updates[fieldPath as any] = admin.firestore.FieldValue.delete();
        hasUpdates = true;
        console.log(`Found broken field: "${key}" in document ${doc.id}`);
      }
    }

    if (hasUpdates) {
      batch.update(doc.ref, updates);
      updatedDocsCount++;
      batchCount++;

      // Commit batch every 500 operations to stay within Firestore limits
      if (batchCount >= 500) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
  }

  if (updatedDocsCount > 0) {
    console.log(`✅ Successfully cleaned up broken fields in ${updatedDocsCount} contractor documents.`);
  } else {
    console.log('✅ No broken fields found. Everything is clean!');
  }
}

cleanForemanUsageBug()
  .then(() => {
    console.log('Cleanup script finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error during cleanup:', error);
    process.exit(1);
  });
