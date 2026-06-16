---
name: skill_auditor
description: >
  Audits any SKILL.md against the 9arm framework — identifies missing or weak components,
  flags BC over-enforcement, and produces ready-to-paste suggested additions.
  No sugarcoating. No bias. No courtesy upgrades.
  Absent = absent. Weak = weak. Over-enforced = over-enforced. Call it exactly as it is.
  Trigger on: "audit this skill", "review SKILL.md", "what's missing in this skill",
  "skill gap analysis", "check skill quality", "is this skill complete",
  "ตรวจ skill", "skill ขาดอะไร", "audit harness skill".
  Proactively: after harness_editor creates or edits any SKILL.md.
---

## Sections
```
- id: 1
  name: "Load & Read"
  steps: ["load framework from knowledge/", "read target SKILL.md", "confirm component checklist"]
- id: 2
  name: "Assess & Report"
  steps: ["assess 8 components", "structure audit (redundancy+scatter+cross-file dup)", "assess 6 connection types", "flag BC over-enforcement", "cross-model comprehension probe (3 tiers → diff → additions)", "produce verdict table"]
- id: 3
  name: "Suggest & Handoff"
  steps: ["write Suggested Additions (real text, not descriptions)", "emit handoff for harness_editor if ≥3 gaps"]
```

---

# Skill Auditor

## Operating stance
→ Adversarial · no partial credit · no-bias/no-courtesy · no-enforcement-bias · verdict-first · solution-provider · third-party · Failure-Mode awareness (Dead Loop / Root Cause Guessing / Scope Creep / Runaway Iteration → ❌ vs ⚠️): **@knowledge/audit_engine_rubric.md §1 + §4**
- Framework-first (skill-specific): every verdict references a named component from the 9arm framework — "feels solid" is not a finding.
- **Suggest reasoning, not scripts.** → See Section 4 Addition Gate for full decision logic.

## When to invoke
- "audit this skill" / "review SKILL.md" / "what's missing in this skill"
- "skill gap analysis" / "ตรวจ skill" / "skill ขาดอะไร" / "check skill quality"
- After harness_editor writes or edits any SKILL.md → proactively offer audit
- User suspects a skill is misfiring or producing inconsistent output

## When NOT to use
- SKILL.md does not exist yet → use harness_editor with blank template from
  knowledge/9arm-skills-skill-building-framework-2026-06-04.md §Blank Template
- User wants to fix, not diagnose → skip audit, go directly to harness_editor with specific change
- Skill is a known stub (< 20L, placeholder only) → flag as pre-audit, ask to complete stub first
- Auditing src/ code quality → this skill audits SKILL.md files only, not application code

## Required inputs — refuse without these
- [ ] Target SKILL.md path exists on disk (`ls .agents/skills/<name>/SKILL.md`)
- [ ] Framework loaded from: `knowledge/9arm-skills-skill-building-framework-2026-06-04.md`
      If file missing → emit [framework-missing] · stop · tell user to run knowledge restore

## Stop conditions — TWO classes (low tier: this distinction is MANDATORY)
→ Full Class A FULL-HALT vs Class B STEP-SKIP logic: **@knowledge/audit_engine_rubric.md §3**
Skill-specific Class A triggers: target is not a SKILL.md (this skill audits SKILL.md ONLY — for src/ or rule/directive .md → decline + route to harness_doc_auditor) · framework file `knowledge/9arm-skills-skill-building-framework-2026-06-04.md` missing → `[framework-missing]` · stub <20L → `[pre-audit] stub detected`.

## Workflow
Run in order. Do not skip ahead.

**Tier & effort.** General split + the "never run Sonnet below medium effort" rule: **@knowledge/audit_engine_rubric.md §5**. Skill-specific mechanical steps = Step 1, 2, 4 + the Step 3 tables (reliable at low tier). Judgment-step low-tier fallbacks:
- Step 3.5 Scan A (Redundancy) — flag `[redundant]` ONLY on literal same-sentence overlap in 2+ sections.
- Step 3.5 Scan B (Scatter) — needs topic-flow judgment → emit `[tier-low] skipped: Scan B`, do not guess.
- Step 3.5 Scan C (Prescription) — flag `[over-prescribed]` ONLY when a step hard-codes exact strings/word-lists that break if wording changes.
- Step 3.5 Scan D (Cross-file dup) — low-tier: grep this SKILL's literal thresholds / `§`-rule-names against other harness files; flag `[cross-dup]` ONLY on exact match in ≥2 files with no pointer. Semantic equivalence across rewordings → `[tier-low] skipped: Scan D-semantic`.
- Failure-Mode classify (engine §4) — apply only the explicit `Flag: ❌ if…` lines; skip pattern-naming.
- Addition Gate (Step 5 → SKILL_detail.md) — answer Q1/Q2/Q3 yes/no; unclear → emit `⚠️ candidate`, not a firm verdict.
Never emit a judgment verdict you cannot support → `[tier-low] skipped: <step>` (neutral abstention, never a default ✅/⚠️). Bias rules (engine §1) apply at every tier.

### Step 0 · Pre-flight (before Step 1 — do this FIRST)
```bash
ls .agents/skills/<name>/SKILL.md      # target MUST exist on disk
```
File not found → refuse (§Required inputs · Class A FULL HALT). Only after the target is confirmed
present → proceed to Step 1. (A low/mid tier otherwise jumps straight to the framework grep and
starts auditing a path that may not exist.)

### Step 1 · Load framework
```bash
grep "^##\|key_claims\|8 components\|6 connection" \
  knowledge/9arm-skills-skill-building-framework-2026-06-04.md | head -40
```
Confirm 8 components + 6 connection types in working memory before reading the target skill.
Framework file = source of truth · the tables in this skill are a working cache · if they disagree → framework wins · flag [framework-drift].
If knowledge file missing → [framework-missing] · stop.

### Step 2 · Read target skill
```bash
wc -l .agents/skills/<name>/SKILL.md       # size check
grep -n "^##\|^---\|^name:\|Behavior Contract" .agents/skills/<name>/SKILL.md
```
Note: total lines, section headers, BC count.
If file < 20L → [pre-audit] stub detected · stop · ask user to complete stub first.

### Step 3 · Assess 8 components  (Output Spec is assessed as 2 rows → 9 rows below)

For each component, run the check. Output verdict: ✅ present | ⚠️ weak | ❌ missing | N/A

| Component | Pass condition | Weak condition |
|---|---|---|
| YAML Header | name + description present AND description contains trigger keywords (not just summary) | description describes purpose only, no trigger keywords |
| When to Invoke | ≥2 phrase variants + ≥1 proactive trigger | only slash command listed, no variants |
| When NOT to Use | ≥2 contextual refusals WITH stated reason AND redirect | present but no reason given, or only 1 case |
| Operating Stance | named section OR clearly embedded in description with ≥2 mindset lines | 1 line only, or embedded but too generic |
| Prerequisites | checklist format + clarifying note per item + explicit "refuse without these" | list exists but no notes, no refuse instruction |
| Workflow | numbered + named steps + ≥1 explicit stop condition or "do not skip" | steps present but no stop condition, or unnamed |
| Output Spec — Structure | section list with mandatory/optional labels | sections listed but not labelled mandatory/optional |
| Output Spec — Tone | keep/strip/avoid rules + ≥2 prohibited phrases listed | generic "be concise" only, no specific rules |
| Hard Rules | 5–8 imperative items + quality heuristic at end | fewer than 5, or no heuristic, or non-imperative phrasing |

### Step 3.5 · Structure Audit (redundancy + scatter + prescription + cross-file dup)
→ Run engine Scan A / Scan B / Scan C / Scan D: **@knowledge/audit_engine_rubric.md §6** · emit a `## Structure` block before Suggested Additions · no issues across all four → `[structure] clean`. Scan D = cross-file duplication/drift — this SKILL.md restates a rule/threshold/value also defined in another harness file with no pointer to the canonical home.

### Step 4 · Assess 6 connection types

For each connection type found in the skill:

| Type | Present? | Appropriate? | Flag if |
|---|---|---|---|
| Type 1 Text Reference | named in prose/routing | always ok | missing entirely — every skill should name its successor |
| Type 2 Mandatory+Wait | routing section has "wait for [emit]" | only for data integrity (index sync, symbol tracking) | used for non-data tasks |
| Type 3 BC-Gated | BC block exists | ONLY for irreversible/destructive: DB write, delete src/, overwrite harness | BC for judgment call / quality / style |
| Type 4 On-Demand Wire | conditional load table | condition is specific + observable | condition is vague ("if needed") |
| Type 5 Proactive Offer | close step has "Next: X if Y" | always ok | absent — every skill should close with a next-step offer |
| Type 6 Input Sourcing | upstream skill output referenced as input | when natural pipeline exists | absent when skill is always called after another skill |

**BC over-enforcement flag:**
```bash
grep -c "Behavior Contract" .agents/skills/<name>/SKILL.md
```
If BC count > 2: for each BC, check if the thing it blocks is actually irreversible.
If BC protects a judgment call or quality gate → [over-enforcement] flag · recommend Operating Stance replacement.

### Step 4.5 · Cross-Model Comprehension Probe
> Purpose: prove the target skill is executable by **low-to-mid tier** agent models — on-target,
> consistent across tiers, no bias. A divergence between tiers = a real doc gap, never softened.

Spawn 3 tiers (Agent tool · no effort param → control via prompt framing) and feed EACH the full
target SKILL.md + the fixed comprehension question set:
- **Haiku** — low tier (the robustness floor)
- **Sonnet @ medium framing** — "answer directly, do not over-deliberate"
- **Sonnet @ high framing** — "reason carefully step-by-step"

Emit `[probe-spawn] tiers: haiku · sonnet-med · sonnet-high`, then **WAIT** — all 3 tier agents
MUST return before you diff. Do not start the diff or move to Step 5 until every tier has answered.
Collect all 3 answer sets → diff per question.
- Answers agree across all 3 → that question area is clear (no action).
- Any tier diverges, OR the low tier struggles/guesses → `[probe-diff] divergences: N` →
  trace each divergence to the section that caused it → write a Suggested Addition for THAT section
  (route through the Addition Gate like any other finding). No divergence → `[probe-clean]`.

**No-bias rule (inherits Operating Stance):** a divergence is a real defect. Do NOT downgrade it to
⚠️ or omit it because the skill is new or well-written. Truth over politeness — the floor is "would
a Haiku-tier agent execute this step the same way the author intended?" If not, it is a gap.

**Self-exemption:** if skill_auditor itself is running on a low tier (cannot spawn sub-agents),
emit `[tier-low] skipped: Step 4.5` and note the probe was not run — never fake the result.

→ Question set + diff rubric + the 3 tiered agent prompts + divergence→Addition path:
  @.agents/skills/skill_auditor/SKILL_detail.md §Step 4.5

### Step 5 · Produce findings report
See Output Spec §Section 1–4 (+ worked example). Run Addition Gate before every Suggested Addition.
Before delivering, self-check (the audit must pass its own bar):
- [ ] every component row has a verdict + (cited lines OR N/A + reason)
- [ ] Structure Audit emitted — `[structure] clean` or findings
- [ ] every ❌/⚠️ has a paste-ready suggestion OR a Framework-Only-Gaps note
Any box unchecked → fix before output.

### Step 6 · Handoff

Emit handoff block (see Output Structure Section 5) if ≥3 issues.
The handoff is an OFFER, not an automatic call: after emitting it, **WAIT for explicit user
confirmation before invoking harness_editor**. Never hand off silently or auto-start fixes.
Make the wait observable — emit:
`[handoff-wait] target: harness_editor · gaps: <N> · → waiting for explicit user "yes"`
Do NOT invoke harness_editor until the user confirms. (Gate 1 = `[probe-spawn]` · this is Gate 2's matching signal.)
Then offer explicitly to the user:

If ≥3 components ❌ or ⚠️:
  "I can hand this to harness_editor now — want me to start on the fixes?"

If [over-enforcement] flagged:
  "BC over-enforcement found. Want harness_editor to rewrite those as Operating Stance?"

If 0–2 issues:
  "Audit complete — [N] minor gaps. No handoff needed unless you want to address them now."

## Output structure
Sections (in-file anchor · full templates in SKILL_detail.md): **1 Summary** (mandatory) · **2 Component Table** (mandatory) · **2.5 Structure Report** (mandatory · Scan A/B/C/D) · **3 Connection Types** (mandatory) · **4 Suggested Additions** (mandatory · only if found) · **5 Handoff** (optional · ≥3 issues).
→ Full section templates (Section 1–5): **@.agents/skills/skill_auditor/SKILL_detail.md**

## Output Tone
→ Verdict marker format + keep/strip/prohibited rules: **@knowledge/audit_engine_rubric.md §2** (`❌ absent` / `⚠️ weak · L<N>` / `✅ present · L<N>–L<M>` — verdict first, evidence after).

## Hard Rules
(Engine §1–§8 covers: cite-lines-for-✅ · no-BC-for-judgment · Failure-Mode-before-suggestion · audit-only-declared-scope · re-audit quality gate. Below = skill_auditor-specific.)
- Never skip Structure Audit (Step 3.5 → engine §6) — emit `[structure] clean` if none found.
- Never write a Suggested Addition without passing Addition Gate (Q1+Q2+Q3) first.
- Never flag When to Invoke / Prerequisites / Workflow as ❌ on a passive/always-on skill — mark N/A.
- Never write a Suggested Addition as a description — write the actual paste-ready text.
- Never audit src/ or rule/directive .md — SKILL.md only (route those to harness_doc_auditor).
- Framework file missing → [framework-missing] · stop · do not proceed from memory.
- BC count > 2 AND none protect irreversible actions → always flag [over-enforcement].

## When new data arrives later
→ Snapshot / re-audit-on-change rule: **@knowledge/audit_engine_rubric.md §7** · re-read the edited target (old snapshot stale) · re-assess only edited sections · prior audit in `.sessions/exec_log/` → `[prior-audit-found]` diff.

## Routing
→ Default tier = Sonnet @ medium · low-tier split → Workflow §Tier & effort + engine §5
→ Triggered by harness_editor post-edit: file path known — skip Step 1 file-find · cross-reference creation context
→ ≥3 gaps → handoff to harness_editor (Section 5) · systemic-gap across ≥3 skills + prior-audit `.sessions/exec_log/` diff → engine §8
