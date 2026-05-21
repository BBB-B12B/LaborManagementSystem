---
name: Session Manager
description: Handles TOKEN PAUSE, BLOCKED halt, session rotation, and resume flows. Maintains session JSON and active_thread.md.
---

## Sections
```
- id: 1
  name: "Session State"
  steps: ["check active_thread.md phase", "rotate or continue session JSON"]
- id: 2
  name: "Pause / Blocked Handling"
  steps: ["save state to session_handoff.md", "summarize progress", "ask user to continue or fix"]
- id: 3
  name: "Manual Close"
  steps:
    - "find and close current session JSON (status: completed + write summary_context)"
    - "write SESSION_TOTAL to .sessions/session_tokens.md"
    - "write active_thread.md → phase: done"
    - "write session_handoff.md if task was in_progress"
    - "archive + clear .sessions/mece_plan.md"
    - "confirm to user: list all files written"
```

---

# Session Manager

## Section 1 — Session State

### Session Rotation (new task or topic switch)
1. Open current `.sessions/session_xxx.json` → set `"status": "completed"` (or `"paused"`)
2. Write final summary into `"summary_context"`
3. Create new `.sessions/session_<NNN>_<topic>.json`:

```json
{
  "session_id": "session_003_master_data",
  "associated_tasks": ["T-007"],
  "status": "in_progress",
  "estimated_tokens": 0,
  "summary_context": "",
  "History": []
}
```

### Continuous Logging
After every interaction round → append to `History[]` in active session file.

### Rolling Summary (every 5 turns — MANDATORY)
If History has ≥ 5 items:
1. Read oldest items (all except 4 most recent)
2. Summarize as: `"[Before: X] | [Added: Y]"` → append to `summary_context`
3. Delete old items → keep only 4 most recent in History
History never exceeds 5 items — reduces context fed to AI by ~70%.

### Smart Output Truncation
Tool outputs > 1,000 chars → keep first + last 20 lines, separated by `\n...[Truncated]...\n`

---

## Section 2 — Pause / Blocked Handling

### TOKEN PAUSE (SESSION_TOTAL > 60k)
Triggered from Loop Phase 3 when token threshold hit.

```
1. Finish current loop step (do not stop mid-step)
2. Write .sessions/session_handoff.md:
   sections_done: [list]
   sections_pending: [list]
   last_step: <step name>
   latest_result: <last tool output summary>
3. Append to active session History with status "paused_token_limit"
4. Show user:
   "ทำเสร็จแล้ว <X>/<N> sections
    ค้างที่: Section <N> step <name>
    ดำเนินการต่อไหมครับ?"
5. On confirm:
   → Reload config (target Skill context_files)
   → Read `.sessions/mece_plan.md` → find first [/] or [ ] section
   → Reset loop to that section → continue Phase 3
```

### BLOCKED (step failed after 2× retry)
Triggered from Loop Phase 3 when verify or observe fails twice.

```
1. HALT all remaining sections immediately
2. Write .sessions/session_handoff.md with status "blocked"
3. Show user:
   "ติดปัญหาที่: Section <S> step <name>
    สาเหตุ: <cause>
    ทำสำเร็จแล้ว: [sections_done]
    ยังค้างอยู่: [sections_pending]
    แก้ก่อนดำเนินการต่อ หรือ skip section นี้?"
4. Wait for user decision:
   → Fix: user resolves → reload → resume from blocked section
   → Skip: mark section [X] with note "skipped: <reason>" → continue to next section
```

### Resume Flow
```
1. Read .sessions/session_handoff.md → load sections_done + sections_pending + last_step
2. Reload config: Read target Skill SKILL.md context_files
3. MECE: read `.sessions/mece_plan.md` → find first [/] or [ ] section → reuse plan if valid · rebuild if scope changed
4. Emit [resume] trace
5. Open REACT LOOP at first pending section (Phase 3 step 0: mark `[ ]` → `[/]` before first tool call)
```

---

## Section 3 — Manual Close (user says "ปิด session / close / จบงาน / done")

**Trigger:** User explicitly requests session end — NOT a token pause or blocked state.

**6 mandatory steps — do NOT summarize without completing all:**

```
Step 0 — Early Phase Commit (FIRST — before anything else)
  Write: .sessions/active_thread.md
  Content (minimal — will be overwritten fully in Step 3):
    task: closing session
    phase: done
    next: none
  Purpose: ensures Boot B1 resets SESSION_TOTAL even if close is interrupted mid-way.

Step 0.5 — R19 Self-Eval + CFP Flag Review
  [A] Read .sessions/cfp_flags.md → any correction events this session?
      If file exists and has entries:
        → set new_pattern = true automatically
        → present each flag to user:
          "พบ correction event ในเซสชันนี้:
           - <date> | skill: <X> | issue: <description>
           บันทึกเป็น CFP ไหมครับ? (y/n)"
        → y: write CFP draft → knowledge/cfp-proposals/CFP-draft-<YYYY-MM-DD>.md
              present to user at Step 6 for final confirm
        → n: delete cfp_flags.md entry only
        → After review: delete .sessions/cfp_flags.md (clear for next session)

  [B] Run standard R19 checks per CLAUDE.md §R19:
  · routing_ok  — skill used matched skill-manifest.json for each section?
  · budget_ok   — tool calls stayed ≤5 per turn?
  · invariant_ok — no I1–I5 tripped unexpectedly?
  · index_ok    — R8 Index Sync completed without error?
  · new_pattern  — any failure absent from CODING_FAILURE_PATTERNS.md? (auto-true if cfp_flags.md had entries)

  If routing_ok=false OR budget_ok=false:
    Write: .agents/skill-patches/pending/<skill>-gap-<YYYY-MM-DD>.md (use _template.md)
    Edit: registry.md → lower that skill's score by 0.5
  If new_pattern=true:
    Write: knowledge/cfp-proposals/CFP-draft-<YYYY-MM-DD>.md
    Present draft details (Symptom, Root Cause, Correct Resolution) to user and ask:
      "พบ failure pattern ใหม่ ต้องการตรวจสอบและยืนยันการเพิ่ม CFP บรรทึกเข้าระบบหรือไม่? (y/n)"
    → y: เมื่อผู้ใช้เห็นชอบและคอนเฟิร์มรายละเอียดความถูกต้องเรียบร้อยแล้ว จึงบันทึกต่อท้าย (append) ลงใน CODING_FAILURE_PATTERNS.md
    → n: ย้ายไฟล์ร่างไปไว้ในโฟลเดอร์ applied โดยตั้งสถานะเป็น declined ใน frontmatter
  All pass → proceed immediately to Step 1

Step 1 — Find and close current session JSON
  Bash: ls -t .sessions/session_*.json | head -1    → identify active session file
  Read: active session file
  Edit: set "status": "completed"
  Edit: write "summary_context": "<what was accomplished this session>"

Step 2 — Reset session_tokens.md for next session
  Write: .sessions/session_tokens.md
  Content:
    SESSION_TOTAL: 0
  Note: Final token count goes into session JSON summary_context (Step 1) — this file resets to 0 so the next session starts clean. Reset happens at session close only — never mid-session.

Step 3 — Write active_thread.md
  Write: .sessions/active_thread.md
  Content:
    task: <what was done this session>
    phase: done
    next: <next action if any, else "none">

Step 4 — Write session_handoff.md (ALWAYS — even if task is complete)
  Write: .sessions/session_handoff.md
  Content:
    status: completed
    session_id: <session_id>
    tasks_done: [list of T-IDs completed]
    tasks_pending: [list of T-IDs still open, or "none"]
    last_action: <final action taken>
    next_session_start: <what to do first next time>

Step 5 — Archive and clear mece_plan.md
  Read: .sessions/mece_plan.md
  Append to Session Archive section:
    ### Closed: <date>
    Done: [S1, S2, ...] | Remaining: [S3, ...] | Summary: <one-line task summary>
  Rewrite Sections block to empty template:
    ## Sections
    <!-- Orchestrator will write here at next Phase 2 -->
  Note: Session Archive block is KEPT — only Sections block is cleared

Step 6 — Confirm to user (list every file written)
  Reply format:
    ✅ Session ปิดแล้วครับ — ไฟล์ที่บันทึก:
    · .sessions/session_<NNN>_<topic>.json → status: completed
    · .sessions/session_tokens.md → SESSION_TOTAL: ~<N>k
    · .sessions/active_thread.md → phase: done
    · .sessions/session_handoff.md → next: <summary>
    · .sessions/mece_plan.md → Sections cleared · Archive updated
    · .sessions/cfp_flags.md → <N> flags reviewed · <N> CFP drafts created  (omit line if no corrections this session)
```

**Never report "session closed" before all 6 steps are completed.** Summary text alone = incomplete close.
