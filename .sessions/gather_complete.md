# Gather Complete — 2026-06-22

## Task (T-039)
Fix the +New Task ambiguity: a task with empty `subtasks[]` is ambiguous — "standalone, no subtasks ever" vs "has subtasks, just not created yet" look identical in data. Record intent explicitly via a persisted `taskType` flag. User confirmed Option A (toggle) + Option-2 rendering (standalone shows as a task with 1 subtask).

## Root cause (confirmed in code)
`TaskCreateModal.tsx` has a `hasSubtasks` toggle (state line 121) but the toggle value is NOT persisted — toggle-off just stores `subtasks: []`. Intent is inferred from emptiness, so it is lost. Standalone mode also has NO field to enter assignee/dueDate (those only exist on subtask rows).

## Key findings (Phase 1)
- Backend `createTask` (TaskService.ts:177-205) ALREADY aggregates assignees + derives parent dueDate from subtasks (fallback input.dueDate||now). → standalone sending ONE mirror subtask works with NO backend logic change.
- Daily report / hours are opened ONLY by clicking a subtask (WorkspaceTree.tsx:844). A task with no subtask is not reportable. → standalone REQUIRES one mirror subtask (confirms design).
- Tasks with no subtasks DO render in the tree (WorkspaceTree.tsx:282-284 fallback). → "pending" task will appear; just needs a badge.
- Subtasks only written when length>0 (TaskService.ts:245). Backend dueDate-required validation (tasks.routes.ts:1636) only fires when subtasks exist → pending case passes unchanged. SAFE.

## taskType state mapping (derived at form submit)
- toggle OFF → `standalone` — show assignee+dueDate fields on main task → build 1 mirror subtask (subtaskName = taskName) → send.
- toggle ON + subtasks.length > 0 → `hasSubtasks` (current behavior).
- toggle ON + subtasks.length === 0 → `pending` ("รอแตกงาน").

## Affected files (~4-5)
| File | Why |
|---|---|
| frontend/src/services/taskService.ts | add taskType to Task + CreateTaskInput |
| backend/src/models/Task.ts | add taskType to Task model |
| frontend/src/page-components/workspace/components/TaskCreateModal.tsx | standalone fields + mirror subtask + taskType payload + 3-state derive |
| backend/src/services/TaskService.ts | store taskType in newTaskData |
| frontend/src/page-components/workspace/components/WorkspaceTree.tsx | badge งานเดี่ยว/รอแตกงาน/แตกงานแล้ว |

## Acceptance criteria
- taskType persisted on every created task; existing tasks (no field) default safely.
- Standalone task: assignee+date set on main task, reportable (has mirror subtask), shows in tree.
- Pending task creatable (no subtasks) and shows "รอแตกงาน".
- No regression to existing multi-subtask create flow.
- Work on `main`; do NOT commit/push (user does it).

[✓ gather]
