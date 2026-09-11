# Gather Complete — T-081 Subcontractor management + daily-report integration
date: 2026-08-19
skill: coder
task: Add subcontractor (ผู้รับเหมา) management page + per-worker skill assessment storage + subcontractor headcount tab in the daily-report labor modal

## Objective
LMS currently records only DC labor (individual daily contractors) on a daily report.
Real projects also employ subcontractor companies. Add:
1. A `/subcontractor-management` page reachable from `/management` — CRUD companies, their workers,
   worker position, and a per-worker skill assessment (score 0/1/2 per skill topic).
2. Excel import for the initial bulk load (template: `Book2.xlsx`), plus manual add for the
   1-2-people-at-a-time case that follows.
3. Daily report: rename the labor button to "เลือกแรงงาน DC/ผู้รับเหมา"; split the labor modal into
   two tabs (DC | ผู้รับเหมา). Subcontractor entry = company + HEADCOUNT + work times (Day/OT), NOT
   named individuals.

## Confirmed requirements (from user, this session)
- Code naming: `subcontractor` / `subcontractors`. UI wording stays "ผู้รับเหมา".
- Company data + workers + skills persist to the AFTER-SALE Firestore, collection `contractors`.
- One company may supply workers to several projects — `location` lives on the WORKER row, not the company.
- No company-level skill aggregate. Skills are stored per worker only.
- Skill-assessment UI is OUT of scope for now; the DATA MODEL and the Excel import path are IN scope.
- Skill topic list is NOT a settings page. Same pattern as the existing DC `SkillSelect`:
  free-typed autocomplete whose options are derived from skill keys already present in stored data.
- `location` must resolve to a real LMS Project record (user will pre-align the Excel names).
- Both import AND manual add must work.
- 1 daily report may include several subcontractor companies; each carries its own headcount + times.

## Key findings (evidence)
| Finding | Evidence |
|---|---|
| After-sale DB handle already exists and is env-aware | `backend/src/config/firebaseProjectB.ts:83` exports `afterSaleDb`; emulator branch unifies to the LMS project (T-062), prod branch uses the after-sale service account |
| Destination DB must be chosen explicitly per collection | usage pattern e.g. `afterSaleDb.collection('lms_notifications')` in `notifications.routes.ts:25` |
| The daily report in scope is the AFTER-SALE task report | `frontend/src/services/dailyReportService.ts:427` → `workOrders/{woId}/categories/{catId}/tasks/{taskId}/dailyReports/{dateStr}`; saved via `POST /tasks/{taskId}/reports` |
| A SEPARATE LMS-side `dailyReports` collection exists (Excel/wage import only) — do not confuse | `backend/src/services/dailyReport/DailyReportService.ts:24` uses `collections.dailyReports` on the LMS `db` |
| There is NO `skills` collection in use | `COLLECTIONS.SKILLS = 'skills'` declared in `backend/src/config/collections.ts:34` but zero references; DC `skillId` is free text sourced from `positionName` (`dailyContractors.routes.ts:481`) |
| DC position dropdown is derived, not a table | `frontend/src/components/forms/SkillSelect.tsx` — `useQuery(getActiveDCs)` → `Set` of unique `dc.skillId`, `freeSolo` Autocomplete |
| `/management` is a card grid keyed by `href` | `frontend/src/pages/management/index.tsx:33-69` (`/project-management`, `/member-management`, `/dc-management`, `/management/company-holidays`) |
| Labor modal is inline in a 5,685-line page | `frontend/src/pages/daily-reports/index.tsx` — state `selectedWorkers`:894, `isWorkerModalOpen`:1123, button+label:3510/3519, validation:2432, payload build:2549 (`laborPayload`) / 2569 (`leavePayload`), Dialog:4166 |

## Excel template decoded (`C:\Users\101622\Downloads\Book2.xlsx`, Sheet1)
- Header row = row 3; data starts row 4. Sample rows 4-7 present.
- Columns to keep: B `Location`, C `สังกัดผู้รับเหมา`, D `รหัส`, E `ชื่อ-สกุลผู้ปฏิบัติงาน`,
  F `หมายเหตุ / ตำแหน่งงาน`, G `วันที่ประเมิน`, H `ผู้ประเมิน`, I..BD skill scores.
- Columns to drop: A `ลำดับ`, BE..BK summary columns.
- I..BD = 16 skill groups x 3 columns. Verified across all 4 sample rows:
  col1 = the score 0/1/2; col2 (`...ระดับ1`) = 1 iff score==1; col3 (`...ระดับ2`) = 1 iff score==2.
  => Store only col1 of each group (16 values). col2/col3 are derived and MUST NOT be stored.
- The 16 group names (col1 headers): งานปูน (ก่อ / ฉาบ) · งานสี (สกิม / ทาสี) · งานกระเบื้องและผนัง ·
  งานฝ้า / เพดาน · งานไม้ · งานโครงสร้างคอนกรีตเสริมเหล็ก (Precast) · งานโครงสร้างเหล็กรูปพรรณ (งานเชื่อม) ·
  งานติดตั้งสุขภัณฑ์ · งานติดตั้ง Protection · งานระบบไฟฟ้า · งานระบบประปา · งานระบบระบายอากาศ ·
  งานเหล็ก · งานมุงหลังคา · งานอลูมิเนียม คอมโพสิต · งานติดตั้งรั้ว
- Scoring legend (B2): 0 = ทำไม่ได้ | 1 = ทำได้บางส่วน | 2 = ทำได้ดีผ่านมาตรฐาน
- `วันที่ประเมิน` is an Excel serial number (e.g. 46224) — convert on import.
- The workbook's own summary columns BE..BJ are STALE/incorrect (row 6 reports ทักษะระดับ2=0 while
  งานไม้2=1; row 4 sums to 18 across 16 groups). Recompute in-app; never trust those cells.

## Constraints
- `daily-reports/index.tsx` is 5,685 lines — surgical edits only, no refactor.
- Do not modify the existing DC `SkillSelect` component; add a sibling for multi-value sub skills.
- Do not touch the parked IN/OUT work (`segmentEngine.ts`, its characterization test,
  `WorkHourComparisonTable.tsx`, `functions/lib/*`).
- Skill-score storage must be an open key/value map, not 16 fixed fields (future topic 17+).
- English only in `.sessions/`, `knowledge/`, code comments and commits.

## Affected files (planned)
backend/src/models/Subcontractor.ts (new)
backend/src/services/subcontractor/SubcontractorService.ts (new)
backend/src/api/routes/subcontractors.routes.ts (new)
backend/src/api/routes/index.ts
backend/src/utils/subcontractorExcel.ts (new)
backend/src/api/routes/tasks.routes.ts
frontend/src/services/subcontractorService.ts (new)
frontend/src/components/forms/SubSkillSelect.tsx (new)
frontend/src/pages/subcontractor-management/index.tsx (new)
frontend/src/page-components/subcontractor-management/components/* (new)
frontend/src/pages/management/index.tsx
frontend/src/pages/daily-reports/index.tsx

## Acceptance criteria
1. `/management` shows a "จัดการผู้รับเหมา" card linking to `/subcontractor-management`.
2. On that page a user can create a company, add workers manually (name, position, location→Project,
   code), and import `Book2.xlsx` to bulk-create companies + workers + skill scores.
3. Re-importing the same file updates the existing workers (matched by `รหัส`) instead of duplicating.
4. Stored worker docs contain exactly 16 skill entries as a key/value map, no `...ระดับ1/2` fields.
5. Company/worker data is written through `afterSaleDb` to collection `contractors`.
6. `/daily-reports` labor button reads "เลือกแรงงาน DC/ผู้รับเหมา".
7. The labor modal has two tabs; the ผู้รับเหมา tab takes company + headcount + Day/OT times and
   allows several companies in one report.
8. A submitted report persists the subcontractor entries alongside the existing DC labor payload.
9. `npx tsc --noEmit` clean in both `backend/` and `frontend/`.

## Open items deferred by the user
- Skill-assessment UI (scoring screen) — later task.
- Evaluator stored as a system user id rather than a free-text name — later task.
