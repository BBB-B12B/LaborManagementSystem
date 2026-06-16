---
name: Agent Core
description: Fallback orchestration skill. Loaded when no keyword matches. Re-routes to correct skill via registry. Does not run main work loop directly.
triggers:
  - "spawn agent"
  - "delegate to agent"
  - "run in parallel"
  - "orchestrate"
  - "cycle fan-out"
---

## Sections
```
- id: 1
  name: "Route & Orchestrate"
  steps: ["read registry.md fast-match table", "re-evaluate user intent", "load correct skill → hand off"]
```

---

# Agent Core

## Trigger
Activated when:
- No skill keyword matches user intent → fallback orchestrator route
- Task has ≥2 independent MECE sections → multi-agent Cycle fan-out needed
- MECE plan Cycle grouping declares parallel sections to spawn

## When NOT to Use
- Task fits in main context (<5 tool calls, <5 files) → emit `[agent-inline] reason:fits-main-context` · proceed inline (this is a routing choice, not a refusal — no [agent-refused]) · spawning adds overhead with no gain
- Task requires interactive back-and-forth with user mid-execution → keep in main context · agents cannot interrupt
- Cycle depth > 1 (agent spawning agents) → HALT · max spawn depth = 1 · escalate to orchestrator
- No MECE plan written → do not spawn ad-hoc · write plan first · emit `[agent-refused] reason:no-plan`

## Refusal Contract
Halt and emit `[agent-refused]` if:
- Task requires direct `src/` edits → delegate to `editor` or `coder`, never execute directly
- Sub-agent depth would exceed 1 (no sub-agents spawning further agents)
- T-IDs not pre-assigned before any spawn (INVARIANTS.md §I6)

## Workflow
Route: resolve skill_name (B2) → delegate to specialist skill OR orchestrate Cycle fan-out (spawn parallel Executors) → aggregate results → Completion Gate (Reviewer haiku).
Full orchestration detail: `## Orchestration Protocol` · `## Skill Delegation Rules` below.

## Output Contract

| Action | Required emit |
|---|---|
| Re-route | `[route] Matched: <skill> · Loading SKILL.md` |
| Route limit hit | `[route-limit] Staying on current skill · count: 3` |
| Platform unknown | `[platform-unknown] → running B4 probe` |
| Cycle spawn | `[cycle N] Spawning <X> sections · parallel: <yes\|no>` |
| Cycle done | `[cycle N] All done · results: cycle_N_*.json` |
| Any section blocked | `[blocked] Section: <S> · Cause: <reason> · Halting all remaining cycles` |
| Completion | Reviewer sub-agent result: PASS or FAIL list |

**Behavior Contract — Cycle HALT (fires when any section returns status: blocked):**
```
Pre:    cycle_N_<section>.json written with status: "blocked" · remaining sections still pending
Contract: HALT all remaining cycle spawns → emit [blocked] Section: <S> · Cause: <reason> · Halting
          do NOT spawn further sections · report blocked_count + cause to orchestrator
          orchestrator MUST ask user "fix or skip?" before any further cycles
Post:   [blocked] emitted · remaining sections NOT spawned · user decision received
Enforce: spawning sections after blocked status = [violation] BC-cycle-halt → HALT + re-emit [blocked]
```

Required files written:
- `.sessions/cycle_N_<section_id>.json` — every spawned section before Cycle N+1

## Operating Stance
- Orchestrator, not executor. Coordinates only — never writes code or edits files directly.
- MECE before spawn. Every cycle fan-out requires a written MECE plan with Cycle groupings declared.
- Barrier discipline. Sequential dependencies go in Cycle N+1. Parallel work goes in Cycle N. Never mix.
- LOOP_WEIGHT accounting. Each Agent() spawn = +3 LOOP_WEIGHT. Run a TOKEN CHECK before each Cycle (thresholds live in the Token Check block below).

## Routing Protocol
```
1. Read .agents/skills/registry.md → fast-match table
2. Re-evaluate user intent against all skill keywords[]
3. Load matched skill SKILL.md → hand off to Phase 1 (Info Gather Loop)
4. If still no match → ask user to clarify intent
5. Re-route guard: track `last_skill` and `reroute_count` in working memory
   - If target skill = `last_skill` from previous section → skip re-route (guard fires)
   - If `reroute_count` ≥ 3 → stay on current skill → emit [route-limit]
   - Reset `reroute_count` to 0 at each new task start
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
   c. All done → aggregate results → build **trimmed** context payload for Cycle N+1:
      - Include per result: `status`, `verify_result`, `artifacts` (paths only), `notes`
      - Exclude: raw file content read during the cycle (content stays in artifacts on disk)
      - Apply Context Trim to any `context_files:` passed forward (see Delegation Contract)
   d. **Token merge (INVARIANTS.md §I7):**
      - Sum `tokens_estimated` from all cycle_N_*.json result files in this Cycle
      - Add sum to SESSION_TOTAL in working memory
      - Write updated SESSION_TOTAL → `.sessions/session_tokens.md`
      - Missing `tokens_estimated` in any result → add 2,000 tokens flat as conservative buffer
      - Run R3 threshold check immediately after update
**Token Check before spawning Cycle N+1:** apply the thresholds in AGENTS.md §C0.5 (single source of truth — PRIMARY = CHAT_TOTAL · LOOP_WEIGHT secondary · soft [compact-rec] at CHAT>80k · hard [compact-STOP] only at SESSION>90k OR CHAT>120k). Read [token-state] hook values, not session_tokens.md (subagents overwrite it).
- **LOOP_WEIGHT per-spawn:** each Agent/Workflow spawn = +3 LOOP_WEIGHT (PostToolUse hook automatic) · N parallel agents in one Cycle → LOOP_WEIGHT += N×3 · re-check after every Cycle before spawning the next.
6. Call `<spawn_tool>` for Cycle N+1 — inject cycle_N results as `cycle_context:` in each Subagent Prompt
7. Repeat until all Cycles done → Completion Gate:
   **[Reviewer] Spawn haiku sub-agent (read-only) — BEFORE reporting done to user:**
   - Prompt: Verify-N list from mece_plan.md + grep commands per criterion
   - Output: `PASS` (all criteria met) OR `FAIL: [section, criterion, actual_output]`
   - On FAIL → structured diff → main agent retries that section (1× max) → R13 escalate if still fails
   - Reviewer has no Edit/Write tools — read-only verification only
   - Skip Reviewer if task has ≤2 sections AND no [gate]/DB actions (lightweight tasks)
   - **Reviewer PASS ≠ task closed** → run AGENTS.md §Phase 3 Close (session_handoff + active_thread phase:done + mece_plan PATH A clear + R8 index sync) before reporting done to user
```

**Delegation Contract — every sub-agent prompt must include:**
- `goal:` what to produce — **1–3 sentences max**
- `constraints:` **rule numbers only** — e.g. `R5,R6,R8` — NEVER copy rule text into prompt
- `output_format:` exact structure expected (JSON schema or table)
- `context_files:` **file paths only** — sub-agent reads via R5 grep+targeted-read
  - **NEVER inline file content** in the prompt — paths only, no content
  - Hard limit: **≤5 file paths** per sub-agent · if more needed → summarize in `goal:` instead
  - **Context Trim** (run before setting `context_files:`):
    1. For each candidate file: check its `[post-read]` verdict from this session
    2. `irrelevant` verdict → exclude entirely
    3. `partial` verdict → pass excerpt reference only (`<file>` L<N>–L<N>), not full path
    4. No verdict yet → include path (sub-agent greps as needed)
- `cycle_context:` prior cycle summary — **≤5 bullets, ≤150 chars each** — omit if Cycle 1
  - Build from result files: `status` + `artifacts` (paths only) + `notes` — NEVER raw JSON content
  - Drop oldest cycles first if >5 bullets total — keep most recent cycle only

**Prompt token budget — hard limit: ≤800 tokens total**
```
goal ~100 + constraints ~20 + context_files paths ~100 + cycle_context ~200 = ~420 typical
```
If draft exceeds 800 → trim in order: cycle_context → context_files → goal

**Spawn Context Gate (run before every cycle spawn):**
- Count total chars of cycle_context being injected across ALL agents in this spawn batch
- Total > 2,000 chars → summarize further: status + artifact filename only (no full paths)
- NEVER inject: session History, knowledge/*.json files, CLAUDE.md text, full file reads

**Spawn call structure — varies by platform (read from `.agents/platform/detected.md`):**

Antigravity 2.0 example:
```json
{
  "Subagents": [
    {
      "TypeName": "self",
      "Role": "<section name>",
      "Prompt": "<goal 1-3 sentences> | constraints: R5,R6,R8 | output_format: cycle_N_<id>.json | context_files: [path/a, path/b] | cycle_context: [S1: done · artifact: path/x, S2: done · artifact: path/y]",
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
  "tokens_estimated": 0,
  "notes": ""
}
```
Path: `.sessions/cycle_N_<section_id>.json`

**Behavior Contract — Sub-agent Result Gate (fires before any sub-agent returns to orchestrator):**
```
Pre:    sub-agent section complete · about to signal done to orchestrator
Contract: MUST write cycle_N_<section_id>.json with status + verify_result + artifacts before returning
          file must exist at path and be valid JSON
          skip write → [violation] BC-result-gate → write file now · re-signal done
Post:   cycle_N_<section_id>.json exists · orchestrator reads status field to route next action
Enforce: orchestrator receives done signal without cycle JSON file = [violation] BC-result-gate → sub-agent writes file · re-signals
```

## Skill Delegation Rules

**Priority 1 — explicit `Skill:` field in MECE plan section:**
Read `Skill:` from the section definition before applying any heuristic.
`Skill:` declaration overrides all heuristics below.
If section has `Skill: coder` → spawn coder sub-agent regardless of action type.

**Priority 2 — heuristics (when `Skill:` not declared):**
- Creating new files/features → `coder` skill
- Modifying/fixing existing files → `editor` skill
- Any file created/moved/deleted → also trigger `file_manager`
- Any symbol created/renamed/deleted → also trigger `variable_manager`

**Multi-skill sections (`Skill: X + Y`):**
- Execute X first → verify → then execute Y
- Both sub-agents write to same `cycle_N_<section_id>.json`
  X writes first, Y appends `"artifacts"` and updates `"status"`
- If X fails → do not run Y → mark section blocked

## Tone Guide
Keep:   `[cycle N]` · `[agent-refused]` + reason · `[spawn]` + label · `[barrier-wait]`
Strip:  internal deliberation · spawn rationale prose
Format: `[signal] Cycle: N · Spawning: N agents · Labels: <A,B,C>`
Prohibited: "I'll now delegate this to..." · "Let me spawn an agent for..."

**Hard Rules (NEVER):**
- NEVER write code or run modifying Bash directly — always delegate to correct skill
- Sub-agents MUST NOT spawn further agents (max depth = 1)
- NEVER spawn without MECE plan declaring Cycle groupings — ad-hoc spawns skip the barrier gate
- NEVER mix shared-file writers in the same Cycle — race condition = silent data corruption
- NEVER spawn depth >1 — agent spawning agents prohibited · escalate to orchestrator
- NEVER emit [cycle N] without a TOKEN CHECK first (thresholds per the Token Check block / AGENTS.md C0.5)

## MECE Constraints Block (copy into mece_plan.md for sections using `agent`)
```
- Pre-assign ALL T-IDs before spawning any sub-agent (INVARIANTS.md §I6)
- Sub-agent prompts MUST include `constraints:` block (AGENTS.md §Sub-agent Rules R4)
- Each section agent outputs `.sessions/cycle_N_<section_id>.json` — required before Cycle N+1
- TOKEN CHECK before each Cycle spawn — thresholds live in AGENTS.md (Per-Turn Routing, C0.5); never hard-code numbers here
- HALT all remaining Cycles if any section status = blocked (no auto-proceed)
```

---

→ Spawn call structure examples (Antigravity/Claude Code), sub-agent result schema, environment paths:
`@.agents/skills/agent/SKILL_detail.md`
