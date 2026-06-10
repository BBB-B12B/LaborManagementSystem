import admin from 'firebase-admin';
import dotEnv from 'dotenv';
dotEnv.config();

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-system-33b06',
  });
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting Migration: Individual Scans -> Daily Summaries (V2)');

  // 1. Fetch all scan data
  const scansSnapshot = await db.collection('scanData').get();
  console.log(`Found ${scansSnapshot.size} total scan records.`);

  if (scansSnapshot.empty) {
    console.log('No records to migrate.');
    return;
  }

  const rawScans = scansSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

  // 2. Group by Date (YYYY-MM-DD) and EmployeeID
  const groups = new Map<string, any[]>();
  for (const scan of rawScans) {
    let dateStr: string | null = null;
    if (scan.workDate) {
      const d = scan.workDate.toDate ? scan.workDate.toDate() : new Date(scan.workDate);
      dateStr = d.toISOString().split('T')[0];
    } else if (scan.scanDateTime) {
      const d = scan.scanDateTime.toDate ? scan.scanDateTime.toDate() : new Date(scan.scanDateTime);
      dateStr = d.toISOString().split('T')[0];
    }

    if (!dateStr || !scan.employeeId) {
      console.warn(`Skipping scan ${scan.id} due to missing date/employeeId.`);
      continue;
    }

    const key = `${dateStr}_${scan.employeeId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(scan);
  }

  console.log(`Grouped into ${groups.size} daily summaries.`);

  // 3. Process each group and enrich
  const contractorsCache = new Map<string, any>();
  const batchSize = 400;
  let currentBatch = db.batch();
  let opsCount = 0;

  const oldDocIdsToDelete = new Set<string>();

  for (const [key, scans] of groups.entries()) {
    const [dateStr, employeeId] = key.split('_');

    // Find one scan to get initial data
    const baseScan = scans[0];

    // Fetch contractor for enrichment
    let contractor = contractorsCache.get(baseScan.dailyContractorId || employeeId);
    if (!contractor) {
      const dcDoc = await db
        .collection('dailyContractors')
        .doc(baseScan.dailyContractorId || employeeId)
        .get();
      if (!dcDoc.exists) {
        const dcQuery = await db
          .collection('dailyContractors')
          .where('employeeId', '==', employeeId)
          .limit(1)
          .get();
        if (!dcQuery.empty) {
          contractor = dcQuery.docs[0].data();
        }
      } else {
        contractor = dcDoc.data();
      }
      if (contractor) contractorsCache.set(baseScan.dailyContractorId || employeeId, contractor);
    }

    // Sort scans chronologically
    const sortedScans = scans
      .filter((s) => s.scanDateTime || s.workDate)
      .sort((a, b) => {
        const dA = a.scanDateTime || a.workDate;
        const dB = b.scanDateTime || b.workDate;
        const tA = dA.toDate ? dA.toDate().getTime() : new Date(dA).getTime();
        const tB = dB.toDate ? dB.toDate().getTime() : new Date(dB).getTime();
        return tA - tB;
      });

    // Unique scan times (HH:mm:ss)
    const allTimes = Array.from(
      new Set(
        sortedScans.map((s) => {
          const dt = s.scanDateTime || s.workDate;
          const d = dt.toDate ? dt.toDate() : new Date(dt);
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        })
      )
    ).sort();

    const timeSlots: any = {};
    for (let i = 1; i <= 6; i++) {
      timeSlots[`time${i}`] = allTimes[i - 1] || null;
    }

    const newDocId = key; // YYYY-MM-DD_EmployeeID
    const newDocRef = db.collection('scanData').doc(newDocId);

    const newDocData = {
      ...baseScan,
      id: newDocId,
      name: contractor?.name || 'Unknown',
      position: contractor?.skillId || 'Unknown',
      projectLocationIds: contractor?.projectLocationIds || [baseScan.projectLocationId],
      projectLocationId: baseScan.projectLocationId,
      scanDate: dateStr,
      allScans: allTimes,
      ...timeSlots,
      rawData: {
        ...baseScan.rawData,
        migratedFrom: scans.map((s) => s.id),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Mark old IDs for deletion
    scans.forEach((s) => {
      if (s.id !== newDocId) {
        oldDocIdsToDelete.add(s.id);
      }
    });

    currentBatch.set(newDocRef, newDocData);
    opsCount++;

    if (opsCount >= batchSize) {
      await currentBatch.commit();
      currentBatch = db.batch();
      opsCount = 0;
      console.log(`Committed ${batchSize} new summaries...`);
    }
  }

  if (opsCount > 0) {
    await currentBatch.commit();
  }

  // 4. Delete old records
  console.log(`Deleting ${oldDocIdsToDelete.size} old individual records...`);
  const deleteIds = Array.from(oldDocIdsToDelete);
  opsCount = 0;
  currentBatch = db.batch();

  for (const id of deleteIds) {
    currentBatch.delete(db.collection('scanData').doc(id));
    opsCount++;
    if (opsCount >= batchSize) {
      await currentBatch.commit();
      currentBatch = db.batch();
      opsCount = 0;
      process.stdout.write('.');
    }
  }

  if (opsCount > 0) {
    await currentBatch.commit();
  }

  console.log('\nMigration completed successfully.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
