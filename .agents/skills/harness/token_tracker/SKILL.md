---
name: Token Tracker
description: Per-turn token footer per R1. The PostToolUse hook auto-accumulates SESSION_TOTAL + CHAT_TOTAL per tool call; the agent reads the [token-state] values at Boot and each turn and echoes them to the footer — never estimates or hand-adds (CFP-031).
triggers:
  - "track tokens"
  - "count tokens"
  - "session total"
  - "token count"
  - "footer"
  - "update token"
  - "session_tokens.md"
---

## Sections
```
- id: 1
  name: "Track"
  steps: ["load counters at Boot (once)", "read [token-state] each turn", "echo to footer · hook owns the writes"]
```

---

# Token Tracker

## Trigger
Always-on passive skill. Activated at Boot B1 (load SESSION_TOTAL) and every turn thereafter (read [token-state] + footer). The PostToolUse hook (`scripts/posttool_track.py`) auto-accumulates the counters per tool call — the agent does NOT estimate or hand-add. Never explicitly called — runs as part of every response cycle per R1.

## When NOT to Use
- User is asking "how many tokens left?" as a conversational question → answer inline · do not trigger token tracking workflow
- Task is a one-off calculation with no session state → compute and reply · do not write `session_tokens.md`
- SESSION_TOTAL is already accurate (just written this turn) → do not re-compute · skip to footer display
- File `session_tokens.md` doesn't exist and task is read-only → create with `SESSION_TOTAL: 0` inline · do not spawn skill

## Prerequisites
- [ ] `session_tokens.md` readable (file exists)
      → Why: all token math reads from this file — missing = SESSION_TOTAL unknown
      → Missing: create file with `SESSION_TOTAL: 0\nCHAT_TOTAL: <sys_fixed>\n...` · proceed
- [ ] `[token-state]` values available this turn (SESSION · CHAT · LOOP_W from the UserPromptSubmit hook)
      → Why: the PostToolUse hook auto-accumulates the counters per tool call — the agent reads them, never re-estimates (CFP-028/031/041 · T-177)
      → Missing: grep `.sessions/session_tokens.md` for the live values · use those
- [ ] LOOP_WEIGHT current value read from `session_tokens.md`
      → Why: C0.5 check requires fresh LOOP_WEIGHT — cached value may be stale after Agent() spawns
      → Missing: grep `session_tokens.md` for LOOP_WEIGHT field · use that value

## Operating Stance
- Token counts are estimates, not guarantees. Formulas approximate; actual billing may differ — never present estimates as exact charges.
- Write before display. `session_tokens.md` must be written BEFORE the footer is appended — footer reading a stale file is a R1 violation.
- One source of truth. All turns read SESSION_TOTAL from `session_tokens.md` — never carry the count in conversational memory only.
- Thresholds are hard gates, not suggestions — act immediately when crossed. Current thresholds live in `CLAUDE.md §R3` (hard ceiling = SESSION>90k OR CHAT>120k); do not restate them here.

## Workflow
Always-on per-turn loop: Boot B1 loads 6 counters from `.sessions/session_tokens.md` → the PostToolUse hook (`scripts/posttool_track.py`) auto-accumulates SESSION_TOTAL + CHAT_TOTAL + counters per tool call (agent does NOT estimate or hand-add) → each turn the agent READS the `[token-state]` values → JSONL write `.sessions/token_log.jsonl` → checkpoint write at pause/blocked/gate → R3 threshold check → emit footer echoing the `[token-state]` values verbatim.
Full formula and threshold detail: `## Core Model (R1)` and `## Threshold Triggers (R3)` below.

## Output Contract
Every response MUST emit:
- Footer: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*`
  - Values sourced from [token-state] hook ONLY — never estimated/cached (CFP-031)
- JSONL entry → `.sessions/token_log.jsonl` every turn
- Checkpoint write to `.sessions/session_tokens.md` (all 6 fields) at: token pause · blocked halt · completion gate
- R3 threshold check after every write

## Core Model (R1) — single source

The formulas, constants, char-multipliers, CHAT-growth calibration, provider profiles, spike-detection, and tool-result tiers live in ONE place: **`Implement/03_config.md §R1 Token Tracking`**. Do NOT restate them here — a second copy drifts (this skill's old copy was missing the ×1.5 calibration · CFP-041). The agent never runs them by hand: the PostToolUse hook (`scripts/posttool_track.py`) auto-accumulates every counter per tool call; the agent only READS the `[token-state]` values and echoes them (see `## Output Contract` above).

This skill's per-turn job (nothing more): read `[token-state]` → JSONL write → R3 check → footer.
- LOOP_WEIGHT is hook-tracked (never manually increment) — read from `session_tokens.md`.
- Boot B1 loads the 6 counters once; B1 resets SESSION_TOTAL/LOOP_WEIGHT/TURN_COUNT=0 on fresh session or compact-restore (formula + compact-restore CHAT in 03_config §R1).
- Live mid-turn figure (CFP-041): `[token-state]` is a start-of-turn / prior-turn snapshot — for a current number at a decision point, grep `.sessions/session_tokens.md`, not the snapshot.

## Threshold Triggers (R3) — single source

Thresholds live in **`CLAUDE.md §R3`** + **`Implement/03_config.md §C0.5`** — do NOT keep a separate table here:
- PRIMARY = signal-box N/4 (≥2 → `[compact-rec]` strong = a recommendation WITH a choice, not a stop)
- HARD CEILING (only hard stop) = `SESSION>90k OR CHAT>120k` → `[compact-STOP]`
- light hint = `CHAT>80k` or `LOOP_WEIGHT>50` → `[compact-note]` (optional, no block)

(The old 60-80 / 80-90 / >90 SESSION-only table was stale — removed T-244.)

## Refusal Contract
Skip file write (emit `[token-skip]`) if:
- Phase is not in_progress at checkpoint (phase: done → already reset by session close)
- SESSION_TOTAL = 0 and no turns have elapsed (nothing to write)

## Hard Rules
- Do NOT audit or diagnose token anomalies — tracking only. Anomaly detection and structural diagnosis → `token_auditor`.
- NEVER hardcode `system_fixed` — it is computed at B1 (formula in `Implement/03_config.md §R1`)
- NEVER load CHAT_TOTAL from `.sessions/chat_tokens.md` — that file does NOT exist; all 6 counters live in `.sessions/session_tokens.md`
- NEVER use UTF-8 bytes ÷ 3 for Thai — undercounts by up to 1.7× (char multipliers in `Implement/03_config.md §R1`)
- NEVER skip JSONL write — `.sessions/token_log.jsonl` entry required every turn per R1
- NEVER use estimated or cached values in footer — use [token-state] hook values DIRECTLY (CFP-031)
- NEVER manually increment LOOP_WEIGHT — tracked by PostToolUse hook; read from session_tokens.md
- compact-restore: CHAT_TOTAL is recomputed by `scripts/compact_reset.py` (= compact_size + sys_fixed, not sys_fixed alone) — see `Implement/03_config.md §R1`

## Tone Guide
Keep:       `[token-pause]` · `[compact-rec]` · `[compact-STOP]` · `[spike:N]` · `SESSION_TOTAL` values
Strip:      raw formula arithmetic shown in response · "I calculated X by multiplying Y..." explanation prose
Format:     footer = `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*` — exact format, no variation
Prohibited: "estimated tokens" in body text · showing token math inline · "approximately N tokens were used"

## Routing
→ Passive skill — returns to caller immediately after footer append or checkpoint write.
Never initiates tool calls outside of checkpoint writes. Does not block execution.

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
