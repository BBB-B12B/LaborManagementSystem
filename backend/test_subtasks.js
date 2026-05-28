const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'labor-management-system-33b06'
});

const db = admin.firestore();

async function test() {
  const querySnapshot = await db.collectionGroup('tasks').get();
  console.log('Total tasks:', querySnapshot.size);
  querySnapshot.forEach(doc => {
    console.log('Task Path:', doc.ref.path);
    console.log('taskId field:', doc.data().taskId);
    console.log('taskName field:', doc.data().taskName);
  });
}

test().then(() => process.exit(0)).catch(console.error);
