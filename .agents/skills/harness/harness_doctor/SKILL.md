---
name: Harness Doctor
description: Structural fix agent for CFP patterns that recurred after a prior fix was applied. Escalation path from self_improve.
triggers: ["harness doctor", "fix harness pattern", "recurring cfp", "ซ่อม harness", "fix-escalated", "recurred_after_fix"]
activates_at: [session_close_escalation, manual]
---
# Harness Doctor Skill

## Overview
Structural fix agent for CFP patterns that recurred AFTER a fix was already applied.
Reads index_cfp_fix.json + relevant harness files → proposes structural change →
waits approval → executes following harness conventions.

## Operating Stance
- **Structural surgeon, not a pattern collector.** Act only on CFPs that recurred AFTER a fix was already applied. First-time CFPs belong to self_improve.
- **Diagnosis is bounded.** §1–§2 attempt cap = 3 — see Hard Rules.
- **Minimal structural fix only.** One gap, one change. Goal: make detection signal fire reliably — not redesign the rule.
- **Recurrence threshold is the trigger, not the fix.** count ≥ 3 means diagnose. It does not mean the fix is obvious.

## Prerequisites
- `knowledge/index_cfp_fix.json` readable
  Why: diagnosis impossible without fix history + count · Missing: emit `[harness-doctor-refused] reason:index-unreadable`
- `SKILL_detail.md` accessible (`.agents/skills/harness/harness_doctor/SKILL_detail.md`)
  Why: §2 Harness Audit needs step-by-step procedures · Missing: emit `[harness-doctor-refused] reason:skill-detail-missing`
- CFP target identified (cfp_id + topic + count)
  Why: cannot diagnose without knowing which pattern · Missing: ask caller for CFP-N before proceeding

## Refusal Contract
Halt and emit `[harness-doctor-refused]` if:
- First-time CFP with no prior fix attempt → use `self_improve §3+§4` instead
- CFP has `status=active` and `fixes=[]` → not a structural recurrence yet
- Proposal targets `self_improve/SKILL.md` → circular dependency → present to user manually
- §5 Execute begins harness file edits without `.sessions/mece_plan.md` dated today → HALT · write mece_plan first · delegate edits to `harness_editor` (its gate applies — do NOT bypass)

## Workflow
Sequential — each section gates the next:

**Resume Gate BC (MANDATORY FIRST — before §1 diagnosis):**
```
Pre:    grep index_cfp_fix.json for approved_proposal != "" AND status == "approved"
Contract: IF found → emit [resume] CFP-N · approved_proposal: <summary>
                     SKIP §1–§4 → jump directly to §5 (Execute)
          NEVER skip resume check even on fresh session
Post:   [resume] emitted → §5 entered, OR no approved entry → proceed to §1
Enforce: any §1 that starts without resume check = [violation] BC-A
```

**Prior-Fix Check (fires after Resume Gate · before topic match):**
```
Pre:    no approved resume found · about to start §1 diagnosis
Contract: grep fixes[] in index_cfp_fix.json for target CFP
          fixes[] not empty → emit [prior-fix-found] approach:<summary> · date:<D>
          §2 Harness Audit MUST explain WHY prior fix was insufficient (not just "it recurred")
          §3 Proposal MUST differ from prior approach → emit [approach-diff] prior:<X> · new:<Y> before [harness-proposal]
          same approach proposed again = [violation] BC-approach-diff → re-assess §2
          fixes[] empty → proceed normally (first structural attempt)
Post:   [prior-fix-found] emitted (if applicable) · §3 cannot emit [harness-proposal] without [approach-diff] when fixes[] non-empty
Enforce: [harness-proposal] without prior [approach-diff] when fixes[]≠[] = [violation] BC-approach-diff → re-run §2 · re-propose
```

1. **Diagnosis** — §1.0 resume check → prior-fix check → topic match (keyword→AI judge→exhaustion gate) → count threshold → emit `[fix-required]` or `[recurrence-logged]`
2. **Harness Audit** — load + run `docs/harness_health_checklist.md` → score all 17 checks → emit `[checklist-score]` → grep harness files for structural gap → classify gap type (a/b/c/d) → emit `[audit-finding]`

**Behavior Contract — Pre-Audit Checklist (fires at §2 Harness Audit):**
```
Pre:    about to assess harness gaps for a CFP
Contract: MUST Read docs/harness_health_checklist.md FIRST
          fill each Check-NN (pass/partial/fail) from session transcript
          emit [checklist-score] total: N/85 · grade: <✅/⚠️/🔶/🛑> · fails: <domains>
          THEN grep harness files for gap on failed domains ONLY
          skip checklist → [violation] BC-pre-audit → re-run with checklist
Post:   [checklist-score] emitted BEFORE any [audit-finding]
Enforce: [audit-finding] without prior [checklist-score] = [violation] BC-pre-audit → load checklist · re-score · re-emit
```
3. **Proposal** — draft minimal structural fix → dry-run validate → **pin repro** → emit `[harness-proposal]` → HALT

**Repro-Pin (folded into §3 · SINGLE SOURCE of the repro-pin format · consumer = `harness_editor` Stage 3.6):**
The proposal MUST state how the fix will be validated by pinning the original failure:
```
repro: { trigger: "<what triggers the failure>", check: "<grep / signal / re-run that confirms it is gone>", reproducible: yes|no }
```
- reproducible:yes → emit `[repro-pinned] trigger:<x>` · store in `index_cfp_fix.json` fixes[].repro (§5 Fix Record)
- reproducible:no (behavioral drift — cannot trigger on demand) → emit `[repro-missing]` → validation falls back to count-proxy (§1.4 recurrence count) + flag weak-validation → **PROCEED · NEVER block the proposal** (SOFT gate · CFP-behavioral bugs must not stall the doctor)
4. **Approval Gate** — wait explicit user confirm ("ทำเลย" / "proceed") · no auto-proceed
5. **Execute + Verify** — apply approved change → update index_cfp_fix.json → verify detection signal → emit `[✓ harness-fix]`

## Output Contract

| Step | Required emit / file |
|---|---|
| §1.0 resume found | `[resume] CFP-N · approved_proposal: <summary>` → skip to §5 |
| §1.1 keyword hit | `[keyword-match] topic: <id> · score: N/M` |
| §1.2 AI judge hit | `[topic-match] topic: <id> · confidence: 0.N` OR `[no-match] · confidence: 0.N` |
| §1.3 new topic | `[new-topic-proposed] topic_id: <X> · reason: <…>` → HALT |
| §1.3 auto | `[auto-confirmed] confidence > 0.9 — skipping gate` |
| §1.4 count < 3 | `[recurrence-logged] CFP-N · topic: <id> · count: N` → END |
| §1.4 count ≥ 3 | `[fix-required] CFP-N · topic: <id> · count: N` → §2 |
| §1.4 count ≥ 5 | `[fix-escalated] CFP-N · topic: <id> · count: N` → §2 priority=HIGH |

> **§1.4 reliable WRITE (T-265 · loop stage 8 Re-open):** when you (the agent) have JUDGED a resolved CFP has recurred, do NOT hand-edit the ledger — run `python3 scripts/cfp_recurrence.py CFP-N`. It appends today to `recurred_after_fix[]`, flips `status` resolved→reopened, `count++`, and prints the matching `[recurrence-logged]`/`[fix-required]`/`[fix-escalated]` line for the table above. Detection stays YOUR judgment (R16 BC-E); the script only makes the write total + correct (no missed field). Verify after: status==reopened + today in recurred_after_fix + json valid.
| §1 done | `[harness-diagnosis] CFP-N · topic: <id> · count: N · prior fixes: M` |
| §2 done | `[harness-audit] gap found in <file> §<section>` |
| §3 done | `[harness-proposal] <change>` · HALT for approval |
| §4 approved | `[harness-approved] Proceeding to §5` |
| §5 done | `[✓ harness-fix] CFP-N · file: <path> · change: <desc>` |
| §5 done | `knowledge/index_cfp_fix.json` updated · `status: fixed` · `fixes[]` appended |

**Behavior Contract — Fix Record (fires at §5 completion · no exceptions):**
```
Pre:    §5 fix applied and verified
Contract: MUST update index_cfp_fix.json for the target CFP with ALL of:
          (1) status: "fixed"
          (2) fixes: append { date: YYYY-MM-DD, task: T-NNN, change: "<what changed and where>", files: ["<path>"], repro: <the §3 repro-pin object — or {reproducible:no} if [repro-missing]> }
          (3) approved_proposal: "<summary of approved proposal from §3>"
          (4) repro carries the §3 pin (trigger/check/reproducible) so `harness_editor` Stage 3.6 can re-run it · [repro-missing] → repro:{reproducible:no} (consumer falls back to count-proxy)
          emit [✓ fix-recorded] CFP-N · status: fixed · files: <list>
          THEN emit [✓ harness-fix] as final signal
Post:   index_cfp_fix.json has status=fixed + non-empty fixes[] before [✓ harness-fix] emitted
Enforce: [✓ harness-fix] without prior [✓ fix-recorded] = [violation] BC-fix-record → write index entry now · re-emit [✓ fix-recorded] · then re-emit [✓ harness-fix]
```

**Behavior Contract — Harness-Editor-Delegate (fires at §5 Execute start):**
```
Pre:    §5 about to apply structural fix to any harness file (AGENTS.md / CLAUDE.md / SKILL.md / Implement/)
Contract: MUST delegate ALL file edits to harness_editor skill — write mece_plan.md + T-ID in roadmap FIRST
          direct Edit/Write to harness files without harness_editor = [violation] BC-harness-editor-delegate (CFP-021)
          emit [delegating] harness_editor · T-<N> before any edit begins
          wait for harness_editor [harness-edit-done] before proceeding
Post:   [delegating] emitted · harness_editor completed · [harness-edit-done] received
Enforce: Edit/Write to AGENTS.md/CLAUDE.md/SKILL.md/Implement/ without [delegating] emit = [violation] BC-harness-editor-delegate → revert edit · delegate now
```

## Routing
- §3 done → HALT · wait for explicit user approval (no auto-proceed)
- §5 Execute: ALWAYS delegate harness file edits to `harness_editor` skill — write mece_plan.md + T-ID in roadmap FIRST · do NOT edit AGENTS.md / CLAUDE.md / SKILL.md directly (CFP-021 prevention)
- §5 done → return to `session_manager §3 Step 1` (continue close flow)
- `[harness-doctor-refused]` → return to caller with refusal reason · no changes made

**Sections:**
1. Diagnosis — identify target CFP + prior fix history + current model
2. Harness Audit — grep harness files to locate the structural gap
3. Proposal — draft structural fix · dry-run validate · HALT for approval
4. Approval Gate — wait explicit user confirm · no auto-proceed
5. Execute + Verify — apply fix · update index · confirm detection signal

→ Full step-by-step procedures for each section:
`@.agents/skills/harness/harness_doctor/SKILL_detail.md`

---

## Hard Rules
- Attempt 3 in §1–§2 without confirmed topic match → emit `[doctor-loop] attempt:3 · shifting layer` + HALT.
- Never skip Resume Gate (§1.0). Approved proposal exists = skip §1–§4 directly.
- Delegate ALL harness file edits to `harness_editor`. No direct Edit/Write to AGENTS.md / CLAUDE.md / SKILL.md.
- `recurred_after_fix[]` not empty AND count ≥ 3 after previous fix → structural recurrence. count ≥ 5 → priority=HIGH, no deferral.
- count ≥ 5 → `[doctor-verdict: clean]` is INVALID without writing fix_plan first — update `index_cfp_fix.json` with `approved_proposal` + `status: approved` before emitting any verdict; omitting fix_plan at count ≥ 5 = [violation] Hard Rule · HALT · write proposal · await confirm
- "behavioral, not structural" verdict valid ONLY at count ≤ 2 — count ≥ 3 = systemic by definition; a structural seam gap MUST be identified and proposed (even if small) before emitting [clean]; "behavioral" at count ≥ 3 = [violation] Hard Rule → re-run §2 Harness Audit first

## Tone Guide
Keep:   `[fix-required]` · `[fix-escalated]` · `[harness-proposal]` · `[✓ harness-fix]` · `[doctor-loop]`
Strip:  internal deliberation before checklist · speculative gap assessment before grep confirm
Format: `[signal] Key: value · Key: value` — single line, no prose wrap
Prohibited: "The issue is probably..." (before checklist) · "This should prevent..." (before verify)

## MECE Constraints Block (copy into mece_plan.md for sections using `harness_doctor`)
- Sections 1-2 (Diagnosis + Audit): read-only — no src/ or harness edits
- Section 3 (Proposal): emit [harness-proposal] then HALT · do NOT execute yet
- Section 4 (Approval Gate): wait explicit user confirm · no auto-proceed
- Section 5 (Execute): apply only the approved proposal — no scope creep
- [✓ harness-fix] trace required at completion · update index_cfp_fix.json status

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
