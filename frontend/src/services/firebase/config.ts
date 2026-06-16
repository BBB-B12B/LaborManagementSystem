import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const shouldUseEmulators = (() => {
  const flag = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED;

  if (typeof flag === 'string') {
    return flag.trim().toLowerCase() === 'true';
  }

  return process.env.NODE_ENV === 'development';
})();

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  if (shouldUseEmulators) {
    const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost:9099';
    const firestoreEmulatorHost =
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080';

    const authWithMeta = auth as unknown as { emulatorConfig?: unknown };
    if (!authWithMeta.emulatorConfig) {
      const [host, portString] = authEmulatorHost.split(':');
      const port = Number(portString) || 9099;
      connectAuthEmulator(auth, `http://${host}:${port}`);
    }

    const firestoreSettings = db as unknown as { _settings?: { host?: string } };
    if (!firestoreSettings._settings?.host) {
      const [host, portString] = firestoreEmulatorHost.split(':');
      const port = Number(portString) || 8080;
      connectFirestoreEmulator(db, host, port);
    }
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

const afterSaleConfig = {
  apiKey: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_AFTER_SALE_FIREBASE_MEASUREMENT_ID,
};

let afterSaleApp: FirebaseApp;
let afterSaleDb: Firestore;

if (!getApps().some(a => a.name === 'afterSale')) {
  afterSaleApp = initializeApp(afterSaleConfig, 'afterSale');
  afterSaleDb = getFirestore(afterSaleApp);

  if (shouldUseEmulators) {
    const firestoreEmulatorHost =
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
    const firestoreSettings = afterSaleDb as unknown as { _settings?: { host?: string } };
    if (!firestoreSettings._settings?.host) {
      const [host, portString] = firestoreEmulatorHost.split(':');
      const port = Number(portString) || 8080;
      connectFirestoreEmulator(afterSaleDb, host, port);
    }
  }
} else {
  afterSaleApp = getApps().find(a => a.name === 'afterSale') as FirebaseApp;
  afterSaleDb = getFirestore(afterSaleApp);
}

export { app, auth, db, afterSaleDb };
