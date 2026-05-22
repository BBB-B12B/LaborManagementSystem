import { db } from '../config/firebase';

async function getAssigneeName(assigneeId: string): Promise<string | null> {
  try {
    // 1. Direct document lookup (doc ID = assigneeId)
    const doc = await db.collection('users').doc(assigneeId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data) {
        const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
        if (name) return name;
      }
    }
    // 2. Query by lowercase 'employeeId'
    const lowercaseSnap = await db.collection('users')
      .where('employeeId', '==', assigneeId)
      .limit(1)
      .get();
    if (!lowercaseSnap.empty) {
      const data = lowercaseSnap.docs[0].data();
      const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
      if (name) return name;
    }
    // 3. Query by uppercase 'Employeeid'
    const uppercaseSnap = await db.collection('users')
      .where('Employeeid', '==', assigneeId)
      .limit(1)
      .get();
    if (!uppercaseSnap.empty) {
      const data = uppercaseSnap.docs[0].data();
      const name = data.Fullname || data.name || data.fullNameEn || data.Fullnameen;
      if (name) return name;
    }
  } catch (err) {
    console.warn(`[getAssigneeName] failed for ${assigneeId}:`, err);
  }
  return null;
}

async function main() {
  console.log("=== STARTING RETROACTIVE ASSIGNEE NAME BACKFILL ===");
  const snap = await db.collection('reconciliationRecords').get();
  console.log(`Total reconciliation records in DB: ${snap.size}`);

  let updatedCount = 0;
  let skippedCount = 0;
  let batch = db.batch();

  for (const doc of snap.docs) {
    const data = doc.data();
    const assigneeId = data.assigneeId;
    const assigneeName = data.assigneeName;

    // Check if assigneeId is present but assigneeName is null/missing/empty
    if (assigneeId && (!assigneeName || assigneeName === 'Unknown')) {
      console.log(`Resolving name for AssigneeId: ${assigneeId} (Doc: ${doc.id})`);
      const resolvedName = await getAssigneeName(assigneeId);
      
      if (resolvedName) {
        console.log(`   -> Resolved to: "${resolvedName}"`);
        batch.update(doc.ref, {
          assigneeName: resolvedName,
          updatedAt: new Date()
        });
        updatedCount++;
        
        // Firestore batch limits to 500 operations
        if (updatedCount % 200 === 0) {
          await batch.commit();
          batch = db.batch();
          console.log(`Committed ${updatedCount} updates...`);
        }
      } else {
        console.log(`   -> Could not resolve name for AssigneeId: ${assigneeId}`);
        skippedCount++;
      }
    }
  }

  if (updatedCount % 200 !== 0) {
    await batch.commit();
  }

  console.log("\n=== BACKFILL COMPLETED ===");
  console.log(`Successfully updated: ${updatedCount} records`);
  console.log(`Could not resolve: ${skippedCount} records`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
