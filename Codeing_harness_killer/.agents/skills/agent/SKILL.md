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
Orchestrator skill. Handles two responsibilities:
1. **Routing** — when no keyword matches, re-route to correct skill
2. **Multi-agent orchestration** — when task has independent sections, spawn and coordinate sub-agents per R4

## Routing Protocol
```
1. Read .agents/skills/registry.md → fast-match table
2. Re-evaluate user intent against all skill keywords[]
3. Load matched skill SKILL.md → hand off to Phase 1 (Info Gather Loop)
4. If still no match → ask user to clarify intent
```

## Orchestration Protocol (R4 Cycle fan-out)
```
1. Receive MECE plan from Phase 2 → read Cycle grouping
2. Build dependency graph from Cycle declarations:
   - Sections in same Cycle = no dependency → parallel
   - Sections in Cycle N+1 declare context-input from Cycle N
3. Read `.agents/platform/detected.md` → get spawn_tool, execution_type, parallel_mode
   For Cycle N: call `<spawn_tool>` using `<parallel_mode>` (one entry per section) → emit [cycle N]
   - Explore tasks: use `<explore_type>` · Execution tasks: use `<execution_type>`
   - Workspace/isolation: set per platform conventions (see detected.md notes)
   - Platform unknown: emit [platform-unknown] → run B4 probe before proceeding
4. Each section agent writes → `.sessions/cycle_N_<section_id>.json`
5. After all Cycle N agents done:
   a. Read all cycle_N_*.json → validate each file:
      - Required keys present: cycle, section, status, verify_result, artifacts
      - status value in ["done", "blocked"] — if missing/invalid → treat as blocked
      - Invalid JSON or missing file → treat as blocked, log in notes
   b. Any status = blocked → HALT all remaining Cycles → BLOCKED flow
   c. All done → aggregate results → build context payload for Cycle N+1
6. Call `<spawn_tool>` for Cycle N+1 — inject cycle_N results as `cycle_context:` in each Subagent Prompt
7. Repeat until all Cycles done → Completion Gate
```

**Delegation Contract — every sub-agent prompt must include:**
- `goal:` what to produce
- `constraints:` relevant rules from CLAUDE.md (R5, R6, R8)
- `output_format:` exact structure expected (JSON schema or table)
- `context_files:` only files the sub-agent needs (no full index)
- `cycle_context:` structured results from prior Cycle(s) — omit if Cycle 1

**Spawn call structure — varies by platform (read from `.agents/platform/detected.md`):**

Antigravity 2.0 example:
```json
{
  "Subagents": [
    {
      "TypeName": "self",
      "Role": "<section name>",
      "Prompt": "<goal> | constraints: <R5,R6,R8> | output_format: cycle_N_<id>.json | cycle_context: <prior results>",
      "Workspace": "inherit"
    }
  ]
}
```
Claude Code example: `Agent(subagent_type="task", prompt="<goal>...")`

→ Always resolve actual call format from `detected.md` at runtime. Do not hardcode.

**Sub-agent result file** — every spawned agent must write before returning:
```json
{
  "cycle": N,
  "section": "S<id>-<name>",
  "status": "done | blocked",
  "verify_result": "<output of Verify command>",
  "artifacts": ["path/to/file"],
  "notes": ""
}
```
Path: `.sessions/cycle_N_<section_id>.json`

## Skill Delegation Rules
- Creating new files/features → `coder` skill
- Modifying/fixing existing files → `editor` skill
- Any file created/moved/deleted → also trigger `file_manager`
- Any symbol created/renamed/deleted → also trigger `variable_manager`
- NEVER write code or run modifying Bash directly — always delegate to correct skill
- Sub-agents MUST NOT spawn further agents (max depth = 1)

## Environment & Paths
- Libraries: `/Volumes/BriteBrain/Libraries`
- IDE Context: `/Volumes/BriteBrain/IDE`
- Python install: `pip install <pkg> --target=/Volumes/BriteBrain/Libraries/python`
- NPM install: `npm install <pkg> --prefix=/Volumes/BriteBrain/Libraries/npm`
- Execution: `export PYTHONPATH=$PYTHONPATH:/Volumes/BriteBrain/Libraries/python`
