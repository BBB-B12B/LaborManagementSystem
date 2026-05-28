const admin = require('firebase-admin');

// Unconditionally force localhost hosts for emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function main() {
  console.log('Connecting to emulator...');
  admin.initializeApp({
    projectId: 'labor-management-dev'
  });

  const db = admin.firestore();

  // 1. Fetch WH Users
  console.log('\n--- WH Department Users ---');
  const usersSnap = await db.collection('users').where('department', '==', 'WH').get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`User ID: ${doc.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`EmployeeId: ${data.employeeId}`);
    console.log(`ProjectLocationIds: ${JSON.stringify(data.projectLocationIds)}`);
    console.log(`Department: ${data.department}`);
    console.log('---------------------------');
  });

  // 2. Fetch Tasks of STR-0001
  console.log('\n--- STR-0001 Tasks & Subtasks ---');
  // Since tasks are inside workOrders collection group or parent collections, let's query all tasks
  const tasksSnap = await db.collectionGroup('tasks').get();
  console.log(`Total tasks found: ${tasksSnap.size}`);
  
  for (const doc of tasksSnap.docs) {
    const data = doc.data();
    console.log(`Task Doc ID: ${doc.id}`);
    console.log(`Task ID: ${data.taskId}`);
    console.log(`Task Name: ${data.taskName}`);
    console.log(`ProjectId: ${data.projectId}`);
    console.log(`isSupportRequest: ${data.isSupportRequest}`);
    
    // Fetch subtasks subcollection
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
