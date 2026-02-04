import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
    });
}

const db = admin.firestore();

async function run() {
    try {
        console.log("Attempting to write test document...");
        await db.collection('dailyContractors').doc('IMPORT_TEST_123').set({
            test: true,
            timestamp: new Date()
        });
        console.log("Write successful!");
    } catch (err) {
        console.error("Write failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
