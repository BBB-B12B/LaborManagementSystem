import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const serviceAccount = require(path.resolve(__dirname, 'src/config/after-sale-key.json'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'after-sale-system',
  });
}
async function test() {
  const db = admin.firestore();
  const scanDateStart = new Date('2025-09-04T00:00:00.000Z');
  const scanDateEnd = new Date('2025-09-04T23:59:59.999Z');
  const q = await db.collection('scanData').where('employeeId', '==', '300067').where('workDate', '>=', scanDateStart).where('workDate', '<=', scanDateEnd).get();
  console.log('Docs found:', q.docs.map(d => d.id));
  process.exit(0);
}
test();
