import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

async function debugDiscrepancy() {
  const empCode = '200022';
  const dateStr = '2025-08-29';
  const targetDate = new Date(dateStr);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Searching for empCode: ${empCode}, Date: ${dateStr}`);
  
  const snapshot = await db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
    .where('employeeNumber', '==', empCode)
    .get();

  console.log(`Found ${snapshot.size} records for code ${empCode}`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const workDate = data.workDate.toDate ? data.workDate.toDate() : new Date(data.workDate);
    console.log(`Doc ID: ${doc.id}`);
    console.log(`- workDate: ${workDate.toISOString()}`);
    console.log(`- isManuallyEdited: ${data.isManuallyEdited}`);
    console.log(`- status: ${data.status}`);
  });
}

debugDiscrepancy().catch(console.error);
