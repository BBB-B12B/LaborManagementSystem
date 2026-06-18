# Gather Complete — T-201 cross-project support pickup display + notify

date: 2026-06-18
task: After a helper accepts a cross-project support subtask, surface it in (1) helper workspace "งานช่วยเหลือ", (2) assigned FM daily report, (3) create a notification.

## G1/G2 findings (verified file:line)

### Write path — WORKS (no change)
- `backend/src/services/TaskService.ts:507-643` `joinSupportTask()` — CASE A (subtaskId given) writes to subtask (552-563) AND parent task (583-591): `isPickedUpBySupport:true`, `supportAssignees` (accumulated), `historicalAssigneeIds arrayUnion(...employeeIds, updatedBy)`. No notification call.
- `supportAssignees` = array of objects `{employeeId, name, roleId}`. `historicalAssigneeIds` = flat array of employeeId strings.

### Notification fn
- `backend/src/services/TaskService.ts:3087` `sendAssignmentNotifications(taskData, subtaskName, subtaskId, assignees, createdBy)` — assignees use `.employeeId`; resolves uid via db.users; writes `notifications` docs in afterSaleDb. supportAssignees shape matches `TaskAssignee[]`.
- Called elsewhere fire-and-forget after transaction (e.g. createSubtask:826).

### Daily report — BROKEN at query filter
- `backend/src/api/routes/tasks.routes.ts:629` GET /assigned-subtasks.
- Line 680-683: subtasksQuery `.where('projectId','in', targetProjectIds)` — FM/SE scoped to own projects (676-678) -> cross-project support subtask excluded at query level.
- Line 711-722: in-memory filter ALREADY correct (matchSupport via supportAssignees + matchHistorical) — but never reached because query pre-excludes.
- Line 725-727: tasksQuery same projectId filter -> parent missing from tasksMap -> 740 `if(!parentTask) return null` drops it.
- AM/GOD/MD + PM/PE: targetProjectIds empty -> no filter -> unaffected. Bug is FM/SE only.

### Workspace realtime — BROKEN at task filter
- `frontend/src/hooks/useRealtimeTasks.ts:120` `if(!projectIds.includes(data.projectId)) return;` — TASK listener only.
- Subtask listener (138-157) does NOT filter projectId -> cross-project support subtasks already flow into cache.
- `mapFirestoreDocToTask:43` maps `supportAssignees`; parent task has supportAssignees written by joinSupportTask.
- Caller `frontend/src/pages/workspace/index.tsx:133` `useRealtimeTasks(user?.projectLocationIds||[], activeTab)`. `user?.employeeId` exists (used at index.tsx:334).
- `WorkspaceTree.tsx:450-453` supportTree (isWH only) filters `sub.isSupportRequest`. buildTree:368-399 — when task has active subtasks, only subtaskFilter applies (checkTask unused), so parent task need not be a support request itself. -> Fix = get parent task into cache (line 120).

## [✓ gather] complete — ready for MECE
