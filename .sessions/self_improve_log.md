# Template: .sessions/self_improve_log.md
# Written by: self_improve §4 — after each harness improvement applied
# Read by: self_improve §1 — tally new CFPs since last SI-N entry
#          harness_doctor §1 — check deferred_count per CFP
#
# Rules:
#   Entry created per self_improve run (not per CFP — one entry per session)
#   SI-N: sequential ID across all entries (SI-1, SI-2, ...)
#   cfp_fixed: list of CFP-NNN IDs addressed this run
#   deferred: list of CFP-NNN IDs proposed but not applied (deferred_count tracked)
#   If deferred_count for same CFP-N >= 3 across entries → escalate to harness_doctor
#
# Format per entry:
#   ## SI-<N>
#   date: YYYY-MM-DD
#   cfp_fixed: [CFP-NNN, ...]   ← CFPs whose fix was applied this run
#   deferred: [CFP-NNN, ...]    ← CFPs proposed but deferred
#   action: <what was changed in harness>
#   result: <[✓ harness-updated] or [deferred] reason>
# ---
# Self-Improve Log
# Created: YYYY-MM-DD
# Usage: self_improve §1 reads this to tally new CFPs and check deferred patterns
