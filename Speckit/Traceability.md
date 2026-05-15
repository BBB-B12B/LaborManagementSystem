# Traceability Matrix (Full Project)

- **2026-04-06 09:36Z:** **PHASE 1.5 AUDIT & POLISH STARTED.** Addressing frontend instructions and backend API consistency based on UX Framework.
- **2026-04-06 09:46Z:** **PHASE 1.6 BULLETPROOF IMPORT ACTIVATED.** Implemented multi-sheet scanning and fuzzy header matching for maximum reliability.
| Task ID | Name | Goal | key Components |
| :--- | :--- | :--- | :--- |
| **T-300** | Mobile Daily Report | Schema Refactor & Unified UI | `DailyReport.ts`, `DailyReportService.ts`, `new.tsx`, `MobileDailyReportView.tsx` |
| **T-301** | Daily Report UI Lift & Shift | Mock rendering of Post-Sale UI components | `new.tsx`, `WorkOrderContext.tsx`, `legacy.ts`, `imageCompression.ts` |
| **T-330** | Master Form Modal | Multi-section Form (Regular, OT Morning/Noon/Evening), Worker Subset Logic, Batch Save | `DailyReportEntryModal.tsx` |
| **T-350** | Wage Period Soft Delete | Implement Soft Delete for Wage Periods | `WagePeriod.ts`, `WagePeriodService.ts`, `wagePeriods.routes.ts` |
| **T-360** | Refactor Project Identity | projectCode & projectName | `WagePeriod.ts`, `WagePeriodService.ts` |
| **T-361** | Wage Calculation UI Refinement | Adjust button color and table display | `index.tsx` (frontend) |
| **T-362** | Wage Detail UI Refinement | Full width table and button color | `[id].tsx` (frontend) |
| **F-013** | Excel Import | Import Daily Reports from Excel | `dailyReportRoutes.ts`, `DailyReportService.ts` |
| **T-302** | Workspace Kanban UI | Mock rendering of Task Board with Gradient borders based on UX Audit | `workspace/index.tsx`, `Navbar.tsx` |
| **T-303** | Workspace API Integration | Real data integration, Task creation logic with running number, Modal UI | `TaskService.ts`, `Task.ts`, `TaskCreateModal.tsx`, `workspace/index.tsx` |
| **T-304** | UserForm DatePicker Fix | Fix LocalizationProvider crash by using custom DatePicker component | `UserForm.tsx` |
| **REQ-014** | F-014 | Sales System Integration | Read/Write to external Firebase path | API/DB |
| **REQ-015** | F-015 | Daily Report Form | Store labor records and site images under tasks | UI/API |
| **REQ-016** | F-016 | Task Revision Workflow | Keep taskId intact, increment currentRevision | DB/API |
| **REQ-017** | F-017 | Leave Tracking System | Split labor/leave hours, Med Cert auto-trigger | UI/API |
| **T-805** | Hierarchical Task ID | Auto-run ID per Project/WorkOrder (STR/ARC) | `TaskService.ts` |
| **T-806** | UI Flow Reorder | Reorder form fields to match hierarchy (Location -> WO -> Cat -> Task) | `TaskCreateModal.tsx` |
| **T-807** | UX Style Audit | Fix background color inconsistency on TextFields | `TaskCreateModal.tsx` |
| **T-810** | Fix Task Fetching Perf | Change to `.where()` for performance and stability | `TaskService.ts` |
| **T-811** | Remove 'system' Fallback | Add strict auth check | `tasks.routes.ts` |
| **T-812** | Dead Tabs Fix | Implement date-based filtering for Workspace Tabs | `workspace/index.tsx` |
| **T-813** | TaskCard Actions | Add Edit and Delete menu | `TaskCard.tsx` |
| **T-814** | Quick Filters | [Frontend] Fix Quick Filters button (Add functionality or hide it) | `workspace/index.tsx` |
| **T-815** | Localized Category ID | [Backend] Localized running number for Categories per WorkOrder | `TaskService.ts` |
| **T-816** | [Backend] Update/Delete API | PATCH/DELETE endpoints for Tasks with Soft Delete | `tasks.routes.ts`, `TaskService.ts` |
| **T-817** | [Frontend] Edit UI | Edit Modal and Confirmation Dialog | `TaskCreateModal.tsx`, `WorkspacePage` |
| **T-818** | [Backend] Task Audit Trail | Record Old/New values for task edits | `TaskService.ts`, `EditHistory.ts` |
| **T-819** | [Frontend] Description UI | Add 'หมายเหตุ' field to Task modal | `TaskCreateModal.tsx` |
| **T-820** | [Frontend] Summary Button | Button to link Reporting view to Summary table | `daily-reports/index.tsx` |
| **T-821** | [Backend/FE] Progress Sync | Sync Task progress from Daily Report | `DailyReportService.ts`, `TaskService.ts` |
| **T-905** | Global Sync Logic | Implementation of "Sync" button in Topbar to invalidate all caches | `Layout.tsx`, `dailyReportService.ts`, `taskCacheStore.ts` |
| **T-920** | Performance Optimization | Refactor Daily Report to use React Query + Midnight Reset Cache | `daily-reports/index.tsx`, `dailyReportService.ts` |
