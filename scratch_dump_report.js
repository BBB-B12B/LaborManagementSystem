const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, './backend/src/config/after-sale-key.json');
const serviceAccount = require(serviceAccountPath);

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
}, 'afterSaleDb');

const db = afterSaleApp.firestore();

async function run() {
  const path = 'workOrders/WH-2026-DBD-0001/categories/DBD-0002/tasks/DBD-0002-002/subtasks/DBD-0002-002-0002/revisions/rev00/dailyReports/2026-05-22';
  const doc = await db.doc(path).get();
  console.log('Document Data:', JSON.stringify(doc.data(), null, 2));
}

run().catch(console.error);
