import { reconciliationService } from './src/services/reconciliation/ReconciliationService';

async function test() {
  const result = await reconciliationService.generateForEmployee('300067', '2025-09-04', 'P002');
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}
test();
