const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'src', 'config', 'after-sale-key.json');
const serviceAccount = require(serviceAccountPath);

const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
}, 'afterSaleDb');

const db = afterSaleApp.firestore();

async function test() {
  const woId = 'WH-2026-DBD-0001';
  const catId = 'DBD-0002';
  const id = 'DBD-0002-002';

  const taskRef = db.collection('workOrders').doc(woId).collection('categories').doc(catId).collection('tasks').doc(id);
  const taskSnap = await taskRef.get();
  console.log('Task exists:', taskSnap.exists);

  const subtasksSnap = await taskRef.collection('subtasks').get();
  console.log('Subtasks count:', subtasksSnap.size);
  subtasksSnap.forEach(sub => {
    console.log('Subtask ID:', sub.id);
    console.log('Data:', sub.data());
  });
}

test().then(() => process.exit(0)).catch(console.error);
