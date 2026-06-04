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
      - Required keys present: cycle, section, status, verify_result, artifacts
      - status value in ["done", "blocked"] — if missing/invalid → treat as blocked
      - Invalid JSON or missing file → treat as blocked, log in notes
   b. Any status = blocked → HALT all remaining Cycles → BLOCKED flow
   c. All done → aggregate results → build context payload for Cycle N+1
6. Call `<spawn_tool>` for Cycle N+1 — inject cycle_N results as `cycle_context:` in each Subagent Prompt
7. Repeat until all Cycles done → Completion Gate
\```

**Delegation Contract — every sub-agent prompt must include:**
- `goal:` what to produce
- `constraints:` relevant rules from CLAUDE.md (R5, R6, R8)
- `output_format:` exact structure expected (JSON schema or table)
- `context_files:` only files the sub-agent needs (no full index)
- `cycle_context:` structured results from prior Cycle(s) — omit if Cycle 1

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
  "notes": ""
}
\```
Path: `.sessions/cycle_N_<section_id>.json`

## Skill Delegation Rules
- Creating new files/features → `coder` skill
- Modifying/fixing existing files → `editor` skill
- Any file created/moved/deleted → also trigger `file_manager`
- Any symbol created/renamed/deleted → also trigger `variable_manager`
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

# Write entry at bottom of knowledge/error_index.md:
## ERR-XXX: <Short title>
- **Task:** T-{N}-{BugID}-01 · **Session:** session_<NNN>
- **File:** src/path/to/file.ts · **Line:** <N>
- **Symptom:** <what the error looked like>
- **Root Cause:** <why it happened>
- **Resolution:** <exact fix applied>

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
   grep -A 12 'symptom_keyword\|ERR-00' knowledge/error_index.md | head -30
   \```
   Found matching ERR-XXX → apply resolution immediately, no re-analysis needed.
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
7. **Loop Traces**: Emit traces per CLAUDE.md format — `[Boot]`, `[loop]`, `[✓ written]`, `[blocked]`, `[pause]` etc.

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
  Steps: [A] → [B] → [C]
  Verify: <checkable — grep/compile/read-back, never subjective>
  Rollback: <what to undo if this section fails>

Section 2 — <name from Skill sections[1]>:
  Steps: [D] → [E]
  Verify: <checkable condition>
  Rollback: <what to undo>

Independent (any section): [X] · [Y]

Cycle grouping (add when plan has ≥ 2 sections):
  Cycle 1: [S1, S2]          ← sections with no dependencies between them
  Cycle 2: [S3]              ← depends on output of S1 or S2
  S3 context-input: cycle_1_S1.json, cycle_1_S2.json
\```
Rules:
- Sections in the same Cycle are spawned in parallel
- Sections in Cycle N+1 declare which `cycle_N_*.json` files they need
- Single-section plans have no Cycle grouping (omit Cycle block)
\```

Rules:
- Sections must match target Skill sections[] exactly (same count and names)
- Each step = 1 atomic action (1 file edit, 1 script run, 1 index update)
- Verify must be executable — never "looks right"
- Independent steps have no section dependency

---

## Execution Protocol

\```
Section 1 — Build Plan:
  [S1-A] Read target Skill SKILL.md → parse sections[]
  [S1-B] Map MECE steps to each section (use templates below as base)
  [S1-C] Add Verify + Rollback per section
  Verify: plan section count = Skill section count

Section 2 — Confirm & Register:
  [S2-A] Send plan to user → wait confirm
         (accept: "ok", "go", "ดำเนิน", "yes", explicit approval)
  [S2-B] Add R-Roadmap entry per section: [ ] T-<N>: <section-name>
  [S2-C] Emit [✓ MECE]
  Verify: roadmap entries exist for all N sections
\```

On failure → STOP → report which step failed → do not auto-recover.

---

## Templates by Task Type

### Bug Fix (target: editor)
\```
Section 1 — Diagnose:
  [A] R9 3-checks: error_index → symbol_index → file_index
  [B] Read source at line → confirm symptom
  Verify: blast radius known · ERR candidate confirmed or ruled out
  Rollback: no changes yet

Section 2 — Edit & Verify:
  [C] Apply targeted fix
  [D] [✓ written] grep verify change exists
  Verify: grep symptom → 0 results
  Rollback: revert edit

Section 3 — Sync & Close:
  [E] python scripts/symbol_indexer.py
  [F] Write ERR-XXX to error_index.md · [✓ written] verify
  [G] Mark roadmap [X] T-{N}-{BugID} (→ ERR-XXX)
  Verify: ERR entry exists · roadmap [X]
  Rollback: remove ERR entry if incorrect
\```

### New Feature (target: coder)
\```
Section 1 — Scope & Index:
  [A] R4 scope probe · check index for conflicts
  Verify: no duplicate symbols or file paths
  Rollback: n/a

Section 2 — Build:
  [B] Create file(s) · [✓ written] verify each
  Verify: files exist at correct paths
  Rollback: delete created files

Section 3 — Sync & Close:
  [C] file_manager: update index_files.json + backlinks
  [D] variable_manager: update index_variables.json
  [E] python scripts/symbol_indexer.py · Mark roadmap [X]
  Verify: symbol count increased · no stale backlinks
  Rollback: restore index from last known state
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
**[cycle N]**  All <X> sections done · results: .sessions/cycle_N_*.json · spawning Cycle <N+1>
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
description: Handles TOKEN PAUSE, BLOCKED halt, session rotation, and resume flows. Maintains session JSON and active_thread.md.
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

### Smart Output Truncation
Tool outputs > 1,000 chars → keep first + last 20 lines, separated by `\n...[Truncated]...\n`

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
   latest_result: <last tool output summary>
3. Append to active session History with status "paused_token_limit"
4. Show user:
   "ทำเสร็จแล้ว <X>/<N> sections
    ค้างที่: Section <N> step <name>
    ดำเนินการต่อไหมครับ?"
5. On confirm:
   → Reload config (target Skill context_files)
   → Check MECE plan: reuse if state unchanged, rebuild if scope changed
   → Reset loop to pending section → continue Phase 3
\```

### BLOCKED (step failed after 2× retry)
Triggered from Loop Phase 3 when verify or observe fails twice.

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
1b. Read `.sessions/cycle_N_*.json` for the last completed Cycle (N = current_cycle from handoff)
    → inject as `cycle_context:` before spawning Cycle N+1 agents
2. Reload config: Read target Skill SKILL.md context_files
3. MECE: load existing plan from handoff → reuse if valid · rebuild if scope changed
4. Emit [resume] trace
5. Open REACT LOOP at first pending section
\```

---

## Section 3 — Manual Close (user says "ปิด session / close / จบงาน / done")

**Trigger:** User explicitly requests session end — NOT a token pause or blocked state.

**5 mandatory file writes — do NOT summarize without completing all:**

\```
Step 1 — Find and close current session JSON
  Bash: ls -t .sessions/session_*.json | head -1    → identify active session file
  Read: active session file
  Edit: set "status": "completed"
  Edit: write "summary_context": "<what was accomplished this session>"

Step 2 — Reset session_tokens.md for next session
  Write: .sessions/session_tokens.md
  Content:
    SESSION_TOTAL: 0
  Note: Final token count goes into session JSON summary_context (Step 1) — this file resets to 0 so the next session starts clean

Step 3 — Write active_thread.md
  Write: .sessions/active_thread.md
  Content:
    task: <what was done this session>
    phase: done
    next: <next action if any, else "none">

Step 4 — Write session_handoff.md (ALWAYS — even if task is complete)
  Write: .sessions/session_handoff.md
  Content:
    status: completed
    session_id: <session_id>
    tasks_done: [list of T-IDs completed]
    tasks_pending: [list of T-IDs still open, or "none"]
    last_action: <final action taken>
    next_session_start: <what to do first next time>

Step 5 — Confirm to user (list every file written)
  Reply format:
    ✅ Session ปิดแล้วครับ — ไฟล์ที่บันทึก:
    · .sessions/session_<NNN>_<topic>.json → status: completed
    · .sessions/session_tokens.md → SESSION_TOTAL: ~<N>k
    · .sessions/active_thread.md → phase: done
    · .sessions/session_handoff.md → next: <summary>
\```

**Never report "session closed" before all 4 files are written.** Summary text alone = incomplete close.

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
Input  = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
Output = (thai_chars × 1.7) + (en_chars × 0.3)
context_overhead: Turn 1 = ~4,000 | subsequent = 200 + (SESSION_TOTAL × 0.08)
\```

**Write to `.sessions/session_tokens.md`** ONLY at:
- TOKEN PAUSE (R3 >60k)
- BLOCKED halt
- Completion Gate (task done)

**Footer every response:** `*(Session total: ~NNN tokens)*`

---

## Formulas Reference

| Content | Multiplier | Rationale |
|---|---|---|
| Thai chars | × 1.7 | ~1.5–2.5 tokens/char (UTF-8 multi-byte) |
| English chars | × 0.3 | ~4 chars/token |
| Tool results | × 0.3 | same as English |
| Turn 1 overhead | ~4,000 | CLAUDE.md + skills loaded |
| Subsequent overhead | 200 + (total × 0.08) | conversation history growth |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| > 60k | TOKEN PAUSE → finish current loop step → save state → ask user |
| > 90k | HALT immediately → save state → report to user |

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
