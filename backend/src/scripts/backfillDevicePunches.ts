/**
 * Backfill: sync scanData.devicePunches to match the already-corrected scanData.punches
 * for CSV bulk-import records.
 *
 * Follow-up to backfillScanDataOTMetrics.ts — that script fixed `punches` (and the OT/
 * lateness metrics) but never touched `devicePunches`, which was originally set equal to
 * the (then-buggy) `punches` at CSV-import time (see ScanDataService.ts: `devicePunches:
 * group.punches`). Since `punches` has since been corrected, `devicePunches` is now stale
 * and no longer matches — the frontend's isOriginalIn/isOriginalOut check compares actual
 * segment times against `devicePunches` to decide black (original) vs orange (admin-edited)
 * display, so a stale value makes correctly-scanned times display as if an admin edited them.
 *
 * Scoped to isManuallyEdited !== true: a record that went through fillFromDailyReport's
 * manual-merge path intentionally preserves `devicePunches` as the true original device
 * scan even while `punches` reflects the merged/edited result — touching devicePunches on
 * those records would erase that legitimate distinction.
 *
 * Usage:
 *   npx ts-node src/scripts/backfillDevicePunches.ts             (dry-run, no writes)
 *   npx ts-node src/scripts/backfillDevicePunches.ts --commit    (write devicePunches)
 */
import { db } from '../config/firebase';

const COMMIT = process.argv.includes('--commit');

async function run() {
  console.log('Fetching scanData (isDeleted == false)...');
  const snap = await db.collection('scanData').where('isDeleted', '==', false).get();
  console.log(`Found ${snap.size} non-deleted scanData docs.`);

  const candidates = snap.docs.filter((doc) => {
    const data = doc.data();
    return (
      Array.isArray(data.allScans) &&
      data.allScans.length > 0 &&
      typeof data.normalStatus === 'number' &&
      data.isManuallyEdited !== true
    );
  });
  console.log(`Of those, ${candidates.length} are bulk-import, non-manually-edited candidates.`);

  let unchanged = 0;
  let changed = 0;
  let skippedManuallyEdited = 0;
  const examples: string[] = [];
  const errors: { id: string; error: string }[] = [];
  const batchSize = 400;
  let batch = db.batch();
  let pendingInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isManuallyEdited === true) {
      skippedManuallyEdited++;
    }
  }

  for (const doc of candidates) {
    try {
      const data = doc.data();
      const newDevicePunches: string[] = Array.isArray(data.punches) ? data.punches : [];
      const oldDevicePunches = JSON.stringify(data.devicePunches ?? []);
      const newStr = JSON.stringify(newDevicePunches);

      if (oldDevicePunches === newStr) {
        unchanged++;
        continue;
      }

      changed++;
      if (examples.length < 15) {
        examples.push(`${doc.id}: devicePunches ${oldDevicePunches} -> ${newStr}`);
      }

      if (COMMIT) {
        batch.update(doc.ref, { devicePunches: newDevicePunches });
        pendingInBatch++;
        if (pendingInBatch >= batchSize) {
          await batch.commit();
          batch = db.batch();
          pendingInBatch = 0;
        }
      }
    } catch (e: any) {
      errors.push({ id: doc.id, error: e.message ?? String(e) });
    }
  }

  if (COMMIT && pendingInBatch > 0) {
    await batch.commit();
  }

  console.log('\n=== Report =========================================');
  console.log(`Mode: ${COMMIT ? 'COMMIT (writes applied)' : 'DRY-RUN (no writes)'}`);
  console.log(`Total candidates (bulk-import, not manually edited): ${candidates.length}`);
  console.log(`Skipped (isManuallyEdited === true, entire collection): ${skippedManuallyEdited}`);
  console.log(`Unchanged:                    ${unchanged}`);
  console.log(`Changed:                      ${changed}`);
  if (examples.length > 0) {
    console.log('\nExamples (up to 15):');
    examples.forEach((e) => console.log(`  ${e}`));
  }
  if (errors.length > 0) {
    console.log(`\nErrors: ${errors.length}`);
    errors.slice(0, 20).forEach((e) => console.log(`  ${e.id}: ${e.error}`));
  }
  console.log('=====================================================');
  if (!COMMIT) {
    console.log('\nDry-run only — no writes were made. Re-run with --commit to apply.');
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
