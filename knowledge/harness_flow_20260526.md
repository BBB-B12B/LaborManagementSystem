# Harness Complete Flow — Post-Fix Reference

> **Date:** 2026-05-26
> **Version:** v2.1 (CFP fix index + harness_doctor + checkpoint gates)
> **Session:** session_086+
> **Replaces:** harness_flow_20260525.md (v2.0)
>
> Definitive reference after v2.0 patches and 2026-05-26 improvements.
> Read alongside CLAUDE.md and AGENTS.md.
> ★ = 2026-05-25 patch · ● = 2026-05-26 CFP tracking + harness_doctor + checkpoints

---

## Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 0 · CONSTRAINTS (immutable — read first, every agent)         │
│                                                                      │
│  CLAUDE.md (project)        ← R1–R16, R-Roadmap (hard rules)        │
│  AGENTS.md                  ← Boot + Loop Architecture (procedure)  │
│  INVARIANTS.md              ← I1–I8 (I8: CFP index race condition)   │
│  REPO_MAP.md                ← directory rules + dependency direction │
│  CODING_FAILURE_PATTERNS.md ← CFP-001–CFP-009+ (post-mortem log)    │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 1 · SKILL ROUTING                                             │
│                                                                      │
│  .agents/skills/skill-manifest.json   ← keyword → skill mapping     │
│  .agents/skills/registry.md           ← fast-match table            │
│  .agents/skills/mece/SKILL.md         ← Phase 2 planning            │
│  .agents/skills/editor/SKILL.md       ← code edit + [post-read] ★  │
│  .agents/skills/coder/SKILL.md        ← new file + [post-read] ★   │
│  .agents/skills/agent/SKILL.md        ← orchestration + merge ★    │
│  .agents/skills/session_manager/SKILL.md ← pause/resume/close ★    │
│  .agents/skills/self_improve/SKILL.md    ← CFP review + harness ✦  │
│  .agents/skills/harness_doctor/SKILL.md  ← structural CFP fix ●      │
│  .agents/skills/harness_editor/SKILL.md  ← harness file edits △      │
│  .agents/skills/token_tracker/SKILL.md   ← estimation formulas      │
│  .agents/skills/file_manager/SKILL.md    ← index_files sync         │
│  .agents/skills/variable_manager/SKILL.md← index_variables sync     │
│  .agents/platform/detected.md         ← spawn_tool per platform     │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 2 · KNOWLEDGE BASE                                            │
│                                                                      │
│  knowledge/index_files.json      ← backlinks (imported_by, imports) │
│  knowledge/index_variables.json  ← symbols + line numbers (used_in) │
│  knowledge/index_sessions.json   ← session history index ★★         │
│  knowledge/index_cfp_fix.json    ← CFP occurrence + fix tracking ●   │
│  knowledge/error_index.md        ← ERR-XXX codes (search first)     │
│  docs/master_roadmap.md          ← task checklist [ ]→[/]→[X]       │
│                                                                      │
│  INDEX MAINTENANCE SCRIPTS (rebuild knowledge layer):               │
│  scripts/symbol_indexer.py  ← scans src/ → updates index_variables  │
│  scripts/lookup.py          ← T0 oracle: file+line+hint in one call ★★│
│  scripts/session_indexer.py ← scans .sessions/ → index_sessions ★★  │
└────────────────────────────┬─────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3 · SESSION STATE                                             │
│                                                                      │
│  .sessions/active_thread.md     ← phase: done|in_progress|blocked   │
│  .sessions/session_tokens.md    ← SESSION_TOTAL (gate writes only)  │
│  .sessions/mece_plan.md         ← section checklist + pending       │
│  .sessions/session_handoff.md   ← resume point                      │
│                                    + attempt_count ★                │
│                                    + mece_plan_hash ★               │
│  .sessions/session_NNN.json     ← archive (session_001–073)         │
│  .sessions/compact_state.md    ← B1 restore: dt/sk/sk_h/mece_h/p3 ◆│
│                                   written at session close (Step 5.3)│
│                                   same-day → skip B2/B3 (~2.9k tok) │
└──────────────────────────────────────────────────────────────────────┘
                   ★ = added in 2026-05-25 vulnerability fixes
                   ● = added in 2026-05-26 CFP tracking + harness_doctor + checkpoint gates
                   ◆ = added in 2026-05-27 compact_state.md + mece_plan_controler fixes
                   △ = added in 2026-05-29 harness_editor skill (T-021)
```

---

## Boot Sequence

```
USER MESSAGE
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  BOOT  [AGENTS.md §Boot · CLAUDE.md §Boot · max 3 tool calls]  │
│                                                                 │
│  [B1] Bash: check .sessions/compact_state.md dt= field ◆       │
│       dt=today → emit [compact-restore] · cat compact_state.md │
│       Then: read .sessions/active_thread.md                    │
│       ├─ phase = in_progress  → load SESSION_TOTAL             │
│       └─ phase ≠ in_progress  → SESSION_TOTAL = 0 (reset)      │
│       + grep roadmap [/] · echo CFP_COUNT: N → cfp_boot_count  │
│                                                                 │
│  [B2] IF [compact-restore]: parse sk= → use as skill_name ◆   │
│            SKIP manifest read (~1,300 tokens saved)            │
│       ELSE IF prompt `skill: <name>` → skip manifest           │
│       ELSE: grep skill-manifest.json keywords → skill_name     │
│                                                                 │
│  [B3] IF [compact-restore]: sha1 check sk_h + mece_h ◆        │
│            match → SKIP SKILL.md reads (~2.9k tokens saved)   │
│            mismatch → re-read (file changed)                   │
│       ELSE: Read SKILL.md offset=1 limit=80 → sections[] ONLY  │
│             + Read mece/SKILL.md offset=31 limit=110           │
│             → §Plan Format + §Execution Protocol in memory     │
│                                                                 │
│  [B4] *** only if detected.md has platform: unknown ***        │
│       → probe available tools → update detected.md             │
│       → no match → [platform-unknown] → ask 4 questions        │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─── phase = in_progress? ────────────────────────────────┐
     │                                                         │
     │  RESUME STALENESS GATE ★ [AGENTS.md §Boot]             │
     │  ┌─────────────────────────────────────────────────┐   │
     │  │ sha1sum .sessions/mece_plan.md                  │   │
     │  │   vs mece_plan_hash in session_handoff.md       │   │
     │  │ git status --short src/ → any changes?          │   │
     │  │                                                 │   │
     │  │ hash mismatch OR src/ changed:                  │   │
     │  │   → emit [plan-stale]                          │   │
     │  │   → ask user: reconfirm plan or rebuild?       │   │
     │  │                                                 │   │
     │  │ hash matches AND src/ clean:                    │   │
     │  │   → Phase 3 directly (skip Phase 1–2)          │   │
     │  └─────────────────────────────────────────────────┘   │
     └─────────────────────────────────────────────────────────┘
     │
     ▼
  Reply line 1 (mandatory — CFP: field enforces cfp_boot_count extraction ◆):
  [Boot] Thread: <done|in_progress> · Tasks: N · Skill: <name> · Tokens: ~Nk · CFP: N
```


╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK1: Post-Boot — Ready to Route?             ║
╠══════════════════════════════════════════════════════════╣
║ □ [Boot] trace emitted in reply line 1                  ║
║ □ compact_state.md checked · [compact-restore] if today ◆║
║ □ cfp_boot_count stored in working memory (B1)          ║
║ □ skill_name cached from B2/B3 · or from sk= field ◆   ║
║ □ SESSION_TOTAL = 0 (fresh) or loaded (resume)          ║
║ → any □ missing: re-run missing Boot step before C0     ║
╚══════════════════════════════════════════════════════════╝
> ⚠️ **Boot ending ≠ ready to work.** After Reply line 1 → run C0–C3 → then Phase 1.
> Reading SKILL.md at B3 is NOT Phase 1. Do NOT touch `src/` until `[✓ gather]` AND `[✓ MECE]` emitted.
> See: `CLAUDE.md §MANDATORY BOOT GATE`

---

## Per-Turn Routing

```
Every user message — run C0 → C1 → C2 → C3 before any work ✦
[CLAUDE.md §Per-Turn · AGENTS.md §Per-Turn]
     │
     ▼
┌────────────────────────────────────────────────────────────────────┐
│  [C0] if c0_resolved flag set → clear → skip to C1 ◆              │
│       COMPLAINT CHECK ✦ (R16 CLAUDE.md)                           │
│       signals: "ทำไมไม่ทำตาม" · "you skipped" · "didn't log"      │
│                "harness says" · "ไม่ได้บันทึก"                     │
│       "ลืม" qualifier: object must be a harness step name          │
│         (roadmap/error_index/CFP/index/boot/skill/gate/MECE)       │
│         "ลืมบอกให้เพิ่ม X" = feature → NOT C0                     │
│       YES → emit [self-improve] → backfill (ask if context gone)   │
│           → log CFP → set c0_resolved=true → re-run C0-C1-C2-C3 ◆ │
│       NO  → continue to C1                                         │
│                                                                    │
│  [C1] Read .sessions/active_thread.md → extract task: field        │
│                                                                    │
│  [C2] TOPIC SWITCH CHECK ✦                                         │
│   IS new topic (close session first):                              │
│     · Different app section (site-plan↔center↔admin↔report)       │
│     · Different primary entity (job↔user↔plan↔request)            │
│     · Different intent type (debug→feature, or feature→debug)      │
│     · Message names different src/app/ route than current task     │
│   NOT a switch:                                                    │
│     · "also fix/update" · revision of approach · added constraint  │
│     · bug inside current work · "ต่อ/continue/keep going"          │
│   UNCERTAIN → emit [topic-unclear] → ASK before routing            │
│                                                                    │
│  [C3] ROUTE                                                        │
│   TOPIC SWITCH →                                                   │
│       emit [topic-switch] Current: X · New: Y · Closing first      │
│       → session_manager §3 (close + reset) → new Phase 1          │
│   SAME TOPIC →                                                     │
│       match keywords[] → re-read SKILL.md if skill changes         │
└────────────────────────────────────────────────────────────────────┘

Routing examples (after C2 confirms same topic):
  "แก้ bug / fix / error"       → editor/SKILL.md
  "สร้าง / เพิ่ม / implement"   → coder/SKILL.md
  "ปิด / close / done"           → session_manager/SKILL.md
  "plan / วางแผน"                → mece/SKILL.md
  "review CFP / improve harness" → self_improve/SKILL.md ✦
  "harness doctor / structural"  → harness_doctor/SKILL.md ●
  "แก้ harness / update harness / edit SKILL.md / improve skill" → harness_editor/SKILL.md △
  no match                      → agent/SKILL.md (fallback)
```


╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK2: Post-C3 — Ready for Phase 1?            ║
╠══════════════════════════════════════════════════════════╣
║ □ C0 complaint resolved (or c0_resolved cleared)        ║
║ □ C1 active_thread.md read → task: field extracted      ║
║ □ C2 topic switch resolved (stay / close+reopen)        ║
║ □ C3 skill_name matched and routed                      ║
║ → any □ missing: complete C0-C3 first                   ║
╚══════════════════════════════════════════════════════════╝
> ⚠️ **After C3 (any branch) → MANDATORY: Phase 1 G1-G2-G3 next. No exceptions.**
> Knowing the skill from B3 does NOT satisfy Phase 1. Must grep indexes + read files + emit `[✓ gather]`.
> Then Phase 2: MECE plan → user confirm → write `mece_plan.md` → emit `[✓ MECE]`.
> **Infrastructure gate:** PreToolUse hook blocks `src/` Edit if `mece_plan.md` absent.
> See: `CLAUDE.md §PHASE TRANSITION GATE`, `AGENTS.md §Per-Turn line 122`

---

## Phase 1 · Info Gather

```
[AGENTS.md §Phase 1 · CLAUDE.md §R5 · editor/SKILL.md · coder/SKILL.md]

┌─────────────────────────────────────────────────────────────────────┐
│  GATHER LOOP — Hybrid front-loaded model (max 3 loops total) ◈      │
│                                                                     │
│  [G1] SCAN ALL sections at once — one pass, not per-section ◈      │
│       For EACH section in Skill sections[]:                         │
│         □ What file/symbol does this section need?                  │
│         □ Available via index grep, or needs user input?            │
│       Output: missing_files[] + missing_user_input[]               │
│       → missing_user_input not empty?                               │
│           Compile COMPLETE list → ask user ONCE (all items)         │
│           NEVER ask per-item mid-loop                               │
│           Wait for reply → restart G1 with new info                │
│       → missing_files only? → proceed to G2                        │
│                                                                     │
│  [G2] BATCH RETRIEVE — all greps in ONE Bash call ◈                │
│       Run ALL needed greps together → get line numbers              │
│       Then: targeted Read per item (offset+limit, never full file)  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ PRE-READ GATE ★ [CLAUDE.md §R5]                             │  │
│   │ emit before EVERY Read (no exceptions):                      │  │
│   │   [pre-read] Target: X · Tier: T1|2|3 · Line: N             │  │
│   │ no line number → grep not done → grep first                  │  │
│   │ Read without gate = [violation R5] → discard → redo          │  │
│   └──────────────────────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ POST-READ VERDICT ★ [CLAUDE.md §R5]                         │  │
│   │   [post-read] File: <path> · Verdict: relevant|partial|irrelevant│
│   │ irrelevant → DROP from context NOW · not in Phase 2          │  │
│   │ partial    → keep excerpt only (note L<N>–L<N>)              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [G3] ASSESS — all must pass:                                       │
│       □ every Skill section has ≥1 resolved file/symbol            │
│       □ every Skill section has a Verify-N criterion               │
│       □ no "?" placeholders remain                                 │
│       ✅ all clear → emit [✓ gather] → Phase 2                    │
│       ❌ new dependency found → loop once more (max 2 extra loops) │
│       count = 3 → [gather-stalled] → ask user (single message)     │
│                                                                     │
│  Hard limits ◈: G1 = 1 pass all sections · G2 = 1 Bash batch       │
│  User asks = max 1 per Phase 1 run · TOKEN check: >60k → PAUSE     │
└─────────────────────────────────────────────────────────────────────┘
```

---
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK3: Pre-Phase 2 — Gather Complete?          ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ gather] emitted this phase                         ║
║ □ gather_complete.md exists (date = today)              ║
║ □ Every Skill section: ≥1 resolved file/symbol          ║
║ □ Every Skill section: draft Verify-N criterion         ║
║ □ No "?" placeholders in working notes                  ║
║ → any □ missing: back to G1 (Phase 1)                   ║
╚══════════════════════════════════════════════════════════╝


## Phase 2 · MECE Plan

```
[AGENTS.md §Phase 2 · .agents/skills/mece/SKILL.md · INVARIANTS.md §I6]

Runs ONCE per task. Resume → skip if plan is still valid.

┌─────────────────────────────────────────────────────────────────────┐
│  [M1] Load .agents/skills/mece/SKILL.md                             │
│                                                                     │
│  [M1.5] REASON — extended reasoning pass across ALL sections:       │
│   □ Dependencies: A→B output chain? → Sequential                   │
│   □ Parallelizable: no shared state → Parallel (feeds Cycle groups) │
│   □ Irreversible: [gate]/delete/DB? → flag for M3 user attention    │
│   □ Risk surface + Outcome sketch → feeds M2.5 Verify-N            │
│   Budget: ≤600 tokens · working memory only · not written to file   │
│                                                                     │
│  [M2] Build plan 1:1 with Skill sections — REQUIRED per section:    │
│   Section N — <name from Skill sections[]>:                         │
│     Skill:    <editor|coder|file_manager|variable_manager|agent>    │
│     Steps:   [A] → [B] → [C]                                       │
│     Verify:  <checkable command — see Verify Pattern Lookup>        │
│     Rollback: <what to undo>                                        │
│   ★ Skill: field mandatory per section [mece/SKILL.md §Plan Format] │
│                                                                     │
│  [M2.5] Define Verify-N per section (DoD):                          │
│   Verify-1: `grep -c "symbolName" src/path.ts` → 1                 │
│   Verify-2: `npm run build 2>&1 | grep -c "error"` → 0             │
│   ★ Verify Pattern Lookup [mece/SKILL.md §Verify Patterns]:         │
│     symbol create/delete/rename · import add/remove · file ops      │
│     build · tsc · DB table/row · index sync · roadmap [X] · ERR    │
│                                                                     │
│  [M3] Send plan + Verify-N to user → wait for confirm               │
│       user must confirm BOTH plan steps AND verify criteria         │
│                                                                     │
│  [M4] Write roadmap entries ★ [INVARIANTS.md §I6]                  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ If spawning parallel sub-agents:                            │  │
│   │ 1. grep roadmap → find last T-N                             │  │
│   │ 2. pre-assign T-N+1, T-N+2 ... for every section           │  │
│   │ 3. write ALL [ ] T-N entries BEFORE any spawn call          │  │
│   │ 4. pass assigned T-ID to each sub-agent                     │  │
│   │ ★ sub-agents must NOT self-assign IDs (race condition risk)  │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [M5] emit [✓ MECE] → proceed to Phase 3                           │
└─────────────────────────────────────────────────────────────────────┘
```

---
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK4: Pre-Phase 3 — MECE Complete?            ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ MECE] emitted                                      ║
║ □ .sessions/mece_plan.md written today                  ║
║ □ mece_plan.md has ≥2 Verify-N criteria                 ║
║ □ User explicitly confirmed plan + Verify-N             ║
║ □ Roadmap [ ] T-N entries written                       ║
║ → any □ missing: back to Phase 2 (M1-M5)               ║
╚══════════════════════════════════════════════════════════╝


## Phase 3 · REACT Loop (Execution)

```
[AGENTS.md §Phase 3 · CLAUDE.md §R2/R5/R6 · editor/SKILL.md]

SECTION LOOP (S = 1 → N per MECE plan)
     │
     ├─ TOKEN check: >60k → finish step → TOKEN PAUSE ──────────────┐
     │                                                               │
     ▼                                                               │
┌──────────────────────────────────────────────────────────────────┐ │
│  REACT LOOP (repeat per step until section complete)             │ │
│                                                                  │ │
│  [L1] SELECT → next tool                                         │ │
│       R2: max 5 tool calls/turn [CLAUDE.md §R2]                  │ │
│       R5: index-first before every Read [CLAUDE.md §R5]          │ │
│                                                                  │ │
│  [L2] EXECUTE → run tool                                         │ │
│       R6: pipe output | grep -iE "error|warn|fail" | tail -20    │ │
│       [CLAUDE.md §R6]                                            │ │
│                                                                  │ │
│  [L3] OBSERVE → result correct?                                  │ │
│       unexpected → retry 1×                                      │ │
│       retry fails → BLOCKED ───────────────────────────────────┐ │ │
│                                                                  │ │ │
│  [L4] VERIFY — both must pass:                                   │ │ │
│  (a)  grep confirm → emit [✓ written]                            │ │ │
│       not found → retry 1× → fail → BLOCKED ───────────────────┤ │ │
│  (b)  run Verify-N defined in Phase 2                            │ │ │
│       PASS → section_done eligible                               │ │ │
│       FAIL → do NOT mark done → BLOCKED ────────────────────────┤ │ │
│                                                                  │ │ │
│  [L4.5] PURGE ◈ drop step's tool results from working context    │ │ │
│         keep only: [✓ written] verdict + artifact path + Verify  │ │ │
│         NEVER carry raw tool output to next step                 │ │ │
│                                                                  │ │ │
│  [L5] DECIDE                                                     │ │ │
│       steps remain → [loop] Section S · step <name> → continue  │ │ │
│       (a)+(b) pass → emit [loop] done · section complete         │ │ │
└──────────────────────────────────────────────────────────────────┘ │ │
     │                                                               │ │
     ▼                                                               │ │
╔══════════════════════════════════════════════════════════╗
║ CHECKPOINT CK5: Pre-Next-Section — Section Done?        ║
╠══════════════════════════════════════════════════════════╣
║ □ [✓ written] grep verify passed for this section       ║
║ □ Verify-N from mece_plan.md for this section: PASS     ║
║ □ mece_plan.md: current section marked [X]              ║
║ □ Roadmap T-N for this section marked [X]               ║
║ → any □ missing: stay in REACT LOOP (do NOT advance)    ║
╚══════════════════════════════════════════════════════════╝
Write .sessions/session_handoff.md ★ [session_manager/SKILL.md §2]  │ │
  sections_done: [list]                                              │ │
  sections_pending: [list]                                           │ │
  last_step: <name>                                                  │ │
  attempt_count: N    ← retries used on current step (0 or 1) ★    │ │
  mece_plan_hash: X   ← sha1 of mece_plan.md at this moment ★      │ │
  cfp_boot_count: N   ← persisted for /compact resume recovery ◆   │ │
  cfp_deferred: {}    ← merged (not overwritten) at session close ◆ │ │
  cfp_dismissed: []   ← permanent — survives across sessions ◆     │ │
  last_self_improve_session: <id> ← cooldown gate reference ◆      │ │
     │                                                               │ │
     └─ next section ────────────────────────────────────────────────┘ │
                                                                        │
TOKEN PAUSE [session_manager/SKILL.md §2] ◄─────────────────────────── │
┌──────────────────────────────────────────────────────────────────────┐
│ 1. finish current step (never stop mid-step)                         │
│ 2. write session_handoff.md (with attempt_count + mece_plan_hash ★) │
│ 3. ask user: "ดำเนินการต่อไหมครับ?"                                   │
│ 4. on confirm:                                                       │
│                                                                      │
│    MECE Staleness Gate ★ [session_manager/SKILL.md §2 step 2b]      │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │ sha1sum mece_plan.md vs mece_plan_hash in handoff           │  │
│    │ git status --short src/ → any changes?                      │  │
│    │ mismatch → [plan-stale] → ask: reconfirm or rebuild?        │  │
│    │ match + clean → proceed silently                            │  │
│    └─────────────────────────────────────────────────────────────┘  │
│    restore attempt_count → budget = 1 if count=0, 0 if count=1 ★   │
│    reset to pending section → reopen REACT LOOP                     │
└──────────────────────────────────────────────────────────────────────┘

BLOCKED [session_manager/SKILL.md §2 · AGENTS.md §Phase 3]
┌──────────────────────────────────────────────────────────────────────┐
│ 1. HALT all remaining sections                                       │
│ 2. write session_handoff.md (status: blocked)                        │
│ 3. show: error detail + sections_done + sections_pending             │
│ 4. ask user: "แก้ก่อนดำเนินการต่อ หรือ skip section นี้?"            │
│    Fix  → user resolves → reload → resume blocked section           │
│    Skip → mark [/] + note → continue next section                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Sub-agent Orchestration (Parallel Fan-out)

```
[agent/SKILL.md · AGENTS.md §Sub-agent Rules · INVARIANTS.md §I6/I7]

Trigger: ≥5 files / ≥300 lines / ≥2 MECE sections in same Cycle

┌──────────────────────────────────────────────────────────────────────┐
│  Pre-spawn checklist:                                                │
│  1. Read .agents/platform/detected.md → get spawn_tool              │
│     platform: unknown → run B4 probe first                          │
│  2. Pre-assign roadmap IDs ★ [INVARIANTS.md §I6]                   │
│     grep roadmap → last T-N                                          │
│     write [ ] T-N+1, T-N+2 for all sections BEFORE spawn            │
│     pass assigned T-ID to each sub-agent in Delegation Contract      │
│  3. Delegation Contract ◈ [agent/SKILL.md]: prompt ≤800 tokens      │
│     goal: 1-3 sentences · constraints: rule numbers only            │
│     context_files: paths only ≤5 · cycle_context: ≤5 bullets ≤150c  │
│     NEVER inject: session History / knowledge JSON / CLAUDE.md text │
└──────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Skill Delegation ★ [agent/SKILL.md §Skill Delegation Rules]         │
│                                                                      │
│  P1 — explicit `Skill:` in MECE plan section (overrides all)         │
│       `Skill: coder` → spawn coder regardless of action type         │
│                                                                      │
│  P2 — heuristics (when Skill: not declared):                         │
│       new files / features    → coder                                │
│       modify / fix existing   → editor                               │
│       file create/move/delete → also file_manager                   │
│       symbol create/rename    → also variable_manager               │
│                                                                      │
│  Multi-skill  `Skill: X + Y`:                                        │
│       run X first → verify → then Y                                  │
│       both write to cycle_N_<section_id>.json                        │
│       X fails → do NOT run Y → section blocked                      │
└──────────────────────────────────────────────────────────────────────┘
     │
     ▼
emit [cycle N] <spawn_tool> [A, B, ...] → .sessions/cycle_N_*.json
     │
     ├─── Sub-agent A ──────────────────────────────────────────────┐
     │    writes .sessions/cycle_N_A.json:                          │
     │    { "cycle": N, "section": "S1-name",                       │
     │      "status": "done|blocked",                               │
     │      "verify_result": "<output>",                            │
     │      "artifacts": ["path/to/file"],                          │
     │      "tokens_estimated": N,   ← REQUIRED ★ (I7)             │
     │      "notes": "" }                                           │
     └──────────────────────────────────────────────────────────────┘
     ├─── Sub-agent B ─── (same format) ───────────────────────────┘
     │
     ▼
After ALL Cycle N agents complete — orchestrator reads results:
┌──────────────────────────────────────────────────────────────────────┐
│  a. validate each cycle_N_*.json [agent/SKILL.md §5a]               │
│     required keys: cycle, section, status, verify_result,           │
│                    artifacts, tokens_estimated ★                     │
│     status must be "done" or "blocked"                               │
│     missing file / invalid JSON → treat as blocked                  │
│                                                                      │
│  b. any blocked → HALT all remaining Cycles → BLOCKED flow          │
│                                                                      │
│  c. aggregate results — Context Trim (apply [post-read] verdicts ★) │
│     irrelevant verdict → exclude from context_files:                 │
│     partial verdict → pass path+line range only                     │
│                                                                      │
│  d. TOKEN MERGE ★ [agent/SKILL.md §5d · INVARIANTS.md §I7]         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ sum tokens_estimated from all cycle_N_*.json                  │ │
│  │ missing tokens_estimated → add 2,000 flat (buffer)            │ │
│  │ add sum to SESSION_TOTAL (working memory)                     │ │
│  │ write updated total → .sessions/session_tokens.md             │ │
│  │ check R3 threshold immediately                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
     │
     ├─── >50k AND compact not run → compact first → emit [compact]
     ├─── >60k → TOKEN PAUSE (do not spawn Cycle N+1 until confirmed)
     └─── ≤50k → spawn Cycle N+1 with cycle_context: from results
```

---

## MECE Plan Templates

```
[mece/SKILL.md §Templates — select by task type]

┌────────────────────────────────────────────────────────────────────────────┐
│  Bug Fix  (target: editor)                                                 │
│  S1 Diagnose:      Skill: editor · R9 3-checks · blast radius             │
│  S2 Edit & Verify: Skill: editor · targeted fix · grep confirm            │
│  S3 Sync & Close:  Skill: editor · indexer · ERR-XXX · roadmap [X]        │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]   (serial — each depends on previous)  │
├────────────────────────────────────────────────────────────────────────────┤
│  New Feature  (target: coder)                                              │
│  S1 Scope & Index: Skill: agent         · scope probe · conflict check    │
│  S2 Build:         Skill: coder         · create files · verify each      │
│  S3 Sync & Close:  Skill: file_manager+variable_manager · index · roadmap │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Refactor / Rename  (target: editor)                                       │
│  S1 Diagnose:      Skill: editor           · grep index · used_in list    │
│  S2 Edit & Verify: Skill: editor           · rename all · verify 0 old    │
│  S3 Sync & Close:  Skill: variable_manager · indexer · roadmap [X]        │
│  Cycles: 1:[S1] → 2:[S2] → 3:[S3]                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Multi-skill / Complex Feature  (target: agent)                            │
│  S1 Scope & Design: Skill: agent                                           │
│       scope probe · assign skill per section · pre-assign ALL T-IDs ★    │
│  S2 Build New:      Skill: coder         · create files                   │
│  S3 Modify Existing:Skill: editor        · targeted edits                 │
│  S4 Sync & Close:   Skill: file_manager+variable_manager                  │
│  Cycles: 1:[S1] → 2:[S2,S3] parallel → 3:[S4]                            │
│  S4 context-input: cycle_2_S2.json, cycle_2_S3.json ★                    │
└────────────────────────────────────────────────────────────────────────────┘

★ Pre-assign ALL T-IDs at S1 before any spawn (INVARIANTS.md §I6)
★ S4 context-input injected by orchestrator (agent/SKILL.md §Delegation Contract)
```

---

## Completion Gate

```
[AGENTS.md §Completion Gate]

CHECKPOINT CK6 — Agent may NOT report done until ALL pass:
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  □ All mece_plan.md sections = [X]                                  │
│    grep -cE "^\- \[ \]" .sessions/mece_plan.md → 0                  │
│                                                                      │
│  □ All N sections executed via tool calls (not just described)       │
│                                                                      │
│  □ Every write/edit has [✓ written] — grep verify passed             │
│    [AGENTS.md §L4 · CLAUDE.md §R12]                                 │
│                                                                      │
│  □ R8 Index Sync done (if any file/symbol changed)                   │
│    python scripts/symbol_indexer.py                                  │
│    [CLAUDE.md §R8 · INVARIANTS.md §I3]                              │
│                                                                      │
│  □ All roadmap entries marked [X] with annotation                   │
│    [X] T-N: desc (→ ERR-XXX) · attempts: 1 · tool_calls: 6          │
│    [INVARIANTS.md §I5 · CLAUDE.md §R-Roadmap]                       │
│                                                                      │
│  □ .sessions/active_thread.md → phase: done                         │
│                                                                      │
│  □ SESSION_TOTAL written → .sessions/session_tokens.md              │
│                                                                      │
│  □ Feedback & Error Summary delivered to user                        │
│    (errors/retries listed + new CFP if pattern found)               │
│                                                                      │
│  Any unchecked → continue Phase 3 (never report done prematurely)   │
│                                                                      │
│  OmO Reviewer (apply when sections > 2 OR any [gate]/DB action):    │
│  Spawn haiku sub-agent (read-only) BEFORE reporting done:            │
│    Prompt: Verify-N list from mece_plan.md + grep commands           │
│    Output: PASS or FAIL: [section, criterion, actual_output]         │
│    On FAIL → retry section (1× max) → R13 escalate if still fails   │
│    Reviewer has no Edit/Write tools — read-only only                 │
│  → [agent/SKILL.md §Orchestration step 7]                           │
│                                                                      │
│  All checked   → Task Complete ✅                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Guard Rail Quick Reference

```
Gate                    Trigger                               Source file
─────────────────────── ───────────────────────────────────── ──────────────────────────────
[recurring]             R9 Step 0 detects prior failed attempt  CLAUDE.md §R9 Step 0
                        → read Failed Approaches → choose different approach
[failed-approach]       R12 verify fails → write Failed Approaches before R13 escalate  CLAUDE.md §R9
[index T0] ★★           T0 lookup.py oracle call              CLAUDE.md §R5, editor/SKILL.md §T0
                        → runs before any grep/Read · returns file+line+read_hint
[session-lookup] ★★     lookup.py --session result used       session_manager §2 Step 1a, coder §1
                        → found prior session → inject as bullet context
[pre-read]              before EVERY Read call                CLAUDE.md §R5
[post-read] ★           after EVERY Read result              CLAUDE.md §R5, editor/coder SKILL.md
[pre-edit]              before EVERY Edit/Write on symbol     CLAUDE.md §R5
[violation R5] ★        Read/Edit without gate trace          CLAUDE.md §R5
                        → discard result → redo with gate
[never-full-load VIOLATION] ★★  PostToolUse Read hook fires   ~/.claude/settings.json §PostToolUse
                        → protected file read in full → discard → re-run as grep+offset
[WARN wrong-plan-file] ★★  PostToolUse Write hook fires        ~/.claude/settings.json §PostToolUse
                        → plan .md written outside .sessions/mece_plan.md → move content
[MECE CONTENT GATE] ★★  PreToolUse deny (src/ edit)           ~/.claude/settings.json §PreToolUse
                        → mece_plan.md has <2 Verify-N criteria → rewrite before proceeding
[plan-stale] ★          resume + hash mismatch / src changed  AGENTS.md §Boot, session_manager §2b
[gate]                  destructive action (delete/overwrite) INVARIANTS.md §I1
[db-gate]               edit src/db/ or DrizzleSchema symbol  INVARIANTS.md §I2
[gather-stalled]        Phase 1 loop count ≥ 3               AGENTS.md §Phase 1
[✓ gather]              context_sufficient all boxes checked  AGENTS.md §Phase 1
                        → MUST write .sessions/gather_complete.md (date: YYYY-MM-DD)
[✓ MECE]                plan confirmed by user               AGENTS.md §Phase 2
[✓ written]             grep verify after every write/edit    AGENTS.md §Phase 3 L4
[blocked]               retry ≥ 2× failed                    AGENTS.md §Phase 3 L3/L4
[loop]                  step/section progress trace           AGENTS.md §Phase 3 L5
[compact]               SESSION_TOTAL > 50k                  session_manager/SKILL.md §1
[plan-stale] ★          MECE staleness on resume             session_manager/SKILL.md §2b
[resume-attempt] ★      restore attempt_count on resume      session_manager/SKILL.md §2
[cycle N]               spawn parallel sub-agents            agent/SKILL.md §Orchestration
[platform-unknown]      detected.md platform: unknown        AGENTS.md §Boot B4
[topic-switch] ✦        new message = different topic         AGENTS.md §Per-Turn C2
                        → close session first → new Phase 1
[topic-unclear] ✦       topic ambiguous — ask before routing  AGENTS.md §Per-Turn C2
[self-improve] ✦        R16 complaint detected → backfill     CLAUDE.md §R16
[cfp-tally] ✦           new CFPs found at session close       self_improve/SKILL.md §1
[cfp-skip] ✦            no new CFPs → skip CFP review         self_improve/SKILL.md §1
[cfp-analysis] ✦        pattern rank + root cause emitted     self_improve/SKILL.md §2
[cfp-deferred] ✦        user skipped proposal → save count    self_improve/SKILL.md §3
[blocked-self-edit] ✦   §4 tried to edit self_improve itself  self_improve/SKILL.md §4 Invariants
[blocked-invariant] ◆   §4 proposal conflicts with INVARIANTS  self_improve/SKILL.md §4 Step 0.5
[cfp-cooldown] ◆        §4 skipped — ran too recently          self_improve/SKILL.md §4 Step 0
[cfp-pending] ◆         proposal not answered — re-present     self_improve/SKILL.md §3
[proposal-mismatch] ◆   proposed fix doesn't catch original    self_improve/SKILL.md §3 Step 2.5
[✓ harness-updated] ✦   harness file edited + verified        self_improve/SKILL.md §4
[purge] ◈               after L4.5 — tool results dropped      AGENTS.md §Phase 3 L4.5
[cfp-archive] ◈         CFP >20 → archive oldest to cfp_archive.md  self_improve/SKILL.md §1
[resume-config] ◈       skill unchanged on resume → skipped SKILL.md re-read  session_manager §2
[mece-audit]       ●  Verify-N PASS at session close              session_manager §3 Step 0.5
[mece-audit-skip]  ●  No mece_plan sections → audit skipped       session_manager §3 Step 0.5
[mece-audit-fail]  ●  Verify-N failed at close → CFP candidate    session_manager §3 Step 0.5
[cfp-recurred]     ●  Occurrence after fix applied_date detected   session_manager §3 Step 0.6
[diagnosis]        ●  CFP: target + prior fixes + diagnosing model harness_doctor §1
[audit-finding]    ●  Gap type a/b/c/d located in harness files    harness_doctor §2
[harness-proposal] ●  Structural fix proposed — HALT for confirm   harness_doctor §3
[harness-proposal-deferred] ● User skipped — count persisted       harness_doctor §4
[harness-doctor-skip] ● No recurred entries in index_cfp_fix.json  harness_doctor §1
[harness-fix]      ●  Structural fix applied + detection verified  harness_doctor §5

★ = added in 2026-05-25 vulnerability fixes
✦ = added in 2026-05-25 self-improvement + topic-switch patches
◆ = added in 2026-05-25 vulnerability audit fixes (V-Audit + Round 2)
◈ = added in 2026-05-25 token efficiency improvements (T-078–T-082)
★★ = added in 2026-05-26 index enrichment + session lookup (session_086)
● = added in 2026-05-26 CFP fix index + harness_doctor + checkpoint gates (session_086+)
```

---

## Token Tracking Formula

```
[CLAUDE.md §R1]

SESSION_TOTAL = sum of (Input_n + Output_n) across all turns

Input_n = user_msg_chars × 0.3
        + context_overhead
        + tool_result_tokens ★

  tool_result_tokens (per result) ★:     ← tiered formula (V2 fix)
    ≤ 150 lines  → result_chars × 0.3
    151–300 lines → result_chars × 0.5   (code/JSON higher density)
    > 300 lines  → result_chars × 0.5 + 1,000 flat buffer
    floor: 200 tokens per result minimum

  context_overhead:
    Turn 1   = ~4,000
    Turn N   = 200 + (SESSION_TOTAL × 0.08)

Output_n = thai_chars × 1.7 + en_chars × 0.3

Thresholds [CLAUDE.md §R3]:
  > 60k → TOKEN PAUSE (finish step → save state → ask user)
  > 90k → HALT immediately → save → report to user

Write to file ONLY at: token pause · blocked halt · completion gate · TOKEN CHECK point (write working memory SESSION_TOTAL before reading)
★ Cycle token merge also writes after each parallel Cycle N (INVARIANTS.md §I7)
```

---

## Vulnerability Fixes Summary (2026-05-25)

| V# | Issue | Fix | Files Changed |
|---|---|---|---|
| V1 | Pre-Read/Edit gate ceremonial only | Invalid result rule: discard + redo | `CLAUDE.md §R5`, `AGENTS.md` QR |
| V2 | Token estimation drift | Tiered formula by line count + flat buffer | `CLAUDE.md §R1` |
| V3 | MECE plan stale on resume | `mece_plan_hash` + git status check | `AGENTS.md §Boot`, `session_manager §2b` |
| V4 | Cycle result no schema validation | Already in `agent/SKILL.md`; added `tokens_estimated` requirement | `agent/SKILL.md §5a` |
| V5 | Retry budget not persisted | `attempt_count` field in handoff, restored on resume | `session_manager/SKILL.md §2` |
| V6 | Parallel token accounting gap | `tokens_estimated` in result schema + step d merge | `agent/SKILL.md §5d`, `INVARIANTS.md §I7` |
| V7 | CFP-004 post-read not in SKILL.md | `[post-read]` verdict mandatory in editor + coder | `editor/SKILL.md`, `coder/SKILL.md`, `CLAUDE.md §R5` |
| V8 | Roadmap ID collision in parallel | Pre-assign IDs before spawn | `INVARIANTS.md §I6`, `AGENTS.md` Sub-agent Rules |

**MECE & Delegation Improvements (2026-05-25):**

| M# | Gap | Fix | Files Changed |
|---|---|---|---|
| M1 | Plan had no `Skill:` field per section | Added mandatory `Skill:` to plan format + all templates | `mece/SKILL.md §Plan Format` |
| M2 | No DoD verify pattern reference | Added 14-row Verify Pattern Lookup table | `mece/SKILL.md §Verify Patterns` |
| M3 | No multi-skill task template | Added Multi-skill/Complex Feature 4-section template + Cycle grouping | `mece/SKILL.md §Templates` |
| M4 | No delegation priority in agent skill | Added P1 (explicit Skill:) / P2 (heuristic) + multi-skill X+Y handling | `agent/SKILL.md §Skill Delegation` |

New failure patterns documented: `CFP-008` (MECE staleness), `CFP-009` (parallel token gap) — `CODING_FAILURE_PATTERNS.md`

---

**Self-Improvement + Topic-Switch Patches (2026-05-25):**

| P# | Gap | Fix | Files Changed |
|---|---|---|---|
| P1 | Agent skipped topic-switch detection — carried stale context into new tasks | C0-C3 Per-Turn routing: topic-switch check + session close before new task | `AGENTS.md §Per-Turn`, `CLAUDE.md §Per-Turn` |
| P2 | Topic switch criteria vague — agent misjudged follow-ups as new topics | Explicit IS/NOT/UNCERTAIN tables with app section + entity + intent type signals | `AGENTS.md §Per-Turn C2` |
| P3 | No harness-violation complaint detection | C0 COMPLAINT CHECK + R16 Self-Improvement Protocol: detect → backfill → log CFP | `CLAUDE.md §R16`, `AGENTS.md §Per-Turn C0` |
| P4 | CFP logged but never acted on — no review cycle | `self_improve` skill: auto-called at session close, ranks patterns, proposes + executes harness changes | `self_improve/SKILL.md`, `skill-manifest.json` |
| P5 | No CFP baseline at boot — self_improve couldn't calculate new entries | B1 command outputs `CFP_COUNT: N` → stored as `cfp_boot_count` in working memory | `CLAUDE.md §Boot B1`, `AGENTS.md §Boot B1` |
| P6 | Session close skipped CFP review entirely | session_manager §3 Step 0: run self_improve before 5-file close sequence | `session_manager/SKILL.md §3` |

---

**Vulnerability Audit Fixes (V-Audit 2026-05-25) ◆**

| Q# | Vulnerability | Fix | Files Changed |
|---|---|---|---|
| Q1 | V6: CFP ID race condition — parallel agents write duplicate CFP numbers | I8 CFP ID pre-assignment (same pattern as T-IDs in I6) | `INVARIANTS.md §I8` |
| Q2 | V10: cfp_boot_count lost after /compact → false "all CFPs new" | Persist `cfp_boot_count` in session_handoff.md at TOKEN PAUSE; self_improve §1 reads fallback from handoff | `session_manager/SKILL.md §2`, `self_improve/SKILL.md §1` |
| Q3 | V20: self_improve §4 could edit itself → stale loaded version | §4 Invariants: MUST NOT edit self_improve/SKILL.md → emit [blocked-self-edit] → present to user | `self_improve/SKILL.md §4 Invariants` |
| Q4 | V2: "ลืม" false-positive on feature requests | C0 qualifier: "ลืม" only triggers if object is a harness step name, not a feature/component | `CLAUDE.md §R16`, `AGENTS.md §C0` |
| Q5 | V3: C0 resolved but C2 topic-switch not re-evaluated | R16 step 6: after backfill → re-run C1-C2-C3 with original message explicitly | `CLAUDE.md §R16` |
| Q6 | V4: backfill impossible if context no longer available | R16 step 3: context insufficient → ask user for missing info before proceeding | `CLAUDE.md §R16` |
| Q7 | V11: regex `CFP-[0-9]` misses CFP-10+ in recurrence grep | Changed to `CFP-[0-9]+` in self_improve §2 Step 2 | `self_improve/SKILL.md §2` |
| Q8 | V16: repeated deferrals — pattern never fixed | Escalation after 3 deferrals + "dismiss" option; deferred_count persisted in session_handoff.md | `self_improve/SKILL.md §3` |
| Q9 | V18: §4 did not update harness_flow after fix | §4 Step 5: append Q# row to harness_flow Patch table | `self_improve/SKILL.md §4` |
| Q10 | CFP-011: skipped mece_plan.md and created implementation_plan.md directly | Extended MECE Plan Constraint description in CLAUDE.md to halt and create mece_plan.md first | `CLAUDE.md §Loop Architecture` |
| Q11 | Agent full-reads index JSONs + CLAUDE.md in Phase 1 G2 (~14k wasted tokens) | Never-Full-Load list + Full-Read whitelist added; gather_complete.md + mece_plan.md session-date hook | `CLAUDE.md §R5`, `AGENTS.md §Never-Full-Load`, `~/.claude/settings.json` |
| Q12 | No precomputed read_hint in indexes — agents grep-hunt before every Read | Enrich indexes with `line_end`, `read_hint`, `keywords` via `symbol_indexer.py`; add T0 `lookup.py` oracle before T1–T3 grep tiers | `scripts/symbol_indexer.py`, `scripts/lookup.py`, `editor/SKILL.md §T0`, `CLAUDE.md §R5` |
| Q13 | No session history searchable — agents can't find prior fix attempts for same feature/bug | `session_indexer.py` builds `index_sessions.json`; `lookup.py --session` searches it; wired into editor R9 Step 2.5, coder §1, session_manager §2 Step 1a, self_improve §2 Step 4.5 | `scripts/session_indexer.py`, `scripts/lookup.py`, `knowledge/index_sessions.json`, `editor/SKILL.md §R9`, `coder/SKILL.md §1`, `session_manager/SKILL.md §2`, `self_improve/SKILL.md §2` |
| Q14 | Three hook gaps: (a) Read tool no hook → Never-Full-Load bypassed silently; (b) mece_plan.md gate checked existence only, not content → empty/minimal plan passed; (c) no wrong-filename detection for plan files | PostToolUse Read hook (warns + injects [never-full-load VIOLATION] when protected file read); PreToolUse updated with Verify-N count gate (≥2 required); PostToolUse Write hook (warns on *plan*.md outside .sessions/mece_plan.md); CFP-001–004 archived to cfp_archive.md (active=15) | `~/.claude/settings.json §PostToolUse (Read+Write)`, `knowledge/cfp_archive.md` |


---

**Round 2 Vulnerability Fixes (2026-05-25) ◆**

| R# | Vulnerability | Fix | Files Changed |
|---|---|---|---|
| R1 | NC1: Infinite C0 loop — Q5 caused original message re-triggering C0 | `c0_resolved` flag in working memory: set after backfill, C0 checks and clears flag before re-entry | `CLAUDE.md §R16`, `AGENTS.md §C0` |
| R2 | NC2: session_handoff.md overwrite clears cfp_deferred / cfp_dismissed | session_manager §3 Step 3.5: read-merge CFP fields before Write; Step 4 schema includes all CFP fields | `session_manager/SKILL.md §3` |
| R3 | NH1: B1 CFP_COUNT storage unenforceable — no visible gate | Boot reply line 1 mandatory field `· CFP: N` — visible output enforces extraction | `CLAUDE.md §Boot`, `AGENTS.md §Boot` |
| R4 | NH2 + V13: §2 "top pattern" biased to old recurrence count, ignores session CFPs | Priority queue: P1 = current session CFPs first; P2 = historical by recurrence | `self_improve/SKILL.md §2` |
| R5 | NH3: CFP "Detection signal:" not validated — future C0 misses recurrences | R16 Step 2.5: validate keyword against C0 signal list; rewrite if absent | `CLAUDE.md §R16` |
| R6 | V15: "silence > 1 turn" incorrectly deferred pending proposals | Silence → `pending_proposal` in handoff → re-present next session; only explicit "skip" defers | `self_improve/SKILL.md §3` |
| R7 | V21: No test that proposed fix catches original violation | §3 Step 2.5 dry-run: validate proposal against original complaint; max 2 revisions; `[proposal-mismatch]` if fails | `self_improve/SKILL.md §3` |
| R8 | V23: §4 edits without checking INVARIANTS.md conflicts | §4 Step 0.5: grep INVARIANTS.md for conflict → `[blocked-invariant]` + user confirm | `self_improve/SKILL.md §4` |
| R9 | V24: §4 runs every session — harness bloat | §4 Step 0 cooldown gate: skip if ran ≤ 2 sessions ago; exception for recurrence ≥ 5 or explicit request | `self_improve/SKILL.md §4` |
| R10 | NS1: No rollback if §4 edit breaks harness | §4 Step 0.6: backup file before edit; restore on verify failure | `self_improve/SKILL.md §4` |
| R11 | NS2: No audit trail of §4 executions | §4 Step 6: append `SI-N` entry to `.sessions/self_improve_log.md` | `self_improve/SKILL.md §4` |

---

**Phase 1 Enforcement Patches (2026-05-25) ●**

| E# | Gap | Fix | Files Changed |
|---|---|---|---|
| E1 | Agent read SKILL.md at B3, treated it as Phase 1, skipped G1-G2-G3 entirely | Added ⚠️ warning after Boot Reply line 1: "Boot ending ≠ ready to work" | `AGENTS.md §Boot`, `harness_flow §Boot` |
| E2 | No mandatory "Phase 1 next" gate after C3 routing | Added ⚠️ warning after C3: "After C3 → MANDATORY Phase 1 next. No exceptions." | `AGENTS.md §Per-Turn`, `harness_flow §Per-Turn` |
| E3 | No text gate in CLAUDE.md between Boot and Phase 3 | Added `§MANDATORY BOOT GATE` + `§PHASE TRANSITION GATE` sections | `CLAUDE.md` |
| E4 | No infrastructure enforcement — agent could skip mece_plan.md | PreToolUse hook: denies `src/` Edit if `.sessions/mece_plan.md` absent | `~/.claude/settings.json` |
| E5 | No session-start reminder of critical flow | SessionStart hook: injects 5-step flow (Boot→C0-C3→Phase1→Phase2→Phase3) at start | `~/.claude/settings.json` |
| E6 | No per-turn reminder of boot requirement | UserPromptSubmit hook: injects boot reminder every turn via `additionalContext` | `~/.claude/settings.json` |
| E7 | No record of failed fix approaches — agent retried same approach on recurring errors | R9 Step 0: Recurring Fix Detection (signals + prior roadmap check) + `### Failed Approaches:` field in ERR entries + mandatory write before R13 escalate | `CLAUDE.md §R9`, `knowledge/error_index.md` |
| E8 | mece_plan.md from prior session passed PreToolUse hook — agent skipped Phase 1+2 entirely | Session-scoped hook: checks `date -r mece_plan.md` = today, not just file existence | `~/.claude/settings.json §PreToolUse` |
| E9 | Phase 1 had zero infrastructure enforcement — advisory text only | Phase 1 completion marker: `[✓ gather]` must write `.sessions/gather_complete.md`; hook checks both files for today's date | `AGENTS.md §G3`, `CLAUDE.md §PHASE TRANSITION GATE`, `~/.claude/settings.json` |
| E10 | Sub-agents spawned without harness context — no constraints on src/ edits | Harness Context in Sub-agent Prompts: execution agents MUST include `constraints:` block (roadmap check, gather/mece files, index sync, db-gate) | `AGENTS.md §Sub-agent Rules R4` |
| E11 | Agent full-read protected files during Phase 1 G2 (CLAUDE.md 438L, index_files.json 764L, CODING_FAILURE_PATTERNS.md 308L, roadmap 191L) — wasted ~14k tokens | Explicit Never-Full-Load list with Violation signal + Full-Read whitelist (only SKILL.md/small src/sessions OK) | `CLAUDE.md §R5`, `AGENTS.md §Never-Full-Load` |

---

**Token Efficiency Improvements (2026-05-25) ◈**

| T# | Issue | Fix | Files Changed |
|---|---|---|---|
| T-078 | Sub-agent prompt bloat — full context injected per agent | Delegation Contract: constraints=rule numbers, context_files=paths only ≤5, cycle_context ≤5 bullets ≤150c, prompt ≤800 tok | `agent/SKILL.md` |
| T-078 | cycle_context grew unboundedly across cycles | Spawn Context Gate: >2k chars → summarize further | `agent/SKILL.md`, `session_manager/SKILL.md` |
| T-078 | History entries stored full tool output | Hard limits: action ≤20w, result ≤30w, summary_context cap 2k | `session_manager/SKILL.md` |
| T-079 | B3 loaded all context_files at boot (~21k tokens) | B3 loads sections[] ONLY · context_files = on-demand lookup | `AGENTS.md §Boot B3` |
| T-079 | Skill re-read on every TOKEN PAUSE resume | Conditional reload: skip if skill unchanged (compare cached skill_name) | `AGENTS.md §Phase 3`, `session_manager/SKILL.md §2` |
| T-079 | mece_plan.md no size cap | Plan size caps: ≤5 steps, ≤2 verify commands, ≤120 lines total | `mece/SKILL.md` |
| T-080 | B2 always read skill-manifest.json in full (~1,300 tok) | B2 skip if `skill:` in prompt · else grep keywords only | `AGENTS.md §Boot B2`, `skill-manifest.json` |
| T-080 | index_variables.json / index_files.json read in full | Never-Full-Load rule: grep only · NEVER Read these files in full | `AGENTS.md §Index Files` |
| T-080 | skill-manifest used context_files as auto-load list | skill-manifest v2.1: renamed to on_demand_files with `when` + `how` policy per file | `skill-manifest.json` |
| T-081 | G1 identified missing context per-section incrementally | Hybrid front-loaded: G1 scans ALL sections in 1 pass · G2 batch greps · user ask = 1 message max | `AGENTS.md §Phase 1` |
| T-082 | Phase 3 tool results accumulated in context | [L4.5] PURGE step: drop raw tool results after each verify, keep verdict + artifact only | `AGENTS.md §Phase 3` |
| T-082 | Sub-agent R4 section verbose, duplicated CLAUDE.md | R4 section slimmed from 14 → 7 lines | `AGENTS.md §R4` |
| T-082 | CODING_FAILURE_PATTERNS.md grows without bound | CFP Archive Gate: CFP >20 → archive oldest to `knowledge/cfp_archive.md`, keep 15 active | `self_improve/SKILL.md §1` |

---

**CFP Tracking + Harness Doctor Patches (2026-05-26) ●**

| H# | Change | Files Changed |
|---|---|---|
| H1 | CFP fix tracking index: occurrence log, fix history, group classification | `knowledge/index_cfp_fix.json` (new) |
| H2 | R16 logging enhanced: write occurrence + model + date to index_cfp_fix.json | `CLAUDE.md §R16` |
| H3 | Session close Step 0.5 (mece_plan Verify-N audit, fast-only) + Step 0.6 (fix date-compare) | `session_manager/SKILL.md §3` |
| H4 | self_improve §2 Step 2.5: group analysis from index · Step 5: group_summary + recurred flag in emit | `self_improve/SKILL.md §2` |
| H5 | harness_doctor skill — 5 sections: Diagnosis → Audit → Proposal → Gate → Execute | `.agents/skills/harness_doctor/SKILL.md` (new) |
| H6 | skill-manifest: harness_doctor entry + keywords + auto_trigger from self_improve §2.5 | `.agents/skills/skill-manifest.json` |
| H7 | Never-Full-Load: index_cfp_fix.json (full_ok ≤30 entries · grep-only beyond 30) | `AGENTS.md §Never-Full-Load` |
| H8 | INVARIANTS.md I8: index_cfp_fix.json race condition — orchestrator-only write rule | `INVARIANTS.md §I8` |
| H9 | Checkpoint boxes CK1-CK6 at all phase transition points (mece_plan state validation) | `harness_flow_20260526.md` (this file) |

**Phase-Checklist + Token Checkpoint Patches (2026-05-26) ◆**

| W# | Change | Files Changed |
|---|---|---|
| W1 | mece_plan.md Phase-Checklist Template: Phase 0-3 blocks with Files Read tables + TOKEN CHECK commands at every phase boundary | `mece/SKILL.md §Phase-Checklist Template` · `AGENTS.md §Phase 2 M5-M6` · `CLAUDE.md §PHASE TRANSITION GATE` |
| W2 | Plan Format fields: explicit `Tool:` + `Data_Sent: Thai ___ch \| ENG: ___ch` + `Token: ___k` per section — explicit tool name increases agent compliance | `mece/SKILL.md §Plan Format` |
| W3 | Phase 0 persistence rules: [X] items stay on same-session resume · reset only when session_manager creates new mece_plan.md | `mece/SKILL.md §Phase-Checklist Template §Phase 0 persistence rules` |
| W4 | /compact mandatory at task complete: Phase 0 carry-forward (skill_name + CFP_COUNT + task) written to session_handoff.md BEFORE compact · G0 restore step reads it back after compact | `CLAUDE.md §PHASE TRANSITION GATE` |
| W5 | PostToolUse Edit hook: TOKEN CHECK after mece_plan.md Edit — warns agent if ___k fields remain unfilled before sections are marked [X] | `~/.claude/settings.json §PostToolUse` |

**MECE Constraints Block + Size Index + Structure Gate Patches (2026-05-26) ◆**

| X# | Change | Files Changed |
|---|---|---|
| X1 | MECE Constraints Block added to 9 skills: editor/coder/file_manager/variable_manager/session_manager/agent/ascii_flow/harness_doctor/self_improve | `.agents/skills/*/SKILL.md §MECE Constraints Block` |
| X2 | mece/SKILL.md Execution Protocol [S1-D]: copy MECE Constraints Block from SKILL.md into plan section Constraints: field at M5 write | `.agents/skills/mece/SKILL.md §Execution Protocol` |
| X3 | mece/SKILL.md Plan Format + 4 Templates: Constraints: field added per section — required at plan creation | `.agents/skills/mece/SKILL.md §Plan Format §Templates` |
| X4 | AGENTS.md §Phase 2 M5: Constraints: field required — missing Constraints: = incomplete plan | `AGENTS.md §Loop Architecture §Phase 2` |
| X5 | knowledge/index_files.json: size field (lines/th_chars/en_chars/~tokens) auto-populated via symbol_indexer.py update_file_sizes() | `scripts/symbol_indexer.py` · `knowledge/index_files.json` |
| X6 | file_manager/SKILL.md: Entry Format with size object + size field rules + read strategy from ~tokens + MECE Constraints Block | `.agents/skills/file_manager/SKILL.md` |
| X7 | mece/SKILL.md Execution Protocol [S1-E]: post-write structure validation — Constraints: count = section count, Phase 0 block present, Tool: count matches | `.agents/skills/mece/SKILL.md §Execution Protocol` |
| X8 | session_manager/SKILL.md Step 0.5d: structure check at session resume — validate Constraints:/Phase 0/Tool: counts | `.agents/skills/session_manager/SKILL.md §Step 0.5` |
| X9 | settings.json PostToolUse Write hook: structural validation of mece_plan.md on Write — warns for missing Constraints:/Tool:/Phase 0 | `~/.claude/settings.json §PostToolUse` |
| X10 | mece/SKILL.md Plan Format: Token: ___k fill timing note — fill AFTER section completes, not at plan creation | `.agents/skills/mece/SKILL.md §Plan Format` |

15 CFPs backfilled into index_cfp_fix.json with group classification.
harness_doctor auto-triggered by self_improve §2.5 when recurred_after_fix[] not empty.

---

**TOKEN CHECK Fix Patch (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X11 | TOKEN CHECK format: write SESSION_TOTAL from working memory to file BEFORE reading (was: cat only → always read 0). Format: `printf "SESSION_TOTAL: ___k\n" > .sessions/session_tokens.md` (fill ___k from memory) · then `cat`. Label: "(runtime · NOT at plan creation)" | `.agents/skills/mece/SKILL.md §Phase-Checklist Template §Token Check` |
| X12 | CLAUDE.md R1 write events: added "TOKEN CHECK point (write working memory SESSION_TOTAL before reading)" to the write-to-file events list | `CLAUDE.md §R1` |
| X13 | token_tracker/SKILL.md write events: added TOKEN CHECK point as 4th write event with note "do NOT rely on stale file value" | `.agents/skills/token_tracker/SKILL.md §Write Events` |
| X14 | AGENTS.md §M5: TOKEN CHECK runtime note — leave `→ ___k` as placeholder · do NOT evaluate at plan creation · fill at runtime only | `AGENTS.md §Phase 2 M5` |

Root cause: `session_tokens.md` was only written at token pause (>60k) / blocked / completion gate. Most tasks never hit 60k → file always 0 → TOKEN CHECK reads 0 → plan shows 0k throughout. Fix: write working memory value to file at each TOKEN CHECK point before reading.

**Pre-fill + ~Tok Formula Fix Patch (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X15 | mece/SKILL.md Phase-Checklist Template header: added ~Tok formula note (`EN_ch × 0.3 / 1000` · `TH_ch × 1.7 / 1000` · NOT `chars ÷ 1000`) + Pre-fill rule (leave ALL `___` as-is at plan creation, fill at runtime only) | `.agents/skills/mece/SKILL.md §Phase-Checklist Template` |
| X16 | mece/SKILL.md completion gate SESSION_TOTAL line: added note "fill ___k from working memory · do NOT hardcode 0k at plan creation" | `.agents/skills/mece/SKILL.md §Phase 3 close block` |

Root cause X15-X16: Agent was computing ~Tok as `chars ÷ 1000` (overcounting 3×) and pre-filling numeric values (0k, 0ch) at plan creation time. Both issues traced to missing explicit formula + missing "leave as placeholder" rule in the template header.

**Boot mece/SKILL.md + Resume Read + Compact Notification Patches (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X17 | AGENTS.md Boot B3: Also read `.agents/skills/mece/SKILL.md` offset=31 limit=110 → §Plan Format + §Execution Protocol (S1-A→S1-E) loaded at boot — agent knows required plan fields BEFORE Phase 1; NEVER re-read mid-session | `AGENTS.md §Boot B3` |
| X18 | AGENTS.md Boot resume read: when pending > 0, `grep -n "^\- \[ \]\|^\- \[/\]" .sessions/mece_plan.md` → find first pending item → determine resume phase (Phase 2 vs Phase 3) → Read mece_plan.md at that block (offset=N limit=40) for context | `AGENTS.md §Boot` |
| X19 | mece/SKILL.md Phase 3 close block: /compact line → after compact, agent notifies user: "compact เรียบร้อยครับ session ใหม่เริ่มได้เลย ไม่ต้องรัน /compact เอง" | `.agents/skills/mece/SKILL.md §Phase 3 close block` |
| X20 | Implement docs sync (2026-05-27): harness_flow B3 diagram + Token Tracking formula · 03_config.md B3 (2 locations) · 04_skills.md TOKEN CHECK format · 06_orchestrator.md mece_plan.md schema (full rewrite to Phase-Checklist Template format) | `Implement/03_config.md` · `Implement/04_skills.md` · `Implement/06_orchestrator.md` · `knowledge/harness_flow_20260526.md` |

**compact_state.md — Read-once-per-chat System (2026-05-27) ◆**
| Patch | Change | Files Changed |
|---|---|---|
| X21 | compact_state.md format: 3-line machine-readable file (dt/s/task/cfp · sk/sk_h/mece_h · p1/p2/p3). Written at session close BEFORE /compact (while session memory intact). B1 reads it next task — same-day dt= → [compact-restore] → B2/B3 skip framework file reads → saves ~2.9k tokens | New file: `.sessions/compact_state.md` |
| X22 | AGENTS.md B1/B2/B3 updated: B1 adds compact_state.md check; B2 adds [compact-restore] branch (parse sk=, skip manifest); B3 adds [compact-restore] branch (sha1 check sk_h/mece_h, skip SKILL.md reads if match). Full-Read whitelist: added compact_state.md. Bullet note: saves ~2.9k tokens per session restart | `AGENTS.md §Boot B1-B3 + §Never-Full-Load` |
| X23 | session_manager/SKILL.md Step 5.3: write compact_state.md before /compact (Step 5.5). mece/SKILL.md Phase 3 close + mece_plan.md template: added compact_state.md write checkbox. CLAUDE.md: Boot note + R5 Full-Read + Phase 3 close step 2 added. Implement/03_config.md: B1/B2/B3 updated (both occurrences). harness_flow: Layer 3 + Boot diagram + patch table updated | `session_manager/SKILL.md` · `mece/SKILL.md` · `.sessions/mece_plan.md` · `CLAUDE.md` · `Implement/03_config.md` · `knowledge/harness_flow_20260526.md` |
| X24 | .gitignore: added session runtime files (compact_state.md · gather_complete.md · cycle_*.json · context_compact_*.md) — prevent accidental commits. session_manager MECE Constraints Block: added Step 5.3 entry. harness_flow CK1: added compact_state.md checkbox. Implement/06 Phase 0 table + Implement/08 B1/B2/B3 checklist items updated | `.gitignore` · `session_manager/SKILL.md §MECE Constraints Block` · `harness_flow §CK1` · `Implement/06_orchestrator.md` · `Implement/08_checklist.md` |

---

**Harness Upgrade — claw-code Patterns (2026-05-27) ◇**

| Y# | Change | Files Changed |
|---|---|---|
| Y1 | `[M1.5]` extended reasoning pass added to Phase 2 between M1→M2: dependency_map[] + risk_flags[] + outcome_sketch[] in working memory (≤600 tokens · feeds Cycle grouping + Verify-N) | `AGENTS.md §Phase 2` · `harness_flow §Phase 2` |
| Y2 | OmO Role Assignment table added to Sub-agent R4: Architect(sonnet)/Executor(sonnet)/Reviewer(haiku) · Reviewer spawns at Completion Gate (read-only, PASS/FAIL output) | `AGENTS.md §Sub-agent R4` · `agent/SKILL.md §step 7` · `harness_flow §Completion Gate` |
| Y3 | `[S1-A.5]` added to mece Execution Protocol between S1-A→S1-B: mirrors M1.5 at skill level | `mece/SKILL.md §Execution Protocol` |
| Y4 | M1.5 checkbox added to Phase-Checklist Phase 2 block; Sections[] steps list updated; Cycle grouping annotated with M1.5 source; Multi-skill S1[B] references M1.5 dependency_map[] | `mece/SKILL.md §Phase-Checklist` · `§Sections[]` · `§Plan Format` · `§Multi-skill template` |
| Y5 | `lookup.py` upgraded: `source` field (index_variables/index_files/index_sessions/rag) in all 3 search functions · `RAG_BASE_URL` env var + `_rag_query()` stub · `.claw-rag/` added to .gitignore · CLAUDE.md R5 T0 updated with source + --session + RAG_BASE_URL note | `scripts/lookup.py` · `.gitignore` · `CLAUDE.md §R5` |

---

**Behavioral Contract + File Size Constraints (2026-05-28) ◈**

> Principle: Skills are behavioral contracts, not prose rules. Every skill must answer 5 questions explicitly.

| Z# | Change | Files Changed |
|---|---|---|
| Z1 | **Behavioral Contract** principle adopted from 9arm-skills: every SKILL.md must have 5 elements — Trigger (when to activate) · Refusal (when to HALT) · Workflow (ordered steps) · Output Contract (required output shape) · Routing (next-phase handoff). Prose rules without these = incomplete. | All skill SKILL.md files |
| Z2 | **Multi-surface Verifier**: Reviewer prompt in `mece/SKILL.md` expanded with `task_type` classification → selects surface (CLI / browser / data read-back / adversarial) based on task type before running Verify-N | `.agents/skills/mece/SKILL.md` |
| Z3 | **Formal Closeout Schema**: session_handoff.md Step 4 template now requires: `objective` · `outcome` · `changes[]` · `validation` · `root_cause` · `follow_ups` — explicit output contract for session close | `.agents/skills/session_manager/SKILL.md §3 Step 4` |
| Z4 | **Requirements Interviewer upgrade**: G0 gains refusal contract (`[gather-refused]` after ≥2 ignored rounds) + output contract (gather_complete.md must have 5 fields before leaving G0) | `AGENTS.md §G0`, `Implement/03_config.md §G0` |
| Z5 | **Skeptical Reviewer Phase (M4.5)**: optional pre-execution critic gate after MECE plan confirmed · spawns haiku sub-agent · verdict go/revise/reject · revise→M2 · reject→Phase 1 · skip for low-risk/single-file tasks | `AGENTS.md §Phase 2 M4.5`, new `.agents/skills/skeptical_reviewer/SKILL.md` |
| Z6 | **Skill Governance Labels**: `bucket` field added to every skill in `skill-manifest.json` (stable/draft/deprecated) · skeptical_reviewer added to manifest | `.agents/skills/skill-manifest.json` |
| Z7 | **File Role Architecture Doc**: 6-layer model (Persona/Identity/Bootstrap/Routing/Continuity/Operations) mapped to existing harness files · conflict resolution rule: higher layer wins | `knowledge/harness-file-role-map.md` (new) |
| Z8 | **Contract Gap Fixes** (6 skills): file_manager + variable_manager gained Refusal+Workflow+Routing · self_improve gained Routing · token_tracker+token_auditor+ascii_flow gained Refusal+Routing · identity declared persona-only scope | `.agents/skills/file_manager|variable_manager|self_improve|token_tracker|token_auditor|ascii_flow|identity SKILL.md` |
| Z9 | **File Size Contract**: editor + coder SKILL.md now enforce ≤200L target for any .md file created/edited · if >200L → split into SKILL.md (contract, ≤200L) + SKILL_detail.md (details) · behavioral contract never split across files | `.agents/skills/editor/SKILL.md`, `.agents/skills/coder/SKILL.md` |
| Z10 | **Checklist updated**: `Implement/08_checklist.md` gains Behavioral Contract completeness check + File Size Contract check | `Implement/08_checklist.md` |

◈ = added 2026-05-28 (9arm behavioral contract audit)

**Skills status post-Z patch:**

| Skill | All 5 contract elements | bucket |
|---|---|---|
| mece · editor · coder · session_manager · agent · harness_doctor · skeptical_reviewer | ✅ complete | stable (skeptical_reviewer: draft) |
| file_manager · variable_manager · self_improve · token_tracker · token_auditor · ascii_flow | ✅ complete (fixed Z8) | stable |
| identity | ✅ scope-declared (persona-only — no executable contract) | stable |

| Z11 | editor (281L) + self_improve (274L) exceeded 200L limit | Split each into SKILL.md (contract ≤200L) + SKILL_detail.md (procedures) | editor/SKILL.md · editor/SKILL_detail.md · self_improve/SKILL.md · self_improve/SKILL_detail.md |

**Status:** All 14 skills within File Size Contract. No pending splits.

---

**Token Formula + MECE Contract + harness_editor Patches (2026-05-29) △**

| ID | Issue / Gap Fixed | Resolution | Affected Files |
|---|---|---|---|
| Y1 | **Token formula wrong**: CHAT_TOTAL re-added system_fixed (7,300) every turn — caused 3× overcount (estimated 37k vs 137.3k actual) | Fixed: `CHAT_TOTAL_n = CHAT_TOTAL_{n-1} + hooks_per_turn + turn_tokens` · system_fixed added once at session start · hooks_per_turn = 1,300/turn · simulation accuracy: 84.5% | `CLAUDE.md §R1` · `token_tracker/SKILL.md §Core Model` |
| Y2 | **token_estimator.py**: no script existed for in-session estimation | Created `scripts/token_estimator.py` — `--test` validation · `--simulate --turns=N` · JSON output · registered in `knowledge/index_files.json` | `scripts/token_estimator.py` |
| Y3 | **MECE plan format missing behavioral contract fields**: plan format had no way to reference skill Output Contract (expected signals) or Refusal Contract (what to do on refusal) | Added `Expected_Traces:` + `Refusal_Path:` to `mece/SKILL.md` plan format block + S1-D fallback rule | `mece/SKILL.md` |
| Y4 | **MECE plan templates missing behavioral contract fields**: existing 4 templates (Bug Fix, New Feature, Refactor, Multi-skill) had no Expected_Traces/Refusal_Path fields | Added both fields to all 4 templates + added new "Harness Skill Editing" template | `mece/SKILL_detail.md` |
| Y5 | **MECE Constraints Block missing** from 5 eligible skills (editor, coder, file_manager, variable_manager, ascii_flow) | Added `## MECE Constraints Block` to all 5 skills — planners can now copy ≤5 lines into plan Constraints: field | `editor/coder/file_manager/variable_manager/ascii_flow SKILL.md` |
| Y6 | **No dedicated skill for harness file editing**: harness edits used generic editor with no mandatory MECE plan gate or doc close requirements | Created `harness_editor` skill: 103L · 5 behavioral contract elements · mandatory MECE plan gate · Step 5 mandatory close (flow + Implement docs) | `.agents/skills/harness_editor/SKILL.md` · `skill-manifest.json` · `registry.md` |

| Y7 | **Bidirectional cross-links**: harness_doctor ↔ harness_editor were isolated — neither knew the other existed | Added cross-link in each Routing section: harness_doctor §5 delegates file edits to harness_editor · harness_editor escalates structural CFP to harness_doctor via `[escalate-to-harness_doctor]` | `.agents/skills/harness_doctor/SKILL.md §Routing` · `.agents/skills/harness_editor/SKILL.md §Routing` |
| Y8 | **index_files.json severely underpopulated** — only 2 entries; 10 core harness files (CLAUDE.md, AGENTS.md, skill-manifest, registry, harness_flow, 4 knowledge indexes, harness_doctor) had no backlink tracking | Added 10 entries with type + description + top-6 backlinks[] each · removed stale `"files": {}` placeholder | `knowledge/index_files.json` |

| Y9 | **Compact handling gaps** (3 fixes): (1) B1 only reset SESSION_TOTAL — CHAT_TOTAL never reset after /compact causing threshold drift · (2) TOKEN PAUSE had no pre-compact state emit — compact summary Section 7 may miss pending tasks · (3) compact_state.md had no section+step fields — resume only knew "in_progress" not which step | (1) B1 now resets both counters on compact-restore OR fresh start · (2) session_manager TOKEN PAUSE emits `[pre-compact-state]` block before asking user · (3) compact_state.md schema extended: section=S<N> + step=<desc> · B2 parses + Boot reply shows Resume: S<N>-step | `AGENTS.md §B1/B2` · `.agents/skills/session_manager/SKILL.md §Section 2` · `CLAUDE.md §Phase 3 close` |

| Y10 | **Harness immune system gaps** (3 fixes): (1) harness_doctor/SKILL.md had no `## Workflow` heading + was 242L 🟡 — split to SKILL_detail.md · (2) self_improve/SKILL.md missing MECE Constraints Block + Routing had no harness_doctor escalation path · (3) CFP-005/006/007 had no Detection Signal (first 3 entries pre-dated the pattern) | (1) harness_doctor split 242L→64L 🟢 + SKILL_detail.md 190L + `## Workflow` added · (2) self_improve MECE Constraints Block + escalation route added · (3) Detection Signal added to all 15 CFPs (now 15/15) | `.agents/skills/harness_doctor/SKILL.md` · `.agents/skills/harness_doctor/SKILL_detail.md` · `.agents/skills/self_improve/SKILL.md` · `CODING_FAILURE_PATTERNS.md` |

| Y11 | **1D backlinks → 3-tier topic-graph** — index_files.json only had `backlinks[]` (manual, no semantic discovery, no outgoing links). No controlled vocabulary existed. Agents couldn't determine semantic impact of edits beyond direct importers. | Created `knowledge/topic_registry.json` (20 closed topics + descriptions). Extended all 13 index_files.json entries with `topics[]` + `references[]` + `related[]`. Created `scripts/backlink_analyzer.py` (pairwise topic overlap, --dry-run, --min-overlap flag) → computes 32 related links across 12/13 files. Updated harness_editor Step 4 + CLAUDE.md R8 + AGENTS.md Backlink Rule to enforce 3-tier check before any edit. | `knowledge/topic_registry.json` · `knowledge/index_files.json` · `scripts/backlink_analyzer.py` · `.agents/skills/harness_editor/SKILL.md` · `CLAUDE.md §R8` · `AGENTS.md §Backlink Rule` |

| Y12 | **Post-T-027 index gaps + behavioral contract invocation gap** — 3 new files not indexed (backlink_analyzer.py, harness_doctor/SKILL_detail.md, tool-manifest.json); harness_editor on_demand_files missing topic_registry.json; Implement/04 Step 4 lacked 3-tier sync instructions; CFP-020 gap: agents could edit harness files without invoking harness_editor skill first (no Invocation Gate existed in docs) | Added 3 entries to index_files.json (16 total) · Added topic_registry.json to skill-manifest.json on_demand_files · Added ⚡ Invocation Gate to Implement/04 harness_editor section · Updated Step 4 with topics[]+backlink_analyzer.py · Updated Implement/08 SKILL_detail note (harness_doctor) · Logged CFP-020 (behavioral contract invocation bypass) · Re-ran backlink_analyzer (32→47 related[] links) | `knowledge/index_files.json` · `.agents/skills/skill-manifest.json` · `Implement/04_skills.md` · `Implement/08_checklist.md` · `CODING_FAILURE_PATTERNS.md` |

| Y13 | **Session bootstrap + template gap** — .sessions/ fully gitignored · no template files · self_improve_log.md missing · session_compactor.py missing · identity/SKILL.md used stale .sessions/session_xxx.json schema | Removed harness ignores from .gitignore (dev repo tracks all) · Created docs/session_templates/ (8 files) · scripts/bootstrap_sessions.py · scripts/session_compactor.py · Updated identity/SKILL.md Fatal Constraint · Impl/02_setup.md Step 5 + §11 scope note | `.gitignore` · `docs/session_templates/` · `scripts/bootstrap_sessions.py` · `scripts/session_compactor.py` · `.agents/skills/identity/SKILL.md` · `Implement/02_setup.md` |

| Y14 | **Behavioral contract incomplete + REACT loop L5 silent gap** (3 fixes): (1) 7 SKILL.md files missing `## Workflow` (agent/coder/ascii_flow/self_improve/skeptical_reviewer/token_auditor/token_tracker) · ascii_flow 228L 🟡 not split · (2) harness_doctor first invocation: identified CFP-021 (mece_plan sections never marked [X] during execution) · AGENTS.md L5 DECIDE + CLAUDE.md Phase 3 close missing the update step | (1) Added `## Workflow` to 7 skills · ascii_flow split 228L→58L + SKILL_detail.md 187L · 14/15 skills 5/5 behavioral contract · (2) AGENTS.md L5: added `mark mece_plan.md [ ] → [X]` · CLAUDE.md Phase 3 step 0 added · CFP-021 logged · SI-1 written · index_cfp_fix.json first fix recorded | `.agents/skills/*/SKILL.md` · `AGENTS.md §L5` · `CLAUDE.md §Phase 3 close` · `CODING_FAILURE_PATTERNS.md` · `knowledge/index_cfp_fix.json` · `.sessions/self_improve_log.md` |

| Y15 | **REPO_MAP.md severely outdated** — 24+ entries missing across .agents/, .sessions/, knowledge/, docs/, scripts/ · no trigger existed to update REPO_MAP.md when harness files changed | Added 24 entries (114L→158L) · Added REPO_MAP.md as MANDATORY entry in harness_editor Step 5B with explicit trigger condition: "new file / dir / skill created or removed" | `REPO_MAP.md` · `.agents/skills/harness_editor/SKILL.md §Step 5B` |

| Y16 | **Session Health Check missing from Completion Gate** — "Feedback delivered" undefined · no trigger to recommend /compact after task complete | Added Session Health Check block to AGENTS.md §Completion Gate: SESSION_TOTAL thresholds <20k=✅ 20-40k=💡 40-60k=⚠️ >60k=🛑 · Added "Task complete" trigger + [session-health] Output Contract row to session_manager/SKILL.md | `AGENTS.md §Completion Gate` · `.agents/skills/session_manager/SKILL.md §Trigger + §Output Contract` |

| Y17 | **CHAT_TOTAL Boot Init Gap (CFP-022)** — B1 wrote `CHAT_TOTAL: 0` at reset; no enforcement re-initialized to system_fixed=7,300 · boot reply showed `Chat: ~0k` instead of `~7k` | B1 printf changed `CHAT_TOTAL: 0` → `CHAT_TOTAL: 7300` · AGENTS.md B1 note + CLAUDE.md B1 note updated to say "sets CHAT_TOTAL=7300 (system_fixed)" | `AGENTS.md §B1` · `CLAUDE.md §Boot` |

| Y18 | **harness_editor Step 5 Docs Close not enforced (CFP-023)** — Output Contract had flow_updated field as descriptive only · no gate blocked [harness-edit-done] when flow_updated=no · T-034/T-035/T-036 all skipped Step 5 | Added Refusal Contract gate: "Step 5 incomplete at task end → [harness-refused] before [harness-edit-done]" · Backfilled harness_flow + Implement/ for T-034/T-035/T-036 | `.agents/skills/harness_editor/SKILL.md §Refusal Contract` · `knowledge/harness_flow_20260526.md` · `Implement/03_config.md` · `Implement/04_skills.md` · `Implement/08_checklist.md` |

| Y19 | **mece_plan.md Phase 0-3 Template never enforced (T-038)** — mece_plan.md used simplified format without Phase 0-3 checklist blocks · no behavioral contract enforcement in M5 step · AGENTS.md M5 had no template reference · mece/SKILL.md S1-E only validated Phase 0 block · 3 conditional close paths (PATH A/B/C) not documented in schema | Rewrote `docs/session_templates/mece_plan_schema.md` with full Phase 0-3 blocks + Phase 3 Close Checklist + PATH A/B/C · AGENTS.md M5 now references template + "no simplified format (CFP-019)" · mece/SKILL.md S1-E validates all 4 Phase blocks (grep -c "## Phase 0-3") · Output Contract updated with template mandatory note | `docs/session_templates/mece_plan_schema.md` · `AGENTS.md §Phase 2 M5` · `.agents/skills/mece/SKILL.md §S1-E + §Output Contract` · `Implement/04_skills.md` · `Implement/08_checklist.md` |

| Y20 | **Thai user-facing close missing from harness_editor Output Contract (T-039)** — harness_editor added Thai close rule to SKILL.md + AGENTS.md but harness_editor Step 5 (Docs Close) was NOT run — harness_flow + Implement/ not updated — CFP-023 recurrence immediately after fix | Added Thai user-facing close rule to `harness_editor/SKILL.md §Output Contract`: after `[harness-edit-done]` → Thai summary mandatory ("งานเสร็จแล้วครับ ✅") · added same rule to `AGENTS.md §Completion Gate` · backfilled harness_flow Y20 + Implement/04 (this entry = Step 5 completion) | `.agents/skills/harness_editor/SKILL.md §Output Contract` · `AGENTS.md §Completion Gate` · `Implement/04_skills.md §harness_editor Output Contract` |

| Y21 | **No migration guide for users on old harness version (T-040)** — users who downloaded older harness version have mismatched tree structure, old index schemas (missing `topics[]`/`backlinks[]`), `chat_tokens.md` instead of `session_tokens.md`, and missing new skills (harness_editor · harness_doctor · session_manager) — no upgrade path documented in Implement/ | Created `Implement/09_migration.md` (298L) with 4-track upgrade procedure: M1 re-format indexes (session_tokens migration · index schema · backlink_analyzer) · M2 re-structure tree (required dirs + session files + mece_plan_schema + detected.md) · M3 update/overwrite skills+config (overwrite list · preserve list · per-skill procedure · new skills to add) · M4 verify (08_checklist) + rollback plan · Added Track C to `Implement/00_index.md` + `02_setup.md §9` · Updated `01_overview.md` intro with Track A/B/C description | `Implement/09_migration.md` · `Implement/00_index.md §Track C` · `Implement/01_overview.md` · `Implement/02_setup.md §9` |

| Y22 | **mece_plan_schema missing section-level metadata + audit signal (T-041)** — Asset Plan project's MECE plans had `Tool:` `Rollback:` `Data_Sent:` `Token:` per section + `### Files Read` tables per phase + TOKEN CHECK as runnable command + `[mece-audit]` signal + user feedback step — our harness mece_plan_schema.md had none of these, making plans harder to audit and rollback; `AGENTS.md M1.5` had no named outputs so reasoning pass produced no structured artifacts | Added `Tool:` `Rollback:` `Data_Sent:` `Token:` fields to section template · Added `### Files Read` table (3-col) to Phase 1+2 blocks · Changed TOKEN CHECK from comment to runtime `cat .sessions/session_tokens.md` command · Added `[mece-audit]` emit + "Ask user" + "Feedback delivered" to Phase 3 Close Checklist · Updated `AGENTS.md [M1.5]` with `dependency_map[]` + `risk_flags[]` named outputs · Added 6 new checklist items to `Implement/08_checklist.md` · Added M1.5 Named Outputs block to `Implement/04_skills.md §Plan Format` | `docs/session_templates/mece_plan_schema.md` · `AGENTS.md §Phase 2 M1.5` · `Implement/04_skills.md §Plan Format` · `Implement/08_checklist.md §M1.5+schema checks` |

| Y23 | **Token waste from verbose Bash output + missing optimization rules (T-042)** — git operations generated 100-200 lines of non-monotonic noise per turn (counted as input tokens); reviewer always spawned as sub-agent even for simple 3-verify tasks (~11k per spawn); no rule to compact at 30k for multi-section tasks; prompt cache TTL (5 min) undocumented — harness had no mechanism to filter output before Claude received it | Created `scripts/safe_run.py` (priority-first chunked filter: THRESHOLD=40 · CHUNK=25 · signal lines never truncated · NOISE_RE removes known-noisy patterns) · Added Reviewer inline threshold to `AGENTS.md §Completion Gate` (≤3 Verify-N + no src/ → inline) · Added compact-at-30k rule to `CLAUDE.md R3` + `AGENTS.md §Completion Gate` · Added cache TTL note (5 min) to `AGENTS.md TOKEN PAUSE` · Created `docs/token_benchmark.md` (3-scenario benchmark: 97.5% reduction on git noise · 73% on long output) · Updated `Implement/04_skills.md` Token Optimization section · Added 3 checklist items to `Implement/08_checklist.md` | `scripts/safe_run.py` · `CLAUDE.md §R3` · `AGENTS.md §Completion Gate + TOKEN PAUSE` · `Implement/04_skills.md §Token Optimization` · `Implement/08_checklist.md` · `docs/token_benchmark.md` |

| Y24 | **CHAT_TOTAL formula ignored compact_size — triangular accumulation undocumented (T-043)** — B1 always set CHAT_TOTAL=7300 regardless of compact summary size (T-041 actual: 86.2k vs harness estimate 26k — 3× undercount); formula comment didn't document triangular accumulation (every turn re-sends full history); PATH B compact_state.md had no compact_size field so B1 couldn't reconstruct baseline | B1 bash command updated: compact-restore reads `compact_size` from compact_state.md → CHAT_TOTAL = compact_size + 7300 (not hardcode 7300) · PATH B step added: compute compact_size = CHAT_TOTAL_pre × 0.30 → write to compact_state.md · CLAUDE.md R1 formula note updated: compact-restore formula + triangular undercount warning (actual ≈ CHAT_TOTAL × 1.5–2×) | `AGENTS.md §B1 + prose` · `CLAUDE.md §R1 CHAT_TOTAL formula` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y25 | **CHAT_TOTAL formula still inaccurate after T-043 — compact_size ratio 0.30 too low + system_fixed 7300 hardcoded (T-044)** — Validated against actual API: harness said 26,500 but API showed 39,700 after compact (1.49× gap); root cause: (1) compact_size ratio 0.30 vs actual 0.45 → 9.4k undercount (2) system_fixed 7,300 hardcoded vs measured 11,070 (CLAUDE.md 3k + AGENTS.md 4.5k + skills 3.5k) → 3.8k undercount (3) hooks_per_turn 1,300 over-counted vs actual 700; validated fix: compact_size at 0.45 + sys_fixed dynamic → expected error < 0.5% | Changed compact_size ratio 0.30→0.45 in `CLAUDE.md §R1` + `mece_plan_schema §PATH B` python3 command · Changed system_fixed from hardcode 7300 to dynamic `sys_fixed = (CLAUDE.md + AGENTS.md chars × 0.3) + 3500` in `AGENTS.md §B1 bash` · Changed hooks_per_turn 1,300→700 in `CLAUDE.md §R1` formula block + prose · Updated B1 prose note in `AGENTS.md` | `CLAUDE.md §R1 formula` · `AGENTS.md §B1 bash + prose` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y26 | **T-044 formula accuracy validated (T-045)** — After T-044 fixes (compact_size 0.45 + sys_fixed dynamic), actual test: harness CHAT_TOTAL=32,265 vs API=40,600 → error 20.5% (ratio 1.26×). Improvement: 1.49×→1.26×. Remaining gap = triangular accumulation (history re-sent each turn). Per-turn ratio also 1.26× — systematic undercount, not noise. | T-045 test data recorded in `docs/token_benchmark.md` · Recommendation: T-046 — add ×1.3 triangular correction factor | `docs/token_benchmark.md §T-045` |

| Y27 | **CHAT_TOTAL formula still 20.5% off after T-044 — systematic 1.26× undercount on per-turn + compact_size too low (T-046)** — T-045 measured: boot 1.26×, per-turn 1.26× (consistent → both from same chars×0.3 undercount); heavy turn (+18.7k API vs +5.1k harness) shows agentic tool-call amplification. Two-fix approach: (1) turn_tokens ×1.3 to close per-turn gap (2) compact_size 0.45→0.52 (calibrated for post-×1.3 corrected CHAT_TOTAL_pre: CHAT_TOTAL_pre × 1.3 × 0.50/1.30 ≈ × 0.52); heavy-turn drift documented but not formulaically fixed | Changed `CHAT_TOTAL += 700 + turn_tokens` → `700 + turn_tokens × 1.3` · Changed compact_size ratio 0.45→0.52 in PATH B python3 command | `CLAUDE.md §R1` · `docs/session_templates/mece_plan_schema.md §PATH B` |

| Y28 | **Token Efficiency Pack v2 — 4 new harness rules (T-059)** — no rules existed for: (1) output verbosity of routine signals ([post-read]/[✓ written] generating prose instead of 1-line verdict) (2) per-type state-retention policy in L4.5 PURGE (only "drop tool results" with no specifics) (3) tool-result compression before history reinject (>50L results re-sent full every turn = triangular bloat) (4) spike detection for abnormal turn_tokens | Added to `CLAUDE.md §R10`: Tool-Result Compression (>50L → compress to verdict+path+5L) + Output Contracts (terse signals: [post-read]/[✓ written]/[✓ gather] = 1-line max) · Added to `CLAUDE.md §R1`: Spike Detection (turn_tokens > 3× avg → [spike] emit) · Added to `AGENTS.md §L4.5`: state-retention policy table (Bash→DROP · Read irrelevant→DROP · Read relevant→KEEP ≤10L · Edit/Write→KEEP verdict only · >50L→COMPRESS) | `CLAUDE.md §R10 + §R1` · `AGENTS.md §Phase 3 L4.5` |

| Y29 | **T-060 Token System Enhancement Pack (8 sections)** — gaps: (1) no per-turn JSONL telemetry log (2) no cache hit% guardrail (3) only 1 spike alert type (4) SYSTEM_FIXED hardcoded 7300 stale (5) no tool schema serialization rule (6) no rolling summary trigger (7) no cache breakpoint hash check (8) Implement/03_config.md out of sync | Added JSONL logging rule (R1 step 4) · cache guardrail [cache-warn] <60% · 6-type spike detection table · dynamic sys_fixed formula in token_estimator.py · serialization note + session_summary JSONL in AGENTS.md · rolling summary trigger R3 · B1 prefix_hash check · Implement/03_config.md full sync | `CLAUDE.md §R1+R3` · `AGENTS.md §Boot+Completion Gate` · `scripts/token_estimator.py` · `Implement/03_config.md` |

| Y30 | **T-061 Execution Log File System** — gap: tool results >50L still injected into history as compressed text (verdict+5L), causing triangular CHAT_TOTAL accumulation across turns | Changed L4.5 PURGE: OFFLOAD >50L → write full result to `.sessions/exec_log/<uuid>.txt` → inject `[result-offloaded] path=<file> lines=<N>` only · Created `scripts/trim_exec_log.py` (prune 24h/50 files) · Added Completion Gate cleanup step · Synced Implement/03_config.md | `CLAUDE.md §R10` · `AGENTS.md §L4.5+Completion Gate` · `scripts/trim_exec_log.py` · `Implement/03_config.md` |

| Y31 | **T-062 harness_doctor CFP-024 — R16 structural fix** — gap: R16 said "log CFP" with pointer to SKILL.md, but no MANDATORY tool call requirement → agent emitted [self-improve] text without writing CFP file, recurring across sessions | R16 rewritten: MANDATORY tool call (same response) + inline CFP format + verify count after Edit · CFP-024 added to CODING_FAILURE_PATTERNS.md + index_cfp_fix.json | `CLAUDE.md §R16` · `Implement/03_config.md §R16` · `CODING_FAILURE_PATTERNS.md CFP-024` |

| Y32 | **T-064 Token Formula Accuracy Fix** — 3 gaps from knowledge/ analysis: (1) 1.3× multiplier too low vs actual 1.5–2× (2) cache invalidation cascade unmodeled (3) bucket_sys doesn't distinguish schema-drift cost | Changed `turn_tokens × 1.3` → `× 1.5` in CLAUDE.md R1 + Implement/03_config.md · Added cache invalidation note (prefix reset → +sys_fixed spike) · Added bucket_sys schema-drift note in AGENTS.md · Updated token_estimator.py: 1.5× multiplier + --schema-drift flag | `CLAUDE.md §R1` · `AGENTS.md §Phase 3` · `scripts/token_estimator.py` · `Implement/03_config.md` |

| Y33 | **T-066 Token Optimization Pack — 5 gap fixes** — gaps: (1) provider routing not enforced as harness R-rule despite knowledge/provider-routing-strategy.md existing (2) estimated_cost_usd always 0.0 — no formula (3) bucket_retrieval commented out, not tracked (4) no [schema-gate] for mid-session SKILL.md edits (5) telemetry retention only in knowledge/ not CLAUDE.md | (1) Phase routing table added to CLAUDE.md R4 + AGENTS.md Sub-agent Rules: G1/G2→MODEL_LOW, MECE/Execute→MODEL_HIGH, Reviewer→MODEL_LOW (~35% cost saving) · (2) estimated_cost_usd formula (Sonnet/Haiku price tiers) in CLAUDE.md R1 JSONL block · (3) bucket_retrieval uncommented + [ret:Nk] footer display · (4) [schema-gate] rule in AGENTS.md Phase 3 after Stable prefix rule · (5) 30-day retention + trim_exec_log --also-jsonl in CLAUDE.md R1 | `CLAUDE.md §R1+R4` · `AGENTS.md §Sub-agent Rules + Phase 3` |

| Y37 | **T-089 BC Enforcement: Logic Connector Skills** — added Behavior Contract blocks with Pre/Contract/Post/Enforce to all 6 logic connector skills that previously had 0 BCs. file_manager: BC-Index-Return (index_files.json write + [file-index] mandatory before return). variable_manager: BC-Symbol-Return (index_variables.json + symbol_indexer.py + [symbol-index] mandatory before return). coder: BC-Index-Sync-Gate (both [file-index]+[symbol-index] required before roadmap [X]). editor: BC-Error-Index-Gate (ERR-N entry before roadmap [X] on bug fix) + BC-Symbol-Change-Gate (variable_manager trigger on symbol edit). ascii_flow: BC-Invoke-Gate (caller must invoke ascii_flow on .md with box chars) + BC-Ascii-Return ([ascii-done] mandatory). skeptical_reviewer: BC-Output-Format ([go]/[revise]/[reject] mandatory verdict). harness_doctor: BC-Fix-Record ([✓ fix-recorded] + fixes[] append mandatory before [✓ harness-fix]). mece_plan_schema close checklist: knowledge_conflict_checker.py step added for harness_editor tasks. CFP-033 count→2 · CFP-034 count→2 (T-088 recurrences logged). Extended pass: session_manager BC-Self-Improve-Gate (self_improve §1-3 must emit [cfp-tally]/[cfp-skip] before Step 1 file writes). harness_doctor BC-Harness-Editor-Delegate ([delegating] emit + harness_editor [harness-edit-done] required before §5 edits — CFP-021 reinforcement). agent BC-Result-Gate (sub-agent must write cycle_N_<section_id>.json before returning to orchestrator). Total: 11 BCs added across 9 skills. | `.agents/skills/file_manager/SKILL.md` · `.agents/skills/variable_manager/SKILL.md` · `.agents/skills/coder/SKILL.md` · `.agents/skills/editor/SKILL.md` · `.agents/skills/ascii_flow/SKILL.md` · `.agents/skills/skeptical_reviewer/SKILL.md` · `.agents/skills/harness_doctor/SKILL.md` · `.agents/skills/session_manager/SKILL.md` · `.agents/skills/agent/SKILL.md` · `docs/session_templates/mece_plan_schema.md` · `knowledge/index_cfp_fix.json` · `CODING_FAILURE_PATTERNS.md` |
| Y36 | **T-088 doc_builder Skill** — new generic skill: analyzes any web app codebase → HTML manual at /doc/manual → Playwright screenshot capture script → PDF hook via pdf skill. 6-phase workflow: §1 Analyze (system map) → §2 Storyboard → §3 Screenshot Plan → §4 Playwright Script → §5 MECE Update → §6 Build HTML. CFP-028 structural fix: Footer BC `Write:` gate added (SESSION_TOTAL must be tool-call-written before footer). CFP-038 new: [fix-required] emitted but harness_doctor not triggered. | `.agents/skills/doc_builder/SKILL.md` (new) · `.agents/skills/doc_builder/SKILL_detail.md` (new) · `.agents/skills/skill-manifest.json` (doc_builder entry) · `knowledge/index_files.json` (2 entries) · `CLAUDE.md §R1 Footer BC` (Write: gate) · `CODING_FAILURE_PATTERNS.md §CFP-038` (new) |

△ = added 2026-05-29 (T-019 token formula fix · T-020 MECE contract closure · T-021 harness_editor · T-022 cross-links · T-024 index backlinks · T-025 compact improvements · T-026 immune system repair · T-027 topic-graph backlink system · T-028 post-T-027 index sync + behavioral contract clarity · T-029 session bootstrap · T-030 session_compactor + identity fix · T-031 behavioral contract Workflow · T-032 harness_doctor CFP-021 · T-033 REPO_MAP update · T-034 harness_editor Step 5B REPO_MAP trigger · T-035 session-health Completion Gate · T-036 CHAT_TOTAL boot init · T-037 CFP-023 Step 5 enforcement · T-038 mece_plan Phase 0-3 template enforcement · T-039 08_checklist BC + Thai close backfill · T-040 migration guide 09_migration.md · T-041 mece_plan_schema Asset Plan Priority 1+2 features · T-042 token optimization safe_run.py + reviewer inline + compact 30k · T-043 CHAT_TOTAL compact_size formula fix · T-044 token formula accuracy: compact_size 0.45 · sys_fixed dynamic · hooks 700 · T-045 formula accuracy test: 1.49×→1.26× · T-046 formula fix v2: turn_tokens ×1.3 + compact_size 0.52 · T-059 token efficiency pack v2: output contracts + state-retention + tool compression + spike detection)
| Y34 | **T-067 Loop Weight Tracking \& Compact Trigger** — gaps: (1) no LOOP_WEIGHT/TURN_COUNT tracking in session_tokens.md · (2) no PostToolUse hook to auto-increment LOOP_WEIGHT · (3) no [compact-warn]/[compact-required] thresholds based on tool call weight · (4) M1.5 had no proactive compact trigger for complex tasks · (5) mece_plan_schema.md had no /compact checkpoint template | (1) TURN_COUNT + LOOP_WEIGHT fields added to session_tokens.md + B1 printf (S=1/M=2/L=3) · (2) PostToolUse hook in .claude/settings.json auto-increments LOOP_WEIGHT · (3) CLAUDE.md R3 + AGENTS.md Phase 3: LOOP_WEIGHT >30→[compact-warn] >50→[compact-required] with mandatory skill/remaining/resume fields · (4) AGENTS.md M1.5 compact_checkpoint rule: sections≥3 OR sections×6>30 → insert /compact step after ceil(N/2) · (5) mece_plan_schema.md /compact checkpoint template with Pre/How/Post/Verify/Resume | `CLAUDE.md §R1+R3` · `AGENTS.md §B1+M1.5+Phase3` · `.claude/settings.json` · `docs/session_templates/mece_plan_schema.md` |
| Y35 | **T-068 CFP-026 — Conditions Written Without Behavior Contract** — gap: (1) LOOP_WEIGHT/TURN_COUNT triggers written as floating prose without Pre/Contract/Post/Enforce structure (CFP-026 pattern) · (2) C0-C3 Per-Turn Routing had no LOOP_WEIGHT gate · (3) mece_plan_schema.md LOOP_WEIGHT CHECK was shorthand only | (1) CFP-026 added to CODING_FAILURE_PATTERNS.md with Detection signal + Prevention rule · (2) [C0.5] LOOP_WEIGHT gate added to AGENTS.md Per-Turn Routing with full Pre/Contract/Post/Enforce BC · (3) mece_plan_schema.md LOOP_WEIGHT CHECK rewritten as full BC block | `AGENTS.md §Per-Turn Routing` · `docs/session_templates/mece_plan_schema.md` · `CODING_FAILURE_PATTERNS.md` |

| Y37 | **T-092 Hybrid BC Migration** — gap: 23 BCs self-enforced, frequently missed under context pressure → BC density problem. Solution: 3-tier framework (HOOK/BC/Signal Contract/Convention). (1) harness_editor/SKILL.md §BC Selection Guide added — decision tree for tier selection · hard limit ≤6 BCs per file. (2) AGENTS.md 8→4 BCs (C3-topic-switch/M5-write-before-present/Bash-filter/Schema-gate → 1-line Signal Contracts). (3) CLAUDE.md 15→6 BCs (Footer/Cache-guardrail/Index-First/Never-Full-Load/Index-Sync/Topic-Lookup/Active-Fix/Post-Edit-Verify/Escalation → Signal Contracts). Doctor Flow BC kept (critical improvement system). Total: 23→10 BCs (↓57
| Y37 | **T-092 Hybrid BC Migration** — gap: 23 BCs self-enforced, frequently missed under context pressure → BC density problem. Solution: 3-tier framework. (1) harness_editor/SKILL.md §BC Selection Guide added — decision tree (HOOK/BC/Signal Contract/Convention) + hard limit ≤6 BCs per file. (2) AGENTS.md 8→4 BCs — C3/M5-present/Bash-filter/Schema-gate → 1-line Signal Contracts. (3) CLAUDE.md 15→6 BCs — Footer/Cache/Index-First/Never-Full-Load/Index-Sync/Topic-Lookup/Active-Fix/Post-Edit/Escalation → Signal Contracts. Doctor Flow BC kept as full BC. Total: 23→10 (↓57%). | `.agents/skills/harness_editor/SKILL.md` · `AGENTS.md` · `CLAUDE.md` |
| Y38 | **T-093 Enforcement Gap Fix** — 3 gaps identified post-T-092: (A) Read tool had zero machine enforcement — PreToolUse hook only checked Edit/Write/NotebookEdit. (B) mece_plan_schema.md tick line had no gate requiring [✓ written]+Verify-N before marking [X]. (C) C0.5 oversized BC (10L Pre/Contract/Post/Enforce) when a 1-line Signal Contract sufficed. Fixes: (1) settings.json PreToolUse hook: added 'Read' to tool check + PROHIBITED list (6 files: index_variables.json, index_files.json, CODING_FAILURE_PATTERNS.md, master_roadmap.md, INVARIANTS.md, error_index.md) → sys.exit(1) with [gate] never-full-load message. (2) AGENTS.md C0.5 BC (10L) → 1-line Signal Contract → BC count 4→3. (3) mece_plan_schema.md: tick gate note added before both S1 and S<N> tick lines. | `.claude/settings.json` · `AGENTS.md` · `docs/session_templates/mece_plan_schema.md` |
| Y39 | **T-094 BC Selection Guide Expand + Manifest Trigger Fix** — (1) harness_editor/SKILL.md §BC Selection Guide condensed to decision-tree table (180L 🟢) + pointer to SKILL_detail.md. (2) SKILL_detail.md created (114L): decision tree Q1-Q4 · per-tier use/not-use · 14 real-system examples · anti-patterns table · trigger keywords. (3) skill-manifest.json harness_editor keywords 8→22 · trigger updated to include enforcement-rule selection tasks. | `.agents/skills/harness_editor/SKILL.md` · `.agents/skills/harness_editor/SKILL_detail.md` (new) · `.agents/skills/skill-manifest.json` · `knowledge/index_files.json` |
| Y40 | **T-095 Manifest Tool Routing** — 3 gaps: (1) skill-manifest.json had no tool guidance per skill — agent couldn't auto-select tools at M2. (2) mece_plan_schema.md had no Avoid: field or M2 manifest lookup instruction. (3) AGENTS.md M2 had no Signal Contract for manifest grep. Fixes: (1) skill-manifest.json: added `activates_at[]` + `tools{primary,avoid}` to all 17 skills via python3 json.load/dump. (2) mece_plan_schema.md: M2 step expanded with grep command for manifest lookup · `Avoid:` field added to both S1 and S<N> section templates. (3) AGENTS.md: 1-line Signal Contract at M2 — `grep activates_at + tools from manifest (grep only — never Read full manifest) → fill Tool:/Avoid: per section · skip = manifest-routing-miss`. Key constraint: manifest always grep-only at B2/M2 — never Read full 557L file. | `.agents/skills/skill-manifest.json` · `docs/session_templates/mece_plan_schema.md` · `AGENTS.md` |
| Y41 | **T-096 harness_doctor BC Upgrade + BLOCK Gate** — gap: harness_doctor trigger was 1-line bullet ("any recurred_after_fix[] not empty → trigger") — ignored 4× in CFP-037 history. CFP-038 also lacked BLOCK enforcement. Fixes: (1) mece_plan_schema.md §Close Checklist: harness_doctor item → full BC (Pre/Contract/Post/Enforce) — Pre checks [fix-required]/[fix-escalated] OR recurred_after_fix[] → Contract: emit [doctor-invoked] + HALT all close steps until [doctor-verdict] received. (2) CFP-038 Prevention: "MUST emit [doctor-invoked] + BLOCK — no exceptions · 'ไม่ต้องหมอ' = violation". | `docs/session_templates/mece_plan_schema.md` · `CODING_FAILURE_PATTERNS.md §CFP-038` |
| Y42 | **T-097+T-098 Close Gate Hook + Phase 3 Pause BC** — gap: AI could write `phase: done` in active_thread.md without reading §Close Checklist from schema (CFP-037 root cause: no seam forces schema read). Also: Phase 3 execution completing immediately jumped to Close Checklist without pause for user confirmation. Fixes: (1) `.claude/settings.json` PreToolUse hook: close-gate block — Edit active_thread.md with "phase: done" in new_string blocked until `.sessions/.close_checklist_ack` exists. (2) `docs/session_templates/mece_plan_schema.md`: BC-exec-pause block inserted before §Close Checklist — Pre: all S[N] [X] · Contract: STOP → emit [exec-complete] → WAIT user close command → Read schema §Close Checklist → touch .close_checklist_ack → then run checklist items. Both gates enforce the same invariant: schema MUST be read before close, and user MUST confirm. | `.claude/settings.json` · `docs/session_templates/mece_plan_schema.md` |
| Y43 | **T-099+T-100 CFP-039 + kcc bug fix** — T-099: added CFP-039 "Close Checklist Run Without Output Display" — symptom: AI runs checklist silently without per-item table; Prevention: MUST emit table after every Close Checklist. Added to index_cfp_fix.json + cfp_topics.md session-close topic (keywords + cfp_ids updated). T-100: fixed scripts/knowledge_conflict_checker.py L183 AttributeError — `entry_b.get()` called on list value in index; fix: added `isinstance(entry_b, dict)` guard before .get() call. | `CODING_FAILURE_PATTERNS.md §CFP-039` · `knowledge/index_cfp_fix.json` · `knowledge/cfp_topics.md` · `scripts/knowledge_conflict_checker.py` |
| Y44 | **T-101 BC-mece-compact — Force /compact Before Phase 3** — gap: after [✓ MECE] + user confirm, Phase 3 started immediately in same context → LOOP_WEIGHT accumulated from Phase 1+2 carried into Phase 3. Fix: (1) AGENTS.md: BC-mece-compact added after BC-M5-verify — Pre: [✓ MECE] just emitted · Contract: emit [mece-complete] + prompt "/compact แล้ว reply ลุย" + HALT Phase 3 until compact-restore confirmed · Enforce: Phase 3 Edit/Write without [mece-complete] = violation. (2) mece_plan_schema.md: compact note added after Phase 2 TOKEN CHECK as reminder. Key design: user can skip /compact by saying "ลุย" directly → [compact-skipped] emitted (not a violation — user choice). | `AGENTS.md` · `docs/session_templates/mece_plan_schema.md` |
| Y46 | **T-105–107 9arm Framework Upgrades + Over-Prescription Fixes** — T-105: harness_editor/SKILL.md upgraded to full 9arm 8-component standard: Operating Stance (infrastructure mindset + minimal diff + discipline over enforcement + audit before adding), When NOT to Use (4 cases), Signal Contracts replacing BCs, Output Contract labels, Tone Guide, Hard Rules, YAML keywords. T-106: mece/SKILL.md upgraded: Operating Stance (planner not executor + irreversibility first + atomic steps + breadth over cleverness), Prerequisites (4 checklist items), Hard Rules (7 items + quality heuristic), Tone Guide, YAML trigger keywords. Over-prescription audit applied: BC-Validation Gate 6 greps → principle-based assessment (S1-E), S2-A word list → judgment-based approval, skill_auditor Scan C added (prescription detection). T-107: 3 over-prescription fixes in core harness files: (1) AGENTS.md BC-M5-verify 4 grep commands → principle-based structural assessment. (2) AGENTS.md C2 freshness specific grep → intent-based "check for pending sections". (3) CLAUDE.md R16 Doctor Flow "score ≥ 2" / "min 2 terms" → conceptual fit judgment. Plus mece/SKILL.md S2-A Signal Contract: write mece_plan.md before presenting plan to user. | `.agents/skills/harness_editor/SKILL.md` · `.agents/skills/mece/SKILL.md` · `.agents/skills/skill_auditor/SKILL.md` · `AGENTS.md` · `CLAUDE.md` |
| Y53 | **T-115 harness_doctor + self_improve 9arm Upgrade** — gap: both skills missing Operating Stance (no mindset anchor for when to stop diagnosing / what "minimal" means). harness_doctor §1–§2 had no attempt cap (dead loop risk — iterative diagnosis with no exit). harness_doctor had no Hard Rules section and no Tone Guide. self_improve `## Invariants` section covered hard rules functionally but name didn't match 9arm naming → skill_auditor scan miss. Both skills missing YAML front-matter → manifest keyword discovery suboptimal. Design decision: all additions judgment-based (agent decides based on reason, not mandatory gates). Fixes: (1) harness_doctor Operating Stance: 4 bullets — structural surgeon · diagnosis bounded (attempt cap=3) · minimal fix only · recurrence threshold is trigger not fix. (2) harness_doctor Hard Rules: dead loop escape [doctor-loop] attempt:3 HALT · Resume Gate · delegate-all-edits-to-harness_editor · recurred_after_fix thresholds. (3) harness_doctor Tone Guide: Keep/Strip/Format/Prohibited. (4) self_improve Operating Stance: 4 bullets — pattern observer first · one change per session · cooldown rationale · circular dependency hard stop. (5) self_improve `## Invariants` → `## Hard Rules` (rename, §4 Invariants section untouched) + deferred escalation rule: deferred ≥3 on same CFP-N → escalate to harness_doctor. (6) YAML headers prepended to both SKILL.md files. (7) skill-manifest.json keywords[] synced for harness_doctor (+fix-escalated, +recurred_after_fix). Net: both skills now have full 9arm 8-component coverage. Dead loop risk eliminated via bounded attempt cap. | `.agents/skills/harness_doctor/SKILL.md` · `.agents/skills/self_improve/SKILL.md` · `.agents/skills/skill-manifest.json` |
| Y52 | **T-114 Editor Lightweight Fix Path + error_index Schema Extension** — gap: editor mandated full ceremony (roadmap T-ID + symbol_indexer + error_index) for every fix regardless of scope, violating 9arm L108 "Trivial fix → don't manufacture ceremony." error_index had no severity field or decision logic — one-size-fits-all. Design decision: 2-tier workflow (judgment-based, not a gate) — agent assesses 4 criteria at Operating Stance and decides path. Criteria: <3L change · no new symbol · single file · no runtime behavior change. Heavy path remains default; lightweight is the exception. Fixes: (1) editor Operating Stance bullet #5: "Match ceremony to scope" — 4 criteria + lightweight path defined. (2) editor Trigger: lightweight-fix case added. (3) editor Workflow Section 3: "Lightweight Close" sub-section — skip roadmap T-ID · skip symbol_indexer · skip error_index · inline comment `# lightweight fix: <what> · <date>` is the record. (4) error_index.md: severity field (critical/moderate/trivial) · Decision Table (5 rows, judgment-based) · Lightweight Annotation Format · ERR-007 tagged severity:critical. Net: editor now has full 9arm 8-component coverage + ceremony-proportional workflow. error_index now supports graded response matching fix severity. | `.agents/skills/editor/SKILL.md` · `knowledge/error_index.md` |
| Y51 | **T-113 coder + editor + skill_auditor 9arm Upgrade** — gap: all three skills had partial 9arm coverage. editor missing Operating Stance / When NOT to Use / Tone Guide / cross-skill routing / dead loop escape. coder missing "never invent root cause" Hard Rule and judgment-based editor handoff on linter loop. skill_auditor missing Failure Mode Map (understood *presence* of patterns but not *why* each prevents a specific failure class). Design decision: Operating Stance over Hard Rules for failure modes — agent understands reason → judges edge cases vs mechanical checklist. skill_auditor SKILL_detail.md split (258L→186L 🔴→🟢). Cross-skill routing added bidirectionally: coder→editor (linter ≥3 on existing code), editor→coder (new file / architectural scope). | `.agents/skills/editor/SKILL.md` · `.agents/skills/coder/SKILL.md` · `.agents/skills/skill_auditor/SKILL.md` · `.agents/skills/skill_auditor/SKILL_detail.md` |
| Y50 | **T-112 harness_editor ↔ skill_auditor Wiring** — gap: harness_editor had no guidance on when to call skill_auditor before editing a SKILL.md — risk of embedding gaps the edit cannot see (harness_editor reads only the file; skill_auditor reads 9arm framework + manifest + cross-skill links). Design decision: wiring not merge — single-responsibility preserved, judgment-based not a gate. Fixes: (1) Step 1 (Scope Probe): added conditional wiring — if target = SKILL.md, consider loading skill_auditor first; Why/How/Judgment-call all spelled out. (2) Hard Rules: added rule — structural edits (new BC / new section / rewrite ≥10L) → audit first; minor fixes (<3L) → skip is acceptable. Core principle: judgment-based wiring (agent understands the reason, decides when to wire) not mechanical enforcement. | `.agents/skills/harness_editor/SKILL.md` |
| Y49 | **T-110 Skill Manifest Discovery & Match Signal** — audit found 2 gaps: (1) B2 grep used `head -80` covering only skills #1–10/17 — skills #11–17 (agent, harness_doctor, harness_editor, skeptical_reviewer, repo_researcher, doc_builder, project_presenter) were invisible at boot. (2) skill_auditor entry existed at manifest top-level instead of inside `skills{}` block — also invisible to B2 grep. (3) B2 had no match/miss signal — agent could silently proceed with wrong skill or no skill. Fixes: (1) AGENTS.md B2: `head -80` → `head -160` (161 lines covers all 18 skills). (2) B2: added intent assessment contract — [skill-match] on keyword overlap, [skill-miss] forcing function (agent MUST name default + reason, cannot silently proceed). (3) skill-manifest.json: moved skill_auditor from top-level → inside `skills{}` block. Net: 18/18 skills now discoverable via B2 grep + agent must emit decision signal before proceeding. | `AGENTS.md` · `.agents/skills/skill-manifest.json` |
| Y48 | **T-109 mece Close/Handoff Flow Fixes: BC-exec-pause + Close Checklist + Hard Rule 8** — audit identified 3 gaps in mece close flow: (1) BC-exec-pause used keyword matching ("ปิดงาน"/"close"/"จบงาน") — never matched natural user replies in practice. (2) Close Checklist had no pointer to PATH A — agent had to navigate separately to find it. (3) mece/SKILL.md Hard Rules had no post-exec routing guidance. Fixes: (1) mece_plan_schema.md BC-exec-pause Contract: keyword list → intent-assessment with 3 branches (new task/topic → C3 topic-switch · acknowledge/idle → Close Checklist · ambiguous → ask once "มีงานต่อไหมครับ?" · wait 1 turn). (2) Close Checklist: added PATH A pointer item after [session-health] with CFP-025 reminder. (3) mece/SKILL.md: added Hard Rule 8 — post-exec intent check, new task/topic = C3 first, never keyword-match to decide. Core principle: judgment-based over mechanical keyword enforcement. | `docs/session_templates/mece_plan_schema.md` · `.agents/skills/mece/SKILL.md` |
| Y47 | **T-108 Index System Fixes: variable_manager + AGENTS.md** — audit revealed 2 gaps: (1) variable_manager trigger "any symbol" caused agents to skip it for single-file helpers — no real value, just overhead. (2) AGENTS.md Index Sync Invariant row "Symbol created/renamed/deleted" had no judgment criteria — same over-prescription pattern. Fixes: (1) variable_manager/SKILL.md L16 trigger: "any symbol" → "symbol with cross-file dependency"; added schema fields `signature` + `last_modified` to create step; Trigger Conditions clarified with explicit skip conditions for internal-only symbols. (2) AGENTS.md L222 row updated: "Symbol with cross-file dependency: created/renamed/deleted" + skip note. Net: variable_manager is now called only when index has real value (cross-file lookup, rename safety, used_in graph). | `.agents/skills/variable_manager/SKILL.md` · `AGENTS.md` |
| Y55 | **T-120 doc_builder/SKILL.md 9arm Behavioral Gap Fix** — skill_auditor audit found 4 behavioral gaps + 3 framework gaps + 3 structure issues. Behavioral gaps (❌ absent): Operating Stance (no mindset anchor — understand-before-building, storyboard-first, role-driven, minimal scope), Prerequisites (Refusal Contract had input gates but wrong format — no checklist, no Why/Missing), Output Tone (no keep/strip/prohibited phrases), Hard Rules (MECE Constraints Block ≠ Hard Rules — planner copy-paste, not runtime imperatives). Framework gaps (⚠️): YAML header entirely missing (B2 manifest routing broken), When NOT to Use had input clarifications not redirects, Workflow had no stop condition. Structure issues: Refusal Contract = input gates (moved to Prerequisites), confirmation gates scattered across §1/§2/MECE Block, §2 Rules over-prescribed. Fixes (121L 🟢): (1) YAML front-matter with name + description + 10 trigger keywords. (2) `## Refusal Contract` replaced with `## Prerequisites` (3-item checklist + Why/Missing) + `## When NOT to Use` (4 cases with redirects to repo_researcher/editor/project_presenter). (3) `## Operating Stance` — 4 mindset bullets. (4) `## Output Tone` — Keep/Strip/Format/Prohibited (3 phrases). (5) `## Hard Rules` — 8 imperative items + quality heuristic (>15 roles = group into families). doc_builder now has full 9arm 8-component coverage. | `.agents/skills/doc_builder/SKILL.md` |
| Y54 | **T-119 ascii_flow/SKILL.md 9arm Behavioral Gap Fix** — skill_auditor audit found 4 behavioral gaps + 3 framework gaps in ascii_flow. Behavioral gaps (❌ absent): Operating Stance (no mindset anchor — char-strict discipline, diagram-only scope, minimal-node rule, reference-before-inventing), Prerequisites (no checklist with "refuse without these" — target file path + invoke pattern + diagram intent all required), Output Tone (no keep/strip/prohibited phrases), Hard Rules (no imperative rules + no quality heuristic). Framework gaps (⚠️): YAML description had no trigger keywords, Refusal Contract had no redirects, Workflow had no stop condition. Fixes (114L 🟢): (1) `## Operating Stance` — 4 mindset bullets. (2) `## Prerequisites` — 3-item checklist with Why/Missing per item. (3) Workflow stop condition — palette-missing guard. (4) Refusal Contract — redirects added per skip condition. (5) YAML description — 4 Thai + English trigger keywords. (6) `## Output Tone` — Keep/Strip/Format/Prohibited. (7) `## Hard Rules` — 8 imperative items + quality heuristic (>20 nodes = split). ascii_flow now has full 9arm 8-component coverage. | `.agents/skills/ascii_flow/SKILL.md` |
| Y45 | **T-102-A skill_auditor — New Skill Created** — gap: no skill existed to audit SKILL.md files against the 9arm framework. After deep research session on thananon/9arm-skills (2026-06-04), identified 5 missing components across all 18 Harness skills: Operating Stance, Tone Guide, Proactive Offer, Input Sourcing, Quality Heuristic. Created `.agents/skills/skill_auditor/SKILL.md` (197L) implementing full 9arm framework: 8 components, 6 connection types, adversarial Operating Stance, BC over-enforcement detection ([over-enforcement] flag when BC count >2 with no irreversible action), Suggested Additions must be real text not descriptions. Framework reference: `knowledge/9arm-skills-skill-building-framework-2026-06-04.md`. Manifest + index_files.json updated. | `.agents/skills/skill_auditor/SKILL.md` · `.agents/skills/skill-manifest.json` · `knowledge/index_files.json` |
| Y56 | **T-121 session_manager §3 — Close Checklist Pre-Check Gate** — root cause: CFP-037 "Premature Close" recurrence count reached 5. Analysis revealed two structural gaps: (1) session_manager §3 had no pre-check for mece_plan Close Checklist status before Step 0 — §3 Step 0 (CFP review) could run even when Phase 3 Close Checklist items were still [ ]. (2) Bash printf in §3 bypasses PreToolUse hook (hook only fires on Edit/Write tools, not Bash). Fix: added `Close Checklist Pre-Check` Signal Contract to session_manager §3 Workflow before Step 0 — agent must grep mece_plan.md for "status: task-complete" before proceeding; absent = run Close Checklist + PATH A first. File size: 133L → 147L 🟢. | `.agents/skills/session_manager/SKILL.md` |
| Y57 | **T-122 harness_doctor Hard Rules — fix_plan Mandate at count≥5** — root cause: harness_doctor Hard Rules permissive on [clean] verdict — no constraint blocked [clean] at count≥5, and "behavioral, not structural" verdict had no count ceiling. Analysis: (1) count≥5 diagnosis should require fix_plan write before any verdict — but Hard Rules only said "priority=HIGH, no deferral" (advisory, not blocking). (2) "behavioral" label valid only at count≤2; count≥3 is systemic by definition — structural seam must be identified even if small. Fix: added 2 Hard Rules after L140: (1) count≥5 → [clean] requires approved_proposal in index_cfp_fix.json first — absent = HALT + write proposal + await confirm. (2) "behavioral, not structural" only valid count≤2 — count≥3 = must run §2 Harness Audit + identify structural seam before verdict. File size: 156L → 158L 🟢. | `.agents/skills/harness_doctor/SKILL.md` |
| Y58 | **T-123 self_improve/SKILL.md 9arm gap fix** — skill_auditor audit found 3 gaps: (1) ❌ Prerequisites absent — no checklist gating before skill starts. (2) ⚠️ §2 Step 2 over-prescription — `grep -cE "recurrence of CFP-[0-9]+"` hardcoded pattern prevented flexible recurrence counting. (3) ⚠️ Operating Stance "Cooldown" principle mentioned in heading but dup analysis found no procedural duplicate — only BC block in §4. Fixes (174L→182L 🟢): (1) Added `## Prerequisites` block with 3-item checklist + Why/Missing (CODING_FAILURE_PATTERNS readable · session_handoff loaded · cfp_boot_count in memory). (2) §2 Step 2 grep-cE replaced with "count recurrences per CFP-N using any method that correctly identifies repeat patterns → frequency table". | `.agents/skills/self_improve/SKILL.md` |
| Y59 | **T-124 harness_doctor/SKILL.md 9arm gap fix** — skill_auditor audit found 3 gaps: (1) ❌ Prerequisites absent — no checklist before diagnosis starts. (2) ⚠️ ## Trigger section (L20-35) duplicates YAML header triggers + embedded Threshold BC belongs in Workflow. (3) ⚠️ Operating Stance "Attempt 3" detail scattered (already in Hard Rules). Additionally: S5 EXPANDED — added Prior-Fix Check BC to §1 Workflow (prior-fix logic: fixes[] not empty → [prior-fix-found] + §3 must emit [approach-diff] before [harness-proposal]). Fixes (166L→162L 🟢 net -4L): (1) Added `## Prerequisites` block (3 items: index_cfp_fix readable · SKILL_detail accessible · CFP target identified with Why/Missing). (2) Removed ## Trigger block entirely — YAML header is canonical source. (3) Trimmed Operating Stance L16 to pointer. (4) Added `Prior-Fix Check BC` after Resume Gate — [prior-fix-found] emit + [approach-diff] required when fixes[]≠[]. | `.agents/skills/harness_doctor/SKILL.md` |
| Y60 | **T-125 harness_editor/SKILL.md 9arm gap fix + T-126 CFP recurrence schema** — T-125: skill_auditor audit found Prerequisites Why already present in all 4 items (no change needed); "File Size Contract dup L142" was a misread — L142 is [scope-probe] signal (different); Hard Rules L226 genuinely duplicated Step 2 MECE gate enforcement → removed. MECE rule scatter: Hard Rules had 1 redundant copy of mece_plan requirement. Fix: removed L226 (1 line). 237L→236L 🟡. T-126: CFP recurrence schema — index_cfp_fix.json CFP-037 updated: status:fixed · approved_proposal set · fixes[{date:2026-06-05, task:T-121+T-122, approach:structural gate + Hard Rule blocking}] written. Additionally harness_doctor §1 expanded with Prior-Fix Check BC (prior-fix-found emit + approach-diff required) — T-124 carried this. | `.agents/skills/harness_editor/SKILL.md` · `knowledge/index_cfp_fix.json` |
| Y61 | **T-127 file_manager/SKILL.md 9arm gap fix** — skill_auditor audit found 2❌ + 6⚠️ + 3 structure issues. Fixes (66L→100L 🟢): (1) ❌ Added `## Operating Stance` (4 bullets: index-only/never business logic · atomic update or skip · caller drives scope · silent drift is the failure mode). (2) ❌ Added `## Prerequisites` (3 items with Why/Missing: index_files.json readable · changed file path provided · caller identity known). (3) YAML header: added `triggers:` (7 keywords) + `activates_at:` fields. (4) Added `## Tone Guide` + `## Hard Rules` (5 rules: no-overwrite-without-read · verify-before-emit · read-backlinks-first · skip-mandatory · no-discovery). (5) Added `## When NOT to Use` (4 redirects: variable_manager · session_manager · agent for bulk · kcc for conflicts). (6) Structure A: removed dup emit line from Output Contract (BC canonical). (7) Structure C: softened hardcoded grep commands → "verify entry exists (any method)". | `.agents/skills/file_manager/SKILL.md` |
| Y62 | **T-128 skill redundancy boundary clarification** — redundancy audit found 🔴 file_manager↔variable_manager (near-identical lifecycle — clarified by T-127.4 When NOT to Use redirect) + 🟡 token_tracker/auditor (same file, different purpose) + 🟡 editor/coder keyword overlap (restructure/rename all). Decision: Clarify (not merge) for all 3. Fixes across 4 SKILL.md files: (1) token_tracker Hard Rules — added "Do NOT audit/diagnose" boundary note → token_auditor for anomalies. (2) token_auditor Routing — added "Do NOT track per-turn counts" boundary note → token_tracker for tracking. (3) editor When NOT to Use — added "Bulk restructure ≥3 files → agent/coder; Do NOT use editor for restructuring". (4) coder When NOT to Use — added "Rename all / global symbol rename → editor+variable_manager; Do NOT use coder for renaming". Net: 4 files +1L each. | `.agents/skills/token_tracker/SKILL.md` · `.agents/skills/token_auditor/SKILL.md` · `.agents/skills/editor/SKILL.md` · `.agents/skills/coder/SKILL.md` |
| Y64 | **T-131 variable_manager/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Prerequisites (Why/Missing), Tone Guide, Hard Rules (6 rules), merged Trigger Conditions duplicate. 75L → 124L · 🟢 zone · 11 sections present | `.agents/skills/variable_manager/SKILL.md` |
| Y65 | **T-132 skeptical_reviewer/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Prerequisites (Why/Missing), Workflow stop conditions, Tone Guide, Hard Rules (6 rules), merged Context Gate. 111L → 160L · 🟢 zone | `.agents/skills/skeptical_reviewer/SKILL.md` |
| Y66 | **T-130 agent/SKILL.md 9arm gap fix** — Added: YAML triggers, When NOT to Use, Operating Stance (4 bullets), Tone Guide, Hard Rules (6). size_guard: passed at 250L exactly · 🟡 zone | `.agents/skills/agent/SKILL.md` |
| Y67 | **T-133 mece/SKILL.md Cycle fan-out syntax support** — Added: Cycle block syntax template (S1-A.5), Hard Rule 7 multi-Cycle exception, On-Demand Cycle trigger row, Refusal Contract Cycle redirects. 176L → 191L · 🟢 zone | `.agents/skills/mece/SKILL.md` |
| Y68 | 2026-06-05 | T-134 | session_manager/SKILL.md | Added triggers/When NOT/Op Stance/Prerequisites/Hard Rules/Tone Guide (6 edits) | 147→185L | 🟢 |
| Y69 | 2026-06-05 | T-135 | token_tracker/SKILL.md | Added triggers/When NOT/Prerequisites/Op Stance/Tone Guide (5 edits, Hard Rules existed) | 124→161L | 🟢 |
| Y70 | 2026-06-05 | T-136 | token_auditor/SKILL.md | Added triggers/When NOT/Op Stance/Prerequisites/Hard Rules/Tone Guide (6 edits) | 90→134L | 🟢 |
| Y71 | 2026-06-05 | T-137 | AGENTS.md + session_manager/SKILL.md | LOOP_WEIGHT gate fix: hook-value-only + preserve-on-close (4 edits) | — | 🟢 |
| Y63 | **T-129 CFP-037 structural fix — harness_editor BC-docs-close Close Checklist gate** — root cause: CFP-037 count=6 (premature close). Prior fix (T-121) added gate to session_manager §3 (caller-side) but harness_editor BC-docs-close had no [E] item checking Phase 3 Close Checklist — executor-side gap meant [harness-edit-done] could be emitted with [ ] checklist items remaining. [approach-diff]: prior=caller-side gate in session_manager · new=executor-side [E] item in harness_editor BC-docs-close. Fix: added [E] to Contract "Phase 3 Close Checklist verified — all [X] before [harness-edit-done]" + Enforce line "Close Checklist [ ] remaining = [violation] BC-docs-close-checklist". 236L→239L 🟡. index_cfp_fix.json CFP-037 fixes[1] appended. | `.agents/skills/harness_editor/SKILL.md` · `knowledge/index_cfp_fix.json` |
## Y72 · T-138 · repo_researcher/SKILL.md 9arm fix · 93→131L 🟢
## Y73 · T-139 · project_presenter/SKILL.md 9arm fix · 151→193L 🟢
## Y74 · T-140 · identity/SKILL.md 9arm fix · 74→115L 🟢
## Y75 · T-141 · ascii_flow/SKILL.md 9arm fix · 115→143L 🟢
## Y76 · T-142 · doc_builder/SKILL.md 9arm fix · 122→175L 🟢
## Y77 · T-143 · self_improve/SKILL.md 9arm fix · 183→194L 🟢
## Y78 · T-144 · identity/SKILL.md 9arm fix · 116→119L 🟢
## Y79 · T-145 · editor/SKILL.md 9arm fix · 226→237L 🟢
## Y80 · T-146 · coder/SKILL.md 9arm fix · 156→164L 🟢
## Y81 · T-147 · mece/SKILL.md 9arm fix · 192→192L 🟢
## Y82 · T-148 · repo_researcher/SKILL.md 9arm fix · 132→137L 🟢

## Y83 · T-149 · CFP decay system · cfp_decay.py + index_cfp_fix.json migration + self_improve/session_manager SKILL.md updated · window_count 90-day threshold 🟢

## Y84 · T-150 · session index schema upgrade · session_indexer.py upgraded (skill/topic/actions/friction/promoted fields) + session_analyzer.py created + promotions.md seeded · knowledge/index_sessions.json rebuilt 🟢

## Y85 · T-151 · Reflection Step + Promotion Loop — added reflection step to mece_plan_schema.md Close Checklist · session_manager SKILL.md Step 0 + reflections.md created · promotions.md filter guide (deterministic→tool / contextual→skill rule) 🟢

## Y86 · T-152 · verify_runner.py created (149L) — parses Verify-N from mece_plan.md · runs bash commands · PASS/FAIL report · AGENTS.md [L4] updated with optional automation call

## Y87
**T-153 · session_close.py — 5-File Close Automation Tool**
- `scripts/session_close.py` created (184L) — argparse · 5-file writer · --dry-run · --task · --next · --chat-total
- `session_manager/SKILL.md` §3 Steps 1-5 → `python3 scripts/session_close.py` (189L 🟢)
- `.agents/tools/tool-manifest.json` — `session_close` entry added
- 9arm audit: PASS (all 8 components)
- Verify: `--help` exit 0 · `--dry-run` lists 5 paths · SKILL.md L114 reference confirmed

## Y88
**T-154 · Code Audit — session_close.py + verify_runner.py (2 CRITICAL fixed)**
- Audit: session_close.py (184L) — 1 CRITICAL (item 12: `--chat-total default=11070` magic number → fixed to `0`) + 1 MINOR functional (item 6: `--session-total` silently ignored → fixed, SESSION_TOTAL now written correctly)
- Audit: verify_runner.py (181L) — 1 CRITICAL (item 13: section-not-found exits 0 → fixed to exit 1 + stderr) + 2 MINOR (items 10, 12: noted only)
- Fixes: 5 line changes in session_close.py · 2 function changes in verify_runner.py (extract_section_lines returns tuple · main() differentiates not-found vs no-Verify-N)
- Verify-3: `session_close.py --dry-run` → exit 0 ✅ · Verify-4: `verify_runner.py --help` → exit 0 ✅ · S99 edge case → exit 1 ✅

## Y89
**T-155 · user-coach Learning System — closed learn-alongside loop**
- `knowledge/user_learning_profile.json` created — JSON proficiency store (global + topics[] + history[])
- `scripts/learning_profile.py` created (~150L) — record + analyze engine (the usage layer)
- `.agents/skills/user-coach/SKILL.md` created (78L) — 8-component skill, USE->QUIZ->RECORD->ADAPT
- `.claude/settings.json` — additive UserPromptSubmit hook -> analyze -> [learning-state] each turn
- `.agents/skills/skill-manifest.json` — user-coach entry added (bucket stable, Phase3+manual)
- `.agents/tools/tool-manifest.json` — learning_profile entry added
- Verify: profile JSON valid - analyze clean - SKILL.md 7 sections/78L - settings valid + hook fires - manifest valid

## Y-2026-06-08 · T-156 harness_editor rewrite
- SKILL.md: Workflow -> 5-stage cycle (AUDIT/PLAN/EDIT/CLOSE/CFP) · Implement Map added · Parallel-cycle scan added · L96 grep-bug fixed · dedup close block
- Implement/04_skills.md synced (5-stage + Implement Map · Step5->Stage4)
- audit PASS: 8/8 components · 5 stages · 230L yellow · hygiene clean

## Y90 · T-157 · token-tracking fix — persist-every-turn + consume-once reset marker · SESSION_TOTAL/CHAT_TOTAL written EVERY turn before footer (closes CFP-031 persist gap) · reset now gated by session_reset=armed in compact_state.md (B1 + UserPromptSubmit hook consume ONCE, armed→consumed) replacing buggy date-match that let stale compact_state.md reset mid-task · touched: AGENTS.md B1 · Implement/03_config.md (B1 mirror x2 + R1) · .claude/settings.json hook · CLAUDE.md R1 · mece_plan_schema PATH A/B/C · CFP-031 🟢
