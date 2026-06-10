import { afterSaleDb } from './config/firebaseProjectB';

async function checkBacklog() {
  console.log('--- Checking DB for Sunday 17th unlock requests ---');
  const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
  for (const doc of tasksSnapshot.docs) {
    const task = doc.data();
    if (task.unlockRequests) {
      console.log(
        `Task [${task.taskId}] ${task.taskName} unlockRequests:`,
        JSON.stringify(task.unlockRequests)
      );
    }
  }
}

checkBacklog()
  .then(() => console.log('Done'))
  .catch((err) => console.error(err));
