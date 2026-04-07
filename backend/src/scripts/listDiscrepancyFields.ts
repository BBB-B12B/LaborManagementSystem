
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

async function listFields() {
  console.log(`Checking collection: ${COLLECTIONS.SCAN_DATA_DISCREPANCIES}`);
  const snapshot = await db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES).limit(5).get();
  
  if (snapshot.empty) {
    console.log('Collection is empty!');
    return;
  }

  snapshot.forEach(doc => {
    console.log(`Doc ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

listFields().catch(console.error);
