skill_name: coding
CFP_COUNT: 37
task: T-037 hide After-Sale daily-report drafts from work-hours-tracking page

## Status: DONE (2026-06-19)
All 5 sections [X]. tsc --noEmit clean. No frontend change needed.

## What shipped
Reconciliation records whose After-Sale Daily Report is `dailyReportStatus === 'draft'`
are now hidden from the work-hours-tracking page. Shown: 'submitted' + missing-field (legacy/mockup).
Filtered in-memory because Firestore '!=' can't express "missing OR submitted".

- S1 ProjectBDailyReportService.ts: status? on DailyEmployeeTimesheet + dailyReportStatus? on
  DailyTimesheetSummary; toTimesheetSummary sets dailyReportStatus: doc.status.
- S2 ReconciliationRecord.ts: dailyReportStatus? on record + input; serialize + parse.
- S3 ReconciliationService.ts: input build + update path (`?? existing` handles submit->un-submit);
  create via ...input spread; MISSING_DAILY left undefined.
- S4 ReconciliationService.ts getRecords(~1666) + getStats(~2007): in-memory draft filter,
  recompute total/page slice + per-status counts; employeeCount stays a count() aggregate.
- S5 docs/work-hour-monitoring-logic.md Section 13 documents the rule.

## Verify
Verify-1..5 all PASS · `cd backend && npx tsc --noEmit` clean.

## Notes
- Not yet committed. Branch: integration.
- Legacy no-status rows are mockup; user deletes them later.
- After-Sale creds in AFTER_SALE_KEY_BASE64 env (gitignored) — never commit/log/expose.
