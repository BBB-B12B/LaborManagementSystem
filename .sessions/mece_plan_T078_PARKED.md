# MECE Plan — T-078 Task creation: floor + subWorkspace + optional inspection link
date: 2026-08-19
task: T-078 · Task creation gains ชั้น/floor (required) + subworkspace (optional) + a toggle linking the task to ONE inspection sub-category · OPTION A · WH-department projects exempt
skill: coder

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: SESSION_TOTAL reset by SessionStart:compact hook · CFP_COUNT=51 stored
- [X] B2-B3: skill=coder (product code) · coder SKILL.md read this session · mece schema read at M3
- [X] C0-C3: T-076 closed (phase: done · plan PATH-A cleared) → T-078 = NEW TASK · Phase 1+2 forced
→ TOKEN CHECK: SESSION_TOTAL ~10k at plan time

---

## Phase 1 — Info Gather
- [X] G0: clarity gate — 5 original design answers + 4 follow-ups all confirmed by the user
- [X] G1: all sections scanned in 1 pass
- [X] G2: batch greps in single Bash calls · targeted Reads with offset+limit · [post-read] verdicts emitted
- [X] G3: every section mapped to file/symbol + Verify-N drafted · [✓ gather] emitted
- [X] gather_complete.md written today (brief · verified field chain · exemption source · risks)

### Files Read — Phase 1
| File | Why | Lines read |
|---|---|---|
| backend/src/models/Task.ts | Task/CreateTaskInput shape + taskConverter whitelists | offset=1 limit=145 · offset=175 limit=75 |
| backend/src/services/TaskService.ts | where newTaskData is assembled | offset=205 limit=45 |
| backend/src/api/routes/tasks.routes.ts | POST '/' destructure + validatedData | offset=2597 limit=60 |
| frontend/.../TaskCreateModal.tsx | submit path + payload + field render region | offset=519 limit=140 · offset=1060 limit=130 |
| frontend/src/services/taskService.ts | its own CreateTaskInput mirror | grep + sed 60-100 |
| backend/src/models/ProjectLocation.ts | proves project.department exists + round-trips | grep |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`

---

## Phase 2 — Plan
- [X] M1.5: reasoning pass — dependency_map: [models/Task.ts → TaskService.ts → tasks.routes.ts,
       services/taskService.ts → TaskCreateModal.tsx → TaskCard.tsx]
       risk_flags: [taskConverter is a double whitelist — a missed entry loses data silently with no
       error, both on write and on read-back · the workspace page FLATTENS tasks/subtasks into card
       objects and has already lost a field this way once (support fields) · tasks.routes.ts is ~3100
       lines and its `/:id` route swallows any literal path declared after it]
- [X] M2: sections 1:1 with the field chain · Context/Skill/Model/Tool/Avoid/Input_From/Verify-N per section
- [ ] M3: plan + Verify-N sent to user → user confirmed
- [ ] M4: skeptical_reviewer run on this plan → .skeptical_ok written
- [X] M5: mece_plan.md written from the template (Phase 0-3 blocks)

### Files Read — Phase 2
| File | Why | Lines read |
|---|---|---|
| docs/session_templates/mece_plan_schema.md | template structure (never from memory · CFP-019) | offset=50 limit=145 |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`

---

## Design decisions locked before Phase 3 (do not re-litigate mid-execution)

**New fields on a task** (all optional in the TYPE so legacy tasks stay valid; required-ness is enforced
by the create form only):
| Field | Meaning |
|---|---|
| `floor?: string` | ชั้น — required by the create form, except WH-department projects |
| `subWorkspace?: string` | e.g. "G/L A-1" — always optional |
| `requiresInspection?: boolean` | explicit flag, not inferred from an empty id (T-039 lesson: an empty value must not be ambiguous) |
| `inspectionSubCategoryId?: string` | exactly ONE sub-category |
| `inspectionSubCategoryName?: string` | denormalised name, matching how this codebase already stores workOrderName/categoryName beside their ids — the card can render without a config lookup |

**Floor list storage**: new Firestore collection `taskWorkspaceConfigs`, one doc per project:
`{ projectId, floors: string[], subWorkspaces: string[], updatedAt, updatedBy }`.
The BACKEND appends a newly typed value on task create — the client never writes the list. Consequences:
the list cannot drift from real usage, and there is no extra write endpoint to secure.
Rejected: deriving DISTINCT floors from tasks (Firestore has no DISTINCT → a per-open full scan of the
project's tasks) · storing the arrays on the ProjectLocation doc (free to read, but the project edit form
could overwrite the doc and wipe them — not the same outcome, so not a valid simplification).

**Exemption**: `project.department === 'WH'` (user decision 2026-08-19, supersedes name matching).
ONE new helper is added and used by the new code. The pre-existing name-based `isHelperUser` logic is
NOT refactored (out of scope).

**Out of scope**: the inspection screen/flow itself · the actual inspection records · refactoring
tasks.routes.ts into a smaller file (noted at T-076 close) · retro-filling floor on old tasks ·
project scoping of config endpoints (T-077).

---

## Phase 3 — Execute

### Cycle grouping
Cycle 1 — all sequential · agents: 0 (no sub-agent spawning — standing session instruction: do NOT call
the Agent tool unless the user asks). Every section runs INLINE in MAIN context.
Sequential notation: `[S1] → [S2] → [S3] → [S4] → [/compact] → [S5] → [S6] → [S7]`

### Per-Section Invariants  (apply to EVERY S<N> — written ONCE)
Constraints — every section carries these PLUS its own line:
  - mece_plan.md dated today + T-078 roadmap present REQUIRED before any file edit
  - [pre-edit] emit before every Edit · [✓ written] grep verify after every change
  - Output Contracts: [post-read] ≤1 line · [✓ written] ≤1 line
  - L4.5 PURGE: drop Bash/grep after verdict · keep Read excerpts ≤10L
  - Additive only: never change or reorder an existing field · no behaviour change for a task that
    carries none of the new fields (every legacy task must render and save exactly as today)
Marking rule — flip a section box to [X] ONLY when [✓ written] + Verify-N both pass this turn
TOKEN CHECK — after EVERY section: `cat .sessions/session_tokens.md`

### S1 · T-078 · Backend data layer: Task model + Firestore converter      [Cycle 1 · serial · MAIN context]
Context: Add the 5 new fields to the task's type definitions AND to both directions of the Firestore converter, so the values can be saved and read back. This is the silent-loss point — a field missing from toFirestore is never stored; missing from fromFirestore it is stored but never returned.
Skill: coder
Model: model_medium + MAIN context (core data model · no Agent spawning this session)
Input_From: none
File: backend/src/models/Task.ts
Tool: Edit
Avoid: Write (never overwrite this file) · Bash sed
Rollback: git checkout backend/src/models/Task.ts
Data_Sent: add `floor?`, `subWorkspace?`, `requiresInspection?`, `inspectionSubCategoryId?`, `inspectionSubCategoryName?` to (a) `interface Task` after `taskType`, (b) `CreateTaskInput`, (c) `UpdateTaskInput`, (d) `taskConverter.toFirestore` with `|| null` defaults, (e) `taskConverter.fromFirestore` with safe defaults
Token: ~400 output
Constraints: → §Per-Section Invariants · PLUS: all 5 fields OPTIONAL in every type (legacy tasks have none)
Verify-1: `grep -c "floor" backend/src/models/Task.ts` → >=5 (interface + 2 inputs + both converter directions)
Verify-2: `grep -c "inspectionSubCategoryId" backend/src/models/Task.ts` → >=5
- [ ] S1

### S2 · T-078 · Backend write path: carry the fields + grow the floor list   [Cycle 1 · serial · MAIN context]
Context: TaskService.createTask assembles newTaskData field by field, so the new values must be added there or they never reach Firestore. Also append a newly typed floor/subWorkspace into the project's list doc here, so the autocomplete list is always built from what was really used.
Skill: coder
Model: model_medium + MAIN context (server write path · no Agent spawning this session)
Input_From: S1 (the field names + types)
File: backend/src/services/TaskService.ts
Tool: Edit
Avoid: Write · Bash sed
Rollback: git checkout backend/src/services/TaskService.ts
Data_Sent: (a) **widen the task-identity query at L101-106** — today it is `where('taskName','==',input.taskName).limit(1)`, so a task is considered "the same task" by NAME ALONE. Under Option A that is a silent data bug: creating "งานเสา" on floor 13 while "งานเสา" floor 12 exists matches the old doc and merges the new subtasks INTO the floor-12 task. Fix: drop `.limit(1)`, fetch the by-name candidates, then match in CODE on (taskName + floor + subWorkspace), treating undefined/null/'' as the same empty value. Do NOT add extra `.where()` equality filters for floor: legacy docs have no `floor` field at all, so a `where('floor','==',null)` would never match them and every append to a legacy task would create a duplicate instead. In-code matching handles legacy and needs no new Firestore index. · (b) in `newTaskData` (L218 block) add the 5 fields from `input`, preserving existing values on the not-new-task branch the same way `taskType` does at L213-216 · (c) after the task write succeeds, call the S3 helper to append floor/subWorkspace to the project's list
Token: ~900 output
Constraints: → §Per-Section Invariants · PLUS: appending to the list doc must NEVER fail the task creation — wrap it so a list error is logged, not thrown · the identity change is the single riskiest edit in this plan (it sits inside a Firestore transaction and decides new-vs-existing) — a task carrying NO floor must still match an existing no-floor task exactly as it does today, so legacy behaviour is bit-for-bit unchanged
Verify-1: `grep -n "floor" backend/src/services/TaskService.ts` → present in BOTH the identity match and the newTaskData block
Verify-2: `grep -c "appendWorkspaceValues" backend/src/services/TaskService.ts` → >=1
Verify-3: `grep -n "limit(1)" backend/src/services/TaskService.ts | grep -c "taskName"` → 0 (the name-only single-match query is gone)
- [ ] S2

### S3 · T-078 · New backend service: per-project floor / subWorkspace list  [Cycle 1 · serial · MAIN context]
Context: A new small service owning one Firestore doc per project that holds the floors and subWorkspaces already used, so the create form can offer them instead of relying on people spelling a floor the same way twice. Same one-doc-per-project shape as T-076's inspectionTopicConfig.
Skill: coder
Model: model_medium + MAIN context (new file · no Agent spawning this session)
Input_From: none
File: backend/src/services/task/taskWorkspaceConfig.ts (NEW)
Tool: Write
Avoid: Edit (file does not exist yet)
Rollback: rm backend/src/services/task/taskWorkspaceConfig.ts
Data_Sent: `COLLECTION = 'taskWorkspaceConfigs'` · `TaskWorkspaceConfig { projectId; floors: string[]; subWorkspaces: string[]; updatedAt?; updatedBy? }` · `getTaskWorkspaceConfig(projectId)` returning a blank default when absent · `appendWorkspaceValues(projectId, { floor?, subWorkspace? }, userId)` that trims, ignores blanks, de-dupes case-insensitively and writes the FULL arrays back (merge:true replaces an array wholesale — that is why the full array is written)
Token: ~700 output
Constraints: → §Per-Section Invariants · PLUS: firebase-admin bypasses security rules, so no firestore.rules change is needed for the new collection
Verify-1: `ls backend/src/services/task/taskWorkspaceConfig.ts` → exists
Verify-2: `grep -c "^export" backend/src/services/task/taskWorkspaceConfig.ts` → >=3
- [ ] S3

### S4 · T-078 · Backend routes: pass the fields through + serve the list     [Cycle 1 · serial · MAIN context]
Context: POST '/' destructures req.body and rebuilds validatedData, so a field absent from BOTH lines is silently dropped; PATCH '/:id' is the edit path that must accept the inspect link later. Also expose GET for the floor list. No PUT — the backend grows the list itself in S2.
Skill: coder
Model: model_medium + MAIN context (routing file · ordering trap · no Agent spawning this session)
Input_From: S1 (field names) · S3 (getTaskWorkspaceConfig)
File: backend/src/api/routes/tasks.routes.ts
Tool: Edit
Avoid: Write · Bash sed
Rollback: git checkout backend/src/api/routes/tasks.routes.ts
Data_Sent: (a) add the 5 fields to the L2599 destructure and the L2625 validatedData · (b) allow the same fields through PATCH '/:id' (L2681) · (c) add `GET /workspace-config` returning getTaskWorkspaceConfig(projectId), declared BEFORE `router.get('/:id')` or the catch-all swallows it
Token: ~600 output
Constraints: → §Per-Section Invariants · PLUS: the new GET must sit above the `/:id` route (same trap fixed in T-076) · do not tighten or loosen any existing checkRole
Verify-1: `grep -n "workspace-config" backend/src/api/routes/tasks.routes.ts` → line number LOWER than the `router.get('/:id'` line
Verify-2: `grep -n "floor" backend/src/api/routes/tasks.routes.ts` → present in both the destructure and validatedData
- [ ] S4

- [ ] /compact checkpoint
  Pre: `python3 scripts/compute_compact_size.py` → compact_size
  Pre: write compact_state.md (section=S5 · step="backend done, frontend next" · skill=coder)
  How: user runs `/compact`
  Post: SESSION_TOTAL=0 · LOOP_WEIGHT=0
  Resume: "Resume T-078 · Skill: coder · ต่อจาก S5"

### S5 · T-078 · Frontend service layer: mirror types + fetch the list        [Cycle 1 · serial · MAIN context]
Context: The frontend keeps its OWN copy of the task types, so the form cannot send a field the service type does not know about. Add the 5 fields plus a call to fetch a project's floor/subWorkspace list.
Skill: coder
Model: model_medium + MAIN context (typed service layer · no Agent spawning this session)
Input_From: S1 (field names) · S4 (endpoint path)
File: frontend/src/services/taskService.ts
Tool: Edit
Avoid: Write · Bash sed
Rollback: git checkout frontend/src/services/taskService.ts
Data_Sent: add the 5 fields to the local `Task` type, `CreateTaskInput` (L71) and `UpdateTaskInput`; add `getTaskWorkspaceConfig(projectId)` hitting GET /tasks/workspace-config plus its `TaskWorkspaceConfig` type
Token: ~450 output
Constraints: → §Per-Section Invariants · PLUS: keep the frontend types shaped exactly like the backend ones (a silent divergence here is what caused the T-076 fields-placement bug)
Verify-1: `grep -c "floor" frontend/src/services/taskService.ts` → >=3
Verify-2: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0
- [ ] S5

### S6 · T-078 · The create/edit form: fields, autocomplete, inspect toggle   [Cycle 1 · serial · MAIN context]
Context: The visible part. Add ชั้น (required, autocomplete, free typing allowed) and subworkspace (optional, same behaviour) at TASK level, plus a "ตรวจ inspect ไหม" toggle that reveals a picker of that project's inspection sub-categories and links exactly one. Projects whose department is 'WH' see none of this and keep today's form exactly.
Skill: coder
Model: model_high + MAIN context (form logic + validation + conditional UI · judgment · never delegated)
Input_From: S5 (service types + list fetch)
File: frontend/src/utils/projectDepartment.ts (NEW) · frontend/src/page-components/workspace/components/TaskCreateModal.tsx
Tool: Write (the new helper) · Edit (the modal)
Avoid: Write on TaskCreateModal.tsx (2100-line file — never overwrite) · Bash sed
Rollback: rm frontend/src/utils/projectDepartment.ts && git checkout frontend/src/page-components/workspace/components/TaskCreateModal.tsx
Data_Sent: (a) create `frontend/src/utils/projectDepartment.ts` exporting `isWarehouseDepartmentProject(project)` → `project?.department === 'WH'`, with a comment recording the user decision (2026-08-19) and why project-NAME matching was dropped — SR GAP-1: the helper is created HERE, in the first section that needs it, not in S7 which runs later · (b) zod schema L44-85: add `floor` (string, required via superRefine only when the project is NOT WH), `subWorkspace` optional, `requiresInspection` boolean default false, `inspectionSubCategoryId`/`Name` optional — with a rule that a switched-on toggle demands a chosen sub-category · (c) defaults L159-164 + reset L216 · (d) edit-load L180-202 so existing values populate · (e) UI: two freeSolo Autocompletes in the NORMAL WORKFLOW layout next to categoryName (L1166 area), then the toggle + sub-category picker · (f) payload: createTask L628 and both updateTask calls (L571, L598) · (g) **widen the live duplicate warning**: `taskNameDuplicate` (L354-363) currently blocks save on a matching task NAME. It must compare (name + floor + subWorkspace) so "งานเสา ชั้น 12" and "งานเสา ชั้น 13" are both allowed while a true duplicate is still blocked — mirroring the S2 backend identity rule · (h) **the copy-task feature** `handleDuplicateTask` (L446-466) must carry the source task's `inspectionSubCategoryId`/`Name` into the form but leave `floor`/`subWorkspace` BLANK — the user's whole reason to copy งานเสา is to place it on a different floor (user, 2026-08-19: "การ clone คือเราต้องการ clone แค่งานเสา แต่งานเสานี้มันต้องนำไปใช้ที่ชั้น 13 ... มันต้อง clone หัวข้อ inspect ต่างหาก")
Token: ~2200 output
Constraints: → §Per-Section Invariants · PLUS: a WH project must produce a payload identical to today · floor is NOT required when editing a legacy task (user decision) · SR GAP-2 — floor must NOT be demanded on the two branches that attach to an ALREADY EXISTING task, because that task already carries its floor: the `selectedParentTaskId` branch (L596-605, picking an existing task from the combobox and adding subtasks) and the support pick-up branch (L588-595). Both must keep working with floor left blank.
Verify-1: `grep -c "floor" frontend/src/page-components/workspace/components/TaskCreateModal.tsx` → >=6
Verify-2: `grep -c "requiresInspection" frontend/src/page-components/workspace/components/TaskCreateModal.tsx` → >=3 (schema, UI, payload)
Verify-2b: `grep -n "taskNameDuplicate" -A 8 frontend/src/page-components/workspace/components/TaskCreateModal.tsx | grep -c "floor"` → >=1 (the duplicate rule now includes floor)
Verify-2c: `grep -n "handleDuplicateTask" -A 20 frontend/src/page-components/workspace/components/TaskCreateModal.tsx | grep -c "inspectionSubCategory"` → >=1 (copy carries the inspect topic)
Verify-3: `grep -c "isWarehouseDepartmentProject" frontend/src/utils/projectDepartment.ts frontend/src/page-components/workspace/components/TaskCreateModal.tsx` → defined once + used in the modal
Verify-4: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0
- [ ] S6

### S7 · T-078 · Show the floor on the task card (and survive the flatten)     [Cycle 1 · serial · MAIN context]
Context: Display the task's floor/subWorkspace on the task card. The workspace page flattens tasks/subtasks into card objects and has already dropped a field that way once (the support fields), so this section must prove the value SURVIVES the flatten, not merely that the card renders it.
Skill: coder
Model: model_medium + MAIN context (small UI + a real regression trap · no Agent spawning this session)
Input_From: S5 (Task type carries the fields) · S6 (values are actually being saved by then)
File: frontend/src/page-components/workspace/components/TaskCard.tsx · frontend/src/pages/workspace/index.tsx (flatten only)
Tool: Edit
Avoid: Write on either file (both are large — never overwrite)
Rollback: git checkout frontend/src/page-components/workspace/components/TaskCard.tsx frontend/src/pages/workspace/index.tsx
Data_Sent: TaskCard renders a small chip/line "ชั้น X · G/L A-1" only when floor exists; in the workspace flatten, carry floor/subWorkspace/inspection fields onto the flattened card object
Token: ~600 output
Constraints: → §Per-Section Invariants · PLUS: a task with no floor must render EXACTLY as today (no empty chip, no layout shift) · do not touch the existing dept==='WH' tests already in these files · read the flatten before editing it — do not assume its shape
Verify-1: `grep -c "floor" frontend/src/page-components/workspace/components/TaskCard.tsx` → >=1 (rendered)
Verify-2: `grep -c "floor" frontend/src/pages/workspace/index.tsx` → >=1 (present in the flatten)
Verify-3: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → 0
- [ ] S7

---

## Phase 3 — Close Checklist
- [ ] R8 index sync: 2 new files + 5 edited → index_files (mutation_sync hook is the backstop) ·
      emit [r8-sync-check] · NEVER run scripts/build_file_index.py
- [ ] Roadmap [X] T-078 (attempts + tool_calls annotated)
- [ ] Verify: run every Verify-N line above · backend AND frontend `npx tsc --noEmit` → 0 errors
- [ ] Manual check the user can do: create a task on a normal project (floor required, autocomplete offers
      previously used floors, inspect toggle reveals sub-categories) · create a task on a WH project
      (form unchanged) · open an OLD task and save without a floor (must not be blocked) · the card shows
      the floor
- [ ] FULL scrutinize at close (skill loaded, never reviewed in head) + [simpler-way] verdict
- [ ] [scope-creep] check against the File: declarations above
- [ ] active_thread phase: done · session_handoff.md written
- [ ] NO PUSH. Branch `inspection` only. T-080 (the /export-documents role matrix) is still an
      unresolved PRE-PUSH blocker, and the parked IN/OUT files must stay uncommitted:
      segmentEngine.ts · its characterization test · WorkHourComparisonTable.tsx · functions/lib/*
- [ ] Ask user: "มีอะไรอยากแก้ไขหรือปรับเพิ่มไหมครับ?" (1 message)
- [ ] [session-health] emitted
