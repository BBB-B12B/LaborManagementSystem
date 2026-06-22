task: Post-deploy fixes — dark-theme readability (#1), auth flicker (#2), logout hang (#3)
phase: in_progress
next: User to commit + push (integration → main triggers prod deploy). More UX/UI issues pending from user testing.

Done this session:
- #1 globals.css: locked color-scheme: light (dark-browser-theme readability)
- #3 Layout.tsx handleLogout: Promise.race timeout so signOut can't block redirect
- #2 flicker: NO code change needed — T-205 fix already in working tree, just uncommitted.
  Root cause of "still broken in prod" = fix never reached `main` (deploy branch).

Files changed (uncommitted, user will commit/push):
- frontend/src/styles/globals.css
- frontend/src/components/layout/Layout.tsx
- (already-present working-tree changes: authStore.ts, _app.tsx, client.ts = the #2 fix)
