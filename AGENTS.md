# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the Express API in TypeScript; `controllers/`, `services/`, `models/`, `routes/`, `api/`, and `utils/` keep transport, business, data, and helpers separated, with `src/index.ts` as the bootstrapper.
- `frontend/` is the Next.js app; `src/components/`, `pages/`, `store/`, `services/`, `hooks/`, and `validation/` cover UI, routing, state, network, and schema logic. Styling lives in `styles/` plus `theme/`; localization files sit in `i18n/`.
- `firebase/` defines the emulator suite, while `docs/` and `specs/` hold product briefs. Use `docker-compose.yml` when you need a multi-service dev stack.

## Build, Test, and Development Commands
- Backend: `npm install`, `npm run dev` for hot reload, `npm run build && npm run start` for compiled output, and `npm run lint`, `npm run format`, `npm run type-check` before pushing.
- Frontend: `npm install`, `npm run dev`, `npm run build && npm run start`, plus `npm run lint`, `npm run format`, and `npm run type-check`. Run `npm run e2e` for Playwright. Use `docker compose up --build` to exercise everything together.

## Coding Style & Naming Conventions
- ESLint (`eslint:recommended`, `@typescript-eslint`, `next/core-web-vitals`) and Prettier enforce 2-space indentation, 100-character lines, semicolons, single quotes, and `arrowParens: "always"`.
- Prefer PascalCase for components and classes, camelCase for functions and variables, kebab-case file names in React feature folders, and UPPER_SNAKE_CASE for env keys. Lean on shared DTOs under `types/` rather than `any`.

## Testing Guidelines
- Vitest drives unit and integration coverage in both packages; colocate specs as `*.test.ts` or `*.spec.ts`. Frontend assertions pair Vitest with `@testing-library/react`; backend HTTP flows should use `supertest`.
- Guard regressions with `npm run test:coverage`. During iteration, use `npm run test:watch` (backend) or `npm run test:ui` (frontend). Run Playwright suites whenever UI or flow changes land.

## Commit & Pull Request Guidelines
- History only shows the template seed, so adopt imperative, scoped messages (`feat(auth): add MFA enrollment`), link issue IDs, and keep commits review-sized.
- Pull requests must outline intent, list risky changes, link specs or tickets, attach screenshots or API samples for UI/API updates, and mention new env keys. Loop in both backend and frontend reviewers when changes span packages.

## Security & Configuration Tips
- Derive `.env` files from each `.env.example`, store secrets outside Git, and rotate Firebase or Cloudflare keys after sharing. When Docker environments drift, prune the `firebase_data` volume before restarting the emulator.

---

<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **LaborManagementSystem** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md`** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); [ "$phase" != "in_progress" ] && printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill_name
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files
```

- B1 auto-resets SESSION_TOTAL to 0 when phase ≠ in_progress
- If SESSION_TOTAL > 60k → warn user before proceeding

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: <name> · Sections: <N> · Tokens: ~<N>k`

---

## Per-Turn Routing (every user message)

| Situation | Action |
|---|---|
| User asks to fix a bug | Re-route → `editor` |
| User says "ปิด session" | Re-route → `session_manager` |
| User asks to create a new file | Re-route → `coder` |
| Same task type | Stay on current skill |

**Same session ≠ same skill. Always check intent → re-read SKILL.md if skill changes.**

---

## Loop Architecture

| Phase | What happens |
|---|---|
| 1 Info Gather | Repeat: identify missing context → R5 index-first → assess → emit [✓ gather] |
| 2 MECE Plan | Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap |
| 3 Execution | REACT LOOP: Select → Execute → Observe → Verify → Decide |

Completion Gate:
```
□ All sections executed  □ Writes [✓ written]  □ R8 Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"src/path/to/file.tsx"' knowledge/index_files.json
```
Check `backlinks[]` — every file listed imports the file you are about to edit. Update all of them.
→ Full dependency rules: **REPO_MAP.md** · Gates: **INVARIANTS.md**

---

## Quick Reference

| Rule | Requirement |
|---|---|
| Token footer | Every response: `*(Session total: ~NNN tokens)*` |
| File reads | grep index first → emit [pre-read] → Read offset+limit=60 |
| Symbol edits | grep index_variables → check used_in → emit [pre-edit] |
| Destructive actions | INVARIANTS.md §I1 — emit [gate] and wait confirm |
| DB changes | INVARIANTS.md §I2 — emit [db-gate] and HALT |
| Error protocol | R9: error_index → symbol_index → file_index (all 3 in order) |
| Roadmap | Every task logged before execution. `[ ]` → `[/]` → `[X]` |
| Manual close | "ปิด/close/done" → route `session_manager` §3 — 5 file writes + SESSION_TOTAL reset to 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

---

## Sub-agent Rules (R4)

| Pattern | When to use |
|---|---|
| Explore | scope ≥ 5 files / ≥ 300 lines → summary only |
| Execution | section > 8 steps + isolated output → structured result |
| Parallel fan-out | ≥ 2 sections in same Cycle → spawn simultaneously → write `.sessions/cycle_N_*.json` |
| Cycle transition | All sections in Cycle N done → read results → inject as context → spawn Cycle N+1 |

**Limits:** Max depth = 1 · Output must be structured (write `.sessions/cycle_N_<id>.json`) · Tokens count toward SESSION_TOTAL
**Before spawning:** emit `**[cycle N]** <spawn_tool> [<A>,<B>] → .sessions/cycle_N_*.json · depends-on: <none | cycle_N-1>`
**Platform:** read `.agents/platform/detected.md` for spawn_tool · if `platform: unknown` → run B4 probe first
**HALT rule:** Any section in Cycle N blocked → do NOT spawn Cycle N+1 → session_manager BLOCKED flow
**Full rules:** `CLAUDE.md §R4`

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + DB hard stop (I2) + symbol check (I4) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes (CFP-001+) |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

- **Database Constraints**: Firebase Firestore is used for persistence. Avoid raw queries or schema modifications outside migration/seed frameworks.
- **Frontend State**: Zustand is used for core global client states. Ensure hook consumption is direct.
- **Form validation**: Always use Zod schemas coupled with React Hook Form.
<!-- END:agent-orientation -->
