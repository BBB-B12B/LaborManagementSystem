/**
 * Check Wage Periods in Firebase (JavaScript version)
 */

require('dotenv').config();
const admin = require('firebase-admin');

async function main() {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06';

    // Clear emulator env vars
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_EMULATOR_HOST;

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required');
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    console.log('☁️ Connecting to Production Firebase');
    console.log(`📍 Project: ${projectId}\n`);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId
        });
    }

    const db = admin.firestore();

    // Check wage periods
    console.log('📊 Checking wagePeriods collection...');
    const wagePeriods = await db.collection('wagePeriods').get();

    console.log(`✅ Found ${wagePeriods.size} wage period(s)\n`);

    if (wagePeriods.empty) {
        console.log('❌ No wage periods found!');
        console.log('💡 You need to create a wage period from the UI or run seeding script\n');
    } else {
        wagePeriods.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. Period: ${doc.id}`);
            console.log(`   Code: ${data.periodCode}`);
            console.log(`   Status: ${data.status}`);
            console.log(`   Project: ${data.projectLocationId}`);
            console.log(`   DCs: ${data.dcSummaries?.length || 0}`);
            console.log(`   Net Wages: ${(data.totalNetWages || 0).toLocaleString()} ฿\n`);
        });
    }

    // Check projects
    console.log('📍 Checking Project collection...');
    const projects = await db.collection('Project').get();
    console.log(`✅ Found ${projects.size} project(s)\n`);

    if (!projects.empty) {
        projects.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. ${data.name || data.projectName} (${doc.id})`);
        });
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
