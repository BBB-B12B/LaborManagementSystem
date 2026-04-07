/* eslint-disable no-console */
/**
 * Utility script to rename the Firestore document for project code P001
 * so that the document ID matches the `code` field.
 */
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load root .env so FIREBASE_* variables are available
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_CODE = 'P001';

// Ensure we do NOT connect to local emulators for this fix
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

async function run() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  if (!serviceAccount.project_id) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY value');
  }

  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });

  const db = app.firestore();
  const projectCollection = db.collection('Project');

  const snapshot = await projectCollection.where('code', '==', TARGET_CODE).get();

  if (snapshot.empty) {
    throw new Error(`No document found in Project collection with code ${TARGET_CODE}`);
  }

  const [sourceDoc] = snapshot.docs;

  if (sourceDoc.id === TARGET_CODE) {
    console.log(`Document for ${TARGET_CODE} already matches the code. No changes made.`);
    return;
  }

  const destinationRef = projectCollection.doc(TARGET_CODE);
  const destinationDoc = await destinationRef.get();

  if (destinationDoc.exists) {
    throw new Error(`A Project document with ID ${TARGET_CODE} already exists. Aborting.`);
  }

  const data = sourceDoc.data();

  console.log(`Creating new document ${TARGET_CODE} and copying data from ${sourceDoc.id} ...`);
  await destinationRef.set(data);

  console.log(`Deleting old document ${sourceDoc.id} ...`);
  await sourceDoc.ref.delete();

  console.log(`Project document updated successfully. ${sourceDoc.id} → ${TARGET_CODE}`);
}

run()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to fix project document:', err);
    process.exit(1);
  });
