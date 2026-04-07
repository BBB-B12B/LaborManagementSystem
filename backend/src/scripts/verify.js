const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) : undefined;
if (!admin.apps.length) admin.initializeApp({ 
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06'
});
const db = admin.firestore();

async function check() {
    console.log("Checking Firestore scanData collection (JS version)...");
    try {
        const snap = await db.collection('scanData').limit(2).get();
        if (snap.empty) {
            console.log("No scanData documents found.");
        } else {
            snap.forEach(doc => {
                console.log('ID:', doc.id);
                console.log(JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (e) {
        console.error("Error checking Firestore:", e);
    }
    process.exit(0);
}
check();
