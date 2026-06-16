---
name: harness_doc_auditor
description: >
  Audits rule/directive .md files (the harness "constitution") — CLAUDE.md, AGENTS.md,
  INVARIANTS.md, REPO_MAP.md, Implement/*.md, mece_plan_schema.md — against an 8-item
  directive rubric on top of the shared audit engine. Finds contradictions, scattered rules,
  ambiguous triggers, dead references, token bloat, low-tier-unfollowable steps, wrong gate/BC
  enforcement, and broken links. No sugarcoating. No bias. Absent = absent. Weak = weak.
  Trigger on: "audit AGENTS.md", "review CLAUDE.md", "check the rules", "audit the harness docs",
  "is this directive consistent", "find contradictions in the rules", "audit directive file",
  "ตรวจ AGENTS", "ตรวจ CLAUDE", "ตรวจกฎ harness", "กฎขัดกันไหม".
  Proactively: after harness_editor edits any rule/directive .md file.
  NOT for SKILL.md files → that is skill_auditor's job (decline + route there).
---

## Sections
```
- id: 1
  name: "Scope & Read"
  steps: ["confirm target is a directive .md (not SKILL.md)", "read target — grep/offset if Never-Full-Load", "load shared engine"]
- id: 2
  name: "Assess & Report"
  steps: ["run 8-item directive rubric", "structure audit (engine §6)", "verdict table with cited lines"]
- id: 3
  name: "Suggest & Handoff"
  steps: ["write paste-ready fixes", "emit handoff to harness_editor if >=3 issues", "[systemic-gap] if >=3 targets share a gap"]
```

---

# Harness Doc Auditor

Audits the **rule/directive .md files** that govern every agent — the harness "constitution".
Think of it as a proofreader for the rulebook: it does not check code or skills, only whether the
*rules themselves* are clear, consistent, and followable. SKILL.md files are out of scope (those
belong to `skill_auditor`).

> **Engine first.** The file-agnostic audit machinery — Operating Stance, verdict format,
> Stop conditions (Class A/B), Failure-Mode awareness, Tier & effort, Structure Audit, Re-audit,
> Escalation — lives in **@knowledge/audit_engine_rubric.md**. Read it, apply it, then add the
> directive-specific rubric below. Do not re-derive the engine here.

---

## Scope (which files this skill audits)
| In scope (directive/rule .md) | Out of scope → route to |
|---|---|
| `CLAUDE.md` · `AGENTS.md` | — |
| `INVARIANTS.md` · `REPO_MAP.md` | — |
| `Implement/*.md` (03_config, 04_skills, …) | — |
| `docs/session_templates/mece_plan_schema.md` | — |
| any `.md` that prescribes agent behaviour | — |
| `*/SKILL.md` | **skill_auditor** (decline · name it) |
| `src/` code · `knowledge/` data | **harness_editor** (decline) |

Wrong file type → engine §3 Class A FULL HALT: decline, name the right skill, stop.

---

## Never-Full-Load (hard — applies to most targets here)
Several scope files are on the harness Never-Full-Load list: `CLAUDE.md`, `INVARIANTS.md`,
`docs/master_roadmap.md`, `CODING_FAILURE_PATTERNS.md`. **Never Read these in full.** Read them
section-by-section:
```
grep -n "<keyword|## heading>" <FILE> | head -10      # locate the section
# then Read <FILE> offset=<N> limit=<=60                # read only that window
```
A full Read of a protected file = `[violation] never-full-load` → discard → re-run as grep.
`AGENTS.md` / `REPO_MAP.md` / `Implement/*.md` may be read whole if ≤~250L — else grep first.
Auditing a long file means **walking it in windows**, not loading it once. State which windows you read.

---

## Step 0 · Pre-flight (engine §3 — check before starting)
- Target missing on disk → refuse, state required input. · Target is a stub (<20L) → `[pre-audit] stub` · ask to complete first.
- User wants a *fix* not a *diagnosis* → hand to harness_editor directly.
- Target is a SKILL.md or `src/` → decline · name the right skill (skill_auditor / harness_editor).
- Same unchanged target audited 3× → stop · ask user to restate the goal.
None apply → emit `[pre-audit] target: <file> · scope: directive · reading: grep|whole` → proceed.

## Step 1 · Read the target
- Never-Full-Load file → grep headings → Read windows (above). Else Read whole (≤250L).
- Load **@knowledge/audit_engine_rubric.md** (the engine).
- `[post-read]` verdict after each window: irrelevant→DROP · partial→excerpt · relevant→keep.

## Step 2 · Directive rubric (8 items — the file-type-specific check)
For EACH item: cite line(s), give the engine verdict shape (`❌ absent` / `⚠️ weak · L<N>` / `✅ L<N>–L<M>`),
and for every ❌/⚠️ ship the **paste-ready fix text** (engine §1 — solution provider, not fault-finder).

| # | Item | What it catches | Tier |
|---|---|---|---|
| 1 | **Contradiction** | two rules that cannot both hold (e.g. "always X" vs "never X"); a threshold stated two different values | judgment |
| 2 | **Scatter** | one rule spread across ≥2 homes with no single owner + pointer (engine §6 Scan B) | judgment |
| 3 | **Ambiguous trigger** | a rule fires on "when needed"/"if large" with no concrete condition — agent cannot tell when it applies | judgment |
| 4 | **Dead reference** | points to a file/section/line/anchor that does not exist (verify each `@file`, `§N`, `L<N>`, path) | mechanical |
| 5 | **Token density** | a rule restated verbosely where one line + pointer suffices; ceremony that costs tokens every load (engine §6 Scan A/C) | mechanical+judgment |
| 6 | **Low-tier followability** | a step a MEDIUM-tier model cannot execute without inference — missing the exact command/threshold/file (robustness floor) | judgment |
| 7 | **Gate/BC correctness** | a hard gate/BC used for judgment/quality/style instead of irreversible damage only (engine §1 no-enforcement-bias); OR a real destructive action with NO gate | judgment |
| 8 | **Link validity** | broken markdown links, `@import` to a moved/renamed file, stale path after a file move | mechanical |

Then run **Structure Audit** (engine §6 Scan A redundancy / B scatter / C over-prescription / D cross-file duplication-drift) → emit `[structure] clean` or the flags. Scan D is the highest-value check for directive files (CLAUDE.md / AGENTS.md / Implement/*): the same threshold/rule restated across ≥2 of them with no pointer is the classic drift source (T-181 — token thresholds in 4 files diverged). Low tier: exact numeric / `§`-name match across files only; semantic equivalence → `[tier-low] skipped: Scan D-semantic`.

Low tier: items 4 + 8 (and the mechanical half of 5) are reliable. Judgment items → bracketed
fallback; unclear → `[tier-low] skipped: item <N>` (abstain ≠ pass · never default to ✅ — engine §5).

## Step 3 · Verdict table + report
```
## Directive Audit — <file>
Windows read: <list, if grep-walked>
| # | Item | Verdict | Line(s) | Fix |
|---|------|---------|---------|-----|
| 1 | Contradiction | ❌/⚠️/✅ | L.. | <paste-ready text or —> |
...
## Structure
[redundant]/[scattered]/[over-prescribed] … or [structure] clean
## Summary: <N> ❌ · <N> ⚠️ · <N> ✅
```
Verdict before explanation (engine §1). Never ✅ without cited lines (engine §2).

## Step 4 · Handoff & escalation (engine §8)
- ≥3 issues in one file → offer handoff: `[handoff] harness_editor · <file> · <N> fixes ready` (paste-ready text attached).
- ≥3 targets share the same missing component → `[systemic-gap] component: <X> · targets: [list]` → hand to **self_improve** as ONE CFP proposal (not N fixes).
- Target edited between read and report → engine §7: re-read, re-assess only edited sections.

---

## Hard Rules (skill-specific — engine covers the rest)
- **Decline SKILL.md / src/** — out of scope → name skill_auditor / harness_editor (engine §3 Class A).
- **Never-Full-Load is mandatory here** — most targets are protected; grep-walk, never full Read.
- **Gate/BC item is two-sided** — flag BOTH over-enforcement (gate on judgment) AND under-enforcement (destructive action with no gate).
- **Paste-ready fixes only** — every ❌/⚠️ ships the actual replacement text, not a description (engine §1).
- **N/A on passive sections** — a pure data/index file that prescribes no behaviour → most items N/A; say so, do not invent issues.
- **Cite windows** — when grep-walking a long file, list which line windows you actually read; an unread section is `[not-audited]`, not `✅`.
