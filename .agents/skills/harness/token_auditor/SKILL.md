---
name: Token Auditor
description: Analyzes wasteful token consumption when SESSION_TOTAL > 60k. Identifies root cause and logs optimization lesson.
triggers:
  - "audit tokens"
  - "check token drift"
  - "token accuracy"
  - "token audit"
  - "ตรวจ token"
  - "session drift"
  - "CHAT_TOTAL off"
---

## Sections
```
- id: 1
  name: "Audit"
  steps: ["read session History", "run 3 audit checks", "log lesson to optimization_logs.md", "flag offending skill (harness_editor applies rule)"]
```

---

# Token Auditor

## When to Invoke
Called by R3 when SESSION_TOTAL > 60k. Runs audit before TOKEN PAUSE completes.

## When NOT to Use
- Token count seems slightly off but no threshold has been crossed → note discrepancy in footer · do not spawn full audit
- User is asking general token questions ("how much did that cost?") → answer from footer values · do not run audit workflow
- CHAT_TOTAL and SESSION_TOTAL are both 0 (fresh session, first turn) → no drift possible · skip audit
- Task is to fix a token undercount, not audit it → route to `token_tracker` for recalculation · auditor diagnoses, it does not recalculate

## Operating Stance
- Audit finds drift, not cause. The auditor's job is to measure the gap between expected and actual token counts — root cause analysis belongs to the user or harness_doctor.
- Evidence before verdict. Never emit `[token-drift]` without showing the expected vs actual comparison — a bare signal without evidence is unactionable.
- Conservative estimates. When inputs are ambiguous (tool result sizes unknown), bias the estimate high — undercount hides threshold crossings, overcount triggers earlier but safer pauses.
- Non-destructive reads only. Audit is read-only — it never writes `session_tokens.md`, never resets SESSION_TOTAL, never modifies state files.

## Prerequisites
- [ ] `session_tokens.md` exists and has `SESSION_TOTAL` + `CHAT_TOTAL` fields
      → Why: audit compares stored values against recomputed estimates — missing file = nothing to audit
      → Missing: emit `[audit-refused] reason:no-state-file` · halt
- [ ] At least 3 turns have occurred in this session (TURN_COUNT ≥ 3)
      → Why: <3 turns = insufficient history for drift detection · single-turn variance is noise
      → Missing: emit `[audit-skipped] reason:too-early · turns:<N>` · return
- [ ] `token_log.jsonl` exists with at least 1 entry
      → Why: audit validates stored values against JSONL history — missing log = no baseline
      → Missing: emit `[audit-refused] reason:no-jsonl` · prompt user to run token_tracker first

## Workflow
Sequential: Run Audit Checks (1-3) → log findings to `knowledge/optimization_logs.md` → emit `[audit-done]` verdict. (Auditor never edits another skill's SKILL.md — flag only; harness_editor owns the fix.)
Full check detail: `## Audit Checks` and `## Actions` below.

## Audit Checks

**Check 1 — Surgical File Reading:**
Look for `Read` calls without `offset/limit` on files > 60 lines → flag as violation of R5.

**Check 2 — Unfiltered CLI Output:**
Check for Bash commands without `| grep | tail` filter → flag as violation of R6.

**Check 3 — Low-Overhead Tooling:**
Check for full-file edits when only a small targeted change was needed → flag as violation of R5 (index-first).

| Audit Check | Criteria |
|---|---|
| Context payload size | Before each sub-agent spawn: verify `context_files:` + `cycle_context:` combined < 2,000 chars. Flag if exceeded. |
| Post-read verdicts   | Confirm `[post-read]` verdict was emitted for every Read call this session. Flag missing verdicts. |
| Compact pressure | Check [token-state]: C>80k → [compact-rec] strong must have been emitted (PRIMARY) · LOOP_WEIGHT>50 → [compact-rec] light must have been emitted (secondary) · S>90k OR C>120k → [compact-STOP] must have been emitted. Flag if threshold crossed without signal. |
| CHAT_TOTAL drift     | Check that CHAT_TOTAL is growing each turn (≥ hooks_overhead=700 per turn). Sudden drop without /compact = tracking error. Flag if CHAT_TOTAL < previous known value without compact event. |

## Actions

1. **Log the Lesson** → append to `knowledge/optimization_logs.md`:
   ```
   Date: <date> · Session: <session_id>
   Total tokens: ~<N>k
   Root cause: <check that failed>
   Rule recommended: <what harness_editor should add>
   ```

2. **Flag Only** → if a skill caused the waste, emit `[audit-finding] Check: <N> · Rule: R<N> · Skill: <name>` (canonical format — see Output Contract) and record it in the optimization log. The auditor NEVER edits another skill's SKILL.md — authoring/injecting the preventive rule is harness_editor's job (gated · minimal-diff). Keeps the auditor read-only, matching its Operating Stance.

3. **Compact Threshold** → if SESSION_TOTAL 80-90k OR signal-box ≥2/4: emit `[compact-rec]` strong — recommend /compact (NOT forced · user choice). Below the ceiling nothing is forced; the ONLY hard stop is >90k/>120k (item 4) per R3.

4. **Halt Threshold** → if SESSION_TOTAL > 90k: set session `"status": "paused_limit_reached"` → HALT → notify user per R3.

**Behavior Contract — Halt Threshold (fires when SESSION_TOTAL >90k):**
```
Pre:    SESSION_TOTAL just crossed 90k during any audit or Phase 3 execution
Contract: HALT immediately → set status: "paused_limit_reached"
          write session_handoff.md → emit [halt] SESSION_TOTAL > 90k · session paused → notify user
          do NOT start new tool calls · do NOT continue Phase 3 sections
Post:   session_handoff.md written · user notified · session paused
Enforce: Phase 3 step after 90k without halt = [violation] BC-halt → HALT now + write handoff
```

## Hard Rules
- Never write to `session_tokens.md` — audit is read-only; any recalculation belongs to `token_tracker`.
- Never emit `[token-drift]` without including `expected:<N>` and `actual:<N>` values — bare signal is not actionable.
- Never run full audit if TURN_COUNT < 3 — early sessions have too little history for meaningful drift detection.
- Never flag a delta < 5% as drift — minor variance from estimation formula rounding is expected and not a defect.
- Never compare CHAT_TOTAL to SESSION_TOTAL as if they reset together — they have different reset points (SESSION resets per task, CHAT resets on /compact).

## Output Contract
| Result | Emit | File written |
|---|---|---|
| Findings found | `[audit-finding] Check: <N> · Rule: R<N> · Skill: <name>` | `knowledge/optimization_logs.md` (harness_editor applies any rule) |
| No findings | `[audit-clean] SESSION_TOTAL: <N>k · no violations` | — |
| Threshold halt | `[halt] SESSION_TOTAL > 90k · session paused` | `session_handoff.md` |
| Skipped | `[auditor-skip] reason: <below-threshold \| wrong-trigger>` | — |

## Refusal Contract
Skip audit entirely (emit `[auditor-skip]`) if:
- SESSION_TOTAL < 60k at trigger time — below threshold, no audit needed
- Called outside of R3 trigger (not from a TOKEN PAUSE or HALT path)

## Routing
Boundary: Do NOT track per-turn token counts — audit/diagnose only. Per-turn tracking → `token_tracker`.
→ After audit:
- Findings logged + flagged → return to session_manager (TOKEN PAUSE flow)
- SESSION_TOTAL > 90k → HALT → notify user (does NOT return to loop)
- No findings → emit `[audit-clean]` → return to caller

## Tone Guide
Keep:   `[token-drift]` + expected/actual · `[audit-clean]` · `[audit-refused]` + reason · delta% value
Strip:  formula derivation shown inline · "I computed X as Y multiplied by Z" prose
Format: `[token-drift] expected:~NNNk · actual:~NNNk · delta:N% · cause:<hypothesis>` — single line
Prohibited: "The tokens seem to be slightly off" vague language · audit verdict without numbers · "approximately"

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
