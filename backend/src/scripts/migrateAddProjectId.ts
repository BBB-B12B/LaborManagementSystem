/**
 * Migration Script: Add projectId and projectName to all existing requests and dailyReports documents
 *
 * Usage: npx ts-node backend/src/scripts/migrateAddProjectId.ts [--dry-run]
 */

import admin from 'firebase-admin';
import dotEnv from 'dotenv';
import { afterSaleDb } from '../config/firebaseProjectB';

dotEnv.config();

// Remove emulator env vars
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

const dryRun = process.argv.includes('--dry-run');

async function migrate() {
  console.log(`[migrate] 🚀 Starting requests and dailyReports projectId migration... (Dry run: ${dryRun})`);

  // 1. Load all tasks from afterSaleDb to map taskId -> { projectId, projectName }
  console.log('[migrate] Loading all tasks from Firestore...');
  const tasksSnapshot = await afterSaleDb.collectionGroup('tasks').get();
  const taskMap = new Map<string, { projectId: string; projectName: string }>();

  for (const doc of tasksSnapshot.docs) {
    const data = doc.data();
    const taskId = doc.id; // e.g., DBD-0002-002
    const projectId = data.projectId || '';
    const projectName = data.projectName || '';

    if (taskId && projectId) {
      taskMap.set(taskId, { projectId, projectName });
    }
  }
  console.log(`[migrate] Loaded ${taskMap.size} tasks into map.`);

  // Function to process a collection group
  async function processCollectionGroup(groupName: 'requests' | 'dailyReports') {
    console.log(`[migrate] Loading all docs from collectionGroup('${groupName}')...`);
    const snap = await afterSaleDb.collectionGroup(groupName).get();
    console.log(`[migrate] Found ${snap.docs.length} total docs in collectionGroup('${groupName}')`);

    const needsMigration = snap.docs.filter((doc) => {
      const data = doc.data();
      return !data.projectId; // Only migrate if projectId is missing/empty
    });

    console.log(`[migrate] Found ${needsMigration.length} docs in '${groupName}' needing migration`);

    if (needsMigration.length === 0) {
      return;
    }

    const BATCH_SIZE = 500;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < needsMigration.length; i += BATCH_SIZE) {
      const chunk = needsMigration.slice(i, i + BATCH_SIZE);
      const batch = afterSaleDb.batch();

      for (const doc of chunk) {
        const pathParts = doc.ref.path.split('/');
        // Path pattern: workOrders/{woId}/categories/{catId}/tasks/{taskId}/subtasks/{subtaskId}/revisions/{revId}/requests/{requestId}
        // index of tasks is 4, taskId is 5. Let's make sure 'tasks' is indeed at index 4
        const tasksIndex = pathParts.indexOf('tasks');
        let taskId = '';
        if (tasksIndex !== -1 && tasksIndex + 1 < pathParts.length) {
          taskId = pathParts[tasksIndex + 1];
        }

        if (!taskId) {
          console.warn(`[migrate] Could not determine taskId for doc path: ${doc.ref.path}`);
          skipped++;
          continue;
        }

        const projectInfo = taskMap.get(taskId);
        if (!projectInfo) {
          console.warn(`[migrate] Task info not found in map for taskId: ${taskId} at path ${doc.ref.path}`);
          skipped++;
          continue;
        }

        const updateData = {
          projectId: projectInfo.projectId,
          projectName: projectInfo.projectName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (dryRun) {
          console.log(`[DRY RUN] Would update doc: ${doc.ref.path} with projectId: ${projectInfo.projectId}, projectName: ${projectInfo.projectName}`);
        } else {
          batch.update(doc.ref, updateData);
        }
        updated++;
      }

      if (!dryRun && updated > 0) {
        await batch.commit();
        console.log(`[migrate] Batch ${Math.floor(i / BATCH_SIZE) + 1} for ${groupName} committed`);
      }
    }

    console.log(`[migrate] Finished ${groupName}: Updated: ${updated}, Skipped: ${skipped}`);
  }

  // Run for requests and dailyReports
  await processCollectionGroup('requests');
  await processCollectionGroup('dailyReports');

  console.log('[migrate] ✅ Migration script execution finished.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate] ❌ Error:', err);
    process.exit(1);
  });
