import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { config } from './index';

const STORAGE_BUCKET = 'after-sale-system.firebasestorage.app';

/**
 * Load the After-Sale service-account credential.
 * Order: (1) env AFTER_SALE_KEY_BASE64 — base64-encoded JSON, used in deploy
 * (Cloud Run); (2) local after-sale-key.json file, used in local dev.
 * If neither exists we THROW — we must never silently fall back to the default
 * (main) project, because that points afterSaleDb at the wrong Firestore and
 * causes confusing failures (e.g. FAILED_PRECONDITION on collectionGroup queries).
 */
function loadAfterSaleServiceAccount(): admin.ServiceAccount {
  const b64 = process.env.AFTER_SALE_KEY_BASE64;
  if (b64) {
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json) as admin.ServiceAccount;
    } catch (error) {
      throw new Error(
        '[firebaseProjectB] AFTER_SALE_KEY_BASE64 is set but could not be ' +
          'base64-decoded / JSON-parsed: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  const serviceAccountPath = path.resolve(__dirname, 'after-sale-key.json');
  if (fs.existsSync(serviceAccountPath)) {
    return require(serviceAccountPath) as admin.ServiceAccount;
  }

  throw new Error(
    '[firebaseProjectB] No After-Sale credentials found. Set AFTER_SALE_KEY_BASE64 ' +
      '(base64 of the service-account JSON) in the environment, or place ' +
      'after-sale-key.json in backend/src/config/. Refusing to fall back to the ' +
      'default project to avoid querying the wrong Firestore.'
  );
}

// [T-062] In emulator mode, connect afterSaleDb to the SAME project namespace as
// LMS (config.firebase.projectId) with NO credential — so all dev data lands in one
// emulator project and shows in the existing Emulator UI. The emulator-host env vars
// are set here too for import-order safety: the Admin SDK must see them BEFORE
// initializeApp, otherwise it would contact real Google with no credential.
// In production (else) the credential-based After-Sale init is unchanged.
let afterSaleApp: admin.app.App;
if (config.firebase.useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = config.firebase.firestoreEmulatorHost;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = config.firebase.authEmulatorHost;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = config.firebase.storageEmulatorHost;

  afterSaleApp = admin.initializeApp(
    {
      projectId: config.firebase.projectId,
      storageBucket: config.firebase.storageBucket,
    },
    'afterSaleDb'
  );
  console.log(
    `[firebaseProjectB] Emulator mode — afterSaleDb unified to LMS project ` +
      `'${config.firebase.projectId}' (no credential)`
  );
} else {
  const serviceAccount = loadAfterSaleServiceAccount();

  // ตั้งชื่อ App ที่ 2 ป้องกันการชนกับ App หลัก
  afterSaleApp = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    },
    'afterSaleDb'
  );
  console.log('[firebaseProjectB] Initialized After-Sale Firebase connection');
}

const afterSaleDb: admin.firestore.Firestore = afterSaleApp.firestore();

export { afterSaleDb, afterSaleApp };
