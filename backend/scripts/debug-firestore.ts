/**
 * Firestore Debug Script
 */

import admin from 'firebase-admin';

async function main() {
    const projectId = 'labor-management-dev';
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    console.log(`🔍 Checking Firestore for project: ${projectId} at ${process.env.FIRESTORE_EMULATOR_HOST}`);

    admin.initializeApp({ projectId });
    const db = admin.firestore();

    const collections = await db.listCollections();
    console.log(`📦 Collections found: ${collections.map(c => c.id).join(', ')}`);

    for (const coll of collections) {
        const snap = await coll.limit(1).get();
        if (!snap.empty) {
            console.log(`📄 Sample from ${coll.id}:`, JSON.stringify(snap.docs[0].data()).substring(0, 100));
        } else {
            console.log(`📄 Coll ${coll.id} is empty.`);
        }
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
