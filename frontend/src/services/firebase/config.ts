import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Connect to emulators in development
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST
  ) {
    const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST;
    const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;

    // Auth emulator
    if (emulatorHost && !auth.emulatorConfig) {
      const [host, port] = emulatorHost.split(':');
      connectAuthEmulator(auth, `http://${host}:${port}`);
    }

    // Firestore emulator
    if (firestoreHost && !(db as any)._settings.host) {
      const [host, port] = firestoreHost.split(':');
      connectFirestoreEmulator(db, host, parseInt(port));
    }
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
