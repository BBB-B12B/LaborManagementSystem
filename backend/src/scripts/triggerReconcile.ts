import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const serviceAccount = require(path.resolve(__dirname, '../config/after-sale-key.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'after-sale-system',
  });
}

// Since ReconciliationService is in backend, let's just run it
import { reconciliationService } from '../services/reconciliation/ReconciliationService';

async function run() {
  console.log('Triggering reconcile for 200808 on 2025-08-30...');
  await reconciliationService.generateForEmployee('200808', '2025-08-30', 'WH2 : คลังสินค้าบางบ่อ');
  console.log('Done!');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
