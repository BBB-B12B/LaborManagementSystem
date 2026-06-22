# MECE Plan — T-038 Lock app to light color-scheme (dark-browser-theme fix)
date: 2026-06-22
task: Fix unreadable text/UI on dark-theme browsers by locking app to light color-scheme
skill: frontend-design

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [X] B1: boot probe run · SESSION_TOTAL=0 · CHAT_TOTAL=22631 · CFP_COUNT=37
- [X] B2-B3: skill=frontend-design · topic-switch from reconciliation acknowledged
- [X] C0-C3: routing confirmed · topic switch handled (new task)
→ TOKEN CHECK: SESSION_TOTAL ~0k

## Phase 1 — Info Gather
- [X] Root cause found: globals.css:25-29 dark color-scheme boilerplate. See gather_complete.md.

## Phase 2 — MECE Plan
- [X] Plan confirmed by user: lock to light theme permanently (chose over building full dark theme).

## Phase 3 — Execution
- [X] S1: Edit frontend/src/styles/globals.css — replace dark media query with `html { color-scheme: light; }`
      Tool: Edit · Avoid: adding meta theme-color changes (out of scope)
      Verify-1: grep "color-scheme: light" globals.css returns 1 match
      Verify-2: grep "prefers-color-scheme" globals.css returns 0 matches

- [X] S2: Fix logout hang (issue #3) — Layout.tsx handleLogout: `await auth.signOut()` can block
      the redirect. Wrap in Promise.race timeout so window.location.replace('/login') always fires.
      Tool: Edit · Avoid: removing signOut entirely (still want Firebase session cleared when possible)
      Verify-1: grep "Promise.race" Layout.tsx returns >=1 match
      Verify-2: window.location.replace('/login') still present after the signOut block

## Notes (issue #2 — flicker)
- Auth flicker fix (T-205) already in working tree (authStore/_app/client) but UNCOMMITTED on `integration`.
- Production deploys only on push to `main`. Fix never shipped -> prod still flickers. No code change needed.
- User will commit + push themselves. Do NOT commit/push.

## Phase 3 Close Checklist
- [ ] Verify-N pass · [ ] active_thread phase:done · [ ] roadmap T-038 [X]

## compact_checkpoint
N/A (2 sections)
