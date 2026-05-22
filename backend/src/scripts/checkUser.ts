import { db } from '../config/firebase';

async function main() {
  const assigneeId = "101510";
  console.log(`=== CHECKING USER WITH Employeeid = "${assigneeId}" ===`);
  
  // Try exact match as string
  const snap1 = await db.collection('users').where('Employeeid', '==', assigneeId).get();
  console.log(`Match as string: ${snap1.size}`);
  snap1.forEach(doc => {
    console.log("Data:", JSON.stringify(doc.data(), null, 2));
  });

  // Try exact match as number
  const snap2 = await db.collection('users').where('Employeeid', '==', parseInt(assigneeId, 10)).get();
  console.log(`Match as number: ${snap2.size}`);
  snap2.forEach(doc => {
    console.log("Data (as number):", JSON.stringify(doc.data(), null, 2));
  });
  
  // Print a few users to see the structure
  console.log("\n=== FIRST 3 USERS IN COLLECTION ===");
  const first3 = await db.collection('users').limit(3).get();
  first3.forEach(doc => {
    const data = doc.data();
    console.log(`Doc ID: ${doc.id} | Employeeid: ${data.Employeeid} | type: ${typeof data.Employeeid} | name: ${data.name || data.Fullname}`);
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
