const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with credentials
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getWagePeriods() {
  try {
    console.log('Fetching wage periods...');
    const snapshot = await db.collection('wagePeriods').get();
    
    if (snapshot.empty) {
      console.log('No wage periods found.');
      return;
    }

    console.log(`Found ${snapshot.size} wage periods:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Period Code: ${data.periodCode}`);
      console.log(`Status: ${data.status}`);
      console.log(`Start Date: ${data.startDate ? new Date(data.startDate._seconds * 1000).toISOString() : 'N/A'}`);
      console.log(`End Date: ${data.endDate ? new Date(data.endDate._seconds * 1000).toISOString() : 'N/A'}`);
      console.log('------------------------');
    });
  } catch (error) {
    console.error('Error fetching wage periods:', error);
  } finally {
    process.exit(0);
  }
}

getWagePeriods();
