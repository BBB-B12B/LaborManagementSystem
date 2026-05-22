---
name: mece
description: Loop Phase 2 — builds a section-based plan that maps 1:1 to target Skill sections[]. Runs once per task. Skipped on resume if plan exists.
---

## Sections
```
- id: 1
  name: "Build Plan"
  steps: ["read target Skill sections[]", "map steps to each section", "add verify + rollback per section"]
- id: 2
  name: "Confirm & Register"
  steps: ["send plan to user", "wait confirm", "add R-Roadmap entry per section"]
```

---

# MECE Planner

## Triggers
- Loop Phase 2: runs after Info Gather Loop for tasks with >3 steps or any side effect
- Side effects: file create/edit/delete · DB write · index update · symbol rename

## Skip When
- Read-only: grep, search, explain, lookup
- Single file edit, backlinks = 0, no ERR documentation needed
- Resuming with existing plan → skip Phase 1+2, jump to Phase 3 at pending section

---

## Plan Format (section-based — must map 1:1 to target Skill sections[])

```
**[✓ MECE]** Goal: <one line>

Section 1 — <name from Skill sections[0]>:
  Steps: [A] → [B] → [C]
  Verify: <checkable — grep/compile/read-back, never subjective>
  Rollback: <what to undo if this section fails>

Section 2 — <name from Skill sections[1]>:
  Steps: [D] → [E]
  Verify: <checkable condition>
  Rollback: <what to undo>

Independent (any section): [X] · [Y]

Cycle grouping (add when plan has ≥ 2 sections):
  Cycle 1: [S1, S2]          ← sections with no dependencies between them
  Cycle 2: [S3]              ← depends on output of S1 or S2
  S3 context-input: cycle_1_S1.json, cycle_1_S2.json
```
Rules:
- Sections in the same Cycle are spawned in parallel
- Sections in Cycle N+1 declare which `cycle_N_*.json` files they need
- Single-section plans have no Cycle grouping (omit Cycle block)
```

Rules:
- Sections must match target Skill sections[] exactly (same count and names)
- Each step = 1 atomic action (1 file edit, 1 script run, 1 index update)
- Verify must be executable — never "looks right"
- Independent steps have no section dependency

---

## Execution Protocol

```
Section 1 — Build Plan:
  [S1-A] Read target Skill SKILL.md → parse sections[]
  [S1-B] Map MECE steps to each section (use templates below as base)
  [S1-C] Add Verify + Rollback per section
  Verify: plan section count = Skill section count

Section 2 — Confirm & Register:
  [S2-A] Send plan to user → wait confirm
         (accept: "ok", "go", "ดำเนิน", "yes", explicit approval)
  [S2-B] Add R-Roadmap entry per section: [ ] T-<N>: <section-name>
  [S2-C] Emit [✓ MECE]
  Verify: roadmap entries exist for all N sections
```

On failure → STOP → report which step failed → do not auto-recover.

---

## Templates by Task Type

### Bug Fix (target: editor)
```
Section 1 — Diagnose:
  [A] R9 3-checks: error_index → symbol_index → file_index
  [B] Read source at line → confirm symptom
  Verify: blast radius known · ERR candidate confirmed or ruled out
  Rollback: no changes yet

Section 2 — Edit & Verify:
  [C] Apply targeted fix
  [D] [✓ written] grep verify change exists
  Verify: grep symptom → 0 results
  Rollback: revert edit

Section 3 — Sync & Close:
  [E] python scripts/symbol_indexer.py
  [F] Write ERR-XXX to error_index.md · [✓ written] verify
  [G] Mark roadmap [X] T-{N}-{BugID} (→ ERR-XXX)
  Verify: ERR entry exists · roadmap [X]
  Rollback: remove ERR entry if incorrect
```

### New Feature (target: coder)
```
Section 1 — Scope & Index:
  [A] R4 scope probe · check index for conflicts
  Verify: no duplicate symbols or file paths
  Rollback: n/a

Section 2 — Build:
  [B] Create file(s) · [✓ written] verify each
  Verify: files exist at correct paths
  Rollback: delete created files

Section 3 — Sync & Close:
  [C] file_manager: update index_files.json + backlinks
  [D] variable_manager: update index_variables.json
  [E] python scripts/symbol_indexer.py · Mark roadmap [X]
  Verify: symbol count increased · no stale backlinks
  Rollback: restore index from last known state
```

### Refactor / Rename (target: editor)
```
Section 1 — Diagnose:
  [A] grep index_variables → get all used_in files · assess blast radius
  Verify: used_in list complete
  Rollback: n/a

Section 2 — Edit & Verify:
  [B] Rename in source · update all used_in call sites
  [C] [✓ written] grep old name → 0 results
  Verify: grep '<OldName>' src/ = 0 results
  Rollback: reverse rename in all files touched

Section 3 — Sync & Close:
  [D] python scripts/symbol_indexer.py · update index_variables.json key
  [E] Mark roadmap [X]
  Verify: index updated · roadmap [X]
  Rollback: restore index key
```

---

## Trace Format
```
**[✓ MECE]**   Plan covers <N> sections in <M> Cycles · user confirmed · roadmap entries added
**[MECE]**     ✓ Section <N> done · → Section <N+1> next
**[cycle N]**  All <X> sections done · results: .sessions/cycle_N_*.json · spawning Cycle <N+1>
**[MECE]**     ✓ All Cycles done · Roadmap updated · Thread: done
```
