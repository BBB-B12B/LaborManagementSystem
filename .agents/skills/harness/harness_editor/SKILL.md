---
name: Harness Editor
description: >
  Manages all edits to harness configuration files (CLAUDE.md, AGENTS.md, SKILL.md, knowledge/, Implement/)
  with mandatory MECE planning and full close sequence.
  Trigger on: "edit this skill", "update CLAUDE.md", "fix this rule", "add a BC", "modify AGENTS.md",
  "update harness", "change this constraint", "add to knowledge/", "update Implement/",
  "แก้ skill", "แก้ CLAUDE.md", "เพิ่ม rule", "อัพเดต harness".
  Proactively: after skill_auditor flags ≥3 gaps in a SKILL.md.
---

## Sections
```
- id: 1
  name: "Diagnose & Plan"
  steps: ["wc-l scope probe", "File Size Contract check", "confirm mece_plan.md + T-N roadmap [/]"]
- id: 2
  name: "Edit & Verify"
  steps: ["[pre-edit] emit", "targeted Edit/Write", "[✓ written] grep verify", "5-element contract intact check"]
- id: 3
  name: "Close & Sync"
  steps: ["index sync (skill-manifest if new skill)", "harness_flow update", "Implement/ update", "roadmap [X]"]
```

# Harness Editor Skill

## Operating Stance
- Harness files are load-bearing. CLAUDE.md, AGENTS.md, and SKILL.md files govern every agent turn — a bad edit ships a broken constraint to every future session. Treat every change as infrastructure, not configuration.
- Minimal diff discipline. Add only what is absent. Do not rewrite working sections to "clean them up" — that destroys audit trail and creates merge risk with no upside.
- Discipline over enforcement. Prefer Operating Stance and Signal Contracts for judgment calls. Reserve BCs strictly for actions that cause irreversible damage when skipped. A BC for a style preference is over-engineering.
- Audit before adding. Before inserting a new BC or rule, run BC Selection Guide (§BC Selection Guide) to confirm tier. If the check passes Signal Contract, write a Signal Contract — not a BC.
- Write for the auditor's bar. Every SKILL.md you produce must pass the 9arm framework + `knowledge/audit_engine_rubric.md` stance — that bar is the design target, not a post-hoc check. The point of a skill is to make the agent execute simply and directly: no step the agent must infer, no instruction that contradicts another.
- Minimal output, not only minimal diff. The skill you produce must itself be minimal — smallest scope that works, no prose bloat, reuse existing structure (Operating Stance · Signal Contract · Hard Rules) over adding parallel sections. Complexity written into a skill becomes inference burden on every agent that runs it.
- Single front-door for new skills. The bundled `skill-creator` plugin may scaffold a draft only; a draft becomes a project skill ONLY after passing through harness_editor — auditor bar (above) + R8 index wiring (backlink · index_files · skill-manifest · REPO_MAP). Reuse its *ideas* (progressive disclosure · structural validate · description tuning), never its files: the plugin is global, overwritten on update, and not wired to this project's index or gates.

## When NOT to Use
- Target file is under `src/` only (no harness file touched) → delegate to `coder` or `editor` · do not invoke harness_editor for application code
- Request is "simplify", "clean up", or "reorganize" a SKILL.md with no stated gap → audit with skill_auditor first · harness_editor executes fixes, not vague improvements
- BC count in target file is already ≥6 → must convert one existing BC to Signal Contract before adding · emit `[bc-limit] current:N · convert one before adding`
- User is diagnosing a harness violation without a fix ready → delegate to harness_doctor · harness_editor edits, it does not diagnose

## When to Invoke
**Phrase variants** (user says one of these):
- "edit this skill" / "update this SKILL.md" / "fix this rule" / "add a BC" / "change this constraint"
- "update CLAUDE.md" / "modify AGENTS.md" / "update harness" / "add to knowledge/" / "update Implement/"
- Thai: "แก้ skill" / "แก้ CLAUDE.md" / "เพิ่ม rule" / "อัพเดต harness" / "แก้ constraint"
- Orchestrator delegates `Skill: harness_editor` section from a MECE plan

**Proactive trigger:**
→ After `skill_auditor` emits ≥3 gaps in a SKILL.md — offer: "Want me to apply these fixes now with harness_editor?"

**Do NOT invoke** on vague intent alone ("fix the harness" with no target file) → route to `harness_doctor` first to diagnose before editing

## Prerequisites
**Refuse without all four** — emit `[harness-refused] reason:<X>` and halt. Do not proceed partially.

- [ ] `mece_plan.md` dated today
      → Why: all harness changes require a MECE-reviewed plan — no ad-hoc edits
      → Missing: emit `[harness-refused] reason:no-plan` · halt
- [ ] T-N marked `[/]` in `docs/master_roadmap.md`
      → Why: untracked edits create orphan changes that cannot be audited or reverted cleanly
      → Missing: emit `[harness-refused] reason:no-task-id` · halt
- [ ] Target file `wc -l` checked (File Size Contract)
      → Why: >250L files require a split plan before any edit begins
      → >250L: emit `[size-halt] file:<path> lines:<N>` · write split plan · halt
- [ ] No harness file targeted = skip entirely
      → Purely `src/` edits → delegate to `coder` / `editor` · emit `[harness-skip]`


## Workflow — 5-stage cycle (AUDIT → PLAN → EDIT → CLOSE · CFP loops back on abnormal)

> Stages 1→4 run forward. Abnormal at any stage → Stage 5 CFP → loop back to the failed stage with a DIFFERENT approach. The cycle = never retry the same way twice.

### Stage 1 · AUDIT  (mandatory-first for structural SKILL.md edits)
Probe (always): `wc -l <target>` → 🟢 ≤200 · 🟡 201-250 (SKILL_detail.md + @ref) · 🔴 >250 → `[size-halt]` + split plan + HALT · then `grep -n "<symbol>" <file>` for the exact line.
- Target = SKILL.md AND structural (new BC / new section / rewrite ≥10L) → **audit MANDATORY**: emit `[skill-active] skill_auditor` → run audit (Phase 1-2, no edit) → `[audit-done] gaps:<N>` → assess BEFORE planning
  Why: skill_auditor reads the 9arm framework + manifest + cross-skill links · harness_editor reads only the file itself
- Target = minor (<3L · typo · signal label) OR non-SKILL.md harness file → emit `[audit-skip] reason:<minor|non-skill>` · proceed

### Stage 2 · PLAN  (gate — cannot skip)
```bash
grep "^date:" .sessions/mece_plan.md | grep $(date +%Y-%m-%d)   # plan dated today
grep "\[/\] T-" docs/master_roadmap.md                          # task tracked [/]
```
→ both present → `[✓ gates-pass]` · either missing → `[harness-refused] reason:<no-plan|no-task-id>` · HALT
- **Recite-verbatim (P4 · high-stakes opener):** before passing this gate on a structural / self-editing change, recite the gate's exact rule back FIRST — emit `[recite] gate:PLAN · pass-iff: (plan-dated-today AND task-[/]) · else [harness-refused]`. Reading the rule aloud before acting is what stops it being skipped on autopilot.
- **Parallel-cycle scan** (save wall-clock time): group sections with NO shared file-write AND no mutual dependency into ONE parallel Cycle (spawn agents + barrier to rejoin) · shared file OR dependency → serial · ≥5 files/≥300L → spawn agents (R4) · <5 files → main-context serial · record the grouping in the plan's `### Cycle grouping` block

### Stage 3 · EDIT  (per Behavior Contracts)
- `[pre-edit] Symbol:<name> · file:<path>` before every Edit
- Targeted Edit only (grep the line first) — never a full-file rewrite on existing content (canonical: Hard Rules §1)
- `[✓ written]` + grep verify immediately after each change
- SKILL.md edit: after the change confirm all 8 framework components survive — grep the file's ACTUAL section headers (read them first; never assume fixed names like "## Trigger")

### Stage 3.5 · BEHAVIORAL VERIFY  (Signal Contract · trigger-gated)
After a *behavioural* edit (BC / gate / signal-contract / step-sequence) — skip typo/doc/format — empirically test the rule, don't just confirm text landed.
- `[behave-test]` → spawn a 3-config ladder cheapest-first with **early-exit on first PASS** — each config reads ONLY the edited file + a trigger prompt derived from the BC `Pre:` clause, scored by whether the required `Post:`/signal is emitted: ① Haiku (robustness floor) → ② Sonnet@medium → ③ Sonnet@high. First PASS stops the ladder (no effort param on Agent tool → effort = prompt framing, see detail). Non-behavioural edit → `[behave-skip]` (zero overhead).
- Verdict (early-exit): Haiku PASS → `[behave-pass]` → Stage 4 · Haiku fail / Sonnet@medium PASS → `[behave-gap]` (rule too subtle for the robustness floor) → loop Stage 5 · only Sonnet@high PASS → `[behave-gap]` `effort:high` (rule clear but needs deep reasoning) → loop Stage 5 · all 3 fail → `[behave-fail]` → Stage 5. Log every run to `knowledge/behave_test_log.jsonl` (feedback + regression suite).
→ full procedure: @.agents/skills/harness/harness_editor/SKILL_detail.md §Stage 3.5

### Stage 3.6 · FIX VALIDATION  (any bug-fix — CFP or code/ERR-N — gates Stage 4 close)
→ if bug-fix: read the ORIGINAL failure repro BY FIX-TYPE (which branch? a CFP entry exists for this fix → CFP path · else → ERR-N path) — CFP/harness-fix → `index_cfp_fix.json` fixes[].repro · code/non-CFP fix → `error_index.md` ERR-N (trigger+check). Both use the repro-pin FORMAT defined by `harness_doctor` §3 (single source · reproducible:no → no on-demand repro → use count-proxy) → re-run repro.check against the edited harness →
  gone: `[fix-validated] cfp:<id> repro:<how>` · still repros / cannot re-run: `[fix-unvalidated] reason:<x>`
  `[fix-unvalidated]` BLOCKS Stage 4 [C] roadmap [X] → loop Stage 5 · non-fix task: `[fix-skip]`

### Stage 4 · CLOSE  (Index Sync + Docs Close — mandatory, same task)
Edit a harness file → its paired Implement doc MUST update the same task (see §Implement Map).
- Index sync: new skill → `skill-manifest.json` + `registry.md` · new `knowledge/`|`Implement/` file → `index_manager` (mode:file) + `python3 scripts/backlink_analyzer.py` (assign `topics[]` from `topic_registry.json`) · no `src/` symbol → skip `index_manager` (mode:symbol)

**Behavior Contract — Docs Close (must complete before [harness-edit-done]):**
```
Pre:    all Stage 3 edits done · [✓ written] emitted per changed file
Contract: complete ALL before [harness-edit-done]:
          [A] harness_flow updated (harness file changed) → [✓ written]
          [B] paired Implement/ doc updated (per §Implement Map) + REPO_MAP if new file/skill
          [C] roadmap [/] T-N → [X] (bug/CFP-fix → requires [fix-validated] from §Stage 3.6 first · [fix-unvalidated] blocks this)   ·   [D] active_thread.md phase:done
          [E] Phase 3 Close Checklist verified — all [X]
          any incomplete → flow_updated=no · DO NOT emit [harness-edit-done]
Post:   [harness-edit-done] flow_updated:yes · all [A-E] verified
Enforce: flow_updated:no = [violation] BC-docs-close → complete · re-emit
```

### Stage 5 · CFP  (abnormal → loop back · do NOT retry blindly)
Trigger: a BC was violated · OR the same edit failed 2× · OR a recurring harness-rule violation surfaced.
- emit `[escalate] reason:<bc-violation|repeat-fail|recurring>` → self_improve §1-3 (log CFP) → structural/recurring also → `[escalate-to-harness_doctor]`
- **LOOP BACK**: re-enter the failed stage with a DIFFERENT approach — read the prior failed approach first, never repeat it · 3rd failure → `[blocked]` · wait

@.agents/skills/harness/harness_editor/SKILL_detail.md

## Implement Map
Edit a harness file → update its paired Implement/REPO doc in the SAME task (Stage 4). Closed list — no guessing:

| Edited harness file | Paired doc to update |
|---|---|
| `CLAUDE.md` (R-rules · gates) | `Implement/03_config.md` |
| `AGENTS.md` (boot · routing · phases) | `Implement/04_skills.md` (phases) + `Implement/06_orchestrator.md` (routing) |
| `.agents/skills/*/SKILL.md` | `Implement/04_skills.md` |
| hook (`.claude/settings.json`) | `Implement/02_setup.md` (+ `03_config.md` if token/loop logic) |
| `scripts/*.py` | `Implement/05_scripts.md` |
| workflow / checklist change | `Implement/08_checklist.md` |
| new file / dir / skill | `REPO_MAP.md` (mandatory entry) |

## Output Contract

| Action | Required | Label |
|---|---|---|
| Task complete signal | `[harness-edit-done] files:<N> · lines_changed:<total> · flow_updated:<yes/no> · impl_updated:<yes/no>` | **mandatory** |
| Each SKILL.md changed | `wc-l: <N>L (🟢/🟡/🔴)` emitted after verify | **mandatory** |
| Each file edited | `[✓ written]` + grep confirm (section header or symbol count intact) | **mandatory** |
| User-facing Thai close | Thai summary after `[harness-edit-done]` (template below) | **mandatory** |
| Mid-task probe result | `[scope-probe] file:<path> zone:🟢/🟡/🔴 lines:<N>` | **mandatory** |
| Behavioral verify (Stage 3.5) | `[behave-test]` start (3-config early-exit ladder) · `[behave-skip]` non-behavioural · `[behave-pass]`/`[behave-gap]` (+`effort:high` if only Sonnet@high)/`[behave-fail]` verdict | **mandatory on behavioural edits** |
| Next-step offer | one-line offer to route to skill_auditor or harness_doctor | **optional** |

**User-facing close (Thai — mandatory after `[harness-edit-done]`):**
```
งานเสร็จแล้วครับ ✅
แก้ไข <N> ไฟล์: <สรุปสั้น ๆ ว่าเปลี่ยนอะไร — ภาษาไทย>
สั่งงานต่อได้เลยครับ
```
Rule: [harness-edit-done] = harness signal (English · machine-readable) · user summary = Thai · always both · never English-only close.

## Tone Guide

Emit messages (during execution):
Keep:   `[harness-edit-done]` · `[harness-refused]` + reason · `[pre-edit]` + symbol · `[✓ written]` + path
Strip:  internal deliberation · "I'll now update..." preamble before action · session IDs · token counts
Format: `[signal] Key: value · Key: value` — single line, no prose wrap

Prohibited phrases (never emit):
- "I've gone ahead and updated..."
- "I took the liberty of changing..."
- "I've made the following improvements to your..."
- "Feel free to let me know if you'd like any adjustments"

Close language: Thai user summary is mandatory after every `[harness-edit-done]` · never close with English only · never omit the Thai line

## Tools (scripts)
These scripts handle deterministic index work the agent must not skip or guess manually.
Calling them at the right step keeps index state consistent — absence causes silent drift.

| Script | Purpose | Call at |
|---|---|---|
| `python3 scripts/backlink_analyzer.py` | Refresh `related[]` 3-tier links after knowledge/ edits | Stage 4 |
| `python3 scripts/knowledge_conflict_checker.py --file <path> --no-trigger` | Validate no conflicts after SKILL.md edit | Stage 4 |

Why listed here: agent reading SKILL.md at runtime has no other signal these scripts exist or are required.

## When new data arrives later
Edits rarely arrive complete. If scope expands mid-task (new file, changed requirement, target file grows):
- Re-run Stage 1 scope probe on new target — zone may have shifted
- Re-check Prerequisites: mece_plan.md must still cover the expanded scope; if not, update before editing
- Re-run Stage 4 for any newly touched files — partial sync creates silent inconsistency
- Do not emit `[harness-edit-done]` until expanded scope is fully covered and verified

## Routing
→ After `[harness-edit-done]` + Thai user summary → return to orchestrator / session_manager §3
→ `[blocked]` → halt · report `T-<N>: <cause>` · wait for orchestrator decision
→ New skill created → S4 (manifest+registry) must complete before returning
→ Structural CFP pattern discovered during edit (recurring rule violation in harness) → emit `[escalate-to-harness_doctor]` · halt current section · let harness_doctor diagnose before continuing
→ Edit complete → offer: "Edit done — want skill_auditor to verify the result, or harness_doctor to check for side-effects?"

## BC Selection Guide

Pick the **lowest tier** that enforces the rule. Ask in order — stop at first YES:

```
1. Shell hook blocks it without AI context?           → HOOK
2. Multi-branch + Post-assertion + close sequence?    → BC
3. Single condition → single action (emit/halt)?      → Signal Contract
4. Style/format, no gate needed?                      → CONV
```

| Tier | Format | Trigger condition |
|---|---|---|
| **HOOK** | PreToolUse/PostToolUse shell | File read/write gate · AI forgets under pressure · no context needed |
| **BC** | Pre/Contract/Post/Enforce | ≥2 branches · irreversible action · required close seq · Doctor Flow |
| **Signal Contract** | `→ if X: emit [Y] · skip = CFP-N` (1 line) | 1 condition → 1 action · no branching · no Post assertion |
| **CONV** | Inline note/bullet | Style/reminder · no enforcement consequence |

**Hard limit:** ≤6 BCs per file. Adding a 7th → convert existing BC to Signal Contract first.
→ Anti-patterns + real examples: **SKILL_detail.md §BC Selection Guide Detail**

---

## MECE Constraints Block (copy into mece_plan.md for sections using `harness_editor`)
```
- mece_plan.md dated today + T-N roadmap [/] REQUIRED before any file edit
- [pre-edit] emit before every Edit · [✓ written] grep verify after every change
- File Size Contract: ≤200L 🟢 · 201-250L 🟡 (SKILL_detail.md required) · >250L 🔴 HALT+split
- harness_flow_20260526.md + affected Implement/ MUST be updated in same task (Stage 4)
- [harness-edit-done] emit required before returning to orchestrator
- canonical for the signals + thresholds above = Workflow Stage 1–3 + Hard Rules (also mirrored in Implement/04_skills.md) — on any change edit the canonical + regenerate this block · never let copies drift
```

## Simpler-Way (P2 · always-on pointer)
Before finalizing the edit, ask once: is there a materially simpler way to get the SAME result? → run the `scrutinize` skill if the answer is non-obvious. (scrutinize owns the full simpler-way pass — this is only the reflex pointer; never re-copy the pass here.)

## Hard Rules
- **Surgical scope (CORE · T-230).** Touch ONLY lines traceable to the request — no drive-by refactoring; every unrequested change is an untested change. The section's `File:` list is the declared scope, enforced at Phase 3 Close via `[scope-creep]` (canonical: mece_plan_schema.md §Surgical Scope — never re-state here).
- Never run a full-file rewrite on any file with existing content — targeted Edit only (grep line number first).
- Never add a BC without passing BC Selection Guide tier check first — if Signal Contract tier applies, write a Signal Contract.
- Never emit `[harness-edit-done]` with `flow_updated:no` when a harness file was changed — Stage 4 is mandatory.
- Never mark roadmap `[X]` before `[harness-edit-done]` is emitted and Stage 4 confirmed complete.
- Never add a 7th BC to any file without converting one existing BC to Signal Contract first (hard limit: ≤6 BCs per file).
- Never edit `src/` files — harness_editor scope is harness config only (CLAUDE.md · AGENTS.md · SKILL.md · knowledge/ · Implement/).
- SKILL.md edits (structural): load `skill_auditor` first when target = SKILL.md AND change is structural (new BC / new section / rewrite ≥10L) — not required for minor fixes (<3L) · judgment call, not a gate.
- Quality gate: one edit attempt is normal · two = re-read the MECE plan and target section · three = diagnose root cause + emit `[blocked]` before a fourth attempt.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

> hand-off (index): file create/delete → index_manager (mode:file) · symbol change → index_manager (mode:symbol) · folder move/rename → repo_map sync · enforced by R8 + scripts/index_reconcile.py · spec: docs/session_templates/handoff_block_schema.md §INDEX variant · reference only — index_manager stay sole owners.
