# MECE Plan — T-039 task-type toggle (disambiguate empty subtasks)
date: 2026-06-22
task: T-039 task-type toggle (standalone vs has-subtasks) — disambiguate empty subtasks
skill: coding

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: compact_state.md checked · SESSION_TOTAL=0 · CHAT_TOTAL=sys_fixed · CFP_COUNT=37 stored
- [X] B2-B3: skill=coding identified · SKILL.md loaded (compact-restore) · hashes checked
- [X] C0-C3: routing confirmed · resume T-039 · no unresolved topic switch
→ TOKEN CHECK: SESSION_TOTAL ~0k (post-compact)

---

## Phase 1 — Info Gather
- [X] G0: task clarity gate — design confirmed by user (Option A + Option-2 render)
- [X] G1: ALL sections scanned (form, backend createTask, tree, daily-report path)
- [X] G2: batch greps + targeted Reads · [post-read] verdicts emitted
- [X] G3: every section → file/symbol + Verify-N draft · [✓ gather] emitted
- [X] gather_complete.md written today

### Files Read — Phase 1
| File | Why | Lines read |
|---|---|---|
| frontend/src/services/taskService.ts | Task + CreateTaskInput types | 1-80 |
| backend/src/models/Task.ts | Task + Subtask model | 1-110 |
| TaskCreateModal.tsx | schema, toggle, onSubmit, createTask call | 43-82, 110-240, 412-560, 1280-1400 |
| backend/src/services/TaskService.ts | createTask aggregation + subtask write | 120-300 |
| WorkspaceTree.tsx | tree build + task/subtask render | 262-340, 760-870 |
| TaskDailyReportModal.tsx | report opens via subtask | grep |

→ TOKEN CHECK: post-compact ~15k

---

## Phase 2 — Plan
- [X] M1.5: dependency_map: [taskService.ts + Task.ts (types) → TaskCreateModal.tsx + TaskService.ts + WorkspaceTree.tsx]
       risk_flags: [optional field — backward compatible · no DB migration · no irreversible action]
- [X] M2: plan 1:1 with sections · Context/Model/Tool/Verify-N filled per section
- [X] M3: plan + Verify-N sent to user → user confirmed (Option A + Option-2 render)
- [X] M4: roadmap [ ] T-039 added
- [X] M5: mece_plan.md written using template · [✓ MECE] emitted

→ [compact-skipped] — context just compacted, user said ลุย → proceed to Phase 3 (allowed)

---

## Phase 3 — Execute

### Cycle grouping
Cycle 1 — serial · agents: 1 → S1 (types — both other sections depend on it)
Cycle 2 — serial · agents: 1 → S2, S3, S4 (run sequentially in main context · small edits · shared type from S1)

### Per-Section Invariants (apply to EVERY S<N>)
Constraints — every section carries these PLUS its own line:
  - mece_plan.md dated today + T-039 roadmap [/] REQUIRED before any file edit
  - [pre-edit] emit before every Edit · [✓ written] grep verify after every change
  - Output Contracts: [post-read] ≤1 line · [✓ written] ≤1 line
  - L4.5 PURGE: drop Bash/grep after verdict
  - taskType is OPTIONAL on all types — existing data with no field must keep working
  - do NOT commit/push — user does it · work on main
Marking rule — flip [X] ONLY when [✓ written] + Verify-N both exist this turn.

### S1 · T-039 · Add taskType field to types            [Cycle 1 · serial]
Context: Add `taskType?: 'standalone' | 'pending' | 'hasSubtasks'` to FE Task + CreateTaskInput and BE Task model so intent is persisted.
Skill: coding
Model: model_medium
Input_From: none
File: frontend/src/services/taskService.ts · backend/src/models/Task.ts
Tool: Edit
Avoid: —
Rollback: git checkout frontend/src/services/taskService.ts backend/src/models/Task.ts
Data_Sent: add optional union-type field to 3 interfaces
Token: ~120 output
Constraints: → §Per-Section Invariants · PLUS: optional field only — no required addition
Verify-1: `grep -n "taskType" frontend/src/services/taskService.ts backend/src/models/Task.ts` → ≥3 matches
- [X] S1

### S2 · T-039 · Form: standalone fields + mirror subtask + taskType payload   [Cycle 2 · serial]
Context: When toggle OFF show assignee+dueDate on main task and build ONE mirror subtask on save; derive taskType (standalone/pending/hasSubtasks) and send it in createTask.
Skill: coding
Model: model_medium
Input_From: S1 (taskType type)
File: frontend/src/page-components/workspace/components/TaskCreateModal.tsx
Tool: Edit
Avoid: —
Rollback: git checkout frontend/src/page-components/workspace/components/TaskCreateModal.tsx
Data_Sent: schema fields (mainAssignees, keep dueDate) + standalone UI block + derive+send taskType + mirror subtask build in onConfirmSubmit
Token: ~400 output
Constraints: → §Per-Section Invariants · PLUS: do not break edit-mode or support-pickup flow
Verify-2: `grep -n "taskType\|standalone\|mainAssignees" TaskCreateModal.tsx` → matches in schema + payload
- [X] S2

### S3 · T-039 · Backend createTask stores taskType            [Cycle 2 · serial]
Context: Accept taskType in CreateTaskInput and write it into newTaskData (default 'hasSubtasks' when subtasks exist else derive).
Skill: coding
Model: model_medium
Input_From: S1
File: backend/src/services/TaskService.ts (+ CreateTaskInput type if separate)
Tool: Edit
Avoid: —
Rollback: git checkout backend/src/services/TaskService.ts
Data_Sent: add taskType to newTaskData object (~line 207-239) + CreateTaskInput
Token: ~150 output
Constraints: → §Per-Section Invariants · PLUS: keep existing aggregation untouched
Verify-3: `grep -n "taskType" backend/src/services/TaskService.ts` → ≥1 match in newTaskData
- [X] S3

### S4 · T-039 · WorkspaceTree badge            [Cycle 2 · serial]
Context: Show a small label per task node: งานเดี่ยว (standalone) / รอแตกงาน (pending) / แตกงานแล้ว (hasSubtasks) near the count badge.
Skill: coding
Model: model_medium
Input_From: S1
File: frontend/src/page-components/workspace/components/WorkspaceTree.tsx
Tool: Edit
Avoid: —
Rollback: git checkout frontend/src/page-components/workspace/components/WorkspaceTree.tsx
Data_Sent: small Chip/label derived from tItem.task.taskType near line 822-835
Token: ~200 output
Constraints: → §Per-Section Invariants · PLUS: fallback when taskType undefined (legacy) → derive from subtasks.length
Verify-4: `grep -n "taskType\|งานเดี่ยว\|รอแตกงาน" WorkspaceTree.tsx` → matches
- [X] S4

---

## Phase 3 — Close Checklist
- [ ] R8 index sync (symbol_indexer if new symbols · backlink_analyzer if files changed)
- [ ] Roadmap [X]: T-039 annotated
- [ ] Build/type check verify (frontend tsc + backend tsc) per Verify-N
- [ ] active_thread.md phase: done
- [ ] session_handoff.md written
- [ ] PATH A: clear mece_plan.md Phase 1-3
- [ ] User commits/pushes themselves (do NOT commit/push)
