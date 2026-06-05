// Delete emulator env vars first to prevent client from routing to emulator
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_ENABLED;

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: 'd:/Labor Management System/backend/.env' });

// Delete again after dotenv loads them
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_HOST;
delete process.env.FIREBASE_EMULATOR_ENABLED;

// Initialize Project A (default)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// Initialize Project B
const serviceAccountPath = 'd:/Labor Management System/backend/src/config/after-sale-key.json';
const serviceAccountB = require(serviceAccountPath);
const afterSaleApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccountB),
}, 'afterSaleDb');

const db = admin.firestore();
const afterSaleDb = afterSaleApp.firestore();

async function main() {
  console.log("=== Start Project Config Sync ===");
  const now = new Date();

  // 1. Get all workOrders from Project B (afterSaleDb)
  const woSnap = await afterSaleDb.collection('workOrders').get();
  console.log(`Found ${woSnap.size} total work orders in Project B`);

  for (const woDoc of woSnap.docs) {
    const woData = woDoc.data();
    const projectId = woData.projectId;
    const woCode = (woData.workOrderCode || '').toUpperCase().trim();
    const woName = woData.workOrderName || 'General';

    if (!projectId || !woCode) {
      console.log(`Skipping invalid workOrder: ${woDoc.id}`);
      continue;
    }

    // A. Sync WorkOrder config to Project A
    const woConfigRef = db
      .collection('Project')
      .doc(projectId)
      .collection('workOrderConfigs')
      .doc(woCode);
    
    const woConfigDoc = await woConfigRef.get();
    if (!woConfigDoc.exists) {
      console.log(`[SYNC] Creating WorkOrder Config: Project ${projectId} -> WO ${woCode} (${woName})`);
      await woConfigRef.set({
        code: woCode,
        name: woName,
        createdAt: now,
        createdBy: 'migration_sync',
        leaderId: null,
        leaderName: null,
        leaderIds: [],
        leaderNames: [],
      });
    } else {
      console.log(`[SKIP] WorkOrder Config already exists: Project ${projectId} -> WO ${woCode}`);
    }

    // B. Get categories under this workOrder in Project B
    const catSnap = await afterSaleDb
      .collection('workOrders')
      .doc(woDoc.id)
      .collection('categories')
      .get();

    for (const catDoc of catSnap.docs) {
      const catData = catDoc.data();
      const catName = (catData.catName || '').trim();

      if (!catName) {
        continue;
      }

      // Check if Category config already exists in Project A
      const existingCatSnap = await db
        .collection('Project')
        .doc(projectId)
        .collection('categoryConfigs')
        .where('workOrderCode', '==', woCode)
        .where('name', '==', catName)
        .limit(1)
        .get();

      if (existingCatSnap.empty) {
        console.log(`[SYNC] Creating Category Config: Project ${projectId} -> WO ${woCode} -> Cat "${catName}"`);
        const newCatRef = db
          .collection('Project')
          .doc(projectId)
          .collection('categoryConfigs')
          .doc();
        
        await newCatRef.set({
          workOrderCode: woCode,
          name: catName,
          createdAt: now,
          createdBy: 'migration_sync',
        });
      } else {
        console.log(`[SKIP] Category Config already exists: Project ${projectId} -> WO ${woCode} -> Cat "${catName}"`);
      }
    }
  }

  console.log("=== Project Config Sync Completed ===");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
