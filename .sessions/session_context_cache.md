# Context Cache — 2026-06-22 13:21
task: T-042 support card — renamed name not reflected on card
phase: done
next: user tests on deployed app, then commits/pushes on main (do NOT commit/push). FINAL scope = NAME ONLY. subtaskCards (frontend/src/pages/workspace/index.tsx:817) + handleSubtaskClickInTree (~979) now carry subtask supportTaskName + supportAssignees (was inheriting parents empties) -> renamed name shows. PROGRESS fix REVERTED per user: card intentionally shows sites dailyProgress; removed the displayProgress switch in TaskCard.tsx and the supportDailyProgress carry. Backend storage unchanged (isSupportReport=true -> supportDailyProgress, independent + correct). FE tsc EXIT=0.
session_total: ~25939
chat_total: ~40680
cache_read: 0
cache_write: 0
pending_sections:
  - [ ] S1: Remove `(role === 'AM' && !isWH)` from the see-all return (line 331) so AM falls through to project-scoped path.
  - [ ] S2: Add `const isLD = role === 'LD' && !isWH` (SITE LD only — warehouse LD keeps the existing WH branch = sees all in warehouse project). In the `.map` subtask step, when isLD return the task with subtasks intact (no subtask filtering). In the `.filter` step, when isLD return `createdBy === user.id || createdBy === user.employeeId` (own main tasks only).
  - [ ] S3: Verify FE `npx tsc --noEmit` EXIT=0 + grep both edits present.
