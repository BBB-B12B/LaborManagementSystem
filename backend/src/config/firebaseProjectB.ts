import * as admin from 'firebase-admin';
import path from 'path';

// โหลด Service Account จากไฟล์ JSON
const serviceAccountPath = path.resolve(__dirname, 'after-sale-key.json');

let afterSaleApp: admin.app.App;

try {
  const serviceAccount = require(serviceAccountPath);
  afterSaleApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'after-sale-system.firebasestorage.app'
  }, 'afterSaleDb'); // ตั้งชื่อ App ที่ 2 ป้องกันการชนกับ App หลัก
  console.log('[firebaseProjectB] Initialized After-Sale Firebase connection');
} catch (error) {
  console.error('[firebaseProjectB] Failed to initialize After-Sale Firebase:', error);
  // Fallback if file doesn't exist (e.g. CI/CD or before placing the file)
  // we could just use the default app or throw
  throw error;
}

export const afterSaleDb = afterSaleApp.firestore();
export { afterSaleApp };
