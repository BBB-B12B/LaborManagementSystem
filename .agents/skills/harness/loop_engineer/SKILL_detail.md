# Loop Engineer — Detail

> Full mechanics for the headless roadmap executor. Source spec: `knowledge/loop_engineer_spec.md`.
> SKILL.md is the ≤80-line summary; this file is the operational manual.

---

## The 4 traps this design avoids (spec §1)
1. **Memory amnesia** — each cron trigger is a cold session. Anything not on disk is lost → the plan file is the brain.
2. **Double-claim** — two ticks could grab the same task → the `[/]` lock + atomic flip prevents it.
3. **Runaway spend** — an unattended loop can burn tokens forever → dual odometer + hard caps.
4. **Silent destruction** — no human to catch a bad delete → every danger gate escalates to PR, never auto-yes.

---

## Phase 0 · Preflight Gate (the doorman — `scripts/loop_engineer_preflight.py`)
Runs BEFORE the skill is invoked. Checks, in order, and exits red (skip this tick) on any failure:
1. `.sessions/loop_paused` exists → red ("paused by human").
2. Daily/weekly odometer (loop_token_ledger.json) at/over cap → red ("budget tripped").
3. An existing `[/]` task whose `hb:` is fresh (<25 min) → red ("another run active").
4. An existing `[/]` task whose `hb:` is stale (>25 min) and has no PR → **orphan** → green, but the run's
   first job is to escalate that orphan to a PR and clear the lock.
5. No `[/]` and ≥1 eligible `[ ]` task → green, prints the claim candidate.
6. No eligible task at all → exit 0 with **"P0: no active task"** (the normal idle tick).

Exit codes: `0` always on a clean decision (green OR idle); non-zero ONLY on a real script error.
The cron reads stdout: a "green" line → invoke the skill; "P0: no active task" / "red:" → do nothing.

## Phase 1 · Task Intake
- **Selection** (guard 12): among eligible `[ ]` tasks (carry the §6.2 schema AND `depends_on` met),
  pick by explicit tag **P0 > P1 > P2**; tie-break by **document position** (top-most wins — NOT T-number,
  since new tasks append at the bottom). Blocked-by-depends_on → skip + flag, never execute.
- **Claim**: flip `[ ] → [/]` (the lock) and write `hb:` (heartbeat timestamp) into the plan header.
  This is the single atomic act that says "this task is mine".

## Phase 2 · Tight MECE Plan
- Single-writer: only the orchestrator writes `mece_plan.md`. Build a minimal, verifiable, rollback-safe plan.
- **skeptical_reviewer is MANDATORY** here (not optional as in interactive flow): verdict `go` → Phase 3;
  `revise` → one re-plan (increments reasoning_round); `reject` → STOP + open PR for human review.

## Phase 3 · Guarded Wave Loop (per section)
`REASON → SPAWN → OBSERVE → VERIFY → DECIDE → SCRUTINIZE → RECORD → COMPACT`
- **REASON**: decide the next wave's sub-tasks (increments reasoning_round; reset to 0 on a clean wave pass).
- **SPAWN**: parallel sub-agents via the Workflow tool; mechanical sub-tasks → delegate (Haiku). Sub-agents
  write only to `loop_scratch/` — never to the plan (single-writer).
- **OBSERVE / VERIFY**: collect scratch outputs; run the section's Verify-N exactly.
- **DECIDE**: pass → advance; fail → retry once → still failing → STOP + PR (no third blind attempt, R13).
- **SCRUTINIZE** (guard 11, MANDATORY every wave): the `scrutinize` skill reviews the finished artifact before
  it is recorded. A block here blocks RECORD and close.
- **RECORD**: orchestrator writes section result + updates `[ ]→[X]` for that section in the plan.
- **COMPACT**: between waves, and forcibly at context >150k — compact (NOT stop) to survive long tasks.

## Phase 4 · Atomic Close
- All sections `[X]` AND all Verify-N pass → flip the task `[/] → [X]` (atomic close) + update ledger.
- Any unresolved failure, danger gate, or reviewer reject → open a PR with the diff + reason; leave the
  lock state honest (orphan heartbeat will let the next tick PR it if this run died mid-flight).

---

## Guard-Rail Table (12 · spec §11)
| # | Guard | Stored | Limit | On trip |
|---|---|---|---|---|
| 1 | lock = `[/]` | plan / roadmap | 1 active | trigger exits |
| 2 | orphan heartbeat | `hb:` | 25 min | stale + no PR → PR |
| 3 | action_loop_count | plan header | > 10 | STOP run |
| 4 | reasoning_round (reset on wave pass) | plan header | == 10 | STOP + PR |
| 5 | daily token odometer | loop_token_ledger.json | ≥ 10M today | STOP day + Telegram |
| 5b | weekly token odometer | loop_token_ledger.json | ≥ 100M this week | STOP week + Telegram |
| 6 | context compact | live context | between waves · > 150k | compact (not stop) |
| 7 | single-writer | orchestrator only | — | sub-agents → scratch |
| 8 | scope / out-of-scope | `.scope_baseline` + §4 | files ⊆ declared | revert / PR |
| 9 | R14/R15 gates | domain pack | any match | STOP + PR |
| 10 | skeptical_reviewer | Phase 2 | reject | STOP + PR |
| 11 | scrutinize | every wave (post-verify, pre-record) | per sub-task | block record/close |
| 12 | selection | eligible → P0>P1>P2 → position | depends_on met | skip blocked + flag |

## Escalation (spec §10) — headless = PR, never auto-yes
Any of: danger gate match · reviewer reject · verify fail after 1 retry · reasoning_round==10 · orphan
→ open a PR titled with the T-N + reason, attach the diff/scratch, write `hb:` cleared, STOP the run.
A human reviews the PR; the loop never merges its own escalation.

## Deferred (NOT built in T-294) — required before this skill can actually self-run
- Workflow script (Phase 3 waves) · CronCreate every-10-min entry · `loop_token_ledger.json` schema
- `posttool_track.py` loop-spend tagging · CLAUDE.md headless-danger-gate clause · mece_plan_schema headless note
Until these land, the preflight + skill are a testable blueprint, not a live autonomous loop.

## Reuse map (spec §13 — don't rebuild)
Workflow (waves) · skeptical_reviewer (plan check) · scrutinize (pre-close) · delegate (Haiku mechanical) ·
.scope_baseline (scope) · posttool_track.py (tokens) · PreToolUse hook (phase-gate) · index_sessions.json
(dedup) · Telegram (notify).
