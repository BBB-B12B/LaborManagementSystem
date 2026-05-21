# INVARIANTS.md — Hard Constraints for This Codebase

> These rules apply to ALL agents and ALL sessions. No exceptions.
> Source of truth for destructive-action gates. CLAUDE.md + AGENTS.md reference this file.

---

## I1 · Destructive Action Gate

Before executing any action below → emit gate and WAIT for user confirmation.

| Action | Why |
|---|---|
| Delete or overwrite any file in `backend/src/`, `frontend/src/`, `firebase/`, or `knowledge/` | Irreversible without git |
| Any edit to Firestore security rules (`firebase/firestore.rules`) or indexes (`firebase/firestore.indexes.json`) | Altering global db security policy or indexing |
| Batch operations affecting >5 files at once | Hard to audit and roll back |
| Any action outside current roadmap task scope | Scope creep risk |

Gate format — emit and pause:
```
[gate] Action: `<what>` · Scope: `<files/tables affected>` · Risk: `<why>` · Waiting: confirm
```
Do NOT proceed until user confirms.

---

## I2 · Firebase / Firestore Hard Stop

**Any trigger below = HALT immediately. Do NOT touch anything until user says "yes" explicitly.**

Triggers (any one is enough):
- Direct modification to Firestore Rules or Firestore Indexes in `firebase/`
- Major schema or interface changes to global models under `backend/src/models/` or `frontend/src/types/`
- Overwriting production/emulator Firestore collection data in bulk

Gate — emit and WAIT before any tool call:
```
[db-gate] File: `<path>` · Change: `<what will change>`
          DB impact: `<collections affected>` · Data risk: `<what could break>`
          → Waiting for explicit "yes" — NOT proceeding until confirmed
```

On user confirm → proceed (still subject to I1 gate).
On unclear or no response → treat as deny. Re-state impact and ask again.

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
| `firebase/firestore.rules` | PROTECTED | I2 Hard Stop |
| `firebase/firestore.indexes.json` | PROTECTED | I2 Hard Stop |
| `knowledge/` | PROTECTED | I1 Gate required |
| `backend/src/` | GUARDED | I1 Gate for delete/overwrite |
| `frontend/src/` | GUARDED | I1 Gate for delete/overwrite |
| `.agents/` | GUARDED | I1 Gate for structural changes |
| `.sessions/` | GUARDED | Never delete manually — session state + mece_plan.md persists across chat resets |
