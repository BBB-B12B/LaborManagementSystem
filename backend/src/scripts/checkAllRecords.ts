import { db } from '../config/firebase';

async function main() {
  console.log("=== CHECKING ALL RECONCILIATION RECORDS IN DB ===");
  const snap = await db.collection('reconciliationRecords').get();
  console.log(`Total reconciliation records in DB: ${snap.size}`);
  
  let nullAssigneeNameCount = 0;
  let hasAssigneeNameCount = 0;
  let noAssigneeIdCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.assigneeId) {
      noAssigneeIdCount++;
    } else if (!data.assigneeName) {
      nullAssigneeNameCount++;
      if (nullAssigneeNameCount <= 10) {
        console.log(`[Null Name] Doc: ${doc.id} | Date: ${data.workDate} | EmpId: ${data.employeeId} | EmpName: ${data.employeeName} | AssigneeId: ${data.assigneeId} | AssigneeName: ${data.assigneeName}`);
      }
    } else {
      hasAssigneeNameCount++;
      if (hasAssigneeNameCount <= 5) {
        console.log(`[Has Name] Doc: ${doc.id} | Date: ${data.workDate} | EmpId: ${data.employeeId} | EmpName: ${data.employeeName} | AssigneeId: ${data.assigneeId} | AssigneeName: ${data.assigneeName}`);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Records with no assigneeId: ${noAssigneeIdCount}`);
  console.log(`Records with assigneeId but NULL assigneeName: ${nullAssigneeNameCount}`);
  console.log(`Records with assigneeId and VALID assigneeName: ${hasAssigneeNameCount}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
