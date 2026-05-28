import 'dotenv/config';
import { db } from '../src/config/firebase';
import { afterSaleDb } from '../src/config/firebaseProjectB';

// Unconditionally force emulator local host
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function main() {
  console.log('Fetching user 100051...');
  const userDoc = await db.collection('users').doc('100051').get();
  const user = userDoc.data();
  console.log('User 100051:', JSON.stringify(user, null, 2));

  console.log('\nFetching all tasks from afterSaleDb...');
  const tasksSnap = await afterSaleDb.collectionGroup('tasks').get();
  const taskDocRef = tasksSnap.docs.find(d => d.data().taskId === 'STR-0001-001');
  if (!taskDocRef) {
    console.log('Task STR-0001-001 not found!');
    return;
  }
  const task = taskDocRef.data() as any;
  
  // Fetch its subtasks
  const subtasksSnap = await taskDocRef.ref.collection('subtasks').get();
  task.subtasks = subtasksSnap.docs.map(d => d.data());
  
  console.log('Task Data:', JSON.stringify(task, null, 2));

  // Run simulation of filterTasksByRole
  console.log('\n--- Running simulation of filterTasksByRole ---');
  
  const role = String(user?.roleCode || user?.roleId || '').toUpperCase();
  const isAdmin = ['AM', 'GOD', 'ADMIN'].includes(role);
  const dept = user?.department;
  const isHO = dept === 'HO';
  
  console.log(`isAdmin: ${isAdmin}, isHO: ${isHO}, dept: ${dept}`);
  
  if (isAdmin || isHO) {
    console.log('Simulation: Returns all tasks (No filter applied because isAdmin or isHO)');
    // If we bypass filter, then STR-0001-001-0002 is included.
  }

  const userProjectIds = user?.projectLocationIds || [];
  const employeeId = user?.employeeId;
  const isWH = dept === 'WH';
  
  const isMyProject = userProjectIds.includes(task.projectId);
  console.log(`\nIf we enforce filtering:`);
  console.log(`isWH: ${isWH}, isMyProject: ${isMyProject}, userProjectIds: ${JSON.stringify(userProjectIds)}, task.projectId: ${task.projectId}`);

  const allowedSubtasks = (task.subtasks || []).filter((sub: any) => {
    const isSubtaskSupport = sub.isSupportRequest || false;
    const isSubtaskPickedUp = sub.isPickedUpBySupport || false;

    console.log(`\nEvaluating Subtask: ${sub.subtaskId} (${sub.subtaskName})`);
    console.log(`  isSubtaskSupport: ${isSubtaskSupport}, isSubtaskPickedUp: ${isSubtaskPickedUp}`);

    if (!isWH) {
      console.log('  Branch: !isWH');
      if (isMyProject) {
        if (isSubtaskSupport) {
          const isCreatedByMe = sub.createdBy === user?.id || sub.createdBy === user?.employeeId;
          const result = isSubtaskPickedUp || isCreatedByMe;
          console.log(`    isMyProject=true, isSubtaskSupport=true => result: ${result}`);
          return result;
        }
        return true;
      } else {
        const isCreatedByMe = sub.createdBy === user?.id || sub.createdBy === user?.employeeId;
        const isAssignedToMe = 
          sub.assignees?.some((a: any) => a.employeeId === employeeId || a.employeeId === user?.id) ||
          sub.supportAssignees?.some((sa: any) => sa.employeeId === employeeId || sa.employeeId === user?.id);
        
        if (isSubtaskSupport) {
          const result = isSubtaskPickedUp && (isCreatedByMe || isAssignedToMe);
          console.log(`    isMyProject=false, isSubtaskSupport=true => result: ${result}`);
          return result;
        }
        const result = isCreatedByMe || isAssignedToMe;
        console.log(`    isMyProject=false, isSubtaskSupport=false => result: ${result}`);
        return result;
      }
    } else {
      console.log('  Branch: isWH');
      if (isMyProject) {
        if (isSubtaskSupport) {
          const result = isSubtaskPickedUp;
          console.log(`    isMyProject=true, isSubtaskSupport=true => result: ${result}`);
          return result;
        }
        console.log(`    isMyProject=true, isSubtaskSupport=false => result: true`);
        return true;
      } else {
        const result = isSubtaskSupport && isSubtaskPickedUp;
        console.log(`    isMyProject=false => result: ${result} (isSupport && isPickedUp)`);
        return result;
      }
    }
  });

  console.log('\nIf filtered, allowed Subtasks output:', allowedSubtasks.map((s: any) => s.subtaskId));
}

main().catch(console.error);
