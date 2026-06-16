import { collections } from '../config/collections';

async function test() {
  console.log('Testing Firestore count() aggregation...');
  
  try {
    const countStart = Date.now();
    const countResult = await collections.dailyContractors.count().get();
    console.log(`count().get() succeeded! Count: ${countResult.data().count}, took ${Date.now() - countStart} ms`);
  } catch (err: any) {
    console.error(`count().get() FAILED with error:`, err.message);
  }
  
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
