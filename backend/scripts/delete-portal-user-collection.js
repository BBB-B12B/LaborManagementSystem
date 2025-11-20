/**
 * Delete all documents in the legacy `User` collection.
 *
 * Safe usages:
 *   - Emulator:   FIREBASE_EMULATOR_ENABLED=true npm run delete:portal-user
 *   - Production: FIREBASE_EMULATOR_ENABLED=false and set FIREBASE_SERVICE_ACCOUNT_KEY (JSON)
 *
 * This script ONLY targets the collection named `User` (capital U).
 */

const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const useEmulator =
  (process.env.FIREBASE_EMULATOR_ENABLED || '').toLowerCase() === 'true';

if (!useEmulator) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_EMULATOR_HOST;
}

if (!admin.apps.length) {
  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-dev',
    });
    console.log('[delete-portal-user] Connected to Firebase emulator');
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      console.error(
        '[delete-portal-user] FIREBASE_SERVICE_ACCOUNT_KEY is not defined'
      );
      process.exit(1);
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      console.error(
        '[delete-portal-user] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:',
        error.message
      );
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    console.log('[delete-portal-user] Connected to Firebase production project');
  }
}

const db = admin.firestore();
const TARGET_COLLECTION = 'User'; // legacy collection (capital U)
const BATCH_SIZE = 200;

async function deleteBatch() {
  const snapshot = await db.collection(TARGET_COLLECTION).limit(BATCH_SIZE).get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function run() {
  console.log(`[delete-portal-user] Starting cleanup for collection "${TARGET_COLLECTION}"`);
  let totalDeleted = 0;

  while (true) {
    const deleted = await deleteBatch();
    totalDeleted += deleted;
    if (deleted === 0) break;
    console.log(`[delete-portal-user] Deleted ${deleted} documents (total ${totalDeleted})`);
    // Avoid overloading Firestore in production
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`[delete-portal-user] Completed. Total deleted: ${totalDeleted}`);
  process.exit(0);
}

run().catch((error) => {
  console.error('[delete-portal-user] Failed:', error);
  process.exit(1);
});
