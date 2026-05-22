---
name: Coder (Creator)
description: Focused skill for implementing new features and creating application files.
---

## Sections
```
- id: 1
  name: "Scope & Index"
  steps: ["R4 scope probe", "check index_files + index_variables for conflicts", "confirm no duplicates"]
- id: 2
  name: "Build"
  steps: ["create files to standards", "write code", "self-correct linter errors", "[✓ written] verify each file"]
- id: 3
  name: "Sync & Close"
  steps: ["call file_manager", "call variable_manager", "python scripts/symbol_indexer.py", "roadmap [X]"]
```

# Coder Skill

## Responsibilities
You are the "Builder". When the Agent delegates a new feature task to you, focus on writing robust, error-free code and establishing new files.

## Roadmap Protocol (MANDATORY — before and after every task)

**Before writing any code:**
```
1. grep docs/master_roadmap.md for existing task matching this work
   → Found: note the Task ID (e.g. T-017) → set status [/] (in progress)
   → Not found: assign next T-<N> → add [ ] T-<N>: <description> to roadmap
2. Note the Task ID — all work in this session is under that ID
```

**After completing code:**
```
1. Mark roadmap: [X] T-<N>: <description> · session_<NNN>
2. Call file_manager + variable_manager to sync indexes
```

## Coding Standards (Cloudflare & Next.js)
1. **Framework Strictness**: Follow standard directory conventions for new files (`src/app/`, `src/components/`, etc.).
2. **Database Integrity**: When creating Drizzle schemas, ensure they match the Technical Requirements Document carefully.
3. **Self-Correction (Linter)**: If you notice a TypeScript error or Linter warning while writing, fix it immediately before finishing your execution.
4. **Aesthetics & UI**: Use TailwindCSS standard utility classes. Strive for a minimalist, modern enterprise look.
5. **Local Staging**: When generating large files or major architectural components, write them to a temporary staging area (e.g., `/tmp/` or local `temp/` inside the project) first using your creation tools, verify their structure, and then move them to their final destination. This prevents token waste on failed direct file injections.

## Limitations
- Do **NOT** manipulate `.agents/` or `*.json` index files directly — call `file_manager` + `variable_manager` skills after creating files.
- **DO** update `docs/master_roadmap.md` — roadmap entries are mandatory (see Roadmap Protocol above).
- Source work scope: `src/`, `wrangler.toml`, `package.json`, `next.config.ts`.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
