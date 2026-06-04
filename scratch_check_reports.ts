import { db } from './backend/src/config/firebase';

async function run() {
  console.log('Searching for dailyReports collections inside workOrders...');
  // We'll search for all collection group docs named 'dailyReports'
  const snapshot = await db.collectionGroup('dailyReports').get();
  console.log(`Found ${snapshot.size} daily reports in database.`);

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`\nReport Path: ${doc.ref.path}`);
    console.log(`Report Date: ${data.reportDate?.toDate ? data.reportDate.toDate().toISOString() : data.reportDate}`);
    console.log(`Progress: ${data.progress}`);
    console.log(`Has labor field: ${!!data.labor} (isArray: ${Array.isArray(data.labor)}, length: ${data.labor?.length})`);
    console.log(`Has leave field: ${!!data.leave} (isArray: ${Array.isArray(data.leave)}, length: ${data.leave?.length})`);
    console.log(`Has editHistory field: ${!!data.editHistory} (isArray: ${Array.isArray(data.editHistory)}, length: ${data.editHistory?.length})`);
    if (data.labor) {
      console.log('Labor:', JSON.stringify(data.labor, null, 2));
    }
    if (data.leave) {
      console.log('Leave:', JSON.stringify(data.leave, null, 2));
    }
    if (data.editHistory) {
      console.log('editHistory:', JSON.stringify(data.editHistory, null, 2));
    }
  });
}

run().catch(console.error);
