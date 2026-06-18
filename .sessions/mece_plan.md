# MECE Plan — T-204 support task disappears + board shows 0 after create

date: 2026-06-18
skill: coding
status: in_progress

## Phase 0 — Context (kept across compacts)
- Bug #1: accepted cross-project support task vanishes from helper/FM view (DB correct, noti works).
  Root: useRealtimeTasks isMySupport matches only user.employeeId, but pickup stores assignees keyed by
  user.id -> match fails -> parent task never enters cache -> task disappears.
- Bug #2: board shows 0 tasks right after creating; must switch tab to see. Root: handleModalSuccess
  calls invalidateCache() then a now-NO-OP fetchFromAPI() -> cache wiped, nothing reloads until tab switch
  re-subscribes the realtime listeners. NOT a date-filter issue (user confirmed dueDate is this month).
- Constraints: do NOT commit/push (git cmds only). after-sale-key.json sensitive. no base64 in chat.

## Phase 1 — Info Gather -> see gather_complete.md (2026-06-18) [X]

## Phase 2 — MECE Plan (this file) [X]

## Phase 3 — Execution (2 sections — independent)

- [X] S1 · useRealtimeTasks: match support identity by BOTH employeeId and id
  - File: `frontend/src/hooks/useRealtimeTasks.ts`
  - Edit A: broaden the hook to accept the user's id as well (add param e.g. `supportUserId?: string`),
    OR change the signature to take an array of identity keys. Simplest: add `supportUserId` param.
  - Edit B (line 122-123): isMySupport = supportAssignees.some(a => a.employeeId === supportEmployeeId
    || a.employeeId === supportUserId). Build a Set of non-empty identity values and test membership.
  - Edit C (deps line 211): add the new identity arg to the dependency array.
  - Caller: `frontend/src/pages/workspace/index.tsx:133` -> pass `user?.id` as the new arg.
  - Tool: Edit · Avoid: changing the query structure, the subtask intake, the AfterSale hide logic.
  - Verify-1: frontend `npx tsc --noEmit` EXIT:0 · grep shows isMySupport tests both identity values ·
    index.tsx:133 passes user.id.

- [X] S2 · Remove cache-wipe on create so the board does not blank out
  - File: `frontend/src/pages/workspace/index.tsx`
  - Edit A (handleModalSuccess ~445-449): remove `invalidateCache()` + `fetchFromAPI(true)`; keep closing the
    modal + clearing editingTask. The new/edited task arrives via useRealtimeTasks onSnapshot automatically.
  - Tool: Edit · Avoid: touching the user-change invalidate (433) — that one is paired with re-subscribe and is correct.
  - Verify-2: frontend `npx tsc --noEmit` EXIT:0 · grep shows handleModalSuccess no longer calls invalidateCache/fetchFromAPI.

## Phase 3 Close Checklist
- [X] S1 [X] · S2 [X]
- [X] frontend tsc --noEmit EXIT:0
- [ ] provide git commit cmds (user runs) + remind: push triggers deploy
- [ ] runtime re-test: (a) pick up cross-project support task -> appears in helper/FM board;
      (b) create a task -> appears immediately without switching tab
- [ ] roadmap T-204 [X] · active_thread phase:done · PATH A clear Phase 1-3
