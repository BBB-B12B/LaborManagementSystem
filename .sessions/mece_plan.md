# MECE Plan - Labor & Plans Table Redesign

**[✓ MECE]** Goal: Redesign Labor & Plans table page (requests.tsx) with premium UI, dashboard summary cards, and a subtask edit history timeline popup.

- [X] Section 1 — Diagnose:
    Steps:
    [A] R9 3-checks (error_index → symbol_index → file_index)
    [B] Read requests.tsx structure and dependencies to ensure exact integration
    Verify: requests.tsx file structure and existing logic (like task filters, data fetching) mapped.
    Rollback: No edits done yet.

- [X] Section 2 — Edit & Verify:
    Steps:
    [C] Implement Dashboard Summary UI and calculations in requests.tsx
    [D] Redesign TableHead with a Premium Navy/Charcoal Gradient and style table body
    [E] Implement SubtaskHistoryModal containing a Timeline of changes
    [F] Map users list using memberService to resolve updatedBy IDs to user names
    [G] Verify with TypeScript compile check and file content checks
    Verify: requests.tsx compiles without errors; check changes with grep verify
    Rollback: Revert requests.tsx to original version

- [X] Section 3 — Sync & Close:
    Steps:
    [H] Run python scripts/symbol_indexer.py to sync indexes
    [I] Mark docs/master_roadmap.md done for T-012-009-01
    Verify: roadmap shows [X] and symbol index is updated
    Rollback: Restore indexes and roadmap
