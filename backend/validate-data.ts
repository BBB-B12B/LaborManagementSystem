
import { collections } from './src/config/collections';

async function validateData() {
    console.log('--- Validating Daily Reports ---');
    try {
        const reportSnapshot = await (collections.dailyReports as any).get();
        console.log(`Checking ${reportSnapshot.size} daily reports...`);
        let invalidReports = 0;

        reportSnapshot.forEach((doc: any) => {
            const data = doc.data();
            const fieldsToCheck = ['workDate', 'startTime', 'endTime', 'createdAt', 'updatedAt'];
            const missingFields = fieldsToCheck.filter(field => !data[field]);

            if (missingFields.length > 0) {
                console.log(`DailyReport ${doc.id} is missing: ${missingFields.join(', ')}`);
                invalidReports++;
            } else {
                try {
                    fieldsToCheck.forEach(field => {
                        if (typeof data[field].toDate !== 'function') {
                            throw new Error(`${field} is not a Timestamp`);
                        }
                    });
                } catch (err: any) {
                    console.log(`DailyReport ${doc.id} invalid: ${err.message}`);
                    invalidReports++;
                }
            }
        });
        console.log(`Invalid reports: ${invalidReports}`);

        console.log('\n--- Validating Scan Data ---');
        const scanSnapshot = await (collections.scanData as any).get();
        console.log(`Checking ${scanSnapshot.size} scan records...`);
        // ... (already checked but let's be sure)
    } catch (error) {
        console.error('Error:', error);
    }
}

validateData();
