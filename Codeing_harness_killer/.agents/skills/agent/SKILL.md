---
name: Agent Core
description: Fallback orchestration skill. Loaded when no keyword matches. Re-routes to correct skill via registry. Does not run main work loop directly.
---

## Sections
```
- id: 1
  name: "Route & Orchestrate"
  steps: ["read registry.md fast-match table", "re-evaluate user intent", "load correct skill → hand off"]
```

---

# Agent Core

## Role
Fallback orchestrator only. All task execution follows **CLAUDE.md Loop Architecture** (Phases 1–3). This skill re-routes when no other skill keyword matches.

## Routing Trace Output
On load, emit immediately as first line:
```
[→ agent] Match: <matched_keyword> → agent · Loaded: .agents/skills/agent/SKILL.md
```

## Routing Protocol
```
1. Read .agents/skills/registry.md → fast-match table
2. Re-evaluate user intent against all skill keywords[]
3. Load matched skill SKILL.md → hand off to Phase 1 (Info Gather Loop)
4. If still no match → ask user to clarify intent
```

## Delegation Rules
- Creating new files/features → `coder` skill
- Modifying/fixing existing files → `editor` skill
- Any file created/moved/deleted → also trigger `file_manager`
- Any symbol created/renamed/deleted → also trigger `variable_manager`
- NEVER write code or run modifying Bash directly — always delegate to correct skill
- `session_manager` is auto-triggered at session close only — NEVER include it in orchestration plans or skill sequences

## Environment & Paths
- Libraries: `/Volumes/BriteBrain/Libraries`
- IDE Context: `/Volumes/BriteBrain/IDE`
- Python install: `pip install <pkg> --target=/Volumes/BriteBrain/Libraries/python`
- NPM install: `npm install <pkg> --prefix=/Volumes/BriteBrain/Libraries/npm`
- Execution: `export PYTHONPATH=$PYTHONPATH:/Volumes/BriteBrain/Libraries/python`

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
