<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **Labor Management System** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md`** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

> This boot sequence mirrors **CLAUDE.md §Boot** exactly — if they ever differ, CLAUDE.md is authoritative.

```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill path · no match → default to 'editor' skill
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files into memory
```

- B1 auto-resets SESSION_TOTAL to 0 when phase ≠ in_progress
- If SESSION_TOTAL > 60k → warn user before proceeding
- B3 "context_files" = note paths in memory ONLY — do NOT read during Boot. Read in Phase 1.
- Boot ends after B3 — emit Reply line 1 immediately. No extra tool calls.

Reply line 1 — emit verbatim (**[Boot]** bold and `<name>` backtick required):
```
**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: `<name>` · Sections: <N> · Tokens: ~<N>k
```

---

## Per-Turn Routing (every user message)

> Table below mirrors **CLAUDE.md §Per-Turn Routing** — if they differ, CLAUDE.md wins.

| Situation | Action |
|---|---|
| User asks to fix a bug | Re-route → `editor` |
| User says "ปิด session" | Re-route → `session_manager` |
| User asks to create a new file | Re-route → `coder` |
| Same task type | Stay on current skill |

**Same session ≠ same skill.** Always check intent → re-read SKILL.md if skill changes.

---

## Loop Architecture

**Dual-Mode:** Phase 2 ALWAYS writes `.sessions/mece_plan.md`. Mode A (spawn) passes plan to sub-agents. Mode B (single model) loops as sub-agent in same session or resumes via Continuation Prompt in new chat.

| Phase | What happens |
|---|---|
| 1 Info Gather | Repeat: identify missing context → R5 index-first → assess → emit [✓ gather] |
| 2 MECE Plan | Build plan → **write `.sessions/mece_plan.md`** (sections + DoD + Est) → user confirms → roadmap |
| 3 Execution | REACT LOOP: **Mark Start** `[ ]`→`[/]` → Select → Execute → Observe → Verify → Token Gate → Decide (done: `[/]`→`[X]`) · See CLAUDE.md §Phase 3 for authoritative steps |

On resume: emit Reply line 1 FIRST → then check mece_plan.md for `[/]` or `[ ]` sections → skip Phase 1+2 → jump to Phase 3.

Completion Gate:
```
□ All sections executed  □ Writes [✓ written]  □ R8 Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"backend/src/path/to/file.ts"' knowledge/index_files.json
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
| Manual close | "ปิด / close / done / finish / wrap up / end session / จบงาน / จบ session" → route `session_manager` — writes: `active_thread.md` · `session_tokens.md` · `session_handoff.md` · session JSON · `master_roadmap.md` → SESSION_TOTAL: 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + DB hard stop (I2) + index sync (I3) + symbol check (I4) + roadmap gate (I5) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes — format: `## CFP-NNN: <title>` with sections **Trigger** / **Root cause** / **Fix** / **Prevention** |
| `TESTING.md` | Per-action verification matrix. **Load on-demand only** — when task involves API route, DB op, auth, CSV, or new component. |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

### 1. Project Structure & Module Organization
- `backend/` hosts the Express API in TypeScript; `controllers/`, `services/`, `models/`, `routes/`, `api/`, and `utils/` keep transport, business, data, and helpers separated, with `src/index.ts` as the bootstrapper.
- `frontend/` is the Next.js app; `src/components/`, `pages/`, `store/`, `services/`, `hooks/`, and `validation/` cover UI, routing, state, network, and schema logic. Styling lives in `styles/` plus `theme/`; localization files sit in `i18n/`.
- `firebase/` defines the emulator suite, while `docs/` and `specs/` hold product briefs. Use `docker-compose.yml` when you need a multi-service dev stack.

### 2. Build, Test, and Development Commands
- Backend: `npm install`, `npm run dev` for hot reload, `npm run build && npm run start` for compiled output, and `npm run lint`, `npm run format`, `npm run type-check` before pushing.
- Frontend: `npm install`, `npm run dev`, `npm run build && npm run start`, plus `npm run lint`, `npm run format`, and `npm run type-check`. Run `npm run e2e` for Playwright. Use `docker compose up --build` to exercise everything together.

### 3. Coding Style & Naming Conventions
- ESLint (`eslint:recommended`, `@typescript-eslint`, `next/core-web-vitals`) and Prettier enforce 2-space indentation, 100-character lines, semicolons, single quotes, and `arrowParens: "always"`.
- Prefer PascalCase for components and classes, camelCase for functions and variables, kebab-case file names in React feature folders, and UPPER_SNAKE_CASE for env keys. Lean on shared DTOs under `types/` rather than `any`.

### 4. Testing Guidelines
- Vitest drives unit and integration coverage in both packages; colocate specs as `*.test.ts` or `*.spec.ts`. Frontend assertions pair Vitest with `@testing-library/react`; backend HTTP flows should use `supertest`.
- Guard regressions with `npm run test:coverage`. During iteration, use `npm run test:watch` (backend) or `npm run test:ui` (frontend). Run Playwright suites whenever UI or flow changes land.

### 5. Commit & Pull Request Guidelines
- History only shows the template seed, so adopt imperative, scoped messages (`feat(auth): add MFA enrollment`), link issue IDs, and keep commits review-sized.
- Pull requests must outline intent, list risky changes, link specs or tickets, attach screenshots or API samples for UI/API updates, and mention new env keys. Loop in both backend and frontend reviewers when changes span packages.

### 6. Security & Configuration Tips
- Derive `.env` files from each `.env.example`, store secrets outside Git, and rotate Firebase or Cloudflare keys after sharing. When Docker environments drift, prune the `firebase_data` volume before restarting the emulator.
<!-- END:agent-orientation -->
