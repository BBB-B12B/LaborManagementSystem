import { db } from '../config/firebase-admin';

async function inspectTasks() {
  console.log('--- Inspecting Tasks ---');
  const snapshot = await db.collectionGroup('tasks').get();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Task ID: ${data.taskId}`);
    console.log(`Name: ${data.taskName}`);
    console.log(`Assignees:`, JSON.stringify(data.assignees));
    console.log('-------------------------');
  });
}

inspectTasks();
