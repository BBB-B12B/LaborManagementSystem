# Template: .sessions/session_tokens.md
# Written by: Boot B1 (reset on fresh start or compact-restore)
#             Completion Gate (final SESSION_TOTAL write)
#             TOKEN PAUSE (mid-task write)
# Read by: Boot B1 · R1 token footer · R3 threshold check
#
# Fields:
#   SESSION_TOTAL — input+output tokens this task (resets each task close)
#   CHAT_TOTAL    — cumulative context window since last /compact (never shrinks until /compact)
#
# Estimation formulas:
#   output_tokens = (thai_chars × 1.7) + (en_chars × 0.3)
#   turn_tokens   = (user_msg_chars × 0.3) + tool_result_tokens + output_tokens
#   SESSION_TOTAL += turn_tokens each turn
#   CHAT_TOTAL    += 1,300 (hooks/turn) + turn_tokens each turn
#
# Thresholds (CLAUDE.md R3):
#   SESSION_TOTAL >60k → TOKEN PAUSE
#   SESSION_TOTAL >80k → /compact immediately
#   CHAT_TOTAL    >120k → warn · >180k → /compact mandatory
# ---
SESSION_TOTAL: 0
CHAT_TOTAL: 0
