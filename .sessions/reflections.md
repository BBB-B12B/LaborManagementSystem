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

