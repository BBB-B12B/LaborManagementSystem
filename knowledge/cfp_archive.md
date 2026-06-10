# CFP Archive — Oldest Entries (moved from CODING_FAILURE_PATTERNS.md)

> Archived: CFP-001–CFP-004 · Date: 2026-05-26 · Session: session_087
> These entries are permanent — never delete from this file.
> Active patterns remain in CODING_FAILURE_PATTERNS.md (max 15).

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
2. If `"imported_by"` array is non-empty → update all importers or use IDE rename (which follows imports)
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

## CFP-004 · Read Without Post-Read Verdict → Context Bloat

**What happened:** File was read to gather context. Content was not relevant to the current task section but remained in conversation history. When spawning a sub-agent, irrelevant content was included in `context_files:` or `cycle_context:`, bloating the prompt unnecessarily.

**Why it broke:** Pre-Read Gate (R5) only validates line-number efficiency (T1–T3 tiers). It has no step to verify content relevance after the read completes. Read results flowed directly into working memory without a verdict step.

**Prevention:**
- After every Read: emit `[post-read]` verdict (see CLAUDE.md R5)
- `irrelevant` → drop from context immediately, do not cite in `context_files:`
- `partial` → keep excerpt only, not full file content
- `relevant` → keep as-is
- At sub-agent spawn: run Context Trim (see `agent/SKILL.md` Delegation Contract)

---
