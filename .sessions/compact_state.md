dt=2026-06-18 12:00:00
s=0
task=T-200 Cross-project support pickup
cfp=37
sk=coding
sk_h=270807c7
mece_h=none
p1=done
p2=done
p3=in_progress
section=S1-S4 ALL DONE (code complete + verified: tsc pass, greps pass)
step=DEPLOY ISSUE — GET /api/projects/support-options returns 404. Backend NOT redeployed (old Cloud Run revision serving); frontend already on new code (calls getSupportOptions, fallback to getActive works). Code is CORRECT — deploy-only. Resume = confirm backend redeploy of lms-backend (asia-southeast1) picked up new route, then test cross-project pickup. Watch after-sale FAILED_PRECONDITION on first real call (single-field index, likely auto).
resume_at=S-deploy:verify-backend-revision
compact_size=8000
session_reset=none
prefix_hash=8dffc448
