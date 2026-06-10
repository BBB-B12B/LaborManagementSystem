import { db } from '../config/firebase';

async function main() {
  const docId = '101510';
  console.log(`=== CHECKING USER BY DOC ID = "${docId}" ===`);
  const doc = await db.collection('users').doc(docId).get();
  if (doc.exists) {
    console.log('Found user document by ID!');
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  } else {
    console.log('User document NOT found by ID.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
