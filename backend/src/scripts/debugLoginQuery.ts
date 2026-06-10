import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

console.log('Project ID:', projectId);

if (!admin.apps.length) {
  const serviceAccount = serviceAccountKey ? JSON.parse(serviceAccountKey) : undefined;

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: projectId,
  });
  console.log('Firebase Admin Initialized');
}

const db = admin.firestore();

async function debugQuery() {
  console.log('Executing query on "users" collection...');
  try {
    const snapshot = await db.collection('users').where('username', '==', 'admin').get();

    console.log('Query successful!');
    console.log('Documents found:', snapshot.size);
    snapshot.forEach((doc) => {
      console.log('User ID:', doc.id, 'Data:', JSON.stringify(doc.data(), null, 2));
    });
  } catch (error: any) {
    console.error('❌ Query failed!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    if (error.stack) {
      console.error('Stack Trace:', error.stack);
    }
  }
}

debugQuery();
