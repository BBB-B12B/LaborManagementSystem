// @ts-nocheck
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { ScanData, generateScanDocId, formatWorkDate, formatPunchTime } from '../models/ScanData';

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(
  __dirname,
  '../../keys/labor-management-system-33b06-firebase-adminsdk-fbsvc-c5a6266fd9.json'
);
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service Account Key not found at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

interface LegacyScanData {
  id: string;
  dailyContractorId: string;
  employeeId: string;
  employeeNumber?: string;
  projectLocationId: string;
  scanDateTime: FirebaseFirestore.Timestamp;
  workDate: FirebaseFirestore.Timestamp;
  isDeleted?: boolean;
  notes?: string;
  importedBy?: string;
  importedAt?: FirebaseFirestore.Timestamp;
}

async function migrateScanData() {
  console.log('Starting ScanData Migration...');

  const scanCollection = db.collection('scanData');
  const snapshot = await scanCollection.get();

  console.log(`Found ${snapshot.size} total documents.`);

  const dailyMap = new Map<
    string,
    {
      employeeId: string;
      employeeNumber?: string;
      projectLocationId: string;
      workDateStr: string;
      workDateObj: Date;
      punches: Set<string>;
      legacyIds: string[];
      metadata: any;
    }
  >();

  let skippedCount = 0;
  let processedCount = 0;

  // 1. Group by Employee + Date
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as LegacyScanData;
    const docId = doc.id;

    // Skip already migrated docs (starts with SCAN_)
    if (docId.startsWith('SCAN_')) {
      skippedCount++;
      return;
    }

    const scanDate = data.scanDateTime.toDate();
    const workDateStr = formatWorkDate(scanDate);
    const punchTime = formatPunchTime(scanDate);

    // Aggregation Key: SCAN_[EmpID]_[Date]
    const newDocId = generateScanDocId(data.employeeId, workDateStr);

    if (!dailyMap.has(newDocId)) {
      dailyMap.set(newDocId, {
        employeeId: data.employeeId,
        employeeNumber: data.employeeNumber || data.employeeId,
        projectLocationId: data.projectLocationId,
        workDateStr: workDateStr,
        workDateObj: data.workDate ? data.workDate.toDate() : scanDate, // Fallback
        punches: new Set(),
        legacyIds: [],
        metadata: {
          importedBy: data.importedBy || 'system',
          importedAt: data.importedAt ? data.importedAt.toDate() : new Date(),
          isDeleted: data.isDeleted || false,
        },
      });
    }

    const entry = dailyMap.get(newDocId)!;
    entry.punches.add(punchTime);
    entry.legacyIds.push(docId);
    processedCount++;
  });

  console.log(
    `Grouped ${processedCount} legacy records into ${dailyMap.size} daily summaries. Skipped ${skippedCount} existing new-format records.`
  );

  if (dailyMap.size === 0) {
    console.log('No records to migrate.');
    return;
  }

  // 2. Write New Docs & Delete Old Docs
  const batchSize = 400;
  let batch = db.batch();
  let operationCount = 0;
  let batchesCommitted = 0;

  for (const [newId, entry] of dailyMap) {
    const sortedPunches = Array.from(entry.punches).sort();

    const newDoc: ScanData = {
      id: newId,
      employeeId: entry.employeeId,
      employeeNumber: entry.employeeNumber,
      projectLocationId: entry.projectLocationId,
      workDate: entry.workDateStr,
      punches: sortedPunches,
      firstIn: sortedPunches[0],
      lastOut: sortedPunches[sortedPunches.length - 1],
      isDeleted: entry.metadata.isDeleted,
      importedBy: entry.metadata.importedBy,
      importedAt: entry.metadata.importedAt,
      createdAt: new Date(), // Migration time
      updatedAt: new Date(),
      importSource: 'migration',
      importNote: `Migrated from ${entry.legacyIds.length} records`,
    };

    // Set New Doc
    const newRef = scanCollection.doc(newId);
    batch.set(newRef, newDoc);
    operationCount++;

    // Delete Legacy Docs
    for (const oldId of entry.legacyIds) {
      const oldRef = scanCollection.doc(oldId);
      batch.delete(oldRef);
      operationCount++;
    }

    if (operationCount >= batchSize) {
      await batch.commit();
      batchesCommitted++;
      console.log(`Committed batch ${batchesCommitted}...`);
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    console.log('Committed final batch.');
  }

  console.log('Migration Completed Successfully.');
  process.exit(0);
}

migrateScanData().catch((err) => {
  console.error('Migration Failed:', err);
  process.exit(1);
});
