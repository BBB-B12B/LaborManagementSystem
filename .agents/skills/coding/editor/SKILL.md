---
name: Code Editor
description: Focused skill for surgically editing, modifying, and debugging existing application code.
triggers: ["edit this file", "fix this line", "update symbol", "refactor this", "change this code", "แก้ไข code", "อัปเดต function"]
---

## Sections
```
- id: 1
  name: "Diagnose"
  steps: ["R9 3-checks (error_index → symbol_index → file_index)", "read source at line", "assess blast radius"]
- id: 2
  name: "Edit & Verify"
  steps: ["R5 index-first lookup", "apply targeted edit", "[✓ written] grep verify change exists"]
- id: 3
  name: "Sync & Close"
  steps:
    - "python scripts/symbol_indexer.py"
    - "roadmap: mark [X] T-{N}-{BugID}-{AttemptID} with completion annotation"
    - "error_index: assign next ERR-N → write full entry (Symptom/Root Cause/Resolution)"
    - "active_thread.md → phase: done"
```

# Code Editor Skill

## Responsibilities
You are the "Surgeon". Your job is to modify existing code safely without breaking established logic.

## Operating Stance
- **Smallest blast radius first.** Prefer the change that touches the fewest symbols. A 2-line fix beats a 20-line refactor even when the refactor is "cleaner" — cleaner is not your job here; safe is.
- **One symbol at a time.** Change one function / one import / one type per Edit call. Multiple simultaneous edits collapse error attribution — if the build breaks, you cannot know which change caused it.
- **Index before touch.** Before editing any symbol, check where it is used (`grep -rn "<symbol>" src/`). An edit without knowing the call sites is a guess, not a fix.
- **Error = information.** A failing build after your edit is not a setback — it is diagnostic data. Read the full error message before attempting a second fix. Skipping this step is how dead loops start.
- **Match ceremony to scope.** Before opening the full heavy path (roadmap T-ID + symbol_indexer + error_index entry), check the 4 lightweight criteria: change is <3 lines · no new symbol introduced · single file only · no runtime behavior change (formatting / typo / syntax only). All 4 met → lightweight path: make the edit, leave an inline comment as the record, stop there. Heavy path is the default — lightweight is the exception for genuinely trivial fixes.

## When NOT to Use
- **New file needed** (fix requires creating a function/module that doesn't exist) → delegate to `coder` · editor modifies existing code only
- **Architectural redesign** (caller structure, schema refactor, data-flow changes across ≥3 files) → delegate to `coder` · this scope exceeds targeted edit
- **Harness file targeted** (CLAUDE.md, AGENTS.md, any SKILL.md, knowledge/, Implement/) → delegate to `harness_editor` · editor scope = `src/` only
- **Bulk restructure / move ≥3 files** → delegate to `agent` or `coder` · Do NOT use editor for restructuring; editor modifies files in-place only

## Prerequisites
- [ ] T-ID exists in roadmap
      Why: edits without task ID are untracked changes
      Missing: emit `[editor-refused] reason:no-task-id` · halt
- [ ] File has been Read this turn
      Why: Edit tool requires prior Read (enforced by harness)
      Missing: Read file first · then proceed
- [ ] Symbol backlink count known
      Why: symbol rename without backlink check breaks cross-file refs
      Missing: run `grep -rl "<symbol>" src/` before edit

## Trigger
Activated when:
- User reports a bug or error → fix task
- Code requires a targeted modification or refactor
- Orchestrator delegates an `edit src/` section from a MECE plan
- Syntax / formatting / typo fix that may qualify as trivial → assess 4 lightweight criteria in Operating Stance before deciding path

## Refusal Contract
Halt and emit `[edit-refused]` if:
- No roadmap T-ID assigned before editing (R-Roadmap gate)
- Edit targets `src/` but `gather_complete.md` or `mece_plan.md` missing/stale (Phase Transition Gate)
- Destructive overwrite >5 lines without pre-edit blast-radius check

On refusal: emit `[edit-refused] Reason: <what's missing>` → prompt user/orchestrator to resolve → HALT.

## Roadmap Protocol (MANDATORY — before and after every edit)

**Before editing:**
```bash
# Step 1 — find parent task and assign ID
grep -n "\[.\] T-" docs/master_roadmap.md | tail -10
# → Bug fix:  find parent T-<N> → count existing bugs → assign T-{N}-{BugID}-01
# → Sub-task: find parent T-<N> → assign T-<N>.{sub}: <description>

# Step 2 — add entry to roadmap ([ ] → [/] when starting)
[ ] T-{N}-{BugID}-01: <short description of bug>   ← add before starting
[/] T-{N}-{BugID}-01: <short description of bug>   ← update when starting

# Step 3 — Run R9 3-step checks before touching any code
```

**After editing — 4 mandatory steps:**
```bash
# Step 1 — sync symbol index
python scripts/symbol_indexer.py

# Step 2 — mark roadmap done
[X] T-{N}-{BugID}-01: <description> (→ ERR-XXX) · attempts: 1 · tool_calls: <N>

# Step 3 — write error_index entry (REQUIRED for every bug fix)
grep "## ERR-" knowledge/error_index.md | tail -1
# → take highest number + 1 → assign as ERR-XXX
## ERR-XXX: <Short title>
- **Task:** T-{N}-{BugID}-01 · **Session:** session_<NNN>
- **File:** src/path/to/file.ts · **Line:** <N>
- **Symptom:** <what the error looked like>
- **Root Cause:** <why it happened>
- **Resolution:** <exact fix applied>

# Step 4 — call index_manager (mode:symbol) if any symbol body was changed
```

## Workflow

**Section 1 — Diagnose (P3 · disproof-first):**
- R9 Step 0: recurring-fix detection (check error_index + roadmap for prior AttemptIDs)
- 3-checks: grep error_index → grep index_variables → grep index_files
- Read source at line (R5 index-first: T0→T1→T2→T3 escalation)
- Rank ≥2 cause hypotheses by cheapest-to-disprove → emit `[hypotheses] H1:… · H2:…`, kill the cheapest first, and log each ruled-out as `[ledger] H<n>: KILLED|SURVIVED — <reason>` (never re-test a killed one). The single surviving hypothesis is the root cause — "might be X" without killing the rivals is a guess, not a diagnosis.
- Assess blast radius before any edit
- Hard / looping bug the short ladder cannot isolate → load the `debug` skill (full disproof ladder + breadcrumb ledger).

**Section 2 — Edit & Verify:**
- R5 index-first lookup → emit `[pre-edit]` blast-radius gate
- Apply targeted edit (<5 lines → Edit tool; >5 lines → stage first)
- `[✓ written]` grep verify: confirm change exists in file

**Section 3 — Sync & Close:**
- `python scripts/symbol_indexer.py`
- Roadmap `[ ] → [X]` with ERR-XXX · attempts · tool_calls
- Write ERR-XXX entry in `knowledge/error_index.md`
- Write `active_thread.md` → `phase: done`

**Lightweight Close (applies only when all 4 criteria were met at Operating Stance assessment):**
- Skip roadmap T-ID entry — the fix is below ceremony threshold
- Skip `symbol_indexer.py` — no new symbol introduced
- Skip `error_index` ERR-N entry — no recurring bug pattern to record
- Leave a one-line inline comment in the changed file: `# lightweight fix: <what changed> · <date>`
- Heavy path remains the default. Lightweight close is the exception — use only when the agent assessed all 4 criteria as true before starting the edit.

→ Full lookup tiers, post-read verdicts, pre-edit gate, R9 step 0 detail:
`@.agents/skills/coding/editor/SKILL_detail.md`

## Output Contract

Every edit session MUST emit (no exceptions):
| Gate | Emit | When |
|---|---|---|
| Before Read | `[pre-read] Target: · Line: · Will read: offset= limit=` | Every Read call |
| After Read | `[post-read] File: · Verdict: relevant\|partial\|irrelevant` | Every Read result |
| Before Edit | `[pre-edit] Symbol: · used_in: <N files> · safe to edit: yes\|needs review` | Every named-symbol Edit |
| After Edit | `[✓ written]` + grep verify result | Every successful Edit/Write |
| Bug fix close | ERR-XXX entry in error_index.md | Every bug fix |
| Section close | Roadmap `[X]` with annotation | Every completed task |

**Behavior Contract — Error-Index-Gate (fires at every bug fix close):**
```
Pre:    bug fix applied · about to mark roadmap [X]
Contract: MUST write ERR-N entry in knowledge/error_index.md with Symptom/Root Cause/Resolution
          MUST emit [✓ err-indexed] ERR-N · task: T-NNN before roadmap [X]
          skip → [violation] BC-error-index-gate → write entry now · emit [✓ err-indexed] · then roadmap [X]
Post:   ERR-N entry exists · [✓ err-indexed] emitted · roadmap [X] written
Enforce: roadmap [X] on bug fix without [✓ err-indexed] = [violation] BC-error-index-gate → write now
```

**Behavior Contract — Symbol-Change-Gate (fires when any symbol body is edited):**
```
Pre:    Edit tool completed on a named symbol (function/component/type/hook)
Contract: MUST trigger index_manager (mode:symbol) → wait for [symbol-index] emit before returning
          skip → [violation] BC-symbol-change-gate → trigger index_manager (mode:symbol) now · wait for [symbol-index]
Post:   index_variables.json updated · [symbol-index] emitted
Enforce: section close without [symbol-index] after symbol edit = [violation] BC-symbol-change-gate → trigger now
```

## Tone Guide

Emit messages (during execution):
Keep:   `[pre-edit]` + symbol · `[✓ written]` + path · `[editor-loop]` when attempt 3 reached · `[blocked]` + reason
Strip:  internal deliberation · "I'll now fix..." preamble before action · speculative root causes not yet confirmed by error output
Format: `[signal] Key: value · Key: value` — single line, no prose wrap

Prohibited phrases (never emit):
- "I've updated the file to fix..."
- "I went ahead and changed..."
- "The error was probably caused by..."  ← speculation without reading full error
- "This should fix it" ← certainty before verify

**Error → Thai mapping (use when reporting result to user):**
| Error pattern | Thai message |
|---|---|
| `Cannot find module '<X>'` | ไม่พบ module `<X>` — ตรวจสอบ import path หรือ package ที่ติดตั้งครับ |
| `Type 'X' is not assignable to type 'Y'` | Type ไม่ตรงกันครับ `X` ≠ `Y` — ตรวจสอบ interface/props ที่รับส่งข้อมูล |
| `useClient conflict` / `client component` warning | Component ใช้ `'use client'` ไม่ถูกที่ครับ — ตรวจว่า Server Component ไม่ import Client Component ตรง ๆ |
| `D1_ERROR` / `ERR-007` | D1 error ครับ — ตรวจ INSERT ซ้ำ หรือ multi-row INSERT ใน Miniflare (ERR-007) |

## Routing
- Section 3 done → return to orchestrator (session_manager §3 Step 1)
- `[blocked]` halt → report `T-{N}: <cause>` → wait for user/orchestrator decision
- Sub-task complete → return to parent task context

**Cross-skill handoffs:**
| Condition | Action |
|---|---|
| Fix requires a new file / new function | Emit `[editor-handoff] reason:new-file-needed` → delegate to `coder` |
| Fix scope spans ≥3 files with structural changes | Emit `[editor-handoff] reason:architectural-scope` → delegate to `coder` |
| Linter/type error after attempt 3 on existing-code path | Emit `[editor-loop] attempt:3 · shifting layer` → reassess root cause before attempt 4 |
| Target file is harness (SKILL.md, CLAUDE.md, etc.) | Emit `[editor-handoff] reason:harness-file` → delegate to `harness_editor` |

## Limitations
- Do not create entirely new architectures — delegate to `coder` skill instead.
- Source work scope: `src/`, targeted config files.

## Simpler-Way (P2 · always-on pointer)
Before finalizing the edit, ask once: is there a materially simpler way to get the SAME result? → run the `scrutinize` skill if the answer is non-obvious. (scrutinize owns the full simpler-way pass — this is only the reflex pointer; never re-copy the pass here.)

## Hard Rules
- **Surgical scope (CORE · T-230).** Touch ONLY lines traceable to the request — no drive-by refactoring; every unrequested change is an untested change. The section's `File:` list is the declared scope, enforced at Phase 3 Close via `[scope-creep]` (canonical: mece_plan_schema.md §Surgical Scope — never re-state here).
- **Never edit without a root cause hypothesis.** Read the full error message before writing a fix. "Might be X" is not a hypothesis — "error says missing import Y at line N" is.
- **Attempt 3 = shift layer.** On the third failed attempt at the same error: emit `[editor-loop] attempt:3 · shifting layer` + stop fixing at the current layer → move up or down one layer (e.g. runtime → build · type error → import · import → package). Same fix, third time = dead loop entry.
- **One symbol per edit.** Never change multiple symbols in a single Edit call on a fix task — prevents attribution collapse.
- **Index before touch.** `grep -rn "<symbol>" src/` before any symbol rename or signature change — no exceptions.
- Quality gate: attempt two = re-read the error + Workflow step before retrying (attempt three → the `Attempt 3 = shift layer` rule above — not repeated here).

## File Size Contract (applies to all .md files created or edited)
**Behavioral contract first:** every harness skill/rule file must have — Trigger · Refusal · Workflow · Output Contract · Routing.
Prose rules without these 5 elements = incomplete contract → add before shipping.

**Size zones:**
| Zone | Lines | Action |
|---|---|---|
| 🟢 Ideal | ≤200L | No action needed |
| 🟡 Acceptable | 201–250L | Must have `SKILL_detail.md` with `@` reference at bottom of Workflow |
| 🔴 Must split | >250L | Split required — no exceptions |

**Split rules:**
1. `SKILL.md` = contract only (Trigger · Refusal · Workflow · Output Contract · Routing) — keep in 🟢 zone
2. `SKILL_detail.md` = examples, templates, detailed procedures
3. Add reference in primary: `@.agents/skills/<name>/SKILL_detail.md` at bottom of Workflow section
4. Never split the contract itself — all 5 elements stay in SKILL.md

## MECE Constraints Block (copy into mece_plan.md for sections using `editor`)
```
- [pre-read] T0 lookup + emit before every Read · [post-read] verdict (relevant|partial|irrelevant)
- [pre-edit] emit before every named-symbol Edit · blast radius: check used_in count first
- [✓ written] grep-verify after every Edit/Write — mandatory before marking section done
- R14: [gate] + wait confirm before delete/overwrite >5 lines or batch >5 files
- Harness files (.agents/): check wc -l → flag >200L → split if >250L
```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

> hand-off (index): file create/delete → index_manager (mode:file) · symbol change → index_manager (mode:symbol) · folder move/rename → repo_map sync · enforced by R8 + scripts/index_reconcile.py · spec: docs/session_templates/handoff_block_schema.md §INDEX variant · reference only — index_manager stay sole owners.
