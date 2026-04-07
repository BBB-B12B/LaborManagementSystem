
import { collections } from '../config/collections';

async function listContractors() {
    try {
        console.log('Fetching contractors...');
        const snapshot = await collections.dailyContractors.limit(5).get();
        if (snapshot.empty) {
            console.log('No contractors found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}, EmployeeID: ${data.employeeId}, Name: ${data.name}`);
        });
    } catch (error) {
        console.error('Error fetching contractors:', error);
    }
}

listContractors().then(() => process.exit(0));
