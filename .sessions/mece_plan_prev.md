**[✓ MECE]** Goal: Refine requests/reports table (remove "ชั่วโมงรวม" and "สถานะ" columns) and replace them with "วันครบกำหนด" (Due Date) badge calculated using TaskCard's due date badge logic.

- [X] Section 1 — Diagnose:
    Steps:
      [S1-A] Verify backend Firestore fields for task/subtask due dates.
      [S1-B] Check backlinks of `tasks.routes.ts` and `requests.tsx` for safety.
    Verify: Blast radius known, files to modify are verified.
    Est: 1k tokens

- [X] Section 2 — Edit & Verify:
    Steps:
      [S2-A] Modify `tasks.routes.ts` to include `dueDate` (derived from subtask or task) in `/requests-all` and `/reports-all` API responses.
      [S2-B] Modify `requests.tsx` to remove "ชั่วโมงรวม" and "สถานะ" columns and add "วันครบกำหนด" (Due Date) badge.
      [S2-C] Update CSV export logic in `requests.tsx` to align columns.
      [S2-D] Run frontend and backend type-checks to verify compile safety.
    Verify: `npm run type-check` compiles successfully for both backend and frontend.
    Est: 3k tokens

- [X] Section 3 — Sync & Close:
    Steps:
      [S3-A] Run `python scripts/symbol_indexer.py` to sync changed variables.
      [S3-B] Add and update the task `T-012-009-09` in `docs/master_roadmap.md` as completed.
      [S3-C] Write an entry in `error_index.md` if any bugs or corrections are fixed.
      [S3-D] Update active thread phase as done.
    Verify: Roadmap shows `T-012-009-09` as complete, index sync runs successfully.
    Est: 1k tokens
