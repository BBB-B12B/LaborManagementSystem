
import 'dotenv/config';
import admin from 'firebase-admin';

const DEFAULT_PROJECT_ID = 'labor-management-dev';
const DEFAULT_FIRESTORE_HOST = 'localhost:8080';
const DEFAULT_AUTH_HOST = 'localhost:9099';

async function main() {
    // Setup Emulator Env if not set (mirroring seed script)
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || DEFAULT_FIRESTORE_HOST;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || DEFAULT_AUTH_HOST;
    const projectId = process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;

    console.log('--- Firebase Connection Debugger ---');
    console.log(`Project ID: ${projectId}`);
    console.log(`Firestore Host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    console.log(`Auth Host: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

    if (!admin.apps.length) {
        admin.initializeApp({ projectId });
    }

    const db = admin.firestore();

    const collectionsToCheck = ['Project', 'projectLocations', 'projects']; // Check potential aliases

    for (const colName of collectionsToCheck) {
        console.log(`\nChecking Collection: "${colName}"`);
        const snapshot = await db.collection(colName).get();

        if (snapshot.empty) {
            console.log('   [EMPTY] No documents found.');
            continue;
        }

        console.log(`   Found ${snapshot.size} documents:`);
        snapshot.forEach(doc => {
            const data = doc.data();
            const code = data.code || data.projectCode || 'N/A';
            const name = data.name || data.projectName || 'N/A';
            console.log(`   - ID: ${doc.id} | Code: ${code} | Name: ${name}`);
            console.log(`     Full Data:`, JSON.stringify(data));
        });
    }
}

main().catch(err => {
    console.error('Error running debug script:', err);
});
