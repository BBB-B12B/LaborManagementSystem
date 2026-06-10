# Optimization Logs

## Entry 001
Date: 2026-06-04 · Session: T-086
Total tokens: ~12k
Root cause: Check 3 — SKILL.md referenced non-existent script `scripts/file_manager.py`
  - Skill `repo_researcher` BC-output-write said: `python3 scripts/file_manager.py`
  - Reality: `file_manager` is an agent SKILL, not a Python script
  - Correct alternatives: `file_manager` skill (agent) OR `scripts/backfill_knowledge_index.py`
Rule injected: BC-output-write in `.agents/skills/repo_researcher/SKILL.md` updated — removed wrong script ref, added correct alternatives
Audit check: Check 3 (Low-Overhead Tooling / wrong tool reference)
Fix verified: grep "file_manager.py" SKILL.md → 0 matches ✅


---
## Entry 002
Date: 2026-06-04
Task: T-087 (post-close)
CFP: CFP-037 (new)
Symptom: Phase 3 close sequence ran without user requesting /compact — compact_state.md written + mece_plan.md PATH A cleared + active_thread.md phase:done set autonomously after all sections [X]
Root: Completion Gate BC says "run /compact — ALWAYS" but trigger must come from user OR threshold (SESSION>80k / LW>50). Neither threshold was met. AI misread ALWAYS as auto-trigger on task complete.
Impact: mece_plan.md prematurely cleared · compact_state.md written early · user lost ability to continue work in same session context
Fix needed: Completion Gate must gate on: user /compact request OR SESSION>80k OR LW>50 — never auto on task-complete alone
Audit check: Completion Gate BC (AGENTS.md §Phase 3 Close)

## 2026-06-04 · harness_doctor P1–P5 · T-090 post-audit
Score: 49/85 🔶 · Findings: F1(CFP-019/027) F2(CFP-037) F3(CFP-034) F4(R8) F5(CFP-033)
Proposed fixes: P1=BC-M5-verify · P2=close-gate-check · P3=pre-read-L1 · P4=r8-sync-checklist · P5=L4.5-signal
Files: AGENTS.md · mece_plan_schema.md · index_cfp_fix.json
