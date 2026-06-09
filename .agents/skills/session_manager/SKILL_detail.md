# Session Manager — Detail Reference

Extended procedures for `session_manager/SKILL.md`. Load on-demand during the relevant section.

---

## §S1 — Session State Detail

### Session JSON format (new session)
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

### History entry format — hard limits
- `action`: ≤20 words (what was done)
- `result`: ≤30 words (outcome only — no file content, no tool output verbatim)
- NEVER store: raw file reads, full tool outputs, CLAUDE.md text, knowledge JSON content
- Tool outputs → store summary only: `"wrote <file>:<lines>"`, `"grep found <N> matches"`, `"build ok"`

### summary_context size cap
- Rolling Summary appends `"[Before: X] | [Added: Y]"` to `summary_context`
- If `summary_context` total chars > 2,000 → keep only last 3 entries → discard older
- `summary_context` is NEVER injected into sub-agent prompts — for session replay only

### Rolling Summary (every 5 turns — MANDATORY)
If History has ≥ 5 items:
1. Read oldest items (all except 4 most recent)
2. Summarize as: `"[Before: X] | [Added: Y]"` → append to `summary_context`
3. Delete old items → keep only 4 most recent in History
History never exceeds 5 items — reduces context fed to AI by ~70%.

**Hard enforcement before sub-agent spawn:** History MUST NOT exceed 5 items at spawn time.
If History count = 5 when about to spawn → compact first → then spawn. No exceptions.

### Smart Output Truncation
Tool outputs > 1,000 chars → keep first + last 20 lines, separated by `\n...[Truncated]...\n`

### Mid-Session Compact (SESSION_TOTAL > 50k) — NON-BLOCKING
Triggered automatically. Does NOT pause work or ask user.
```
1. Identify last 6 loop interactions (keep verbatim)
2. Summarize everything older than last 6 loops → ≤300 tokens
3. Write .sessions/context_compact_<N>.md:
   Fields:
     summary:    <key decisions, artifacts created, current state>
     keep_loops: <last 6 loop interactions>
     compacted_at: <SESSION_TOTAL at time of compact>
4. Emit [compact] Context: ~<N>k → compacted · keeping last 6 loops
5. Treat summary as new context anchor — old tool results no longer re-referenced
6. Continue task immediately — no interruption
```
Compact cadence: fires at >50k → again at >60k (before TOKEN PAUSE) → TOKEN PAUSE takes over at >60k if insufficient.

### CHAT_TOTAL Advisory (in-memory only — no file write required)
CHAT_TOTAL = estimated true context window size. Track in working memory alongside SESSION_TOTAL.
Resets to 0 only on `/compact` or new chat. Does NOT reset on session close.

| CHAT_TOTAL | Action |
|---|---|
| >120k | ⚠️ "Context window หนักมาก — แนะนำ /compact ก่อนงานถัดไป" |
| >180k | 🛑 "/compact บังคับก่อนรับงานใหม่" · ไม่รับงานใหม่จนกว่าจะ compact |

Advisory only — does NOT block current task. Does NOT write to any file at session close.

---

## §S2 — Pause / Blocked Detail

### TOKEN PAUSE (SESSION_TOTAL > 60k)
```
1. Finish current loop step (do not stop mid-step)
2. Write .sessions/session_handoff.md:
   sections_done: [list]
   sections_pending: [list]
   last_step: <step name>
   latest_result: <last tool output summary — ≤50 chars, outcome only>
   skill_name: <cached skill from working memory>
   attempt_count: <N>
   mece_plan_hash: <sha1sum .sessions/mece_plan.md | cut -d' ' -f1>
   cfp_boot_count: <N>
3. Append to active session History with status "paused_token_limit"
4. Show user:
   "ทำเสร็จแล้ว <X>/<N> sections
    ค้างที่: Section <N> step <name>
    ดำเนินการต่อไหมครับ?"
5. On confirm:
   → Compare incoming skill_name vs handoff skill_name
       Same → SKIP SKILL.md re-read
       Different → Read new SKILL.md offset=1 limit=80
   → Check MECE plan: reuse if state unchanged, rebuild if scope changed
   → Reset loop to pending section → continue Phase 3
```

### BLOCKED Halt (verify or observe fails 2×)
```
1. Write .sessions/session_handoff.md (same fields as TOKEN PAUSE)
2. Append to History with status "blocked"
3. Emit: [blocked] Task: <T-ID> · Attempts: 2 · Cause: <root cause> · Need: <what's missing>
4. Show user error + progress · ask "fix or skip?"
   Fix: user provides resolution → retry once → if still fails → R13 escalate
   Skip: mark section as [blocked] in mece_plan.md → move to next section
```

---

## §S3 — Manual Close Detail (Steps 0–6)

### Step 0 — CFP Review (run BEFORE the 5 file writes)
```
0a. Load self_improve SKILL.md (.agents/skills/self_improve/SKILL.md)
0b. Run self_improve §Section 1 (CFP Tally):
    current_count = grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md
    new_cfps = current_count - cfp_boot_count (from working memory)
0c. If new_cfps = 0 → emit [cfp-skip] · skip to Step 1
    If new_cfps ≥ 1 → run self_improve §Section 2–3 (Pattern Analysis + Proposal)
    Wait for user response before proceeding to Step 1
    "skip" / "later" → emit [cfp-deferred] · proceed to Step 1
    "ทำเลย" / "yes" → run self_improve §Section 4 · then proceed to Step 1
```

### Step 1 — Find and close current session JSON
```
Bash: ls -t .sessions/session_*.json | head -1    → identify active session file
Read: active session file
Edit: set "status": "completed"
Edit: write "summary_context": "<what was accomplished this session>"
```

### Step 2 — Reset session_tokens.md
```
Write: .sessions/session_tokens.md
Content:
  SESSION_TOTAL: 0
Note: Final token count goes into session JSON summary_context (Step 1) — this resets for next session
```

### Step 3 — Write active_thread.md
```
Write: .sessions/active_thread.md
Content:
  task: <what was done this session>
  phase: done
  next: <next action if any, else "none">
```

### Step 3.5 — Read-merge CFP state before session_handoff.md (NC2 fix)
```
Bash: grep -E "^cfp_deferred:|^cfp_dismissed:|^last_self_improve" .sessions/session_handoff.md 2>/dev/null
→ extract existing values (defaults: cfp_deferred: {} · cfp_dismissed: [] · last_self_improve_session: none)
→ merge with current session:
  cfp_deferred: merge keys, sum counts (do NOT reset)
  cfp_dismissed: union of lists (deduplicate)
  last_self_improve_session: keep if §4 did NOT run; update if it did
→ include merged values in Step 4 Write
```

### Step 4 — Write session_handoff.md (ALWAYS — even if task is complete)
```yaml
status: completed
session_id: <session_id>
tasks_done: [list of T-IDs completed]
tasks_pending: [list of T-IDs still open, or "none"]
last_action: <final action taken>
next_session_start: <what to do first next time>
cfp_boot_count: <N>
cfp_deferred: <merged dict from Step 3.5>
cfp_dismissed: <merged list from Step 3.5>
last_self_improve_session: <session_id if §4 ran, else carry>
# Closeout contract (required):
objective: <what the task asked for — 1 sentence>
outcome: <what was delivered and verified — 1 sentence>
changes: [{ file: <path>, symbol: <name or "n/a"> }]
validation: <Verify-N result — "PASS" or "FAIL: <reason>">
root_cause: <if any step was blocked — why · "n/a" if no blocks>
follow_ups: [list of T-IDs or action items still pending, or "none"]
```

### Step 5 — Sync session index
```
Bash: python scripts/session_indexer.py
→ updates knowledge/index_sessions.json with this session's keywords + summary
Verify: grep -c "session_<NNN>" knowledge/index_sessions.json → ≥1
```

### Step 6 — Confirm to user
```
✅ Session ปิดแล้วครับ — ไฟล์ที่บันทึก:
· .sessions/session_<NNN>_<topic>.json → status: completed
· .sessions/session_tokens.md → SESSION_TOTAL: ~<N>k
· .sessions/active_thread.md → phase: done
· .sessions/session_handoff.md → next: <summary>
· knowledge/index_sessions.json → session indexed
```
