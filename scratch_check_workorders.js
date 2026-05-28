const admin = require('firebase-admin');
const path = require('path');

// Load after-sale credentials
const serviceAccountPath = path.resolve(__dirname, './backend/src/config/after-sale-key.json');
const serviceAccount = require(serviceAccountPath);

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
}, 'afterSaleDb');

const db = afterSaleApp.firestore();

async function run() {
  console.log('Listing top-level collections in afterSaleDb...');
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} collections:`, collections.map(c => c.id));

  console.log('\nQuerying collectionGroup "dailyReports" in afterSaleDb...');
  const snapshot = await db.collectionGroup('dailyReports').get();
  console.log(`Found ${snapshot.size} daily reports in database.`);

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`\n========================================`);
    console.log(`Report Path: ${doc.ref.path}`);
    console.log(`Report Date: ${data.reportDate?.toDate ? data.reportDate.toDate().toISOString() : data.reportDate}`);
    console.log(`Progress: ${data.progress}`);
    console.log(`Has labor field: ${!!data.labor} (isArray: ${Array.isArray(data.labor)}, length: ${data.labor?.length})`);
    console.log(`Has leave field: ${!!data.leave} (isArray: ${Array.isArray(data.leave)}, length: ${data.leave?.length})`);
    console.log(`Has editHistory field: ${!!data.editHistory} (isArray: ${Array.isArray(data.editHistory)}, length: ${data.editHistory?.length})`);
    
    if (data.labor && Array.isArray(data.labor)) {
      console.log('Labor Entries:');
      data.labor.forEach(l => {
        console.log(`  - Worker: ${l.workerName || l.workerId} (${l.employeeId}), Shifts: ${JSON.stringify(l.shifts)}, Times: ${JSON.stringify(l.shiftTimes)}`);
      });
    }
    
    if (data.leave && Array.isArray(data.leave)) {
      console.log('Leave Entries:');
      data.leave.forEach(l => {
        console.log(`  - Worker: ${l.workerName || l.workerId} (${l.employeeId}), Type: ${l.leaveType}`);
      });
    }

    if (data.editHistory && Array.isArray(data.editHistory)) {
      console.log(`editHistory contains ${data.editHistory.length} logs:`);
      data.editHistory.forEach((log, idx) => {
        console.log(`  [${idx}] Action: ${log.action || 'edit'}, By: ${log.editedBy || log.userId}, At: ${log.editedAt?.toDate ? log.editedAt.toDate().toISOString() : log.editedAt}`);
      });
    }
  });
}

run().catch(console.error);
