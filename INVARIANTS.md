# INVARIANTS.md — Destructive Action Gates

> Hard stops for this project. Every AI agent must check this file before any irreversible action.

---

## I1 · Destructive Action Gate

Before any of these actions → emit `[gate]` → ask user → wait for explicit "yes":

- Deleting files or directories
- Overwriting existing database data or bulk updating records
- Running `rm`, `drop`, `truncate`, or deletions without scoped where/filters
- `git reset --hard`, `git push --force`, `git checkout --`

---

## I2 · Hard Stop Rules

- **Database mutations**: DO NOT mutate Firestore database records manually in production scripts. Use the service classes under `backend/src/services/` or standard seeding/migration tasks.
- **Node.js APIs in Edge Runtime**: NO Node.js APIs in Edge Runtime environment if Next.js edge route is used. Use standard Web APIs.
- **Float representation**: NO float representation in fields expecting pure integers (e.g. employee count or timestamps) — always use Math.round().

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

## I5 · Roadmap Entry Required

Every task (bug fix, feature, enhancement) must exist in `docs/master_roadmap.md` before execution.
Never duplicate task IDs. grep roadmap before creating.

---

## Protected Zones

- `CLAUDE.md` · `AGENTS.md` · `INVARIANTS.md` — Agent system config files
- `docs/master_roadmap.md` — Task checklist ledger
- `knowledge/` — File and variables indexing directories
- `.sessions/` — Agent session execution states
- `firebase/` — Local Firebase emulator suites and configurations (never alter schemas without migration tooling)
