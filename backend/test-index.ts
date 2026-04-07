
import { collections } from './src/config/collections';
import { db } from './src/config/firebase';

async function testIndex() {
    console.log('--- Testing Query without isDeleted ---');
    try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        console.log('Running query on dailyReports with ONLY workDate range...');
        const snapshot = await db.collection('dailyReports')
            .where('workDate', '>=', startDate)
            .where('workDate', '<=', endDate)
            .get();

        console.log(`Success! Found ${snapshot.size} records.`);

    } catch (error: any) {
        console.error('FAILED without isDeleted:');
        console.error(error.message);
    }

    try {
        console.log('\nRunning query on dailyReports with isDeleted + workDate range...');
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const snapshot = await db.collection('dailyReports')
            .where('isDeleted', '==', false)
            .where('workDate', '>=', startDate)
            .where('workDate', '<=', endDate)
            .get();

        console.log(`Success! Found ${snapshot.size} records.`);
    } catch (error: any) {
        console.error('FAILED with isDeleted:');
        console.error(error.message);
    }
}

testIndex();
