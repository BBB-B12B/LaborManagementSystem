---
name: File Index Manager
description: Manages the lifecycle of files and their dependencies in knowledge/index_files.json.
---

## Sections
```
- id: 1
  name: "Index Update"
  steps: ["update index_files.json entry", "add/remove backlinks", "[✓ written] verify no stale links"]
```

# File Index Manager

## Triggers & The Many-to-Many Backlink Rule
You must execute your duties on `knowledge/index_files.json` ONLY under these conditions:
1. **Creation & Import Rule**: When creating or editing `File A`, if it imports `File B` and `File C`, you MUST append `File A` into the `backlinks` Array of both `File B` and `File C`. (Remember: One file can act as a backlink for many files safely).
2. **Deletion (Cascading Cleanup)**: When a file is removed:
   - Erase its main entry from the JSON.
   - **Crucial**: You MUST scan the entire JSON and remove the deleted file's path from the `backlinks` Array of EVERY other file that previously referenced it. Do not leave stale links!
3. **Modification**: If an import is removed during editing, reflect that separation by removing the backlink from the target file.

## Pre-Analysis Role
Before the Coder or Editor touches a file, use `Bash: grep` against this index to ensure you understand all `backlinks` that might be affected by the upcoming code change.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
