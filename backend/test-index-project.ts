
import { db } from './src/config/firebase';

async function testProjectIndex() {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const projectId = 'P001';

    try {
        console.log(`Running query on dailyReports with projectLocationId + workDate range...`);
        const snapshot = await db.collection('dailyReports')
            .where('projectLocationId', '==', projectId)
            .where('workDate', '>=', startDate)
            .where('workDate', '<=', endDate)
            .get();
        console.log(`Success! Found ${snapshot.size} records.`);
    } catch (error: any) {
        console.error('FAILED without isDeleted but with projectId:');
        console.error(error.message);
    }
}

testProjectIndex();
