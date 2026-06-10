# 9arm-Skills — Skill Building Framework
date: 2026-06-04
source: https://github.com/thananon/9arm-skills (reverse-engineered from 4 shipped skills)
related: 9arm-skills-writing-techniques-concrete-examples-2026-06-04.md

## Summary

Framework reverse-engineered from 9arm-skills' 4 shipped skills (debug-mantra, post-mortem,
scrutinize, management-talk). Describes the 8-component structure used to build each skill,
when each component is required vs optional, and a reusable blank template.

Key philosophy: a skill tells the AI HOW to think + WHAT to refuse + HOW to write output.
Not just a list of steps.

---

## Skill Size Reference

| Skill | Lines | Size | Why that length |
|---|---|---|---|
| `debug-mantra` | ~28L | minimal | ritual-only: 4-step mantra + operating principles |
| `scrutinize` | ~55L | medium | 3 workflow steps + operating stance + rules |
| `management-talk` | ~95L | large | 5 channel formats (JIRA/Slack/email/standup/meeting) |
| `post-mortem` | ~130L | largest | 9 output sections + refusal logic + tone + output flow |

Pattern: skill length grows with OUTPUT complexity, not rule complexity.
More output formats / audiences → more lines. More rules alone → not justified.

---

## The 8 Framework Components

```
[1] YAML Header       — identity + trigger keywords for auto-detection
[2] When to Invoke    — conditions that activate the skill
[3] When NOT to Use   — conditions that refuse / redirect
[4] Operating Stance  — mental model to adopt before starting
[5] Prerequisites     — required inputs — refuse without these
[6] Workflow          — sequential steps, no-skip
[7] Output Spec       — structure (what sections) + tone (how to write)
[8] Hard Rules        — absolute prohibitions, summary
```

Not all skills use all 8.
- debug-mantra uses 4–5 (skips Prerequisites, detailed Output Spec)
- post-mortem uses all 8 (most complete)
- scrutinize uses 6 (skips Prerequisites, skips Output Spec detail)

---

## Component Breakdown with Examples

---

### [1] YAML Header — identity + trigger

Purpose: machine-readable identity. The skill system reads `description` to auto-detect
which skill to load. Must contain trigger keywords embedded in the description — not just a summary.

```yaml
---
name: post-mortem
description: >
  Post-mortem documentation for engineering records of fixed bugs.
  Trigger on /post-mortem and proactively after a debug session
  has clearly landed a fix.
---
```

Rule: `description` must answer two questions:
- What does this skill do? (1 sentence)
- When should it activate? (trigger keywords)

---

### [2] When to Invoke — activation conditions

Purpose: covers multiple phrasings a user might say + defines proactive triggers
(when AI should offer the skill without being asked).

```
## When to invoke
- "/post-mortem"
- "write the post-mortem / postmortem / RCA / root-cause analysis"
- "document this fix" / "write up the root cause" / "close out this bug"
- After a debug session has clearly landed a fix → proactively offer to draft one
```

Pattern:
- Line 1: slash command
- Lines 2–N: phrase variants the user might say
- Last line: proactive trigger condition (if applicable)

---

### [3] When NOT to Use — negative space / refusal

Purpose: prevents misuse by listing contextual conditions where the skill refuses.
Critical insight: this is NOT "skill is broken" — it's "this is the wrong tool for this situation."

```
## When NOT to use
- Bug not fixed yet, or fix not validated.
  A post-mortem of a hypothesis is misleading. Refuse and tell the user what's missing.
- Customer-visible outage / incident.
  Those need a separate incident report. This skill is bug-fix scope.
  Flag and confirm before producing one.
- Trivial fix (typo, obvious one-liner).
  The PR description is the record. Don't manufacture ceremony.
```

Format: condition → consequence + what to do instead.
Each entry explains WHY it's a refusal, not just that it is.

When to include:
- ALWAYS include if the skill could be mistakenly triggered in the wrong context
- Include at least 2–3 refusal cases
- Omit only for skills with no meaningful misuse risk

---

### [4] Operating Stance — mental model

Purpose: defines the cognitive posture the AI adopts before running any step.
Replaces a long list of edge-case rules with a transferable mindset.

```
## Operating stance
- Outsider. Forget who wrote it and why they think it's right. Read the artifact cold.
- End-to-end, not diff-local. The diff is the entry point, not the scope.
  Follow the call graph through real code paths.
- Actionable, concise, with rationale.
  Every finding states what to change, why, and what evidence led you there.
```

When to include:
- Skills that require judgment calls (review, analysis, critique)
- Skills where the AI might be biased toward the user's framing
- Omit when workflow is purely procedural (no judgment needed)

Note: only scrutinize has an explicit Operating Stance section.
debug-mantra and post-mortem embed the stance inside the description field.

---

### [5] Prerequisites — required inputs checklist

Purpose: list of things that MUST exist before the skill runs.
AI checks this list first — if anything is missing, it lists what's absent and stops.

```
## Required inputs — refuse to draft without these

Before writing a single line, confirm all four. If any are missing, list what's missing and stop:

- [ ] Reliable repro exists (deterministic or high-rate-flake repro the next person can run)
- [ ] Root cause is known (mechanism identified, not a hypothesis)
- [ ] Fix is identified (PR / commit / branch pointer)
- [ ] Fix is validated (original repro now passes)
```

Format:
- Checkboxes signal "confirm before proceeding"
- Each item has a clarifying note (what "reliable" means, what "known" means)
- Instruction at top: "list what's missing and stop"

When to include:
- Skills that produce artifacts that look authoritative (documents, reports, analyses)
- If the skill could produce a misleading output when inputs are incomplete
- Omit for skills with no meaningful input requirements (e.g. pure formatting skills)

---

### [6] Workflow — ordered sequential steps

Purpose: the actual procedure. Always sequential, always numbered.
"Do not skip ahead" is the core constraint — prevents AI from jumping to the answer.

```
## Workflow
Run these in order. Do not skip ahead.

### 1. Intent — what is this actually trying to do?
- State the goal in one sentence, in your own words. If you cannot, stop.
- Ask: is there a simpler, smaller, or more elegant way?

### 2. Trace — walk the actual code path
- Entry point → call sites → branches → state mutated → exit.
- Include unchanged code on either side. Bugs hide at the seams.

### 3. Verify — does it actually do what it claims?
- What inputs / states would break it?
- How is it tested?

### 4. Report
- One section per finding, ordered by severity.
- Close with one-line verdict: ship / fix-then-ship / rework / reject.
```

Rules for writing workflow steps:
- Name each step (not just "Step 1")
- State what to DO, not just what to consider
- Include a stop condition ("if you cannot X → stop")
- Last step = output / report

---

### [7] Output Spec — structure + tone

Two sub-components always written together:

**Structure:** what sections the output must contain, which are mandatory vs optional

```
## Structure
Use these blocks in this order. Summary, Root cause, Fix, Validation = mandatory.

### 1. Summary (mandatory)
One paragraph. What broke. What fixed it. JIRA key, PR number, owner.

### 2. Symptom
What was actually observed. Concrete identifiers.
...
### 9. Action items / follow-ups
Concrete next-steps with owner + tracking artifact.
```

**Tone:** how to write — keep/strip/translate rules + prohibited phrases

```
## Tone
- Code identifiers are first-class. Keep them.
- Mechanism over narrative. Walk the actual cause chain.
- Active voice, concrete subjects, short paragraphs.
- No hedging. Drop "We believe" / "appears to" / "may have".
- Blameless. Describe the bug, the gap, and the fix. Never "X should have caught this."
- No advocacy. A post-mortem records what happened.
```

For audience-adaptive skills (management-talk), the tone guide splits further:

```
## Tone
Keep: Product names, JIRA keys, PR numbers, customer identifiers.
Strip: Function names, file paths, commit SHAs, env var names, line numbers.
Translate: Mechanism into plain-English cause-and-effect without lying.
Avoid: "we believe" / "appears to" / "may have" / "it could be argued"
```

When to include:
- ALWAYS include tone if the skill produces written output
- Structure is required if output has multiple sections
- Omit structure (keep tone only) for single-format outputs

---

### [8] Hard Rules — absolute prohibitions

Purpose: summary of things the AI must never do.
Read-fast format — AI scans this list before producing any output.

```
## Rules
- Refuse to draft without all four required inputs.
- Never invent root cause, owner, validation runs, or action items.
- Never strip code identifiers in the engineering record.
- Blameless. Describe gaps and bugs, never people.
- State validation coverage honestly.
- Get sign-off before posting to JIRA.
- One iteration is normal, three is a smell.
```

Format rules:
- Start each line with "Never" / "Refuse" / "Always" / "No" — imperative
- 5–8 items max — longer = not actually read
- Last rule: a quality heuristic ("N iterations is a smell")
- No explanations — if a rule needs explanation, it belongs in Workflow or Tone

---

## Decision Table — Which Components to Include

| Component | Always | Include when |
|---|---|---|
| YAML Header | ✅ | — |
| When to Invoke | ✅ | — |
| When NOT to Use | ✅ (strongly) | skill can be misused or triggered in wrong context |
| Operating Stance | ⚠️ | skill requires judgment / AI might be biased |
| Prerequisites | ⚠️ | missing inputs → misleading output |
| Workflow | ✅ | — |
| Output Spec (Structure) | ⚠️ | output has multiple sections or formats |
| Output Spec (Tone) | ✅ (if written output) | skill produces any text artifact |
| Hard Rules | ✅ | — |

Minimal skill (no judgment, simple output): YAML + Invoke + NOT + Workflow + Tone + Rules = ~30–40L
Full skill (judgment + complex output): all 8 components = ~100–130L

---

## Step-by-Step: How to Write a New Skill

```
Step 1 — Answer 3 questions before writing anything
  → What does this skill do in ONE sentence? (if you can't → too broad)
  → Who uses it and when?
  → What goes wrong if the skill runs at the wrong time or with wrong inputs?

Step 2 — Write YAML Header
  → name: one word or hyphenated
  → description: purpose + trigger keywords in same block

Step 3 — Write When to Invoke + When NOT to Use together
  → negative space is as important as positive space
  → minimum 2 entries in each

Step 4 — Write Prerequisites (if applicable)
  → checkbox format
  → each item has a clarifying note

Step 5 — Write Workflow
  → numbered, named steps
  → "Run in order. Do not skip ahead."
  → include a stop condition in at least one step

Step 6 — Write Output Spec
  → Structure: list sections, label mandatory/optional
  → Tone: keep/strip/avoid — be specific

Step 7 — Write Hard Rules
  → 5–8 items, imperative format
  → end with a quality heuristic

Step 8 — Add Operating Stance (if needed)
  → only if skill requires judgment
  → 3–4 lines, posture not rules
```

---

## Blank Template (copy-paste ready)

```markdown
---
name: <skill-name>
description: >
  <1-2 sentence purpose>. Trigger on /<skill-name> and proactively when <condition>.
---

## Operating stance
← include only if judgment-heavy
- <mental model 1>
- <mental model 2>

## When to invoke
- "/<skill-name>"
- "<phrase variant 1>"
- "<phrase variant 2>"
- <proactive condition> → proactively offer

## When NOT to use
- <condition> → <what to do instead / what's missing>
- <condition> → <redirect>
- <trivial case> → <simpler alternative>

## Required inputs — refuse without these
← include only if missing inputs → misleading output
- [ ] <input 1> (<clarifying note>)
- [ ] <input 2> (<clarifying note>)

## Workflow
Run in order. Do not skip ahead.

### 1. <Step name>
<what to do>
If you cannot <X> → <stop condition>

### 2. <Step name>
<what to do>

### 3. <Output step name>
<what to produce + format>

## Structure
← include if output has multiple sections
Use these blocks in this order. <Section A>, <Section B> = mandatory.

### 1. <Section name> (mandatory)
<what belongs here>

### 2. <Section name>
<what belongs here>

## Tone
- <keep/strip/translate rule>
- <voice preference: active voice / concrete subjects>
- Drop: "<hedging phrase>" / "<softening phrase>" / "<padding phrase>"
- <blameless / citation / directness rule>

## Output flow
1. Confirm prerequisites (list missing if any → stop)
2. <confirm channel / format if not stated>
3. Produce draft as a single block
4. <sign-off step if applicable>
5. <downstream skill offer if applicable>

## Rules
- <absolute prohibition 1>
- <absolute prohibition 2>
- Never invent <X>.
- <sign-off / approval rule>
- One iteration is normal, three is a smell.
```

---

## Cross-Skill Composition Pattern

Each skill should name its natural downstream partner at the close step:

```
## Output flow (post-mortem example)
5. Offer the management-talk handoff:
   "Want a leadership-flavored version? I can hand this to management-talk."
```

Downstream references to know:
- debug-mantra → post-mortem (breadcrumb ledger is raw material)
- post-mortem → management-talk (engineering truth → leadership reframe)
- scrutinize → post-mortem (if a real bug found during review)

---

---

## Part 6 — Cross-Skill Connection Patterns

### The 6 Connection Types (9arm + Harness combined view)

| Type | Soft/Hard | Problem it solves | Cost |
|---|---|---|---|
| 1. Text Reference | Soft | AI doesn't know other skills exist | Near zero |
| 2. Mandatory Trigger + Wait | Medium | Downstream work forgotten before section closes | +2–3 tool calls |
| 3. BC-Gated Delegation | Hard | Downstream is an invariant — skip = data loss | High overhead every run |
| 4. On-Demand Wire | Medium | Expensive skill loaded unnecessarily every turn | Complexity in writing |
| 5. Proactive Offer | Soft | User doesn't know there's a natural next step | Near zero |
| 6. Input Sourcing | Soft | AI doesn't know where to pull inputs from | Near zero |

9arm-skills uses only types 1, 5, 6 — all soft.
Harness Agent uses all 6 — types 2, 3, 4 are machine-enforced.

---

### How to Write Each Type

**Type 1 — Text Reference** (prose mention)
```markdown
For the leadership version, hand the finished output to
[management-talk](path/to/SKILL.md).
They compose: this skill owns the truth, management-talk reframes for leadership.
```

**Type 2 — Mandatory Trigger + Wait** (routing section)
```markdown
## Routing
- File created → trigger `file_manager` → wait for [file-index] emit
- Missing emit = section not done — do not mark [X]
```

**Type 3 — BC-Gated Delegation** (Behavior Contract)
```markdown
Behavior Contract — BC-index-sync-gate:
Pre:    file just created
Contract: MUST trigger file_manager → wait for [file-index]
          missing → [violation] BC-index-sync-gate → trigger now · re-verify
Post:   [file-index] received
Enforce: section [X] without [file-index] = violation
```

**Type 4 — On-Demand Wire** (conditional load table)
```markdown
## On-Demand Wire Triggers (load only when condition fires — never pre-load)
| Condition | Load skill | Wait for |
|---|---|---|
| SESSION_TOTAL > 60k | token_auditor | [audit:result] |
| CFP count increases | harness_doctor | [doctor:done] |
```

**Type 5 — Proactive Offer** (output flow step)
```markdown
## Output flow
5. Offer downstream handoff:
   "Want a leadership version? I can hand this to management-talk."
```

**Type 6 — Input Sourcing** (prerequisites or workflow note)
```markdown
## Required inputs
- [ ] Root cause is known

These map to debug-mantra steps 1–4.
If you ran debug-mantra first, the breadcrumb ledger from step 4 is your raw material.
```

---

### Decision Rule: Which Type to Use

```
Ask: "If the downstream skill doesn't run, does work break?"

Never breaks       → Type 1 + Type 5 (inform + offer)
Breaks but fixable → Type 2 (mandatory trigger)
Breaks, irreversible → Type 3 (BC-gated)
Breaks only sometimes → Type 4 (on-demand)
Needs prior output    → Type 6 (input sourcing)
```

---

### Objective Assessment — What Should Remain

**Keep all 6 types — but apply sparingly:**

| Type | Verdict | Condition for use |
|---|---|---|
| 1 Text Reference | ✅ Always | Every skill should name its natural successor |
| 5 Proactive Offer | ✅ Always | Every skill should end with "next: X if you need Y" |
| 6 Input Sourcing | ✅ Add to Harness | Missing from Harness — cheap, high value |
| 4 On-Demand Wire | ✅ Keep, use carefully | Only when downstream is expensive AND condition is observable |
| 2 Mandatory + Wait | ⚠️ Reduce | Only for real data integrity — index sync, symbol tracking |
| 3 BC-Gated | ⚠️ Rare | Only truly irreversible: DB write, delete src/, overwrite harness |

**Root problem with over-enforcing (Types 2+3):**
Enforcement has overhead on every run. If the downstream task is one the LLM does
correctly 95% of the time anyway, BC enforcement costs tokens/time on 100 runs
to catch the 5 runs where it would slip. The break-even is low — only worth it
when the 5 failures cause permanent damage.

**9arm's insight:** for judgment-call routing, trust the LLM + Operating Stance.
Reserve hard enforcement for genuinely irreversible actions only.

---

topics: [skill-writing, 9arm-skills, framework-reference, template, skill-routing]
key_claims:
  - "9arm-skills framework has 8 components — 4 always required, 4 conditional"
  - "YAML Header must embed trigger keywords in description field, not just summarize"
  - "When NOT to Use is as important as When to Invoke — prevents misuse without enforcement"
  - "Operating Stance replaces edge-case rules with a transferable mindset"
  - "Hard Rules: 5-8 items max, imperative format, ends with quality heuristic"
  - "Skill length grows with output complexity, not rule count"
  - "6 cross-skill connection types: Text Reference, Mandatory+Wait, BC-Gated, On-Demand, Proactive Offer, Input Sourcing"
  - "Types 1+5+6 are always appropriate; Types 2+3 only for irreversible/data-integrity scenarios"
  - "Over-enforcing with BC has overhead on every run — only justified when failure is permanent damage"
  - "Minimal skill ~30-40L uses 5 components; full skill ~130L uses all 8"
