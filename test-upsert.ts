import { taskService } from './backend/src/services/TaskService';
import { db } from './backend/src/config/firebase';

async function runTest() {
  console.log('--- STARTING VERIFICATION TEST ---');
  const testInput1 = {
    taskName: 'งานเทคอนกรีตฐานราก',
    projectId: 'P003',
    workOrderCode: 'STR',
    categoryName: 'งานโครงสร้าง',
    assignees: [],
    dueDate: '2026-05-01T00:00:00Z',
  };

  const testInput2 = {
    taskName: 'งานผูกเหล็กเสา',
    projectId: 'P003',
    workOrderCode: 'STR',
    categoryName: 'งานโครงสร้าง',
    assignees: [],
    dueDate: '2026-05-02T00:00:00Z',
  };

  try {
    // Check initial count
    const initialQuery = await db.collection('workOrders').where('projectId', '==', 'P003').get();
    console.log(`Initial P003 workOrders count: ${initialQuery.size}`);

    // Call 1
    console.log('\n[1] Calling createTask with Task 1...');
    const result1 = await taskService.createTask(testInput1 as any, 'SYSTEM_TEST');
    console.log(`Path returned: workOrders/${result1.id.replace(/__/g, '/')}`);

    // Call 2
    console.log('\n[2] Calling createTask with Task 2 (same Project/WorkOrder)...');
    const result2 = await taskService.createTask(testInput2 as any, 'SYSTEM_TEST');
    console.log(`Path returned: workOrders/${result2.id.replace(/__/g, '/')}`);

    // Verify Final Count
    const finalQuery = await db.collection('workOrders').where('projectId', '==', 'P003').get();
    console.log(`\nFinal P003 workOrders count: ${finalQuery.size}`);
    
    if (finalQuery.size === (initialQuery.size === 0 ? 1 : initialQuery.size)) {
      console.log('✅ VERIFICATION PASSED: No duplicate Root Documents were created.');
    } else {
      console.log('❌ VERIFICATION FAILED: Root Document count increased unexpectedly.');
    }

  } catch (error) {
    console.error('Test Failed with Error:', error);
  }
}

runTest();
