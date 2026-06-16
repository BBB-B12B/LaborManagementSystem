import { db } from '../config/firebase';

async function run() {
  console.log('Fetching active dailyContractors...');
  const snapshot = await db.collection('dailyContractors').where('isActive', '==', true).get();
  console.log(`Found ${snapshot.size} active dailyContractors.`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Check if any foreman has usage
    const foremanUsage = data.foremanUsage || {};
    const hasUsage = Object.keys(foremanUsage).length > 0;
    
    if (hasUsage) {
      console.log(`Contractor: ${data.employeeId} - ${data.name}`);
      console.log(`  projectLocationIds: ${JSON.stringify(data.projectLocationIds)}`);
      console.log(`  foremanUsage: ${JSON.stringify(foremanUsage)}`);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
