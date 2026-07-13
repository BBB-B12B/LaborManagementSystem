# Gather Complete — T-054

date: 2026-07-13
task: T-054 · Eliminate mobile/PC logic-drift in daily-reports + workspace — single-source logic, CSS-only responsive difference
skill: editor (frontend multi-file targeted edits)

## Objective
User principle: mobile and PC must SHARE ONE logic set; only CSS/responsive layout may differ. Never two logic copies that can drift. Audit (3 parallel Explore agents, 314 files) located live drift + dead parallel implementations. Fix to the single-source principle.

## Findings (audit — read-only, file:line verified)
### LIVE drift (affects users now)
1. daily-reports/index.tsx — WorkerTableRow (desktop, :5103) vs WorkerMobileCard (mobile, :5394). Share handler updateWorkerTime (:1789) but each hard-codes its own checkbox disabled rules:
   - OT disabled: desktop `isReadOnly` (:5189/5211/5265) vs mobile `isReadOnly || !worker.times?.regular` (:5517/5518/5519). T-050 removed the "OT requires regular" constraint on desktop only → mobile still blocks OT until ปกติ ticked. (User-reported bug.)
   - otMorningTime default drift: canonical `06:00 - 08:00` (:1263/:954, mobile :5517) vs desktop fallback `08:00 - 12:00` (:5193).
2. workspace/index.tsx — kanban board: CSS toggle (mobile :1799-1986 / desktop :1988-2145) fine, but bucketing+sort+hidden-split logic copy-pasted per branch: bucket filter (mobile count :1810-1817, mobile list :1886-1892, desktop list :2008-2014), sort (mobile :1893-1902, desktop :2015-2024), hidden split (mobileHiddenTasks :1908 vs hiddenTasks :2032). Shared OK: filteredSubtasks (:990), getEffectiveSubtaskStatus (:100).
### DEAD parallel implementation (no route/link/redirect reaches — verified via grep)
3. pages/daily-reports/mobile/create.tsx (MobileDailyReportPage) + page-components/daily-reports/mobile/DailyReportEntryModal.tsx + page-components/daily-reports/components/DailyReportDashboard.tsx (@unused). Own model (WorkSectionState/workerIds), still enforces pre-T-050 OT-requires-regular (DailyReportEntryModal :292-296/:216-232), omits leave/med-cert entirely. DailyReportDashboard already drifted from create.tsx.
### CLEAN (checked, no action): requests table/cards, workspace toolbar/tree, Navbar, PhotoSourcePicker, Login, Layout, useResponsive (unused). Share logic; differ only in CSS.

## Folds in the 2 originally-reported issues
- OT-เย็น-requires-normal bug on mobile → S1
- DC button row unbalanced on mobile → S2

## Constraints
- Single-source: extract shared RULES (not JSX layout). Layouts stay separate (card vs table); rules identical via one helper/constant.
- Desktop behavior (post-T-050) is the correct target. Mobile matches desktop.
- Frontend only. No data-model / backend change.
- Deletions (S4) = R14 gate; user pre-authorized full scope incl. delete, still emit [gate].

## Affected files
- frontend/src/pages/daily-reports/index.tsx (S1 shift-cell rules + S2 DC buttons)
- frontend/src/pages/workspace/index.tsx (S3 bucketedColumns)
- DELETE (S4): frontend/src/pages/daily-reports/mobile/create.tsx · frontend/src/page-components/daily-reports/mobile/DailyReportEntryModal.tsx · frontend/src/page-components/daily-reports/components/DailyReportDashboard.tsx

## Acceptance criteria
- Mobile OT เช้า/เที่ยง/เย็น enabled without ปกติ ticked (matches desktop); otMorning default identical both.
- One shared shift-cell rule helper used by BOTH cards (grep proves single source).
- DC header stacks vertical + full-width button on xs; unchanged md+.
- Workspace board: one memoized bucketedColumns consumed by both branches; no duplicated bucket/sort/hidden expressions remain.
- 3 dead files deleted; no dangling imports; index_files.json updated.
- frontend npx tsc --noEmit EXIT=0; browser mobile-viewport verified.

### Files Read — Phase 1 (audit via 3 Explore subagents + direct reads)
| File | Why | Lines |
|---|---|---|
| daily-reports/index.tsx | WorkerMobileCard/TableRow rules + DC buttons | 1789-1864, 3358-3419, 5103-5551 |
| workspace/index.tsx | board branches bucket/sort/hidden | 1799-2145 (agent) |
| daily-reports/mobile/create.tsx + mobile/DailyReportEntryModal.tsx | dead parallel flow | full (agent) |
| page-components/daily-reports/components/DailyReportDashboard.tsx | dead clone | full (agent) |
| hooks/useResponsive.ts, PhotoSourcePicker, login, Navbar, Layout | confirm CSS-only | agent |
