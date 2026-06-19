task: T-205 FM "My job" support card shows subtask name on both lines
phase: in_progress (code complete + tsc green; pending user local re-test, then push)
next: user re-tests FM "My job" support card; then push T-202..T-205 together.

## T-205 result (code complete 2026-06-18, frontend tsc green)
- Bug: FM "My job" support card showed the subtask name ("ชั้น 1") on BOTH the task-title line and the
  subtask line. DB + noti correct. Root: card title used displayTaskName = supportTaskName, but supportTaskName
  is a SUBTASK-level name (== subtaskName) -> collided with the subtask line.
- Fix (frontend/src/pages/daily-reports/index.tsx, display-only):
  - card (~4248): displayTaskName = task.taskName (parent task) · new displaySubtaskName = support? supportTaskName : subtaskName
  - card subtitle (4419): render displaySubtaskName
  - detail modal subtitle (2937): the "parent task as context" line -> selectedTask.taskName (was supportTaskName)
- No backend / no data change. Own-project cards unaffected (displayTaskName == taskName when not support).

## --- PRIOR TASKS (all code complete, pending push) ---

## T-204 USER-VERIFIED 2026-06-18 (local): support shows on WH workspace ✅ · FM My job shows assigned support subtask ✅ · pickup date matches (no +1) ✅
- S1 useRealtimeTasks.ts: realtime cache gate keeps any isSupportRequest && isPickedUpBySupport task.
- DATE FIX: TaskCreateModal support-pickup option uses st.dueDate (was parent t.dueDate).
- ASSIGNED-SUBTASKS FIX (tasks.routes.ts:699): cross-project support query array-contains-any [user.id, employeeId, uid].
  REQUIRES after-sale-system collection-group index on subtasks.historicalAssigneeIds.
- S2 index.tsx handleModalSuccess: removed invalidateCache()+fetchFromAPI() that blanked the board.

## T-203 (code complete, tsc green both ends): dup-name warning
- S1 TaskCreateModal dup detection; S2 quick-add dup; S3 backend 409 guard (createSubtask/createTask/updateTask).

## T-202 (code complete): createTask writes subtasks when appending; taskName single freeSolo combobox.

## T-201 (older, pending close): deploy done; needs Firestore index for historicalAssigneeIds + runtime test ARC-0002-005-0001.
