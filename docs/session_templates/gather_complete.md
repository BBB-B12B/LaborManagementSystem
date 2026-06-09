# Template: .sessions/gather_complete.md
# Written by: Phase 1 G3 — after [✓ gather] emitted
# Read by: Phase Transition Gate (PreToolUse hook) — checks date: == today
#          Phase 2 M1 — reads objective + affected_files for plan context
#
# Rules:
#   MUST be written before any Edit/Write to src/
#   MUST include date: YYYY-MM-DD (hook checks this — stale = block)
#   G0 output contract: objective · constraints · affected_files · acceptance_criteria · verification_intent
#
# Phase 1 G3 context_sufficient requires ALL:
#   □ Every section has ≥1 resolved file/symbol
#   □ Every section has draft Verify-N criterion
#   □ No unresolved "?" placeholders
#   □ Spec complete (new feature): goal · constraints · affected files · acceptance criteria · verification plan
# ---
date: YYYY-MM-DD
objective: <what we are achieving — specific and measurable>
constraints:
  - <constraint 1>
  - <constraint 2>
affected_files:
  - <path/to/file.ts>
  - <path/to/file2.ts>
acceptance_criteria:
  - <criterion 1 — testable>
  - <criterion 2 — testable>
verification_intent: <how to confirm done — grep / test command / UI check>
