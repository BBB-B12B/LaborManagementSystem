/**
 * Backfill: recompute scanData's OT/lateness metrics (normalStatus, regularHours,
 * lunchStatus, otMorningHours, otEveningHours, lateMinutes, isLate, punches) for
 * records that went through the CSV bulk-import path before the Asia/Bangkok
 * timezone fix — those fields were computed by reading .getHours() on a
 * correctly-converted Bangkok instant, which on the UTC-running server read the
 * wrong (UTC) hour, shifting every threshold check by 7 hours.
 *
 * Safe because `allScans` (HH:mm:ss) on each doc was already computed correctly
 * (via a separate, already-Bangkok-aware formatter) — this script recomputes the
 * metrics purely from that already-correct field, it never touches raw scan
 * instants or re-derives which calendar day a doc belongs to.
 *
 * Usage:
 *   npx ts-node src/scripts/backfillScanDataOTMetrics.ts             (dry-run, no writes)
 *   npx ts-node src/scripts/backfillScanDataOTMetrics.ts --commit    (write recomputed fields)
 */
import { db } from '../config/firebase';
import { ScanDataAggregator } from '../services/scanData/ScanDataAggregator';

const COMMIT = process.argv.includes('--commit');

async function run() {
  console.log('Fetching scanData (isDeleted == false)...');
  const snap = await db.collection('scanData').where('isDeleted', '==', false).get();
  console.log(`Found ${snap.size} non-deleted scanData docs.`);

  // Only docs from the bulk-import path carry these fields at all — manual single-scan
  // adds never set them.
  const candidates = snap.docs.filter((doc) => {
    const data = doc.data();
    return Array.isArray(data.allScans) && data.allScans.length > 0 && typeof data.normalStatus === 'number';
  });
  console.log(`Of those, ${candidates.length} are bulk-import records with OT metrics to check.`);

  let unchanged = 0;
  let changed = 0;
  const fieldChangeCounts = new Map<string, number>();
  const examples: string[] = [];
  const errors: { id: string; error: string }[] = [];
  const batchSize = 400;
  let batch = db.batch();
  let pendingInBatch = 0;

  for (const doc of candidates) {
    try {
      const data = doc.data();
      const allScans: string[] = data.allScans;
      const scanMins = allScans
        .map((t) => ScanDataAggregator.timeStrToMins(t))
        .filter((m): m is number => m !== null);

      const metrics = ScanDataAggregator.computeMetrics(scanMins);
      const newPunches = allScans.map((t) => t.slice(0, 5));
      const newIsLate = (metrics.lateMinutes || 0) > 0;

      const fieldsToCompare: [string, unknown, unknown][] = [
        ['normalStatus', data.normalStatus ?? 0, metrics.normalStatus],
        ['regularHours', data.regularHours ?? 0, metrics.regularHours],
        ['lunchStatus', data.lunchStatus ?? 0, metrics.lunchStatus],
        ['otMorningHours', data.otMorningHours ?? 0, metrics.otMorningHours],
        ['otEveningHours', data.otEveningHours ?? 0, metrics.otEveningHours],
        ['lateMinutes', data.lateMinutes ?? 0, metrics.lateMinutes],
        ['isLate', data.isLate ?? false, newIsLate],
        ['punches', JSON.stringify(data.punches ?? []), JSON.stringify(newPunches)],
      ];

      const diffs = fieldsToCompare.filter(([, oldV, newV]) => oldV !== newV);

      if (diffs.length === 0) {
        unchanged++;
        continue;
      }

      changed++;
      diffs.forEach(([field]) => fieldChangeCounts.set(field, (fieldChangeCounts.get(field) ?? 0) + 1));

      if (examples.length < 15) {
        const summary = diffs.map(([field, oldV, newV]) => `${field}: ${oldV} -> ${newV}`).join(', ');
        examples.push(`${doc.id}: ${summary}`);
      }

      if (COMMIT) {
        batch.update(doc.ref, {
          normalStatus: metrics.normalStatus,
          regularHours: metrics.regularHours,
          lunchStatus: metrics.lunchStatus,
          otMorningHours: metrics.otMorningHours,
          otEveningHours: metrics.otEveningHours,
          lateMinutes: metrics.lateMinutes,
          isLate: newIsLate,
          punches: newPunches,
        });
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
  console.log(`Total bulk-import candidates: ${candidates.length}`);
  console.log(`Unchanged:                    ${unchanged}`);
  console.log(`Changed:                      ${changed}`);
  console.log('Changes by field:');
  if (fieldChangeCounts.size === 0) {
    console.log('  (none)');
  } else {
    [...fieldChangeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => console.log(`  ${field}: ${count}`));
  }
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
