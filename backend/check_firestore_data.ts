
import * as admin from 'firebase-admin';
import { collections } from './src/config/collections';

// Initialize Firebase Admin (assuming credentials are in environment or default path)
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'labor-management-system-5e16b', // From logs
  });
}

const db = admin.firestore();

async function checkScanData() {
  console.log('Checking scanData collection...');
  try {
    const snapshot = await db.collection('scanData').limit(5).get();
    if (snapshot.empty) {
      console.log('No data found in scanData collection.');
      return;
    }

    console.log(`Found ${snapshot.size} documents. Sample data:`);
    snapshot.forEach(doc => {
      console.log(`ID: ${doc.id}`);
      const data = doc.data();
      console.log('Fields:', Object.keys(data).filter(k => k.startsWith('Time') || k === 'allScans' || k === 'employeeId' || k === 'scanDate'));
      console.log('Time1-6:', {
        Time1: data.Time1,
        Time2: data.Time2,
        Time3: data.Time3,
        Time4: data.Time4,
        Time5: data.Time5,
        Time6: data.Time6,
      });
      console.log('---');
    });
  } catch (error) {
    console.error('Error checking Firestore:', error);
  }
}

checkScanData();
