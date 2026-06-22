# REPO_MAP.md — Repository Structure

> Reference map for all agents. Full-Read permitted (see Never-Full-Load rule).
> Update when adding/removing top-level directories or harness files.

---

## Root Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Hard constraints + boot sequence + R1–R16 rules (never re-read at runtime) |
| `AGENTS.md` | Agent orientation, boot sequence detail, loop architecture, sub-agent rules |
| `INVARIANTS.md` | Destructive gates + DB hard stop + invariants I1–I8 (load on-demand at R14/R15) |
| `REPO_MAP.md` | This file — repo layout reference |
| `CODING_FAILURE_PATTERNS.md` | CFP-005–CFP-021 known agent failure modes (grep only · Read ≤30L per entry) |
| `CLAUDE.th.md` | Thai-language version of CLAUDE.md (reference only) |
| `README.md` | Project overview for humans |
| `Implement.md` | Short pointer to Implement/ directory |

---
| `A22I174860012_attlog โกดังกลาง.dat` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `PHASE0_COMPLETE.md` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `PHASE1.1_COMPLETE.md` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `PHASE1.2-1.3_COMPLETE.md` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `PHASE1.3_COMPLETE.md` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `ScanDataEditDialog.tsx` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `Tast_Wage Calculation system - ข้อมูลพนักงานและสวัสดิการ.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `Tast_Wage Calculation system - ตารางลงงาน.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `add-bom.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `backend_logs.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `backend_logs_2.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `backend_logs_3.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `database-debug.log` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `dc-labor-data-template.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `diff.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `docker-compose.yml` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `docs_list.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `export-implement-plan-v2.md` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `firebase.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `firestore-debug.log` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `fix_imports.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `fix_mui_datefns.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `live_ramintra_data.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `package-lock.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `package.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `scratch_check_reports.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `scratch_check_reports.ts` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `scratch_check_workorders.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `scratch_dump_report.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `section7.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp_layout.tsx` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp_logs.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp_model.ts` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp_navbar.tsx` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `temp_skill.txt` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `template.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `test-upsert.ts` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `test.js` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `users.json` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `wageSchema_old.ts` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `wsl_update_x64.msi` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `ระบบบันทึกจำนวนเเรงงาน - Data Planning.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `ระบบบันทึกจำนวนเเรงงาน - Data Project.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `ระบบบันทึกจำนวนเเรงงาน - Data log.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `ระบบบันทึกจำนวนเเรงงาน - Summary Data log.csv` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `VERSION` | _(TODO: describe — auto-added 2026-06-15 by repo_map_check)_ |
| `output.txt` | _(TODO: describe — auto-added 2026-06-16 by repo_map_check)_ |
| `backend_build.log` | _(TODO: describe — auto-added 2026-06-17 by repo_map_check)_ |
## Directories

<!-- REPO-STRUCTURE:AUTO (generated by repo_map_check.py --sync · do not hand-edit) -->
_Auto-generated structure snapshot — repo_map_check.py --sync (2026-06-22). Do not hand-edit between these markers; curated descriptions live outside._

| Folder | Files | Subfolders |
|---|---|---|
| `./` | 62 | 19 |
| `.agents/` | 1 | 4 |
| `.agents\platform/` | 3 | 0 |
| `.agents\skill-patches/` | 1 | 2 |
| `.agents\skill-patches\applied/` | 1 | 0 |
| `.agents\skill-patches\pending/` | 2 | 0 |
| `.agents\skills/` | 2 | 21 |
| `.agents\skills\agent/` | 2 | 0 |
| `.agents\skills\ascii_flow/` | 2 | 0 |
| `.agents\skills\coder/` | 1 | 0 |
| `.agents\skills\doc_builder/` | 2 | 0 |
| `.agents\skills\editor/` | 2 | 0 |
| `.agents\skills\file_manager/` | 1 | 0 |
| `.agents\skills\harness_doc_auditor/` | 1 | 0 |
| `.agents\skills\harness_doctor/` | 2 | 0 |
| `.agents\skills\harness_editor/` | 2 | 0 |
| `.agents\skills\identity/` | 1 | 0 |
| `.agents\skills\mece/` | 2 | 0 |
| `.agents\skills\project_presenter/` | 2 | 0 |
| `.agents\skills\repo_researcher/` | 1 | 0 |
| `.agents\skills\self_improve/` | 2 | 0 |
| `.agents\skills\session_manager/` | 2 | 0 |
| `.agents\skills\skeptical_reviewer/` | 1 | 0 |
| `.agents\skills\skill_auditor/` | 2 | 0 |
| `.agents\skills\token_auditor/` | 1 | 0 |
| `.agents\skills\token_tracker/` | 1 | 0 |
| `.agents\skills\user-coach/` | 1 | 0 |
| `.agents\skills\variable_manager/` | 1 | 0 |
| `.agents\tools/` | 1 | 0 |
| `.github/` | 0 | 1 |
| `.github\workflows/` | 2 | 0 |
| `.sessions/` | 83 | 1 |
| `.sessions\exec_log/` | 1 | 0 |
| `.specify/` | 0 | 3 |
| `.specify\memory/` | 1 | 0 |
| `.specify\scripts/` | 0 | 1 |
| `.specify\scripts\bash/` | 5 | 0 |
| `.specify\templates/` | 5 | 0 |
| `Codeing_harness_killer-main/` | 0 | 1 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main/` | 7 | 2 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents/` | 0 | 3 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\platform/` | 2 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skill-patches/` | 1 | 2 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skill-patches\applied/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skill-patches\pending/` | 2 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills/` | 2 | 10 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\agent/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\coder/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\editor/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\file_manager/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\identity/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\mece/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\session_manager/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\token_auditor/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\token_tracker/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\.agents\skills\variable_manager/` | 1 | 0 |
| `Codeing_harness_killer-main\Codeing_harness_killer-main\Implement/` | 9 | 0 |
| `Implement/` | 10 | 0 |
| `Speckit/` | 7 | 1 |
| `Speckit\skills/` | 4 | 1 |
| `Speckit\skills\refs/` | 2 | 0 |
| `backend/` | 50 | 4 |
| `backend\dist/` | 16 | 10 |
| `backend\dist\api/` | 0 | 2 |
| `backend\dist\api\middleware/` | 12 | 0 |
| `backend\dist\api\routes/` | 76 | 1 |
| `backend\dist\api\routes\labor/` | 20 | 0 |
| `backend\dist\config/` | 20 | 0 |
| `backend\dist\controllers/` | 24 | 0 |
| `backend\dist\functions/` | 4 | 0 |
| `backend\dist\models/` | 96 | 0 |
| `backend\dist\scratch/` | 16 | 0 |
| `backend\dist\scripts/` | 304 | 0 |
| `backend\dist\services/` | 24 | 11 |
| `backend\dist\services\activity/` | 4 | 0 |
| `backend\dist\services\auth/` | 12 | 0 |
| `backend\dist\services\base/` | 8 | 0 |
| `backend\dist\services\companyHoliday/` | 4 | 0 |
| `backend\dist\services\dailyContractor/` | 4 | 0 |
| `backend\dist\services\dailyReport/` | 4 | 0 |
| `backend\dist\services\external/` | 4 | 0 |
| `backend\dist\services\project/` | 4 | 0 |
| `backend\dist\services\reconciliation/` | 8 | 0 |
| `backend\dist\services\scanData/` | 16 | 0 |
| `backend\dist\services\wage/` | 24 | 0 |
| `backend\dist\types/` | 4 | 0 |
| `backend\dist\utils/` | 12 | 0 |
| `backend\logs/` | 7 | 0 |
| `backend\scripts/` | 24 | 0 |
| `backend\src/` | 4 | 10 |
| `backend\src\api/` | 0 | 2 |
| `backend\src\api\middleware/` | 3 | 0 |
| `backend\src\api\routes/` | 18 | 1 |
| `backend\src\api\routes\labor/` | 4 | 0 |
| `backend\src\config/` | 6 | 0 |
| `backend\src\controllers/` | 6 | 0 |
| `backend\src\functions/` | 1 | 0 |
| `backend\src\models/` | 24 | 0 |
| `backend\src\scratch/` | 4 | 0 |
| `backend\src\scripts/` | 77 | 0 |
| `backend\src\services/` | 6 | 11 |
| `backend\src\services\activity/` | 1 | 0 |
| `backend\src\services\auth/` | 3 | 0 |
| `backend\src\services\base/` | 2 | 0 |
| `backend\src\services\companyHoliday/` | 1 | 0 |
| `backend\src\services\dailyContractor/` | 1 | 0 |
| `backend\src\services\dailyReport/` | 1 | 0 |
| `backend\src\services\external/` | 1 | 0 |
| `backend\src\services\project/` | 1 | 0 |
| `backend\src\services\reconciliation/` | 1 | 0 |
| `backend\src\services\scanData/` | 4 | 0 |
| `backend\src\services\wage/` | 6 | 0 |
| `backend\src\types/` | 1 | 0 |
| `backend\src\utils/` | 3 | 0 |
| `docs/` | 12 | 2 |
| `docs\session_templates/` | 11 | 0 |
| `docs\templates/` | 2 | 0 |
| `domain/` | 2 | 0 |
| `firebase/` | 5 | 0 |
| `frontend/` | 28 | 5 |
| `frontend\docs/` | 3 | 0 |
| `frontend\out/` | 18 | 11 |
| `frontend\out\_next/` | 0 | 2 |
| `frontend\out\_next\0YArKfMYHY8LqixPLy4cw/` | 0 | 0 |
| `frontend\out\_next\static/` | 0 | 3 |
| `frontend\out\_next\static\0YArKfMYHY8LqixPLy4cw/` | 2 | 0 |
| `frontend\out\_next\static\chunks/` | 52 | 1 |
| `frontend\out\_next\static\chunks\pages/` | 16 | 9 |
| `frontend\out\_next\static\chunks\pages\daily-reports/` | 1 | 2 |
| `frontend\out\_next\static\chunks\pages\daily-reports\[id]/` | 2 | 0 |
| `frontend\out\_next\static\chunks\pages\daily-reports\mobile/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\dc-management/` | 1 | 1 |
| `frontend\out\_next\static\chunks\pages\dc-management\[id]/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\management/` | 2 | 0 |
| `frontend\out\_next\static\chunks\pages\member-management/` | 1 | 1 |
| `frontend\out\_next\static\chunks\pages\member-management\[id]/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\overtime/` | 1 | 1 |
| `frontend\out\_next\static\chunks\pages\overtime\[id]/` | 2 | 0 |
| `frontend\out\_next\static\chunks\pages\project-management/` | 1 | 1 |
| `frontend\out\_next\static\chunks\pages\project-management\[id]/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\scan-data-monitoring/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\wage-calculation/` | 1 | 0 |
| `frontend\out\_next\static\chunks\pages\workspace/` | 1 | 0 |
| `frontend\out\_next\static\css/` | 1 | 0 |
| `frontend\out\daily-reports/` | 1 | 2 |
| `frontend\out\daily-reports\[id]/` | 2 | 0 |
| `frontend\out\daily-reports\mobile/` | 1 | 0 |
| `frontend\out\dc-management/` | 1 | 1 |
| `frontend\out\dc-management\[id]/` | 1 | 0 |
| `frontend\out\doc/` | 0 | 1 |
| `frontend\out\doc\manual/` | 11 | 2 |
| `frontend\out\doc\manual\assets/` | 0 | 7 |
| `frontend\out\doc\manual\assets\am/` | 11 | 0 |
| `frontend\out\doc\manual\assets\god/` | 2 | 0 |
| `frontend\out\doc\manual\assets\ld/` | 3 | 0 |
| `frontend\out\doc\manual\assets\oe/` | 4 | 0 |
| `frontend\out\doc\manual\assets\pe/` | 5 | 0 |
| `frontend\out\doc\manual\assets\pm/` | 6 | 0 |
| `frontend\out\doc\manual\assets\se_fm/` | 4 | 0 |
| `frontend\out\doc\manual\data/` | 2 | 0 |
| `frontend\out\management/` | 2 | 0 |
| `frontend\out\member-management/` | 1 | 1 |
| `frontend\out\member-management\[id]/` | 1 | 0 |
| `frontend\out\overtime/` | 1 | 1 |
| `frontend\out\overtime\[id]/` | 2 | 0 |
| `frontend\out\project-management/` | 1 | 1 |
| `frontend\out\project-management\[id]/` | 1 | 0 |
| `frontend\out\scan-data-monitoring/` | 1 | 0 |
| `frontend\out\wage-calculation/` | 1 | 0 |
| `frontend\out\workspace/` | 1 | 0 |
| `frontend\public/` | 4 | 1 |
| `frontend\public\doc/` | 0 | 1 |
| `frontend\public\doc\manual/` | 11 | 2 |
| `frontend\public\doc\manual\assets/` | 0 | 7 |
| `frontend\public\doc\manual\assets\am/` | 11 | 0 |
| `frontend\public\doc\manual\assets\god/` | 2 | 0 |
| `frontend\public\doc\manual\assets\ld/` | 3 | 0 |
| `frontend\public\doc\manual\assets\oe/` | 4 | 0 |
| `frontend\public\doc\manual\assets\pe/` | 5 | 0 |
| `frontend\public\doc\manual\assets\pm/` | 6 | 0 |
| `frontend\public\doc\manual\assets\se_fm/` | 4 | 0 |
| `frontend\public\doc\manual\data/` | 2 | 0 |
| `frontend\scripts/` | 1 | 0 |
| `frontend\src/` | 0 | 16 |
| `frontend\src\components/` | 1 | 7 |
| `frontend\src\components\common/` | 10 | 0 |
| `frontend\src\components\dashboard/` | 1 | 0 |
| `frontend\src\components\forms/` | 11 | 0 |
| `frontend\src\components\layout/` | 4 | 0 |
| `frontend\src\components\scan-data/` | 1 | 0 |
| `frontend\src\components\wage/` | 2 | 0 |
| `frontend\src\components\work-hour-monitoring/` | 5 | 0 |
| `frontend\src\config/` | 2 | 0 |
| `frontend\src\constants/` | 1 | 0 |
| `frontend\src\context/` | 2 | 0 |
| `frontend\src\data/` | 1 | 0 |
| `frontend\src\hooks/` | 5 | 0 |
| `frontend\src\i18n/` | 1 | 1 |
| `frontend\src\i18n\locales/` | 2 | 0 |
| `frontend\src\page-components/` | 0 | 8 |
| `frontend\src\page-components\daily-reports/` | 1 | 2 |
| `frontend\src\page-components\daily-reports\components/` | 4 | 0 |
| `frontend\src\page-components\daily-reports\mobile/` | 1 | 0 |
| `frontend\src\page-components\dc-management/` | 0 | 1 |
| `frontend\src\page-components\dc-management\components/` | 3 | 0 |
| `frontend\src\page-components\login/` | 2 | 0 |
| `frontend\src\page-components\management/` | 0 | 1 |
| `frontend\src\page-components\management\social-security-rules/` | 0 | 1 |
| `frontend\src\page-components\management\social-security-rules\components/` | 1 | 0 |
| `frontend\src\page-components\member-management/` | 0 | 1 |
| `frontend\src\page-components\member-management\components/` | 3 | 0 |
| `frontend\src\page-components\overtime/` | 0 | 1 |
| `frontend\src\page-components\overtime\components/` | 1 | 0 |
| `frontend\src\page-components\project-management/` | 0 | 1 |
| `frontend\src\page-components\project-management\components/` | 3 | 0 |
| `frontend\src\page-components\workspace/` | 0 | 1 |
| `frontend\src\page-components\workspace\components/` | 9 | 0 |
| `frontend\src\pages/` | 3 | 13 |
| `frontend\src\pages\activity-monitor/` | 1 | 0 |
| `frontend\src\pages\daily-reports/` | 2 | 2 |
| `frontend\src\pages\daily-reports\[id]/` | 2 | 0 |
| `frontend\src\pages\daily-reports\mobile/` | 1 | 0 |
| `frontend\src\pages\dc-management/` | 2 | 1 |
| `frontend\src\pages\dc-management\[id]/` | 1 | 0 |
| `frontend\src\pages\login/` | 1 | 0 |
| `frontend\src\pages\management/` | 1 | 2 |
| `frontend\src\pages\management\company-holidays/` | 1 | 0 |
| `frontend\src\pages\management\social-security-rules/` | 1 | 0 |
| `frontend\src\pages\member-management/` | 2 | 1 |
| `frontend\src\pages\member-management\[id]/` | 1 | 0 |
| `frontend\src\pages\overtime/` | 2 | 1 |
| `frontend\src\pages\overtime\[id]/` | 2 | 0 |
| `frontend\src\pages\project-management/` | 2 | 1 |
| `frontend\src\pages\project-management\[id]/` | 1 | 0 |
| `frontend\src\pages\scan-data-monitoring/` | 2 | 0 |
| `frontend\src\pages\unauthorized/` | 1 | 0 |
| `frontend\src\pages\wage-calculation/` | 2 | 0 |
| `frontend\src\pages\work-hour-monitoring/` | 1 | 0 |
| `frontend\src\pages\workspace/` | 2 | 0 |
| `frontend\src\services/` | 16 | 2 |
| `frontend\src\services\api/` | 3 | 0 |
| `frontend\src\services\firebase/` | 1 | 0 |
| `frontend\src\store/` | 6 | 0 |
| `frontend\src\styles/` | 1 | 0 |
| `frontend\src\theme/` | 1 | 0 |
| `frontend\src\types/` | 2 | 0 |
| `frontend\src\utils/` | 6 | 0 |
| `frontend\src\validation/` | 10 | 0 |
| `functions/` | 3 | 2 |
| `functions\lib/` | 2 | 0 |
| `functions\src/` | 1 | 0 |
| `keys/` | 1 | 0 |
| `knowledge/` | 47 | 3 |
| `knowledge\cfp-proposals/` | 1 | 1 |
| `knowledge\cfp-proposals\applied/` | 0 | 0 |
| `knowledge\recipes/` | 2 | 0 |
| `knowledge\research/` | 1 | 0 |
| `scratch/` | 16 | 0 |
| `scripts/` | 35 | 0 |
| `sessions/` | 2 | 0 |
| `specs/` | 0 | 1 |
| `specs\001-labor-daily-report/` | 8 | 2 |
| `specs\001-labor-daily-report\checklists/` | 1 | 0 |
| `specs\001-labor-daily-report\contracts/` | 1 | 0 |
<!-- /REPO-STRUCTURE:AUTO -->


### `.agents/`
Agent configuration and skill library.

```
.agents/
  platform/
    detected.md          ← platform auto-detection (spawn_tool, explore_type, etc.)
    session_protocol.md  ← context window + session boundary rules per provider
  router.md              ← skill routing reference (keyword → skill decision tree)
  tools/
    tool-manifest.json   ← registered tool scripts (choose_tools.py lookup table)
  skill-patches/
    _template.md         ← patch template
    applied/             ← patches already merged into SKILL.md files
    pending/             ← patches queued for next harness_editor task
  skills/
    skill-manifest.json  ← keyword→skill routing table (grep only at B2)
    registry.md          ← skill list + descriptions (one row per skill)
    agent/               ← SKILL.md + SKILL_detail.md: orchestrator / parallel fan-out
    ascii_flow/          ← SKILL.md + SKILL_detail.md: diagram generation
    coder/               ← SKILL.md: TypeScript/Next.js code writing
    editor/              ← SKILL.md + SKILL_detail.md: file editing
    file_manager/        ← SKILL.md: file create/move/delete
    harness_doc_auditor/ ← SKILL.md: audits rule/directive .md (CLAUDE/AGENTS/INVARIANTS/REPO_MAP/Implement) via shared engine
    harness_doctor/      ← SKILL.md + SKILL_detail.md: structural CFP fix agent
    harness_editor/      ← SKILL.md: harness config file editor (CLAUDE.md/AGENTS.md/SKILL.md)
    identity/            ← SKILL.md: project identity / orientation (persona — no behavioral contract)
    mece/                ← SKILL.md + SKILL_detail.md: MECE plan template + phase-checklist format
    self_improve/        ← SKILL.md + SKILL_detail.md: R16 complaint handler + CFP logging
    session_manager/     ← SKILL.md + SKILL_detail.md: session open/close + compact_state write
    skeptical_reviewer/  ← SKILL.md: M4.5 plan scrutiny gate (haiku · read-only)
    token_auditor/       ← SKILL.md: token budget audit
    token_tracker/       ← SKILL.md: session/chat token tracking
    variable_manager/    ← SKILL.md: symbol create/rename/delete
```

> **SKILL_detail.md pattern:** Skills with >80L detail move overflow to `SKILL_detail.md` in the same dir.
> SKILL.md stays ≤200L and ends with `@.agents/skills/<name>/SKILL_detail.md` reference.
> 7 skills currently use this pattern: agent · ascii_flow · editor · harness_doctor · mece · self_improve · session_manager

### `.sessions/`
Runtime session state. All files English-only.

```
.sessions/
  active_thread.md      ← task / phase / next (B1 reads at boot)
  mece_plan.md          ← Phase 0–3 checklist + section plan (written at M5)
  session_handoff.md    ← cross-session resume context (skill + sections + resume_at)
  compact_state.md      ← boot cache (dt/sk/sk_h/mece_h/p3) written before /compact
  gather_complete.md    ← date + task written at [✓ gather] (PreToolUse hook checks)
  self_improve_log.md   ← SI-N entries written by R16 self-improve events (C0 complaint handler)
  session_tokens.md     ← all 6 counters: SESSION_TOTAL / CHAT_TOTAL / CACHE_READ / CACHE_WRITE / TURN_COUNT / LOOP_WEIGHT (CHAT_TOTAL & LOOP_WEIGHT reset at /compact or fresh boot)
  session_context_cache.md ← compact context snapshot written by Stop hook (write_context_cache.sh)
  token_log.jsonl       ← per-turn telemetry log: 1 JSON line per Stop event (T-053)
  cycle_N_<id>.json     ← sub-agent result files (written by each spawned agent)
```

### `knowledge/`
Index files + error log + harness reference docs. Protected zone (I1 gate required for overwrite).

```
knowledge/
  index_files.json           ← file path → exports + backlinks (grep only · never full-read)
  index_variables.json       ← symbol → file + line + type + used_in (grep only)
  index_sessions.json        ← session history + keywords (populated by session_indexer.py)
  index_cfp_fix.json         ← CFP fix tracking keyed by CFP-XXX ID
  topic_registry.json        ← closed tag list for topics[] in index_files.json (R8 index sync)
  skill-index.md             ← skill descriptions index (one entry per skill)
  error_index.md             ← ERR-XXX entries (grep → Read ≤40L only)
  cfp_archive.md             ← archived CFP-001–CFP-004
  harness-file-role-map.md   ← role map for all harness config files
  harness_flow_20260525.md   ← ASCII flow diagram snapshot 2026-05-25
  harness_flow_20260526.md   ← ASCII flow diagram snapshot 2026-05-26 (current)
  behave_test_log.jsonl      ← Stage 3.5 behavioral-verify log + regression suite (T-161)
  cfp-proposals/
    applied/                 ← CFP proposals already merged
    pending/                 ← CFP proposals queued for review
  recipes/
    g0-interview-pattern.md  ← G0 task clarity interview pattern recipe
    reviewer-spawn.md        ← Skeptical Reviewer spawn pattern recipe
  research/                  ← dated research reference docs (read-only · not indexed)
    9arm-skills-*.md         ← skill pattern research
    agent-harness-skill-*.md ← harness skill spec research
    claude-code-*.md         ← Claude Code behavior research
    context-compression-*.md ← context compression strategy research
```

### `docs/`

```
docs/
  master_roadmap.md     ← T-N task ledger (grep -n or tail -30 · never full-read)
  session_templates/    ← canonical templates for bootstrap_sessions.py
    active_thread.md         ← template
    compact_state.md         ← template
    gather_complete.md       ← template
    mece_plan_schema.md      ← template (named _schema to avoid PreToolUse hook trigger)
    self_improve_log.md      ← template
    session_handoff.md       ← template
    session_tokens.md        ← template
```

### `scripts/`
Python automation. Run after symbol/session changes (R8 index sync).

```
scripts/
  lookup.py               ← T0 index-first lookup (R5): python scripts/lookup.py "<keyword>" --json
  symbol_indexer.py       ← regenerates index_variables.json + index_files.json
  session_indexer.py      ← appends to index_sessions.json at session close
  backlink_analyzer.py    ← refreshes related[] 3-tier links in index_files.json (run after R8)
  bootstrap_sessions.py   ← initializes .sessions/ from docs/session_templates/ (--dry-run/--force)
  session_compactor.py    ← pre-commit health gate: validates 8 .sessions/ files + required fields
  token_estimator.py      ← estimates SESSION_TOTAL + CHAT_TOTAL for harness agents
  compact_reset.py        ← T-180 single-source token reset after /compact (CHAT/SESSION/LOOP) + [compact-reset] emit · called by SessionStart:compact hook + C0 confirm
  choose_tools.py         ← keyword search across skill-manifest + tool-manifest
```

### `src/`
Application source code. Currently empty — Next.js app will live here.
Protected: I1 gate for delete/overwrite · I2 hard stop for src/db/ edits.

### `Implement/`
Human-readable implementation guides for bootstrapping the harness on a new project.

```
Implement/
  00_index.md       ← guide index + reading order
  01_overview.md    ← architecture overview
  02_setup.md       ← step-by-step setup checklist
  03_config.md      ← CLAUDE.md + AGENTS.md full config reference
  04_skills.md      ← all SKILL.md specs
  05_scripts.md     ← scripts spec
  06_orchestrator.md ← orchestrator + MECE plan protocol
  07_platform.md    ← platform adapter + session routing
  08_checklist.md   ← verification checklist for implemented harness
```

### `.specify/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `Codeing_harness_killer-main/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `Speckit/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `backend/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `firebase/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `frontend/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `functions/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `keys/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `scratch/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `sessions/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `specs/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `domain/`
_(TODO: describe — auto-added 2026-06-15 by repo_map_check)_

### `.github/`
_(TODO: describe — auto-added 2026-06-16 by repo_map_check)_
