---
name: Token Tracker
description: In-memory token estimation per R1. SESSION_TOTAL read once at Boot, estimated in memory per turn, written to file only at checkpoints.
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
  steps: ["load SESSION_TOTAL at Boot (once)", "estimate in memory each turn", "write at checkpoints only"]
```

---

# Token Tracker

## Trigger
Always-on passive skill. Activated at Boot B1 (load SESSION_TOTAL) and every turn thereafter (estimate + footer). Never explicitly called — runs as part of every response cycle per R1.

## When NOT to Use
- User is asking "how many tokens left?" as a conversational question → answer inline · do not trigger token tracking workflow
- Task is a one-off calculation with no session state → compute and reply · do not write `session_tokens.md`
- SESSION_TOTAL is already accurate (just written this turn) → do not re-compute · skip to footer display
- File `session_tokens.md` doesn't exist and task is read-only → create with `SESSION_TOTAL: 0` inline · do not spawn skill

## Prerequisites
- [ ] `session_tokens.md` readable (file exists)
      → Why: all token math reads from this file — missing = SESSION_TOTAL unknown
      → Missing: create file with `SESSION_TOTAL: 0\nCHAT_TOTAL: <sys_fixed>\n...` · proceed
- [ ] Current turn input + output estimated (not zero)
      → Why: adding 0 to SESSION_TOTAL produces silent undercount
      → Missing: re-run estimation formulas (output: thai×1.7 + en×0.3 · input: msg×0.3 + overhead + tools×0.3)
- [ ] LOOP_WEIGHT current value read from `session_tokens.md`
      → Why: C0.5 check requires fresh LOOP_WEIGHT — cached value may be stale after Agent() spawns
      → Missing: grep `session_tokens.md` for LOOP_WEIGHT field · use that value

## Operating Stance
- Token counts are estimates, not guarantees. Formulas approximate; actual billing may differ — never present estimates as exact charges.
- Write before display. `session_tokens.md` must be written BEFORE the footer is appended — footer reading a stale file is a R1 violation.
- One source of truth. All turns read SESSION_TOTAL from `session_tokens.md` — never carry the count in conversational memory only.
- Thresholds are hard gates, not suggestions. 60-80k → TOKEN PAUSE; >90k → HALT. These are not advisory — act on them immediately when crossed.

## Workflow
Always-on per-turn loop: Boot B1 load 6 counters from `.sessions/session_tokens.md` → each turn estimate input+output → SESSION_TOTAL += turn_tokens · CHAT_TOTAL += hooks_overhead(700) + turn_tokens · TURN_COUNT += 1 → JSONL write `.sessions/token_log.jsonl` → checkpoint write at pause/blocked/gate → R3 threshold check → emit footer.
Full formula and threshold detail: `## Core Model (R1)` and `## Threshold Triggers (R3)` below.

## Output Contract
Every response MUST emit:
- Footer: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*`
  - Values sourced from [token-state] hook ONLY — never estimated/cached (CFP-031)
- JSONL entry → `.sessions/token_log.jsonl` every turn
- Checkpoint write to `.sessions/session_tokens.md` (all 6 fields) at: token pause · blocked halt · completion gate
- R3 threshold check after every write

## Core Model (R1)

Two counters — both in working memory. File I/O only at checkpoints.

**Read at Boot B1 (once):** load SESSION_TOTAL · CHAT_TOTAL · CACHE_READ · CACHE_WRITE · TURN_COUNT · LOOP_WEIGHT from `.sessions/session_tokens.md` (6-field file).
- Fresh session: CHAT_TOTAL = sys_fixed (dynamic — computed, never hardcoded)
- compact-restore (compact_state.md dt=today): CHAT_TOTAL = compact_size + sys_fixed — NOT sys_fixed alone

**Estimate each turn (in memory):**
```
# Step 1 — turn cost
output_tokens    = (thai_chars × 1.7) + (en_chars × 0.3)
turn_tokens      = (user_msg_chars × 0.3) + tool_result_tokens + output_tokens

# Step 2 — SESSION_TOTAL (incremental per-task cost)
SESSION_TOTAL   += turn_tokens

# Step 3 — CHAT_TOTAL (cumulative context window — never shrinks until /compact)
CHAT_TOTAL_n     = CHAT_TOTAL_{n-1} + hooks_overhead + turn_tokens
# hooks_overhead = 700 /turn (deferred-tools list + HARNESS REMINDER)
# Boot fresh: CHAT_TOTAL = sys_fixed = (CLAUDE.md+AGENTS.md chars × 0.3) + 3500 ≈ 11–13k (dynamic)
# compact-restore: CHAT_TOTAL = compact_size + sys_fixed (compact_size = scripts/compute_compact_size.py — retention constant lives there)
# ⚠️ Undercount: true API context ≈ CHAT_TOTAL × 1.5–2× (triangular re-send) — use as lower bound

# Step 4 — LOOP_WEIGHT (tracked by PostToolUse hook — do NOT manually increment)
# Weights: Agent/Workflow/WebFetch/WebSearch = +3 · Write/NotebookEdit/mcp__ = +2 · other = +1
# Thresholds: CHAT>80k → [compact-rec] strong (PRIMARY · recommend + choice) · LOOP_WEIGHT>50 → [compact-rec] light hint (secondary) · hard STOP only at SESSION>90k OR CHAT>120k → [compact-STOP]
# Note: LOOP_WEIGHT>50 is a SECONDARY light hint only (Phase D) — PRIMARY compact trigger is CHAT_TOTAL>80k
# Reset: B1 writes LOOP_WEIGHT: 0 on fresh session AND compact-restore

# Step 5 — TURN_COUNT
TURN_COUNT += 1   # increment each turn · written to session_tokens.md with SESSION_TOTAL
```

**Constants (authoritative — from Implement/03_config.md §R1):**
| Constant | Value | Source |
|---|---|---|
| system_fixed | dynamic ≈ 11–13k (once) | `(CLAUDE.md + AGENTS.md chars × 0.3) + 3500` — computed at B1, NEVER hardcoded |
| hooks_overhead | 700 /turn | deferred-tools list + HARNESS REMINDER — JSONL field name |

**Char multipliers:**
| Content | Multiplier |
|---|---|
| Thai chars | × 1.7 (UTF-8 multi-byte) |
| English chars | × 0.3 (~4 chars/token) |
| Tool results | × 0.3 (same as English) |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

**Write checkpoints:**
- All 6 fields → `.sessions/session_tokens.md`: `SESSION_TOTAL · CHAT_TOTAL · CACHE_READ · CACHE_WRITE · TURN_COUNT · LOOP_WEIGHT`
  - Write SESSION_TOTAL at: TOKEN PAUSE · BLOCKED halt · Completion Gate
  - CHAT_TOTAL persists turn-over-turn (never shrinks until /compact)
  - B1 resets: SESSION_TOTAL=0 · LOOP_WEIGHT=0 · TURN_COUNT=0 on fresh session or compact-restore
- **JSONL every turn:** append to `.sessions/token_log.jsonl`:
  `turn_id · timestamp · task_id · phase · session_total · chat_total · cache_read_tokens · cache_write_tokens · cache_hit_pct · bucket_sys/tools/hist/output · turn_tokens · hooks_overhead=700`
- After write: check cache_hit_pct — if < 60% AND cache_read_tokens > 0 → emit `[cache-warn]`

**Footer every response:** `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*`
· Use [token-state] hook values DIRECTLY — NEVER use estimated/cached values (CFP-031)
· SESSION_TOTAL > 5k: append `[sys:Nk tools:Nk hist:Nk out:Nk]` 4-bucket breakdown

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| 60-80k | TOKEN PAUSE → finish current loop step → save state → ask user |
| 80-90k | /compact immediately → write compact_state.md → run /compact |
| > 90k | HALT immediately → save state → report to user |

## Refusal Contract
Skip file write (emit `[token-skip]`) if:
- Phase is not in_progress at checkpoint (phase: done → already reset by session close)
- SESSION_TOTAL = 0 and no turns have elapsed (nothing to write)

## Hard Rules
- Do NOT audit or diagnose token anomalies — tracking only. Anomaly detection and structural diagnosis → `token_auditor`.
- NEVER hardcode `system_fixed` — always compute `(CLAUDE.md + AGENTS.md chars × 0.3) + 3500` at B1
- NEVER load CHAT_TOTAL from `.sessions/chat_tokens.md` — that file does NOT exist; all 6 counters live in `.sessions/session_tokens.md`
- NEVER use UTF-8 bytes ÷ 3 for Thai — undercounts by up to 1.7×; always use thai_chars × 1.7
- NEVER skip JSONL write — `.sessions/token_log.jsonl` entry required every turn per R1
- NEVER use estimated or cached values in footer — use [token-state] hook values DIRECTLY (CFP-031)
- NEVER manually increment LOOP_WEIGHT — tracked by PostToolUse hook; read from session_tokens.md
- compact-restore: CHAT_TOTAL = compact_size + sys_fixed — do NOT reset to sys_fixed alone when compact_state.md dt=today

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
