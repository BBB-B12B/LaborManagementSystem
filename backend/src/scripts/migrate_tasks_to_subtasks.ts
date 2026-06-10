import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const serviceAccountPath = path.resolve(__dirname, '../../../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting task migration to subtask structure...');

  // We assume WORK_ORDERS is 'workOrders'
  const woSnapshot = await db.collection('workOrders').get();
  let totalMigrated = 0;

  for (const wo of woSnapshot.docs) {
    const catSnapshot = await wo.ref.collection('categories').get();
    for (const cat of catSnapshot.docs) {
      const taskSnapshot = await cat.ref.collection('tasks').get();
      for (const task of taskSnapshot.docs) {
        const taskData = task.data();

        // Check if already migrated
        const subtasks = await task.ref.collection('subtasks').limit(1).get();
        if (!subtasks.empty) {
          continue;
        }

        console.log(`Migrating task ${taskData.taskId} (${task.id})...`);

        // Create subtask S01
        const subtaskId = `${taskData.taskId}-0001`;
        const subtaskRef = task.ref.collection('subtasks').doc(subtaskId);
        const subtaskData = {
          id: `${wo.id}__${cat.id}__${task.id}__${subtaskId}`,
          subtaskId,
          subtaskName: taskData.taskName,
          status: taskData.status || 'upcoming',
          assignees: taskData.assignees || [],
          dailyProgress: taskData.dailyProgress || 0,
          currentRevision: taskData.currentRevision || 'rev00',
          createdAt: taskData.createdAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: taskData.createdBy || 'system',
          updatedBy: 'migration_script',
          historicalAssigneeIds: taskData.historicalAssigneeIds || [],
        };

        await db.runTransaction(async (transaction) => {
          // Set subtask
          transaction.set(subtaskRef, subtaskData);
        });

        // Move revisions and help outside transaction to avoid limits
        const revSnapshot = await task.ref.collection('revisions').get();
        for (const rev of revSnapshot.docs) {
          await subtaskRef.collection('revisions').doc(rev.id).set(rev.data());

          const dailyReportsSnap = await rev.ref.collection('dailyReports').get();
          for (const rep of dailyReportsSnap.docs) {
            await subtaskRef
              .collection('revisions')
              .doc(rev.id)
              .collection('dailyReports')
              .doc(rep.id)
              .set(rep.data());
          }
        }

        const helpSnapshot = await task.ref.collection('help').get();
        for (const help of helpSnapshot.docs) {
          await subtaskRef.collection('help').doc(help.id).set(help.data());

          const dailyReportsSnap = await help.ref.collection('dailyReports').get();
          for (const rep of dailyReportsSnap.docs) {
            await subtaskRef
              .collection('help')
              .doc(help.id)
              .collection('dailyReports')
              .doc(rep.id)
              .set(rep.data());
          }
        }

        totalMigrated++;
      }
    }
  }

  console.log(`Migration complete. Migrated ${totalMigrated} tasks.`);
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
