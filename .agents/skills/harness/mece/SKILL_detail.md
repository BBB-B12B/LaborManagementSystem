# MECE Planner — Detail Reference

Extended procedures for `mece/SKILL.md`. Load on-demand during Section 1 or as needed.

---

## §VerifyPatterns — Verify Pattern Lookup (pick by action type)

| Action | Verify command | Pass condition |
|---|---|---|
| Symbol/function created | `grep -c "symbolName" src/path/file.ts` | = 1 |
| Symbol deleted | `grep -c "symbolName" src/path/file.ts` | = 0 |
| Symbol renamed | `grep -rn "OldName" src/ \| wc -l` AND `grep -c "NewName" src/path/file.ts` | = 0 AND ≥ 1 |
| Import added | `grep -c "import.*ModuleName" src/path/file.ts` | ≥ 1 |
| Import removed | `grep -c "import.*ModuleName" src/path/file.ts` | = 0 |
| File created | `ls src/path/file.ts 2>/dev/null && echo found \|\| echo missing` | = found |
| File deleted | `ls src/path/file.ts 2>/dev/null \|\| echo gone` | = gone |
| Build passes | `npm run build 2>&1 \| grep -c "error"` | = 0 |
| Type check | `npx tsc --noEmit 2>&1 \| grep -c "error TS"` | = 0 |
| DB table exists | `wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='tbl'"` | row returned |
| DB row inserted | `wrangler d1 execute DB --local --command "SELECT COUNT(*) FROM table_name"` | count > 0 |
| Index sync | `python scripts/symbol_indexer.py 2>&1 \| grep -c "error"` | = 0 |
| Roadmap marked [X] | `grep -c "\[X\] T-<N>" docs/master_roadmap.md` | = 1 |
| ERR entry written | `grep -c "## ERR-<N>:" knowledge/error_index.md` | = 1 |

**Verify pass criteria:**
- Pass = command exits 0 AND output matches expected pattern exactly
- Non-empty output ≠ pass — must match defined condition
- Ambiguous output → treat as FAIL → retry flow
- "Looks correct" self-assessment → NOT valid — must use checkable command
- No checkable verify exists → flag at plan creation time, do not leave undefined

**Plan size caps:**
- Steps: ≤5 per section
- Verify: ≤2 commands per section (≤60 chars each)
- Rollback: ≤15 words per section
- Total plan: ≤120 lines (if exceeds → consolidate sections)
- Cycle grouping block: ≤10 lines total

---

## §Templates — Plan Templates by Task Type

### Bug Fix (target: editor)
```
# Serial chain — each section waits for the prior · <5 files → run in main context (Input_From = prior section in-context) · spawned → read the cycle JSON
Section 1 — Diagnose:                             [Cycle 1 · serial]
  Context:  Locate the bug + map blast radius (used_in) via the 3 indexes before touching code.
  Skill:    editor
  Model:    model_low
  Input_From: none
  Tool:     Bash · Read
  Constraints:
    - [pre-read] T0 lookup → emit [pre-read] · [post-read] verdict · skip = [violation R5/CFP-004]
    - blast radius: check `used_in` in index_variables before any edit decision
  Steps:    [A] R9 3-checks: error_index → symbol_index → file_index
            [B] Read source at line → confirm symptom
  Verify:   blast radius known · ERR candidate confirmed or ruled out
  Rollback: no changes yet
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 2 — Edit & Verify:                        [Cycle 2 · serial]
  Context:  Apply the targeted fix at the confirmed line + prove the symptom is gone.
  Skill:    editor
  Model:    model_high
  Input_From: cycle_1_S1.json (blast radius + confirmed line)
  Tool:     Edit · Bash
  Constraints:
    - [pre-edit] grep `used_in` → emit [pre-edit] before symbol Edit · skip = [violation R5-edit]
    - [✓ written] grep verify after Edit · R12: re-read changed section
    - R14: [gate] before delete/overwrite · R15: [db-gate] for src/db/
  Steps:    [C] apply targeted fix
            [D] [✓ written] grep verify change exists
  Verify:   grep symptom → 0 results
  Rollback: revert edit
  Expected_Traces: [pre-edit] · [✓ written] · grep-verify result
  Refusal_Path: [edit-refused] → halt · resolve missing T-ID or gate → retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 3 — Sync & Close:                         [Cycle 3 · serial]
  Context:  Sync symbol index + write the ERR entry + mark the roadmap done.
  Skill:    editor
  Model:    model_low
  Input_From: cycle_2_S2.json (changed files)
  Tool:     Bash · Edit
  Constraints:
    - R8: `python scripts/symbol_indexer.py` mandatory · ERR-N entry required for every bug fix
    - roadmap `[ ]→[X]` mandatory · [✓ written] verify ERR entry written
  Steps:    [E] python scripts/symbol_indexer.py
            [F] write ERR-XXX to error_index.md · [✓ written] verify
            [G] mark roadmap [X] T-{N}-{BugID} (→ ERR-XXX)
  Verify:   ERR entry exists · roadmap [X]
  Rollback: remove ERR entry if incorrect
  Expected_Traces: [✓ written] ERR entry · roadmap [X] annotation
  Refusal_Path: [edit-refused] → halt · check ERR-XXX id is unique · retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k
```

### New Feature (target: coder)
```
# Serial chain — scope → build → sync · <5 files → run in main context (Input_From = prior section in-context)
Section 1 — Scope & Index:                        [Cycle 1 · serial]
  Context:  Probe scope + check indexes so no duplicate symbol or path gets created.
  Skill:    coder
  Model:    model_low
  Input_From: none
  Tool:     Bash
  Constraints:
    - [pre-read] T0 lookup → emit [pre-read] · [post-read] verdict · skip = [violation R5/CFP-004]
    - Roadmap: `[ ] T-N` written before any file creation begins
  Steps:    [A] R4 scope probe · check index for conflicts
  Verify:   no duplicate symbols or file paths
  Rollback: n/a
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 2 — Build:                                [Cycle 2 · serial]
  Context:  Create the new file(s) per spec + verify each exists.
  Skill:    coder
  Model:    model_high
  Input_From: cycle_1_S1.json (scope + no-conflict list)
  Tool:     Write · Bash
  Constraints:
    - [✓ written] verify each file after creation — mandatory
    - Do NOT edit index files directly — call index_manager after
    - Edge Runtime: no Node.js APIs · R15: src/db/ → [db-gate] → HALT
  Steps:    [B] create file(s) · [✓ written] verify each
  Verify:   files exist at correct paths
  Rollback: delete created files
  Expected_Traces: [✓ written] per file created · roadmap [X] T-<N>
  Refusal_Path: [coder-refused] → halt · assign T-ID in roadmap first · retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 3 — Sync & Close:                         [Cycle 3 · serial]
  Context:  Update file + variable indexes, run symbol_indexer, mark roadmap done.
  Skill:    index_manager (mode:file)
  Model:    model_low
  Input_From: cycle_2_S2.json (created file paths)
  Tool:     Bash · Edit
  Constraints:
    - Creation: append to backlinks[] of every imported file · size object required
    - python scripts/symbol_indexer.py mandatory · [✓ written] verify index updated
  Steps:    [C] index_manager (mode:file): update index_files.json + backlinks
            [D] index_manager (mode:symbol): update index_variables.json
            [E] python scripts/symbol_indexer.py · mark roadmap [X]
  Verify:   symbol count increased · no stale backlinks
  Rollback: restore index from last known state
  Expected_Traces: index_files.json entry · index_variables.json updated · roadmap [X]
  Refusal_Path: [file-manager-refused] → halt · check gather_complete.md exists · retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k
```

### Refactor / Rename (target: editor)
```
# Serial chain — diagnose blast radius → rename all sites → sync · <5 files → run in main context
Section 1 — Diagnose:                             [Cycle 1 · serial]
  Context:  Build the full used_in blast-radius list before any rename.
  Skill:    editor
  Model:    model_low
  Input_From: none
  Tool:     Bash
  Constraints:
    - blast radius: full used_in list required before any rename begins
  Steps:    [A] grep index_variables → get all used_in files · assess blast radius
  Verify:   grep -c "OldName" knowledge/index_variables.json ≥ 1 · used_in list complete
  Rollback: n/a (read-only)
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 2 — Edit & Verify:                        [Cycle 2 · serial]
  Context:  Rename across every call site + prove 0 old refs remain.
  Skill:    editor
  Model:    model_high
  Input_From: cycle_1_S1.json (used_in file list)
  Tool:     Edit · Bash
  Constraints:
    - [pre-edit] emit before every rename · [✓ written] verify 0 old refs remain
    - R12: re-read each changed call site · R14: [gate] if >5 files affected
  Steps:    [B] rename in source · update all used_in call sites
            [C] [✓ written] grep old name → 0 results
  Verify:   grep -rn "OldName" src/ | wc -l = 0
  Rollback: revert all edited files
  Expected_Traces: [pre-edit] · [✓ written] per call site · blast-radius confirmed
  Refusal_Path: [edit-refused] → halt · run [gate] if >5 files affected · retry after confirm
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 3 — Sync & Close:                         [Cycle 3 · serial]
  Context:  Rename the index key, run symbol_indexer, mark roadmap done.
  Skill:    index_manager (mode:symbol)
  Model:    model_low
  Input_From: cycle_2_S2.json (renamed sites)
  Tool:     Bash · Edit
  Constraints:
    - python scripts/symbol_indexer.py mandatory · [✓ written] verify index updated
  Steps:    [D] python scripts/symbol_indexer.py · update index_variables.json key
            [E] mark roadmap [X]
  Verify:   grep -c "NewName" knowledge/index_variables.json ≥ 1
  Rollback: restore index_variables.json key to OldName
  Expected_Traces: index_variables.json key renamed · roadmap [X]
  Refusal_Path: n/a (index_manager (mode:symbol) has no refusal contract) → proceed
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k
```

### Multi-skill / Complex Feature (target: agent)
```
Section 1 — Scope & Design:                       [Cycle 1 · serial]
  Context:  Probe scope, split work into coder/editor/sync sections, pre-assign all T-IDs + cycle grouping.
  Skill:    agent
  Model:    model_high
  Input_From: none
  Tool:     Bash · Read
  Constraints:
    - Pre-assign ALL T-IDs before any spawn (INVARIANTS.md §I6)
    - [pre-read] T0 lookup → emit [pre-read] · [post-read] verdict
  Steps:    [A] R4 scope probe → find src/ -name "*.ts" | wc -l
            [B] identify sections: coder vs editor vs index_manager (mode:file) · dependency_map[] → Cycle grouping
            [C] pre-assign roadmap T-IDs for all sections
  Verify:   grep -c "? " .sessions/mece_plan.md = 0 (no unresolved placeholders)
  Rollback: n/a (read-only)
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 2 — Build New Files:                      [Cycle 2 · parallel]
  Context:  Create all new files per spec (no edits to existing code) — independent of S3.
  Skill:    coder · Tool: Write · Bash
  Model:    model_high
  Input_From: cycle_1_S1.json (section spec + T-IDs)
  Constraints:
    - [✓ written] verify each file · Do NOT edit indexes directly
    - Edge Runtime: no Node.js APIs · R15: src/db/ → [db-gate] → HALT
  Steps:    [D] create files per spec · [✓ written] verify each
  Verify:   ls src/path/NewFile.tsx 2>/dev/null && echo found = found
  Rollback: delete created files
  Expected_Traces: [✓ written] per file · roadmap [/] → [X]
  Refusal_Path: [coder-refused] → halt · assign T-ID in roadmap first · retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 3 — Modify Existing Code:                 [Cycle 2 · parallel]
  Context:  Apply targeted edits to existing files — independent of S2 (no shared file).
  Skill:    editor · Tool: Edit · Bash
  Model:    model_high
  Input_From: cycle_1_S1.json (section spec + T-IDs)
  Constraints:
    - [pre-edit] before every symbol Edit · R14: [gate] batch >5 files · R15: src/db/
  Steps:    [E] targeted edits · [✓ written] verify each
  Verify:   grep -c "NewImport" src/path/ExistingFile.ts ≥ 1
  Rollback: revert edited files
  Expected_Traces: [pre-edit] · [✓ written] per edit · [gate] if batch >5 files
  Refusal_Path: [edit-refused] → halt · check mece_plan.md + gather_complete.md exist · retry
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Section 4 — Sync & Close:                         [Cycle 3 · serial]
  Context:  After the S2+S3 barrier, cascade index updates, run symbol_indexer, mark all T-IDs done.
  Skill:    index_manager · Tool: Bash · Edit
  Model:    model_low
  Input_From: cycle_2_S2.json, cycle_2_S3.json (created + modified paths)
  Constraints:
    - backlinks[] cascade update · size object required · python scripts/symbol_indexer.py mandatory
  Steps:    [F] index_manager (mode:file): update index_files.json + backlinks
            [G] index_manager (mode:symbol): update index_variables.json
            [H] python scripts/symbol_indexer.py · mark roadmap [X] all T-IDs
  Verify:   python scripts/symbol_indexer.py 2>&1 | grep -c "error" = 0
  Rollback: restore indexes from pre-task snapshot
  Expected_Traces: index_files.json + index_variables.json updated · roadmap [X] all T-IDs
  Refusal_Path: n/a → proceed (no refusal contract for index_manager)
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k

Cycle grouping:
  Cycle 1 — serial   · agents: 1                          → S1   (scope + design first)
  Cycle 2 — parallel · agents: 2 · cap: 2                 → S2, S3   (no shared file · no mutual dep)
    Barrier: all cycle_2_*.json status:done → Cycle 3
  Cycle 3 — serial   · agents: 1 · Input_From: cycle_2_*  → S4   (pulls cycle_2_S2.json + cycle_2_S3.json)
```

### Harness Skill Editing (target: editor · path: .agents/)
```
# Use when: editing SKILL.md files, AGENTS.md, CLAUDE.md, or other harness config.
# Key difference from Bug Fix: no src/ edits, no symbol_indexer needed, no ERR-XXX.
# File Size Contract: SKILL.md ≤200L ideal · 201-250L acceptable · >250L must split.
# Serial chain — diagnose → edit → close · single context (no spawn for harness .md edits)

Section 1 — Diagnose & Plan:                      [Cycle 1 · serial]
  Context:  Size the target harness files + grep the exact edit lines (no full-load).
  Skill:    editor
  Model:    model_low
  Input_From: none
  Tool:     Bash · Read
  Constraints:
    - [pre-read] grep for line number first · Read with offset+limit only
    - check file size: wc -l <file> → flag if >200L (consider SKILL_detail.md split)
    - Never-Full-Load: CLAUDE.md / AGENTS.md → grep only · SKILL.md ≤80L → Read ok
  Steps:    [A] wc -l target files · flag >200L
            [B] grep for edit target lines
  Verify:   target lines identified · no full-load violations
  Rollback: n/a (read-only)
  Expected_Traces: [pre-read] · [post-read] verdict · wc output
  Refusal_Path: [edit-refused] → halt · check trigger conditions satisfied · retry

Section 2 — Edit & Verify:                        [Cycle 2 · serial]
  Context:  Apply targeted edits, grep-verify each, split the file if it exceeds 250L.
  Skill:    editor
  Model:    model_high
  Input_From: cycle_1_S1.json (target lines + size flags)
  Tool:     Edit
  Constraints:
    - [pre-edit] emit for every named symbol / rule / section heading changed
    - [✓ written] grep verify after every Edit
    - File Size Contract: if result >250L → split into SKILL.md + SKILL_detail.md
    - AGENTS.md: must stay ≤200L — shrink wording not logic
  Steps:    [C] targeted Edit · [✓ written] grep verify
            [D] wc -l result · if >250L → split (add SKILL_detail.md)
  Verify:   grep confirms change exists · file ≤250L (or split done)
  Rollback: revert edit
  Expected_Traces: [pre-edit] · [✓ written] · wc-l result
  Refusal_Path: [edit-refused] → halt · check never-full-load not violated · retry

Section 3 — Close:                                [Cycle 3 · serial]
  Context:  Mark roadmap done; if a new skill was added, update the manifest + registry.
  Skill:    editor
  Model:    model_low
  Input_From: cycle_2_S2.json (edited files)
  Tool:     Bash
  Constraints:
    - roadmap `[ ]→[X]` mandatory
    - No index sync needed (harness files not in src/)
    - If new SKILL.md created: add to skill-manifest.json + registry.md
  Steps:    [E] mark roadmap [X] T-<N>
            [F] if new skill: grep -c skill-manifest.json + registry.md update
  Verify:   roadmap [X] · manifest updated if new skill
  Rollback: revert manifest if incorrect
  Expected_Traces: roadmap [X] · manifest entry (if new skill)
  Refusal_Path: n/a → proceed
  Data_Sent: Thai ___ch | ENG: ___ch
  Token:    ___k
```

---

## §Checklist — Phase-Checklist Template (write to mece_plan.md at M5)

Every mece_plan.md MUST include Phase 0-3 blocks below. Agent fills `___` at runtime.
**Pre-fill rule:** leave ALL `___` as-is at plan creation — fill only at runtime. Never hardcode 0k/0ch.
**~Tok formula:** `EN_ch × 0.3 / 1000` · `TH_ch × 1.7 / 1000`

```
## Phase 0 — Boot (once per session · keep [X] on resume · DO NOT reset)
### Files Read
| File | Tool | TH ch | EN ch | ~Tok |
|---|---|---|---|---|
| .sessions/compact_state.md | cat (B1) | ___ | ___ | ___ |
| .sessions/active_thread.md | wc -m | ___ | ___ | ___ |
| skill-manifest.json (grep) | grep keywords | ___ | ___ | ___ |
| .agents/skills/<name>/SKILL.md | wc -m | ___ | ___ | ___ |
| .agents/skills/harness/mece/SKILL.md (offset=31 limit=110) | wc -m | ___ | ___ | ___ |
Phase 0 total: TH ___ch · EN ___ch → ~___tok

→ Carry forward: skill_name=___ · CFP_COUNT=___ · task=___

- [ ] B1: compact_state.md checked · active_thread read · SESSION_TOTAL reset · CFP_COUNT stored
- [ ] B2-B3: [compact-restore] → sk= parsed + sha1 checked · OR manifest grep + SKILL.md read
- [ ] C0-C3: routing confirmed · no topic switch
→ TOKEN CHECK: printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md

---

## Phase 1 — Info Gather
### Files Read
| File | Tool | TH ch | EN ch | ~Tok |
|---|---|---|---|---|
| <file> | grep | ___ | ___ | ___ |
Phase 1 total: TH ___ch · EN ___ch → ~___tok

- [ ] G1: ALL sections scanned (1 pass)
- [ ] G2: batch greps + targeted reads · [post-read] verdicts emitted
- [ ] G3: every section → file/symbol + Verify-N · [✓ gather] emitted
- [ ] gather_complete.md written today
→ TOKEN CHECK: printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md

---

## Phase 2 — Plan
### Files Read
| File | Tool | TH ch | EN ch | ~Tok |
|---|---|---|---|---|
| .agents/skills/harness/mece/SKILL.md (offset) | grep | ___ | ___ | ___ |
Phase 2 total: TH ___ch · EN ___ch → ~___tok

- [ ] M1.5: reasoning pass done · dependency_map[] + risk_flags[] in memory
- [ ] M2: plan 1:1 sections · Skill: + Tool: per section · ≥2 Verify-N
- [ ] M3: user confirmed · M4: roadmap entries written
- [ ] M5: [✓ MECE] emitted · mece_plan.md written today
→ TOKEN CHECK: printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md
```

**Phase 3 close block:**
```
## Phase 3 — Execute + Close
- [ ] S1 [✓ written] + Verify PASS · Data_Sent: TH ___ch · EN ___ch
      → TOKEN CHECK
- [ ] S<N> [✓ written] + Verify PASS · Data_Sent: TH ___ch · EN ___ch
      → TOKEN CHECK  (>50k → /compact · >60k → TOKEN PAUSE)
- [ ] R8 index sync done (if files/symbols changed)
- [ ] Roadmap [X] all sections annotated
- [ ] Spawn Reviewer (MODEL_LOW · read-only):
      "You are a read-only reviewer. Do NOT edit any file.
      0. Classify task_type from mece_plan.md →
         edge/API → CLI + data read-back
         UI/frontend → CLI + browser/preview
         DB → CLI + data read-back + adversarial
         other → CLI only
      1. Read .sessions/mece_plan.md → find all Verify-N: lines
      2. Run each Verify-N command exactly as written
      3. PASS = exits 0 AND output matches expected
      Report: task_type · surfaces · PASS list · FAIL list"
      On PASS → proceed · On FAIL → fix → retry 1× → R13
- [ ] active_thread.md → phase: done
- [ ] Session Close (Behavior Contract — runs after active_thread phase:done):
      Pre:      `ls .sessions/session_*.json 2>/dev/null | wc -l` → store count N
                check if task modified src/ or is a feature/bugfix task
      Contract: src/ changed OR feature/bugfix → MUST write session_<NNN>.json + run session_indexer.py
                harness-only task → session_<NNN>.json optional · session_indexer still recommended
                Both cases: index_sessions.json MUST reflect latest state before clear
      Post:     `ls .sessions/session_*.json | wc -l` → must equal N+1 if src/ was changed
                `python scripts/session_indexer.py` exit 0
                missing = invalid close → re-run before Clear
      Enforce:  mece_plan_schema PATH A/C BC · session_manager §3 · CFP-030
- [ ] Clear mece_plan.md Phase 1–3 (keeps Phase 0 [X]):
      head -n $(grep -n "^## Phase 1" .sessions/mece_plan.md | head -1 | cut -d: -f1) \
      .sessions/mece_plan.md > /tmp/mece_h.md && \
      printf "\n## Phase 1–3 — cleared\nstatus: task-complete\n" >> /tmp/mece_h.md && \
      mv /tmp/mece_h.md .sessions/mece_plan.md
- [ ] Write compact_state.md (BEFORE /compact):
      dt=<today> s=___k task=___ cfp=___
      sk=___ sk_h=<8chars> mece_h=<8chars>
      p1=done p2=done p3=last_section=S<N> resume_at=<desc>
- [ ] SESSION_TOTAL written: printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md
- [ ] self_improve: grep -c "^## CFP-" → if > boot_count → review
- [ ] harness_doctor: grep -c "recurred_after_fix" knowledge/index_cfp_fix.json → if ≥1 → trigger
- [ ] Feedback & Error Summary delivered · Ask: "มีอะไรผิดปกติไหมครับ?"
```

**Phase 0 persistence rules:**
- Fresh session → all Phase 0 = [ ]
- Same session, new task → Phase 0 stays [X] · reset Phase 1–3
- Topic switch → session_manager creates new mece_plan.md → all [ ]
- After /compact: G0 restore — Read session_handoff.md → restore skill_name + CFP_COUNT + task
