# MECE Plan — T-205 FM "My job" card shows subtask name on both lines

date: 2026-06-18
skill: coding
status: in_progress

## Phase 0 — Context (kept across compacts)
- Bug: FM "My job" support card shows the subtask name ("ชั้น 1") on BOTH the task-title line and the
  subtask line, instead of task name ("พื้น post tension") + subtask name ("ชั้น 1"). noti is correct; DB is correct.
- Root: card title uses `displayTaskName` which for support = `supportTaskName`. supportTaskName is a SUBTASK-level
  name (== subtaskName), so it collides with the subtask line. Parent task name (`task.taskName`) is correct & available.
- Same anti-pattern in detail modal subtitle (daily-reports/index.tsx:2937-2939) — fix per standing authorization.
- Constraints: do NOT commit/push (git cmds only). after-sale-key.json sensitive. no base64 in chat.

## Phase 1 — Info Gather -> see gather_complete.md (2026-06-18) [X]

## Phase 2 — MECE Plan (this file) [X]

## Phase 3 — Execution (1 section — single file)

- [X] S1 · daily-reports/index.tsx: task-title line = parent task name; subtask line = supportTaskName/subtaskName
  - File: `frontend/src/pages/daily-reports/index.tsx`
  - Edit A (card, ~4248-4249): split into two names —
    `displayTaskName = task.taskName` (parent task, the title)
    `displaySubtaskName = isActingAsSupport && task.supportTaskName ? task.supportTaskName
       : (task.subtaskName || (task.subtasks && task.subtasks[0]?.subtaskName))`
  - Edit B (card subtitle, line 4419): render `{displaySubtaskName}` instead of the inline subtaskName expression.
    (Title line 4411 keeps `{displayTaskName}` — now = parent task name.)
  - Edit C (detail modal subtitle, lines 2937-2939): the "Parent task name as context" line must show the parent
    task -> change to `{selectedTask.taskName}` (drop the supportTaskName substitution). Title line 2918 unchanged
    (subtask-name-as-primary is intended there).
  - Tool: Edit · Avoid: touching getDueDateColor/progress logic, isActingAsSupport memo, backend.
  - Verify-1: frontend `npx tsc --noEmit` EXIT:0 · grep shows title uses task.taskName, subtitle uses displaySubtaskName,
    modal subtitle uses selectedTask.taskName · own-project cards unchanged (displayTaskName==taskName when not support).

## Phase 3 Close Checklist
- [X] S1
- [X] frontend tsc --noEmit EXIT:0
- [ ] provide git commit cmds (user runs) + remind: push triggers deploy
- [ ] runtime re-test: FM "My job" support card shows task name on line 1, subtask name on line 2 (no duplicate)
- [ ] roadmap T-205 [X] · active_thread phase:done · PATH A clear Phase 1-3
