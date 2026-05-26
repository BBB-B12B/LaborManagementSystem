# MECE Plan - Subtask-Level Support Request Pick Up

## Goal
Modify the support pickup flow so that the Support Team chooses a specific Subtask (rather than the parent Task) from the dropdown when helping. Update the backend transaction logic to mark only that specific Subtask as picked up and create the "help" revision solely under that Subtask, while rolling up the aggregated status and assignees to the parent Task.

---

## Plan Sections

### Section 1: Backend Update for Subtask-Specific Join
- **Task**:
  - Update `joinSupportTask` in `backend/src/services/TaskService.ts` to support an optional `subtaskId?: string`.
  - When `subtaskId` is provided, update `isPickedUpBySupport`, `supportTaskName`, and `supportAssignees` only on that Subtask document. Create the `help` collection doc (e.g. `help00`) under that specific Subtask instead of all subtasks.
  - Roll up status (`isPickedUpBySupport: true`) and aggregate `supportAssignees` into the parent Task.
  - Update `/api/tasks/:id/support` route in `backend/src/api/routes/tasks.routes.ts` to read `subtaskId` from the request body.
- **DoD**:
  - Backend transaction logic modified and tested via mock tasks or compile verification.
- **Est**: 15 mins

### Section 2: Frontend Service and Modal UI Update
- **Task**:
  - Update `joinSupportTask` in `frontend/src/services/taskService.ts` to accept and send `subtaskId` in the request body.
  - Update `TaskCreateModal.tsx`:
    - Fetch tasks and extract all subtasks with `isSupportRequest === true && !isPickedUpBySupport`.
    - Render Autocomplete options with label format `[Parent Task] > [Subtask]`.
    - On option select, save `supportOriginalSubtaskId` and auto-fill details (name, work order, category, etc.).
    - Pass `supportOriginalSubtaskId` to the backend when saving the task join.
- **DoD**:
  - Dropdown options display properly and selecting a subtask autofills the modal.
- **Est**: 15 mins

### Section 3: Verification & Compilation
- **Task**: Run TypeScript compiler checks and sync symbols index.
- **DoD**:
  - `npm run type-check` compiles without new errors.
  - `python scripts/symbol_indexer.py` executed successfully.
- **Est**: 10 mins
