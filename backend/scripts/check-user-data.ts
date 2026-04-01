
import { db } from '../src/config/firebase';
import { COLLECTIONS } from '../src/config/collections';

async function checkData() {
  const empId = '200022';
  
  console.log(`Checking ScanData for employee: ${empId}`);
  const scanSnapshot = await db.collection(COLLECTIONS.SCAN_DATA)
    .where('employeeNumber', '==', empId)
    .get();
    
  console.log(`Found ${scanSnapshot.size} ScanData records.`);
  scanSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Date: ${data.scanDate}, Project: ${data.projectLocationId}`);
  });

  console.log(`Checking Discrepancies for employee: ${empId}`);
  const discSnapshot = await db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
    .where('dailyContractorId', '==', empId) // Wait, is it dailyContractorId or employeeNumber?
    .get();
  
  if (discSnapshot.size === 0) {
    // Try by employeeNumber if stored there
    const discSnapshot2 = await db.collection(COLLECTIONS.SCAN_DATA_DISCREPANCIES)
      .where('employeeNumber', '==', empId)
      .get();
    console.log(`Found ${discSnapshot2.size} Discrepancy records (by employeeNumber).`);
    discSnapshot2.forEach(doc => {
      console.log(`- ID: ${doc.id}, Type: ${doc.data().discrepancyType}, Status: ${doc.data().status}`);
    });
  } else {
    console.log(`Found ${discSnapshot.size} Discrepancy records.`);
    discSnapshot.forEach(doc => {
      console.log(`- ID: ${doc.id}, Type: ${doc.data().discrepancyType}, Status: ${doc.data().status}`);
    });
  }
}

checkData().catch(console.error);
