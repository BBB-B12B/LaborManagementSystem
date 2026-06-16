import { db } from '../src/config/firebase';

async function run() {
  console.log('Fetching all users...');
  const snapshot = await db.collection('users').get();
  console.log(`Found ${snapshot.size} users.`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`User: ${data.username} - ${data.name} (Role: ${data.roleId || data.roleCode})`);
    console.log(`  employeeId: ${data.employeeId}`);
    console.log(`  projectLocationId: ${data.projectLocationId}`);
    console.log(`  projectLocationIds: ${JSON.stringify(data.projectLocationIds)}`);
    console.log(`  projectLocation: ${JSON.stringify(data.projectLocation)}`);
    console.log('---');
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
