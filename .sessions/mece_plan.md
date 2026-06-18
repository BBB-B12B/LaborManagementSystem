# MECE Plan — T-201 cross-project support pickup: display + notify

date: 2026-06-18
skill: coding
status: in_progress

## Phase 0 — Context (kept across compacts)
- Feature: cross-project support pickup. Dropdown (T-200) = DONE. This task = make accepted task visible + notify.
- Test case: ARC-0002-005-0001 · งานก่อผนังชั้น 10 > ห้อง 1003. Helper = warehouse (isWH).
- Two Firestore projects: main `labor-management-system-33b06`, `after-sale-system` (afterSaleDb).
- Write path verified correct — do NOT touch joinSupportTask write logic.
- Constraints: do NOT commit/push (provide git cmds only). after-sale-key.json sensitive.

## Phase 1 — Info Gather -> see gather_complete.md (2026-06-18) [X]

## Phase 2 — MECE Plan (this file) [X]

## Phase 3 — Execution (3 sections, MECE — independent)

- [X] S1 · Notification on pickup (backend)
  - File: `backend/src/services/TaskService.ts` joinSupportTask (507-643)
  - Capture taskData + subtask name into outer scope inside transaction; after runTransaction resolves, fire `this.sendAssignmentNotifications(capturedTaskData, supportTaskName||subtaskName, subtaskId||'', supportAssignees, updatedBy).catch(...)` (fire-and-forget, both CASE A + CASE B).
  - Tool: Edit · Avoid: changing transaction write logic.
  - Verify-1: tsc --noEmit EXIT:0 · grep shows sendAssignmentNotifications called inside joinSupportTask.

- [X] S2 · Daily report cross-project (backend)
  - File: `backend/src/api/routes/tasks.routes.ts` assigned-subtasks (629-761)
  - For FM/SE (when no explicit projectId param): add 2nd best-effort query `collectionGroup('subtasks').where('historicalAssigneeIds','array-contains', employeeId)` (try/catch -> degrade to own-project on index-building). Merge + dedupe subtask docs by ref.path. Resolve cross-project parent tasks via `doc.ref.parent.parent` getAll(), add to tasksMap. Keep existing in-memory filter.
  - Tool: Edit · Avoid: removing projectId filter on main query (no full-scan regression).
  - Verify-2: tsc EXIT:0 · NEW Firestore collection-group index required (warn user) · degrade-safe on missing index.

- [X] S3 · Workspace realtime cross-project (frontend)
  - Files: `frontend/src/hooks/useRealtimeTasks.ts` (signature + line 120), `frontend/src/pages/workspace/index.tsx:133`
  - Add 3rd arg `supportEmployeeId?: string`; include in deps. Line 120: allow through if `projectIds.includes(data.projectId)` OR (`supportEmployeeId` && `data.supportAssignees.some(a=>a.employeeId===supportEmployeeId)`). Caller passes `user?.employeeId`.
  - Tool: Edit · Avoid: filtering subtask listener.
  - Verify-3: tsc/build · grep shows supportEmployeeId threaded hook->caller.

compact_checkpoint: after S2 (ceil(3/2)=2) — optional, low context risk.

## Phase 3 Close Checklist
- [ ] all S1-S3 [X]
- [ ] tsc --noEmit EXIT:0 (backend + frontend)
- [ ] warn user: new Firestore index for historicalAssigneeIds (after-sale-system)
- [ ] provide git commit cmds (user runs)
- [ ] roadmap T-201 [X] · active_thread phase:done · PATH A clear Phase 1-3
