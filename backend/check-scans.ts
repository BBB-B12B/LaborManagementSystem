
import { collections } from './src/config/collections';

async function checkScanData() {
    console.log('--- Checking Scan Data ---');
    try {
        const snapshot = await (collections.scanData as any)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            console.log('No scan data found.');
            return;
        }

        console.log(`Found ${snapshot.size} recent records:`);
        snapshot.forEach((doc: any) => {
            const data = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`- employeeId: ${data.employeeId}`);
            console.log(`- scanDateTime: ${data.scanDateTime}`);
            console.log(`- createdAt: ${data.createdAt}`);
            console.log(`- importBatchId: ${data.importBatchId}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Error checking scan data:', error);
    }
}

checkScanData();
