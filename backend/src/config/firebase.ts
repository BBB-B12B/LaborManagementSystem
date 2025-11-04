import admin from 'firebase-admin';
import { config } from './index';

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (config.firebase.useEmulator) {
    admin.initializeApp({
      projectId: config.firebase.projectId,
    });

    process.env.FIRESTORE_EMULATOR_HOST = config.firebase.firestoreEmulatorHost;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.firebase.authEmulatorHost;

    console.log('[firebase-admin] Initialized with emulators');
    console.log(`[firebase-admin] Firestore emulator: ${config.firebase.firestoreEmulatorHost}`);
    console.log(`[firebase-admin] Auth emulator: ${config.firebase.authEmulatorHost}`);
  } else {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      projectId: config.firebase.projectId,
    });

    console.log('[firebase-admin] Initialized with production credentials');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;
