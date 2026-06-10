import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'labor-management-system-33b06',
  });
}

const db = admin.firestore();

import { FieldPath } from 'firebase-admin/firestore';

async function checkProjectData(projectName: string) {
  console.log(`Investigating duplicates for project: ${projectName}`);
  try {
    const fieldPath = new FieldPath('หน่วยงาน/โครงการ');
    const snapshot = await db
      .collection('Wage Calculation system')
      .where(fieldPath, '==', projectName)
      .get();

    if (snapshot.empty) {
      console.log('No documents found for this project.');
      return;
    }

    console.log(`Found ${snapshot.size} documents.`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Contractor: ${data['ชื่อผู้รับเหมา']}`);
      console.log(`  Position: ${data['ตำแหน่งงาน']}`);
      console.log(`  Logs count: ${data.logs?.length || 0}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProjectData('Live Ramintra');
