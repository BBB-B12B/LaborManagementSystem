import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const serviceAccount = require(path.resolve(__dirname, '../../../keys/after-sale-system-621698fcd44f.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'after-sale-system',
  });
}

// Since MatcherService is in backend, let's just run it
import { matcherService } from '../services/reconciliation/MatcherService';

async function run() {
  console.log('Triggering reconcile for 200808 on 2025-08-30...');
  await matcherService.reconcile('200808', '2025-08-30', 'WH2 : คลังสินค้าบางบ่อ');
  console.log('Done!');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
