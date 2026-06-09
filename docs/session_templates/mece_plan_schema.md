# Template: .sessions/mece_plan.md
# Written by: Phase 2 M5 — after user confirms plan + Verify-N
# Read by: Phase Transition Gate (PreToolUse hook) — checks date: == today AND Phase 0 block present
#          C2 routing — checks status: + pending [ ]/[/] sections
#          Boot B1 — resume staleness gate (mece_plan_hash comparison)
#
# ENFORCEMENT RULES (harness_editor Refusal Contract):
#   MUST use this template — no simplified format (CFP-019)
#   MUST include Phase 0-3 blocks — hook validates "## Phase 0" present
#   Phase 0: keep [X] across tasks in same session · reset only on topic switch / new session
#   Phase 1-3: cleared after task complete (PATH A) → "## Phase 1–3 — cleared · status: task-complete"
#   Verify-N: runnable shell commands per section — never prose
#   Constraints: copied from skill's ## MECE Constraints Block (≤5 lines)
#   Context + Model + Input_From: filled per section — a low-tier agent must execute it as accurately as a high-tier one with NO chat history
#   TOKEN CHECK after every section: >50k → /compact · >60k → TOKEN PAUSE → PATH B
# ---
# MECE Plan — T-XXX <title>
date: YYYY-MM-DD
task: <task description — matches active_thread.md task:>
skill: <skill_name>

## Phase 0 — Boot (once per session · keep [X] on resume · reset on topic switch only)
- [ ] B1: compact_state.md checked · SESSION_TOTAL=0 · CHAT_TOTAL=sys_fixed (dynamic: (CLAUDE.md+AGENTS.md chars × 0.3)+3500 ≈ 11–13k) · CFP_COUNT stored
- [ ] B2-B3: skill=<name> identified · SKILL.md loaded · hashes checked
- [ ] C0-C3: routing confirmed · no unresolved topic switch
→ TOKEN CHECK: SESSION_TOTAL ~___k

---

## Phase 1 — Info Gather
- [ ] G0: task clarity gate (≥3 criteria → skip · else AskUserQuestion)
- [ ] G1: ALL sections scanned in 1 pass
- [ ] G2: batch greps in ONE Bash call · targeted Reads (offset+limit) · [post-read] verdicts emitted
- [ ] G3: every section → file/symbol + Verify-N draft · [✓ gather] emitted
- [ ] gather_complete.md written today (objective · constraints · affected_files · acceptance_criteria)

### Files Read — Phase 1
| File | Why | Lines read |
|---|---|---|
| <path> | <reason> | offset=N limit=N |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`

---

## Phase 2 — Plan
- [ ] M1.5: reasoning pass (sequential vs parallel · irreversible flagged · risk noted)
       dependency_map: [<file_A> → <file_B>, ...]
       risk_flags: [<irreversible action>, <large scope>]
- [ ] M2: plan 1:1 with skill sections · Context: + Skill: + Model: + Tool: + Avoid: + Input_From: + Verify-N per section
       → grep activates_at + tools + model from manifest (grep only — never Read full manifest):
         `grep -A10 '"<skill_key>"' .agents/skills/skill-manifest.json | grep -E '"activates_at"|"primary"|"avoid"|"model"'`
         → Tool: from tools.primary[0] · Avoid: from tools.avoid[] · Model: from manifest (else low=lookup/read/grep · high=reasoning/multi-file/edit)
         → Context: 1-line cold-readable goal · Input_From: prior cycle output (cycle_<N>_S<M>.json) or none
- [ ] M3: plan + Verify-N sent to user → user confirmed
- [ ] M4: roadmap [ ] T-<N> per section added
- [ ] M5: mece_plan.md written using this template (Phase 0-3 blocks mandatory) · [✓ MECE] emitted

### Files Read — Phase 2
| File | Why | Lines read |
|---|---|---|
| <path> | <reason> | offset=N limit=N |

→ TOKEN CHECK: `cat .sessions/session_tokens.md`
→ **[mece-complete] + /compact before Phase 3 (BC-mece-compact):**
   After [✓ MECE] emitted: emit [mece-complete] · prompt "/compact แล้ว reply 'ลุย'" · WAIT
   Phase 3 Edit/Write without [mece-complete] = [violation] BC-mece-compact

---

## Phase 3 — Execute

### Cycle grouping  (fill when ≥2 independent sections · else write "Cycle 1 — all sequential")
Cycle 1 — serial   · agents: 1                          → S1
Cycle 2 — parallel · agents: <N> · cap: <N>             → S2, S3   (no shared file write · no mutual dep)
  Barrier: all cycle_2_*.json status:done → Cycle 3
Cycle 3 — serial   · agents: 1 · Input_From: cycle_2_*  → S4
(agents = sub-agents spawned this cycle · cap = max concurrent · group parallel only when no shared file + no dependency)

### Per-Section Invariants  (apply to EVERY S<N> below — written ONCE · do NOT repeat in each section)
Constraints — every section carries these PLUS its own skill-specific line:
  - mece_plan.md dated today + T-N roadmap [/] REQUIRED before any file edit
  - [pre-edit] emit before every Edit · [✓ written] grep verify after every change
  - Output Contracts: [post-read] ≤1 line · [✓ written] ≤1 line · [✓ gather]/[✓ MECE] = signal only
  - L4.5 PURGE: drop Bash/grep after verdict · keep Read excerpts ≤10L · compress tool result >50L → verdict + path + ≤5 key lines
Marking rule — flip a section box to [X] ONLY when [✓ written] + Verify-N both exist this turn · skip = L4-violation
TOKEN CHECK — after EVERY section: `cat .sessions/session_tokens.md`  (>50k → /compact · >60k → TOKEN PAUSE → PATH B · spike: turn > 3×avg → emit [spike])
LOOP_WEIGHT CHECK (Behavior Contract — fires every turn, all sections):
   Pre:      read [token-state] hook → LOOP_W · CHAT_TOTAL · SESSION_TOTAL
   Contract: CHAT_TOTAL >80k → emit [compact-rec] strong (Recommend/Why/MUST-vs-SHOULD=SHOULD/Resume brief/Your call) — PRIMARY · recommendation + choice, NOT a STOP
             LOOP_WEIGHT >50 → emit [compact-rec] light hint BEFORE continuing (secondary · optional · no STOP)
             hard STOP only at SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP] → write compact_state.md → STOP
   Post:     [compact-rec] strong missing any of the 5 fields = invalid · must re-emit complete
   Enforce:  C0.5 gate in AGENTS.md Per-Turn Routing (fires every turn)

### S1 · T-XXX · <Section 1 name>            [Cycle 1 · serial]
Context: <1 line — what this section achieves + why · cold-readable by a spawned agent (NO chat history)>
Skill: <skill_name>
Model: <model_low | model_high>   (low: lookup/read/grep · high: reasoning/multi-file/edit logic)
Input_From: <none | cycle_<N>_S<M>.json>   (prior-batch output this section pulls in)
File: <path/to/file>
Tool: <Edit | Write | Bash | Agent>
Avoid: <tools from manifest tools.avoid — do not call these tools in this section>
Rollback: git checkout <path/to/file>
Data_Sent: <what data / old_string / new_string / command is passed to the tool>
Token: ~<NNN> output
Constraints: → §Per-Section Invariants · PLUS skill-specific: <constraint from skill's ## MECE Constraints Block>
Verify-1: <runnable grep/bash command> → <expected output>
- [ ] S1

### S<N> · T-XXX · <Section N name>            [Cycle <N> · serial|parallel]
Context: <1 line — goal + why · cold-readable by a spawned agent (NO chat history)>
Skill: <skill_name>
Model: <model_low | model_high>
Input_From: <none | cycle_<N>_S<M>.json>
File: <path/to/file>
Tool: <Edit | Write | Bash | Agent>
Avoid: <tools from manifest tools.avoid — do not call these tools in this section>
Rollback: git checkout <path/to/file>
Data_Sent: <what data is passed to the tool>
Token: ~<NNN> output
Constraints: → §Per-Section Invariants · PLUS skill-specific: <constraint from MECE Constraints Block>
Verify-N: <command> → <expected>
- [ ] S<N>

### /compact checkpoint template (M1.5 inserts when: sections ≥ 3 OR sections × 6 > 30)
Sequential notation: `[S1] → [S2] → [/compact] → [S3]`

- [ ] /compact checkpoint
  Pre: compute compact_size:
    `python3 scripts/compute_compact_size.py`  → compact_size (formula + retention constant live in the script · single source)
  Pre: write compact_state.md (section=S<N> · step=<last-step-desc> · skill=<name> · compact_size=<value>)
  How: user runs `/compact` in terminal
  Post: SESSION_TOTAL=0 · LOOP_WEIGHT=0 · CHAT_TOTAL ≈ compact_size + sys_fixed
  Verify: `cat .sessions/session_tokens.md` → SESSION_TOTAL: 0 · LOOP_WEIGHT: 0
  Resume: open new chat → type: **"Resume T-<N> · Skill: <name> · ต่อจาก S<N+1>"**
          read `.sessions/mece_plan.md` → first `- [ ]` section = next section to execute

---

**Behavior Contract — Phase 3 Execution Complete Pause (fires when all S[N] marked [X]):**
```
Pre:    all mece_plan.md Phase 3 sections marked [X] · about to proceed to Close Checklist
Contract: emit [exec-complete] summary (sections done · files changed · Verify-N results)
          Assess next user message intent — do NOT wait for a specific keyword:
            → new task or topic detected → C3 topic-switch · session_manager §3 · Phase 1 fresh
            → acknowledges / gives feedback / idle → proceed to Close Checklist
            → ambiguous (short reply · unclear direction) → ask once: "มีงานต่อไหมครับ?" · wait 1 turn · then proceed
          On proceeding to Close Checklist:
            Read mece_plan_schema.md §Close Checklist offset=158 limit=40 FIRST (never from memory)
            touch .sessions/.close_checklist_ack · then run each checklist item in order
Post:   [exec-complete] emitted · intent assessed · schema read · .close_checklist_ack written
Enforce: proceeding to Close Checklist without [exec-complete] = [violation] BC-exec-pause
         writing active_thread.md phase:done without .close_checklist_ack = blocked by hook (T-097)
```

---

## Phase 3 — Close Checklist
- [ ] R8 index sync: files/symbols changed → indexes updated (index_files.json · symbol_indexer · session_indexer)
      ⚡ MUST emit [r8-sync-check] after running sync — no silent skip (CFP-033 pattern)
      Commands: `python3 scripts/backlink_analyzer.py --file <path>` per new file
                `python3 scripts/symbol_indexer.py` if new symbols
                `python3 scripts/session_indexer.py` at session close
      emit: [r8-sync-check] files_indexed: N · backlinks: ok · symbols: ok
- [ ] Roadmap [X]: all T-<N> sections annotated (attempts + tool_calls)
- [ ] Spawn Reviewer (model_low from detected.md — default: haiku · read-only):
      "Run each Verify-N: line exactly · Report: PASS list · FAIL list"
      On PASS → proceed · On FAIL → fix → retry 1× → R13 [blocked]
- [ ] [mece-audit] emitted: `[mece-audit] Sections: N · All Verify-N: PASS · Plan quality: <note>`
- [ ] Ask user: "มีอะไรอยากแก้ไขหรือปรับเพิ่มไหมครับ?" (1 message — do not loop)
- [ ] Feedback delivered (user replied or timeout after 1 exchange)
- [ ] Reflection written → `.sessions/reflections.md` appended (intent / outcome / friction / lesson / promoted_patterns)
- [ ] [session-health] emitted (Completion Gate)
- [ ] PATH A: close-gate check → clear mece_plan.md Phase 1-3
      (see §PATH A below — use exact command · never ad-hoc · CFP-025)
- [ ] **if skill=harness_editor AND knowledge/ files edited** → `python3 scripts/knowledge_conflict_checker.py --file <path> --no-trigger` for each edited knowledge/ file · emit [kcc-ok] or [kcc-conflict] before proceeding
- [ ] **if skill=harness_editor** → Step 5 gate (mandatory before close):
      harness_flow_20260526.md updated (Y-entry) · affected Implement/ files updated · flow_updated=yes
      emit `[harness-edit-done]` → then Thai user summary ("งานเสร็จแล้วครับ ✅ ...")
      ⚡ Do NOT clear mece_plan or write session_handoff until Step 5 complete
- [ ] session_handoff.md written (skill + CFP_COUNT + objective + outcome + changes + validation)
- [ ] self_improve: `grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md` > cfp_boot_count → run §1–3
- [ ] **harness_doctor gate — Behavior Contract (fires at every Close Checklist):**
  ```
  Pre:    (A) [fix-required] or [fix-escalated] emitted this turn
          OR (B) python3 -c "import json; d=json.load(open('knowledge/index_cfp_fix.json')); print(any(v.get('recurred_after_fix') for v in d.values()))" → True
  Contract: EITHER condition met → MUST emit [doctor-invoked] · invoke harness_doctor skill
            HALT all remaining close steps (session_handoff / mece_plan clear / PATH A/B/C)
            until harness_doctor emits [doctor-verdict: clean] or [doctor-verdict: fix-applied]
            NEITHER condition → emit [doctor-skipped: clean] · proceed
  Post:   [doctor-verdict] received OR [doctor-skipped: clean] emitted — never silent skip
  Enforce: close sequence proceeded without [doctor-verdict] or [doctor-skipped] = [violation] BC-doctor-gate
           → HALT · re-run Pre check · invoke doctor if condition met
  ```

---

## Close Path — choose ONE based on state:

**Behavior Contract — Close Gate (fires before ANY PATH A/B/C action · CFP-037):**
```
Pre:    all Phase 3 sections marked [X] · about to start close sequence
Contract: MUST check close-gate FIRST — (user typed /compact) OR (SESSION_TOTAL>80k) OR (LOOP_WEIGHT>50)
          gate PASSES → proceed to PATH A/B/C
          gate FAILS  → present summary + [session-health] → WAIT for user · do NOT write compact_state.md or PATH A
Post:   close-gate result logged before any PATH action
Enforce: PATH A/B/C started without close-gate check = [violation] CFP-037 → HALT · present summary · wait
```

### PATH A — Task complete (typical · most common)
```
SESSION: CHAT_TOTAL accumulates (never resets here)
         SESSION_TOTAL=0 written NOW at task-done close (condition 2: task done + session close) —
         does NOT rely on next-boot date-match (removed in T-157) · PATH A does NOT arm session_reset (that is PATH B / /compact only)
```
- [ ] active_thread.md → phase: done · next: <description>
- [ ] SESSION_TOTAL written → .sessions/session_tokens.md
- [ ] Clear mece_plan.md Phase 1–3 (keep Phase 0 [X]):
      ⚠️ **NEVER write ad-hoc content** (e.g. `# MECE Plan — (cleared)`) — = CFP-025 violation
      ⚠️ **NEVER delete entire file** — Phase 0 block MUST be preserved
      Use EXACT command below — no substitutions:
      `head -n $(grep -n "^## Phase 1" .sessions/mece_plan.md | head -1 | cut -d: -f1) .sessions/mece_plan.md > /tmp/mh.md && printf "\n## Phase 1–3 — cleared\nstatus: task-complete\n" >> /tmp/mh.md && mv /tmp/mh.md .sessions/mece_plan.md`

**Session Close (Behavior Contract — PATH A · runs at every task complete):**
```
Pre:      grep "^phase:" .sessions/active_thread.md → confirm phase: done written
          ls .sessions/session_handoff.md → confirm handoff exists OR task is internal-only
Contract: IF task modified src/ OR created new feature OR fixed a bug →
            MUST write session_<NNN>.json (status: completed · summary_context) BEFORE clearing mece_plan
            MUST run `python scripts/session_indexer.py` to update index_sessions.json
          IF task is harness-only (no src/ change) →
            session_<NNN>.json optional · session_indexer still recommended
Post:     session_<NNN>.json missing when src/ was changed = invalid close
          index_sessions.json not updated = R8 violation
          Re-run session_manager §3 steps 1+5 before proceeding
Enforce:  R8 Index Sync Invariant (AGENTS.md) · session_manager §3 (SKILL.md)
          Detection: `ls .sessions/session_*.json | wc -l` unchanged after close = violation
```

### PATH B — TOKEN PAUSE (SESSION_TOTAL > 60k)
```
SESSION: /compact resets CHAT_TOTAL=0 · B1 at next boot reads compact_size → CHAT_TOTAL = compact_size + sys_fixed
         SESSION_TOTAL reset to 0 ONLY via consume-once marker: PATH B writes `session_reset=armed` →
         B1 (or UserPromptSubmit hook) consumes it ONCE at next boot → SESSION_TOTAL=0, flips marker→consumed.
         NOT unconditional on compact_restore (T-157 — prevents a stale/leftover compact_state.md from re-resetting mid-task)
```
- [ ] Compute compact_size BEFORE /compact:
      `python3 scripts/compute_compact_size.py` → compact_size
- [ ] Write compact_state.md:
      dt=<YYYY-MM-DD> s=___k task=<desc> cfp=___
      sk=<skill> sk_h=<8chars> mece_h=<8chars>
      p1=done p2=done p3=<last_section> section=S<N> step=<last step desc>
      resume_at=S<N>:step:<desc>
      compact_size=<value from step above>
      session_reset=armed   ← T-157: arms the consume-once reset · B1/hook flips →consumed at next boot · SESSION_TOTAL→0 exactly once
- [ ] session_manager TOKEN PAUSE → emit [pre-compact-state] block → ask user confirm
- [ ] claude-code: /compact · other platform: write compact_state.md → STOP

### PATH C — Manual close (user: ปิด / close / จบงาน / done)
```
SESSION: CHAT_TOTAL accumulates (resets ONLY on /compact — not on session close)
         SESSION_TOTAL reset to 0 by session_manager §3
```

**Session Close (Behavior Contract — PATH C · mandatory, no exceptions):**
```
Pre:      read active_thread.md → get task: field
          count existing session files: `ls .sessions/session_*.json 2>/dev/null | wc -l` → store N
Contract: MUST complete all 5 steps of session_manager §3 in order:
            1. session_<NNN>.json → write status: completed + summary_context
            2. session_tokens.md → SESSION_TOTAL: 0
            3. active_thread.md → phase: done + task + next
            4. session_handoff.md → full closeout contract
            5. index_sessions.json → `python scripts/session_indexer.py`
          ALL 5 are mandatory — no skipping, no reordering
Post:     `ls .sessions/session_*.json | wc -l` must equal N+1 (one new file created)
          `python scripts/session_indexer.py` exit code must be 0
          Any step missing = invalid close → re-run §3 from step 1
Enforce:  session_manager SKILL.md §3 · AGENTS.md R8 Index Sync Invariant
          CFP-030: session close BC skipped → [self-improve] + backfill immediately
```
- [ ] session_manager §3 (Behavior Contract above — all 5 steps, no exceptions)
- [ ] self_improve §1–3 (Step 0 at every session close)
