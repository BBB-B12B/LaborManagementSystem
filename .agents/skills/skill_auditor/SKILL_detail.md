# skill_auditor — Output Templates & Tone Detail
> Reference file. Loaded on-demand during output generation (Step 5).
> Main contract: `.agents/skills/skill_auditor/SKILL.md`

## Output structure

### Section 1 — Audit Summary (mandatory)
One line: skill name · line count · BC count · overall verdict (clean / needs-work / over-engineered)

### Section 2 — Component Verdict Table (mandatory)
| Component | Status | Finding | Lines |
|---|---|---|---|
| YAML Header | ✅/⚠️/❌/N/A | specific finding | L1–5 |
| ... | | | |

### Section 2.5 — Structure Report (mandatory)
`[redundant] concept:"<X>" · L<N>+L<N> · keep:L<N> · trim:L<N>`
`[scattered] topic:"<X>" · L<N>,L<N>,L<N> · consolidate:L<N>`
`[over-prescribed] location:"<X>" · L<N> · reason:<why> · recommend:<principle>`
`[structure] clean` ← if zero issues across all three scans

### Section 3 — Connection Type Assessment (mandatory)
| Type | Present | Appropriate | Note |
|---|---|---|---|
| Type 1 Text Reference | yes/no | ✅/⚠️ | ... |
| Type 3 BC-Gated | yes/no | ✅/[over-enforcement] | BC name if flagged |

### Section 4 — Suggested Additions (mandatory — one block per ❌ or ⚠️)

**⚡ Addition Gate — run before writing ANY suggestion**
For every ❌ or ⚠️, answer all 3 questions before recommending an addition. If any question fails → do not recommend that addition, note reason instead.

```
Q1 · Failure Test
"If this component were absent, in which specific scenario would the agent fail or produce wrong output?"
→ Can name a concrete scenario  → proceed to Q2
→ Cannot name a scenario        → SKIP · note: "framework compliance only — no behavioral value"

Q2 · Duplication Test
"Does this information already exist elsewhere in this file or in CLAUDE.md?"
→ Not duplicated  → proceed to Q3
→ Duplicated      → SKIP · note: "already covered at <location> — adding here = ceremony"

Q3 · Skill Nature Test
"Is this skill passive/always-on, or explicitly executable (invoked per task)?"
→ Executable → all 9arm components apply normally
→ Passive    → When to Invoke / Prerequisites / Workflow are N/A by design
               do NOT flag these as ❌ · mark N/A with reason
```

Only additions that pass all 3 gates get written as Suggested Additions.
Skipped items → list under `## Framework-Only Gaps (not recommended)` with one-line reason per item.

**Suggestion tier priority** — when writing replacement text, prefer the lowest tier that achieves reliable behavior:

| Prefer | Over | Because |
|---|---|---|
| Operating Stance (principle) | BC (script) | Agent applies a principle to edge cases it has never seen · BC only covers cases the author wrote |
| Signal Contract (1-line condition→action) | BC (multi-branch) | If the action is 1 condition → 1 outcome, a BC adds ceremony with no enforcement gain |
| Condition + reason in plain language | Enforce block | Agent that understands *why* self-corrects · Agent following a script fails silently when context shifts |

**When suggesting a replacement for a BC:**
Ask: "Can I write this as a principle that helps the agent reason, instead of a script that tells it what to do?"
- If yes → write it as Operating Stance or Signal Contract in the suggestion
- If no (action is irreversible, undo path required) → BC is justified · keep it

### Section 5 — Handoff Summary (optional — emit only if ≥3 issues flagged)
For harness_editor:
```
Task: T-N — <skill name> missing components
Files: .agents/skills/<name>/SKILL.md
Priority list: [ordered by impact]
Scope estimate: ~NL additions
BC review: [list BCs to evaluate if over-enforcement flagged]
```

## Tone
- ❌ first. If the first finding is a ❌, start there. No openers, no summary sentence before the table.
- Verdict format: `❌ absent` / `⚠️ weak (L12–18)` / `✅ L12–18` — always cite lines for ✅, always state reason for ❌/⚠️.
- BC over-enforcement: name the BC · explain why it's a judgment call · write the Operating Stance replacement.
- No hedging: drop "you might consider" / "it could be worth" / "perhaps" / "arguably"

Prohibited phrases:
- "This is a solid/good/strong skill overall" · "The skill is mostly complete"
- "Nice work on..." · "You might want to consider..." · "I think this could benefit from..."

## Worked example (compact — what one full audit looks like)

**Target** (`csv_cleaner/SKILL.md`, 9L):
```
---
name: csv_cleaner
description: Cleans CSV files.
---
## Workflow
1. Read the CSV.  2. Remove empty rows.  3. Save it.
```

**Audit produced:**
> **Summary:** csv_cleaner · 9L · 0 BC · **needs-work**

| Component | Status | Finding | Lines |
|---|---|---|---|
| YAML Header | ⚠️ weak | description has no trigger keywords, no when-not | L1–4 |
| When to Invoke | ❌ absent | no trigger phrases / no proactive trigger | — |
| When NOT to Use | ❌ absent | no refusal cases | — |
| Workflow | ⚠️ weak | steps unnamed · no stop condition · parse not delegated | L5–6 |
| Output Spec | ❌ absent | no structure or tone rules | — |

`[structure] clean` · BC count 0 (ok)

**Suggested Additions** (Addition Gate passed):
- *When to Invoke* → `Trigger on: "clean this csv", "remove empty rows", "fix my csv".`
- *Workflow §parse* → `Parse with PapaParse — never split(",") (silent quote/comma bug).`
- *Stop condition* → `If input is not valid CSV → stop · report · do not guess the delimiter.`

**Framework-Only Gaps (not recommended):** Operating Stance — csv_cleaner is mechanical; a stance adds ceremony with no behavioral value (Q1 fail).
