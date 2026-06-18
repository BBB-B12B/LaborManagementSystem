# Gather Complete — T-204 accepted support task disappears + create shows 0 tasks

date: 2026-06-18
skill: coding
task: T-204 fix (1) cross-project support task vanishes from helper/FM view; (2) board shows 0 after create

## Findings

### Bug #1 — accepted cross-project support task disappears (DB correct, noti works)
- Data source = `useRealtimeTasks(user.projectLocationIds, activeTab, user.employeeId)` (index.tsx:133).
- Hook DOES intend cross-project support: handleTasksSnapshot keeps a task if isOwnProject OR isMySupport
  (useRealtimeTasks.ts:120-124). BUT isMySupport = `data.supportAssignees.some(a => a.employeeId === supportEmployeeId)`
  where supportEmployeeId = user.employeeId — compares ONE id only.
- Pickup stores assignees as `{ employeeId: v.id, ... }` (index.tsx:2100/2721) → supportAssignees[].employeeId
  actually holds the user's `id`. If user.id !== user.employeeId, the realtime match FAILS → parent task never
  enters cache → its subtasks have no parent → whole task disappears.
- Backend joinSupportTask (TaskService.ts:632-647) correctly accumulates supportAssignees on BOTH subtask and
  parent task → DB is fine; the bug is purely the client realtime filter.
- The role filter (index.tsx:360-361) already checks BOTH `employeeId` and `user.id` — realtime hook does not = inconsistent.
- FIX: make useRealtimeTasks isMySupport match against BOTH employeeId and id (pass user.id too).

### Bug #2 — board shows 0 tasks right after creating (must switch tab to see)
- `handleModalSuccess` (index.tsx:445-449) calls `invalidateCache()` then `fetchFromAPI(true)`.
- `fetchFromAPI` is now a NO-OP (index.tsx:420 — `useCallback(async () => {}, [])`); data comes from useRealtimeTasks.
- So invalidate wipes the whole cache and nothing reloads (onSnapshot only fires on actual doc changes). Board = 0.
- Switching tab re-runs the useRealtimeTasks effect (activeTab dep) → invalidate + RE-SUBSCRIBE → fresh full snapshot
  → everything reappears. That is why "removing the filter" fixes it. NOT a date-filter problem (user confirmed dueDate is in-month).
- FIX: remove invalidateCache()+fetchFromAPI() from handleModalSuccess. The new task arrives via realtime onSnapshot
  'added' automatically; existing cache stays intact.
- Note: other standalone invalidateCache() calls exist (640/671/712/785) for WO/category edits — same latent risk but
  NOT reported; leave for a follow-up unless they regress. Happy-path handlers mostly use patchTaskInCache already.

## Assessment
- 2 surgical fixes, both client-side. No backend change. No date-filter change.
- S1 (realtime id match) fixes #1 for both live-pickup ('modified' snapshot) and already-picked-up-on-load ('added').
- S2 (remove cache wipe on create) fixes #2; realtime delivers the new task.

[✓ gather]
