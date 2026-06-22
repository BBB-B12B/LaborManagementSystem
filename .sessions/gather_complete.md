# Gather Complete — workspace role-based access rework

date: 2026-06-22
task: T-043 rework filterTasksByRole — AM project-scoped, LD own-created-only

## What was read
- frontend/src/pages/workspace/index.tsx:316-415 — `filterTasksByRole` (the ONLY filter that decides which tasks/subtasks a user sees on /workspace).
- frontend/src/components/layout/Navbar.tsx:47-99 — menu/role gate (workspace roles = AM,OE,PE,PM,PD,MD,LD + GOD always). Menu NOT changing.

## Root facts
- Current "see everything" bucket (line 331): `isSuperUser(GOD/ADMIN) || isHO || (role==='AM' && !isWH)`.
- Non-WH site users fall through: own project → see all main tasks (support requests gated: visible only if picked up OR createdByMe); cross-project → only own-created/assigned.
- WH department has its own branch (support pickup flow — T-042). UNCHANGED per user.
- `role = (roleCode || roleId).toUpperCase()`. LD is a roleCode.
- createdBy is matched against BOTH `user.id` and `user.employeeId` everywhere.

## Change required (user-confirmed)
1. Remove `(role==='AM' && !isWH)` from the see-all bucket → AM becomes project-scoped like OE/PE/PM/PD/MD (reuses existing non-WH site path).
2. Add LD-specific branch: LD sees ONLY main tasks where `createdBy === me`, and for those, ALL subtasks regardless of creator (do NOT filter subtasks for LD).
3. GOD/ADMIN/HO + WH branch untouched.

## Assumptions (confirm in plan)
- LD gate = main-task `createdBy` only (not isMyProject). A task whose main task LD did NOT create is hidden even if it contains an LD-created subtask.
- Support-request gating for the AM/OE/PE/PM/PD/MD group stays as-is (part of support flow user said keep).

[done] gather
