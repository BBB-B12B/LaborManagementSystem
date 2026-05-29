import * as dotenv from 'dotenv';
dotenv.config();

// Connect directly to Cloud Firebase
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

import { TaskService } from '../services/TaskService';
import { CreateTaskInput, UpdateTaskInput } from '../models/Task';
import { afterSaleDb } from '../config/firebaseProjectB';

const taskService = new TaskService();

async function runTest() {
  console.log('=== STARTING SUBTASK EDIT HISTORY TEST ===');
  
  const testUserId = 'test-admin-123';

  // Fetch a real task to copy valid project, work order, and category details
  console.log('Querying a real task for valid metadata...');
  const realTasks = await afterSaleDb.collectionGroup('tasks').limit(1).get();
  if (realTasks.empty) {
    throw new Error('No tasks found in database to clone metadata');
  }
  const realTask = realTasks.docs[0].data();
  console.log(`Cloning metadata from task: ${realTask.taskName} (Project: ${realTask.projectName}, ID: ${realTask.projectId})`);

  // 1. Create a dummy task with 1 subtask using cloned metadata
  const createTaskInput: CreateTaskInput = {
    taskName: 'Test Subtask History Task',
    projectId: realTask.projectId,
    projectName: realTask.projectName,
    workOrderId: realTask.workOrderId,
    workOrderCode: realTask.workOrderCode,
    workOrderName: realTask.workOrderName,
    categoryId: realTask.categoryId,
    categoryName: realTask.categoryName,
    dueDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
    subtasks: [
      {
        subtaskName: 'Initial Subtask Name',
        assignees: [
          { employeeId: 'EMP-001', name: 'Worker One', roleId: 'Staff' }
        ],
        isSupportRequest: false,
        dueDate: new Date(Date.now() + 86400000 * 5)
      }
    ]
  };

  console.log('1. Creating test task and subtask...');
  const task = await taskService.createTask(createTaskInput, testUserId);
  console.log(`Created Task ID: ${task.id}`);

  // Fetch the subtask to get its auto-generated ID
  const subtasks = await taskService.getSubtasks(task.id);
  if (subtasks.length === 0) {
    throw new Error('Failed to retrieve created subtask');
  }
  const subtask = subtasks[0];
  console.log(`Subtask ID: ${subtask.subtaskId} | Name: ${subtask.subtaskName} | Assignees: ${JSON.stringify(subtask.assignees)}`);

  // 2. Edit the subtask (change name and add/remove assignees)
  const updateTaskInput: UpdateTaskInput = {
    subtasks: [
      {
        subtaskId: subtask.subtaskId,
        subtaskName: 'Updated Subtask Name', // Changed
        assignees: [
          { employeeId: 'EMP-001', name: 'Worker One', roleId: 'Staff' },
          { employeeId: 'EMP-002', name: 'Worker Two', roleId: 'Staff' } // Added
        ],
        isSupportRequest: true, // Changed
        dueDate: new Date(Date.now() + 86400000 * 10) // Set due date
      }
    ]
  };

  console.log('\n2. Updating subtask details (triggering editHistory)...');
  await taskService.updateTask(task.id, updateTaskInput, testUserId);

  // 3. Fetch subtask again and check editHistory
  console.log('\n3. Fetching subtask and verifying audit trail...');
  const updatedSubtasks = await taskService.getSubtasks(task.id);
  const updatedSubtask = updatedSubtasks[0];

  console.log('Updated Subtask fields:');
  console.log(`- subtaskName: ${updatedSubtask.subtaskName}`);
  console.log(`- isSupportRequest: ${updatedSubtask.isSupportRequest}`);
  console.log(`- dueDate: ${updatedSubtask.dueDate}`);
  console.log(`- editHistory:`, JSON.stringify(updatedSubtask.editHistory, null, 2));

  // Assertions
  if (!updatedSubtask.editHistory || updatedSubtask.editHistory.length === 0) {
    throw new Error('Test failed: editHistory array is empty or missing!');
  }

  const record = updatedSubtask.editHistory[0];
  if (record.updatedBy !== testUserId) {
    throw new Error(`Test failed: updatedBy expected ${testUserId}, got ${record.updatedBy}`);
  }

  const changes = record.changes;
  const changedFields = changes.map((c: any) => c.field);
  console.log('\nChanges recorded for fields:', changedFields);

  const expectedFields = ['subtaskName', 'assignees', 'dueDate', 'isSupportRequest'];
  expectedFields.forEach(field => {
    if (!changedFields.includes(field)) {
      throw new Error(`Test failed: Expected change log for field "${field}" was not recorded`);
    }
  });

  console.log('\nAll changes were successfully verified in the editHistory array!');

  // 4. Clean up: delete task and subtasks
  console.log('\n4. Cleaning up test data...');
  await taskService.softDeleteTask(task.id, testUserId);
  console.log('Test task deleted successfully.');
  
  console.log('=== TEST PASSED SUCCESSFULLY ===');
}

runTest().catch(err => {
  console.error('=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
