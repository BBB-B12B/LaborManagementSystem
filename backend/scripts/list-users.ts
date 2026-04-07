
import 'dotenv/config';
import admin from 'firebase-admin';

const DEFAULT_PROJECT_ID = 'labor-management-dev';
const DEFAULT_FIRESTORE_HOST = 'localhost:8080';
const DEFAULT_AUTH_HOST = 'localhost:9099';

async function main() {
    const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || DEFAULT_FIRESTORE_HOST;
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || DEFAULT_AUTH_HOST;

    process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;

    if (!admin.apps.length) {
        admin.initializeApp({ projectId });
        console.log('Connected to:', firestoreHost);
    }

    const db = admin.firestore();
    const snapshot = await db.collection('users').get();

    console.log(`Found ${snapshot.size} users:`);
    snapshot.forEach(doc => {
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}

main().catch(console.error);
