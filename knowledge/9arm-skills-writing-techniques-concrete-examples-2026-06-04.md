# 9arm-Skills Writing Techniques — Deep Dive with Concrete Examples
date: 2026-06-04
source: https://github.com/thananon/9arm-skills
related: 9arm-skills-patterns-to-port-into-ai-agent-harness-2026-05-28.md
author: research session 2026-06-04
status: active

## Summary

Deep analysis of 9arm-skills writing techniques compared to the Harness Agent skill system.
Covers 5 core techniques where 9arm-skills outperforms our approach, each with verbatim
source quotes, concrete before/after examples, and actionable porting notes.

## Key insight

9arm-skills operates on the **Discipline model**: teach the LLM HOW to think →
the LLM handles edge cases (= unexpected situations not covered by explicit rules) on its own.

Harness Agent operates on the **Enforcement model**: define every rule explicitly →
use hooks and Behavior Contracts to block violations.

Neither is universally better. The correct approach depends on the action type:
- **Irreversible / destructive actions** (delete, DB write, overwrite) → Enforcement model wins
- **Judgment calls** (review quality, writing style, skill scope) → Discipline model wins

The gap: Harness Agent applies Enforcement model to everything, including judgment-call scenarios
where Discipline model would produce better results with far less verbosity.

---

## Technique 1 — Operating Stance (mental model before rules)

### What it is
A short block at the top of the skill that defines the cognitive posture the LLM must adopt
before running any step. Not a rule list — a mindset declaration.

### Verbatim example (scrutinize/SKILL.md)
```
## Operating stance
- Outsider. Forget who wrote it and why they think it's right. Read the artifact cold.
- End-to-end, not diff-local. The diff is the entry point, not the scope.
  Follow the call graph through real code paths.
- Actionable, concise, with rationale. Every finding states what to change,
  why, and what evidence led you there.
```

### Why it works
Rules cover known scenarios. Mental models cover all scenarios including ones not written down.
An LLM that understands "act as an outsider" will handle edge cases without needing a rule for each.

### Concrete example — edge case not covered by rules
**Scenario:** User asks the LLM to review code they wrote themselves.

Without Operating Stance (rule-based only):
- No explicit rule covers this scenario
- LLM reviews leniently, passes everything with "looks good"
- Result: rubber-stamp review

With Operating Stance ("Outsider. Forget who wrote it."):
- LLM adopts cold-read posture regardless of authorship
- LLM critiques as if seeing the code for the first time
- Result: genuine review

### What Harness Agent currently does
SKILL.md files jump straight into `## Sections → steps → BC blocks`.
No mental model is established before the procedural steps begin.

### Porting action
Add `## Operating Stance` as the FIRST section in every SKILL.md, before `## Sections[]`.
2–4 short lines describing the cognitive posture. No rules — just mindset.

---

## Technique 2 — When NOT to Use (negative space)

### What it is
An explicit block listing scenarios where the skill should REFUSE to run,
stated BEFORE the workflow steps. Prevents misuse without hook enforcement.

### Verbatim example (post-mortem/SKILL.md)
```
## When NOT to use
- Bug not fixed yet, or fix not validated.
  A post-mortem of a hypothesis is misleading. Refuse and tell the user what's missing.
- Customer-visible outage / incident.
  Those need a separate incident report (timeline, blast radius, paging history, comms).
  This skill is bug-fix scope. Flag and confirm before producing one.
- Trivial fix (typo, obvious one-liner).
  The PR description is the record. Don't manufacture ceremony.
```

### Why it works
Skill misuse is as harmful as skill non-use. Explicit negative space trains the LLM
to self-filter before running — no hook required for judgment-call refusals.

### Concrete example
**Scenario:** User says "write a post-mortem for this bug, we haven't found the root cause yet"

Without "When NOT to use":
- Skill begins Phase 1 Info Gather
- Produces a post-mortem based on hypothesis (not confirmed cause)
- Result: misleading document that looks authoritative but is speculation

With "When NOT to use":
- Skill detects: "root cause not known" matches refusal condition
- Immediately: "Cannot write post-mortem yet — root cause not confirmed. Missing: (1) reliable repro (2) validated root cause. Run debug-mantra first."
- Result: correct guardrail with actionable next step

### What Harness Agent currently does
Refusal Contract checks for missing artifacts (mece_plan.md, T-ID in roadmap).
Does NOT check contextual appropriateness — "should this skill run right now?"

### Porting action
Add `## When NOT to Use` block to every domain skill (harness_editor, session_manager, etc.)
with 3–5 concrete contextual refusal cases. Keep it separate from the technical Refusal Contract.

---

## Technique 3 — Cross-Skill Composition (explicit downstream references)

### What it is
Each skill explicitly names which other skill handles the next step in the workflow.
The handoff is proactively offered at the end of the skill's run.

### Verbatim example (post-mortem/SKILL.md)
```
For the up-the-org version of this same content, hand the finished post-mortem to
management-talk. They compose: post-mortem owns the engineering truth,
management-talk reframes it for leadership.
```

### Also in the output flow section
```
5. Offer the management-talk handoff:
   "Want a leadership-flavored version? I can hand this to management-talk."
```

### Why it works
User does not need to know the skill registry. The skill itself guides the pipeline.
Reduces "what skill do I need next?" cognitive load to zero.

### Concrete example
**Scenario:** Debug session ends, bug is fixed.

Without cross-skill composition:
- debug-mantra: "Done. Bug fixed." [session ends]
- User must remember to invoke post-mortem manually
- User must remember that management-talk exists for the exec summary

With cross-skill composition:
- debug-mantra finishes → proactively offers: "Ready to write post-mortem? I have all the breadcrumbs."
- post-mortem finishes → proactively offers: "Want a leadership version? Hand to management-talk?"
- Entire pipeline runs guided, not user-driven

### What Harness Agent currently does
Skills are siloed. Each skill closes independently. No downstream reference is stated.
User must know the skill manifest to find what to use next.

### Porting action
Add `## Downstream Skill` section to each SKILL.md (1–2 lines):
```
downstream: session_manager (on task complete) / harness_doctor (on CFP recurrence detected)
```
At skill close step: emit "Recommend: [downstream skill] for [reason]. Run it?"

---

## Technique 4 — Tone Guide (HOW to write, not just WHAT to write)

### What it is
A section defining which content to keep, which to strip, and which to translate
when producing written output. Separates "engineering truth" from "audience-appropriate output."

### Verbatim example (management-talk/SKILL.md)
```
## Tone
Keep: Product names, framework names, team-owned component names, JIRA keys, PR numbers,
      customer/workload identifiers.
Strip: Function names, file paths, struct fields, commit SHAs, code expressions,
       env var names, line numbers, internal data-structure jargon.
Translate: Mechanism into plain-English cause-and-effect without lying.
Avoid: "we believe" / "appears to" / "may have" — hedging that isn't really hedging.
       Re-stating the obvious for thoroughness.
```

### Also in post-mortem/SKILL.md
```
## Tone
- Code identifiers are first-class. Keep them.
- Mechanism over narrative. Walk the actual cause chain.
- Active voice, concrete subjects, short paragraphs.
- No hedging. Drop "We believe" / "appears to" / "may have".
- Blameless. Describe the bug, the gap, and the fix. Never "X should have caught this."
```

### Why it works
Without a tone guide, LLM output quality varies per session. With a tone guide,
output is consistent regardless of which session or context the skill runs in.

### Concrete example
**Scenario:** Write status update for VP Engineering

Without tone guide:
> "The `fetchUserData()` function in `src/api/users.ts` line 142 was throwing a null pointer
> exception when `session_token` field was absent from the Redis cache entry.
> We believe this may have been introduced in commit a3f9b2c."

With tone guide (management-talk rules):
> "Login was failing for users who had been inactive for 30+ days due to an expired
> cache entry. Fixed and deployed today. No data loss. JIRA: ENG-4821."

### What Harness Agent currently does
No tone guide exists in any skill. Output style is entirely LLM-discretionary per session.

### Porting action
Add `## Output Style` section to every skill that produces written artifacts:
- What to keep / strip / translate (audience-dependent)
- Voice: active/passive preference
- Hedging policy: what phrases to avoid
- Length target per output type

---

## Technique 5 — Quality Heuristics Embedded in Skill

### What it is
Short, memorable rules about output quality and iteration count.
Self-regulating — tells the LLM when something is probably wrong without external enforcement.

### Verbatim examples
```
# post-mortem
One iteration is normal, three is a smell.

# management-talk
One iteration is normal, three is a smell.
```

"Smell" = code smell = signal that something is wrong even if you can't pinpoint exactly what.
Borrowed from software engineering: "smells like a bug" → investigate before continuing.

### Why it works
Rule-based systems halt after N failures (Harness Agent R13: halt after 2 fails).
Heuristics teach the LLM to recognize degrading quality BEFORE hitting the hard stop.

### Concrete example
**Scenario:** User keeps revising the output for a third time

Without quality heuristic:
- LLM produces revision 3, asks "how's this?"
- LLM produces revision 4, asks "better?"
- Loop continues until R13 blocks (2 errors) or user gives up

With "three is a smell" heuristic:
- After revision 2: LLM says "We're at iteration 2. One more iteration is a signal
  something deeper is off — should we restate what you actually need first?"
- Breaks the loop before it degrades

### What Harness Agent currently does
R13: HALT after 2 failed attempts — hard stop, binary.
No "quality is degrading, let's reframe" signal before the hard stop.

### Porting action
Add quality heuristics to skills that involve iterative output:
```
Quality gate: one iteration is normal · two = restate the goal · three = stop and diagnose
```

---

## Comparison Table — Discipline vs Enforcement by Scenario

| Scenario | Best approach | Why |
|---|---|---|
| Delete/overwrite src/ | Enforcement (hook) | Irreversible — must block 100% |
| DB schema change | Enforcement (hook) | High risk — no judgment allowed |
| Code review quality | Discipline (Operating Stance) | Judgment call — rules can't cover all cases |
| Post-mortem completeness | Discipline (When NOT to Use) | Context matters more than artifact checks |
| Output tone/style | Discipline (Tone Guide) | Varies by audience — rules are too rigid |
| Fix iteration count | Discipline (Quality Heuristic) | Early warning better than binary halt |
| Phase gate compliance | Enforcement (BC + hook) | Invariant — must not skip |

---

## Actionable Port Plan (priority order)

1. **Operating Stance** — add to: harness_editor, session_manager, coder, editor skills
   Effort: low (2–4 lines per skill)
   Impact: high (handles edge cases without new rules)

2. **When NOT to Use** — add to: all domain skills
   Effort: medium (3–5 refusal cases to identify per skill)
   Impact: medium-high (prevents misuse and misleading output)

3. **Tone Guide / Output Style** — add to: skills that produce documents
   Effort: medium (keep/strip/translate lists)
   Impact: medium (output consistency)

4. **Cross-Skill Composition** — add to: skills with natural downstream partners
   Effort: low (1–2 lines + close-step offer)
   Impact: medium (reduces user cognitive load)

5. **Quality Heuristics** — add to: skills with iterative output
   Effort: low (1–2 lines)
   Impact: medium (earlier loop-break signal)

---

## Files already in knowledge base on this topic
- `9arm-skills-patterns-to-port-into-ai-agent-harness-2026-05-28.md` — patterns overview
- `9arm-skills-repo-scan-and-skill-taxonomy-2026-05-28.md` — taxonomy and repo structure
- This file — writing techniques + concrete examples (2026-06-04 deep dive)

topics: [skill-writing, harness-design, discipline-vs-enforcement, technique-reference]
key_claims:
  - "Operating Stance teaches LLM how to think; handles edge cases without explicit rules"
  - "When NOT to Use prevents skill misuse through contextual negative space"
  - "Cross-skill composition reduces user cognitive load to zero"
  - "Tone Guide ensures output consistency across sessions without enforcement"
  - "Quality heuristics provide early warning before hard stops"
  - "Discipline model wins for judgment calls; Enforcement model wins for invariants"
