/**
 * Firebase Configuration for Frontend
 * Web app's Firebase configuration
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';

type FirebaseEnvKey =
  | 'NEXT_PUBLIC_FIREBASE_API_KEY'
  | 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  | 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'NEXT_PUBLIC_FIREBASE_APP_ID'
  | 'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID';

const REQUIRED_ENV_VARS: FirebaseEnvKey[] = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

function readEnv(key: FirebaseEnvKey): string | undefined {
  const value = process.env[key];

  if (!value && REQUIRED_ENV_VARS.includes(key)) {
    const message = `Missing Firebase environment variable: ${key}`;

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[firebase-config] ${message}`);
    } else {
      throw new Error(message);
    }
  }

  return value;
}

/**
 * Firebase configuration object
 */
const firebaseConfig = {
  apiKey: readEnv('NEXT_PUBLIC_FIREBASE_API_KEY') ?? '',
  authDomain: readEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') ?? '',
  projectId: readEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID') ?? '',
  storageBucket: readEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET') ?? '',
  messagingSenderId: readEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') ?? '',
  appId: readEnv('NEXT_PUBLIC_FIREBASE_APP_ID') ?? '',
  measurementId: readEnv('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID'),
};

const shouldUseEmulators = (() => {
  const flag = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED;

  if (typeof flag === 'string') {
    return flag.trim().toLowerCase() === 'true';
  }

  return process.env.NODE_ENV === 'development';
})();

/**
 * Initialize Firebase
 */
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Connect to Firebase Emulator when enabled
  if (shouldUseEmulators && typeof window !== 'undefined') {
    const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
    const firestoreEmulatorHost =
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080';

    // Connect Auth Emulator
    const authWithMeta = auth as unknown as { emulatorConfig?: unknown };
    if (!authWithMeta.emulatorConfig) {
      connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
      console.log(`[firebase-config] Connected to Auth Emulator: ${authEmulatorHost}`);
    }

    // Connect Firestore Emulator
    try {
      const [host, portString] = firestoreEmulatorHost.split(':');
      const port = Number(portString) || 8080;
      connectFirestoreEmulator(db, host, port);
      console.log(`[firebase-config] Connected to Firestore Emulator: ${firestoreEmulatorHost}`);
    } catch (error) {
      // Emulator already connected, ignore error
    }
  }

  // Analytics is only available in browser environment and production
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    analytics = getAnalytics(app);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[firebase-config] Firebase initialized successfully');
    console.log(`[firebase-config] Project ID: ${firebaseConfig.projectId || 'unknown'}`);
    console.log(`[firebase-config] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[firebase-config] Using emulators: ${shouldUseEmulators ? 'yes' : 'no'}`);
  }
} catch (error) {
  console.error('[firebase-config] Firebase initialization error:', error);
  throw error;
}

/**
 * Export Firebase services
 */
export { app, auth, db, storage, analytics };

/**
 * Export Firebase config for reference
 */
export { firebaseConfig };

/**
 * Helper function to check if Firebase is initialized
 */
export function isFirebaseInitialized(): boolean {
  return !!app && !!auth && !!db;
}

/**
 * Helper function to get current user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Export default
 */
export default {
  app,
  auth,
  db,
  storage,
  analytics,
  firebaseConfig,
  isFirebaseInitialized,
  getCurrentUser,
};
