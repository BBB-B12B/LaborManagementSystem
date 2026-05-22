---
name: Variable Index Manager
description: Tracks variable, function, and component definitions and usage in knowledge/index_variables.json.
---

## Sections
```
- id: 1
  name: "Symbol Sync"
  steps: ["update index_variables.json", "run python scripts/symbol_indexer.py", "update used_in links", "[✓ written] verify"]
```

# Variable Index Manager

## Triggers (WHEN to step in)
You must execute your duties on `knowledge/index_variables.json` under these conditions:
1. **Creation**: Any symbol is created — Component, function, hook, type, constant, or API logic (not just "major" ones). Add entry with source path and line number.
2. **Edit symbol body**: Any code change to an existing symbol (bug fix, refactor, feature change) — run `python scripts/symbol_indexer.py` to refresh line numbers. Line drift is silent and breaks future lookups.
3. **Usage Link**: An existing variable is called/imported into a new location -> Append that location to the `used_in` array.
4. **Rename/Refactor**: A variable's name changes -> Update the JSON key AND immediately trace all files in `used_in` to rename those call sites via the `editor` skill.
5. **Deletion**: A component or variable is permanently removed -> Erase it from the JSON.

## Pre-Analysis Role
Before doing any structural refactoring, query this index to find all dependencies that rely on a specific variable to ensure zero downtime.
