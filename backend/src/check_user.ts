import { db } from './config/firebase';

async function checkUser() {
  console.log('--- Checking User Manit ---');
  const snapshot = await db.collection('users').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (
      data.name?.includes('มานิตย์') ||
      data.username?.includes('manit') ||
      data.employeeId === '101458'
    ) {
      console.log(`User:`, JSON.stringify(data));
    }
  }
}

checkUser()
  .then(() => console.log('Done'))
  .catch((err) => console.error(err));
