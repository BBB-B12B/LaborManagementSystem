import * as dotenv from 'dotenv';
dotenv.config();
import { db } from './src/config/firebase';

async function check() {
  const tasks = await db.collection('tasks').orderBy('createdAt', 'desc').limit(5).get();
  for (const doc of tasks.docs) {
    const data = doc.data();
    console.log(`Task: ${data.taskName} | isSupportRequest: ${data.isSupportRequest} | isPickedUpBySupport: ${data.isPickedUpBySupport}`);
    console.log('supportAssignees:', data.supportAssignees?.map((a:any) => a.name));
    console.log('assignees:', data.assignees?.map((a:any) => a.name));
    console.log('-------------------------');
  }
}
check();
