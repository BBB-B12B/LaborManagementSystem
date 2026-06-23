date: 2026-06-23
task: T-046 FM Self-Performed Checkbox — Daily Report
objective: FM (Field Manager) needs to log tasks they did themselves (no contractors) in daily report for personal performance tracking, without affecting wage calculations.

constraints:
  - dailyContractorId is required in DailyReportEntry — must use FM sentinel: 'FM:{userId}'
  - fmSelfPerformed + workers are mutually exclusive per work section
  - FM entries must NOT affect summary.workerCount or summary.totalNetHours (pure performance record)
  - Wage calculation (WagePeriodService) loops real contractors — FM sentinel ID naturally excluded
  - Each work section (regular, OT morning/noon/evening) independently supports the checkbox

affected_files:
  - frontend/src/services/dailyReportService.ts — add fmSelfPerformed?: boolean to DailyReportEntry
  - backend/src/models/DailyReport.ts — add fmSelfPerformed?: boolean to DailyReportEntry
  - frontend/src/page-components/daily-reports/mobile/DailyReportEntryModal.tsx — checkbox UI + mutual exclusivity + save logic
  - backend/src/services/dailyReport/DailyReportService.ts — addWorkEntry: skip contractor lookup + skip summary deltas for FM entries
  - frontend/src/page-components/daily-reports/components/DailyReportDashboard.tsx — display FM entries with 'FM ทำเอง' chip

acceptance_criteria:
  - Checkbox "FM ทำเองโดยไม่มีแรงงาน" appears below worker list in each work section
  - Checking FM checkbox disables worker list interaction
  - Selecting any worker disables the FM checkbox for that section
  - Saving with FM checked creates an entry with dailyContractorId='FM:{userId}' and fmSelfPerformed=true
  - Backend addWorkEntry skips dailyContractors lookup for FM entries; uses name='FM' and workerCountDelta=0, hoursDelta=0 in summary
  - Dashboard shows 'FM ทำเอง' chip instead of 'DC' chip for FM entries
  - Existing contractor flow unchanged
