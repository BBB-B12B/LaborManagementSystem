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

---

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

**Write to `.sessions/session_tokens.md`** at:
- **End of every response** — write updated SESSION_TOTAL so Boot B1 reads the correct value next turn
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
| Tool results | see §Tool Result Measurement | classify by file type first |
| Turn 1 overhead | ~4,000 | CLAUDE.md + skills loaded |
| Subsequent overhead | 200 + (total × 0.08) | conversation history growth |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

---

## Tool Result Measurement

After **every** tool call that returns content, measure and add to SESSION_TOTAL:

**Step 1 — Classify by source:**
| Source | Apply |
|---|---|
| `.md`, `.txt`, `.sessions/*` | Split formula — Thai likely |
| `.ts`, `.js`, `.json`, `.sql` | `total × 0.3` — code is English |
| Bash/grep output | Check for Thai presence → use split if found |

**Step 2 — Calculate:**
- Thai range: U+0E00–U+0E7F
- `tokens = (thai_chars × 1.7) + ((total_chars − thai_chars) × 0.3)`
- No Thai detected → `tokens = total_chars × 0.3`

**Step 3 — Bash char-count pattern** (append to any command with significant output):
```bash
result=$(your_command_here); echo "$result"; \
printf "[chars: total=%s thai=%s]\n" \
  "$(echo "$result" | wc -m)" \
  "$(echo "$result" | grep -oP '[\x{0e00}-\x{0e7f}]' | wc -l 2>/dev/null || echo 0)"
```
Read the `[chars: total=N thai=N]` line → apply Step 2 → add to SESSION_TOTAL → write file.

**Step 4 — Emit trace immediately after every tool call:**
```
[tokens] <source>: <N> chars · <type> → ×<mult> → +<N> | total: ~<running_total>
```
- `<source>` = filename or "Bash output" or "user_msg"
- `<type>` = json · md(en) · md(thai) · bash · sql
- `<mult>` = 0.3 (English/code) or split (Thai present)
- `+<N>` = tokens added this call
- `total` = SESSION_TOTAL after adding this call

Then at end of turn, emit summary before footer:
```
[tokens] turn: input ~NNN · output ~NNN | SESSION_TOTAL: ~NNk
```

---

## Threshold Triggers (R3)

| SESSION_TOTAL | Action |
|---|---|
| > 60k | TOKEN PAUSE → finish current loop step → save state → ask user |
| > 90k | HALT immediately → save state → report to user |
