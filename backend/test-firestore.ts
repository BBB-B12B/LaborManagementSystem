import { db } from './src/config/firebase';

async function test() {
  console.log('Testing Firestore Connection...');
  try {
    const snapshot = await db.collection('users').limit(1).get();
    console.log('Success! Documents found:', snapshot.size);
  } catch (error) {
    console.error('Error connecting to Firestore:', error);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
