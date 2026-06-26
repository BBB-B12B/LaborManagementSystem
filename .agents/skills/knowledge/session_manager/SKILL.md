---
name: Session Manager
description: Handles session lifecycle — topic-switch close, TOKEN PAUSE, BLOCKED halt, manual close, and resume flows.
triggers: ["close session", "session complete", "wrap up", "end task", "ปิด session", "จบงาน", "session_manager §3"]
---

## Sections
```
- id: 1
  name: "Session State"
  steps: ["check active_thread.md phase", "rotate or continue session JSON", "continuous History logging"]
- id: 2
  name: "Pause / Blocked Handling"
  steps: ["save state to session_handoff.md", "summarize progress", "ask user to continue or fix"]
- id: 3
  name: "Manual Close"
  steps:
    - "Step 0: CFP review (self_improve §1–3)"
    - "Step 1–5: write 5 mandatory files"
    - "Step 6: confirm to user — list every file written"
```

---

# Session Manager

## Trigger
- **Topic switch** — C3 detects different topic → routes here → close current session → Phase 1 fresh
- **Manual close** — user says "ปิด session / close / จบงาน / done"
- **TOKEN PAUSE** — SESSION_TOTAL 60-80k → Phase 3 REACT loop fires this
- **BLOCKED halt** — verify or observe fails 2× → Phase 3 fires this
- **Session rotation** — new task after phase: done → create new session JSON
- **Task complete** — Completion Gate Reviewer PASS → emit `[session-health]` · check SESSION_TOTAL vs thresholds (20k/40k/60k)

## When NOT to Use
- Task involves editing `SKILL.md` or harness config files → delegate to `harness_editor` · session_manager does not edit skills
- Agent is mid-Phase-3 execution with steps still pending → do NOT close · complete or pause first · emit `[sm-refused] reason:task-incomplete`
- Compact is needed but Phase 3 sections are unmarked `[ ]` → write compact_state.md first · then session_manager §3
- User is asking for a status summary, not a close → respond inline · do not trigger close sequence

## Refusal Contract
Halt and emit `[session-refused]` if:
- Section 3 requested but no active `session_*.json` found → warn user, create placeholder before proceeding
- Close requested mid-BLOCKED state without T-ID logged in roadmap → require T-ID first
- `session_handoff.md` write attempted without all 5 contract fields (objective · outcome · changes · validation · follow_ups) → halt · fill missing fields first

**Behavior Contract — Handoff Contract Validation (fires before every session_handoff.md write):**
```
Pre:    about to write session_handoff.md
Contract: check all 5 fields present in draft: objective · outcome · changes · validation · follow_ups
          any field empty or missing → emit [handoff-incomplete] field:<name> · HALT · fill first
          all 5 present → emit [handoff-valid] · proceed with write
Post:   [handoff-valid] or [handoff-incomplete] emitted — never silent write
Enforce: session_handoff.md written without [handoff-valid] this turn = [violation] BC-handoff → validate fields · re-write
```

## Operating Stance
- Session state is the handoff contract. Every close must leave a state another agent can resume cold — no implicit context.
- Close sequence is ordered. Steps 1→5 run in sequence, never parallel, never skipped — out-of-order writes create stale state.
- Active thread is ground truth. `active_thread.md` phase field drives C1/C2 routing every turn — an incorrect phase field corrupts all subsequent routing.
- Minimal writes, maximal fidelity. Write only what changed — do not rewrite files to "clean them up" during close.

## Prerequisites
- [ ] All Phase 3 sections marked `[X]` in `mece_plan.md`
      → Why: closing before execution completes orphans unfinished work
      → Missing: emit `[sm-refused] reason:sections-pending` · list pending sections · halt
- [ ] `SESSION_TOTAL` computed and written to `session_tokens.md`
      → Why: token log requires accurate count before session_summary write
      → Missing: compute SESSION_TOTAL from turn count · write · then proceed
- [ ] Task type = close/wrap/handoff (not mid-task question)
      → Why: session_manager §3 is a destructive sequence — it resets state files
      → Missing: emit `[sm-refused] reason:not-a-close` · return to orchestrator

## Workflow

**Section 1 — Session State:**
- Check `active_thread.md` phase → rotate JSON if phase≠in_progress
- On topic switch: set current session `status: completed` → create new session JSON
- Continuous History logging after every interaction round (≤5 items — rolling compact)

**Section 2 — Pause / Blocked:**
- TOKEN PAUSE (60-80k): finish current step → write `session_handoff.md` → emit `[pre-compact-state]` block → ask user continue?
- /compact trigger (80-90k): write `compact_state.md` (section + step + compact_size) → run /compact immediately — do NOT wait for user
- HALT (>90k): HALT immediately → write `session_handoff.md` → notify user → no new steps
  ```
  [pre-compact-state]
  task: <T-N · description>
  pending_sections: <S-N names from mece_plan.md [ ] items>
  resume_at: S<N>:step:<last step description>
  key_files: <comma-separated changed files this session>
  ```
- BLOCKED (2× fail): halt → write state → report cause → ask "fix or skip?"
- On resume: reload skill if different, reuse MECE plan if unchanged

**Section 3 — Manual Close:**

**Step −1 — Entry Gate (CFP-037 · fires the instant a close is triggered · prevents close-from-memory):**
```
Pre:    "ปิด session / close / จบงาน / done" detected — about to take ANY close action
Contract: FIRST action MUST be Read @.agents/skills/session_manager/SKILL_detail.md §Manual Close —
          NEVER run the close from memory. Close files MUST be written by `python3 scripts/session_close.py`
          + Step 0 (reflections.md) — NEVER hand-written via printf/echo/Write.
          emit [close-checklist-read] → then a per-item table (file · written? · signal) covering all close
          artifacts incl reflections.md + [handoff-valid] BEFORE the "session closed" message.
Post:   [close-checklist-read] emitted · session_close.py + Step 0 run (not hand-rolled)
Enforce: any close file hand-written instead of via session_close.py, OR "session closed" reported without
         [close-checklist-read] this turn = [violation] CFP-037 → re-run close via the skill
```

**Close Checklist Pre-Check (fires before §3 Step 0):**
```
Pre:    §3 Manual Close triggered · about to run Step 0
Contract: grep .sessions/mece_plan.md for "status: task-complete" in Phase 1-3 block
          found → proceed to Step 0 normally
          absent (Phase 3 has [ ] or [X] sections without PATH A) →
            run Close Checklist from docs/session_templates/mece_plan_schema.md §Close Checklist first
            PATH A: head -n $(grep -n "^## Phase 1" .sessions/mece_plan.md | head -1 | cut -d: -f1) .sessions/mece_plan.md > /tmp/mh.md && printf "\n## Phase 1–3 — cleared\nstatus: task-complete\n" >> /tmp/mh.md && mv /tmp/mh.md .sessions/mece_plan.md
          skip = [violation] BC-close-checklist-precheck → run checklist now · then Step 0
Post:   mece_plan.md Phase 1-3 cleared (status: task-complete present) · safe to Step 0
Enforce: Step 0 started without "status: task-complete" in mece_plan.md = [violation] BC-close-checklist-precheck → stop · run checklist first
```

- Step 0: run `python3 scripts/cfp_decay.py --update` → refresh last_seen/window_count/stale in index_cfp_fix.json
           then CFP review via `self_improve` §1–3 before file writes
           then: python3 scripts/session_analyzer.py --seed → seeds .sessions/promotions.md if >=3 patterns found
           then: Append to `.sessions/reflections.md`: `intent: <task> | outcome: <summary> | friction: <blockers> | lesson: <what improved> | promoted_patterns: <any pattern noted>`
- Steps 1–5: run `python3 scripts/session_close.py --task "<task>" --next "<next>" --chat-total <CHAT_TOTAL>`
              → `[✓ session-close] 5 files written` · if fail → emit [session-close-error] · HALT
- Step 6: confirm to user listing all files written

**Behavior Contract — Self-Improve Gate (fires at §3 Step 0):**
```
Pre:    §3 Manual Close triggered · about to write session files
Contract: MUST invoke self_improve §1–3 FIRST · wait for [cfp-tally] or [cfp-skip] emit
          proceed to Step 1 ONLY after one of those signals received
          skip → [violation] BC-self-improve-gate → invoke self_improve now · wait for signal · then Step 1
Post:   [cfp-tally] or [cfp-skip] emitted · Step 1 file writes may proceed
Enforce: Step 1 file write without [cfp-tally] or [cfp-skip] this turn = [violation] BC-self-improve-gate → invoke now
```

**Behavior Contract — 5-File Completion Gate (fires before "session closed" report):**
```
Pre:    Steps 1-5 claimed complete
Contract: verify all 5 files actually written this turn:
          grep each filename in bash output / [✓ written] signals this task
          any missing → emit [session-incomplete] file:<name> · write missing file · re-verify
          all 5 confirmed → emit [✓ session-files-complete] · proceed to Step 6 confirm
Post:   [✓ session-files-complete] emitted before user-facing "session closed" message
Enforce: "session closed" message without [✓ session-files-complete] = [violation] BC-5file-gate → complete files · re-confirm
```
**Never report "session closed" before all 5 files are written.**

→ Full History format, Rolling Summary, compact detail, TOKEN PAUSE steps, BLOCKED steps,
Manual Close steps 0–6 with exact file content:
`@.agents/skills/session_manager/SKILL_detail.md`

## Hard Rules
- Never run §3 close sequence while any mece_plan.md section is still `[ ]` or `[/]` — incomplete = not done.
- Never overwrite `compact_state.md` after /compact has run in the same session — write only before /compact.
- Never write `phase: done` to `active_thread.md` until all 5 close steps are confirmed complete.
- Never skip `session_summary` write to `token_log.jsonl` — missing entry breaks session continuity metrics.
- Never reset `LOOP_WEIGHT` to 0 at close — preserve the value so C0.5 thresholds remain accurate until user runs `/compact` (B1 resets it to 0 after compact).
- SESSION_TOTAL must be written to `session_tokens.md` BEFORE writing `session_summary` to `token_log.jsonl`.

## Tone Guide
Keep:   `[sm-refused]` + reason · `[session-closed]` signal · `[compact-state-written]` · phase values
Strip:  internal deliberation · "I'll now close the session..." preamble · token arithmetic shown inline
Format: `[signal] Key: value · Key: value` — single line, no prose wrap
Prohibited: "I've gone ahead and closed..." · "Feel free to start a new session" · "Let me wrap things up"

## Output Contract

**Required emits:**
| Trigger | Emit |
|---|---|
| Topic switch | `[topic-switch] Current: <task> · New: <topic> · Closing first` |
| TOKEN PAUSE | `[pre-compact-state]` block (task+pending+resume_at+key_files) · then `"ทำเสร็จแล้ว <X>/<N> sections · ค้างที่: · ดำเนินการต่อไหม?"` |
| BLOCKED | `[blocked] Task: <T-ID> · Attempts: 2 · Cause: <root> · Need: <missing>` |
| Session close | `✅ Session ปิดแล้วครับ` + list of all 5 files written |
| CFP skip | `[cfp-skip]` or `[cfp-tally] New: N · Total: N` |
| Task complete | `[session-health] Session: ~NNk · Chat: ~NNk · <recommendation>` · SESSION_TOTAL thresholds: <20k=✅ 20-40k=💡 40-60k=⚠️ compact now · 60-80k=🛑 TOKEN PAUSE · CHAT_TOTAL note: true API context ≈ CHAT_TOTAL × 1.5–2× — compact before CHAT_TOTAL >80k |

**5 mandatory files at close (all required — no exceptions):**
| Step | File | Content |
|---|---|---|
| 1 | `session_<NNN>.json` | `status: completed` + `summary_context` |
| 2 | `session_tokens.md` | Reset 5 fields: `SESSION_TOTAL: 0 · CHAT_TOTAL: <sys_fixed> · CACHE_READ: 0 · CACHE_WRITE: 0 · TURN_COUNT: 0` · **LOOP_WEIGHT: preserve (do NOT reset — resets only at B1 after /compact)** |
| 3 | `active_thread.md` | `phase: done` + task + next |
| 4 | `session_handoff.md` | Full closeout contract — 5 REQUIRED fields matching BC-handoff (objective · outcome · changes · validation · follow_ups) · root_cause optional |
| 5 | `index_sessions.json` | `python scripts/session_indexer.py` · then `python3 scripts/session_analyzer.py --seed` |

## Routing
| After | Go to |
|---|---|
| Topic switch close | Phase 1 fresh (same chat: claude-code · other platform: ask user to open new chat) |
| Manual close done | Session ends · user notified · `phase: done` |
| TOKEN PAUSE | Wait for user confirm → resume Phase 3 at `resume_at` section |
| BLOCKED | Wait for user "fix or skip" → fix: retry once · skip: mark section blocked → next section |
| Section 3 §0 (CFP §4 done) | Continue to Step 1 (5 file writes) |

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
