# Gather Complete — T-205 FM "My job" card shows subtask name on both lines

date: 2026-06-18
skill: coding
task: T-205 fix FM "My job" support card showing subtask name twice (should be task name + subtask name)

## Findings

### Bug — My job card duplicates the subtask name on both lines (DB correct, noti correct)
- Data path: GET /assigned-subtasks (backend tasks.routes.ts:629) returns enrichedSubtasks. Each card = a subtask,
  enriched with its parent task. `taskName` is explicitly set to parentTask.taskName (tasks.routes.ts:798) = correct
  ("พื้น post tension"); `subtaskName` = the subtask ("ชั้น 1"). Because `...st` is spread AFTER `...parentTask`
  (tasks.routes.ts:794-799), the SUBTASK's `supportTaskName` overrides the parent's on the merged object.
- Card render (frontend/src/pages/daily-reports/index.tsx):
  - line 4248-4249: `displayTaskName = isActingAsSupport && task.supportTaskName ? task.supportTaskName : task.taskName`
  - line 4411 (title / "Task Name"): shows `displayTaskName` -> for support = `supportTaskName` = "ชั้น 1" ❌
  - line 4419 (subtitle / "Subtask Name"): shows `task.subtaskName` = "ชั้น 1" ✓
  => both lines = "ชั้น 1".
- Root: `supportTaskName` legitimately holds the SUBTASK-level support name (the noti at TaskService.ts:575-600 reads
  it as the subtask name: 'ชั้น 1' in งาน 'พื้น post tension'). The card wrongly puts this subtask-level name on the
  TASK title line, colliding with the subtask line. The parent task name (`task.taskName`) is available and correct.
- Same anti-pattern in the detail modal (daily-reports/index.tsx:2937-2939): the "Parent task name as context"
  subtitle line uses `isActingAsSupport && supportTaskName ? supportTaskName : taskName` -> shows "ชั้น 1" instead of
  the parent "พื้น post tension". Will duplicate the same way when opening this support task's detail.
- Own-project (non-support) cards: isActingAsSupport=false -> displayTaskName already = taskName, subtitle = subtaskName.
  So fixing the title to always use the parent task name is a no-op for own-project (no regression).

## Assessment
- Pure display fix, frontend only. No backend, no data change. supportTaskName data is correct as stored.
- 2 spots, identical root: task-title line must use the parent task name; the subtask line carries supportTaskName/subtaskName.
- Standing user authorization: fix the detail-modal duplicate too (same kind of problem, will definitely recur).

[✓ gather]
