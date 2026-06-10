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
  steps: ["assess 8 components", "structure audit (redundancy+scatter)", "assess 6 connection types", "flag BC over-enforcement", "produce verdict table"]
- id: 3
  name: "Suggest & Handoff"
  steps: ["write Suggested Additions (real text, not descriptions)", "emit handoff for harness_editor if ≥3 gaps"]
```

---

# Skill Auditor

## Operating stance
- Adversarial by default. Assume the skill is incomplete until each component is proven present with cited lines. "Looks complete" is not a verdict — cited evidence is.
- Framework-first. Every verdict references a named component from the 9arm framework. Personal impressions ("this feels solid") are not findings.
- No partial credit. Half-written Operating Stance = absent. Vague Tone = absent. One-line Workflow = weak. No upgrade for effort.
- No bias, no courtesy. Do not soften a ❌ because the skill was recently written or written by the session owner. Do not add ⚠️ where the correct verdict is ❌. Truth over politeness — always.
- No enforcement bias. BCs are for irreversible damage only — never for judgment, quality, or style (enforced in Hard Rules + Connection Type 3).
- Verdict before explanation. Lead with the verdict (`❌ absent` / `⚠️ weak` / `✅ L12–18`), then evidence. Never bury the verdict after three sentences of context.
- Solution provider, not fault-finder. Every ❌ or ⚠️ comes with the actual text to fix it — not a description of what to write.
- **Third-party perspective (hard).** Audit as if you have never seen this skill before and have no stake in the outcome. You did not write it. You are not protecting it. You are not being polite to its author. You are answering one question: "Does this skill make an agent reliably better or not?" — call it accordingly.
- **Suggest reasoning, not scripts.** → See Section 4 Addition Gate for full decision logic.
- **Failure Mode awareness.** When auditing, recognize which failure class each missing component prevents — this determines whether to flag as ❌ (behavioral gap) vs ⚠️ (framework gap only):
  - **Dead Loop Risk** — iterative skill (fix/edit/retry pattern) missing an explicit loop escape (`attempt N = shift layer` or stop condition). Without it, the agent will repeat the same failing approach until context exhausts. Flag: ❌ if retry steps present with no cap.
  - **Root Cause Guessing Risk** — diagnostic or fix skill missing a "never invent root cause" constraint. Without it, the agent fixes symptoms, not causes — each attempt creates new symptoms. Flag: ❌ if the skill acts on errors without requiring the agent to read the full error first.
  - **Scope Creep Risk** — build or create skill missing a stop condition ("If you cannot X → stop"). Without it, the agent expands scope to fill the task, shipping untested, unplanned work. Flag: ❌ if workflow has no `gather_complete.md` gate or no explicit stop phrase.
  - **Runaway Iteration Risk** — any skill with a multi-attempt loop missing a quality heuristic ("N iterations is a smell"). Without it, the agent treats persistent failure as a reason to try harder, not as diagnostic signal. Flag: ⚠️ if loop exists but no heuristic present.

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

## Workflow
Run in order. Do not skip ahead.

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

### Step 3.5 · Structure Audit (redundancy + scatter)

Run after component check. Two scans:

**Scan A — Redundancy**
For each concept or rule that appears more than once:
- Same rule in Operating Stance AND Hard Rules → keep in Hard Rules (enforcement) · remove from Stance (mindset only)
- Same rule in Tone AND Hard Rules → keep one · pointer to the other if needed
- Same instruction in Workflow step AND Output Contract → collapse to one location · Workflow = "how" · Output Contract = "what to emit"
→ Flag as: `[redundant] concept: "<X>" · found at: L<N> + L<N> · recommend: keep L<N> · trim L<N>`

**Scan B — Topic Scatter**
Read section order. Flag any case where topic A is introduced → topic B appears → topic A is expanded again:
- Pattern: Operating Stance mentions X → Workflow mentions X → Hard Rules expand X = scatter
- Fix: consolidate all of X into one section · add pointer at other locations if needed
→ Flag as: `[scattered] topic: "<X>" · locations: L<N>, L<N>, L<N> · recommend: consolidate to L<N>`

**Scan C — Prescription**
Ask for each Workflow step and validation block: *"Is the agent being told what to think, or how to execute?"*
- Specific commands (exact grep strings, word lists for confirm/trigger, mechanical checklists) where a principle would cover all cases → over-prescribed
- If the instruction would break silently when context shifts (schema changes, new phrasing) → over-prescribed
- If an agent that *understands the goal* would naturally do this anyway → the prescription adds no value

→ Flag as: `[over-prescribed] location: "<section>" · L<N> · reason: <why principle beats script here> · recommend: <one-line principle replacement>`

Emit findings as a `## Structure` block in the report before Suggested Additions.
If no issues found across all three scans → emit `[structure] clean`.

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

### Step 5 · Produce findings report
See Output Spec §Section 1–4 (+ worked example). Run Addition Gate before every Suggested Addition.
Before delivering, self-check (the audit must pass its own bar):
- [ ] every component row has a verdict + (cited lines OR N/A + reason)
- [ ] Structure Audit emitted — `[structure] clean` or findings
- [ ] every ❌/⚠️ has a paste-ready suggestion OR a Framework-Only-Gaps note
Any box unchecked → fix before output.

### Step 6 · Handoff

Emit handoff block (see Output Structure Section 5) if ≥3 issues.
Then offer explicitly to the user:

If ≥3 components ❌ or ⚠️:
  "I can hand this to harness_editor now — want me to start on the fixes?"

If [over-enforcement] flagged:
  "BC over-enforcement found. Want harness_editor to rewrite those as Operating Stance?"

If 0–2 issues:
  "Audit complete — [N] minor gaps. No handoff needed unless you want to address them now."

## Output structure

→ Full section templates (Section 1–5): **@.agents/skills/skill_auditor/SKILL_detail.md**

## Output Tone
Keep:   verdict marker (`✅` / `⚠️` / `❌`) + cited line numbers + one-line rationale
Strip:  internal deliberation ("I noticed that...") · hedging ("it seems like...") · courtesy softening
Format: `❌ absent` / `⚠️ weak · L<N>` / `✅ present · L<N>–L<N>` — verdict first, evidence after, never reversed
Prohibited: burying the verdict after context · adding ⚠️ where evidence calls for ❌ · "looks good overall" without cited evidence

## Hard Rules
- Never mark ✅ without citing line numbers.
- Never skip Structure Audit (Step 3.5) — redundancy + scatter findings are mandatory, not optional. Emit `[structure] clean` if none found.
- Never recommend a BC for a judgment-call scenario — if it doesn't cause irreversible damage when skipped, it doesn't need a BC.
- Never write a Suggested Addition without passing Addition Gate (Q1+Q2+Q3) first.
- Never flag When to Invoke / Prerequisites / Workflow as ❌ on a passive/always-on skill — mark N/A.
- Never write a Suggested Addition as a description — write the actual paste-ready text.
- When suggesting a loop escape, stop condition, or root cause gate: explain the Failure Mode Map entry it prevents (Dead Loop / Root Cause Guessing / Scope Creep / Runaway Iteration) before writing the suggestion text — agent understands *why* this addition matters, not just *what* to paste.
- Never audit src/ files — SKILL.md only.
- Framework file missing → [framework-missing] · stop · do not proceed from memory.
- BC count > 2 AND none protect irreversible actions → always flag [over-enforcement].
- Quality gate: one audit = normal · two on same unchanged skill = ask "what changed?" · three = stop, ask user to restate goal.

## When new data arrives later
Audits run on a snapshot. If the target SKILL.md is edited between Step 2 and Step 5:
- Re-run Step 2 (Read + header grep) on the updated file — the old snapshot is stale
- Re-run Step 3 only for components that touched the edited sections — do not re-flag already-fixed items
- If a prior audit exists in `.sessions/exec_log/`, emit `[prior-audit-found]` and diff against it — report delta only
- Rationale: re-auditing an unchanged file wastes context and confuses the user; re-auditing a changed file is correct and required

## Routing
→ Triggered by harness_editor post-edit: file path known — skip Step 1 file-find · cross-reference creation context
→ Prior audit in `.sessions/exec_log/`: emit `[prior-audit-found]` · compare delta only · do not re-flag fixed issues
→ ≥3 gaps → handoff to harness_editor (Section 5)
→ ≥3 skills share same missing component → flag systemic gap → CFP proposal via self_improve
