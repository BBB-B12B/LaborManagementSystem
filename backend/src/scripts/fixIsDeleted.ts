import { db } from '../config/firebase';

async function main() {
  const snap = await db.collection('scanData').get();
  let count = 0;
  
  const batch = db.batch();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.isDeleted === undefined) {
      batch.update(doc.ref, { isDeleted: false });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Fixed ${count} scanData documents by adding isDeleted: false`);
  } else {
    console.log('No documents needed fixing.');
  }
}

main().catch(console.error);
