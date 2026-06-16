# Reflections

## Session: session_021_mobile_labor_table_redesign (2026-06-09)
- **Intent**: Redesign the Labor & Plans table for mobile viewports using card-based list layout.
- **Outcome**: Implemented responsive toggle using CSS media queries (`display: { xs: 'none', md: 'block' }` etc.) and custom card UI.
- **Friction**: Windows command line parsing issues with WSL and PowerShell, resolved by writing scripts to disk first.
- **Lesson**: Next.js page components benefit from CSS media queries for responsive layout checks to avoid hydration mismatches.
- **Promoted Patterns**: Extracting complex inline UI text helper functions (like `getDueDateText`) to clean up table columns.

## Session: session_022_hide_export_mobile (2026-06-09)
- **Intent**: Hide Export to Excel button on mobile viewports on requests workspace page.
- **Outcome**: Added display responsive sx key to Export button in requests.tsx (`display: { xs: 'none', md: 'inline-flex' }`).
- **Friction**: None.
- **Lesson**: MUI Button components easily accept responsive display values inside the sx prop to hide/show them.

## Session: session_023_quick_subtask_roles (2026-06-09)
- **Intent**: Modify the assignee dropdown to pull and filter users with FM and SE roles.
- **Outcome**: Fetched both role types via parallel API calls using `Promise.all` on the frontend (due to Firestore backend query limitation on `==` parameter filters) and merged lists locally, sorting alphabetically and filtering on both roleIds in the subtask page dropdown selectors.
- **Friction**: Backend controller only supports singular equality filter for roles, requiring client-side merge.
- **Lesson**: Standardize parallel fetch patterns for multi-role filtering where Firestore single-value filters are used.


2026-06-09 | task: popup ?????????????? ??????????????? ?????????????? | skill: editor
- Intent: Remove leaveType select dropdown and sync leaveType based on medCert presence.
- Outcome: Successfully removed dropdown input, added useEffect to sync leaveType state with medCertFile/medCertUrl, and confirmed clean compile of list.tsx.
- Lesson: Keep state variables completely synced when inputs are removed, so that payload and UI badge updates are perfectly consistent.

## Session: session_025_update_notification_types (2026-06-09)
- **Intent**: Update NotificationType and Notification interface on frontend and implement role-based scoping filters on the backend routes.
- **Outcome**: Successfully modified `frontend/src/services/notificationService.ts` to support the new types ('task_assigned', 'management_submit', 'unlock_request'), made project/task fields optional, and added projectIds. Updated the role-based filter in `backend/src/api/routes/notifications.routes.ts` to filter these types correctly based on user roles and project location access.
- **Friction**: Pre-existing, unrelated compilation errors on the branch failed the type checker run, but verification of the modified files confirmed they were correct.
- **Lesson**: Interface definitions should mirror the database model and accommodate general/cross-project notification types by utilizing optional fields.

## Session: session_026_task_assigned_notifications (2026-06-09)
- **Intent**: Implement notification triggers when tasks/subtasks are assigned to users (FM or SE).
- **Outcome**: Added `sendAssignmentNotifications` in `TaskService.ts` to fetch user uids from Project A's `users` collection and create `task_assigned` notifications in Project B's `notifications` collection. Triggered notifications asynchronously in `createTask`, `createSubtask`, `updateSubtask`, and `importWbs`.
- **Friction**: Windows command line parsing issues with bash and PowerShell when executing boot scripts, resolved by writing a platform-independent python script.
- **Lesson**: Separate database operations (transactions on Project B) from cross-project reads/writes (queries on Project A) by running the latter asynchronously outside the transaction to prevent blocking or database timeouts.

## Session: session_030_dailyreport_fe_opt (2026-06-12)
- **Intent**: Optimize daily reports frontend UI/UX page performance, responsiveness, and memory caching.
- **Outcome**: Added error handlers and 30s timeout in `compressImage` to prevent HEIC uploads from hanging. Memoized `CustomPickersDay` outside DailyReportPage and passed scope variables via `slotProps.day` to optimize calendar rendering. Pre-calculated `dueDateEpoch` in `processedTasks` for numeric sort comparison. Separated `getAdvanceRequests` into its own React Query hook with midnight staleTime, searching in-memory for date queries. Narrowed query invalidations on submit/sync to specific keys to prevent full cache resets.
- **Friction**: MUI's `PickersDayProps` Generic typing requirements, resolved by using non-generic signature and casting component inside DatePicker slots.
- **Lesson**: Sub-components declared inside a React parent component are recreated on every render, causing full unmounts and severe performance lag in components like DatePicker. Always define sub-components at the file scope and pass context via `slotProps`.

## Session: session_033_merge_harness (2026-06-15)
- **Intent**: Perform harness migration according to `Implement/09_migration.md` top to bottom, updating CLAUDE.md, AGENTS.md, scripts, skills, and configuration files, and rebuilding indexes.
- **Outcome**: Overwrote main harness configurations (CLAUDE.md, AGENTS.md, CODING_FAILURE_PATTERNS.md, etc.) using files from Codeing_harness_killer-main, updated skills and platform config, and ran all indexers (backlink_analyzer, symbol_indexer, code_graph, rule_indexer, repo_map_check, session_indexer) to ensure complete harness sync. No project source files in `src/` were modified.
- **Friction**: Windows command line encoding issues (charmap cp874) when Python opened UTF-8 index files, resolved by passing explicit `encoding='utf-8'` and running indexers with `PYTHONUTF8=1` environment variable.
- **Lesson**: On Windows systems with non-US locale, python commands that read/write JSON files must always use `utf-8` encoding to prevent encoding decode errors.

## Session: session_034_user_manual (2026-06-15)
- **Intent**: Build a comprehensive, premium user manual (in `frontend/public/doc/manual/`) for the LMS, add a "คู่มือการใช้งาน" button on the login page, fix a Firestore date render crash in `/workspace`, and create a Playwright screenshot automation script (`scripts/capture_manual.py`) to capture and embed real screenshots.
- **Outcome**: Created the user manual structure with 4 HTML pages and a responsive print-to-PDF stylesheet. Modified the login page layout to add the manual button. Implemented a robust `parseSafeDate` utility in `/workspace` pages to prevent React Error #31 crash. Created the Playwright automation script to handle automated login for each role and successfully captured and embedded all 8 screenshots. Reconciled all indexes successfully.
- **Friction**: Windows CP874 charset encoding crashed print statements in rule_indexer.py and index_reconcile.py due to Unicode characters like `·` and `→`. Resolved by editing the python scripts to print standard ascii characters. Playwright `networkidle` hung due to Firebase WebSocket connection, resolved by waiting for `load` state.
- **Lesson**: Playwright `wait_for_load_state("networkidle")` will hang indefinitely on real-time web applications with persistent connections; use `"load"` or target selector checks. Ensure Python print statements only use ascii or configure encoding to prevent terminal CP874 crashes on Windows.

## Session: session_036_logout_locale_fix (2026-06-16)
- **Intent**: Fix the logout freeze and synchronize locale subpath routing with translation language in the frontend.
- **Outcome**: Modified `handleLogout` in `Layout.tsx` to make the logout API call non-blocking, clear `authToken` and `user` from localStorage, and sign out from Firebase. Modified `_app.tsx` to include a `useEffect` that listens to `router.locale` and invokes `i18n.changeLanguage(router.locale)` to sync translations dynamically.
- **Friction**: Pre-existing ESLint `no-empty` warning in `Layout.tsx` heartbeat function threw a compile error during the build, which was fixed by inserting a comment block inside the catch block.
- **Lesson**: Blocking API requests (`await fetch`) during logout will freeze the UI if the backend is unreachable or times out. Non-blocking/fire-and-forget is safer for analytical and session logging requests. Next.js router locale does not automatically sync with react-i18next unless explicitly triggered on locale changes.

## Session: session_037_t024_suspended (2026-06-16)
- **Intent**: T-024: ซ่อนข้อมูลการเงิน DC และเมนูกฏเกณฑ์ประกันสังคม และเพิ่มสถิติขาดลามาสายในระบบนำเข้าและฟอร์มแมนนวล
- **Outcome**: Suspended due to topic switch to database read/write and resource optimization.
- **Friction**: None.
- **Lesson**: None.

## Session: session_038_wage_calculation_db_opt (2026-06-16)
- **Intent**: Optimize database resource utilization (reads/writes) during the wage calculation process at /wage-calculation.
- **Outcome**: Successfully resolved N+1 subcollection queries in `WagePeriodService` by implementing `getCompensationDetailsBulk` using a Firestore `collectionGroup` query chunked in batches of 30, reducing reads by up to 97%. Implemented a dirty check in `WorkVerificationService` to only write daily report updates if the verification status actually changed, and added a write counter check to prevent empty batch commit errors.
- **Friction**: TypeScript compiler errors due to missing type casting on DailyReportEntry fields (verificationStatus), resolved by casting to `any`.
- **Lesson**: Subcollection queries on a large list of parent documents should be chunked using Collection Group queries with the `in` operator to avoid performance degradation and high read fees. Always check for empty batches before calling `batch.commit()` in Firestore.

## Session: session_039_wage_period_list_projection (2026-06-16)
- **Intent**: Resolve the 5.67s latency in the wage period list query (`GET /api/wage-periods`).
- **Outcome**: Added query projection support to `BaseCrudService.ts` and defined `WAGE_PERIOD_LIST_PROJECTION` in `WagePeriodService.ts` to exclude the heavy `dcSummaries` nested array in list queries (`getAll`, `getByProject`, `getByStatus`), returning it only on single-period detail requests (`getById`).
- **Friction**: None.
- **Lesson**: In Firestore, deep nested arrays (like summaries of all contractors) lead to extremely high document sizes. For list queries, always project out these heavy sub-structures to avoid high serialization overhead and query latency, even if the final payload is cached (304 Not Modified) on the client side.

## Session: session_007 (2026-06-16)
- **Intent**: Optimize wage period list query latency by adding Firestore query projection.
- **Outcome**: Added query projection to BaseCrudService and defined projection rules in WagePeriodService to omit heavy dcSummaries in list fetches, reducing load time from 5.67s to sub-seconds.
- **Friction**: None.
- **Lesson**: Large nested arrays in Firestore documents significantly slow down list API performance; project them out for list queries.

## Session: session_008 (2026-06-16)
- **Intent**: Analyze and optimize resource management and database read/writes for /scan-data-monitoring.
- **Outcome**: Implemented a 500ms debounce on the employee search filter in the frontend index.tsx to prevent keystroke query floods. Cleaned up deprecated edit/delete methods and Dialogs from both frontend and backend to eliminate dead code.
- **Friction**: Unused private method mergePunchesWithOriginalSeconds caused a TS6133 compilation error on build, resolved by removing the method.
- **Lesson**: Deleting public/exposed methods can render private helper methods unused; always run compile checks to catch unused TS declaration errors.

## Session: session_010 (2026-06-16)
- **Intent**: Verify resolution of GCP Cloud Function trigger status overwrite bug.
- **Outcome**: Explained GCP trigger and timezone classification logic to user, verified fix locally, and prepared the session for close.
- **Friction**: None.
- **Lesson**: Closing sessions where no code was modified requires cleanly documenting the verification outcomes without empty changesets.

## Session: session_011 (2026-06-16)
- **Intent**: Optimize database resource utilization (reads/writes) and query fetching on `/work-hour-monitoring`, and remove manual scan/hour editing features.
- **Outcome**: Added `isFirstSnapshot` guard inside the triggers `useEffect` listener in `index.tsx` to stop duplicate mount query invalidations. Added `staleTime: 300000` to `wagePeriods` and `dc-stats` queries. Removed all manual resolve/scan-editing states, panels, Dialog elements, and mutations from the frontend table component, and removed endpoints `/resolve-manual` and `/update-scan` and service methods from the backend.
- **Friction**: Chunk replacement inside the multi-replace tool missed the `updateScanMutation` because `resolveMutation` was deleted beforehand, changing target content match slightly. Resolved by targeting it in a separate edit run.
- **Lesson**: Firestore `onSnapshot` listener callback fires an initial snapshot containing all existing documents immediately on subscription. Track whether it is the first callback call (`isFirstSnapshot`) to prevent duplicate query invalidations on mount or dependency changes.

