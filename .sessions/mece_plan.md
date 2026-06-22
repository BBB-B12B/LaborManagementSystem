# MECE Plan — T-043 workspace role-based access rework

date: 2026-06-22
task: T-043 filterTasksByRole — AM project-scoped + LD own-created-only
skill: coding

## Phase 0 — Context
On /workspace, `filterTasksByRole` (frontend/src/pages/workspace/index.tsx:318) decides visibility. User wants: AM/OE/PE/PM/PD/MD see all tasks within their accessible projects; SITE LD (non-WH) sees only main tasks they created (with all subtasks inside); WAREHOUSE LD (department='WH') sees all tasks in the warehouse project (equal to the manager group) — handled by the EXISTING WH branch, untouched. GOD/ADMIN/HO + WH unchanged.

## Phase 1 — Gather
See gather_complete.md. Single function changes. Menu (Navbar) unchanged. Backend unchanged.

## Phase 2 — Plan (awaiting user confirm)
- [X] S1: Removed `(role === 'AM' && !isWH)` from the see-all return (now line 334) so AM falls through to project-scoped path.
- [X] S2: Added `const isLD = role === 'LD' && !isWH` (SITE LD only — warehouse LD keeps the existing WH branch = sees all in warehouse project). `.map` (line 345) returns task with subtasks intact when isLD; `.filter` (line 402) returns createdBy match when isLD (own main tasks only).
- [X] S3: FE `npx tsc --noEmit` EXIT=0 + grep confirmed isLD at 330/345/402, see-all bucket at 334 has no AM.

Verify-N:
- S1: grep line 331 no longer contains `role === 'AM'`.
- S2: grep shows `isLD` branch in both `.map` and `.filter`.
- S3: cd frontend && npx tsc --noEmit -> EXIT=0.

Tool: Edit · Avoid: Navbar.tsx, backend, WH branch, GOD/ADMIN/HO bucket.

## Phase 3 — Execute
(sections above)

## Phase 3 Close Checklist
- [X] all [X] · tsc pass · NOT committed (user pushes on main)
