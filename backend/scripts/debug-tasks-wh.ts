import 'dotenv/config';
import { db } from '../src/config/firebase';
import { afterSaleDb } from '../src/config/firebaseProjectB';

// Unconditionally force emulator local host
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function main() {
  console.log('Querying afterSaleDb (Task database)...');
  
  // 1. Check users
  console.log('\n--- WH Users in db ---');
  const usersSnap = await db.collection('users').get();
  console.log(`Total users in db: ${usersSnap.size}`);
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.department === 'WH') {
      console.log(`User ID: ${doc.id}`);
      console.log(`Name: ${data.name}`);
      console.log(`EmployeeId: ${data.employeeId}`);
      console.log(`ProjectLocationIds: ${JSON.stringify(data.projectLocationIds)}`);
      console.log(`Department: ${data.department}`);
      console.log('---------------------------');
    }
  });

  // 2. Check Tasks in afterSaleDb
  console.log('\n--- Tasks in afterSaleDb ---');
  const tasksSnap = await afterSaleDb.collectionGroup('tasks').get();
  console.log(`Total tasks found: ${tasksSnap.size}`);

  for (const doc of tasksSnap.docs) {
    const data = doc.data();
    console.log(`Task Doc ID: ${doc.id}`);
    console.log(`Task ID: ${data.taskId}`);
    console.log(`Task Name: ${data.taskName}`);
    console.log(`ProjectId: ${data.projectId}`);
    console.log(`isSupportRequest: ${data.isSupportRequest}`);
    
    // Fetch subtasks
    const subtasksSnap = await doc.ref.collection('subtasks').get();
    console.log(`  Subtasks (${subtasksSnap.size}):`);
    subtasksSnap.forEach(stDoc => {
      const stData = stDoc.data();
      console.log(`    - SubtaskID: ${stData.subtaskId}`);
      console.log(`      SubtaskName: ${stData.subtaskName}`);
      console.log(`      isSupportRequest: ${stData.isSupportRequest}`);
      console.log(`      isPickedUpBySupport: ${stData.isPickedUpBySupport}`);
    });
    console.log('=================================');
  }
}

main().catch(console.error);
