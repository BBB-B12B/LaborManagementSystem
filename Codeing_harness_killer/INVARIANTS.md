# INVARIANTS.md — Hard Constraints for This Codebase

> These rules apply to ALL agents and ALL sessions. No exceptions.
> Source of truth for destructive-action gates. CLAUDE.md + AGENTS.md reference this file.

---

## I1 · Destructive Action Gate

Before executing any action below → emit gate and WAIT for user confirmation.

| Action | Why |
|---|---|
| Delete or overwrite any file in `src/` or `knowledge/` | Irreversible without git |
| Any edit to files in `src/db/` | Changes DB structure or data shape |
| Change/rename/remove TypeScript type or interface with DB column fields | Drizzle derives schema from TS types — silent breakage |
| Any symbol in `index_variables.json` with type `DBTable`, `DBColumn`, or `DrizzleSchema` | Cascading data corruption |
| Batch operations affecting >5 files at once | Hard to audit and roll back |
| Any action outside current roadmap task scope | Scope creep risk |

Gate format — emit and pause:
```
[gate] Action: `<what>` · Scope: `<files/tables affected>` · Risk: `<why>` · Waiting: confirm
```
Do NOT proceed until user confirms.

---

## I2 · DB Structure Hard Stop

**Any trigger below = HALT immediately. Do NOT touch anything until user says "yes" explicitly.**

Triggers (any one is enough):
- Edit to any file in `src/db/` (schema, migration, seed, connection, queries)
- Rename, remove, or change TypeScript type/interface that has DB column fields
- Any symbol in `index_variables.json` with type `DBTable`, `DBColumn`, or `DrizzleSchema`
- Adding/removing columns, changing column types, altering table relationships

Gate — emit and WAIT before any tool call:
```
[db-gate] File: `<path>` · Symbol: `<name>` · Change: `<what will change>`
          DB impact: `<tables/columns affected>` · Data risk: `<what could break>`
          → Waiting for explicit "yes" — NOT proceeding until confirmed
```

On user confirm → proceed (still subject to I1 gate).
On unclear or no response → treat as deny. Re-state impact and ask again.

**"It's just a TypeScript type" is NOT an exemption.**
Drizzle derives DB schema from TypeScript types — a type rename silently breaks migrations and queries.

---

## I3 · Knowledge Index Sync

After any symbol create/delete/rename → MUST update both indexes before closing task:
- `knowledge/index_variables.json` — symbol entry + line numbers
- `knowledge/index_files.json` — backlinks

Run: `python scripts/symbol_indexer.py` to regenerate.

---

## I4 · Pre-Edit Symbol Check (Required)

Before editing any symbol that appears in `knowledge/index_variables.json`:

```bash
grep -A 8 '"SymbolName"' knowledge/index_variables.json   # check used_in array
```

Emit and log:
```
[pre-edit] Symbol: `<name>` · used_in: <N files> · safe to edit: <yes|needs review>
```

---

## I5 · Roadmap Entry Required

Every task (bug fix, feature, enhancement) must exist in `docs/master_roadmap.md` before execution.
Never duplicate task IDs. grep roadmap before creating.

---

## Protected Zones

| Path | Status | Rule |
|---|---|---|
| `src/db/` | PROTECTED | I2 Hard Stop |
| `db_migrations/` | PROTECTED | I2 Hard Stop — never edit manually; use Drizzle migration tooling only |
| `knowledge/` | PROTECTED | I1 Gate required |
| `src/` | GUARDED | I1 Gate for delete/overwrite |
| `.agents/` | GUARDED | I1 Gate for structural changes |
| `.sessions/` | GUARDED | Never delete manually — session state + mece_plan.md persists across chat resets |
