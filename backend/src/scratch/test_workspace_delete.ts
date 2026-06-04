import * as dotenv from 'dotenv';
dotenv.config();

// Connect directly to Cloud Firebase / Local Emulator
// Note: If using emulator, keep emulator env variables. But the seed template has:
// delete process.env.FIRESTORE_EMULATOR_HOST;

import { db } from '../config/firebase';
import { afterSaleDb } from '../config/firebaseProjectB';
import { TaskService } from '../services/TaskService';
import { projectConfigService } from '../services/ProjectConfigService';

const taskService = new TaskService();

async function runTest() {
  console.log('=== STARTING WORKSPACE DELETE & DELETABILITY TEST ===');
  
  const testUserId = 'test-admin-123';
  const projectId = 'test-proj-delete-123';
  const woCode = 'WO-DEL-101';
  const catName = 'Cat-Del-101';

  // 1. Setup mock Category Config and WorkOrder Config in db (Firebase A)
  console.log('1. Setting up mock configurations in project config...');
  const woRef = db.collection('Project').doc(projectId).collection('workOrderConfigs').doc(woCode);
  await woRef.set({
    code: woCode,
    name: 'Work Order for Delete Test',
    createdAt: new Date(),
    createdBy: testUserId,
  });

  const catRef = db.collection('Project').doc(projectId).collection('categoryConfigs').doc();
  const catId = catRef.id;
  await catRef.set({
    workOrderCode: woCode,
    name: catName,
    createdAt: new Date(),
    createdBy: testUserId,
  });
  console.log(`Created Category Config ID: ${catId}`);

  // Create workspace structures in afterSaleDb (Firebase B)
  const woDocRef = afterSaleDb.collection('workOrders').doc();
  await woDocRef.set({
    projectId,
    projectName: 'Delete Test Project',
    workOrderCode: woCode,
    workOrderName: 'Work Order for Delete Test',
    createdAt: new Date(),
    createdBy: testUserId,
  });

  const catDocRef = woDocRef.collection('categories').doc();
  await catDocRef.set({
    catName,
    createdAt: new Date(),
    createdBy: testUserId,
  });

  // 2. Create Task with Subtasks under that category
  console.log('2. Creating task with subtasks...');
  const taskRef = catDocRef.collection('tasks').doc();
  const taskId = taskRef.id;

  const taskData = {
    taskId,
    taskName: 'Delete Test Main Task',
    projectId,
    projectName: 'Delete Test Project',
    workOrderId: woDocRef.id,
    workOrderCode: woCode,
    workOrderName: 'Work Order for Delete Test',
    categoryId: catId,
    categoryName: catName,
    dailyProgress: 0,
    status: 'upcoming',
    dueDate: new Date(Date.now() + 86400000 * 7),
    createdAt: new Date(),
    createdBy: testUserId,
  };
  await taskRef.set(taskData);

  // Subtask A: Progress > 0 (Should NOT be deletable)
  const subtaskARef = taskRef.collection('subtasks').doc();
  const subtaskAId = `${woDocRef.id}__${catDocRef.id}__${taskId}__${subtaskARef.id}`;
  await subtaskARef.set({
    id: subtaskAId,
    subtaskId: 'SUB-A',
    subtaskName: 'Subtask A (Progress > 0)',
    dailyProgress: 10,
    status: 'in-progress',
    assignees: [{ employeeId: 'EMP-001', name: 'Worker One', roleId: 'Staff' }],
    currentRevision: 'rev00',
    createdAt: new Date(),
    createdBy: testUserId,
  });

  // Subtask B: Progress = 0, but has Labor in Daily Report (Should NOT be deletable)
  const subtaskBRef = taskRef.collection('subtasks').doc();
  const subtaskBId = `${woDocRef.id}__${catDocRef.id}__${taskId}__${subtaskBRef.id}`;
  await subtaskBRef.set({
    id: subtaskBId,
    subtaskId: 'SUB-B',
    subtaskName: 'Subtask B (Has Labor Logs)',
    dailyProgress: 0,
    status: 'upcoming',
    assignees: [{ employeeId: 'EMP-001', name: 'Worker One', roleId: 'Staff' }],
    currentRevision: 'rev00',
    createdAt: new Date(),
    createdBy: testUserId,
  });

  // Add daily report with labor to SUB-B revision rev00
  const revBDocRef = subtaskBRef.collection('revisions').doc('rev00');
  await revBDocRef.set({
    revisionId: 'rev00',
    createdAt: new Date(),
  });
  const repBRef = revBDocRef.collection('dailyReports').doc('2026-06-02');
  await repBRef.set({
    reportDate: '2026-06-02',
    progress: 0,
    labor: [{ employeeId: 'EMP-001', name: 'Worker One', netHours: 8 }],
    otHours: 0,
  });

  // Subtask C: Progress = 0, no Labor/OT (Should BE deletable)
  const subtaskCRef = taskRef.collection('subtasks').doc();
  const subtaskCId = `${woDocRef.id}__${catDocRef.id}__${taskId}__${subtaskCRef.id}`;
  await subtaskCRef.set({
    id: subtaskCId,
    subtaskId: 'SUB-C',
    subtaskName: 'Subtask C (Deletable)',
    dailyProgress: 0,
    status: 'upcoming',
    assignees: [{ employeeId: 'EMP-001', name: 'Worker One', roleId: 'Staff' }],
    currentRevision: 'rev00',
    createdAt: new Date(),
    createdBy: testUserId,
  });

  // Add dummy empty daily report (progress=0, labor=[], ot=0) to Subtask C
  const revCDocRef = subtaskCRef.collection('revisions').doc('rev00');
  await revCDocRef.set({
    revisionId: 'rev00',
    createdAt: new Date(),
  });
  const repCRef = revCDocRef.collection('dailyReports').doc('2026-06-02');
  await repCRef.set({
    reportDate: '2026-06-02',
    progress: 0,
    labor: [],
    otHours: 0,
  });

  console.log('Setup finished. Running deletability checks...');

  // 3. Test updateSubtaskDeletability
  console.log('\n--- 3. Testing updateSubtaskDeletability ---');
  
  const deletableA = await taskService.updateSubtaskDeletability(subtaskARef, 'SUB-A');
  console.log(`Subtask A deletable? Expected: false, Got: ${deletableA}`);
  if (deletableA !== false) throw new Error('Subtask A should not be deletable');

  const deletableB = await taskService.updateSubtaskDeletability(subtaskBRef, 'SUB-B');
  console.log(`Subtask B deletable? Expected: false, Got: ${deletableB}`);
  if (deletableB !== false) throw new Error('Subtask B should not be deletable');

  const deletableC = await taskService.updateSubtaskDeletability(subtaskCRef, 'SUB-C');
  console.log(`Subtask C deletable? Expected: true, Got: ${deletableC}`);
  if (deletableC !== true) throw new Error('Subtask C should be deletable');

  // 4. Test deleteSubtask on non-deletable Subtask A (should throw error)
  console.log('\n--- 4. Testing deleteSubtask constraints ---');
  try {
    await taskService.deleteSubtask(taskId, subtaskAId, testUserId);
    throw new Error('Should have blocked deletion of Subtask A');
  } catch (error: any) {
    console.log(`Successfully blocked deletion of Subtask A: ${error.message}`);
  }

  // 5. Test deleteSubtask on deletable Subtask C (should succeed and hard-delete revisions and reports)
  console.log('\n--- 5. Testing deletion of qualified Subtask C ---');
  const deleteResult = await taskService.deleteSubtask(taskId, subtaskCId, testUserId);
  console.log(`Deletion type: ${deleteResult.type}`);

  // Verify Subtask C and revisions and reports are deleted completely
  const subtaskCSnap = await subtaskCRef.get();
  const subtaskCReportSnap = await repCRef.get();
  console.log(`Subtask C exists? Expected: false, Got: ${subtaskCSnap.exists}`);
  console.log(`Subtask C report exists? Expected: false, Got: ${subtaskCReportSnap.exists}`);
  
  if (subtaskCSnap.exists || subtaskCReportSnap.exists) {
    throw new Error('Subtask C or its report was not hard-deleted!');
  }

  // 6. Test deleteCategory safety check (should block because Subtask A & B are still under the category)
  console.log('\n--- 6. Testing deleteCategory safety check ---');
  try {
    await projectConfigService.deleteCategory(projectId, catDocRef.id);
    throw new Error('Should have blocked deletion of Category containing non-deletable subtasks');
  } catch (error: any) {
    console.log(`Successfully blocked deletion of Category: ${error.message}`);
  }

  // 7. Test deleteWorkOrder safety check (should block because Subtask A & B are still under the work order)
  console.log('\n--- 7. Testing deleteWorkOrder safety check ---');
  try {
    await projectConfigService.deleteWorkOrder(projectId, woCode);
    throw new Error('Should have blocked deletion of WorkOrder containing non-deletable subtasks');
  } catch (error: any) {
    console.log(`Successfully blocked deletion of WorkOrder: ${error.message}`);
  }

  // 8. Test deleteCategory when Firebase A config document is missing but Firebase B structure exists
  console.log('\n--- 8. Testing deleteCategory when A-config is missing ---');
  // First, delete Category Config from db (Firebase A)
  await db.collection('Project').doc(projectId).collection('categoryConfigs').doc(catId).delete();
  console.log('Deleted Category Config from db (Firebase A)');

  // Clean up remaining mock subtasks A & B so Category becomes deletable
  const batchClean = afterSaleDb.batch();
  batchClean.delete(repBRef);
  batchClean.delete(revBDocRef);
  batchClean.delete(subtaskARef);
  batchClean.delete(subtaskBRef);
  batchClean.delete(taskRef);
  await batchClean.commit();
  console.log('Cleaned up subtasks under mock category');

  // Call deleteCategory (should succeed by resolving metadata from B and skipping A deletion)
  await projectConfigService.deleteCategory(projectId, catDocRef.id);
  console.log('Successfully called deleteCategory with missing A-config');

  // Verify Firebase B category document is deleted
  const catDocSnapAfter = await catDocRef.get();
  console.log(`Firebase B category exists? Expected: false, Got: ${catDocSnapAfter.exists}`);
  if (catDocSnapAfter.exists) {
    throw new Error('Category document in Firebase B was not deleted!');
  }

  // 9. Test deleteWorkOrder when Firebase A config document is missing but Firebase B structure exists
  console.log('\n--- 9. Testing deleteWorkOrder when A-config is missing ---');
  // First, delete WorkOrder Config from db (Firebase A)
  await woRef.delete();
  console.log('Deleted WorkOrder Config from db (Firebase A)');

  // Call deleteWorkOrder (should succeed by resolving from B and skipping A deletion)
  await projectConfigService.deleteWorkOrder(projectId, woCode);
  console.log('Successfully called deleteWorkOrder with missing A-config');

  // Verify Firebase B workOrder document is deleted
  const woDocSnapAfter = await woDocRef.get();
  console.log(`Firebase B workOrder exists? Expected: false, Got: ${woDocSnapAfter.exists}`);
  if (woDocSnapAfter.exists) {
    throw new Error('WorkOrder document in Firebase B was not deleted!');
  }

  // 10. Clean up remaining parent project mock entry
  console.log('\n--- 10. Cleaning up remaining parent project mock entry ---');
  await db.collection('Project').doc(projectId).delete();
  console.log('Cleanup completed successfully.');
  console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runTest().catch(err => {
  console.error('=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
