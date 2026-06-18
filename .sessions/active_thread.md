task: T-204 support task disappears from helper/FM view + board shows 0 after create
phase: done (USER-VERIFIED on local — all 3 confirmed working; pending push only)
next: user pushes. T-202/T-203/T-204 ship together.

## T-204 USER-VERIFIED 2026-06-18 (local):
1. support task shows on WH workspace ✅  2. FM "My job" shows assigned support subtask ✅
3. pickup date matches card (no +1) ✅

## T-204 result (code complete 2026-06-18, frontend tsc green)
- S1 useRealtimeTasks.ts: REAL FIX — realtime cache gate now also keeps any task where
  isSupportRequest && isPickedUpBySupport, so EVERY picked-up support task enters cache and
  filterTasksByRole (which already shows picked-up support to all WH users) can display it.
  (Earlier employeeId/id identity match was insufficient: pickup stores member id != auth id.)
  Requirement: all workspace users see picked-up support tasks, not just picker/assignee.
- DATE FIX: TaskCreateModal support-pickup option used parent task dueDate (t.dueDate) instead of
  the subtask's own (st.dueDate) -> prefilled date was off (29 -> 30). Now uses st.dueDate.
- ASSIGNED-SUBTASKS FIX (backend tasks.routes.ts:691): /assigned-subtasks cross-project support query
  used array-contains on employeeId (HR no.), but pickup stores historicalAssigneeIds as member id
  (= user.id). Changed to array-contains-any over [user.id, employeeId, uid] so the assigned FM's
  "My job" page finds the picked-up cross-project support subtask. REQUIRES the after-sale-system
  collection-group index on subtasks.historicalAssigneeIds (same one pending from T-201) — without it
  the query throws and is swallowed (support task silently absent).
- Workspace WH side confirmed working by user. FM "My job" pending user re-test after backend reload + index.
- S2 index.tsx handleModalSuccess: removed invalidateCache()+fetchFromAPI() (fetchFromAPI is a no-op now) that
  wiped the cache and blanked the board to 0 until a tab switch re-subscribed. New task now arrives via realtime.

## T-203 result (code complete 2026-06-18, tsc green both ends) — still pending local test + push
- S1 TaskCreateModal dup detection; S2 quick-add dup; S3 backend 409 guard (createSubtask/createTask/updateTask).

## T-203 result (code complete 2026-06-18, tsc green both ends)
- S1 TaskCreateModal.tsx: useMemo duplicateSubtaskIndexes (dup subtask names within form) +
  taskNameDuplicate (new task name colliding in same WO+Cat). Inline warn on subtask field + taskName
  combobox; save button disabled when hasDuplicate.
- S2 workspace/index.tsx quick-add: quickSubtaskDuplicate vs parentTask.subtasks (client-side, no fetch);
  inline warn + submit disabled + handler early-return guard.
- S3 backend TaskService.ts defense-in-depth (returns 409, no silent append): createSubtask (807),
  createTask append loop (253), updateTask full-list unique check (1130).

## T-202 (previous task) — CODE COMPLETE, pending user local-test
- S1 backend TaskService.createTask: writes subtasks even when appending to existing task (drop isNewTask guard) — DONE, tsc green.
- S2+S3 frontend TaskCreateModal: taskName is ONE freeSolo combobox for all create states; picking existing task loads its subtasks; never reverts to plain text. — DONE, tsc green.
- Git commands provided; user will test on LOCAL (npm run dev, frontend :3000 -> backend :4000) before pushing. NOT yet pushed/closed.
- Roadmap T-202 still open until user confirms local test passes.

## T-201 (older task) — still pending close
- deploy done; user still needs Firestore collection-group index for historicalAssigneeIds (after-sale-system) + runtime test ARC-0002-005-0001.

## T-203 spec (confirmed via AskUserQuestion 2026-06-18)
Goal: stop SILENT duplicate creation. Today createTask/updateTask/createSubtask just append a running number on name collision — UI passes, backend silently makes a duplicate -> user confused. Must warn at creation.

Decisions (user-confirmed):
- BEHAVIOR: real-time inline warning AS YOU TYPE + DISABLE the save button ("บันทึกรายงาน") while a duplicate exists. (not a post-submit toast, not a silent skip.)
- SCOPE: warn on BOTH levels:
  - task name: duplicate within same WorkOrder + Category.
  - subtask name: duplicate ONLY within the SAME parent task. Different parent tasks MAY have same subtask name (allowed).
- COVERAGE: both subtask creation entry points must behave the same:
  (1) +newtask modal (TaskCreateModal.tsx)
  (2) construction tree "+" quick-add (frontend/src/pages/workspace/index.tsx ~1145 createSubtask)

Open questions for Phase 1 gather:
- where does the modal already have task list (filteredTasksForDropdown) + loaded subtasks to compare against in real time?
- construction-tree quick-add: does it have the sibling subtask list client-side to check, or need a fetch?
- decide client-side check (fast UX) vs backend guard (defense-in-depth) — likely BOTH (mirror T-202 pattern).
