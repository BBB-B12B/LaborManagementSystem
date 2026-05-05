import { projectBDailyReportService } from './src/services/external/ProjectBDailyReportService';

async function test() {
  const ts = await projectBDailyReportService.getDailyTimesheet('300067', '2025-09-04');
  console.log('Result:', ts);
  process.exit(0);
}
test();
