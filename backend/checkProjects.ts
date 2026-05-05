import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!admin.apps.length) {
  admin.initializeApp();
}

async function test() {
  const db = admin.firestore();
  const q = await db.collection('projectLocations').get();
  q.docs.forEach(d => {
    console.log(d.id, d.data().code, d.data().projectName);
  });
  process.exit(0);
}
test();
