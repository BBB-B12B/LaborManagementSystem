date: 2026-06-09
objective: Implement backend notification triggers for 'task_assigned' to notify FMs/SEs when they are assigned tasks or subtasks.
constraints:
  - Notifications must resolve FM/SE uid from their employeeId by querying the users collection in the Project A database.
  - Notifications must be triggered asynchronously after successful transaction commits to prevent cross-project transaction lockups or blocking.
  - Prevent duplicate notifications when updating assignees in updateSubtask (only notify new assignees).
affected_files:
  - backend/src/services/TaskService.ts
acceptance_criteria:
  - FM/SE receives a 'task_assigned' notification when a subtask is created (Quick Create Subtask).
  - FM/SE receives a 'task_assigned' notification when a subtask is updated with new assignees.
  - FM/SE receives a 'task_assigned' notification when tasks/subtasks are created via WBS import or parent task creation.
  - Backend compiles cleanly without TypeScript compilation errors.
verification_intent: Verify that backend compiles cleanly and symbol index is synced.
