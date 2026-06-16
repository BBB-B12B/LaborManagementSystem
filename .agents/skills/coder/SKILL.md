---
name: Coder (Creator)
description: >
  Implements new features and creates application files from scratch.
  Trigger on: "create a new file", "build this feature", "implement X from scratch",
  "write the component", "scaffold", "new route", "add a new page",
  "สร้างไฟล์ใหม่", "implement feature", "build section".
  Proactively: when MECE plan section type = "Build" or "Scope & Index".
triggers: ["write this function", "implement this", "code this feature", "add this method", "เขียน code", "implement ให้หน่อย", "code ส่วนนี้"]
---

## Sections
```
- id: 1
  name: "Scope & Index"
  steps: ["R4 scope probe", "check index_files + index_variables for conflicts", "confirm no duplicates"]
- id: 2
  name: "Build"
  steps: ["create files to standards", "write code", "self-correct linter errors", "[✓ written] verify each file"]
- id: 3
  name: "Sync & Close"
  steps: ["call file_manager", "call variable_manager", "python scripts/symbol_indexer.py", "roadmap [X]"]
```

# Coder Skill

## Operating Stance
- Minimal footprint first. Write only what the task requires — no extra helpers, no "while I'm here" additions.
- Correctness over cleverness. Readable, predictable code beats elegant one-liners that break in edge cases.
- Build to be read. Every file you create will be read by someone debugging it at 2am. Name, structure, and comment accordingly.
- Narrow scope, hard boundary. If context reveals a better refactor opportunity — note it, don't act on it. Refactors go to `editor` skill.

## When to Invoke
- Orchestrator delegates a `Skill: coder` section from a MECE plan
- "create a new file" / "build this feature" / "implement X from scratch" / "scaffold" / "new route"
- `mece_plan.md` section type = "Scope & Index" / "Build" / "Sync & Close"
- Proactively: when Phase 3 section is type Build and no existing file found at target path

## When NOT to Use
- Task targets an **existing** file (edit/fix/refactor) → delegate to `editor` skill · do not start coder
- File at target path already exists → confirm intent first · creating over existing = data loss risk
- Task scope is ambiguous ("clean this up", "improve X") → clarify with MECE plan first · do not interpret and build
- **Rename all / global symbol rename** → delegate to `editor` + `variable_manager` · Do NOT use coder for renaming; coder creates, it does not rename
- `mece_plan.md` scope exceeds 3 new files → escalate to orchestrator · do not self-expand scope

## Prerequisites
- [ ] T-ID exists in roadmap
      Why: code changes without task ID are untracked
      Missing: emit `[coder-refused] reason:no-task-id` · halt
- [ ] Scope is a single symbol or function (not new file)
      Why: coder uses Edit only; new files require Write → harness_editor
      Missing: if new file needed → delegate to harness_editor
- [ ] No harness file targeted (src/ only)
      Why: coder must not edit SKILL.md / CLAUDE.md / AGENTS.md
      Missing: route to harness_editor for harness file changes
- [ ] edit → editor skill route confirmed
      Why: routing prevents scope creep into harness-level changes
      Missing: re-assess task type before proceeding

## Workflow
Run in order. Do not skip ahead.

1. **Roadmap [/]** — grep `master_roadmap.md` for existing T-ID · if none: assign next T-N · set status `[/]`
2. **Scope check** — `gather_complete.md` + `mece_plan.md` present and dated today? · missing → STOP · emit `[coder-refused] missing-plan`
3. **Context gather (G2)** — targeted reads only: index_files + index_variables for conflicts · existing related files for interface contracts
4. **Write** — create file(s) per Coding Standards · emit `[✓ written] path` immediately after each Write
5. **Verify** — `grep -n "export\|function\|const" <file> | head -20` to confirm structure · linter errors → fix inline before continuing — do NOT proceed past step 5 with unresolved TS errors
   → **Linter error ≥3 attempts on existing-code path:** assess whether error is in code you wrote (new file → keep fixing) OR in existing code you're modifying (existing file → emit `[coder-handoff] reason:linter-loop · target:<file>` and delegate to `editor`)
6. **Index Sync** — trigger `file_manager` → wait for `[file-index]` · trigger `variable_manager` → wait for `[symbol-index]` · BOTH required
7. **Roadmap [X]** — mark complete only after step 6 signals received · emit done summary

**Stop conditions:**
- `gather_complete.md` missing → stop at step 2 · do not write any src/ file
- Linter error on step 5 → fix before step 6 · never ship broken TypeScript
- Index Sync missing signal → do not mark [X] · re-trigger missing skill

**Quality heuristic:** one build attempt is normal · two = re-read the interface contract · three = diagnose root cause before a fourth attempt — stop and report `[blocked]`

## Output Contract
Required outputs per section:

| Action | Required | Label |
|---|---|---|
| Every file created | `[✓ written]` + grep verify (file exists at path) | **mandatory** |
| Section 3 done | `[file-index]` + `[symbol-index]` emitted · `index_files.json` + `index_variables.json` updated | **mandatory** |
| Every task complete | Roadmap `[ ] → [X] T-<N>` annotation | **mandatory** |
| Linter error found | Fix inline before proceeding — emit `[ts-suppressed] reason` if unavoidable | **mandatory** |
| Build summary | One-line done summary + next-step offer when returning to orchestrator | **optional** |

**Behavior Contract — Index-Sync-Gate (fires before roadmap [X] on any file create):**
```
Pre:    file(s) created · about to mark roadmap [X]
Contract: MUST trigger file_manager → wait for [file-index] emit
          MUST trigger variable_manager → wait for [symbol-index] emit
          BOTH signals required before roadmap [X] is written
          missing either → [violation] BC-index-sync-gate → trigger missing skill now · wait for emit
Post:   [file-index] + [symbol-index] both emitted · index_files.json + index_variables.json updated
Enforce: roadmap [X] written without both emits = [violation] BC-index-sync-gate → trigger skills now · re-verify
```

## Routing
- Section 3 (Sync & Close) done → return to orchestrator / session_manager §3
- `[blocked]` → halt · report `T-<N>: <cause>` · wait for orchestrator decision
- File created → trigger `file_manager` + `variable_manager` before closing section
- Build complete → context-aware offer (pick by target):
  - Target is `*.SKILL.md` or `.agents/skills/` → offer: "Build done — want `skill_auditor` to audit this skill for 9arm coverage gaps?"
  - Target is `src/` file → offer: "Build done — want `editor` to verify linter/type correctness on the new file?"
  - Target involves `schema` or `src/db/` → offer: "Build done — check ERR-007 risk: D1 multi-row INSERT or `onConflictDoNothing()` present?"

## Coding Standards (Cloudflare & Next.js)
1. **Framework Strictness**: Follow standard directory conventions for new files (`src/app/`, `src/components/`, etc.).
2. **Database Integrity**: When creating Drizzle schemas, ensure they match the Technical Requirements Document carefully.
3. **Self-Correction (Linter)**: If you notice a TypeScript error or Linter warning while writing, fix it immediately before finishing your execution.
4. **Aesthetics & UI**: Use TailwindCSS standard utility classes. Strive for a minimalist, modern enterprise look.
5. **Local Staging**: When generating large files or major architectural components, write them to a temporary staging area (e.g., `/tmp/` or local `temp/` inside the project) first using your creation tools, verify their structure, and then move them to their final destination. This prevents token waste on failed direct file injections.

**Staged file cleanup:** If a staged write fails or is abandoned mid-task:
- Delete the staged file immediately
- Emit `[staged-drop] <path>` to signal that this content must not appear in subsequent context or `context_files:`

## Tone Guide

Code comments:
Keep:   function intent · param meaning · non-obvious constraints (e.g. "D1 D1 doesn't support multi-row INSERT")
Strip:  task IDs · session references · "TODO: ask user" comments — never ship uncommitted annotations
Avoid:  obvious comments (`// increment i`) · restating the code in English

Emit messages (during execution):
Keep:   [✓ written] + path · [pre-read] + target · [coder-refused] + reason
Strip:  internal deliberation · preamble before action
Format: `[signal] File: path · Verdict: result` — single line, no prose wrap
Prohibited: "I'm now going to write..." · "Let me create..." · "I'll proceed with..." · "As requested, I will..."

Error → Thai (when audience is non-technical):
"TypeError: Cannot read properties of undefined" → "ระบบเรียกข้อมูลที่ไม่มีอยู่ — ตรวจสอบว่า object ถูก initialize ก่อนใช้"
"Edge Runtime does not support Node.js API" → "โค้ดเรียก Node.js API ที่ใช้ใน Edge Runtime ไม่ได้ — ต้องเปลี่ยนเป็น WebCrypto"

## Flow Diagram Rule
Creating any `.md` file that contains a flow diagram or architecture chart → **load `ascii_flow` skill first**.
```
[→ ascii_flow] Before drawing any box diagram in <file>
```
Style reference: `knowledge/harness_flow_20260525.md` · Skill: `.agents/skills/ascii_flow/SKILL.md`

## MECE Constraints Block (copy into mece_plan.md for sections using `coder`)
```
- Roadmap `[ ] T-<N>` written BEFORE any file creation begins (R-Roadmap gate)
- [✓ written] verify each file immediately after Write — mandatory
- Do NOT edit index files (index_files.json / index_variables.json) directly — call file_manager after
- Edge Runtime: no Node.js APIs — WebCrypto only
- R15: any touch of src/db/ → [db-gate] → HALT for explicit confirm
```

## Hard Rules
- Never write to `src/` before `gather_complete.md` and `mece_plan.md` are both verified today.
- Never create files without a T-ID assigned in `master_roadmap.md` first.
- Never skip `[✓ written]` verify — every file created requires grep confirm before next step.
- Never mark roadmap `[X]` without both `[file-index]` and `[symbol-index]` emitted.
- Never write to `src/db/` without `[db-gate]` emitted and explicit "yes" from user (R15).
- Never use Node.js APIs in Edge Runtime files — WebCrypto only.
- Never invent root cause — read the full error message (file + line + message body) before writing a fix. "Probably an import issue" without reading the error is a guess, not a diagnosis.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
