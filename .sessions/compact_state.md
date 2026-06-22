dt=2026-06-19
s=0
task=T-037 hide After-Sale daily-report drafts from work-hours-tracking page
cfp=37
sk=coding
compact_size=8000
p3=in_progress
section=S4
step=in-memory draft filter in getRecords + getStats (ReconciliationService.ts ~1656/~1951)
session_reset=skip
notes=T-037 backend plumbing S1-S3 DONE: (S1) ProjectBDailyReportService.ts adds status?:'draft'|'submitted' to DailyEmployeeTimesheet + dailyReportStatus? to DailyTimesheetSummary + toTimesheetSummary sets dailyReportStatus:doc.status. (S2) ReconciliationRecord.ts adds dailyReportStatus? to both interfaces + serialize (~287) + parse (~428). (S3) ReconciliationService.ts main input build (~1290) sets dailyReportStatus:summary.dailyReportStatus; update path (~922 area) sets dailyReportStatus:input.dailyReportStatus ?? existing.dailyReportStatus; create path carries via ...input spread; MISSING_DAILY path (~1391) leaves undefined (correct). REMAINING: S4 = in-memory filter dailyReportStatus==='draft' OUT in getRecords(~1656, drop server .count()+offset, fetch bounded set, filter, recompute total+slice) + getStats(~1951, replace per-status .count() aggregates with in-memory count over draft-filtered docs). Rule: hide ONLY 'draft'; show missing-field(legacy/mockup) + 'submitted'. S5 = document in docs/work-hour-monitoring-logic.md. Close: tsc --noEmit in backend.
