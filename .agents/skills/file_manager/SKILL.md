---
name: File Index Manager
description: Manages the lifecycle of files and their dependencies in knowledge/index_files.json.
triggers: ["file created", "file moved", "file deleted", "index update", "backlink sync", "ไฟล์ใหม่", "อัพเดต index"]
activates_at: [post_coder, post_editor, post_harness_editor, manual]
---

## Sections
```
- id: 1
  name: "Index Update"
  steps: ["check skip conditions", "update index_files.json entry", "add/remove backlinks", "[✓ written] verify no stale links"]
```

# File Index Manager

## Operating Stance
- **Index-only, never business logic.** file_manager updates `index_files.json` only — content decisions belong to the caller. Never decide which files to create, move, or delete.
- **Atomic update or skip.** Partial index update (file added but backlinks skipped) is worse than no update — emit `[file-index-skip]` and return rather than write half the record.
- **Caller drives scope.** file_manager never discovers changed files — caller passes the changed file list; file_manager executes.
- **Silent drift is the failure mode.** The only way file_manager fails invisibly is by writing a stale or partial record — always verify after write.

## Prerequisites
- `knowledge/index_files.json` readable
  Why: all index reads + writes target this file · Missing: emit `[file-manager-refused] reason:index-unreadable`
- Changed file path(s) provided by caller
  Why: file_manager has no discovery logic — caller must specify · Missing: emit `[file-manager-refused] reason:no-target-path`
- Caller identity known (coder/editor/harness_editor/manual)
  Why: backlink cascade depth depends on caller context · Missing: proceed with shallow backlink scan only

## When NOT to Use
- Variable/symbol tracking (new function, renamed type, deleted export) → use `variable_manager` instead
- Session close / token reset → use `session_manager §3`
- Bulk src/ file restructure (>5 files moved) → use `agent` skill to orchestrate; file_manager handles per-file within it
- Conflict detection between `knowledge/` entries → use `knowledge_conflict_checker.py` directly

## Trigger
Run after any file is: created · moved · deleted · has imports changed.
Called by coder or editor after their section completes.

## Refusal Contract
Skip entirely (emit `[file-index-skip]`) if:
- No file was created, moved, deleted, or had imports changed this task
- index_files.json entry already exists with correct backlinks and no import changes

HALT (emit `[file-index-halt]`) if:
- index_files.json is missing or unreadable → report to user before proceeding

## Workflow (ordered steps)
1. Verify entry exists: check current entry for `<changed-file-path>` in `index_files.json` (grep or targeted Read)
2. Determine action: add entry (with size object: bytes+lines) · update backlinks · remove entry · remove stale backlinks
3. Apply changes via grep-only (Never-Full-Load: use targeted edits, not full read)
4. Confirm result: verify entry count is ≥1 (add/update) or 0 (delete) using any method
5. Emit `[✓ written]` with count of backlinks updated

## The Many-to-Many Backlink Rule
1. **Creation/Import**: Creating File A that imports B and C → append File A to `backlinks[]` of B and C.
2. **Deletion**: File removed → erase its entry AND remove it from every other file's `backlinks[]`.
3. **Modification**: Import removed → remove the backlink from the target file.

## Pre-Analysis Role
Before coder/editor touches a file: `grep` this index to check all backlinks affected.

## Output Contract

**Behavior Contract — Index-Return (fires before returning to any calling skill):**
```
Pre:    file_manager section complete · about to return to coder/editor
Contract: MUST write index_files.json entry with size object (bytes + lines) for every created/moved/deleted file
          MUST emit [file-index] action: · files: · backlinks: before any return signal
          skip write → [violation] BC-index-return → write entry now · re-emit [file-index] · then return
Post:   index_files.json updated · [file-index] emitted · backlinks[] resolved
Enforce: return to caller without [file-index] emitted = [violation] BC-index-return → write index + emit now
```

## Tone Guide
Keep:   `[file-index]` · `[file-index-skip]` · `[file-manager-refused]` · action/files/backlinks values
Strip:  internal deliberation · "I'll now update the index..." preamble · full file contents in signals
Format: `[signal] Key: value · Key: value` — single line, no prose wrap
Prohibited: "Updated the index for you" · "I've gone ahead and..." · silent no-op (always emit `[file-index-skip]` if skipping)

## Hard Rules
- Never write to `index_files.json` without reading the current entry first — prevents silent overwrite of unrelated fields.
- Never emit `[file-index]` without verifying the written entry via grep confirm.
- Never update `backlinks[]` without first reading `related[]` + `backlinks[]` current values.
- `[file-index-skip]` is mandatory when skip condition met — silent no-op = violation.
- Caller must provide file path — file_manager has no discovery; assume nothing.

## Routing
→ Return to calling skill (coder or editor) after emit.
Context Gate: new hard constraint discovered → add to INVARIANTS.md §I2 before returning.

## MECE Constraints Block (copy into mece_plan.md for sections using `file_manager`)
```
- Always called AFTER coder/editor completes — never before src/ edits
- backlinks[] cascade: update every file that imports the changed file
- size object required for every new file entry (bytes + lines)
- python scripts/symbol_indexer.py runs AFTER index_files.json update
- [file-index] emit required before returning to calling skill
```
