## Sections
- id: 1
  name: "Diagnose"
  steps:
    - "Confirm that no photo validation rules exist in backend"
    - "Check imports and utility functions used in frontend photo validation"
- id: 2
  name: "Edit & Verify"
  steps:
    - "Modify submitAdvanceRequest in backend/src/services/TaskService.ts to enforce Today or Tomorrow only"
    - "Modify handleSubmit in frontend/src/pages/daily-reports/index.tsx to make photos optional if today and progress < 100%"
    - "Verify changes in compiler / linter"
- id: 3
  name: "Sync & Close"
  steps:
    - "python scripts/symbol_indexer.py"
    - "roadmap: add and mark T-020-001-05 as complete"
    - "active_thread.md → phase: done"

## Session Archive
### Closed: 2026-06-05
Done: [S1, S2] | Remaining: [] | Summary: Daily Report page switcher between reports/requests with sidebar layout matching Workspace and bug fix.
### Closed: 2026-06-05
Done: [Section 1, Section 2, Section 3] | Remaining: [] | Summary: Redesign the Workspace Requests Table (remove hours/status, add due date badge) and style dashboard stat cards with modern linear gradients and glassmorphism.
