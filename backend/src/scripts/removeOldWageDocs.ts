import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath)),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function cleanupOldDocs() {
  const collectionName = 'Wage Calculation system';
  console.log(`Cleaning up old documents in '${collectionName}'...`);

  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  let deleteCount = 0;

  snapshot.docs.forEach((doc) => {
    // Condition: Delete if ID is random (20 chars alphanumeric)
    // AND keeps the new readable ones (which have underscores or spaces)
    // Adjust regex to match standard Firebase auto-IDs (20 chars, no underscores)

    const isReadableId = doc.id.includes('_');

    if (!isReadableId) {
      // Further safety check: confirm length is 20 (typical auto-id)
      if (doc.id.length === 20) {
        batch.delete(doc.ref);
        deleteCount++;
      }
    }
  });

  if (deleteCount > 0) {
    console.log(`Deleting ${deleteCount} old documents...`);
    await batch.commit();
    console.log('Cleanup Complete.');
  } else {
    console.log('No old documents found to delete.');
  }
}

cleanupOldDocs().catch(console.error);
