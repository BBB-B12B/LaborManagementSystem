import { db } from '../config/firebase';

async function test() {
  const doc = await db.collection('Project').doc('P003').get();
  console.log('P003 data:', doc.data());
}

test().catch(console.error);
