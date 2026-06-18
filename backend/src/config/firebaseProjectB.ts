import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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

const serviceAccount = loadAfterSaleServiceAccount();

// ตั้งชื่อ App ที่ 2 ป้องกันการชนกับ App หลัก
const afterSaleApp: admin.app.App = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccount),
    storageBucket: STORAGE_BUCKET,
  },
  'afterSaleDb'
);
const afterSaleDb: admin.firestore.Firestore = afterSaleApp.firestore();
console.log('[firebaseProjectB] Initialized After-Sale Firebase connection');

export { afterSaleDb, afterSaleApp };
