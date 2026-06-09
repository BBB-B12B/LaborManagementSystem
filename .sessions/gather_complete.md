# Info Gather Complete — T-012-009-14

## Objective
Update the Quick Subtask creation popup and Edit Subtask modal Assignee dropdown to fetch and display both FM and SE roles.

## Constraints
- Perform fetches in parallel to minimize latency.
- Allow both `roleId === 'FM'` and `roleId === 'SE'` in assignee filtering.
- Keep sorting and other properties intact.

## Affected Files
- `frontend/src/pages/workspace/index.tsx`

## Acceptance Criteria
- Quick Subtask and Edit Subtask dropdown shows both FM and SE users.
- Subtask creation and edit logic continues working seamlessly.
