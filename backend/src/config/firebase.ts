import admin from 'firebase-admin';
import { config } from './index';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Development: Use emulator
  if (config.nodeEnv === 'development') {
    admin.initializeApp({
      projectId: config.firebase.projectId,
    });

    // Set emulator hosts
    process.env.FIRESTORE_EMULATOR_HOST = config.firebase.firestoreEmulatorHost;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.firebase.authEmulatorHost;

    console.log('🔥 Firebase Admin initialized with emulators');
    console.log(`   - Firestore: ${config.firebase.firestoreEmulatorHost}`);
    console.log(`   - Auth: ${config.firebase.authEmulatorHost}`);
  } else {
    // Production: Use service account
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : undefined;

    admin.initializeApp({
      credential: serviceAccount
        ? admin.credential.cert(serviceAccount)
        : admin.credential.applicationDefault(),
      projectId: config.firebase.projectId,
    });

    console.log('🔥 Firebase Admin initialized for production');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;
