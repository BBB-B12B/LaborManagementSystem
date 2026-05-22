---
name: Token Tracker
description: In-memory token estimation per R1. SESSION_TOTAL read once at Boot, estimated in memory per turn, written to file only at checkpoints.
---

## Sections
```
- id: 1
  name: "Track"
  steps: ["load SESSION_TOTAL at Boot (once)", "estimate in memory each turn", "write at checkpoints only"]
```

# Token Tracker

## Core Model (R1)

SESSION_TOTAL lives in working memory for the session duration. File I/O only at checkpoints.

**Read:** Once at Boot B1 — load into memory. No further reads this session.

**Estimate each turn (in memory):**
```
Input  = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
Output = (thai_chars × 1.7) + (en_chars × 0.3)
context_overhead: Turn 1 = ~4,000 | subsequent = 200 + (SESSION_TOTAL × 0.08)
```

**Write to `.sessions/session_tokens.md`** ONLY at:
- TOKEN PAUSE (R3 >60k)
- BLOCKED halt
- Completion Gate (task done)

**Footer every response:** `*(Session total: ~NNN tokens)*`

---

## Formulas Reference

| Content | Multiplier | Rationale |
|---|---|---|
| Thai chars | × 1.7 | ~1.5–2.5 tokens/char (UTF-8 multi-byte) |
| English chars | × 0.3 | ~4 chars/token |
| Tool results | × 0.3 | same as English |
| Turn 1 overhead | ~4,000 | CLAUDE.md + skills loaded |
| Subsequent overhead | 200 + (total × 0.08) | conversation history growth |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| > 60k | TOKEN PAUSE → finish current loop step → save state → ask user |
| > 90k | HALT immediately → save state → report to user |

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task
