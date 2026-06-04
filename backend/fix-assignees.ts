import * as admin from 'firebase-admin';
const serviceAccount = require('./src/config/after-sale-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function fix() {
  const tasks = await db.collection('tasks').get();
  for (const doc of tasks.docs) {
    const data = doc.data();
    if (data.supportAssignees && data.supportAssignees.length > 0) {
      // Keep only Support users (Test1 999 is support, แสงสุรีย์ is site)
      const filtered = data.supportAssignees.filter((a: any) => !a.name.includes('แสงสุรีย์') && !a.name.includes('วีระยุทธ์'));
      if (filtered.length !== data.supportAssignees.length) {
        console.log(`Fixing task ${doc.id}`);
        await doc.ref.update({ supportAssignees: filtered });
      }
    }
  }
  console.log('Done');
}
fix();
