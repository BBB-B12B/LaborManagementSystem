import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// Removed path

initializeApp({
  projectId: "demo-project"
});

const db = getFirestore();

async function main() {
  const snapshot = await db.collection('scanData').limit(1).get();
  if (snapshot.empty) {
    console.log('No documents found in scanData collection.');
  } else {
    console.log(JSON.stringify(snapshot.docs[0].data(), null, 2));
  }
}
main().catch(console.error);
