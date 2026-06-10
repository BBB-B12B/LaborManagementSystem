# Self-Improvement Skill — Detail Reference

Extended procedures for `self_improve/SKILL.md`. Load on-demand during the relevant section.

---

## §Archive — CFP Archive Gate (Section 1, when current_count > 20)

```
1. grep "^## CFP-" CODING_FAILURE_PATTERNS.md → get all headers
2. keep_count = 15  ← always keep most recent 15 entries
3. archive_count = current_count - keep_count
4. Extract oldest archive_count entries (CFP-1 through CFP-<archive_count>)
5. Append to knowledge/cfp_archive.md (create if missing)
6. Remove archived entries from CODING_FAILURE_PATTERNS.md
7. Emit [cfp-archive] Archived: CFP-1–CFP-<N> → knowledge/cfp_archive.md · Active: <keep_count>
```
- Archive is append-only — never delete from cfp_archive.md
- grep overhead stays bounded at ≤15 active entries

---

## §S2 — Section 2 Detail: Pattern Analysis

**Step 4.5 — Session context lookup** (optional — run if CFP entry has Session: field):
```
grep "Session:" from CFP entry → extract session_id
Read .sessions/<session_id>.json → check History[] for what triggered the violation
→ adds concrete context: "This happened during <task> when agent <action>"
→ if session file missing or no Session: field → skip, use CFP text only
```

**Full emit format for [cfp-analysis]:**
```
[cfp-analysis]
· New this session: <N> entries (CFP-<list>)
· Top pattern: CFP-<N> "<title>" — seen <K> time(s)
· Root cause: <one-line summary from Prevention section>
· Session context: <what task + action triggered it> (if found in Step 4.5)
· Other patterns: <list remaining titles briefly>
```

**Priority queue detail:**
- P1 = current session (CFP-N where N > cfp_boot_count) — always address first regardless of recurrence
  - Multiple P1 entries → pick lowest N (earliest this session)
- P2 = historical (N ≤ cfp_boot_count) — ranked by recurrence count
  - Only evaluated if P1 is empty
  - Tie → most recent (highest CFP number)
- Always emit both P1 and P2 layers so user sees full picture

---

## §S3 — Section 3 Detail: Proposal

**Step 2.5 — Dry-run validation (V21):**
```
Would the proposed change have caught the original violation?
Test: does the proposed rule's condition match the complaint keywords / missed step?
YES → proceed to Step 3
NO → revise proposal → re-test → max 2 revisions
  Still NO after 2 revisions → emit [proposal-mismatch]
  Explain gap: "เสนอนี้จะป้องกัน <Y> แต่ไม่ตรงกับ <original complaint X>"
  Ask user: "ต้องการ proceed ต่อ หรือ skip?"
Examples:
  Bad: "rewrite R9"
  Good: "เพิ่ม guard ใน R9 step 1: ถ้า grep ไม่เจอ ERR-XXX → emit [warn-no-err-code] ก่อน proceed"
```

**Step 3 — User presentation format (Thai):**
```
🔍 CFP Pattern พบบ่อย: CFP-<N> "<title>" (<K> ครั้ง)
ปัญหา: <root cause in Thai>
เสนอแก้: <specific change> ใน <file> §<section>
ผลที่คาดหวัง: agent จะ <new behavior> แทนที่จะ <old behavior>
→ ยืนยันเพื่อดำเนินการ หรือ พิมพ์ "skip" เพื่อข้ามได้ครับ
```

**Escalation rule (V16) — deferred_count ≥ 3:**
```
"⚠️ CFP-<N> '<title>' เกิดซ้ำแล้ว <K> ครั้ง ถูก defer แล้ว <D> ครั้ง
 ถ้าไม่แก้จะส่งผลให้: <what breaks>
 → ยืนยันแก้ หรือ พิมพ์ 'dismiss' เพื่อปิดถาวร (จะไม่เสนออีก)"
"dismiss" → write cfp_dismissed: ["CFP-N"] to session_handoff.md → skip in future sessions
```

---

## §S4 — Section 4 Detail: Execution Steps 5–6

**Step 5 — Update harness_flow patch table (V18):**
```
Append new row to most recent patch table (Q# series) in knowledge/harness_flow_20260525.md:
| Q<N> | <gap described in CFP-<N>> | <fix applied in §4> | <files changed> |
Where Q<N>: grep -c "^| Q" knowledge/harness_flow_20260525.md → N+1
Verify row written: grep "Q<N>" knowledge/harness_flow_20260525.md → found
```

**Step 6 — Write self_improve_log.md audit entry (NS2):**

**Behavior Contract — Audit Log Write (fires at Step 6 — after every §4 execution):**
```
Pre:    §4 Steps 1-4 complete · [✓ harness-updated] emitted
Contract: MUST write SI-N entry to .sessions/self_improve_log.md before ending §4
          create file if missing: printf "# Self-Improve Audit Log\n\n" > .sessions/self_improve_log.md
          append SI-N block with all 4 required fields: CFP / File / Change / Trigger
          verify: grep "^## SI-<N>" .sessions/self_improve_log.md → found
          missing → emit [log-write-failed] · retry once · HALT if still failing
Post:   SI-N entry verified in log · session_handoff.md last_self_improve_session updated
Enforce: §4 ends without SI-N in log = [violation] BC-audit-log → write log entry · re-verify
```
```
Bash: ls .sessions/self_improve_log.md 2>/dev/null || printf "# Self-Improve Audit Log\n\n" > .sessions/self_improve_log.md
Append:
## SI-<N> · <YYYY-MM-DD> · <session_id>
- CFP: CFP-<N> "<title>"
- File: <path changed>
- Change: <what was added (one line)>
- Trigger: complaint | session-close-review | user-request
---
Where N = grep -c "^## SI-" .sessions/self_improve_log.md → N+1
Verify: grep "SI-<N>" .sessions/self_improve_log.md → found
Update session_handoff.md: last_self_improve_session: <current session_id>
```

**Step 0.6 — Backup/restore detail:**

**Behavior Contract — Pre-Edit Backup (HOOK: fires before every Edit in §4):**
```
Pre:    target file path known · about to call Edit tool
Contract: MUST run backup BEFORE first Edit call this task:
          bash: cp <target_file> <target_file>.bak_$(date +%Y%m%d_%H%M)
          verify backup exists: ls <target_file>.bak_* → found → proceed
          backup missing → emit [backup-failed] · HALT · do not edit
Post:   backup file exists on disk · proceed to Edit · cleanup on success
Enforce: Edit without backup this task = [violation] BC-pre-edit-backup → create backup · re-edit
```
```
Before editing: cp <target_file> <target_file>.bak_$(date +%Y%m%d_%H%M)
On verify failure (Step 2): git checkout -- <target_file>  (or restore from .bak)
On verify success: rm <target_file>.bak_*  (clean up)
```

---

## §CFP-Logging — CFP Logging Format (used by R16 C0 complaint handler)

When logging a new CFP entry inline during task execution:

```
Step 1: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → count N → next = CFP-(N+1)
Step 2: Append to CODING_FAILURE_PATTERNS.md:

## CFP-<N+1> · <Short Title of What Was Skipped>

**Symptom:** <What the user observed — what was missing>

**Root cause:**
- <Why agent skipped this step>
- <Which rule/phase was violated>

**Prevention:**
1. <Specific check to add to prevent recurrence>
2. <Where in the loop this check should live>

**Detection signal:** User message contains `<keyword matching C0 signal list>` + missing step name

---

Step 2.5: Validate "Detection signal:" field — must contain ≥1 keyword from:
  ["ทำไมไม่ทำตาม", "ไม่ได้ทำตาม", "ลืม"+"step", "ไม่ได้บันทึก", "ไม่ได้ log",
   "you skipped", "you forgot", "harness says", "CLAUDE.md says", "rule says"]
  Keyword absent/vague → rewrite before proceeding.
Step 3: Verify: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → N+1
```

**Behavior Contract — Hard Rules Enforcement (fires after every CFP log operation):**
```
Pre:    CFP entry just written to CODING_FAILURE_PATTERNS.md
Contract: verify count: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → must = N+1
          duplicate number check: grep "^## CFP-<N>" → must appear exactly ONCE
          FAIL count or duplicate → emit [cfp-log-violation] · halt · fix before continuing
Post:   CFP-N appears exactly once · total count = N+1 verified
Enforce: CFP written without post-count verify = [violation] BC-hard-rules → verify immediately · self-improve backfill
```
Hard rules: never skip · never re-use CFP number · same pattern recurs → new CFP with `(recurrence of CFP-N)` · non-blocking.
