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

