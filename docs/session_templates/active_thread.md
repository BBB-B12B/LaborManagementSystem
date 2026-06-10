# Template: .sessions/active_thread.md
# Written by: harness at end of every task (after Completion Gate)
# Read by: Boot B1 (phase check) + C1 (task field)
# Reset by: session_manager §3 close sequence
#
# Fields:
#   task  — short description of last completed or current task
#   phase — done | in_progress | blocked
#   next  — next action if any; "none" if done
#
# Rules:
#   phase: done       → Boot starts fresh session, resets SESSION_TOTAL=0
#   phase: in_progress → Boot resumes context from session_handoff.md
#   phase: blocked    → Boot reports blocked state, waits for user
# ---
task: init
phase: done
next: none
