import * as admin from 'firebase-admin';
import path from 'path';

// โหลด Service Account จากไฟล์ JSON
const serviceAccountPath = path.resolve(__dirname, 'after-sale-key.json');

let afterSaleApp: admin.app.App;
let afterSaleDb: admin.firestore.Firestore;

try {
  const serviceAccount = require(serviceAccountPath);
  afterSaleApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'after-sale-system.firebasestorage.app'
  }, 'afterSaleDb'); // ตั้งชื่อ App ที่ 2 ป้องกันการชนกับ App หลัก
  afterSaleDb = afterSaleApp.firestore();
  console.log('[firebaseProjectB] Initialized After-Sale Firebase connection');
} catch (error) {
  console.warn('[firebaseProjectB] Missing after-sale-key.json. Falling back to default Firebase app.');
  // Fallback if file doesn't exist (e.g. CI/CD or before placing the file)
  afterSaleApp = admin.app();
  afterSaleDb = admin.firestore();
}

export { afterSaleDb, afterSaleApp };
