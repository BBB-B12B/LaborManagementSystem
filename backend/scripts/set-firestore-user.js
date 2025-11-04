/**
 * Script to upsert a Firestore document for a specific user.
 *
 * Usage:
 *   node scripts/set-firestore-user.js
 *
 * The script respects FIREBASE_EMULATOR_ENABLED. When false, it uses the service
 * account JSON stored in FIREBASE_SERVICE_ACCOUNT_KEY to connect to the live project.
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
    console.log('[set-firestore-user] Connected to Firebase emulator');
  } else {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      console.error(
        '[set-firestore-user] FIREBASE_SERVICE_ACCOUNT_KEY is not defined'
      );
      process.exit(1);
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      console.error(
        '[set-firestore-user] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:',
        error.message
      );
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    console.log('[set-firestore-user] Connected to Firebase production project');
  }
}

const db = admin.firestore();

async function run() {
  const docRef = db.collection('User').doc('101527');
  const payload = {
    Employeeid: '10157',
    Fullname: '\u0e10\u0e34\u0e15\u0e34\u0020\u0e21\u0e31\u0e07\u0e01\u0e23',
    Fullnameen: 'Thiti Mungkorn',
    Password: '101527',
    Role: 'Admin',
    Username: 'thiti.m',
    UsernameLower: 'thiti.m',
  };

  try {
    await docRef.set(payload, { merge: true });
    console.log('[set-firestore-user] Document updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('[set-firestore-user] Failed to update document:', error);
    process.exit(1);
  }
}

run();
