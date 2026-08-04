---
name: Loop Engineer
description: >
  Headless, cron-triggered roadmap executor. Claims the next pending loop-eligible roadmap task
  by priority (P0>P1>P2 then document position), plans it in mece_plan.md (single-writer),
  executes via guarded sub-agent waves, verifies + scrutinizes, then atomically closes or escalates to a PR.
  Trigger on: cron/preflight-green invocation ONLY — never interactive. Preflight gate (loop_engineer_preflight.py)
  must report an active [/] task before this skill is invoked.
  NOT for: interactive sessions, ticket creation (use ticket_intake), or any task lacking the §6.2 schema.
---

## Sections
```
- id: 1
  name: "Intake & Claim"
  steps: ["preflight green", "select by P0>P1>P2 then position", "depends_on met", "flip [ ]->[/] lock", "write hb"]
- id: 2
  name: "Plan (tight MECE)"
  steps: ["single-writer mece_plan.md", "skeptical_reviewer MANDATORY", "reject -> STOP+PR"]
- id: 3
  name: "Execute waves"
  steps: ["REASON->SPAWN->OBSERVE->VERIFY->DECIDE->SCRUTINIZE->RECORD->COMPACT", "guard-rails every wave"]
- id: 4
  name: "Atomic close"
  steps: ["all Verify-N pass", "flip [/]->[X]", "PR or close", "ledger update"]
```

# Loop Engineer Skill

## Operating Stance
A headless worker. No human is watching this run. Every decision that an interactive skill would ask a
human about — a danger gate, a failing verify, an ambiguous plan — instead **escalates to a Pull Request
and stops.** The loop never auto-confirms a destructive action and never guesses past a blocker.

## When to Invoke
- ONLY from the cron entry after `scripts/loop_engineer_preflight.py` exits green (an active [/] task exists).
- Cold session each trigger — memory is empty; the plan on disk is the only brain (see State Model).

## When NOT to Use
- Any interactive/user-present session → use `harness_editor` or the task's domain skill.
- Creating or prioritising a ticket → use `ticket_intake`.
- A roadmap task missing the §6.2 schema (P0|P1|P2 · ContextTask · Goal · How-Check) → skip + flag, do not execute.

## The 5-Phase Cycle  (full mechanics → SKILL_detail.md)
| Phase | Name | Core action | Exit |
|---|---|---|---|
| 0 | Preflight Gate | budget + lock + heartbeat checks | green → continue · red → exit run |
| 1 | Task Intake | select by priority+position · claim `[ ]→[/]` | task claimed |
| 2 | Tight MECE Plan | single-writer plan · **skeptical_reviewer MANDATORY** | reviewer go → Phase 3 · reject → STOP+PR |
| 3 | Guarded Wave Loop | REASON→SPAWN→OBSERVE→VERIFY→DECIDE→SCRUTINIZE→RECORD→COMPACT | all sections done |
| 4 | Atomic Close | all Verify-N pass → flip `[/]→[X]` · else PR | task closed or PR'd |

## State Model (single-writer)
- `mece_plan.md` IS the brain — only the orchestrator writes it; sub-agents write to `loop_scratch/` only.
- `[/]` = the lock (one active task max). Atomic close flips `[/]→[X]` only when every Verify-N passes.
- Heartbeat `hb:` in the plan header; orphan = hb >25 min with no PR → escalate to PR.
- `reasoning_round` counter resets to 0 on a wave pass; `==10` = forever-loop → STOP+PR.

## Danger Gates (headless = HALT, never auto-yes)
- R14/R15 match (delete/overwrite/DB/domain gate) → **STOP + open PR**, never auto-confirm.
- skeptical_reviewer `reject` → STOP+PR. scrutinize block (every wave) → block record/close.

## Budget (dual odometer · loop_token_ledger.json)
- `LOOP_DAILY_BUDGET` 10M/day under `WEEKLY_TOKEN_LIMIT` 100M/week → trip → STOP + Telegram.
- Context compact (not stop) between waves and at >150k. Manual lever: `.sessions/loop_paused` flag.

## Tools
- Workflow (parallel waves) · skeptical_reviewer · scrutinize · delegate (Haiku for mechanical sub-tasks).
- preflight.py (the doorman) · posttool_track.py (ledger) · index_sessions.json (dedup) · Telegram (notify).

## Hard Rules
1. Single-writer: orchestrator-only writes mece_plan.md. 2. Never auto-confirm a danger gate — PR instead.
3. skeptical_reviewer is MANDATORY at Phase 2, scrutinize MANDATORY every wave. 4. State lives on disk only.
5. One active `[/]` task at a time. 6. Stop on budget trip, orphan, or reasoning_round==10.

→ Full Phase 0-4 mechanics, guard-rail table (12), wave protocol, escalation: **SKILL_detail.md**
