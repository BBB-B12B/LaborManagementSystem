# CODING_FAILURE_PATTERNS.md — Known Agent Failure Modes

> Each pattern: what happened, why it broke, how to prevent it.
> Add new patterns after post-mortems. Never delete entries.

---

## CFP-001 · TypeScript Type Edit Without index_variables Check → DB Corruption

**Symptom:** Agent fixes a TypeScript type error in `src/db/schema.ts` or a related interface.
Drizzle migration generates wrong column name / column disappears. Data corrupted or queries return null.

**Root cause:**
- Agent sees a TS type mismatch and "fixes" it by renaming a field
- Does NOT check `knowledge/index_variables.json` for `used_in` dependents
- Does NOT check if the symbol has type `DrizzleSchema` or `DBColumn`
- Drizzle derives DB column names directly from TypeScript field names → rename = column rename in DB

**Failure chain:**
```
TS type rename → Drizzle migration generates ALTER TABLE → column renamed in D1
→ existing queries reference old column name → runtime 500 errors
→ data not lost but queries all fail until rollback
```

**Prevention:**
1. Before any edit to a type/interface → run `grep -A 8 '"TypeName"' knowledge/index_variables.json`
2. If `"type": "DrizzleSchema"` or `"DBColumn"` → trigger I2 Hard Stop (INVARIANTS.md)
3. Never rename a Drizzle schema field without explicit DB migration plan

**Detection signal:**
- Symbol appears in `index_variables.json` with type `DrizzleSchema`, `DBColumn`, or `DBTable`
- File path contains `src/db/` or imports from `src/db/`

---

## CFP-002 · Batch Edit Without Backlink Check → Broken Imports

**Symptom:** Agent renames or moves a file in `src/lib/` or `src/components/`. Other files that import it break silently (TypeScript may catch it, but only at build time).

**Root cause:**
- Agent uses "rename symbol" or moves file without checking `knowledge/index_files.json` backlinks
- Assumes nothing imports the file because it looks like a leaf node

**Prevention:**
1. Before renaming/moving any file → `grep -A 5 '"<filepath>"' knowledge/index_files.json`
2. If `"backlinks"` array is non-empty → update all importers or use IDE rename (which follows imports)
3. Run `tsc --noEmit` after any rename to catch broken imports before commit

---

## CFP-003 · Session Without Boot → Stale Index Used

**Symptom:** Agent references a symbol or file path from a previous session. The file was renamed or deleted since then. Agent proceeds with stale path, creating orphan code.

**Root cause:**
- Agent skips Boot sequence or reads index from memory rather than disk
- `knowledge/index_variables.json` not refreshed after previous session's edits

**Prevention:**
1. Always run Boot sequence: read `knowledge/index_files.json` header for last-updated timestamp
2. If timestamp >1 session old → run `python scripts/symbol_indexer.py` before editing
3. Never trust in-memory symbol locations — always grep live file

---

## CFP-004 · token_auditor Self-Healing Without Gate → Uncontrolled SKILL.md Modification

**Symptom:** Agent runs token_auditor after SESSION_TOTAL > 60k and writes a new rule directly into a skill's SKILL.md without user confirmation, permanently altering agent behavior for all future sessions.

**Root cause:**
- token_auditor `Self-Healing` action had no gate requiring user confirmation before SKILL.md write
- Agent config files treated as regular editable files with no protection

**Prevention:**
1. token_auditor must emit `[gate] token_auditor: inject rule into <skill>/SKILL.md — confirm? y/n` before any SKILL.md write
2. Wait for explicit user confirm → then inject
3. Log injection in `docs/optimization_logs.md`

---

## CFP-005 · mece_plan.md Overwritten Without Backup → In-Progress Plan Lost

**Symptom:** Agent receives a new task mid-session, triggering Phase 2. New `.sessions/mece_plan.md` overwrites the in-progress plan. Previously planned sections (DoD + Est) are lost; pending sections orphaned.

**Root cause:**
- Per-Turn skill change = new task → Phases 1–2 re-run → new mece_plan.md written with no backup
- No check for existing pending sections before overwrite

**Prevention:**
1. Before any mece_plan.md write: check for pending `[ ]` or `[/]` sections
2. If found: save existing to `.sessions/mece_plan_prev.md` first
3. Then write new plan

---

## CFP-006 · CLAUDE.th.md Rule-Number Mismatch → Agent Follows Wrong Rule

**Symptom:** User cites a rule number from CLAUDE.th.md; agent applies CLAUDE.md's rule at that number instead — which is a different rule. Operations run with wrong constraints (e.g., user says "R4" meaning Index-First Lookup but agent executes Sub-agent Decision).

**Root cause:**
- CLAUDE.th.md had misaligned R-numbers (shifted from R4 onward vs. CLAUDE.md canonical numbering)
- Agent always uses CLAUDE.md numbering; user used Thai doc numbering

**Detection signal:**
- User mentions R-number > R3 and described behavior doesn't match that rule in CLAUDE.md
- CLAUDE.th.md was last updated before 2025-05

**Prevention:**
1. Keep CLAUDE.th.md R-numbers in strict sync with CLAUDE.md after any renumbering
2. CLAUDE.th.md must carry `⚠️ R-numbers ที่แสดงด้านล่างตรงกับ CLAUDE.md ทุก rule` note at top
3. If user cites R-number and behavior seems mismatched: ask which doc they are reading

---

## CFP-007 · Deviation from mece_plan.md Checkbox Convention → Broken Phase 3 Tracking

**Symptom:** Agent writes `.sessions/mece_plan.md` using a custom or YAML-like list format (e.g. `- id: 1` or plain bullet points) instead of standard markdown checkbox format (`- [ ]`, `- [/]`, `- [X]`). The boot sequence script/parser (e.g., `grep -cE "^\- \[[ /]\]" .sessions/mece_plan.md`) fails to find pending tasks, causing tracking and token-gate logic to break.

**Root cause:**
- Agent designs the plan layout based on general markdown formatting instincts instead of strict checkbox constraints.
- Fails to check the `CLAUDE.md §Phase 3` and boot sequence script requirements before writing.

**Prevention:**
- Always structure the `## Sections` block in `.sessions/mece_plan.md` using the exact checkbox prefix: `- [ ] Section Name`.
- Ensure each section has indented `DoD:` and `Est:` properties.
- Update the checkbox status (`[ ]` → `[/]` → `[X]`) exactly when starting and completing sections.
