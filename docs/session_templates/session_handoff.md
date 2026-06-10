# Template: .sessions/session_handoff.md
# Written by: Phase 3 — after each section completes (L5 DECIDE)
#             Completion Gate — final write before reporting done
#             R6 Handoff Protocol (>70k SESSION_TOTAL)
# Read by: Boot B1 (phase: in_progress → load for resume context)
#          Reviewer agent (Completion Gate) — reads sections_done list
#
# Rules:
#   Write after EVERY section completes — not just at end
#   mece_plan_hash: sha1sum .sessions/mece_plan.md | cut -c1-8
#   resume_at: S<N>:step:<last completed step description>
#   Resume staleness gate (V3): compare mece_plan_hash vs sha1sum on boot
# ---
skill_name: <skill_name>
CFP_COUNT: <N>
task: <task description>
sections_done:
  - S1: <section name>
sections_pending:
  - S2: <section name>
last_step: <last completed step description>
mece_plan_hash: <8chars>
resume_at: S<N>:step:<desc>
