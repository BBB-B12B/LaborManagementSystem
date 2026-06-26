---
name: Index Manager
description: Maintains the two knowledge indices via a mode split. mode:symbol → index_variables.json (variable/function/component definitions + used_in). mode:file → index_files.json (file lifecycle + backlinks). Caller-driven, index-only.
triggers:
  - "index update"
  - "อัพเดต index"
  - "track variable"
  - "index symbol"
  - "update variable"
  - "symbol renamed"
  - "add to index"
  - "ลงทะเบียน variable"
  - "file created"
  - "file moved"
  - "file deleted"
  - "backlink sync"
  - "ไฟล์ใหม่"
activates_at: [post_coder, post_editor, post_harness_editor, manual]
---

## Sections
```
- id: 1
  name: "Index Update"
  steps: ["pick mode (router)", "check skip conditions", "update index JSON", "sync links (symbol: symbol_indexer.py · file: backlinks)", "[✓ written] verify"]
```

# Index Manager

Two indices, one skill, two modes. Pick the mode first (the router below — keyword-driven,
no inference), then follow that mode's block. The shared discipline applies to BOTH modes.

## Mode Router (keyword → mode · NO inference — a small model picks file-mode reliably)
| Caller input contains | mode | Index file |
|---|---|---|
| a FILE path + file event: created / moved / deleted / renamed / import-changed / backlink | **file** | `knowledge/index_files.json` |
| a SYMBOL name + change type: create / edit / usage-link / rename / delete (function·var·component·type·hook·handler) | **symbol** | `knowledge/index_variables.json` |

Rule: the input decides the mode — a file-path-event → `mode:file`; a named-symbol-event → `mode:symbol`.
Both at once (a new file that also exports a new cross-file symbol) → run `mode:file` first, then `mode:symbol`.
Ambiguous / neither present → emit `[index-refused] reason:no-mode` · halt (never guess).

## When NOT to Use (both modes)
- Read-only lookup (grep/find/audit) → no index write · do not invoke
- Session close / token reset → `session_manager §3`
- Conflict detection between `knowledge/` entries → `knowledge_conflict_checker.py` directly
- Bulk src/ restructure (>5 files) → `agent` orchestrates; index_manager handles per-file within it
- (symbol) symbol used only within its own file → skip · inline comment suffices
- (symbol) `src/db/` schema types → R15 DB gate first · emit `[db-gate]` before indexing
- (symbol) rename across files → delegate `editor` + index_manager together · it indexes, does not rename

## Operating Stance (both modes)
- **Index accuracy over speed.** A stale/wrong entry breaks every future grep that relies on it — write nothing rather than write wrong.
- **Atomic update or skip.** Partial update (entry added, links skipped) is worse than none — emit the mode's skip signal and return rather than write half a record.
- **Caller-driven, never self-initiated.** index_manager never discovers what changed — the caller passes the symbol/file + change type; it executes exactly that.
- **Minimal write.** Only update the fields that changed — never rewrite a full entry to "clean it up" (destroys audit trail).
- **Silent drift is the failure mode.** Always verify after write.

## Prerequisites (refuse without all — emit `[index-refused] reason:<X>` and halt)
- [ ] Mode resolved by the router (file | symbol) → Missing: `[index-refused] reason:no-mode`
- [ ] Target provided by caller — (file) changed file path · (symbol) symbol name + change type → Missing: `[index-refused] reason:no-target`
- [ ] The mode's index JSON readable — (file) `index_files.json` · (symbol) `index_variables.json` → Missing: `[index-refused] reason:index-unreadable`

**Soft prerequisite (NOT a refusal):** (file mode) if caller identity (coder/editor/harness_editor/manual) is unknown → do NOT refuse; proceed with a shallow backlink scan only.

## Refusal Contract
Skip entirely (emit `[index-skip] mode:<file|symbol>`) if:
- Nothing was created/moved/deleted/renamed/body-edited/usage-linked this task
- The entry is already correct (no link/backlink changes)

HALT (emit `[index-halt] mode:<...>`) if:
- The index JSON is missing/unreadable → report before proceeding
- (symbol) `scripts/symbol_indexer.py` missing or fails → report before proceeding
- (symbol) rename detected but `used_in[]` not available → cannot safely rename call sites

## Workflow (ordered · same 5-step arc both modes)
1. **Pick mode** via the router · **verify entry**: grep the mode's index for the target (targeted Read/grep — Never-Full-Load).
2. **Apply** the mode-specific change (see the mode block below).
3. **Sync links**: (symbol) run `python scripts/symbol_indexer.py` · (file) resolve `backlinks[]`.
4. **Confirm**: `grep -c` the target → ≥1 (add/update) or 0 (delete).
5. **Emit** `[✓ written]` + the mode's `[*-index]` signal (see Output Contract).

---

## mode: file  (floor = HAIKU · mechanical CRUD — keep this path inference-free)
Run after a file is created · moved · deleted · had imports changed. Caller passes the path(s).

**Apply (step 2):** add entry (with **size object: {bytes, lines}** — bytes = file size on disk · lines = line count) · update backlinks · remove entry · remove stale backlinks.

**The Many-to-Many Backlink Rule:**
1. Creation/Import — File A imports B and C → append A to `backlinks[]` of B and C.
2. Deletion — erase A's entry AND remove A from every other file's `backlinks[]`.
3. Modification — import removed → remove that backlink from the target file.

**Pre-Analysis Role:** before coder/editor touches a file, caller may ask file-mode to grep this index for all affected backlinks first.

**Behavior Contract — Index-Return (fires before returning to caller):**
```
Pre:    file-mode section complete · about to return to coder/editor
Contract: MUST write index_files.json entry with size object (bytes+lines) for every created/moved/deleted file
          MUST emit [file-index] action: · files: · backlinks: before any return signal
          skip write → [violation] BC-index-return → write entry now · re-emit · then return
Post:   index_files.json updated · [file-index] emitted · backlinks[] resolved
```
**Emit:** `[file-index] action: <add|update|remove> · files: <N> · backlinks: <N>`

---

## mode: symbol  (floor = SONNET · cross-file dependency reasoning)
Run when a symbol has (or will have) cross-file dependency — another file imports/calls/extends it.
Single-file-only symbols → skip unless renamed or deleted. Caller passes symbol + change type.

**Change types (step 2 apply):**
1. **Creation** — add `{type, file, line, signature, used_in: [], last_modified, task}`. Skip private helpers.
2. **Body Edit** (used_in[] ≥1) — run `symbol_indexer.py` (line drift breaks lookups) · update `last_modified`.
3. **Usage Link** — append the new location to `used_in[]` (most common).
4. **Rename** — update JSON key AND trace `used_in[]` to rename call sites via `editor`. Always run.
5. **Deletion** — erase entry. Always run (stale entries mislead pre-debug grep).

`symbol_indexer.py` runs for ALL change types (not just edit). `used_in[]`: the script's output is
authoritative — a manual seed at create/usage-link is OK; the script validates/corrects it.

**Behavior Contract — Symbol-Return (fires before returning to caller):**
```
Pre:    symbol-mode section complete · about to return to coder/editor
Contract: MUST run python scripts/symbol_indexer.py to sync the lookup index after the JSON update
          MUST emit [symbol-index] action: · symbol: · used_in: before any return signal
          Rename: MUST note old_name + new_name in the emit
          skip write → [violation] BC-symbol-return → write entry + run indexer → re-emit · then return
Post:   index_variables.json updated · symbol_indexer.py run · [symbol-index] emitted
```
**Emit:** `[symbol-index] action: <create|edit|link|rename|delete> · symbol: <name> · used_in: <N>` · on **rename** also include `· old: <old_name> · new: <new_name>` (matches the BC above)

---

## Tone Guide (both modes)
Keep:   `[file-index]` · `[symbol-index]` · `[index-skip]` · `[index-refused]` + reason · `[pre-edit]` + target
Strip:  internal deliberation · "I'll now update the index..." preamble · full file contents in signals
Format: `[signal] Key: value · Key: value` — single line, no prose wrap
Prohibited: "Updated the index for you" · "I've gone ahead and..." · silent no-op (always emit `[index-skip]` if skipping)

## Hard Rules
- Never write either index without reading the current entry first — overwrite without read = silent data loss.
- Never emit a `[*-index]` signal before the write is verified by grep.
- (file) never update `backlinks[]` without first reading `related[]` + `backlinks[]` current values.
- (file) `[index-skip]` mandatory when a skip condition is met — silent no-op = violation.
- (symbol) never index a symbol with no cross-file dependency — single-file symbols add grep-breaking noise.
- (symbol) never accept a rename without also calling `editor` — index_manager indexes the rename, it does not perform it.
- (symbol) never run without a change type — ambiguous type writes the wrong entry.
- Caller must provide the target — index_manager has no discovery; assume nothing.

## Routing
→ Return to the calling skill (coder/editor/harness_editor) after the emit.
Context Gate: a new hard constraint discovered → add to INVARIANTS.md §I2 before returning.

## MECE Constraints Block (copy into mece_plan.md for sections using `index_manager`)
```
- Pick mode via the router FIRST (file | symbol) — never guess; ambiguous → [index-refused] reason:no-mode
- Always called AFTER coder/editor completes — never before src/ edits
- (symbol) python scripts/symbol_indexer.py MUST run after the JSON update (ALL change types)
- (symbol) Rename: update JSON key AND emit [symbol-index] with old_name + new_name
- (file) backlinks[] cascade: update every file that imports the changed file
- (file) size object {bytes, lines} required for every new file entry
- [file-index] / [symbol-index] emit required before returning to the calling skill
```
