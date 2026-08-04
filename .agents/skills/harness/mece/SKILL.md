---
name: mece
description: >
  Loop Phase 2 — builds a section-based plan that maps 1:1 to target Skill sections[]. Runs once per task. Skipped on resume if plan exists.
  Trigger on: "build a plan", "MECE plan", "Phase 2", "plan the task", "map out steps", "วางแผน", "เขียน mece".
  Proactively: after [✓ gather] emitted on any task with >3 steps or a side effect.
---

## Sections
```
- id: 1
  name: "Build Plan"
  steps: ["load target Skill sections[]", "S1-A.5 REASON pass (dependency_map + risk_flags)", "map steps per section", "Verify + Rollback + Constraints per section", "write + validate mece_plan.md"]
- id: 2
  name: "Confirm & Register"
  steps: ["send plan → wait confirm", "R-Roadmap [ ] T-<N> per section", "emit [✓ MECE]"]
```

---

# MECE Planner

## Operating Stance
- Planner, not executor. mece maps intent to sections — it does not run those sections. Execution is Phase 3's job.
- Irreversibility first. Sections with delete/overwrite/DB write get flagged in S1-A.5 before steps are written — not after.
- Atomic steps only. Each step = one observable action. "Build and verify" = two steps, not one.
- Breadth over cleverness. A flat, readable plan beats a compressed elegant one. Reviewers confirm it — they should not need to decode it.
- Self-contained sections (the goal). Each section must be runnable by a low-tier agent with NO chat history as accurately as a high-tier one — that is exactly what Context + Model + Input_From + Verify-N together buy. If a section needs information not on its own block, the block is incomplete.

## Prerequisites
- [ ] `gather_complete.md` dated today — stale = Phase 1 not run
      → Missing: emit `[mece-blocked] Missing: gather_complete.md` · halt
- [ ] Target Skill `sections[]` loaded into context — mece maps 1:1 to these
      → Missing: re-read target SKILL.md sections block · halt if not found
- [ ] Task has >3 steps OR has a side effect (file create/edit/delete · DB write · index update)
      → Neither: emit `[mece-skip] reason: read-only` · return to main agent
- [ ] `docs/session_templates/mece_plan_schema.md` accessible (required at S1-E)
      → Missing: emit `[mece-blocked] Missing: mece_plan_schema.md` · halt

## When to Invoke
**Phrase variants:** "outline the work" / "break this into steps" / "plan this out" / "map out the sections" / "build a plan"
- **Phase 2 auto-trigger:** after `[✓ gather]` emitted on any task with >3 steps OR side effect → see Prerequisites for full condition check
- **Resume trigger** — when `.sessions/mece_plan.md` has pending `[ ]` sections from a prior session → load plan and resume from first pending section without re-running Phase 1+2

## When NOT to Use
Three skip cases — each stated in full so it is followable WITHOUT reading another section:
- Single-file edit (backlinks = 0, no ERR doc needed) → emit `[mece-skip] reason: single-file` → return to main agent
- Read-only / lookup task (no file create/edit/delete · no DB write · ≤3 steps) → emit `[mece-skip] reason: read-only` → return to main agent
- Resuming (`.sessions/mece_plan.md` has pending `[ ]` sections) → do NOT re-plan · skip Phases 1+2 · load the existing plan · jump to the first pending section
Emit format: `[mece-skip] reason: <read-only | single-file | resuming>` → return to main agent.
→ if plan has 0 parallel sections: emit `[mece-sequential] No Cycle grouping needed — all sections are sequential`
→ if plan has ≥2 independent sections: emit `[mece-cycle-required] Use Cycle block syntax (see S1-A.5 template)`

## Plan Format (key fields — 1:1 with target Skill sections[])

```
Section N — <name from Skill sections[N]>:   [Cycle <N> · serial|parallel]
  Context:        <1 line: goal + why · cold-readable by a spawned agent with NO chat history>
  Skill:          <editor|coder|index_manager|agent|ascii_flow|harness_doctor>
  Model:          <low | medium | high> @ <low|med|high effort>   (baseline Sonnet @ low-med · high effort only for planning/reasoning · routing: Implement/03_config)
  Tool:           <Bash|Read|Edit|Write>
  Input_From:     <none | cycle_<N>_S<M>.json>   (prior-batch output this section pulls in · none = independent)
  Constraints:    (≤5 lines from skill's MECE Constraints Block — see S1-D)
  Steps:          [A] → [B] → [C]  (≤5 per section · 1 atomic action each)
  Verify:         <grep/compile/read-back command>  (≤2 · ≤60 chars each)  ← DoD / done-test
  Rollback:       <undo if this section fails>  (≤15 words)
  Expected_Traces: <emit signals from skill Output Contract>
  Refusal_Path:   <[skill-refused] → halt|skip|retry>
  Data_Sent / Token: <optional · fill only when session >40k tokens>
```

Rules: match section count exactly · steps = 1 atomic action · single-Cycle plan ≤120 lines (multi-Cycle exempt — see Hard Rule 7)
Mandatory = every field above EXCEPT the last 3 (Expected_Traces · Refusal_Path · Data_Sent/Token) = OPTIONAL (fill only when task is complex or session >40k).
→ Full templates (Bug Fix · New Feature · Refactor · Multi-skill): `@.agents/skills/harness/mece/SKILL_detail.md §Templates`

## Workflow

**Section 1 — Build Plan:**
```
[S1-A]   Load sections[] from Boot context (re-read SKILL.md only if skill changed)
[S1-A.5] REASON pass (≤600 tok · memory only · do NOT write to file):
           □ Sequential: section A output → B input?
           □ Parallel: no shared state → can run together
           □ Irreversible: [gate]/delete/DB write → flag + scope note
           □ Risk surface: highest blast-radius section
           → informs Cycle grouping + Verify-N criteria

**Cycle block syntax template (copy when plan has parallel sections):**
```
### Cycle 1 — parallel · agents: <N> · cap: <N>  (<N> independent sections · no shared files)
- Section: <name> · Model: <low|high> · Output: cycle_1_<label>.json · T-<N>
- Section: <name> · Model: <low|high> · Output: cycle_1_<label>.json · T-<N>
**Barrier:** all cycle_1_*.json status:done before Cycle 2  (Cycle 2 sections set Input_From: cycle_1_*.json)
(agents = sub-agents spawned this cycle · cap = max concurrent · group parallel only if no shared file write + no mutual dependency)

### Cycle 2 — sequential (shared file writes · depends on Cycle 1 done)
- Section: <name> (writes: harness_flow + roadmap + active_thread)
```
**Cycle decision rule:** use Cycle grouping when ≥2 sections write to different files with no cross-dependency · always sequential if any section writes a shared file (harness_flow, roadmap, active_thread).

[S1-B]   Map per section: Context (cold-readable goal) · Skill · Model (low=lookup/read · high=reasoning/edit) · Tool · Input_From (prior cycle output | none) · Steps
[S1-C]   Add Verify + Rollback per section
[S1-D]   Copy Constraints: from each section's SKILL.md ## MECE Constraints Block (≤5 lines)
           Fallback (no MECE Constraints Block): read skill's ## Refusal Contract + ## Output Contract
           → extract: refusal conditions → Refusal_Path: · required emits → Expected_Traces:
[S1-E]   Read docs/session_templates/mece_plan_schema.md FIRST (full file — permitted ≤80L)
           → copy structure verbatim → fill task-specific content (date/task/skill/sections/Verify-N)
           → Write .sessions/mece_plan.md — NEVER write from memory (CFP-019: never build the plan from memory — copy the schema)
           → After writing: assess whether the plan is structurally complete —
               all 4 phase blocks present (Phase 0–3) · section count matches target Skill sections[]
               each section has Tool + Constraints fields · no section left as placeholder
           → If any structural gap is found: understand what is missing and why → rewrite to fix → re-assess
```

→ if mece_plan.md is missing any Phase 0–3 block, section count mismatches Skill sections[], or any section is missing Tool/Constraints: emit `[mece-fail] Step: S1-E · Cause: <what is missing>` · rewrite · retry once · still failing → HALT · skip = validation-gate violation
→ if structurally complete: emit `[✓ mece-valid]` · proceed to S2

**Behavior Contract — mece-fail Halt (fires when [mece-fail] emitted after retry):**
```
Pre:    [mece-fail] emitted · rewrite attempted · second validate still fails
Contract: HALT all downstream work immediately — do NOT proceed to S2-A or Phase 3
          emit [mece-fail-halt] Step:<N> · Cause:<which check> · asking user to review plan
          write partial mece_plan.md to .sessions/mece_plan.md (partial — for inspection)
          wait explicit user instruction before retry
Post:   [mece-fail-halt] emitted · no Phase 3 entry without user re-confirm
Enforce: Phase 3 REACT loop entry without [✓ mece-valid] = [violation] BC-mece-fail-halt → HALT immediately
```

**Section 2 — Confirm & Register:**
```
[S2-A] → .sessions/mece_plan.md must be written and [✓ written] emitted before presenting plan to user · presenting without file written = BC-mece-compact violation
         Send plan → wait for explicit user approval before writing roadmap entries
           Assess from context whether the user has genuinely approved the plan — not just acknowledged it
           Ambiguous response ("interesting", "I see") → ask once: "ยืนยัน plan นี้ไหมครับ?"
[S2-B] R-Roadmap: add [ ] T-<N>: <section-name> per section
[S2-C] Emit [✓ MECE]
```

→ Phase-Checklist Template (Phase 0–3 blocks for mece_plan.md): `@.agents/skills/harness/mece/SKILL_detail.md §Checklist`
→ Verify Pattern Lookup table (by action type): `@.agents/skills/harness/mece/SKILL_detail.md §VerifyPatterns`

## Output Spec — Structure
Primary artifact: `.sessions/mece_plan.md` (mandatory). It MUST contain:
- Phase 0–3 blocks (mandatory · structure copied from mece_plan_schema.md — canonical)
- Section count = target Skill `sections[]` count (mandatory · exact match)
- Per section: Context · Skill · Model · Tool · Input_From · Constraints · Steps · Verify · Rollback (all mandatory)
- `### Cycle grouping` block (mandatory)
- `compact_checkpoint` block if sections ≥ 3 (mandatory)
- Phase 3 Close Checklist (mandatory)
Plan Format (above) = field-level EXAMPLE · `docs/session_templates/mece_plan_schema.md` = canonical contract (schema wins on any conflict).
Signals: see ## Output Contract below.

## Output Contract

| Action | Emit | Label |
|---|---|---|
| Plan ready | `[✓ MECE] Plan covers <N> sections in <M> Cycles · user confirmed · roadmap entries added` | **mandatory** |
| Validate pass | `[✓ mece-valid]` — all 4 S1-E checks pass | **mandatory** |
| Validate fail | `[mece-fail] Step: <S1-E check> · Cause: <which field missing>` | **mandatory** |
| Plan skipped | `[mece-skip] reason: <read-only | single-file | resuming>` | **mandatory** |
| Section done | `[MECE] ✓ Section <N> done · → Section <N+1> next` | **optional** |
| Cycle done | `[cycle N] All <X> sections done · results: cycle_N_*.json · spawning Cycle <N+1>` | **optional** |
| Token check | `TOKEN CHECK` before every new Cycle/Section | **mandatory** |

Required files written:
- `.sessions/mece_plan.md` — **Phase-Checklist Template mandatory** (docs/session_templates/mece_plan_schema.md) — Phase 0–3 blocks required · no simplified format (CFP-019) · S1-E validates on write
- `docs/master_roadmap.md` — `[ ] T-<N>` per section (M4, before Phase 3)

## Hard Rules
1. Never write mece_plan.md from memory — read `docs/session_templates/mece_plan_schema.md` first · copy structure verbatim (CFP-019).
2. Never proceed to S2-A without `[✓ mece-valid]` emitted — all 4 S1-E grep checks must pass first.
3. Never enter Phase 3 without `[✓ mece-valid]` — `[mece-fail]` after retry = HALT, wait user instruction.
4. Never emit `[✓ MECE]` before `[✓ mece-valid]` is confirmed — order is: validate → confirm → emit.
5. Match section count exactly — sections in plan = sections in target Skill `sections[]`, no additions.
6. Steps = 1 atomic action each — "Build and verify" is two steps; write it as two steps.
7. Plan length ≤120L for single-Cycle plans — multi-Cycle plans (≥2 Cycle blocks with Barrier gate) are exempt from this limit · emit [plan-size] lines:<N> · cycles:<N> when exceeding 120L · if single-Cycle and exceeded, split the largest section into two before finalizing.
- Quality heuristic: any section with >5 steps → decompose into two named sections before sending to user.
8. Post-exec intent check: when all S[N] marked [X], assess next user message intent before running Close Checklist —
   new task or topic detected → C3 topic-switch first (not restart Phase 2 directly) · never keyword-match to decide.

## On-Demand Wire Triggers (load only when condition fires — never pre-load)

| Condition | Load |
|---|---|
| Sub-agent spawn needed (≥5 files OR section >8 steps) | `agent/SKILL.md §Spawn Rules` |
| OmO roles (sections > 2 OR [gate]/DB action) | `agent/SKILL.md §OmO` |
| CFP pattern / R16 fires | `self_improve/SKILL.md §CFP Logging` |
| DB edit detected (`src/db/` touch) | `INVARIANTS.md §I2` |
| Error recurring ("still broken" / same ERR-XXX) | `error_index.md ERR-XXX entry` |
| Session close ("ปิด/close/done") | `session_manager/SKILL.md §3` |
| Token 60-80k | `session_manager/SKILL.md §2 TOKEN PAUSE` |
| Cycle fan-out needed | ≥2 independent sections in plan with no shared file writes | Use Cycle block syntax (S1-A.5 template) |

Rule: 1 lookup + 1 targeted Read = 2 tool calls max per trigger.

## Tone Guide
Keep:   section names · step labels · verify commands · T-ID references · signal names
Strip:  session IDs · token counts · internal reasoning text
Format: `[signal] Key: value · Key: value` — single line · no prose explanation inline with signals
Prohibited (tone guardrails): hedging ("this should", "probably", "might want to") · inline prose explanation after a signal line · token counts in plan output · section names that differ from the target Skill `sections[]` names

## Routing
- `[✓ MECE]` emitted → return to main agent → Phase 3 REACT LOOP begins
- `[mece-fail-halt]` emitted → wait user instruction — see BC-mece-fail-halt above
- Token 60-80k during Phase 2 → TOKEN PAUSE → `session_manager §2`
- Close & next-step offer (Type 5 — always end here so a weak model never stalls): on `[✓ MECE]`, state the successor explicitly — `Next: run /compact, then reply to start Phase 3` if a compact_checkpoint exists, else `Next: reply 'go' to start Phase 3 execution`. Never end the turn without naming the next action.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

## hand-off
> Spec: docs/session_templates/handoff_block_schema.md · this skill OWNS mece_plan.md; downstream reviews it read-only (T-202 single-source rule).
downstream: skeptical_reviewer
artifact: the MECE plan (.sessions/mece_plan.md)
format: .sessions/mece_plan.md (Phase 0–3 blocks + Verify-N per section)
role: primary
required-inputs:
  - mece_plan.md written (not from memory — built from the schema template)
  - every Phase 3 section carries a Verify-N line
on-missing: HALT · emit `[handoff-blocked] missing:<inputs>` · ask the user · NO partial flow (no plan / no Verify-N → nothing to review)
on-present: offer to flow to skeptical_reviewer (M4.5) — get an adversarial verdict before the user confirms
owner-note: mece stays SOLE owner of the plan; skeptical_reviewer only reads + returns a verdict, never edits the plan
