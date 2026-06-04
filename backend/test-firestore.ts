import { db } from './src/config/firebase';

async function test() {
  console.log('Testing Firestore Connection...');
  try {
    const cols = await db.listCollections();
    for (const c of cols) {
      const snap = await c.get();
      console.log(`Collection: ${c.id} - Documents: ${snap.size}`);
    }
  } catch (error) {
    console.error('Error connecting to Firestore:', error);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
