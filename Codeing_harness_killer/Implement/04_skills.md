## 5. Skill Templates

### 5a. `.agents/skills/file_manager/SKILL.md`

```markdown
---
name: File Index Manager
description: Manages file lifecycle and import backlinks in knowledge/index_files.json.
---

## Triggers
1. **Create/edit file with imports** — append this file to the `backlinks` array of every file it imports.
2. **Delete file** — remove its entry AND remove it from all other files' `backlinks` arrays.
3. **Remove import during edit** — remove the backlink from the target file.
4. **Create/move/delete directory** — update REPO_MAP.md directory layout to reflect current structure.

## Pre-Analysis
Before any structural change: grep index_files.json for the target path and review all backlinks that may be affected.

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

### 5b. `.agents/skills/variable_manager/SKILL.md`

```markdown
---
name: Variable Index Manager
description: Tracks exported symbols and line numbers in knowledge/index_variables.json.
---

## Triggers
1. **Create any symbol** — Component, function, hook, type, constant, or API logic.
   Add entry: { type, source, line, used_in: [] }
2. **Edit symbol body (any code change)** — run python scripts/symbol_indexer.py to refresh line numbers.
   Line drift is silent and breaks future lookups.
3. **New consumer** — append consumer path to the symbol's used_in array.
4. **Rename** — update JSON key + trace all used_in files to rename call sites.
5. **Delete** — remove entry from JSON.

## Pre-Analysis
Before any refactor: grep index_variables.json for the symbol → read used_in → assess blast radius.

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

### 5c. `.agents/skills/mece/SKILL.md`

```markdown
---
name: MECE Planner
description: Generates MECE plans before any edit/create task with >3 steps or side effects.
---

## Triggers
- Task has >3 steps
- Any irreversible action (file create/delete, import change, DB write, API call)

## Skip
- Read-only tasks
- Single-file edit where backlinks = 0 and no ERR needed

## Plan Format
```
Goal: <what we're achieving>
Sequential: [step1] → [step2] → [step3]
Parallel:   [stepA] + [stepB]
Verify:     <how to confirm success>
```

Send plan to user → wait for confirm → execute one group at a time → verify → proceed.

## Token Checkpoints
- **[tokens] A** — before executing (input estimate)
- **[tokens] B** — after main execution (running total)
- **[tokens] C** — final (write SESSION_TOTAL)

## Trace
`**[MECE]** Plan sent · Groups: N · Waiting confirm`

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5d. `.agents/skills/coder/SKILL.md`

```markdown
---
name: Coder (Creator)
description: Focused skill for implementing new features and creating application files.
---

## Roadmap Protocol (MANDATORY — before and after every task)

**Before writing any code:**
1. grep docs/master_roadmap.md for existing task matching this work
   → Found: note Task ID → set status [/]
   → Not found: assign next T-<N> → add `[ ] T-<N>: <description>` to roadmap

**After completing code:**
1. Mark roadmap: `[X] T-<N>: <description> · session_<NNN>`
2. Call file_manager + variable_manager to sync indexes
3. If a new directory was created:
   → Update REPO_MAP.md directory layout section to reflect new structure
4. If a new library/package was imported (new entry in package.json or requirements.txt):
   → Add constraint note to AGENTS.md §Critical Project-Specific Rules

## Coding Standards
1. Framework conventions: new files in src/app/, src/components/
2. Database integrity: match Drizzle schemas to Technical Requirements Document
3. Self-correction: fix any TypeScript/linter error immediately before finishing
4. Aesthetics: TailwindCSS standard utility classes, minimalist modern enterprise look

## Limitations
- DO update docs/master_roadmap.md — roadmap entries are mandatory
- DO NOT manipulate .agents/ or *.json index files directly — call file_manager + variable_manager after creating files

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5e. `.agents/skills/editor/SKILL.md`

```markdown
---
name: Code Editor
description: Focused skill for surgically editing, modifying, and debugging existing code.
---

## Roadmap Protocol (MANDATORY — before and after every edit)

**Before editing:**
1. grep docs/master_roadmap.md for parent task → assign T-{N}-{BugID}-01
   → Add `[ ] T-{N}-{BugID}-01: <description>` to roadmap → set `[/]`
2. Run R6 3-step checks (error_index → roadmap → index_variables) before touching code

**After editing:**
1. Run python scripts/symbol_indexer.py
2. Mark roadmap `[X] T-{N}-{BugID}-{Attempt} (→ ERR-XXX if bug fix)`
3. Call variable_manager if symbol body changed
4. If bug required ≥ 2 attempts to fix:
   → เสนอร่างข้อเสนอ CFP (Symptom, Root Cause, Resolution) แก่ผู้ใช้เพื่อยืนยันความถูกต้อง ห้ามบันทึกเข้า CODING_FAILURE_PATTERNS.md โดยตรง
5. If a new library was added during the fix:
   → Add constraint note to AGENTS.md §Critical Project-Specific Rules

## Editing Best Practices
1. **Index-first lookup** — grep index_variables.json for symbol → get line → Read offset+limit
2. **Edit targeted** — sed for <5 lines; edit tool with only changed block for more
3. **Never Read full file >80 lines** without finding line number via grep first
4. **Bug fixing** — search error_index.md first; if found apply resolution immediately

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5f. `.agents/skills/session_manager/SKILL.md`

```markdown
---
name: Session Manager
description: Handles TOKEN PAUSE, BLOCKED halt, session rotation, and resume flows. Maintains session JSON and active_thread.md.
---

## Sections
```
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
    - "archive + clear .sessions/mece_plan.md"
    - "confirm to user: list all files written"
```

---

# Session Manager

## Section 1 — Session State

### Session Rotation (new task or topic switch)
1. Open current `.sessions/session_xxx.json` → set `"status": "completed"` (or `"paused"`)
2. Write final summary into `"summary_context"`
3. Create new `.sessions/session_<NNN>_<topic>.json`:

```json
{
  "session_id": "session_003_master_data",
  "associated_tasks": ["T-007"],
  "status": "in_progress",
  "estimated_tokens": 0,
  "summary_context": "",
  "History": []
}
```

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

```
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
   → Read `.sessions/mece_plan.md` → find first [/] or [ ] section
   → Reset loop to that section → continue Phase 3
```

### BLOCKED (step failed after 2× retry)
Triggered from Loop Phase 3 when verify or observe fails twice.

```
1. HALT all remaining sections immediately
2. Write .sessions/session_handoff.md with status "blocked"
3. Show user:
   "ติดปัญหาที่: Section <S> step <name>
    สาเหตุ: <cause>
    ทำสำเร็จแล้ว: [sections_done]
    ยังค้างอยู่: [sections_pending]
    แก้ก่อนดำเนินการต่อ หรือ skip section นี้?"
4. Wait for user decision:
   → Fix: user resolves → reload → resume from blocked section
   → Skip: mark section [X] with note "skipped: <reason>" → continue to next section
```

### Resume Flow
```
1. Read .sessions/session_handoff.md → load sections_done + sections_pending + last_step
2. Reload config: Read target Skill SKILL.md context_files
3. MECE: read `.sessions/mece_plan.md` → find first [/] or [ ] section → reuse plan if valid · rebuild if scope changed
4. Emit [resume] trace
5. Open REACT LOOP at first pending section (Phase 3 step 0: mark `[ ]` → `[/]` before first tool call)
```

---

## Section 3 — Manual Close (user says "ปิด session / close / จบงาน / done")

**Trigger:** User explicitly requests session end — NOT a token pause or blocked state.

**6 mandatory steps — do NOT summarize without completing all:**

```
Step 0 — R19 Self-Eval (run BEFORE writing any close files)
  Run post-task checks per CLAUDE.md §R19:
  · routing_ok  — skill used matched skill-manifest.json for each section?
  · budget_ok   — tool calls stayed ≤5 per turn?
  · invariant_ok — no I1–I5 tripped unexpectedly?
  · index_ok    — R8 Index Sync completed without error?
  · new_pattern  — any failure absent from CODING_FAILURE_PATTERNS.md?

  If routing_ok=false OR budget_ok=false:
    Write: .agents/skill-patches/pending/<skill>-gap-<YYYY-MM-DD>.md (use _template.md)
    Edit: registry.md → lower that skill's score by 0.5
  If new_pattern=true:
    Write: knowledge/cfp-proposals/CFP-draft-<YYYY-MM-DD>.md
    Present draft details (Symptom, Root Cause, Correct Resolution) to user and ask:
      "พบ failure pattern ใหม่ ต้องการตรวจสอบและยืนยันการเพิ่ม CFP บรรทึกเข้าระบบหรือไม่? (y/n)"
    → y: เมื่อผู้ใช้เห็นชอบและคอนเฟิร์มรายละเอียดความถูกต้องเรียบร้อยแล้ว จึงบันทึกต่อท้าย (append) ลงใน CODING_FAILURE_PATTERNS.md
    → n: ย้ายไฟล์ร่างไปไว้ในโฟลเดอร์ applied โดยตั้งสถานะเป็น declined ใน frontmatter
  All pass → proceed immediately to Step 1

Step 1 — Find and close current session JSON
  Bash: ls -t .sessions/session_*.json | head -1    → identify active session file
  Read: active session file
  Edit: set "status": "completed"
  Edit: write "summary_context": "<what was accomplished this session>"

Step 2 — Reset session_tokens.md for next session
  Write: .sessions/session_tokens.md
  Content:
    SESSION_TOTAL: 0
  Note: Final token count goes into session JSON summary_context (Step 1) — this file resets to 0 so the next session starts clean. Reset happens at session close only — never mid-session.

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

Step 5 — Archive and clear mece_plan.md
  Read: .sessions/mece_plan.md
  Append to Session Archive section:
    ### Closed: <date>
    Done: [S1, S2, ...] | Remaining: [S3, ...] | Summary: <one-line task summary>
  Rewrite Sections block to empty template:
    ## Sections
    <!-- Orchestrator will write here at next Phase 2 -->
  Note: Session Archive block is KEPT — only Sections block is cleared

Step 6 — Confirm to user (list every file written)
  Reply format:
    ✅ Session ปิดแล้วครับ — ไฟล์ที่บันทึก:
    · .sessions/session_<NNN>_<topic>.json → status: completed
    · .sessions/session_tokens.md → SESSION_TOTAL: ~<N>k
    · .sessions/active_thread.md → phase: done
    · .sessions/session_handoff.md → next: <summary>
    · .sessions/mece_plan.md → Sections cleared · Archive updated
```

**Never report "session closed" before all 6 steps are completed.** Summary text alone = incomplete close.

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5g. `.agents/skills/token_auditor/SKILL.md`

```markdown
---
name: Token Auditor
description: Analyzes wasteful token consumption when SESSION_TOTAL > 60k. Identifies root cause and logs optimization lesson.
---

## Sections
```
- id: 1
  name: "Audit"
  steps: ["read session History", "run 3 audit checks", "log lesson to optimization_logs.md", "gate-confirm → inject rule into offending skill"]
```

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
   ```
   Date: <date> · Session: <session_id>
   Total tokens: ~<N>k
   Root cause: <check that failed>
   Rule injected: <what was added>
   ```

2. **Self-Healing** → if a skill caused the waste:
   - Emit `[gate] token_auditor: inject rule into <skill>/SKILL.md — confirm? y/n` → wait user confirm
   - On confirm: add a STRICT rule to that skill's SKILL.md `## Sections` steps to prevent recurrence.

3. **Halt Threshold** → if SESSION_TOTAL > 90k: set session `"status": "paused_limit_reached"` → HALT → notify user per R3.

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5h. `.agents/skills/token_tracker/SKILL.md`

```markdown
---
name: Token Tracker
description: In-memory token estimation per R1. SESSION_TOTAL read once at Boot, estimated in memory per turn, written to file only at checkpoints.
---

## Sections
```
- id: 1
  name: "Track"
  steps: ["load SESSION_TOTAL at Boot (once)", "estimate in memory each turn", "write at checkpoints only"]
```

---

# Token Tracker

## Core Model (R1)

SESSION_TOTAL lives in working memory for the session duration. File I/O only at checkpoints.

**Read:** Once at Boot B1 — load into memory. No further reads this session.

**Estimate each turn (in memory):**
```
Input  = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
Output = (thai_chars × 1.7) + (en_chars × 0.3)
context_overhead: Turn 1 = ~4,000 | subsequent = 200 + (SESSION_TOTAL × 0.08)
```

**Write to `.sessions/session_tokens.md`** at:
- **End of every response** — write updated SESSION_TOTAL so Boot B1 reads the correct value next turn
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

## Tool Result Measurement

After **every** tool call that returns content, measure and add to SESSION_TOTAL:

**Step 1 — Classify by source:**
| Source | Apply |
|---|---|
| `.md`, `.txt`, `.sessions/*` | Split formula — Thai likely |
| `.ts`, `.js`, `.json`, `.sql` | `total × 0.3` — code is English |
| Bash/grep output | Check for Thai presence → use split if found |

**Step 2 — Calculate:**
- Thai range: U+0E00–U+0E7F
- `tokens = (thai_chars × 1.7) + ((total_chars − thai_chars) × 0.3)`
- No Thai detected → `tokens = total_chars × 0.3`

**Step 3 — Bash char-count pattern** (append to any command with significant output):
```bash
result=$(your_command_here); echo "$result"; \
printf "[chars: total=%s thai=%s]\n" \
  "$(echo "$result" | wc -m)" \
  "$(echo "$result" | grep -oP '[\x{0e00}-\x{0e7f}]' | wc -l 2>/dev/null || echo 0)"
```
Read the `[chars: total=N thai=N]` line → apply Step 2 → add to SESSION_TOTAL → write file.

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| > 60k | TOKEN PAUSE → finish current loop step → save state → ask user |
| > 90k | HALT immediately → save state → report to user |

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5i. `.agents/skills/identity/SKILL.md`

```markdown
---
name: Agent Identity
description: Defines the persona and communication style of the AI. Execution rules live in CLAUDE.md Loop Architecture.
---

## Sections
```
- id: 1
  name: "Persona"
  steps: ["apply communication style", "emit loop traces per CLAUDE.md format", "append token footer"]
```

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
1. Active `.sessions/session_xxx.json` has `"status": "completed"`.
2. `.sessions/active_thread.md` has `phase: done`.

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---

### 5j. `.agents/skills/agent/SKILL.md`

```markdown
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
<!-- EDIT: replace with your project path -->
- Libraries: `[PROJECT_ROOT]/Libraries`
- IDE Context: `[PROJECT_ROOT]/IDE`
- Python install: `pip install <pkg> --target=[PROJECT_ROOT]/Libraries/python`
- NPM install: `npm install <pkg> --prefix=[PROJECT_ROOT]/Libraries/npm`
- Execution: `export PYTHONPATH=$PYTHONPATH:[PROJECT_ROOT]/Libraries/python`

## Context Gate (all skills)
If during this task a new hard constraint was discovered (a rule that must never be violated):
→ Add to INVARIANTS.md §I2 before closing task
```

---
