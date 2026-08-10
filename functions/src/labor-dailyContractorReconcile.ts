// ============================================================================
//  dailyContractorReconcile — DEPLOY THIS IN THE **LABOR** PROJECT
// ============================================================================
//  Daily safety net for `dailyContractorSync`. That trigger fires once, on
//  write, and silently could not recover if the cross-project write to After
//  Sale failed for any reason (cold start, transient network error, quota) —
//  a doc created/edited during such a window stays permanently out of sync
//  with nothing to notice or retry it.
//
//  This scheduled function re-derives the full desired state every run:
//    1. Read every Labor `dailyContractors` doc with department === "WH".
//    2. Diff each against its After Sale copy (same doc id).
//    3. Missing            -> create it.
//       Present but stale  -> update the drifted fields.
//       No longer WH / gone from Labor but still in After Sale -> delete it.
//  Same fields + same { merge: true } semantics as the onWrite trigger, so
//  running this changes nothing for a worker that's already in sync.
// ============================================================================

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as path from 'path';

if (!admin.apps.length) {
  admin.initializeApp();
}

const AFTER_SALE_APP_NAME = 'afterSaleApp';
const getAfterSaleDb = (): admin.firestore.Firestore => {
  const existing = admin.apps.find((a) => a && a.name === AFTER_SALE_APP_NAME);
  if (existing) return existing.firestore();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const afterSaleSA = require(path.resolve(__dirname, '../after-sale-key.json'));
  const app = admin.initializeApp(
    { credential: admin.credential.cert(afterSaleSA) },
    AFTER_SALE_APP_NAME
  );
  return app.firestore();
};

const WAREHOUSE_DEPT = 'WH';
const SYNCED_FIELDS = ['employeeId', 'name', 'skillId', 'department', 'isActive'] as const;

function buildPayload(contractorId: string, data: admin.firestore.DocumentData) {
  return {
    id: contractorId,
    employeeId: data.employeeId || '',
    name: data.name || '',
    skillId: data.skillId || '',
    department: data.department,
    isActive: data.isActive !== false,
  };
}

function isDrifted(
  desired: ReturnType<typeof buildPayload>,
  existing: admin.firestore.DocumentData
): boolean {
  return SYNCED_FIELDS.some((f) => existing[f] !== desired[f]);
}

export const dailyContractorReconcile = functions
  .region('asia-southeast1')
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const afterSaleDb = getAfterSaleDb();
    const labor = admin.firestore();

    const [laborSnap, afterSaleSnap] = await Promise.all([
      labor.collection('dailyContractors').get(),
      afterSaleDb.collection('dailyContractors').get(),
    ]);

    const laborWhIds = new Set<string>();
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const doc of laborSnap.docs) {
      const data = doc.data();
      if (data.department !== WAREHOUSE_DEPT) continue;
      laborWhIds.add(doc.id);

      const desired = buildPayload(doc.id, data);
      const targetRef = afterSaleDb.collection('dailyContractors').doc(doc.id);

      try {
        const existingDoc = afterSaleSnap.docs.find((d) => d.id === doc.id);
        if (!existingDoc || !existingDoc.exists) {
          await targetRef.set(
            { ...desired, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          );
          created++;
          console.log(`[dailyContractorReconcile] ✅ Created missing worker ${doc.id} (${desired.name}) in After Sale.`);
        } else if (isDrifted(desired, existingDoc.data())) {
          await targetRef.set(
            { ...desired, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          );
          updated++;
          console.log(`[dailyContractorReconcile] ✅ Healed drifted worker ${doc.id} (${desired.name}) in After Sale.`);
        }
      } catch (err) {
        failed++;
        console.error(`[dailyContractorReconcile] ❌ Failed to heal ${doc.id}:`, err);
      }
    }

    // Orphans: After Sale has a doc for a contractor that is no longer WH in
    // Labor (or no longer exists in Labor at all).
    let deleted = 0;
    for (const doc of afterSaleSnap.docs) {
      if (laborWhIds.has(doc.id)) continue;
      try {
        await afterSaleDb.collection('dailyContractors').doc(doc.id).delete();
        deleted++;
        console.log(`[dailyContractorReconcile] ✅ Removed orphaned worker ${doc.id} from After Sale.`);
      } catch (err) {
        failed++;
        console.error(`[dailyContractorReconcile] ❌ Failed to remove orphan ${doc.id}:`, err);
      }
    }

    console.log(
      `[dailyContractorReconcile] Done. created=${created} updated=${updated} deleted=${deleted} failed=${failed}`
    );
    return null;
  });
