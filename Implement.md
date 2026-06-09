# Harness Bootstrap — Agent Instruction

> **Paste this file to your agent as the first message when setting up a new project.**
> The agent will execute all setup steps end-to-end without further prompting.

---

## Your Task

You are setting up the Harness Agent system for this project. Execute all steps below in order. Do not skip any step. Report progress after each major phase.

---

## Phase 0 — Detect Project Type

Run these probes first:

```bash
ls package.json requirements.txt Cargo.toml go.mod pyproject.toml 2>/dev/null
ls src/ app/ lib/ 2>/dev/null | head -5
```

- Has existing source code → **Track B**
- Empty / new project → **Track A**
- Has `.agents/` directory already → **Track C (upgrade)**

---

## Phase 1 — Read Setup Instructions

Read these files in order before writing anything:

1. `Implement/01_overview.md` — understand directory structure + index schemas
2. `Implement/02_setup.md` — find your track (A / B / C) and follow its steps
3. `Implement/03_config.md` — templates for CLAUDE.md, AGENTS.md, INVARIANTS.md, REPO_MAP.md

---

## Phase 2 — Execute Setup (follow your track)

### Track A — Fresh Project
1. Write `CLAUDE.md` from `03_config.md` template (adjust token thresholds to your model)
2. Write `AGENTS.md` from `03_config.md` template
3. Write `INVARIANTS.md` from `03_config.md` template
4. Write `REPO_MAP.md` — document your project structure
5. Create `.agents/skills/` — write all 10 SKILL.md files from `Implement/04_skills.md`
6. Create `scripts/` — write `symbol_indexer.py` from `Implement/05_scripts.md`
7. Run Platform Probe → write `.agents/platform/detected.md` (see §Model Tiers below)
8. Bootstrap `.sessions/` → run `python3 scripts/bootstrap_sessions.py`

### Track B — Existing Project
Same as Track A, but run auto-discovery first:
- Scan `src/` / `app/` / `lib/` → write `REPO_MAP.md` from actual structure
- Detect libraries (package.json / requirements.txt) → fill `AGENTS.md §Critical Rules`
- Infer `INVARIANTS.md §I2` rules from existing patterns

### Track C — Upgrade Existing Harness
Follow `Implement/09_migration.md` tracks M1 → M2 → M3 → M4 in order.

---

## Phase 3 — Configure Model Tiers (MANDATORY)

After writing `detected.md`, fill in the model tier fields:

```
model_high:   <your most capable model>    # MECE plan, Phase 3 execution, reasoning
model_medium: <your mid-tier model>        # analysis, structured output
model_low:    <your fastest/cheapest model> # lookup, grep, Reviewer, read-only tasks
```

**Provider presets** (choose one or customize):

| Provider | model_high | model_medium | model_low |
|---|---|---|---|
| Anthropic | claude-sonnet-4-6 | claude-haiku-4-5 | claude-haiku-4-5 |
| Google | gemini-2.0-pro | gemini-2.0-flash | gemini-2.0-flash-lite |
| OpenAI | gpt-4o | gpt-4o-mini | gpt-4o-mini |

Ask the user which provider they are using if not already known. Write the actual model IDs (not tier names) into `detected.md`.

---

## Phase 4 — Verify Installation

1. Read `Implement/08_checklist.md`
2. Run through all 22 required-file checks
3. Fix any gaps before reporting done
4. Run `python3 scripts/session_compactor.py --verbose` → must print `STATUS: OK`

---

## Phase 5 — Report to User

When all checks pass, report:

```
Setup complete ✅
Track: <A|B|C>
Provider: <name>  Model tiers: HIGH=<model> / MEDIUM=<model> / LOW=<model>
Files created: <N>
Checklist: <N>/22 passed
Ready: type any task to begin
```

---

## Rules During Setup

- Do NOT edit `src/` — setup touches only harness files (`.agents/`, `scripts/`, `docs/`, `knowledge/`, `.sessions/`)
- Do NOT skip Phase 3 (model tiers) — harness cannot spawn correctly without it
- If a template requires project-specific values (DB tables, API routes, etc.) → ask user once, fill all at once
- After writing each config file → grep key field to verify write succeeded
- On any error → report what failed + what you tried → ask user before retrying destructive actions
