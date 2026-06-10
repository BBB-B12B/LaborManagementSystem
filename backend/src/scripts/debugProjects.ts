import { db } from '../config/firebase';

async function main() {
  console.log('=== PROJECT LOCATIONS ===');
  const projectsSnap = await db.collection('Project').get();
  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    console.log(
      `Doc ID: "${doc.id}" | code: "${data.code}" | projectCode: "${data.projectCode}" | name: "${data.projectName || data.name}" | workDays: ${JSON.stringify(data.workDays)} | followCompanyHoliday: ${data.followCompanyHoliday}`
    );
  }

  console.log('\n=== ACTIVE CONTRACTORS (Sample of first 10) ===');
  const contractorsSnap = await db
    .collection('dailyContractors')
    .where('isActive', '==', true)
    .limit(10)
    .get();
  for (const doc of contractorsSnap.docs) {
    const data = doc.data();
    console.log(
      `DC Doc ID: "${doc.id}" | employeeId: "${data.employeeId}" | name: "${data.name}" | projectLocationId: "${data.projectLocationId}"`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
