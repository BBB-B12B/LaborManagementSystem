
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkCount() {
    if (!admin.apps.length) {
        try {
            const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06'
                });
            } else {
                admin.initializeApp();
            }
        } catch (e) {
            console.error("Init Error:", e);
            return;
        }
    }
    const db = admin.firestore();
    const snapshot = await db.collection('toolBaseSystem').count().get();
    console.log(`Total tools in 'toolBaseSystem': ${snapshot.data().count}`);
}

checkCount();
