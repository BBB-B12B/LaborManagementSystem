/**
 * Check Wage Periods in Firebase
 */

import 'dotenv/config';
import admin from 'firebase-admin';

async function main() {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06';

    // Clear emulator env vars to force cloud connection
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_EMULATOR_HOST;

    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required');
    }
    const serviceAccount = JSON.parse(serviceAccountKey);

    console.log('☁️ Connecting to Production Firebase');
    console.log(`📍 Project: ${projectId}`);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId
        });
    }

    const db = admin.firestore();

    // Check wage periods
    console.log('\n📊 Checking wagePeriods collection...');
    const wagePeriods = await db.collection('wagePeriods').get();

    console.log(`\n✅ Found ${wagePeriods.size} wage period(s)\n`);

    if (wagePeriods.empty) {
        console.log('❌ No wage periods found!');
        console.log('💡 You need to:');
        console.log('   1. Create a wage period from the UI');
        console.log('   2. Or run the seeding script');
    } else {
        let index = 0;
        wagePeriods.forEach((doc: any) => {
            index++;
            const data = doc.data();
            console.log(`${index}. Period: ${doc.id}`);
            console.log(`   Code: ${data.periodCode}`);
            console.log(`   Status: ${data.status}`);
            console.log(`   Start: ${data.startDate?.toDate?.()?.toISOString().split('T')[0] || data.startDate}`);
            console.log(`   End: ${data.endDate?.toDate?.()?.toISOString().split('T')[0] || data.endDate}`);
            console.log(`   DCs: ${data.dcSummaries?.length || 0}`);
            console.log(`   Net Wages: ${data.totalNetWages?.toLocaleString() || 0} ฿`);
            console.log('');
        });
    }

    // Check projects
    console.log('\n📍 Checking Project collection...');
    const projects = await db.collection('Project').get();
    console.log(`✅ Found ${projects.size} project(s)`);

    if (!projects.empty) {
        let index = 0;
        projects.forEach((doc: any) => {
            index++;
            const data = doc.data();
            console.log(`${index}. ${data.name} (${doc.id})`);
        });
    }

    // Check daily contractors
    console.log('\n👷 Checking dailyContractors collection...');
    const dcs = await db.collection('dailyContractors').limit(5).get();
    console.log(`✅ Found ${dcs.size} daily contractor(s) (showing first 5)`);

    if (!dcs.empty) {
        let index = 0;
        dcs.forEach((doc: any) => {
            index++;
            const data = doc.data();
            console.log(`${index}. ${data.name} (${data.employeeId})`);
        });
    }
}

main().then(() => process.exit(0)).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
