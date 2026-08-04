/**
 * Backfill: re-classify reconciliationRecords that were incorrectly marked MATCHED
 * while the underlying daily report was still a draft.
 *
 * Root cause (fixed in functions/src/index.ts this session): the Cloud Function's
 * legacy "OT-only day" punch-coverage fallback compared the draft report's declared
 * shiftTimes punches against real scan times without first gating them for
 * isDraftReport, so an unsubmitted report whose declared hours happened to roughly
 * match the scan times got classified MATCHED. The backend TypeScript service
 * (ReconciliationService.ts) already gated this correctly — it never had the bug —
 * so re-running classification through it produces the correct result.
 *
 * Candidates: reconciliationRecords where dailyReportStatus == 'draft' AND
 * status == 'MATCHED' AND no jobSegments (the jobSegments path is unaffected by
 * this specific bug). Skips (report, don't write): isLocked === true, or workDate
 * falls inside a WagePeriod with status 'calculated' (frozen for review but not
 * yet approved/locked) — same safety exclusions as backfillJobSegmentsCutover.ts.
 *
 * Usage:
 *   npx ts-node src/scripts/backfillDraftMatchedRecords.ts             (dry-run, no writes)
 *   npx ts-node src/scripts/backfillDraftMatchedRecords.ts --commit    (re-run + write)
 */
import { db } from '../config/firebase';
import { classifyByPunchCoverage } from '../services/reconciliation/segmentEngine';
import { reconciliationService } from '../services/reconciliation/ReconciliationService';

const COMMIT = process.argv.includes('--commit');

async function run() {
  const snap = await db
    .collection('reconciliationRecords')
    .where('dailyReportStatus', '==', 'draft')
    .where('status', '==', 'MATCHED')
    .get();

  const candidates = snap.docs.filter((doc) => {
    const d = doc.data();
    return !d.jobSegments || Object.keys(d.jobSegments).length === 0;
  });
  console.log(`Candidates (draft + MATCHED + no jobSegments): ${candidates.length}`);

  const calculatedPeriods = await db
    .collection('wagePeriods')
    .where('status', '==', 'calculated')
    .get();
  const frozenRanges = calculatedPeriods.docs.map((d) => {
    const p = d.data();
    return { start: p.startDate.toDate(), end: p.endDate.toDate(), projectCode: p.projectCode };
  });
  console.log(`Wage periods currently 'calculated' (frozen, not yet approved): ${frozenRanges.length}`);

  let skippedLocked = 0;
  let skippedFrozen = 0;
  let wouldChange = 0;
  let wouldStayMatched = 0;
  let committed = 0;
  const examples: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const doc of candidates) {
    const d = doc.data();
    if (d.isLocked === true) {
      skippedLocked++;
      continue;
    }
    const workDate = new Date(`${d.workDate}T12:00:00.000+07:00`);
    const isFrozen = frozenRanges.some((r) => workDate >= r.start && workDate <= r.end);
    if (isFrozen) {
      skippedFrozen++;
      continue;
    }

    const preview = classifyByPunchCoverage({
      dailyReportPunches: [], // isDraftReport is always true for these candidates -> gated to []
      scanPunches: d.scanPunches ?? [],
      timesheetNormalHours: undefined,
      timesheetOtMorning: undefined,
      timesheetOtNoon: undefined,
      timesheetOtEvening: undefined,
      dailyReportHours: undefined,
      isHoliday: false,
      isLeave: false,
      leaveHours: 0,
    } as any);

    if (preview.status === 'MATCHED') {
      wouldStayMatched++;
      continue;
    }

    wouldChange++;
    if (examples.length < 15) {
      examples.push(`${doc.id}: MATCHED -> ${preview.status} (scanPunches=${JSON.stringify(d.scanPunches)})`);
    }

    if (COMMIT) {
      try {
        await reconciliationService.generateForEmployee(d.employeeId, d.workDate, d.projectLocationId);
        committed++;
      } catch (e: any) {
        errors.push({ id: doc.id, error: e.message ?? String(e) });
      }
    }
  }

  console.log('\n=== Report =========================================');
  console.log(`Mode: ${COMMIT ? 'COMMIT (re-classified + written)' : 'DRY-RUN (preview only)'}`);
  console.log(`Skipped (isLocked):                ${skippedLocked}`);
  console.log(`Skipped (wage period calculated):  ${skippedFrozen}`);
  console.log(`Would stay MATCHED (no real bug hit): ${wouldStayMatched}`);
  console.log(`Would change status:               ${wouldChange}`);
  if (COMMIT) console.log(`Actually committed:                ${committed}`);
  if (examples.length > 0) {
    console.log('\nExamples (up to 15):');
    examples.forEach((e) => console.log(`  ${e}`));
  }
  if (errors.length > 0) {
    console.log(`\nErrors: ${errors.length}`);
    errors.forEach((e) => console.log(`  ${e.id}: ${e.error}`));
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
