// ============================================================================
//  projectSync — DEPLOY THIS IN THE **LABOR** PROJECT (not After Sale)
// ============================================================================
//  ONE-WAY sync: Labor `Project` -> After Sale `projects`.
//
//  WHY it lives in the Labor project:
//    A Firestore trigger can only watch the database of the project it is
//    deployed in. Projects are created/edited in Labor, so the trigger must
//    run in Labor and write OUT to After Sale.
//
//  SETUP (in the Labor functions codebase):
//    1. Copy the After Sale service account key into the Labor functions
//       folder, e.g.  cloud-functions/after-sale-key.json
//       (the same file you have at After Sale repo: key/after-sale-key.json)
//       -> add it to .gitignore so it is never committed.
//    2. Put this file in the Labor functions source and export `projectSync`
//       from the Labor index.ts:   export { projectSync } from './projectSync';
//    3. tsconfig must have "resolveJsonModule": true (Labor's already does if
//       it mirrors After Sale).
//    4. Deploy from the Labor project:  firebase deploy --only functions:projectSync
//
//  KEY RULE: imageUrl is OWNED by After Sale. This payload MUST NOT include
//  imageUrl, and we use { merge: true } so the existing After Sale photo is
//  preserved on every sync.
//
//  Region note: Labor DB = Singapore (asia-southeast1). The trigger runs there.
//  The cross-region WRITE to the After Sale DB is handled by the After Sale
//  admin SDK client below and is safe.
// ============================================================================

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Default app = Labor project (this function's own project).
if (!admin.apps.length) {
  admin.initializeApp();
}

// After Sale app — cross-project write target.
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

export const projectSync = functions
  .region('asia-southeast1') // Labor DB region
  .firestore.document('Project/{projectId}')
  .onWrite(async (change, context) => {
    const projectId = context.params.projectId;
    const after = change.after.exists ? change.after.data() : null;

    const afterSaleDb = getAfterSaleDb();

    // --- DELETE propagate: Labor delete -> After Sale delete --------------
    if (!after) {
      try {
        await afterSaleDb.collection('projects').doc(projectId).delete();
        console.log(`[projectSync] ✅ Deleted project ${projectId} in After Sale.`);
      } catch (err) {
        console.error(`[projectSync] ❌ Delete failed for ${projectId}:`, err);
      }
      return;
    }

    // --- CREATE / UPDATE: Labor -> After Sale -----------------------------
    // NOTE: imageUrl intentionally omitted — After Sale owns it. merge:true
    // preserves the existing After Sale photo.
    const payload: admin.firestore.DocumentData = {
      id: projectId,
      code: after.code || projectId,
      projectCode: after.projectCode || '',
      name: after.projectName || after.name || '',
      affiliation: after.department || '',
      status: after.status || 'กำลังดำเนินการอยู่',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await afterSaleDb.collection('projects').doc(projectId).set(payload, { merge: true });
      console.log(`[projectSync] ✅ Synced project ${projectId} (${payload.name}) Labor -> After Sale.`);
    } catch (err) {
      console.error(`[projectSync] ❌ Sync failed for ${projectId}:`, err);
    }
  });
