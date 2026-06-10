import { db } from '../config/firebase';

async function main() {
  console.log('=== EXAMINING USERS FIELDS ===');
  const snap = await db.collection('users').get();
  let matchCount = 0;
  let mismatchCount = 0;

  snap.forEach((doc) => {
    const data = doc.data();
    const docId = doc.id;
    const lowercaseEmpId = data.employeeId;
    const uppercaseEmpId = data.Employeeid;

    if (lowercaseEmpId === docId || uppercaseEmpId === docId) {
      matchCount++;
    } else {
      mismatchCount++;
      console.log(
        `Mismatch! Doc ID: "${docId}" | employeeId: "${lowercaseEmpId}" | Employeeid: "${uppercaseEmpId}"`
      );
    }
  });

  console.log(`Matches docId: ${matchCount}`);
  console.log(`Mismatches docId: ${mismatchCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
