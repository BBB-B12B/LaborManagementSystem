# MECE Plan — T-049 Workspace: gate For-Checking on report draft-status + rename ซ่อน→จัดเก็บ + swap trash icon
date: 2026-07-13
task: T-049 · Workspace "Complete" box — gate on report status (draft) not just progress=100 · rename "ซ่อน"→"จัดเก็บ" · swap trash-can unarchive icon
skill: editor

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: boot_init ran · SESSION_TOTAL=0 · CFP_COUNT=46 stored
- [X] B2-B3: skill=editor identified · SKILL.md loaded · mece SKILL.md loaded
- [X] C0-C3: routing confirmed · T-048 complete → T-049 NEW TASK (forced Phase 1+2)
→ TOKEN CHECK: SESSION_TOTAL ~low

---

## Phase 1 — Info Gather
- [X] G0: task clarity gate → AskUserQuestion ×2 (For-Checking gating + backfill default) — both resolved by user
- [X] G1: all target files scanned
- [X] G2: batch greps + targeted Reads · [post-read] verdicts emitted
- [X] G3: findings → files/symbols + acceptance criteria · [✓ gather] emitted
- [X] gather_complete.md written 2026-07-13

→ TOKEN CHECK: ok

---

## Phase 2 — Plan
- [X] M1.5: reasoning pass — S1 (backend) is the data source; S2→S3→S4 consume it (dependency chain); S5/S6 (rename/icon) independent. Irreversible: none (all reversible via git). Risk: Firestore transaction edit in submitDailyReport (highest blast radius) → keep minimal, additive field only.
       dependency_map: [TaskService.submitDailyReport → subtask.latestSiteReportStatus → useRealtimeTasks → index.tsx grouping]
       risk_flags: [transaction edit in hot report-submit path (additive only), 3 inline copies of status logic in index.tsx → consolidate to helper]
- [X] M2: plan 1:1 with sections · fields filled
- [X] M3: plan sent to user → user confirmed direction (For-Checking gating) + backfill default (absent→no gate)
- [X] M4: roadmap T-049 → [/]
- [X] M5: mece_plan.md written · [✓ MECE] emitted

→ TOKEN CHECK: ok
→ [compact-skipped] proceeding to Phase 3 directly (session low-token · user waiting)

---

## Phase 3 — Execute

### Cycle grouping
Cycle 1 — all sequential (single main context · shared file index.tsx across S4/S5/S6 · S1 is data source for S2-S4)
[S1] → [S2] → [S3] → [S4] → [S5] → [S6] → [S7 verify]

### Per-Section Invariants (apply to EVERY S<N>)
- mece_plan.md dated today + T-049 roadmap [/] REQUIRED before any file edit ✓
- [pre-edit] emit before every Edit · [✓ written] grep verify after every change
- Output Contracts: [post-read] ≤1 line · [✓ written] ≤1 line
- L4.5 PURGE: drop Bash/grep after verdict · keep Read excerpts ≤10L
- Smallest blast radius · one symbol at a time · additive-only where possible
Marking rule — flip [X] ONLY when [✓ written] + Verify-N both pass this turn.

### S1 · T-049 · Backend: denormalize latestSiteReportStatus onto subtask     [Cycle 1 · serial]
Context: In submitDailyReport, when isLatestDate & !isSupportReport, write `latestSiteReportStatus: reportData.status` onto the subtask (and task-level branch) doc alongside the existing dailyProgress/status update, so the realtime board can see the latest report's status.
Skill: editor
Model: model_medium
Input_From: none
File: backend/src/services/TaskService.ts
Tool: Edit
Avoid: Write (targeted edit only)
Rollback: git checkout backend/src/services/TaskService.ts
Data_Sent: add `latestSiteReportStatus: reportData.status ?? 'draft'` to the transaction.update(subtaskRef,...) and transaction.update(taskRef,...) inside the isLatestDate branch
Token: ~200
Constraints: → §Per-Section Invariants · PLUS: additive field only · do NOT change status state machine · do NOT alter progress/monotonic logic
Verify-1: `grep -n "latestSiteReportStatus" backend/src/services/TaskService.ts` → ≥1 hit in isLatestDate branch
- [X] S1

### S2 · T-049 · FE type: add latestSiteReportStatus to Task     [Cycle 1 · serial]
Context: Add optional `latestSiteReportStatus?: string` to the Task interface so the hook + grouping can read it type-safely.
Skill: editor
Model: model_low
Input_From: none
File: frontend/src/types/legacy.ts
Tool: Edit
Avoid: Write
Rollback: git checkout frontend/src/types/legacy.ts
Data_Sent: add field near dailyProgress/status in interface Task
Token: ~80
Constraints: → §Per-Section Invariants · PLUS: optional field · no breaking change
Verify-1: `grep -n "latestSiteReportStatus" frontend/src/types/legacy.ts` → 1 hit
- [X] S2

### S3 · T-049 · FE hook: map field on subtask     [Cycle 1 · serial]
Context: In useRealtimeTasks subtask mapping, map `latestSiteReportStatus: data.latestSiteReportStatus` from the subtask doc onto the card.
Skill: editor
Model: model_low
Input_From: S2
File: frontend/src/hooks/useRealtimeTasks.ts
Tool: Edit
Avoid: Write
Rollback: git checkout frontend/src/hooks/useRealtimeTasks.ts
Data_Sent: add mapping line in the subtask map (~line 72)
Token: ~80
Constraints: → §Per-Section Invariants · PLUS: additive only
Verify-1: `grep -n "latestSiteReportStatus" frontend/src/hooks/useRealtimeTasks.ts` → 1 hit
- [X] S3

### S4 · T-049 · FE grouping: gate For-Checking on draft     [Cycle 1 · serial]
Context: In getEffectiveSubtaskStatus, when progress>=100 && status!=='completed' && latestSiteReportStatus==='draft' → return 'in-progress' (stay In Progress); else 'for-checking' as today. Consolidate the 2 inline copies (mobile count ~1806, desktop bucket ~2009) to call getEffectiveSubtaskStatus so all sites share one rule.
Skill: editor
Model: model_medium
Input_From: S3
File: frontend/src/pages/workspace/index.tsx
Tool: Edit
Avoid: Write
Rollback: git checkout frontend/src/pages/workspace/index.tsx
Data_Sent: modify getEffectiveSubtaskStatus (line 104 branch); replace inline status blocks with getEffectiveSubtaskStatus(t) calls
Token: ~300
Constraints: → §Per-Section Invariants · PLUS: absent field → NOT draft (no gate) · keep other branches unchanged
Verify-1: `grep -n "latestSiteReportStatus === 'draft'" frontend/src/pages/workspace/index.tsx` → ≥1 hit
Verify-2: `grep -c "progress >= 100 && effectiveStatus" frontend/src/pages/workspace/index.tsx` → inline dups removed/consolidated
- [X] S4

### S5 · T-049 · FE rename ซ่อน → จัดเก็บ     [Cycle 1 · serial]
Context: Rename the completed-task hide action + related chip/popover labels from "ซ่อน" to "จัดเก็บ": TaskCard menu label (312), index.tsx desktop chip "ซ่อน N"→"จัดเก็บ N", popover title "งานที่ซ่อนไว้"→"รายการที่จัดเก็บ", mobile chip "ซ่อนไว้ N รายการ".
Skill: editor
Model: model_low
Input_From: none
File: frontend/src/page-components/workspace/components/TaskCard.tsx, frontend/src/pages/workspace/index.tsx
Tool: Edit
Avoid: Write
Rollback: git checkout <both files>
Data_Sent: targeted string replacements (Thai labels only — keep handler/var names)
Token: ~200
Constraints: → §Per-Section Invariants · PLUS: change user-visible Thai labels ONLY · do NOT rename handlers/state (handleHide, hiddenCompletedIds) to avoid blast radius
Verify-1: `grep -rn "จัดเก็บ" frontend/src/page-components/workspace/components/TaskCard.tsx frontend/src/pages/workspace/index.tsx` → ≥3 hits
- [X] S5

### S6 · T-049 · FE swap trash-can unarchive icon     [Cycle 1 · serial]
Context: Replace RestoreFromTrash icon on the unhide button (index.tsx ~2804) with a non-trash icon (Unarchive) and change tooltip "เอากลับมาแสดง" → "ยกเลิกจัดเก็บ".
Skill: editor
Model: model_low
Input_From: none
File: frontend/src/pages/workspace/index.tsx
Tool: Edit
Avoid: Write
Rollback: git checkout frontend/src/pages/workspace/index.tsx
Data_Sent: import Unarchive icon · swap RestoreIcon usage on unhide button · update Tooltip title
Token: ~150
Constraints: → §Per-Section Invariants · PLUS: keep RestoreFromTrash import only if still used elsewhere (grep first)
Verify-1: `grep -n "Unarchive\|ยกเลิกจัดเก็บ" frontend/src/pages/workspace/index.tsx` → ≥2 hits
- [X] S6

### S7 · T-049 · Verify — tsc both + browser     [Cycle 1 · serial]
Context: Typecheck frontend + backend clean; attempt browser verify on /workspace.
Skill: editor
Model: model_low
Input_From: S1-S6
File: (verify only)
Tool: Bash
Avoid: Edit
Rollback: n/a
Data_Sent: `cd frontend && npx tsc --noEmit`; `cd backend && npx tsc --noEmit`
Token: ~150
Constraints: → §Per-Section Invariants
Verify-1: `cd frontend && npx tsc --noEmit 2>&1 | tail -5` → exit 0 / no errors
Verify-2: `cd backend && npx tsc --noEmit 2>&1 | tail -5` → exit 0 / no errors
- [X] S7

---

## Phase 3 — Close Checklist
- [ ] R8 index sync (files changed → no new files/symbols expected · [r8-sync-check])
- [ ] Roadmap [X] T-049 (attempts + tool_calls)
- [ ] Verify-N all PASS
- [ ] active_thread phase: done
- [ ] session_handoff.md written
- [ ] PATH A: clear mece_plan Phase 1-3
