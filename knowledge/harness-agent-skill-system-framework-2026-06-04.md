# Harness Agent — Skill System Framework Reference
date: 2026-06-04
status: active
related: 9arm-skills-writing-techniques-concrete-examples-2026-06-04.md

## Summary

Complete reference for the Harness Agent skill system: all 18 skills with roles,
the 13 framework components, decision rules for which components to include,
and annotated writing examples for each component.

---

## Part 1 — All 18 Skills

### Tier A — Core Execution (run most tasks)

| Skill | Lines | Role | Triggers when |
|---|---|---|---|
| `coder` | 152L | Create new files, scaffold features | "add", "create", "new file", "scaffold" |
| `editor` | 168L | Modify / fix existing files | "fix", "bug", "edit", "modify", "broken" |
| `harness_editor` | 180L | Edit CLAUDE.md / AGENTS.md / SKILL.md / knowledge/ | task touches any harness config |
| `session_manager` | 131L | Session lifecycle — open, pause, close, compact | "new session", "done", "wrap up", token >60k |
| `mece` | 147L | Phase 2 planning — builds mece_plan.md | every task after Phase 1 gathers |
| `agent` | 223L | Orchestrator + fallback when no keyword matches | no other skill matched |

### Tier B — Supporting (called by Tier A, rarely direct)

| Skill | Lines | Role | Triggers when |
|---|---|---|---|
| `file_manager` | 66L | File create/move/delete + index_files.json sync | any file lifecycle change |
| `variable_manager` | 71L | Symbol/function tracking + index_variables.json | symbol created/renamed/deleted |
| `harness_doctor` | 132L | CFP pattern repair — structural fixes | CFP count ≥ 3 on any entry, or [fix-required] |
| `self_improve` | 161L | Harness improvement proposals + execution | "improve harness", CFP ≥ 5, user requests |
| `skeptical_reviewer` | 111L | Phase 2 gate (M4.5) — challenges plan | optional, invoked by mece after plan built |
| `token_tracker` | 92L | Per-turn token estimation + session_tokens.md | boot-load, runs every turn |
| `token_auditor` | 84L | Diagnose token waste | SESSION_TOTAL > 60k, user asks about costs |

### Tier C — Specialized Output

| Skill | Lines | Role | Triggers when |
|---|---|---|---|
| `ascii_flow` | 76L | ASCII diagrams + architecture charts | "flow diagram", "flowchart", "ascii" |
| `doc_builder` | 76L | Documentation writing + Implement/ updates | "write docs", "update docs" |
| `repo_researcher` | 92L | Analyze external Git repos | "research repo", "analyze repo", clone/read |
| `project_presenter` | 150L | Project presentation + demo prep | "present", "demo", "show project" |
| `identity` | 43L | Persona + communication style | boot-load, defines AI behavior baseline |

---

## Part 2 — The 13 Framework Components

Every skill is built from some combination of these 13 components.
Not all skills use all 13 — see Part 3 for decision rules.

---

### Component 1 — YAML Frontmatter (MANDATORY in all)

```yaml
---
name: <skill-name>
description: >
  <1-2 sentence purpose statement with trigger keywords embedded>.
  Trigger on /<skill-name> and proactively when <condition>.
---
```

Purpose: machine-readable identity. The skill-manifest.json and npx skills use this for
auto-detection. The `description` field must contain trigger keywords — not just a summary.

Example (coder):
```yaml
---
name: coder
description: >
  Focused skill for implementing new features and creating new files.
  Trigger on: add, create, new file, scaffold, implement, build feature.
---
```

---

### Component 2 — Sections[] (MANDATORY in all)

```yaml
## Sections
- id: 1
  name: "Phase name"
  steps: ["step A", "step B", "step C"]
- id: 2
  name: "Phase name"
  steps: ["step D", "step E"]
```

Purpose: maps 1:1 to MECE plan sections. The MECE planner reads Sections[] to build
the task checklist. Each section = one phase of the workflow with verifiable steps.

Rule: every skill must have at least 2 sections. Steps[] are displayed in the MECE plan
and ticked off during Phase 3 execution.

Example (harness_editor):
```yaml
## Sections
- id: 1
  name: "Diagnose & Plan"
  steps: ["wc-l scope probe", "File Size Contract check", "confirm mece_plan.md + T-N roadmap [/]"]
- id: 2
  name: "Edit & Verify"
  steps: ["[pre-edit] emit", "targeted Edit/Write", "[✓ written] grep verify"]
- id: 3
  name: "Close & Sync"
  steps: ["index sync", "harness_flow update", "roadmap [X]"]
```

---

### Component 3 — Trigger (MANDATORY in all)

```
## Trigger
Activated when:
- <keyword or phrase condition 1>
- <keyword or phrase condition 2>
- <proactive condition (e.g. after X happens)>
```

Purpose: defines when the skill auto-activates. B2 boot step greps skill-manifest.json
keywords[] against the user message to select the right skill.

Two types of triggers:
- **Direct**: user says a keyword → skill loads
- **Proactive**: skill auto-offers after a condition is met (e.g. session close after task done)

Example (session_manager):
```
## Trigger
Activated when:
- User says "new session", "switch task", "done", "wrap up", "close"
- SESSION_TOTAL > 60k (token threshold — R3)
- LOOP_WEIGHT > 50 (compact-required signal)
- Topic switch detected in C2 routing
```

---

### Component 4 — Refusal Contract (MANDATORY in all)

```
## Refusal Contract
Skip entirely (emit [skill-skip]) if:
- <condition where skill is not needed>

HALT (emit [skill-refused]) if:
- <condition where skill cannot safely proceed>
```

Purpose: defines when to NOT run. Critical for preventing misuse and misleading output.
Two levels: skip (not needed) vs halt (preconditions not met).

Example (harness_editor):
```
## Refusal Contract
Skip entirely (emit [harness-skip]) if:
- No harness file is being modified — purely src/ edits → delegate to coder/editor

HALT (emit [harness-refused]) if:
- mece_plan.md missing or not dated today → Phase 1+2 required first
- No T-ID assigned in roadmap before starting
- Target SKILL.md >250L with no split plan → write split plan before edit
- Step 5 incomplete at task end (flow_updated=no) → complete Step 5 first
```

---

### Component 5 — Workflow (MANDATORY in all)

```
## Workflow (ordered steps)

### Step 1 · <Name> (mandatory)
<what to do + how to verify>

### Step 2 · <Name>
<what to do>
```

Purpose: the actual procedural steps. Always sequential, always numbered.
Critical pattern: "cannot skip" / "mandatory" labels on steps that are commonly skipped.

Example (editor):
```
## Workflow
### Step 1 · Diagnose
grep error_index.md for prior attempts → avoid repeating failed approaches

### Step 2 · Edit
[pre-edit] emit → targeted Edit → [✓ written] grep verify

### Step 3 · Sync & Close
symbol index sync → roadmap [X] → error_index entry if bug fix
```

---

### Component 6 — Output Contract (MANDATORY in all)

```
## Output Contract
| Trigger | Emit |
|---|---|
| task starts | [skill-name:start] T-<N> |
| step verified | [✓ written] <artifact> |
| task done | [skill-name:done] |
| error | [skill-name:error] <reason> |
```

Purpose: defines machine-readable signals the skill emits at each stage.
Other skills and hooks listen for these signals to gate their own work.

Example (file_manager):
```
## Output Contract
| Trigger | Emit |
|---|---|
| index updated | [file-index] path=<file> action=<create|delete|move> |
| symbol indexed | [symbol-index] path=<file> |
| done | [file-manager:done] |
```

---

### Component 7 — Routing (MANDATORY in most)

```
## Routing
- <condition> → trigger `<downstream-skill>` + wait for [emit]
- <condition> → delegate to `<other-skill>`
- Never do <X> directly — always via <skill>
```

Purpose: defines which downstream skills to call under what conditions.
Prevents the AI from doing index sync, symbol tracking, etc. inline — always delegates.

Example (coder):
```
## Routing
- File created → trigger file_manager + variable_manager before closing section
- New symbol → trigger variable_manager → wait for [symbol-index] emit
- Session close → trigger session_manager §3
```

---

### Component 8 — Behavior Contract / BC (CONDITIONAL)

**Use when:** an action is irreversible, destructive, or must be enforced 100% of the time.
**Skip when:** the workflow is a judgment call or quality concern (use Operating Stance instead).

```
Behavior Contract — <BC Name> (fires when <condition>):
Pre:    <state that must exist before this fires>
Contract: <what MUST happen — no exceptions>
          <what emits + what gates the next step>
Post:   <state after contract completes>
Enforce: <what counts as a violation + recovery action>
```

When to include BC:
- Destructive action (delete, overwrite, DB write) → ALWAYS
- Phase gate (Edit to src/ without gather_complete.md) → ALWAYS
- Quality invariant that must never slip → ALWAYS
- Judgment call (review quality, output style) → NEVER use BC, use Operating Stance

Example (harness_editor — Scope Probe BC):
```
Behavior Contract — Scope Probe (fires before any Edit/Write):
Pre:    target file path known
Contract: MUST run wc -l <file> → classify zone BEFORE any Edit/Write
          >250L → emit [size-halt] · write split plan · HALT
          ≤200L → emit zone + proceed
Post:   zone emitted this turn
Enforce: Edit without prior wc-l = [violation] BC-scope-probe → undo · re-run probe
```

---

### Component 9 — Context Gate (CONDITIONAL)

**Use when:** skill runs long multi-step workflows that could exhaust the context window.

```
## Context Gate
Max tool calls this skill may consume: <N>
If SESSION_TOTAL > <threshold>:
  → emit [context-gate] · write compact_state.md · STOP
  → resume from: section=<N> step=<desc>
```

Example (mece):
```
## Context Gate
If SESSION_TOTAL > 40k during Phase 2:
  → emit [token-pause] · write compact_state.md with section + step
  → prompt user: "/compact แล้ว reply ลุย"
```

---

### Component 10 — On-Demand Wire Triggers (CONDITIONAL)

**Use when:** skill has downstream skill calls that only fire under specific conditions
(not every run). Prevents pre-loading expensive skills unnecessarily.

```
## On-Demand Wire Triggers (load only when condition fires — never pre-load)
| Condition | Load skill | Wait for |
|---|---|---|
| <condition A> | <skill-name> | [emit-signal] |
| <condition B> | <skill-name> | [emit-signal] |
```

Example (mece):
```
## On-Demand Wire Triggers
| Condition | Load skill | Wait for |
|---|---|---|
| M4.5 optional gate requested | skeptical_reviewer | [skeptic:done] |
| sections ≥ 5 | token_auditor | [audit:result] |
```

---

### Component 11 — MECE Constraints Block (CONDITIONAL)

**Use when:** skill is commonly used as a section inside a MECE plan.
Provides copy-paste constraints the MECE planner inserts into mece_plan.md.

```
## MECE Constraints Block (copy into mece_plan.md for sections using this skill)
Tool: <skill-name>
Avoid: <what NOT to do in this section>
Verify-N: <how to confirm the section passed>
```

Example (harness_doctor):
```
## MECE Constraints Block
Tool: harness_doctor
Avoid: editing CODING_FAILURE_PATTERNS.md without reading failed_approaches first
Verify-1: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → count increased by 1
Verify-2: python3 -c "import json; json.load(open('knowledge/index_cfp_fix.json'))" → no parse error
```

---

### Component 12 — Roadmap Protocol (CONDITIONAL)

**Use when:** skill modifies src/ files and must track work in docs/master_roadmap.md.

```
## Roadmap Protocol (MANDATORY — before and after every task)
# Before:
grep -n "T-" docs/master_roadmap.md | tail -5   → find last T-N
# Add: [ ] T-{N+1}: <desc>                       → mark [/] when starting

# After:
# Mark: [X] T-{N+1}: <desc> · attempts:1 · tool_calls:N
```

---

### Component 13 — BC Selection Guide (CONDITIONAL)

**Use when:** skill has multiple BC blocks and needs guidance on which one fires when.
Prevents AI from applying the wrong enforcement level.

```
## BC Selection Guide
| Scenario | BC to apply |
|---|---|
| <scenario A> | BC-<name> (section X) |
| <scenario B> | BC-<name> (section Y) |
| judgment call | Operating Stance — no BC |
```

---

## Part 3 — Which Components to Include (Decision Table)

| Component | Always | Only if... |
|---|---|---|
| YAML Frontmatter | ✅ | — |
| Sections[] | ✅ | — |
| Trigger | ✅ | — |
| Refusal Contract | ✅ | — |
| Workflow | ✅ | — |
| Output Contract | ✅ | — |
| Routing | ✅ (most) | skip if skill is terminal (no downstream) |
| Behavior Contract | ⚠️ | action is irreversible / invariant / destructive |
| Context Gate | ⚠️ | skill runs >10 tool calls / multi-section workflow |
| On-Demand Wire | ⚠️ | downstream skills are conditional, not always needed |
| MECE Constraints | ⚠️ | skill is used as a section inside MECE plans |
| Roadmap Protocol | ⚠️ | skill modifies src/ files |
| BC Selection Guide | ⚠️ | skill has ≥3 BC blocks |

---

## Part 4 — Writing Examples with Annotations

### Example A — Minimal Skill (~50L) for simple output task

```markdown
---
name: ascii_flow
description: >
  Produces ASCII flow diagrams and architecture charts.
  Trigger on: flow diagram, flowchart, ascii chart, architecture diagram.
---

## Sections
- id: 1
  name: "Draft"
  steps: ["read target spec", "draw ASCII flow", "verify alignment"]

# ASCII Flow Skill

## Trigger
Activated when:
- User asks for "flow diagram", "flowchart", "ascii", "architecture chart"
- MECE plan section requires a diagram artifact

## Refusal Contract
Skip (emit [ascii-skip]) if:
- Target has existing diagram that is still accurate — offer to update instead

## Workflow
### Step 1 · Read spec
grep target file for section headers → understand what to diagram

### Step 2 · Draw
Produce ASCII using box-drawing chars: ┌─┐ │ └─┘ → for boxes
Use → ← ↑ ↓ for arrows

### Step 3 · Verify
Count boxes vs entities in spec → must match

## Output Contract
| Trigger | Emit |
|---|---|
| diagram written | [✓ ascii-flow] path=<file> boxes=<N> |
```

Annotation: No BC needed (not destructive). No Roadmap Protocol (no src/ change).
No Context Gate (fast task). Uses only the 6 mandatory components.

---

### Example B — Full Skill (~150L) for destructive/irreversible task

```markdown
---
name: harness_editor
description: >
  Manages all edits to harness config files. Requires MECE plan dated today + T-ID.
  Trigger on: edit CLAUDE.md, AGENTS.md, SKILL.md, knowledge/ files.
---

## Sections
- id: 1
  name: "Diagnose & Plan"
  steps: ["wc-l scope probe", "mece gate check", "T-ID confirm"]
- id: 2
  name: "Edit & Verify"
  steps: ["[pre-edit] emit", "targeted Edit", "[✓ written] verify"]
- id: 3
  name: "Close & Sync"
  steps: ["index sync", "harness_flow update", "roadmap [X]"]

# Harness Editor Skill

## Trigger
...

## Refusal Contract
...

## Workflow
### Step 1 · Scope Probe          ← mandatory even for small edits
### Step 2 · MECE Plan Gate       ← blocks if plan missing or stale
### Step 3 · Edit per BC          ← each BC listed here
### Step 4 · Index Sync           ← file_manager + variable_manager
### Step 5 · Docs Close           ← harness_flow + Implement/ update

## Output Contract
...

## Routing
...

## Behavior Contract — Scope Probe        ← BC because >250L = data loss risk
## Behavior Contract — MECE Plan Gate     ← BC because Edit without plan = invariant
## Behavior Contract — Refusal Gate       ← BC because harness edits are irreversible

## MECE Constraints Block   ← skill often used inside MECE plans
## BC Selection Guide        ← 3 BCs need routing guide
## Roadmap Protocol          ← skill touches harness files (tracked)
```

Annotation: Uses all 13 components because:
- BC: harness file edits are irreversible
- Context Gate: 3-section workflow can hit token limits
- MECE Constraints: always used inside MECE plans
- Roadmap Protocol: tracks all harness changes
- BC Selection Guide: 3 different BCs need clear routing

---

## Part 5 — Harness vs 9arm-Skills Framework Comparison

| Component | Harness Agent | 9arm-skills |
|---|---|---|
| Identity | YAML frontmatter | YAML frontmatter |
| Scope definition | Refusal Contract | When NOT to Use |
| Mental model | (missing — gap to fill) | Operating Stance |
| Prerequisites | Refusal Contract + BC | Required Inputs checklist |
| Workflow | Sections[] + Workflow steps | Workflow (sequential, no-skip) |
| Enforcement | BC + PreToolUse hook | Prompt-level only |
| Output quality | Output Contract (signals) | Tone Guide + Output flow |
| Downstream | Routing | Cross-skill composition |
| Quality signal | R13 (hard halt after 2 fails) | "3 iterations is a smell" |
| Learning | CFP system | Not present |
| Resume | compact_state.md | Not present |

Gap analysis — what Harness can borrow from 9arm-skills:
1. Operating Stance → add to every skill (handles judgment calls without BC overhead)
2. When NOT to Use → contextual refusals, not just artifact checks
3. Cross-skill composition → downstream skill offered at close, not just routed silently
4. Tone Guide → add to doc_builder, harness_editor (written output skills)
5. Quality heuristic → "3 iterations is a smell" in editor + coder skills

topics: [skill-writing, harness-design, framework-reference, technique-reference]
key_claims:
  - "Harness Agent has 18 skills across 3 tiers: Core Execution, Supporting, Specialized Output"
  - "13 framework components — 7 mandatory in all skills, 6 conditional"
  - "BC blocks used only for irreversible/destructive actions, not judgment calls"
  - "Context Gate added when skill runs >10 tool calls or multi-section workflow"
  - "Harness missing: Operating Stance, contextual When NOT to Use, Cross-skill composition"
  - "Minimal skill = 6 mandatory components (~50L); full skill = all 13 (~150-180L)"
