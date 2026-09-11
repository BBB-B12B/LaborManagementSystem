# MECE Plan — T-081 Subcontractor management + daily-report integration
date: 2026-08-19
task: T-081 · Add subcontractor (ผู้รับเหมา) management page + per-worker skill storage on after-sale `contractors`, and a DC/ผู้รับเหมา two-tab labor modal on /daily-reports
skill: coder

## HANDOFF — read this first (for anyone picking this task up)

Status: PLANNED, NOT STARTED — 0 of 11 sections done. No source file has been touched yet.

Start here:
  1. Read `.sessions/gather_complete.md` — the investigation behind this plan (evidence with file:line,
     the full Excel column decode, acceptance criteria).
  2. Read `## Data model` below — every section builds against it. It is the single source of truth
     for the Firestore shape; do not re-invent field names per section.
  3. Work the sections in `### Cycle grouping` order, top to bottom.

Four things this plan does NOT resolve — settle them before the first code edit:
  1. TEMPLATE FILE is not in the repo. The source workbook lives on the task owner's machine
     (`C:\Users\101622\Downloads\Book2.xlsx`). Ask the owner for a copy before testing S3 (Excel
     import). The full column decode IS recorded in gather_complete.md, so the parser can be
     written without the file — only end-to-end testing needs it.
  2. OPEN QUESTION, still unanswered: does the after-sale `contractors` collection ALREADY hold
     documents in production, and in what shape? Dev runs against the emulator so building now is
     safe, but confirm with the owner before any production cutover — the model below may collide
     with an existing shape.
  3. BRANCH: this work was planned while on branch `inspection`. Team convention is to work on
     `main` (the deploy branch). Confirm the branch with the owner before starting. Never push
     without asking — every push to `main` is a production deploy.
  4. DATE: the `date:` line above is the planning date, not today. The harness phase-gate requires
     this file and gather_complete.md to both be dated today before it will allow an edit under
     `src/`. Refresh both `date:` lines when work actually begins.

LINE NUMBERS below (L894, L3519, L4166, ...) are a SNAPSHOT taken during planning. They shift as soon
as any edit lands in that file. Re-grep every anchor immediately before editing it — never trust the
number as written. This matters most in S9: `frontend/src/pages/daily-reports/index.tsx` is 5,685 lines
and takes six separate edits.

HARNESS VOCABULARY: `Model:`, `Input_From:`, `Token:` and `Avoid:` are directives for the automated
agent loop — a human working this plan by hand can ignore those four fields. The fields that carry the
actual engineering are `File:` (what to touch), `Data_Sent:` (what to change), `Constraints:`,
`Rollback:` (how to undo) and every `Verify-N:` line. The Verify lines are runnable shell commands and
are the definition of "this section is done" — a section is not finished until its Verify commands
return the stated result.

---

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: compact_state.md checked · CFP_COUNT stored
- [X] B2-B3: skill=coder identified · SKILL.md loaded · hashes checked
- [X] C0-C3: routing confirmed · no unresolved topic switch
→ TOKEN CHECK: SESSION_TOTAL ~41k

---

## Phase 1 — Info Gather
- [X] G0: task clarity gate — 7 clarification rounds with user, all answered
- [X] G1: ALL sections scanned in 1 pass
- [X] G2: batch greps in ONE Bash call · targeted Reads (offset+limit) · [post-read] verdicts emitted
- [X] G3: every section → file/symbol + Verify-N draft · [✓ gather] emitted
- [X] gather_complete.md written today (objective · constraints · affected_files · acceptance_criteria)

### Files Read — Phase 1
| File | Why | Lines read |
|---|---|---|
| backend/src/config/firebaseProjectB.ts | confirm afterSaleDb handle + env behaviour | grep + offset=60 limit=40 |
| backend/src/config/collections.ts | confirm SKILLS unused | grep |
| frontend/src/components/forms/SkillSelect.tsx | derived-options pattern to mirror | full (85L) |
| frontend/src/pages/management/index.tsx | card-grid shape | offset=25 limit=110 |
| frontend/src/pages/daily-reports/index.tsx | edit anchors in a 5,685L file | grep -n only |
| frontend/src/services/dailyReportService.ts | prove report path is after-sale | grep |
| C:\Users\101622\Downloads\Book2.xlsx | decode import template | openpyxl dump → scratchpad |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`

---

## Phase 2 — Plan
- [X] M1.5: reasoning pass
       dependency_map: [Subcontractor.ts → SubcontractorService.ts, Subcontractor.ts → subcontractorExcel.ts,
                        SubcontractorService.ts → subcontractors.routes.ts, subcontractors.routes.ts → subcontractorService.ts (FE),
                        subcontractorService.ts → SubSkillSelect.tsx → subcontractor-management page,
                        Subcontractor.ts → tasks.routes.ts + daily-reports payload]
       risk_flags: [daily-reports/index.tsx is 5,685L — surgical only, no refactor · writes land in the AFTER-SALE
                    Firestore not LMS · Excel import is idempotent-by-`รหัส` or it duplicates the whole roster ·
                    parked IN/OUT files must stay untouched · prior mece_plan.md (T-078 PARKED) archived to
                    .sessions/mece_plan_T078_PARKED.md before overwrite]
- [X] M2: plan 1:1 with sections · Context/Skill/Model/Tool/Avoid/Input_From/Verify-N per section
- [X] M3: plan + Verify-N sent to user → user confirmed
- [ ] M4: roadmap T-081 §6.2 block added
- [X] M5: mece_plan.md written using this template (Phase 0-3 blocks mandatory)

### Files Read — Phase 2
| File | Why | Lines read |
|---|---|---|
| docs/session_templates/mece_plan_schema.md | mandatory template | offset=37 limit=130 + grep headings |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`
→ **[mece-complete] + /compact before Phase 3 (BC-mece-compact)**

---

## Data model (agreed — the single source every section below builds against)

After-sale Firestore (`afterSaleDb`), collection `contractors`:

```
contractors/{companyId}
  name              string   // "สังกัดผู้รับเหมา" — trimmed
  nameKey           string   // name.trim().toLowerCase() — import dedupe key
  isActive          boolean
  createdAt/updatedAt/createdBy

contractors/{companyId}/workers/{workerId}
  code              string   // Excel col D "รหัส" — import upsert key (unique per company)
  fullName          string   // col E
  position          string   // col F — free text
  projectId         string | null   // resolved from col B against the LMS Project collection
  projectName       string   // raw col B, kept for audit / unresolved rows
  skills            string[] // free-typed topics this worker can do (manual add path)
  assessment {
    scores          { [topic: string]: 0 | 1 | 2 }   // open map — 16 today, more later
    assessedAt      Timestamp | null   // col G (Excel serial → date)
    assessorName    string | null      // col H
    assessorUserId  string | null      // reserved — future task
  }
  isActive          boolean
  createdAt/updatedAt
```

Rules baked into every section:
- Only col1 of each 3-column skill group is stored. `...ระดับ1` / `...ระดับ2` are derived → never written.
- Excel summary columns BE..BK are stale → never read.
- `location` lives on the WORKER, not the company (one company serves several projects).
- No company-level skill aggregate.
- Skill-topic options are DERIVED client-side from stored data (union of `skills[]` + keys of `assessment.scores`) — exactly the `SkillSelect` pattern. No settings page, no `skills` collection.

Daily-report subcontractor entry shape (shared FE↔BE):
```
{ companyId, companyName, headcount: number, isRegular, otMorning, otNoon, otEvening: boolean }
```

---

## Phase 3 — Execute

### Cycle grouping
Cycle 1 — serial   · agents: 1                                  → S1
Cycle 2 — parallel · agents: 2 · cap: 2                         → S2, S3
  Barrier: all cycle_2_*.json status:done → Cycle 3
Cycle 3 — serial   · agents: 1 · Input_From: cycle_2_*          → S4
Cycle 4 — parallel · agents: 2 · cap: 2                         → S5, S8
  Barrier: all cycle_4_*.json status:done → Cycle 5
Cycle 5 — serial   · agents: 1                                  → S6
[/compact checkpoint]
Cycle 6 — serial   · agents: 1                                  → S7
Cycle 7 — parallel · agents: 2 · cap: 2                         → S9 (MAIN), S10
  Barrier: all cycle_7_*.json status:done → Cycle 8
Cycle 8 — serial   · agents: 1                                  → S11

### Per-Section Invariants  (apply to EVERY S<N> below — written ONCE)
Constraints — every section carries these PLUS its own line:
  - mece_plan.md dated today + T-081 roadmap [/] REQUIRED before any file edit
  - [pre-edit] emit before every Edit · [✓ written] grep verify after every change
  - Output Contracts: [post-read] ≤1 line · [✓ written] ≤1 line
  - L4.5 PURGE: drop Bash/grep after verdict · keep Read excerpts ≤10L
  - NEVER touch the parked IN/OUT files: backend/src/services/reconciliation/segmentEngine.ts,
    its characterization test, frontend/src/components/work-hour-monitoring/WorkHourComparisonTable.tsx, functions/lib/*
  - English only in code comments; Thai only in user-facing UI strings
  - No commit and no push — the user names the branch and pushes
Marking rule — flip a section box to [X] ONLY when [✓ written] + Verify-N both exist this turn
TOKEN CHECK — after EVERY section: `cat .sessions/session_tokens.md`

---

### S1 · T-081 · Backend model + shared types            [Cycle 1 · serial]
Context: Define the Subcontractor company/worker/assessment TypeScript types and the daily-report subcontractor entry shape, so every later section (service, Excel parser, routes, frontend) builds against one contract.
Skill: coder
Model: model_medium
Input_From: none
File: backend/src/models/Subcontractor.ts (new)
Tool: Write
Avoid: Agent
Rollback: rm backend/src/models/Subcontractor.ts
Data_Sent: interfaces `SubcontractorCompany`, `SubcontractorWorker`, `WorkerAssessment`, `SubcontractorReportEntry`; `SkillScore` union `0|1|2`; open `Record<string, SkillScore>` for scores
Token: ~700 output
Constraints: → §Per-Section Invariants · PLUS: scores MUST be an open map, never 16 named fields
Verify-1: `grep -cE "Record<string, *SkillScore>|SubcontractorReportEntry" backend/src/models/Subcontractor.ts` → ≥2
Verify-2: `cd backend && npx tsc --noEmit 2>&1 | grep -c "Subcontractor.ts"` → 0
- [ ] S1

### S2 · T-081 · Subcontractor service (after-sale writes)            [Cycle 2 · parallel]
Context: CRUD for companies and their workers, written through `afterSaleDb` to the `contractors` collection and its `workers` subcollection, plus an idempotent `upsertWorkerByCode` used by the Excel import.
Skill: coder
Model: model_medium
Input_From: cycle_1_S1.json
File: backend/src/services/subcontractor/SubcontractorService.ts (new)
Tool: Write
Avoid: Agent
Rollback: rm -r backend/src/services/subcontractor
Data_Sent: `listCompanies` (with nested workers), `createCompany`, `updateCompany`, `deactivateCompany`, `listWorkers`, `createWorker`, `updateWorker`, `deactivateWorker`, `upsertCompanyByName(nameKey)`, `upsertWorkerByCode(companyId, code, data)`
Token: ~1400 output
Constraints: → §Per-Section Invariants · PLUS: import `afterSaleDb` from `../../config/firebaseProjectB` EXPLICITLY — never the LMS `db`; soft-delete via `isActive=false`, never `.delete()`
Verify-1: `grep -c "afterSaleDb" backend/src/services/subcontractor/SubcontractorService.ts` → ≥1
Verify-2: `grep -c "config/firebase'" backend/src/services/subcontractor/SubcontractorService.ts` → 0
Verify-3: `grep -c "\.delete()" backend/src/services/subcontractor/SubcontractorService.ts` → 0
- [ ] S2

### S3 · T-081 · Excel import parser            [Cycle 2 · parallel]
Context: Parse the Book2.xlsx assessment template into company + worker + score records — header row 3, data from row 4, keeping only col1 of each 3-column skill group and converting the Excel serial assessment date.
Skill: coder
Model: model_medium
Input_From: cycle_1_S1.json
File: backend/src/utils/subcontractorExcel.ts (new)
Tool: Write
Avoid: Agent
Rollback: rm backend/src/utils/subcontractorExcel.ts
Data_Sent: `parseSubcontractorWorkbook(buffer)` → `{ rows: ParsedWorkerRow[], warnings: string[] }`; skill-topic detection = header row 3 from col I onward, take every 3rd column; `excelSerialToDate(n)` = epoch 1899-12-30 + n days; skip rows with no code AND no name
Token: ~1200 output
Constraints: → §Per-Section Invariants · PLUS: never read columns BE..BK (stale summaries); never store `...ระดับ1`/`...ระดับ2`; unparsable score → omit the key, do not default to 0
Verify-1: `grep -c "ระดับ" backend/src/utils/subcontractorExcel.ts` → 0
Verify-2: `grep -cE "1899-12-30|25569" backend/src/utils/subcontractorExcel.ts` → ≥1
Verify-3: `cd backend && npx tsc --noEmit 2>&1 | grep -c "subcontractorExcel"` → 0
- [ ] S3

### S4 · T-081 · Subcontractor API routes            [Cycle 3 · serial]
Context: Expose the service over REST and register it in the router index, including the multipart import endpoint that resolves each row's project name to a real LMS Project id.
Skill: coder
Model: model_medium
Input_From: cycle_2_S2.json, cycle_2_S3.json
File: backend/src/api/routes/subcontractors.routes.ts (new) + backend/src/api/routes/index.ts
Tool: Write + Edit
Avoid: Agent
Rollback: rm backend/src/api/routes/subcontractors.routes.ts && git checkout backend/src/api/routes/index.ts
Data_Sent: GET `/subcontractors` · POST `/subcontractors` · PUT/DELETE `/subcontractors/:id` · GET/POST `/subcontractors/:id/workers` · PUT/DELETE `/subcontractors/:id/workers/:workerId` · POST `/subcontractors/import` (multipart) returning `{ companiesCreated, workersCreated, workersUpdated, unresolvedProjects[] }`; router registration line mirroring the existing entries in index.ts
Token: ~1500 output
Pre-step (skeptical review finding · MUST run before writing): grep the real Project collection + its display-name field — `grep -rn "PROJECTS" backend/src/config/collections.ts` and `grep -rn "projectName\|name" backend/src/models/*roject*` — there is NO `backend/src/models/Project.ts`, so the field name must be discovered, never assumed.
Constraints: → §Per-Section Invariants · PLUS: reuse the multer memoryStorage pattern already used at `backend/src/api/routes/dailyContractors.routes.ts:23` (multer IS already a dependency — do not add a new one); reuse the existing auth middleware used by neighbouring routes; project resolution is name-match against the real LMS Project collection — an unresolved name still imports the worker with `projectId: null` and is reported in `unresolvedProjects`
Verify-1: `grep -c "subcontractors" backend/src/api/routes/index.ts` → ≥1
Verify-2: `grep -cE "router\.(get|post|put|delete)" backend/src/api/routes/subcontractors.routes.ts` → ≥8
Verify-3: `cd backend && npx tsc --noEmit 2>&1 | grep -ci "error TS"` → 0
- [ ] S4

### S5 · T-081 · Frontend service client            [Cycle 4 · parallel]
Context: Typed API client for the subcontractor endpoints plus the mirrored frontend types, so the page, the skill picker and the daily-report modal all consume one module.
Skill: coder
Model: model_medium
Input_From: cycle_3_S4.json
File: frontend/src/services/subcontractorService.ts (new)
Tool: Write
Avoid: Agent
Rollback: rm frontend/src/services/subcontractorService.ts
Data_Sent: `getSubcontractors()`, `createSubcontractor`, `updateSubcontractor`, `deleteSubcontractor`, `createWorker`, `updateWorker`, `deleteWorker`, `importSubcontractorsExcel(file)`; types mirroring backend/src/models/Subcontractor.ts
Token: ~900 output
Constraints: → §Per-Section Invariants · PLUS: use the same axios/api instance the neighbouring services use — do not create a new client
Verify-1: `grep -cE "export const (getSubcontractors|importSubcontractorsExcel)" frontend/src/services/subcontractorService.ts` → 2
Verify-2: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "subcontractorService"` → 0
- [ ] S5

### S8 · T-081 · /management card            [Cycle 4 · parallel]
Context: Add the "จัดการผู้รับเหมา" card to the management grid so the new page is reachable — one entry appended to the existing sections array.
Skill: coder
Model: model_low
Input_From: none
File: frontend/src/pages/management/index.tsx
Tool: Edit
Avoid: Agent, Write
Rollback: git checkout frontend/src/pages/management/index.tsx
Data_Sent: one array entry `{ title: 'จัดการผู้รับเหมา', description: ..., icon: ..., href: '/subcontractor-management', color: ... }` matching the shape of the existing `/dc-management` entry at line 51
Token: ~200 output
Constraints: → §Per-Section Invariants · PLUS: append only — do not reorder or restyle existing cards
Verify-1: `grep -c "subcontractor-management" frontend/src/pages/management/index.tsx` → 1
Verify-2: `grep -c "href:" frontend/src/pages/management/index.tsx` → 5
- [ ] S8

### S6 · T-081 · SubSkillSelect component            [Cycle 5 · serial]
Context: A multi-value free-typed skill picker for subcontractor workers, with options derived from skills already stored — the same derived-options pattern as the DC `SkillSelect`, which stays untouched.
Skill: coder
Model: model_low
Input_From: cycle_4_S5.json
File: frontend/src/components/forms/SubSkillSelect.tsx (new)
Tool: Write
Avoid: Agent
Rollback: rm frontend/src/components/forms/SubSkillSelect.tsx
Data_Sent: SkillSelect.tsx structure with `multiple` + `freeSolo`, `value: string[]`, `onChange: (string[]) => void`, `useQuery(['subcontractors'], getSubcontractors)`, options = sorted unique union of every worker's `skills[]` and `Object.keys(assessment.scores)`
Token: ~600 output
Constraints: → §Per-Section Invariants · PLUS: MUST NOT import `getActiveDCs` and MUST NOT edit SkillSelect.tsx
Verify-1: `grep -c "getActiveDCs" frontend/src/components/forms/SubSkillSelect.tsx` → 0
Verify-2: `git diff --name-only frontend/src/components/forms/SkillSelect.tsx | wc -l` → 0
Verify-3: `grep -c "multiple" frontend/src/components/forms/SubSkillSelect.tsx` → ≥1
- [ ] S6

### /compact checkpoint
Sequential notation: `[S1] → [S2,S3] → [S4] → [S5,S8] → [S6] → [/compact] → [S7] → [S9,S10] → [S11]`

- [ ] /compact checkpoint
  Pre: `python3 scripts/compute_compact_size.py` → compact_size
  Pre: write compact_state.md (section=S7 · step="backend + service layer done, page UI next" · skill=coder · compact_size=<value>)
  How: user runs `/compact` in terminal
  Post: SESSION_TOTAL=0 · LOOP_WEIGHT=0
  Verify: `cat .sessions/session_tokens.md` → SESSION_TOTAL: 0 · LOOP_WEIGHT: 0
  Resume: **"Resume T-081 · Skill: coder · ต่อจาก S7"**

### S7 · T-081 · /subcontractor-management page            [Cycle 6 · serial]
Context: The management screen itself — company list, per-company worker table, manual add/edit dialogs, and an Excel import dialog that reports created/updated/unresolved counts.
Skill: coder
Model: model_high
Input_From: cycle_5_S6.json
File: frontend/src/pages/subcontractor-management/index.tsx (new) + frontend/src/page-components/subcontractor-management/components/*.tsx (new)
Tool: Write
Avoid: Agent
Rollback: rm -r frontend/src/pages/subcontractor-management frontend/src/page-components/subcontractor-management
Data_Sent: page shell mirroring the /dc-management layout; `CompanyList`, `WorkerTable`, `WorkerFormDialog` (fullName, code, position, project select, SubSkillSelect), `ImportDialog` (file picker → importSubcontractorsExcel → result summary)
Token: ~3000 output
Constraints: → §Per-Section Invariants · PLUS: no scoring/assessment UI (explicitly deferred) — the form edits `skills[]` only, never `assessment.scores`; reuse the existing Project select component rather than a raw text field
Verify-1: `test -f frontend/src/pages/subcontractor-management/index.tsx && echo ok` → ok
Verify-2: `grep -rl "assessment\.scores *=" frontend/src/page-components/subcontractor-management/ | wc -l` → 0
Verify-3: `cd frontend && npx tsc --noEmit 2>&1 | grep -ci "subcontractor-management"` → 0
- [ ] S7

### S9 · T-081 · Daily-report label + two-tab labor modal            [Cycle 7 · parallel · MAIN]
Context: On the daily-report page, rename the labor button to "เลือกแรงงาน DC/ผู้รับเหมา", split the labor dialog into DC and ผู้รับเหมา tabs, hold selected companies with headcount + Day/OT flags in state, include them in validation, and add them to the submitted payload.
Skill: coder
Model: model_high   (MAIN — 5,685-line core page, surgical edits only, never delegated)
Input_From: cycle_4_S5.json
File: frontend/src/pages/daily-reports/index.tsx
Tool: Edit
Avoid: Agent, Write
Rollback: git checkout frontend/src/pages/daily-reports/index.tsx
Data_Sent: (a) new state `selectedSubcontractors: SubcontractorReportEntry[]` beside `selectedWorkers` (~L894); (b) `laborTab` state + `<Tabs>` inside the Dialog at ~L4166; (c) label edit at L3519 "เลือกแรงงาน DC" → "เลือกแรงงาน DC/ผู้รับเหมา"; (d) validation at L2432 extended with `&& selectedSubcontractors.length === 0`; (e) time flags at L1176-1181 OR-ed with the subcontractor entries' flags; (f) `laborPayload` at L2549 gains `subcontractors: selectedSubcontractors`; (g) **HYDRATION (skeptical review finding — was missing)**: an existing report already restores DC workers at L996 / L1035 / L1050 and clears at L1655 · every one of those four `setSelectedWorkers(...)` sites needs a matching `setSelectedSubcontractors(...)` or reopening a saved report silently loses the subcontractor rows
Token: ~2200 output
Constraints: → §Per-Section Invariants · PLUS: surgical Edits ONLY — no refactor, no reformat, no moving existing blocks; every anchor re-grepped before editing because line numbers shift after each edit; the DC tab must render the CURRENT worker UI unchanged; `selectedWorkers` has 20 usages in this file — grep ALL of them and decide per site whether the subcontractor list belongs there, do not patch only the six anchors above
Verify-1: `grep -c "เลือกแรงงาน DC/ผู้รับเหมา" frontend/src/pages/daily-reports/index.tsx` → 1
Verify-2: `grep -c "selectedSubcontractors" frontend/src/pages/daily-reports/index.tsx` → ≥9
Verify-2b: `grep -c "setSelectedSubcontractors" frontend/src/pages/daily-reports/index.tsx` → ≥4  (hydration + reset sites covered)
Verify-3: `git diff -U0 frontend/src/pages/daily-reports/index.tsx | grep -c "^-[^-]"` → ≤30
Verify-4: `cd frontend && npx tsc --noEmit 2>&1 | grep -ci "daily-reports/index"` → 0
- [ ] S9

### S10 · T-081 · Persist subcontractor entries on the task report            [Cycle 7 · parallel]
Context: Accept and store the `subcontractors` array on the after-sale task daily-report document so the submitted headcounts and times survive a reload.
Skill: coder
Model: model_medium
Input_From: cycle_1_S1.json
File: backend/src/api/routes/tasks.routes.ts
Tool: Edit
Avoid: Agent, Write
Rollback: git checkout backend/src/api/routes/tasks.routes.ts
Data_Sent: in the `POST /tasks/:taskId/reports` handler — read `subcontractors` from the body, validate each entry (`companyId` non-empty, `headcount` integer ≥1, boolean time flags), default to `[]`, and include it in the written report document
Token: ~600 output
Constraints: → §Per-Section Invariants · PLUS: additive only — do not change the existing DC labor fields or the report document path
Verify-1: `grep -c "subcontractors" backend/src/api/routes/tasks.routes.ts` → ≥2
Verify-2: `git diff -U0 backend/src/api/routes/tasks.routes.ts | grep -c "^-[^-]"` → ≤3
Verify-3: `cd backend && npx tsc --noEmit 2>&1 | grep -ci "error TS"` → 0
- [ ] S10

### S11 · T-081 · Full typecheck + scope audit            [Cycle 8 · serial]
Context: Prove the whole change compiles on both sides and that no file outside the declared scope was touched — especially the parked IN/OUT reconciliation work.
Skill: coder
Model: model_low
Input_From: cycle_7_S9.json, cycle_7_S10.json
File: (verification only — no edits)
Tool: Bash
Avoid: Edit, Write, Agent
Rollback: n/a
Data_Sent: `cd backend && npx tsc --noEmit`; `cd frontend && npx tsc --noEmit`; `git status --porcelain`
Token: ~300 output
Constraints: → §Per-Section Invariants · PLUS: report only — fix-ups go back to the owning section, never patched here
Verify-1: `cd backend && npx tsc --noEmit 2>&1 | grep -ci "error TS"` → 0
Verify-2: `cd frontend && npx tsc --noEmit 2>&1 | grep -ci "error TS"` → 0
Verify-3: `git status --porcelain | grep -cE "segmentEngine|WorkHourComparisonTable|functions/lib"` → 6  (same count as the pre-task baseline — parked IN/OUT work neither edited nor reverted)
Verify-4: `git status --porcelain | grep -vE "^\?\?" | grep -cE "subcontractor|management/index|daily-reports/index|tasks.routes|routes/index|segmentEngine|WorkHourComparison|functions/lib|\.sessions|knowledge/|docs/"` → 0  (no tracked file outside the declared scope was modified)
- [ ] S11

---

## Phase 3 — Close Checklist
- [ ] R8 index sync: new files → index_files.json · symbol_indexer · session_indexer
- [ ] [scope-creep] check: changed files ⊆ the File: declarations above
- [ ] Roadmap [X]: T-081 annotated (attempts + tool_calls)
- [ ] Spawn Reviewer (model_low · read-only) over the diff
- [ ] [mece-audit] emitted
- [ ] Ask user: "มีอะไรอยากแก้ไขหรือปรับเพิ่มไหมครับ?" (1 message)
- [ ] Reflection appended → .sessions/reflections.md
- [ ] [session-health] emitted
- [ ] session_handoff.md written
- [ ] PATH A: close-gate check → clear mece_plan.md Phase 1-3
- [ ] NO commit / NO push without the user naming the branch (git push is user-only)

## Close Path
PATH A — task complete → close-gate → clear Phase 1-3, keep Phase 0
PATH B — compact checkpoint mid-task → compact_state.md, session_reset=armed
PATH C — topic switch → session_manager §3
