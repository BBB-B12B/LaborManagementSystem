import admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'labor-management-system-33b06',
  });
}

const db = admin.firestore();

async function listDocs(projectName: string) {
  console.log(`Listing documents for project: ${projectName}`);
  try {
    const fieldPath = new FieldPath('หน่วยงาน/โครงการ');
    const snapshot = await db
      .collection('Wage Calculation system')
      .where(fieldPath, '==', projectName)
      .get();

    snapshot.forEach((doc) => {
      const d = doc.data();
      console.log(`- ${d['ชื่อผู้รับเหมา']} | ${d['ตำแหน่งงาน']}`);
    });
    console.log(`Total Docs: ${snapshot.size}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

listDocs('Live Ramintra');
