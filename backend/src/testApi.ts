import { getProjectById } from './services/projectService';

async function test() {
  const p003 = await getProjectById('P003');
  console.log('P003 from API:', JSON.stringify(p003, null, 2));
}

test().catch(console.error);
