import { db } from '../config/firebase';

async function deleteCollection(collectionPath: string, batchSize: number = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: any) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function main() {
  console.log('Clearing scanData...');
  await deleteCollection('scanData');
  console.log('scanData cleared.');

  console.log('Clearing scanDataDiscrepancies...');
  await deleteCollection('scanDataDiscrepancies');
  console.log('scanDataDiscrepancies cleared.');
  
  process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
