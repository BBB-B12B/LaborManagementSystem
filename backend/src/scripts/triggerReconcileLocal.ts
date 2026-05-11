import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { reconciliationService } from '../services/reconciliation/ReconciliationService';

async function run() {
  console.log('Triggering local reconcile...');
  await reconciliationService.generateForEmployee('200030', '2026-05-02', 'P002');
  console.log('Done!');
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
