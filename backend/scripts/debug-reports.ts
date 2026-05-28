import { taskService } from '../src/services/TaskService';

async function debug() {
  console.log('--- START TASK SERVICE TEST ---');
  
  const id = 'DBD-0001-001-0001';
  console.log(`Calling taskService.getAllDailyReports('${id}', false)`);
  const reports = await taskService.getAllDailyReports(id, false);
  console.log('Reports returned:', JSON.stringify(reports, null, 2));

  console.log('--- END TASK SERVICE TEST ---');
}

debug().catch(console.error);
