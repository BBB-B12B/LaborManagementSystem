# Template: .sessions/compact_state.md
# Written by: Phase 3 close sequence BEFORE running /compact
#             session_manager TOKEN PAUSE (pre-compact state emit)
# Read by: Boot B1 (compact-restore detection: cs_dt == today?)
#          Boot B2 (parse sk= for skill_name · section= + step= for resume_hint)
#          Boot B3 (parse sk_h + mece_h for hash comparison)
#
# Fields:
#   dt        — date written (YYYY-MM-DD) — B1 compares to today
#   s         — SESSION_TOTAL at time of compact (e.g. 18k)
#   task      — done | in_progress
#   cfp       — CFP_COUNT at time of compact
#   sk        — skill_name (e.g. harness_editor)
#   sk_h      — sha1sum first 8 chars of SKILL.md (skip re-read if match)
#   mece_h    — sha1sum first 8 chars of mece/SKILL.md (skip re-read if match)
#   p1        — Phase 1 status: done | skip
#   p2        — Phase 2 status: done | skip
#   p3        — Phase 3 status: done | in_progress
#   section   — current section: S<N> | none
#   step      — last completed step description | none
#   resume_at — S<N>:step:<desc> | none
#
# Boot B1 compact-restore logic:
#   cs_dt == today → [compact-restore] → parse all fields
#   cs_dt != today → fresh session → reset SESSION_TOTAL=0 + CHAT_TOTAL=0
# ---
dt=YYYY-MM-DD
s=0k
task=done
cfp=0
sk=<skill_name>
sk_h=<8chars>
mece_h=<8chars>
p1=done
p2=done
p3=done
section=none
step=none
resume_at=none
