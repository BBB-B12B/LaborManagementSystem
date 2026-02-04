
import { db } from './src/config/firebase';
import { collections } from './src/config/collections';

async function deleteTodayScans() {
    console.log('--- Deleting Today\'s Scan Data ---');
    try {
        // กำหนดวันที่เริ่มตั้งแต่เที่ยงคืนวันนี้
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const snapshot = await (collections.scanData as any)
            .where('createdAt', '>=', today)
            .get();

        if (snapshot.empty) {
            console.log('No scan data found for today.');
            return;
        }

        console.log(`Found ${snapshot.size} records to delete.`);

        const batch = db.batch();
        snapshot.forEach((doc: any) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log('Successfully deleted all today\'s scan data.');

    } catch (error) {
        console.error('Error deleting scan data:', error);
    }
}

deleteTodayScans();
