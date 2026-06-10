import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
  });
}

const db = admin.firestore();

async function backfillDCDepartment() {
  console.log('Starting Daily Contractor department backfill...');

  try {
    // 1. Fetch all projects and map their departments
    console.log('Fetching projects...');
    const projectsSnapshot = await db.collection('Project').get();
    const projectDepartmentMap = new Map<string, string>();

    projectsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.department) {
        projectDepartmentMap.set(doc.id, data.department);
      }
    });

    console.log(`Loaded ${projectDepartmentMap.size} projects with departments.`);

    // 2. Fetch all daily contractors
    console.log('Fetching daily contractors...');
    const dcSnapshot = await db.collection('dailyContractors').get();

    let updatedCount = 0;
    let skippedCount = 0;

    // 3. Update each contractor in batches
    const batchSize = 500;
    let batch = db.batch();
    let currentBatchCount = 0;

    for (const doc of dcSnapshot.docs) {
      const data = doc.data();
      const projectId = data.projectLocationId;

      // We overwrite it if there's a projectId, just to be safe.
      // If it doesn't have a projectId, we leave department as empty.
      const department = projectId ? projectDepartmentMap.get(projectId) || '' : '';

      // Update if department is missing or different
      if (data.department !== department) {
        batch.update(doc.ref, {
          department,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        currentBatchCount++;
        updatedCount++;
      } else {
        skippedCount++;
      }

      if (currentBatchCount >= batchSize) {
        console.log(`Committing batch of ${currentBatchCount} updates...`);
        await batch.commit();
        batch = db.batch();
        currentBatchCount = 0;
      }
    }

    // Commit any remaining updates
    if (currentBatchCount > 0) {
      console.log(`Committing final batch of ${currentBatchCount} updates...`);
      await batch.commit();
    }

    console.log('\n--- Backfill Summary ---');
    console.log(`Total DCs processed: ${dcSnapshot.size}`);
    console.log(`Updated DCs: ${updatedCount}`);
    console.log(`Skipped DCs: ${skippedCount}`);
    console.log('------------------------');
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    process.exit(0);
  }
}

backfillDCDepartment();
