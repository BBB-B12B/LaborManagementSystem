import { collections } from './src/config/collections';
import { wagePeriodService } from './src/services/wage/WagePeriodService';

async function testQuery() {
  try {
    console.log('Testing getAll...');
    const result = await wagePeriodService.getAll({ page: 1, pageSize: 50 });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

testQuery();
