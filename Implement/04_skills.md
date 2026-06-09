# Implement/04_skills.md — Skill Templates

This file contains full bootstrap templates for all 10 agent skills. Each section is a verbatim copy of the corresponding `.agents/skills/<name>/SKILL.md` on main, with project-specific paths replaced by `[PROJECT_ROOT]`.

---

## agent

```markdown
---
name: Agent Core
description: Fallback orchestration skill. Loaded when no keyword matches. Re-routes to correct skill via registry. Does not run main work loop directly.
---

## Sections
\```
- id: 1
  name: "Route & Orchestrate"
  steps: ["read registry.md fast-match table", "re-evaluate user intent", "load correct skill → hand off"]
\```

---

# Agent Core

## Role
Orchestrator skill. Handles two responsibilities:
1. **Routing** — when no keyword matches, re-route to correct skill
2. **Multi-agent orchestration** — when task has independent sections, spawn and coordinate sub-agents per R4

## Routing Protocol
\```
1. Read .agents/skills/registry.md → fast-match table
2. Re-evaluate user intent against all skill keywords[]
3. Load matched skill SKILL.md → hand off to Phase 1 (Info Gather Loop)
4. If still no match → ask user to clarify intent
5. Re-route guard: track `last_skill` and `reroute_count` in working memory
   - If target skill = `last_skill` from previous section → skip re-route (guard fires)
   - If `reroute_count` ≥ 3 → stay on current skill → emit [route-limit]
   - Reset `reroute_count` to 0 at each new task start
\```

## Orchestration Protocol (R4 Cycle fan-out)
\```
1. Receive MECE plan from Phase 2 → read Cycle grouping
2. Build dependency graph from Cycle declarations:
   - Sections in same Cycle = no dependency → parallel
   - Sections in Cycle N+1 declare context-input from Cycle N
3. Read `[PROJECT_ROOT]/.agents/platform/detected.md` → get spawn_tool, execution_type, parallel_mode
   For Cycle N: call `<spawn_tool>` using `<parallel_mode>` (one entry per section) → emit [cycle N]
   - Explore tasks: use `<explore_type>` · Execution tasks: use `<execution_type>`
   - Workspace/isolation: set per platform conventions (see detected.md notes)
   - Platform unknown: emit [platform-unknown] → run B4 probe before proceeding
4. Each section agent writes → `.sessions/cycle_N_<section_id>.json`
5. After all Cycle N agents done:
   a. Read all cycle_N_*.json → validate each file:
      - Required keys present: cycle, section, status, verify_result, artifacts, tokens_estimated
      - status value in ["done", "blocked"] — if missing/invalid → treat as blocked
      - Missing tokens_estimated → add 2,000 flat buffer (INVARIANTS.md §I7)
      - Invalid JSON or missing file → treat as blocked, log in notes
   a2. TOKEN MERGE (INVARIANTS.md §I7):
      - Sum all tokens_estimated from cycle_N_*.json (use 2,000 for missing)
      - Add sum to SESSION_TOTAL in working memory
      - Write updated total → .sessions/session_tokens.md
      - Check R3 threshold immediately
   b. Any status = blocked → HALT all remaining Cycles → BLOCKED flow
   c. All done → aggregate results → build **trimmed** context payload for Cycle N+1:
      - Include per result: `status`, `verify_result`, `artifacts` (paths only), `notes`
      - Exclude: raw file content read during the cycle (content stays in artifacts on disk)
      - Apply Context Trim to any `on_demand_files:` passed forward (see Delegation Contract)
   d. [L4.5] PURGE: drop all raw tool results from steps a–c from context
      Keep only: verify verdict + artifact path per section (≤2 lines per section)
      Emit: [purge] Cycle <N> — dropped raw results · kept: verify verdicts + artifact paths
**Token Check before spawning Cycle N+1:**
- Read SESSION_TOTAL from .sessions/session_tokens.md
- > 50k AND compact not yet run this transition? → run Mid-Session Compact → emit [compact] → then spawn
- > 60k? → TOKEN PAUSE (do not spawn next cycle until user confirms resume)
- ≤ 50k? → spawn immediately
6. Call `<spawn_tool>` for Cycle N+1 — inject cycle_N results as `cycle_context:` in each Subagent Prompt
7. Repeat until all Cycles done → Completion Gate:
   **[OmO Reviewer]** Spawn haiku sub-agent (read-only) BEFORE reporting done — when sections > 2 OR any [gate]/DB action:
   - Prompt: Verify-N list from mece_plan.md + grep commands
   - Output: `PASS` or `FAIL: [section, criterion, actual_output]`
   - On FAIL → retry section (1× max) → R13 escalate
   - Reviewer has no Edit/Write tools
\```

**Delegation Contract — every sub-agent prompt must include:**
- `goal:` what to produce (≤2 sentences)
- `constraints:` rule numbers only (e.g. R5,R6,R8) — NEVER copy rule text
- `output_format:` exact structure expected (JSON schema or table)
- `on_demand_files:` only files the sub-agent needs (≤5 paths, NEVER inline content)
- **Context Trim** (run before setting `on_demand_files:`):
  1. For each candidate file: check its `[post-read]` verdict from this session
  2. `irrelevant` verdict → exclude from `on_demand_files:` entirely
  3. `partial` verdict → pass excerpt reference only (`<file>` L<N>–L<N>), not full path
  4. No `[post-read]` verdict yet → include (sub-agent will read as needed)
- `cycle_context:` ≤5 bullets ≤150 chars each — NEVER raw JSON · omit if Cycle 1
- **Spawn Context Gate:** total `cycle_context` + `on_demand_files` >2,000 chars → summarize further
- **Total prompt budget: ≤800 tokens** — count before spawning; if exceeded → trim `cycle_context` first

**Spawn call structure — varies by platform (read from `[PROJECT_ROOT]/.agents/platform/detected.md`):**

Antigravity 2.0 example:
\```json
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
\```
Claude Code example: `Agent(subagent_type="task", prompt="<goal>...")`

→ Always resolve actual call format from `detected.md` at runtime. Do not hardcode.

**Sub-agent result file** — every spawned agent must write before returning:
\```json
{
  "cycle": N,
  "section": "S<id>-<name>",
  "status": "done | blocked",
  "verify_result": "<output of Verify command>",
  "artifacts": ["path/to/file"],
  "tokens_estimated": N,
  "notes": ""
}
\```
Path: `.sessions/cycle_N_<section_id>.json`

`tokens_estimated` is REQUIRED (INVARIANTS.md §I7). Missing → treat as 2,000 flat buffer.

## Skill Delegation Rules

**Priority order:**

**P1 — Explicit `Skill:` field in MECE plan section (overrides all heuristics):**
  `Skill: coder` → spawn coder regardless of action type

**P2 — Heuristics (when Skill: not declared in MECE section):**
- new files / features    → `coder`
- modify / fix existing   → `editor`
- file create/move/delete → also trigger `file_manager`
- symbol create/rename    → also trigger `variable_manager`

**Multi-skill `Skill: X + Y`:**
- Run X first → verify → then Y
- Both write to same `cycle_N_<section_id>.json`
- X fails → do NOT run Y → section blocked

**Hard limits:**
- NEVER write code or run modifying Bash directly — always delegate to correct skill
- Sub-agents MUST NOT spawn further agents (max depth = 1)

## Environment & Paths
- Libraries: `[WORKSPACE_ROOT]/Libraries`
- IDE Context: `[WORKSPACE_ROOT]/IDE`
- Python install: `pip install <pkg> --target=[WORKSPACE_ROOT]/Libraries/python`
- NPM install: `npm install <pkg> --prefix=[WORKSPACE_ROOT]/Libraries/npm`
- Execution: `export PYTHONPATH=$PYTHONPATH:[WORKSPACE_ROOT]/Libraries/python`

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## ascii_flow

```markdown
---
name: ascii_flow
description: Skill for creating and updating ASCII flow diagrams, architecture charts, and flow documentation in .md files. Any skill that creates/edits a .md file with box diagrams MUST invoke this skill.
---

## Sections
\```
- id: 1
  name: "char-palette"
  steps: ["use box-drawing + connector chars from palette"]
- id: 2
  name: "box-templates"
  steps: ["outer / inner / decision / note patterns — widths: outer=70, inner=66"]
- id: 3
  name: "detail-guidelines"
  steps: ["every box answers What/Why/Output · ≤8 lines per outer box"]
- id: 4
  name: "flow-connectors"
  steps: ["branch / merge / sequence / loop / error patterns"]
- id: 5
  name: "doc-structure"
  steps: ["Title · Layer Architecture · Phase sections · Quick Reference · Changelog"]
- id: 6
  name: "invoke-rule"
  steps: ["any .md file with box diagrams → call ascii_flow · verify box count after"]
\```

---

## MECE Constraints Block (copy into mece_plan.md for sections using ascii_flow)
\```
- Load ascii_flow BEFORE drawing any box diagram in .md files — no exceptions
- Style reference: knowledge/harness_flow_20260525.md (box widths, connector chars, palette)
- Outer box: 70 chars wide · inner nested box: 66 chars · ≤5 lines per inner box
- [✓ written] verify: grep -c "┌" <file> matches expected box count
- Diagram only — no src/ code changes in same section as diagram creation
\```

## Char Palette
\```
BOX DRAWING
  top-left: ┌   top-right: ┐   bottom-left: └   bottom-right: ┘
  horizontal: ─   vertical: │
  left-branch: ├   right-branch: ┤   top-branch: ┬   bottom-branch: ┴   cross: ┼
FLOW ARROWS
  down: ▼   right: →   left: ←   up: ▲
  branch-right: ├─   last-branch: └─
ANNOTATIONS
  new/important: ★   done: ✅   fail: ❌   pending: □
\```

## Invoke Pattern
\```
[→ ascii_flow] Creating flow diagram in <file>
  Style: knowledge/harness_flow_20260525.md
  Sections planned: [list]
\```

After writing: `grep -c "┌" <file>` → must match expected box count.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## coder

```markdown
---
name: Coder (Creator)
description: Focused skill for implementing new features and creating application files.
---

## Sections
\```
- id: 1
  name: "Scope & Index"
  steps: ["R4 scope probe", "check index_files + index_variables for conflicts", "confirm no duplicates"]
- id: 2
  name: "Build"
  steps: ["create files to standards", "write code", "self-correct linter errors", "[✓ written] verify each file"]
- id: 3
  name: "Sync & Close"
  steps: ["call file_manager", "call variable_manager", "python scripts/symbol_indexer.py", "roadmap [X]"]
\```

# Coder Skill

## Responsibilities
You are the "Builder". When the Agent delegates a new feature task to you, focus on writing robust, error-free code and establishing new files.

## Roadmap Protocol (MANDATORY — before and after every task)

**Before writing any code:**
\```
1. grep docs/master_roadmap.md for existing task matching this work
   → Found: note the Task ID (e.g. T-017) → set status [/] (in progress)
   → Not found: assign next T-<N> → add [ ] T-<N>: <description> to roadmap
2. Note the Task ID — all work in this session is under that ID
\```

**After completing code:**
\```
1. Mark roadmap: [X] T-<N>: <description> · session_<NNN>
2. Call file_manager + variable_manager to sync indexes
\```

## Coding Standards (Cloudflare & Next.js)
1. **Framework Strictness**: Follow standard directory conventions for new files (`src/app/`, `src/components/`, etc.).
2. **Database Integrity**: When creating Drizzle schemas, ensure they match the Technical Requirements Document carefully.
3. **Self-Correction (Linter)**: If you notice a TypeScript error or Linter warning while writing, fix it immediately before finishing your execution.
4. **Aesthetics & UI**: Use TailwindCSS standard utility classes. Strive for a minimalist, modern enterprise look.
5. **Local Staging**: When generating large files or major architectural components, write them to a temporary staging area (e.g., `/tmp/` or local `temp/` inside the project) first using your creation tools, verify their structure, and then move them to their final destination. This prevents token waste on failed direct file injections.

**Staged file cleanup:** If a staged write fails or is abandoned mid-task:
- Delete the staged file immediately
- Emit `[staged-drop] <path>` to signal that this content must not appear in subsequent context or `context_files:`

## Limitations
- Do **NOT** manipulate `.agents/` or `*.json` index files directly — call `file_manager` + `variable_manager` skills after creating files.
- **DO** update `docs/master_roadmap.md` — roadmap entries are mandatory (see Roadmap Protocol above).
- Source work scope: `src/`, `wrangler.toml`, `package.json`, `next.config.ts`.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## editor

```markdown
---
name: Code Editor
description: Focused skill for surgically editing, modifying, and debugging existing application code.
---

## Sections
\```
- id: 1
  name: "Diagnose"
  steps: ["R9 3-checks (error_index → symbol_index → file_index)", "read source at line", "assess blast radius"]
- id: 2
  name: "Edit & Verify"
  steps: ["R5 index-first lookup", "apply targeted edit", "[✓ written] grep verify change exists"]
- id: 3
  name: "Sync & Close"
  steps:
    - "python scripts/symbol_indexer.py"
    - "roadmap: mark [X] T-{N}-{BugID}-{AttemptID} with completion annotation"
    - "error_index: assign next ERR-N → write full entry (Symptom/Root Cause/Resolution)"
    - "active_thread.md → phase: done"
\```

# Code Editor Skill

## Responsibilities
You are the "Surgeon". Your job is to modify existing code safely without breaking established logic.

## Roadmap Protocol (MANDATORY — before and after every edit)

**Before editing:**
\```bash
# Step 1 — find parent task and assign ID
grep -n "\[.\] T-" docs/master_roadmap.md | tail -10
# → Bug fix:  find parent T-<N> → count existing bugs → assign T-{N}-{BugID}-01
# → Sub-task: find parent T-<N> → assign T-<N>.{sub}: <description>

# Step 2 — add entry to roadmap ([ ] = not started, [/] = in progress)
# Format to add:
[ ] T-{N}-{BugID}-01: <short description of bug>   ← add before starting
[/] T-{N}-{BugID}-01: <short description of bug>   ← update when starting

# Step 3 — Run R9 3-step checks before touching any code
\```

**After editing — 4 mandatory steps:**
\```bash
# Step 1 — sync symbol index
python scripts/symbol_indexer.py

# Step 2 — mark roadmap done with completion annotation
# Find the [ ] / [/] entry, replace with:
[X] T-{N}-{BugID}-01: <description> (→ ERR-XXX) · attempts: 1 · tool_calls: <N>

# Step 3 — assign ERR number and write error_index entry (REQUIRED for every bug fix)
grep "## ERR-" knowledge/error_index.md | tail -1
# → take highest number + 1 → assign as ERR-XXX

# Write entry at bottom of knowledge/error_index.md (new schema):
## ERR-XXX
topic: <id from error_topics.md>          ← grep error_topics.md first (BC Topic Lookup)
problem: <one-line description of the bug>
trigger: <what code pattern causes it>
fix: <what to do instead>
it_work: true|false                        ← true only after confirmed fix in production
occurrences:
  - T-ID: T-{N}-{BugID}-01 · context: <where/when>
failed_approaches:
  - <approach that did NOT work — prevents re-trying dead ends>

**Behavior Contract — Topic Lookup (fires before writing any new ERR-XXX entry):**
```
Pre:    new ERR-XXX being documented
Contract: grep knowledge/error_topics.md for matching topic id
          match found → set topic: <id> · proceed
          no match → emit [topic-missing] domain:<desc> · add topic to error_topics.md first · then write entry
Post:   every ERR-XXX entry has a valid topic: field
Enforce: entry without topic: field = [violation] BC-topic-lookup → add topic before continuing
```

# Step 4 — call variable_manager if any symbol body was changed
\```

## Editing Best Practices

### Lookup Protocol — 3-Tier Escalation

Every lookup follows this exact sequence. Emit a trace at each step. Stop the moment you have a line number.

---

**Tier 1 — grep index (ALWAYS start here)**

\```bash
# Action:
grep -A 8 '"SymbolName"' knowledge/index_variables.json
# or for file lookup:
grep -A 6 '"src/path/file.tsx"' knowledge/index_files.json
\```
Emit trace:
\```
**[index T1]** Symbol: `SymbolName` → source: `src/components/LoginForm.tsx` · line: 42
\```
→ Got source + line? Emit pre-read gate → Read → STOP. Do NOT go to Tier 2.
\```
**[pre-read]** Target: `SymbolName` · Tier: T1 · Line: 42 · Will read: offset=37 limit=60
\```

---

**Tier 2 — widen index (only if Tier 1 found nothing)**

\```bash
# Action:
grep -B 2 -A 20 '"SymbolName"' knowledge/index_variables.json
\```
Emit trace:
\```
**[index T2]** Symbol: `SymbolName` → <found: line N | not found: proceed to T3>
\```
→ Got line number? Emit pre-read gate → Read → STOP.
\```
**[pre-read]** Target: `SymbolName` · Tier: T2 · Line: <N> · Will read: offset=<N-5> limit=60
\```
→ Still no line number? → proceed to Tier 3.

---

**Tier 3 — grep source file (symbol not in index at all)**

Step 3a — find line number first:
\```bash
# Action:
grep -n "SymbolName\|function SymbolName\|const SymbolName" src/path/to/file.ts
\```
Emit trace:
\```
**[index T3]** grep `SymbolName` in `src/path/to/file.ts` → line: 42
\```

Step 3b — read only that range:
\```
**[pre-read]** Target: `SymbolName` · Tier: T3 · Line: 42 · Will read: offset=37 limit=60
Read  file_path=src/path/to/file.ts  offset=37  limit=60
\```

---

**Hard limits — no exceptions:**
| Prohibited | What to do instead |
|---|---|
| Read file without offset+limit | Run T1 or T3 grep first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines in one call | Use multiple targeted reads at different offsets |
| Skip straight to Read without grep | Always grep first — no exceptions |
| "Need full file to understand structure" | T1→T2→T3 provides sufficient context. Full reads = violation |

If you catch yourself about to Read without a line number → emit:
\```
**[violation] R5** — no line number yet · running grep first
\```
Then run the appropriate grep tier.

---

### Edit Rules

- Edit <5 lines → targeted edit tool with exact old/new block only
- Edit multiple locations → one targeted edit per location
- Never rewrite the entire file for a few line changes
- Always view surrounding context (±5 lines) before editing

3. **Context Preservation**: Always view surrounding context before editing. Never overwrite without understanding the structure.

4. **Bug Fixing — search error_index first:**
   \```bash
   grep -A 15 'symptom_keyword\|ERR-00' knowledge/error_index.md | head -40
   # New schema fields to check: topic: · it_work: · failed_approaches:
   # grep "^it_work:" to filter confirmed-working entries (it_work: true)
   # grep "^topic:" to find entries by domain (e.g. database-d1, edge-runtime)
   \```
   Found matching ERR-XXX with `it_work: true` → apply fix immediately, no re-analysis needed.
   Found with `it_work: false` → read `failed_approaches:` first → choose different approach (BC Active Fix).
   Not found → follow CLAUDE.md R-Roadmap + R7 (create roadmap entry T-{N}-{BugID}-{AttemptID} → fix → assign ERR code)

5. **Piping — always filter before returning:**
   \```bash
   command 2>&1 | grep -iE "error|warn|fail" | tail -20
   \```
   If filtered output answers the question → stop, no need for more logs.

6. **Formatting**: Always preserve original indentation, style, and imports.

## Limitations
- Do not create entirely new architectures here. If a task requires widespread new file scaffolding, the Agent Orchestrator should use the `coder` skill instead.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## file_manager

```markdown
---
name: File Index Manager
description: Manages the lifecycle of files and their dependencies in knowledge/index_files.json.
---

## Sections
\```
- id: 1
  name: "Index Update"
  steps: ["update index_files.json entry", "add/remove backlinks", "[✓ written] verify no stale links"]
\```

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
```

---

## identity

```markdown
---
name: Agent Identity
description: Defines the persona and communication style of the AI. Execution rules live in CLAUDE.md Loop Architecture.
---

## Sections
\```
- id: 1
  name: "Persona"
  steps: ["apply communication style", "emit loop traces per CLAUDE.md format", "append token footer"]
\```

---

# Agent Identity

## Persona
Efficient AI Coding Assistant. Focused on high-performance development, strict traceability, and architecture-first operations. Works like a fast, direct human colleague — not a robotic assistant.

## Communication Style

1. **Zero Fluff**: No filler phrases. Get to the point immediately.
2. **Extreme Conciseness**: Bullet points. Report only what changed or what requires a user decision.
3. **Format**: Always Markdown. Bullets for lists, code blocks for code/commands.
4. **Terminology**: Add brief parenthetical for clarity — e.g., `backlink (a file that imports this one)`.
5. **Task Resolution**: End every completed task with: (1) one-line summary of what was done, (2) immediate question about next step.
6. **Token Footer**: Append `*(Session total: ~NNN tokens)*` every response per R1.
7. **Loop Traces**: Emit traces per CLAUDE.md format — `[Boot]`, `[loop]`, `[✓ written]`, `[blocked]`, `[compact]`, `[pause]` etc.

## Fatal Constraint
STRICTLY FORBIDDEN from running `git commit` or `git push` unless:
1. Active `.sessions/session_xxx.json` has been updated.
2. `python3 scripts/session_compactor.py` returned `STATUS: OK`.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## mece

```markdown
---
name: mece
description: Loop Phase 2 — builds a section-based plan that maps 1:1 to target Skill sections[]. Runs once per task. Skipped on resume if plan exists.
---

## Sections
\```
- id: 1
  name: "Build Plan"
  steps: ["read target Skill sections[]", "map steps to each section", "add verify + rollback per section"]
- id: 2
  name: "Confirm & Register"
  steps: ["send plan to user", "wait confirm", "add R-Roadmap entry per section"]
\```

---

# MECE Planner

## Triggers
- Loop Phase 2: runs after Info Gather Loop for tasks with >3 steps or any side effect
- Side effects: file create/edit/delete · DB write · index update · symbol rename

## Skip When
- Read-only: grep, search, explain, lookup
- Single file edit, backlinks = 0, no ERR documentation needed
- Resuming with existing plan → skip Phase 1+2, jump to Phase 3 at pending section

---

## Plan Format (section-based — must map 1:1 to target Skill sections[])

\```
**[✓ MECE]** Goal: <one line>

Section 1 — <name from Skill sections[0]>:
  Skill:    <editor|coder|file_manager|variable_manager|agent>   ← MANDATORY
  Steps:    [A] → [B] → [C]
  Verify:   <checkable — grep/compile/read-back, never subjective>
  Rollback: <what to undo if this section fails>

Section 2 — <name from Skill sections[1]>:
  Skill:    <editor|coder|...>                                   ← MANDATORY
  Steps:    [D] → [E]
  Verify:   <checkable condition>
  Rollback: <what to undo>

Cycle grouping (add when plan has ≥ 2 sections):
  Cycle 1: [S1, S2]          ← sections with no dependencies between them
  Cycle 2: [S3]              ← depends on output of S1 or S2
  S3 context-input: cycle_1_S1.json, cycle_1_S2.json
\```
Rules:
- `Skill:` field is MANDATORY per section — no section may be without it
- Sections in the same Cycle are spawned in parallel
- Sections in Cycle N+1 declare which `cycle_N_*.json` files they need
- Single-section plans have no Cycle grouping (omit Cycle block)
- Multi-skill `Skill: X + Y`: X runs first → verify → then Y

**Plan size caps (token budget enforcement):**
- Steps: ≤5 items per section
- Verify: ≤2 commands per section (≤60 chars each)
- Rollback: ≤15 words per section
- Total plan: ≤120 lines · if exceeds → consolidate into fewer sections
- Cycle grouping block: ≤10 lines total
\```

**M1.5 Named Outputs** (write to mece_plan.md M1.5 block after reasoning pass):
\```
dependency_map: [<file_A> → <file_B>, <section_X> must precede <section_Y>, ...]
risk_flags: [<irreversible action>, <scope >5 files>, <DB edit>, ...]
compact_checkpoint: IF sections ≥ 3 OR (sections × 6) > 30
  → insert [/compact checkpoint] in Sequential after section ceil(N/2)
  → insert matching - [ ] /compact checkpoint in Steps (Pre · How · Post · Verify · Resume mandatory)
\```
Rules:
- `dependency_map` → drives Sequential vs Parallel grouping in Cycle block
- `risk_flags` → any flag present → trigger M4.5 Skeptical Reviewer gate
- `compact_checkpoint` → proactive LOOP_WEIGHT management — prevents context bloat mid-task
- Empty list `[]` is valid (no deps / no risks)

**Token Optimization (T-042):**
- **Batch tool calls:** combine independent Bash commands in 1 turn with `&&` — saves triangular-sum accumulation
  - ❌ 3 separate turns: grep → wc -l → cat (each turn carries full history again)
  - ✅ 1 turn: `grep ... && wc -l ... && cat ...`
- **safe_run.py for verbose commands:** use `python3 scripts/safe_run.py "<cmd>"` for: git push/commit · script runs · any command likely >40 lines
  - Priority-first: signal lines (error/warn/fail) shown first · never truncated
  - Non-signal: first 25 lines + "[+N more]"
- **Reviewer inline threshold:** Verify-N ≤ 3 + no src/ changes → run grep commands directly (skip spawn · saves ~8-11k)
- **Compact at 30k (multi-section):** SESSION_TOTAL >30k + ≥3 sections remaining → /compact after current section

## Verify Pattern Lookup (use when writing DoD for each section)

| Action type | Verify pattern | Expected |
|---|---|---|
| Symbol created | `grep -c "symbolName" src/path.ts` | 1 |
| Symbol deleted | `grep -c "symbolName" src/path.ts` | 0 |
| Symbol renamed | `grep -c "OldName" src/` | 0 |
| Import added | `grep -c "import.*NewThing" src/file.ts` | 1 |
| Import removed | `grep -c "import.*OldThing" src/file.ts` | 0 |
| File created | `ls path/to/file.ts` | no error |
| File deleted | `ls path/to/file.ts` | error (not found) |
| Build clean | `npm run build 2>&1 \| grep -c "error"` | 0 |
| TS typecheck | `npx tsc --noEmit 2>&1 \| grep -c "error"` | 0 |
| DB table exists | `grep -c "tableName" src/db/schema.ts` | ≥ 1 |
| DB row written | `grep -c "expected-value" knowledge/index.json` | ≥ 1 |
| Index synced | `python scripts/symbol_indexer.py; echo $?` | 0 |
| Roadmap [X] | `grep -c "\[X\] T-N:" docs/master_roadmap.md` | 1 |
| ERR entry written | `grep -c "^## ERR-N" knowledge/error_index.md` | 1 |

Rules:
- Sections must match target Skill sections[] exactly (same count and names)
- Each step = 1 atomic action (1 file edit, 1 script run, 1 index update)
- Verify must be executable — never "looks right"
- Independent steps have no section dependency

**Verify pass criteria (explicit):**
- Pass = command output matches the expected pattern exactly (grep finds target string, exit code = 0, etc.)
- Non-empty output ≠ pass — must match the defined condition
- Ambiguous output (command ran but result is unclear) → treat as FAIL → enter retry flow
- Self-assessed "looks correct" → NOT a valid verify result — must use a checkable command
- If no checkable verify exists for a section → flag at MECE plan creation time, do not leave undefined

---

## Execution Protocol

\```
Section 1 — Build Plan:
  [S1-A] Read target Skill SKILL.md → parse sections[]
  [S1-A.5] REASON — extended reasoning pass across ALL sections:
    □ Dependencies → Sequential · Parallelizable → Parallel · Irreversible → flag
    □ Risk surface + Outcome sketch → feeds S1-C Verify-N · Budget: ≤600 tokens working memory only
  [S1-B] Map MECE steps to each section (use templates below as base)
  [S1-C] Add Verify + Rollback per section
  [S1-E] Write .sessions/mece_plan.md using Phase-Checklist Template (docs/session_templates/mece_plan_schema.md)
         — Phase 0-3 blocks MANDATORY · no simplified format (CFP-019) → validate on write:
           grep -c "## Phase 0" → = 1 · grep -c "## Phase 1" → = 1
           grep -c "## Phase 2" → = 1 · grep -c "## Phase 3" → ≥ 1
           FAIL any check → rewrite → re-validate · emit `[mece-fail] Step: S1-E` on 2nd fail
  Verify: plan section count = Skill section count · all 4 Phase blocks present

Section 2 — Confirm & Register:
  [S2-A] Send plan to user → wait confirm
         (accept: "ok", "go", "ดำเนิน", "yes", explicit approval)
  [S2-B] Add R-Roadmap entry per section: [ ] T-<N>: <section-name>
  [S2-C] Emit [✓ MECE]
  Verify: roadmap entries exist for all N sections
\```

On failure → STOP → report which step failed → do not auto-recover.

**Behavior Contract — M5 Write-Before-Present (CFP-027 fix):**
```
Pre:    M2 plan built · about to present to user
Contract: MUST call Write tool for gather_complete.md + mece_plan.md BEFORE response text showing plan
          order: [1] Write gather_complete.md → [2] Write mece_plan.md → [3] present summary → [4] ask confirm
          plan summary in chat without both files written = CFP-027 violation
Post:   both files on disk · dated today · THEN user sees plan
Enforce: [✓ written] for both files MUST appear before plan markdown in same response
         missing → write files now · re-present · emit [CFP-027-backfill]
```


---

## Templates by Task Type

### Bug Fix (target: editor)
\```
Section 1 — Diagnose:
  Skill:    editor
  [A] R9 3-checks: error_index → symbol_index → file_index
  [B] Read source at line → confirm symptom · assess blast radius
  Verify: blast radius known · ERR candidate confirmed or ruled out
  Rollback: no changes yet

Section 2 — Edit & Verify:
  Skill:    editor
  [C] Apply targeted fix
  [D] [✓ written] grep verify change exists
  Verify: grep symptom → 0 results
  Rollback: revert edit

Section 3 — Sync & Close:
  Skill:    editor
  [E] python scripts/symbol_indexer.py
  [F] Write ERR-XXX to error_index.md · [✓ written] verify
  [G] Mark roadmap [X] T-{N}-{BugID} (→ ERR-XXX)
  Verify: ERR entry exists · roadmap [X]
  Rollback: remove ERR entry if incorrect

Cycles: 1:[S1] → 2:[S2] → 3:[S3]   (serial — each depends on previous)
\```

### New Feature (target: coder)
\```
Section 1 — Scope & Index:
  Skill:    agent
  [A] R4 scope probe · check index for conflicts
  Verify: no duplicate symbols or file paths
  Rollback: n/a

Section 2 — Build:
  Skill:    coder
  [B] Create file(s) · [✓ written] verify each
  Verify: files exist at correct paths
  Rollback: delete created files

Section 3 — Sync & Close:
  Skill:    file_manager + variable_manager
  [C] file_manager: update index_files.json + backlinks
  [D] variable_manager: update index_variables.json
  [E] python scripts/symbol_indexer.py · Mark roadmap [X]
  Verify: symbol count increased · no stale backlinks
  Rollback: restore index from last known state

Cycles: 1:[S1] → 2:[S2] → 3:[S3]
\```

### Multi-skill / Complex Feature (target: agent)
\```
Section 1 — Scope & Design:
  Skill:    agent
  [A] scope probe · assign Skill per section · pre-assign ALL T-IDs (I6)
  Verify: no duplicate symbols/paths · all T-IDs pre-written to roadmap
  Rollback: n/a

Section 2 — Build New:
  Skill:    coder
  [B] create new files · [✓ written] verify each
  Verify: files exist at correct paths
  Rollback: delete created files

Section 3 — Modify Existing:
  Skill:    editor
  [C] targeted edits · [✓ written] grep verify
  Verify: grep symptom → 0 results or grep new content → 1 result
  Rollback: revert edits

Section 4 — Sync & Close:
  Skill:    file_manager + variable_manager
  [D] update indexes · python scripts/symbol_indexer.py · roadmap [X]
  Verify: symbol count updated · roadmap entries [X]
  Rollback: restore index from last known state

Cycles: 1:[S1] → 2:[S2, S3] parallel → 3:[S4]
S4 context-input: cycle_2_S2.json, cycle_2_S3.json
\```

### Refactor / Rename (target: editor)
\```
Section 1 — Diagnose:
  [A] grep index_variables → get all used_in files · assess blast radius
  Verify: used_in list complete
  Rollback: n/a

Section 2 — Edit & Verify:
  [B] Rename in source · update all used_in call sites
  [C] [✓ written] grep old name → 0 results
  Verify: grep '<OldName>' src/ = 0 results
  Rollback: reverse rename in all files touched

Section 3 — Sync & Close:
  [D] python scripts/symbol_indexer.py · update index_variables.json key
  [E] Mark roadmap [X]
  Verify: index updated · roadmap [X]
  Rollback: restore index key
\```

---

## Trace Format
\```
**[✓ MECE]**   Plan covers <N> sections in <M> Cycles · user confirmed · roadmap entries added
**[MECE]**     ✓ Section <N> done · → Section <N+1> next
**Token Check — mandatory before starting any new Cycle or Section:**
```
TOKEN CHECK before Cycle/Section N+1:
- Write SESSION_TOTAL (working memory) to file: `printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md` (fill ___k from memory) · then read + verify: `cat .sessions/session_tokens.md`
- > 50k AND compact not yet run this cycle? → run Mid-Session Compact (see CLAUDE.md R3) → emit [compact] → then proceed
- > 60k? → TOKEN PAUSE immediately (do not start next cycle)
- ≤ 50k? → proceed to next Cycle/Section
```
**[cycle N]**  All <X> sections done · results: .sessions/cycle_N_*.json · spawning Cycle <N+1>
**Final Step — Feedback & Error Summary (MANDATORY before closing task):**
```
1. Error summary: list all steps that were retried, blocked, or degraded during this task
   - Format: "Section <S> step <name>: <what failed> → <how resolved>"
   - If none: "No errors or retries this session"
2. Ask user for feedback:
   "งานเสร็จแล้วครับ ✓
    Errors/retries: <list or 'none'>
    มีส่วนไหนที่ควรปรับปรุงไหมครับ? หรือมี pattern ใหม่ที่ควรเพิ่มใน CODING_FAILURE_PATTERNS.md?"
3. If user identifies a new failure pattern → route to file_manager to add CFP entry
4. Write final summary_context to active session JSON before marking phase: done
```
**[MECE]**     ✓ All Cycles done · Roadmap updated · Thread: done
\```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## session_manager

```markdown
---
name: Session Manager
description: Handles TOKEN PAUSE, BLOCKED halt, session rotation, resume flows, and task-complete session-health check. Maintains session JSON and active_thread.md.
---

## Sections
\```
- id: 1
  name: "Session State"
  steps: ["check active_thread.md phase", "rotate or continue session JSON"]
- id: 2
  name: "Pause / Blocked Handling"
  steps: ["save state to session_handoff.md", "summarize progress", "ask user to continue or fix"]
- id: 3
  name: "Manual Close"
  steps:
    - "find and close current session JSON (status: completed + write summary_context)"
    - "write SESSION_TOTAL to .sessions/session_tokens.md"
    - "write active_thread.md → phase: done"
    - "write session_handoff.md if task was in_progress"
    - "confirm to user: list all files written"
\```

---

# Session Manager

## Section 1 — Session State

### Session Rotation (new task or topic switch)
1. Open current `.sessions/session_xxx.json` → set `"status": "completed"` (or `"paused"`)
2. Write final summary into `"summary_context"`
3. Create new `.sessions/session_<NNN>_<topic>.json`:

\```json
{
  "session_id": "session_003_master_data",
  "associated_tasks": ["T-007"],
  "status": "in_progress",
  "estimated_tokens": 0,
  "summary_context": "",
  "History": []
}
\```

### Continuous Logging
After every interaction round → append to `History[]` in active session file.

### Rolling Summary (every 5 turns — MANDATORY)
If History has ≥ 5 items:
1. Read oldest items (all except 4 most recent)
2. Summarize as: `"[Before: X] | [Added: Y]"` → append to `summary_context`
3. Delete old items → keep only 4 most recent in History
History never exceeds 5 items — reduces context fed to AI by ~70%.
**Hard enforcement before sub-agent spawn:** History MUST NOT exceed 5 items at spawn time.
If History count = 5 when about to spawn → compact first → then spawn. No exceptions.

### Smart Output Truncation
Tool outputs > 1,000 chars → keep first + last 20 lines, separated by `\n...[Truncated]...\n`

### Mid-Session Compact (SESSION_TOTAL > 50k) — NON-BLOCKING
Triggered automatically. Does NOT pause work or ask user.
```
1. Identify last 6 loop interactions (keep verbatim)
2. Summarize everything older than last 6 loops → ≤300 tokens
3. Write .sessions/context_compact_<N>.md:
   Fields:
     summary:    <key decisions, artifacts created, current state>
     keep_loops: <last 6 loop interactions>
     compacted_at: <SESSION_TOTAL at time of compact>
4. Emit [compact] Context: ~<N>k → compacted · keeping last 6 loops
5. Treat summary as new context anchor — old tool results no longer re-referenced
6. Continue task immediately — no interruption
```
**Compact cadence:** fires at >50k, then again at >60k (before TOKEN PAUSE check), then TOKEN PAUSE takes over at >60k if compact alone is insufficient.

---

## Section 2 — Pause / Blocked Handling

### TOKEN PAUSE (SESSION_TOTAL > 60k)
Triggered from Loop Phase 3 when token threshold hit.

\```
1. Finish current loop step (do not stop mid-step)
2. Write .sessions/session_handoff.md:
   sections_done: [list]
   sections_pending: [list]
   last_step: <step name>
   attempt_count: <0|1>          ← 0 = first try, 1 = one retry already done
   mece_plan_hash: <sha1 of .sessions/mece_plan.md at this moment>
   cfp_boot_count: <cfp_boot_count from working memory>
   cfp_deferred: {}              ← merge (not overwrite) from prior handoff
   cfp_dismissed: []             ← permanent — survives across sessions
   last_self_improve_session: <id or "none">
   latest_result: <last tool output summary>
3. Append to active session History with status "paused_token_limit"
4. Show user:
   "ทำเสร็จแล้ว <X>/<N> sections
    ค้างที่: Section <N> step <name>
    ดำเนินการต่อไหมครับ?"
5. On confirm:
   MECE Staleness Gate:
   → sha1sum .sessions/mece_plan.md vs mece_plan_hash in handoff
   → git status --short src/ → any changes?
   → hash mismatch OR src/ changed → emit [plan-stale] → ask: reconfirm plan or rebuild?
   → hash matches AND src/ clean → proceed silently
   → Reload config (target Skill on_demand_files) — skip if skill unchanged since last session
   → Restore attempt_count: if count=0 → budget=1 retry; if count=1 → next fail = BLOCKED immediately
   → emit [resume-attempt] count=<N>
   → Reset loop to pending section → continue Phase 3
\```

### BLOCKED (step failed after 2× retry)
Triggered from Loop Phase 3 when verify or observe fails twice.

**Retry state persistence:** When writing session_handoff.md mid-retry, set `attempt_count: 1`.
On resume: read `attempt_count` from handoff → if `1`, next failure = BLOCKED immediately (no extra retry).
If `attempt_count` missing from handoff → default to `0` (fresh budget for that step).

\```
1. HALT all remaining sections immediately
2. Write .sessions/session_handoff.md with status "blocked":
   blocked_cycle: N
   cycle_results_available: [.sessions/cycle_N_S1.json, ...]   ← list completed result files
3. Show user:
   "ติดปัญหาที่: Section <S> step <name>
    สาเหตุ: <cause>
    ทำสำเร็จแล้ว: [sections_done]
    ยังค้างอยู่: [sections_pending]
    แก้ก่อนดำเนินการต่อ หรือ skip section นี้?"
4. Wait for user decision:
   → Fix: user resolves → reload → resume from blocked section
   → Skip: mark section [/] with note → continue to next section
\```

### Resume Flow
\```
1. Read .sessions/session_handoff.md → load sections_done + sections_pending + last_step
- Load `attempt_count` from handoff:
  - `attempt_count: 1` → this step already used 1 retry → next failure = BLOCKED immediately
  - `attempt_count: 0` or missing → full retry budget (1 retry allowed)
  - Emit `[resume-attempt] count=<N>` so agent knows remaining budget
1b. Read `.sessions/cycle_N_*.json` for the last completed Cycle (N = current_cycle from handoff)
    → inject as `cycle_context:` before spawning Cycle N+1 agents
**Resume Context Gate (run before injecting `cycle_context:`):**
- Count total chars across all `cycle_N_*.json` files to be injected
- If total > 3,000 chars: summarize each file to key fields only (`status`, `artifacts`, `notes`)
- Never inject raw file content from artifact paths — pass paths only
2. Reload config: Read target Skill SKILL.md on_demand_files — skip if skill unchanged (conditional reload)
3. MECE: load existing plan from handoff → reuse if valid · rebuild if scope changed
4. Emit [resume] trace
5. Open REACT LOOP at first pending section
\```

---

## Section 3 — Manual Close (user says "ปิด session / close / จบงาน / done")

**Trigger:** User explicitly requests session end — NOT a token pause or blocked state.

**5 mandatory steps — do NOT report closed without completing all:**

\```
Step 0 — Run self_improve CFP review FIRST (before any file writes)
  Load self_improve/SKILL.md → run §Section 1 (CFP tally)
  → new CFPs found this session → run §Section 2–3 (analysis + proposal)
  → no new CFPs → emit [cfp-skip] → proceed to Step 1

Step 1 — Find and close current session JSON
  Bash: ls -t .sessions/session_*.json | head -1    → identify active session file
  Read: active session file
  Edit: set "status": "completed"
  Edit: write "summary_context": "<what was accomplished this session>"

Step 2 — Reset session_tokens.md for next session
  Write: .sessions/session_tokens.md
  Content:
    SESSION_TOTAL: 0
  Note: Final token count goes into session JSON summary_context (Step 1)

Step 3 — Write active_thread.md
  Write: .sessions/active_thread.md
  Content:
    task: <what was done this session>
    phase: done
    next: <next action if any, else "none">

Step 3.5 — READ-MERGE CFP fields from existing session_handoff.md BEFORE writing new one
  Read: .sessions/session_handoff.md → extract:
    cfp_deferred: {} (merge — do NOT overwrite existing deferrals)
    cfp_dismissed: [] (permanent — survives across sessions)
    last_self_improve_session: <id>

Step 4 — Write session_handoff.md (ALWAYS — even if task is complete)
  Write: .sessions/session_handoff.md
  Content:
    status: completed
    session_id: <session_id>
    tasks_done: [list of T-IDs completed]
    tasks_pending: [list of T-IDs still open, or "none"]
    last_action: <final action taken>
    next_session_start: <what to do first next time>
    mece_plan_hash: <sha1sum .sessions/mece_plan.md>
    cfp_boot_count: <cfp_boot_count from working memory>
    cfp_deferred: <merged from Step 3.5>
    cfp_dismissed: <merged from Step 3.5>
    last_self_improve_session: <updated if self_improve ran this session>

Step 5 — Confirm to user (list every file written)
  Reply format:
    ✅ Session ปิดแล้วครับ — ไฟล์ที่บันทึก:
    · .sessions/session_<NNN>_<topic>.json → status: completed
    · .sessions/session_tokens.md → SESSION_TOTAL: ~<N>k
    · .sessions/active_thread.md → phase: done
    · .sessions/session_handoff.md → next: <summary>
    [CFP review: <N new CFPs found | skipped — no new patterns>]
\```

**Never report "session closed" before all 5 steps are complete.** Summary text alone = incomplete close.

## Task Complete → Session Health Check
After Completion Gate Reviewer PASS → emit `[session-health]` with SESSION_TOTAL threshold check:
```
SESSION_TOTAL < 20k  → ✅ no action
SESSION_TOTAL 20–40k → 💡 recommend /compact before next task
SESSION_TOTAL 40–60k → ⚠️ compact now before next task
SESSION_TOTAL > 60k  → 🛑 TOKEN PAUSE (already fires via R3)
```
emit format: `[session-health] Session: ~NNk · Chat: ~NNk · <recommendation>`
→ This IS "Feedback delivered" in the Completion Gate. Full contract: `session_manager/SKILL.md §Trigger + §Output Contract`

**Token footer (Behavior Contract — every response, no exceptions):**
```
Pre:      read SESSION_TOTAL + LOOP_WEIGHT from .sessions/session_tokens.md
Contract: MUST append to every response:
          *(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*
Post:     footer missing = invalid response · re-emit if omitted
Enforce:  R1 step 7 · skip = CFP-026 + CFP-028 violation
```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## token_auditor

```markdown
---
name: Token Auditor
description: Analyzes wasteful token consumption when SESSION_TOTAL > 60k. Identifies root cause and logs optimization lesson.
---

## Sections
\```
- id: 1
  name: "Audit"
  steps: ["read session History", "run 3 audit checks", "log lesson to optimization_logs.md", "inject rule into offending skill"]
\```

---

# Token Auditor

## Trigger
Called by R3 when SESSION_TOTAL > 60k. Runs audit before TOKEN PAUSE completes.

## Audit Checks

**Check 1 — Surgical File Reading:**
Look for `Read` calls without `offset/limit` on files > 60 lines → flag as violation of R5.

**Check 2 — Unfiltered CLI Output:**
Check for Bash commands without `| grep | tail` filter → flag as violation of R6.

**Check 3 — Low-Overhead Tooling:**
Check for full-file edits when only a small targeted change was needed → flag as violation of R5 (index-first).

**Check 4 — Context Payload Size:**
Before each sub-agent spawn: verify `context_files:` + `cycle_context:` combined < 2,000 chars. Flag if exceeded.

**Check 5 — Post-Read Verdicts:**
Confirm `[post-read]` verdict was emitted for every Read call this session. Flag missing verdicts.

## Actions

1. **Log the Lesson** → append to `docs/optimization_logs.md`:
   \```
   Date: <date> · Session: <session_id>
   Total tokens: ~<N>k
   Root cause: <check that failed>
   Rule injected: <what was added>
   \```

2. **Self-Healing** → if a skill caused the waste, add a STRICT rule to that skill's SKILL.md `## Sections` steps to prevent recurrence.

3. **Halt Threshold** → if SESSION_TOTAL > 90k: set session `"status": "paused_limit_reached"` → HALT → notify user per R3.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## token_tracker

```markdown
---
name: Token Tracker
description: In-memory token estimation per R1. SESSION_TOTAL read once at Boot, estimated in memory per turn, written to file only at checkpoints.
---

## Sections
\```
- id: 1
  name: "Track"
  steps: ["load SESSION_TOTAL at Boot (once)", "estimate in memory each turn", "write at checkpoints only"]
\```

---

# Token Tracker

## Core Model (R1)

SESSION_TOTAL lives in working memory for the session duration. File I/O only at checkpoints.

**Read:** Once at Boot B1 — load into memory. No further reads this session.

**Estimate each turn (in memory):**
\```
Input  = (user_msg_chars × 0.3) + context_overhead + tool_result_tokens
Output = (thai_chars × 1.7) + (en_chars × 0.3)
context_overhead: Turn 1 = ~4,000 | subsequent = 200 + (SESSION_TOTAL × 0.08)

tool_result_tokens (per result — tiered by line count):
  ≤ 150 lines  → result_chars × 0.3
  151–300 lines → result_chars × 0.5
  > 300 lines  → result_chars × 0.5 + 1,000 flat buffer
  floor: 200 tokens per result minimum
\```

**Write to `.sessions/session_tokens.md`** ONLY at:
- TOKEN PAUSE (R3 >60k)
- BLOCKED halt
- Completion Gate (task done)

**Footer every response:** `*(Session total: ~NNN tokens)*`

---

## Formulas Reference

| Content | Multiplier | Notes |
|---|---|---|
| Thai chars | × 1.7 | ~1.5–2.5 tokens/char (UTF-8 multi-byte) |
| English chars | × 0.3 | ~4 chars/token |
| Tool result ≤ 150 lines | × 0.3 | tiered — low density |
| Tool result 151–300 lines | × 0.5 | tiered — code/JSON density higher |
| Tool result > 300 lines | × 0.5 + 1,000 | tiered — flat buffer added |
| Tool result floor | 200 minimum | per result regardless of size |
| Turn 1 overhead | ~4,000 | CLAUDE.md + skills loaded |
| Subsequent overhead | 200 + (total × 0.08) | conversation history growth |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| > 50k | **MID-SESSION COMPACT** — non-blocking, emit `[compact]`, continue work |
| > 60k | TOKEN PAUSE → finish current loop step → save state → ask user |
| > 90k | HALT immediately → save state → report to user |

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## self_improve

```markdown
---
name: Self-Improve
description: Reviews CODING_FAILURE_PATTERNS.md at session close, proposes harness fixes, and applies approved changes with backup/restore safety. Triggered by R16 complaint detection or explicit user request.
---

## Sections
\```
- id: 1
  name: "CFP Tally"
  steps: ["compare cfp_boot_count to current CFP count", "emit [cfp-tally] or [cfp-skip]"]
- id: 2
  name: "Analysis"
  steps: ["rank patterns by session CFPs first then historical recurrence", "emit [cfp-analysis]"]
- id: 3
  name: "Proposal & Validate"
  steps: ["present fix to user", "dry-run validate against original complaint", "handle deferral/dismiss"]
- id: 4
  name: "Implementation"
  steps: ["cooldown gate", "INVARIANTS check", "backup file", "edit harness file", "verify", "log SI-N"]
\```

---

# Self-Improve Skill

## Trigger
- C0 complaint detection (R16) → run §§1–3 immediately
- Session close (session_manager §3 Step 0) → run §§1–3
- User explicit: "review CFP / improve harness" → run §§1–4

## §Section 1 — CFP Tally

\```
1. Read cfp_boot_count from working memory
   (missing from working memory? → read from .sessions/session_handoff.md as fallback)
2. grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → current_count
3. new_cfps = current_count - cfp_boot_count
4. new_cfps = 0 → emit [cfp-skip] → return (no further processing)
5. new_cfps > 0 → emit [cfp-tally] New CFPs this session: <N> (CFP-<X> through CFP-<Y>)
   → proceed to §Section 2
\```

## §Section 2 — Analysis

**Priority queue for ranking (do NOT use raw recurrence count alone):**
1. P1: CFPs logged THIS session (most actionable — fresh context)
2. P2: Historical CFPs sorted by recurrence count descending

\```
1. Extract session CFPs: grep -n "^## CFP-" CODING_FAILURE_PATTERNS.md
   → identify CFP-X through CFP-Y (the new ones from this session)
2. For each CFP:
   - Count recurrences: grep -c "CFP-[0-9]+" CODING_FAILURE_PATTERNS.md
   - Extract root cause, Prevention steps, Detection signal
3. Sort: session CFPs first → then historical by recurrence
4. Emit [cfp-analysis]:
   Top pattern: CFP-N · <title> · recurrence: N · root: <cause>
   Proposed fix: <which harness file + what to add/change>
\```

## §Section 3 — Proposal & Validate

\```
Step 1: Present top-ranked CFP fix to user:
  "พบ CFP-N: <title> (เกิดซ้ำ N ครั้ง)
   แนวทางแก้: <proposed change to harness file>
   ต้องการให้ปรับ harness ไหมครับ? (yes / skip / dismiss)"

Step 2: Dry-run validation — before user answers:
  Simulate: would the proposed fix have prevented the original complaint?
  Match proposed "Detection signal:" against actual user complaint text
  → PASS: signal would have caught it → present proposal
  → FAIL: emit [proposal-mismatch] → revise proposal (max 2 revisions) → re-validate
  → Still FAIL after 2 revisions → skip this CFP, move to next

Step 2.5: Check cfp_dismissed list in session_handoff.md
  → If this CFP-N is in cfp_dismissed → skip silently (user permanently dismissed)

Step 3: Handle user response:
  "yes" → proceed to §Section 4
  silence (>1 turn without response) → save as pending_proposal in handoff → re-present next session
    emit [cfp-pending] CFP-N: will re-present next session
  "skip" (this session) → increment cfp_deferred[CFP-N] in handoff
    deferred_count ≥ 3 → escalate: "CFP-N ถูกเลื่อนมา 3 ครั้ง — ต้องการ dismiss ถาวรไหมครับ?"
    emit [cfp-deferred] CFP-N · deferred count: N
  "dismiss" → add to cfp_dismissed[] in handoff (permanent)
\```

## §Section 4 — Implementation (harness edit)

**Invariants (hard rules — never violate):**
- MUST NOT edit `.agents/skills/self_improve/SKILL.md` itself → emit [blocked-self-edit] → present diff to user manually
- MUST NOT edit `INVARIANTS.md` without explicit user confirm

\```
Step 0 — Cooldown gate:
  Check last_self_improve_session in handoff
  → ran in last 2 sessions? → emit [cfp-cooldown] → skip §4 (return after §3)
  → exception: recurrence ≥ 5 OR user explicitly requested → bypass cooldown

Step 0.5 — INVARIANTS conflict check:
  grep INVARIANTS.md for any keyword from proposed change
  → conflict found → emit [blocked-invariant] → ask user to confirm before proceeding
  → no conflict → proceed

Step 0.6 — Backup:
  cp <target_harness_file> <target_harness_file>.backup_<YYYYMMDD>

Step 1 — Apply edit:
  Edit target harness file with proposed change
  (follow R5 index-first, [pre-edit] gate before any symbol edit)

Step 2 — Verify:
  grep target harness file for proposed addition → confirm present
  → PASS → emit [✓ harness-updated] File: <path> · Change: <what>
  → FAIL → restore from backup → emit [blocked] restore complete → report to user

Step 3 — Restore cleanup:
  verify passes → remove .backup file

Step 4 — Update harness_flow reference (if applicable):
  If the fix changes a guard rail or flow step → append row to harness_flow patch table

Step 5 — Update session_handoff.md:
  last_self_improve_session: <current session id>

Step 6 — Audit log:
  Append to .sessions/self_improve_log.md:
  ## SI-<N>: <session_id> · <date>
  CFP: CFP-<N> · File: <path> · Change: <one-line summary>
  Verify: pass | restored
  ---
\```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## variable_manager

```markdown
---
name: Variable Index Manager
description: Tracks variable, function, and component definitions and usage in knowledge/index_variables.json.
---

## Sections
\```
- id: 1
  name: "Symbol Sync"
  steps: ["update index_variables.json", "run python scripts/symbol_indexer.py", "update used_in links", "[✓ written] verify"]
\```

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

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

---

## harness_doctor

```markdown
---
name: harness_doctor
description: Structural fix agent for CFP patterns that recurred AFTER a fix was already applied. Reads index_cfp_fix.json + relevant harness files → proposes structural change → waits approval → executes following harness conventions.
---

## Sections
\```
- id: 1
  name: "Diagnosis"
  steps: ["load index_cfp_fix.json", "find top recurred CFP", "read CFP entry", "emit [diagnosis]"]
- id: 2
  name: "Harness Audit"
  steps: ["grep audit targets for group", "check hooks in settings.json", "classify gap type a|b|c|d", "emit [audit-finding]"]
- id: 3
  name: "Proposal"
  steps: ["draft structural fix", "dry-run validate", "present proposal", "HALT for approval"]
- id: 4
  name: "Approval Gate"
  steps: ["wait explicit user confirm", "no auto-proceed"]
- id: 5
  name: "Execute + Verify"
  steps: ["apply approved change", "update index_cfp_fix.json", "verify detection signal", "update CODING_FAILURE_PATTERNS.md"]
\```

---

**Triggered by:**
- self_improve §2.5 detects `recurred_after_fix[] not empty`
- User says "harness doctor" / "fix harness pattern" / "recurring cfp" / "ซ่อม harness"
- self_improve §3 escalation after deferred_count ≥ 3

**NOT triggered by:**
- First-time CFP with no fix attempt → use self_improve §3+§4 instead
- CFP with status=active and fixes=[] → not a structural recurrence yet

---

## Section 1 — Diagnosis

```
Step 1: Load index — find top recurred CFP
  python3 -c "
import json, os, sys
if not os.path.exists('knowledge/index_cfp_fix.json'):
    print('NO_INDEX'); sys.exit(0)
idx = json.load(open('knowledge/index_cfp_fix.json'))
candidates = {k: v for k, v in idx.items()
              if isinstance(v, dict) and v.get('recurrence_after_fix', 0) > 0}
if not candidates:
    print('NO_RECURRED')
else:
    top = max(candidates, key=lambda k: candidates[k]['recurrence_after_fix'])
    e = candidates[top]
    print('target:', top)
    print('group:', e['group'])
    print('recurrence_after_fix:', e['recurrence_after_fix'])
  "
  → NO_RECURRED → emit [harness-doctor-skip] · end skill
  → found → store: target_cfp · target_group · prior_fix_descriptions[]

Step 2: Read CFP entry from CODING_FAILURE_PATTERNS.md
  grep -n "^## target_cfp" CODING_FAILURE_PATTERNS.md → line L
  Read CODING_FAILURE_PATTERNS.md offset=L limit=30
  → extract: Symptom · Root cause · Prevention · Detection signal

Step 3: Emit [diagnosis]
  [diagnosis] target_cfp "<title>" · Group: target_group · Fixes tried: N · Model: current_model_id
```

---

## Section 2 — Harness Audit

**Group → Audit target mapping:**

| Group | Primary audit targets |
|---|---|
| `skip_planning` | CLAUDE.md R13 · AGENTS.md §Loop Architecture · PreToolUse hook |
| `boot_gap` | CLAUDE.md §Boot · AGENTS.md §Boot Sequence · PreToolUse hook |
| `skip_verification` | AGENTS.md §Phase 3 L4 · CLAUDE.md R12 |
| `rule_drift` | CLAUDE.md §R<N> matching violation · AGENTS.md §Quick Reference |
| `premature_report` | AGENTS.md §Completion Gate |
| `index_desync` | CLAUDE.md R8 · AGENTS.md §Backlink Rule |
| `db_safety` | CLAUDE.md R15 · INVARIANTS.md §I2 |
| `token_management` | CLAUDE.md R3 · AGENTS.md §TOKEN PAUSE |

```
Step 1: Grep audit targets for target_group (one Bash call)
Step 2: Check hooks in settings.json
Step 3: Classify gap — (a) signal too narrow · (b) no hook · (c) agent ignores · (d) rule missing
Step 4: Emit [audit-finding] Gap type · Location · Why prior fix failed · Evidence
```

---

## Section 3 — Proposal

```
Step 1: Draft fix based on gap type
  (a) Widen detection keywords in existing rule
  (b) Propose new PreToolUse/Stop hook entry
  (c) Rewrite rule as emit + HALT gate
  (d) Draft new R-N rule following existing format

Step 2: Dry-run — does change catch symptom? conflicts INVARIANTS.md?
Step 3: Present [harness-proposal] — HALT · do NOT execute yet
  → พิมพ์ "ทำเลย" เพื่อ execute หรือ "skip"
```

---

## Section 4 — Approval Gate

HALT until explicit user confirm. Accepted: "ทำเลย" / "proceed" / "yes" / "confirm"
Rejected: "skip" → write deferred to session_handoff.md · end skill.

---

## Section 5 — Execute + Verify

```
Step 1: Apply approved change (emit [pre-edit] · edit · [post-read] verify present)
Step 2: Update index_cfp_fix.json — append fix attempt · status: resolved-pending
Step 3: Verify detection signal catches symptom (re-run detection grep)
Step 4: Append under ### Fix Attempts in CODING_FAILURE_PATTERNS.md
Step 5: [✓ harness-fix] target_cfp · Gap: type · File: edited · Detection: verified
```

---

## MECE Constraints Block (copy into mece_plan.md for sections using `harness_doctor`)
\```
- Sections 1-2 (Diagnosis + Audit): read-only — no src/ or harness edits
- Section 3 (Proposal): emit [harness-proposal] then HALT · do NOT execute yet
- Section 4 (Approval Gate): wait explicit user confirm · no auto-proceed
- Section 5 (Execute): apply only the approved proposal — no scope creep
- [✓ harness-fix] trace required at completion · update index_cfp_fix.json status
\```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```

## harness_editor

```markdown
---
name: Harness Editor
description: Manages all edits to harness configuration files (CLAUDE.md, AGENTS.md, SKILL.md, knowledge/, Implement/) with mandatory MECE planning and full close sequence.
---

## Sections
\```
- id: 1
  name: "Diagnose & Plan"
  steps: ["wc-l scope probe", "File Size Contract check", "confirm mece_plan.md + T-N roadmap [/]"]
- id: 2
  name: "Edit & Verify"
  steps: ["[pre-edit] emit", "targeted Edit/Write", "[✓ written] grep verify", "5-element contract intact check"]
- id: 3
  name: "Close & Sync"
  steps: ["index sync (skill-manifest if new skill)", "harness_flow update", "Implement/ update", "roadmap [X]"]
\```

## Trigger
Activated when: task edits CLAUDE.md · AGENTS.md · any .agents/skills/*/SKILL.md · knowledge/ docs · Implement/ docs
Orchestrator delegates `Skill: harness_editor` from MECE plan.

⚡ **Invocation Gate (hard — no exceptions):**
ANY planning that includes harness file edits MUST resolve `skill_name=harness_editor` at Boot B2 BEFORE building the MECE plan.
Skipping this invocation = behavioral contract violation → log CFP-016.
Signals that trigger harness_editor: "edit CLAUDE.md / AGENTS.md / SKILL.md / knowledge/ / Implement/" + any task touching backlinks, index_files.json, topic_registry.json, or Implement/ docs.

## Refusal Contract
`[harness-skip]` — no harness file being modified → delegate to coder/editor
`[harness-refused]` — mece_plan.md missing or not dated today · no T-ID in roadmap · target >250L with no split plan

## Workflow — 5-stage cycle (AUDIT → PLAN → EDIT → CLOSE · CFP loops back on abnormal)
Stages 1→4 run forward. Abnormal at any stage → Stage 5 CFP → loop back to the failed stage with a DIFFERENT approach (never retry the same way twice).
Stage 1 · AUDIT (mandatory-first for structural SKILL.md edits): wc -l zone probe · structural SKILL.md edit → spawn skill_auditor (MANDATORY) · minor / non-SKILL.md edit → emit `[audit-skip]` + reason
Stage 2 · PLAN (gate — cannot skip): mece_plan.md dated today + T-N roadmap [/] · Parallel-cycle scan — group sections with NO shared file-write AND no mutual dependency into ONE parallel Cycle (spawn agents + barrier to rejoin); shared file OR dependency → serial; >=5 files/>=300L → spawn agents (R4), <5 files → main-context serial · record grouping in `### Cycle grouping`
Stage 3 · EDIT: [pre-edit] → targeted Edit → [✓ written] · SKILL.md edit → confirm 8 components survive · grep the file's ACTUAL section headers (never assume fixed names like "## Trigger")
Stage 4 · CLOSE (Index Sync + Docs Close): index sync (skill-manifest if new skill · topics[] from topic_registry.json · backlink_analyzer.py) · then Docs Close — edit a harness file → update its paired Implement/REPO doc in the SAME task per §Implement Map below · roadmap [/]→[X] · active_thread phase:done
Stage 5 · CFP (abnormal → loop back · do NOT retry blindly): emit [escalate] → self_improve → harness_doctor · log CFP · re-enter the failed stage with a DIFFERENT approach · 3rd consecutive fail → [blocked] + halt for user

### Implement Map (Stage 4 — closed list · no guessing · the "edit harness file → update its paired Implement doc" rule)
- CLAUDE.md (R-rules · gates)          -> Implement/03_config.md
- AGENTS.md (boot · routing · phases)  -> Implement/04_skills.md + Implement/06_orchestrator.md
- .agents/skills/*/SKILL.md            -> Implement/04_skills.md
- hook (.claude/settings.json)         -> Implement/02_setup.md (+ 03_config.md if token/loop logic)
- scripts/*.py                         -> Implement/05_scripts.md
- workflow / checklist change          -> Implement/08_checklist.md
- new file / dir / skill               -> REPO_MAP.md (mandatory entry)

⚡ Refusal gate: do NOT emit [harness-edit-done] until flow_updated=yes AND impl_updated=yes (Stage 4 complete — paired Implement doc synced per the map above)

## Output Contract
`[harness-edit-done] files: <N> · lines_changed: <total> · flow_updated: <yes|no> · impl_updated: <yes|no>`
Per changed SKILL.md: emit `wc-l: <N>L (🟢|🟡|🔴)` after verify.

**User-facing close (Thai — mandatory after `[harness-edit-done]`):**
```
งานเสร็จแล้วครับ ✅
แก้ไข <N> ไฟล์: <สรุปสั้น ๆ ว่าเปลี่ยนอะไร — ภาษาไทย>
สั่งงานต่อได้เลยครับ
```
Rule: [harness-edit-done] = harness signal (English · machine-readable) · user summary = Thai · always both · never English-only close.

## Routing
After [harness-edit-done] + Thai user summary → return to orchestrator / session_manager §3
New skill created → S4 (manifest+registry) must complete before returning

## MECE Constraints Block (copy into mece_plan.md for sections using `harness_editor`)
\```
- mece_plan.md dated today + T-N roadmap [/] REQUIRED before any file edit
- [pre-edit] emit before every Edit · [✓ written] grep verify after every change
- File Size Contract: ≤200L 🟢 · 201-250L 🟡 (SKILL_detail.md required) · >250L 🔴 HALT+split
- harness_flow_20260526.md + affected Implement/ MUST be updated in same task (Stage 4 · per §Implement Map — every harness file has a paired Implement/REPO doc)
- [harness-edit-done] emit required before returning to orchestrator
\```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
```
