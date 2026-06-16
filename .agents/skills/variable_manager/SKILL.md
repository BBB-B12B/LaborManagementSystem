---
name: Variable Index Manager
description: Tracks variable, function, and component definitions and usage in knowledge/index_variables.json.
  triggers:
    - "track variable"
    - "index symbol"
    - "update variable"
    - "symbol renamed"
    - "add to index"
    - "ลงทะเบียน variable"
    - "อัพเดต index"
---

## Sections
```
- id: 1
  name: "Symbol Sync"
  steps: ["check skip conditions", "update index_variables.json", "run symbol_indexer.py", "update used_in links", "[✓ written] verify"]
```

# Variable Index Manager

## Trigger
Run when a symbol has (or will have) cross-file dependency — another file imports, calls, or extends it.
Single-file-only symbols (private helpers, inline constants) → skip unless renamed or deleted.
Called by coder or editor after their section completes.

Change types that trigger indexing:
1. **Creation** — new symbol that other files will import/call (components, exported functions, hooks, shared types, API handlers). Skip: private helpers used only in their own file.
2. **Body Edit** — code change to existing symbol with used_in[] ≥1 → run symbol_indexer.py (line drift breaks lookups). Skip: internal-only symbol with no cross-file consumers.
3. **Usage Link** — symbol first imported/called from a new file → append to used_in[]. Most common trigger.
4. **Rename** — update JSON key AND trace used_in to rename call sites via editor. Always run — rename without index update = broken lookups.
5. **Deletion** — remove from JSON entirely. Always run — stale entries mislead pre-debug grep.

## When NOT to Use
- Symbol is used only within its own file (no cross-file dependency) → skip variable_manager · inline comment is sufficient
- Task is a read-only lookup (grep, find, audit) → no index write needed · do not invoke
- Symbol is in `src/db/` schema types → R15 DB gate applies first · emit `[db-gate]` before indexing
- Caller wants to rename across all files → delegate `editor` + `variable_manager` together · variable_manager indexes, it does not rename

## Operating Stance
- Index accuracy over speed. A stale or wrong entry in `index_variables.json` breaks every future grep that relies on it — write nothing rather than write wrong.
- Minimal write discipline. Only update the fields that changed. Do not rewrite the full symbol entry to "clean it up" — that destroys audit trail.
- Caller-driven, not self-initiated. variable_manager never decides what to index on its own — it receives a symbol + change type from the caller and executes exactly that.
- Cross-file dependency gate. Skip indexing entirely when a symbol has no cross-file usage — adding noise to the index degrades every consumer that reads it.

## Prerequisites
Refuse without all — emit `[vm-refused] reason:<X>` and halt.

- [ ] Symbol name provided by caller
      → Why: cannot index an unnamed symbol — index key = symbol name
      → Missing: emit `[vm-refused] reason:no-symbol` · halt
- [ ] Change type identified (create · edit · link · rename · delete)
      → Why: wrong change type writes the wrong index entry
      → Missing: emit `[vm-refused] reason:no-change-type` · halt
- [ ] `knowledge/index_variables.json` readable
      → Why: must read existing entry before overwrite to avoid corrupt state
      → Missing: emit `[vm-refused] reason:index-unreadable` · halt

## Refusal Contract
Skip entirely (emit `[symbol-index-skip]`) if:
- No symbol was created, renamed, deleted, or body-edited this task
- index_variables.json entry already correct with no used_in changes

HALT (emit `[symbol-index-halt]`) if:
- `python scripts/symbol_indexer.py` is missing or fails → report before proceeding
- Rename detected but used_in list not available → cannot safely rename call sites

## Workflow (ordered steps)
1. Identify change type: create · edit · usage-link · rename · delete
2. Apply to index_variables.json:
   - create → add entry: `{type, file, line, signature, used_in: [], last_modified, task}`
     - `signature`: function/type signature string (e.g. `"function login(email: string): Promise<User>"`)
     - `last_modified`: today's date (YYYY-MM-DD)
     - `used_in[]`: files that import/call this symbol — fill what is known at creation
   - edit → run `python scripts/symbol_indexer.py` (refreshes line numbers) · update `last_modified`
   - usage-link → append new location to `used_in[]`
   - rename → update JSON key + trace all `used_in` files via editor skill
   - delete → erase entry from JSON
3. Run `python scripts/symbol_indexer.py` to sync lookup index — ALL change types (not just edit), per Behavior Contract L89
4. Verify: `grep -c '"<symbol-name>"' knowledge/index_variables.json` → ≥1 (add) or 0 (delete)
5. Emit `[✓ written]` with symbol name + action taken

## Output Contract
Emit before returning: `[symbol-index] action: <create|edit|link|rename|delete|skip> · symbol: <name> · used_in: <N>`

**Behavior Contract — Symbol-Return (fires before returning to any calling skill):**
```
Pre:    variable_manager section complete · about to return to coder/editor
Contract: MUST run python scripts/symbol_indexer.py to sync lookup index after JSON update
          MUST emit [symbol-index] action: · symbol: · used_in: before any return signal
          Rename: MUST note old_name + new_name in [symbol-index] emit
          skip write → [violation] BC-symbol-return → write entry + run indexer → re-emit [symbol-index] · then return
Post:   index_variables.json updated · symbol_indexer.py run · [symbol-index] emitted
Enforce: return to caller without [symbol-index] emitted = [violation] BC-symbol-return → write index + emit now
```

## Tone Guide

Emit messages (during execution):
Keep:   `[symbol-index]` · `[vm-refused]` + reason · `[pre-edit]` + symbol name
Strip:  internal deliberation · "I'll now update the index..." preamble
Format: `[signal] Symbol: <name> · Action: <type> · File: <path>` — single line
Prohibited: "I've updated your index" · "I went ahead and added..." · "Let me index this for you"

## Routing
→ Return to calling skill (coder or editor) after emit.
Context Gate: new hard constraint → add to INVARIANTS.md §I2 before returning.

## Hard Rules
- Never write to `index_variables.json` without reading the existing entry first — overwrite without read = silent data loss.
- Never index a symbol that has no cross-file dependency — single-file symbols add noise that breaks grep accuracy.
- Never accept a rename request without also calling `editor` — variable_manager indexes the rename, it does not perform it.
- Never emit `[symbol-index]` before the write is verified — grep confirm required after every index update.
- Never run without a change type (create/edit/link/rename/delete) — ambiguous type = wrong entry written.
- Never skip `[vm-refused]` when a prerequisite is missing — partial execution with incomplete inputs corrupts the index.

## MECE Constraints Block (copy into mece_plan.md for sections using `variable_manager`)
```
- Always called AFTER coder/editor completes — never before src/ edits
- python scripts/symbol_indexer.py MUST run to sync lookup index after JSON update
- Rename: update JSON key AND emit [symbol-index] with old_name + new_name noted
- [symbol-index] emit required before returning to calling skill
- used_in[]: symbol_indexer.py output is authoritative — manual seed at create/usage-link is OK; the script validates/corrects
```
