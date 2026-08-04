---
name: Self-Improvement
description: Session-close skill — tallies new CFPs, identifies root cause, proposes one minimal harness fix per session.
triggers: ["review CFP", "improve harness", "ดู pattern", "พัฒนา harness", "ปัญหาซ้ำ", "self improve"]
activates_at: [session_close_auto, manual]
---
# Self-Improvement Skill

## Trigger
- **Automatic:** session_manager §3 Step 0 calls this at every session close
- **Manual:** user says "review CFP" / "improve harness" / "ดู pattern" / "พัฒนา harness" / "ปัญหาซ้ำ"
- **Condition:** full analysis only if ≥1 new CFP logged this session OR user explicitly requests

## When NOT to Use
- CFP has no prior recurrence history — use `self_improve §1–2` to log first occurrence, not doctor flow
- Same CFP fixed or logged <24h ago — cooldown applies; log recurrence only, do not re-propose fix
- User is asking about session state, tokens, or routing — delegate to `token_tracker` or `session_manager`
- Requesting harness file edits (SKILL.md / CLAUDE.md / AGENTS.md) — delegate to `harness_editor`; self_improve does not self-edit harness files

## Operating Stance
- **Pattern observer first, fixer second.** §1–§2 goal: understand why pattern recurs. Proposal before root cause confirmed = scope creep.
- **One change per session, always.** Minimal means: removing one word breaks the prevention. Two ideas in one proposal → split.
- **Cooldown is not laziness.** §4 cooldown gate exists because harness changes need sessions to validate. Skipping cooldown = proposing before previous fix was tested.
- **self_improve cannot fix itself.** Circular dependency (V20) is a hard stop on *self-execution* — emit `[blocked-self-edit]` and hand the change to the user as a code block (§Refusal Contract · L37/L148). The hard stop blocks auto-applying the edit, NOT producing the proposal output.
- **Blameless.** Name the pattern or gap, never the agent or person — the fix-flow targets the harness, not the operator. A CFP entry says "the rule lacked X", not "the agent was careless".

## Prerequisites
- `CODING_FAILURE_PATTERNS.md` readable
  Why: CFP tally impossible without it · Missing: emit `[cfp-skip] reason:patterns-unreadable`
- `session_handoff.md` loaded (current session context)
  Why: need prior session summary for root-cause reasoning · Missing: proceed with current session transcript only
- `cfp_boot_count` in working memory (from B1)
  Why: delta calculation (new CFPs = current_count − boot_count) requires baseline · Missing: grep `CODING_FAILURE_PATTERNS.md` for `^## CFP-` count now

## Refusal Contract
Halt and emit:
- `[cfp-skip]` — no new CFPs this session AND user did not explicitly request → STOP after §1
- `[blocked-self-edit]` — proposal targets `self_improve/SKILL.md` → present change as code block to user, ask to apply manually (V20 — circular dependency)
- `[blocked-invariant]` — proposed change conflicts with INVARIANTS.md → halt · ask user confirm/revise

## Workflow
Sequential (4 steps — each gates the next):
1. **CFP Tally** — count new CFPs this session vs cfp_boot_count → [cfp-skip] if 0 new + not requested
2. **Pattern Analysis** — rank by frequency · identify root cause of top CFP
3. **Proposal** — draft minimal harness change → HALT for user approval · deferred ≥3× → escalate to harness_doctor
4. **Execution** — apply approved change via harness_editor · emit [✓ harness-updated] · log SI-N entry

## Sections
1. CFP Tally — count new entries this session
2. Pattern Analysis — rank by frequency, find root cause
3. Proposal — one concrete harness change to prevent top pattern
4. Execution — apply approved change to harness files

---

## Section 1 — CFP Tally

```
Step 1: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → current_count
Step 2: compare with cfp_boot_count (from Boot B1 working memory)
         missing? → grep from session_handoff.md · still missing → use 0 + [cfp-tally] note: "baseline approximate"
         new_cfps = current_count - cfp_boot_count
Step 3: new_cfps = 0 AND not requested → emit [cfp-skip] · STOP
         new_cfps ≥ 1 OR user asked → emit [cfp-tally] New: <N> · Total: <current_count> → §2
```
Archive gate: fires when current_count > 20 → see `@.agents/skills/harness/self_improve/SKILL_detail.md §Archive`
Decay update: after tally → run `python3 scripts/cfp_decay.py --update` to refresh last_seen + window_count + stale fields

---

## Section 2 — Pattern Analysis

```
Step 1: grep "^## CFP-" CODING_FAILURE_PATTERNS.md → extract titles
Step 2: count recurrences per CFP-N using window_count (90-day) from index_cfp_fix.json — NOT lifetime count
         stale=true entries (last_seen >90d or null): deprioritize in ranking — still match but moved to P3 tier
         if index_cfp_fix.json not yet migrated (no window_count field): fallback to count field + emit [decay-missing]
Step 3: Priority queue:
         P1 — current session (CFP-N where N > cfp_boot_count) → always first · multiple: lowest N
         P2 — historical (N ≤ cfp_boot_count) by window_count · only if P1 empty
         P3 — stale=true entries (last seen >90d): report only if P1+P2 empty
         Emit [cfp-analysis] showing BOTH layers
Step 4: [pre-read] top pattern: grep -n "^## CFP-<N>" → Read offset=L limit=30
Step 5: Emit [cfp-analysis] · New this session · Top pattern · Root cause · Other patterns
```
Session context lookup (Step 4.5) + full priority queue rules → `SKILL_detail.md §S2`

---

## Section 3 — Proposal

```
Step 1: map root cause → specific rule/file/section to change
Step 2: propose ONE minimal change (no redesigns)
Step 2.5: dry-run validation — would this have caught the original violation?
          YES → Step 3 · NO → revise × 2 → [proposal-mismatch] → ask user
Step 3: present to user (Thai format → SKILL_detail.md §S3 for template)
Step 4: WAIT for explicit confirm before §4
         "ทำเลย" / "proceed" / "yes" → §4
         "skip" / "ไว้ก่อน" → [cfp-deferred] · end skill
         silence → write pending_proposal to session_handoff.md → [cfp-pending]
         On defer: write cfp_deferred: { "CFP-<N>": <count+1> } to session_handoff.md
```

**Behavior Contract — Approval Gate (fires at Step 4 — before ANY §4 execution):**
```
Pre:    proposal presented to user (Step 3 complete) · awaiting reply
Contract: MUST wait for explicit user confirm — no auto-proceed on silence or ambiguity
          "ทำเลย"/"proceed"/"yes"/"ได้เลย" → emit [cfp-approved] CFP-N → proceed §4
          "skip"/"ไว้ก่อน"/"no" → emit [cfp-deferred] CFP-N · write session_handoff.md · end
          silence / no reply → write pending_proposal to session_handoff.md · emit [cfp-pending] · end
Post:   ONE of [cfp-approved] / [cfp-deferred] / [cfp-pending] emitted — never silent §4 entry
Enforce: §4 execution without [cfp-approved] this turn = [violation] BC-approval-gate → halt · re-present proposal
```
Escalation rule (deferred ≥3) + dry-run examples → `SKILL_detail.md §S3`

---

## Section 4 — Execution

```
Step 0: cooldown gate — last_self_improve_session ≤ 2 sessions ago AND not explicit request
         → [cfp-cooldown] Skip · end skill
         Exception: recurrence ≥ 5 OR user typed "improve harness" → bypass
Step 0.5: INVARIANTS.md conflict check — grep key terms · conflict → [blocked-invariant]
Step 0.6: backup target file: cp <file> <file>.bak_$(date +%Y%m%d_%H%M)
Step 1: apply change · R5 pre-edit gate before every Edit
Step 2: grep verify → emit [✓ harness-updated] · not found → retry once → [blocked]
Step 3: if routing keywords changed → update skill-manifest.json keywords[]
Step 4: confirm to user (✅ Harness อัปเดต · file · change · CFP-N prevention)
```

**Behavior Contract — Cooldown Gate (fires at §4 Step 0 — before any file edit):**
```
Pre:    grep last_self_improve_session from .sessions/session_handoff.md
Contract: last session ≤ 2 ago AND no explicit "improve harness" request
          → emit [cfp-cooldown] Skip · END §4 immediately (no edits)
          recurrence ≥ 5 OR explicit request → emit [cfp-cooldown-bypass] · proceed
          first time (no session record) → proceed normally
Post:   [cfp-cooldown] or [cfp-cooldown-bypass] emitted · OR no prior session (proceed)
Enforce: §4 file edit without cooldown check this turn = [violation] BC-cooldown → undo edit · re-check
```
Step 5 (patch table) + Step 6 (SI audit log) → `SKILL_detail.md §S4`

---

## §4 Invariants

- MUST NOT edit `self_improve/SKILL.md` directly → `[blocked-self-edit]` (V20 — circular dependency)
- MUST NOT edit `INVARIANTS.md` gates without separate R14 `[gate]` confirmation
- MUST NOT remove or reorder existing rules — only append or extend

## Boot Integration

At Boot B1, capture: `cfp_boot_count=$(grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md 2>/dev/null || echo 0)`
Store in working memory — used in §1 Step 2 comparison.

## Tone Guide
Keep:   CFP-N IDs · [self-improve] signal · [cfp-tally] count · [cfp-skip] when none
Strip:  internal reasoning about whether to log · token counts · session IDs · deliberation prose
Format: `[signal] CFP-N: symptom → fix` (one line per entry)
Prohibited: "I'll now log this..." · "As an improvement..." · prose CFP rationale in user-facing reply

## Output Contract

| Section | Required emit |
|---|---|
| §1 pass | `[cfp-tally] New: <N> · Total: <N>` |
| §1 skip | `[cfp-skip] No new CFPs this session` |
| §2 | `[cfp-analysis] · New · Top · Root cause · Session context · Other` |
| §3 deferred | `[cfp-deferred]` or `[cfp-pending]` (silence case) |
| §4 skip | `[cfp-cooldown] Skip — §4 ran recently` |
| §4 done | `[✓ harness-updated]` + SI-N entry in `.sessions/self_improve_log.md` |
| §4 blocked | `[blocked]` + halt |

## Routing
After §4 (Execution) completes: → return to session_manager §3 Step 1 (continue close flow)
After §4 skipped: emit `[cfp-deferred]` → return to session_manager §3 Step 1
After user rejects proposal: log `[cfp-deferred CFP-N]` → return to session_manager §3 Step 1
After §3 proposal deferred ≥ 3 times for same CFP-N → emit `[cfp-escalate] CFP-N · deferred:<count> → harness_doctor` · hand off via session routing (set next-skill = harness_doctor, pass the deferred CFP-N + proposal history) — do not loop self_improve again (structural fix needed)
  (Distinct from the recurrence path: window_count ≥ 5 → `[fix-escalated]` in §CFP Recurrence Thresholds. Trigger here = defer-count ≥3; that one = 90-day window_count ≥5. Both route to harness_doctor but are separate flows with separate signals.)
Never stay active after returning — session_manager owns the close sequence.

## Hard Rules

- Never propose changes that contradict INVARIANTS.md
- Never delete existing CFP entries — only add
- Proposals must be minimal and specific — one rule change per session
- If user rejects: log `[cfp-deferred CFP-N]` in session_handoff.md for next session
- Deferred ≥3 on same CFP-N = structural problem → escalate to harness_doctor (do not loop §3 again)

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

## CFP Recurrence Thresholds (window_count — 90-day sliding window)
| window_count | Signal | Action |
|---|---|---|
| < 3 | `[recurrence-logged]` | log only |
| ≥ 3 | `[fix-required]` | propose fix next session |
| ≥ 5 | `[fix-escalated]` | invoke harness_doctor immediately |
Note: thresholds use window_count from index_cfp_fix.json, NOT lifetime count field.

## MECE Constraints Block (copy into mece_plan.md for sections using `self_improve`)
- self_improve runs ONCE per session close (§1 tally → §2 pattern → §3 propose → §4 execute)
- `[cfp-skip]` if no new CFPs this session AND no explicit request → STOP at §1
- §4 MUST NOT edit `self_improve/SKILL.md` → `[blocked-self-edit]` (V20 — circular dependency)
- Escalation: §3 deferred_count ≥ 3 for same CFP-N → invoke `harness_doctor` for structural fix
- `[cfp-tally]` at §1 · `[cfp-analysis]` at §2 · `[✓ harness-updated]` at §4 — all required
