# Behavior Contract — Coverage Tracker
last_updated: 2026-06-09 (T-165)
source_of_truth: enumerated via Explore sub-agent + knowledge/behave_test_log.jsonl

## Summary
- **Total formal BCs: 42**  (CLAUDE 6 · AGENTS 4 · skills 32)
- **Tested directly (behave_test_log): 1/42 ≈ 2%**  → BC-06 Doctor Flow (T-164-A)
- Signal-contracts/rules also tested (NOT in the 42-BC set, tracked in §Other): approach-diff · blocked-self-edit · Stage 3.5 ladder

> "Tested" = a row in behave_test_log.jsonl whose target_bc maps to this BC AND verdict=behave-pass.
> Replay the trigger_prompt in that log line to re-run (regression).

## Coverage by source
| Source | BCs | Tested | % |
|---|---|---|---|
| CLAUDE.md | 6 | 1 | 17% |
| AGENTS.md | 4 | 0 | 0% |
| skills (14 files) | 32 | 0 | 0% |
| **Total** | **42** | **1** | **2%** |

## All Behavior Contracts
| id | source | line | BC name | trigger (Pre:) | tested | test_ref | verdict |
|---|---|---|---|---|---|---|---|
| BC-01 | CLAUDE.md | L7 | Boot Gate | before any response | N | - | - |
| BC-02 | CLAUDE.md | L28 | Phase Transition | Edit/Write to src/ path | N | - | - |
| BC-03 | CLAUDE.md | L37 | Phase 3 Close Sequence | all mece sections [X] | N | - | - |
| BC-04 | CLAUDE.md | L111 | Destructive Gate | delete/overwrite src/ or batch >5 | N | - | - |
| BC-05 | CLAUDE.md | L122 | DB Gate | any src/db/ edit or DB-column type change | N | - | - |
| BC-06 | CLAUDE.md | L136 | Doctor Flow | [self-improve] emitted this turn | Y | T-164-A | behave-pass (floor) |
| BC-07 | AGENTS.md | L106 | BC-M5-verify | mece written, about to emit [✓ MECE] | N | - | - |
| BC-08 | AGENTS.md | L118 | BC-mece-compact | [✓ MECE] emitted | N | - | - |
| BC-09 | AGENTS.md | L173 | Token Pause | SESSION_TOTAL >60k during Phase 3 | N | - | - |
| BC-10 | AGENTS.md | L194 | Completion Gate | all mece sections [X] | N | - | - |
| BC-11 | ascii_flow/SKILL.md | L86 | Invoke-Gate | skill edits .md with box diagrams | N | - | - |
| BC-12 | ascii_flow/SKILL.md | L95 | Ascii-Return | diagram written, box-count verified | N | - | - |
| BC-13 | agent/SKILL.md | L57 | Cycle HALT | section returns status: blocked | N | - | - |
| BC-14 | agent/SKILL.md | L195 | Sub-agent Result Gate | sub-agent section complete | N | - | - |
| BC-15 | coder/SKILL.md | L90 | Index-Sync-Gate | files created, about to mark roadmap [X] | N | - | - |
| BC-16 | file_manager/SKILL.md | L66 | Index-Return | file_manager section complete | N | - | - |
| BC-17 | editor/SKILL.md | L146 | Error-Index-Gate | bug fix applied, about to mark [X] | N | - | - |
| BC-18 | editor/SKILL.md | L156 | Symbol-Change-Gate | Edit on named symbol completed | N | - | - |
| BC-19 | harness_editor/SKILL.md | L101 | Docs Close | all Stage 3 edits done | N | - | - |
| BC-20 | harness_doctor/SKILL.md | L64 | Pre-Audit Checklist | at §2 Harness Audit start | N | - | - |
| BC-21 | harness_doctor/SKILL.md | L98 | Fix Record | §5 fix applied and verified | N | - | - |
| BC-22 | harness_doctor/SKILL.md | L111 | Harness-Editor-Delegate | §5 Execute start | N | - | - |
| BC-23 | harness_doctor/SKILL_detail.md | L15 | Resume Check | [self-improve] emitted | N | - | - |
| BC-24 | harness_doctor/SKILL_detail.md | L43 | Keyword Match | [cfp-match] not found, keyword search | N | - | - |
| BC-25 | harness_doctor/SKILL_detail.md | L75 | AI Judge | keyword match returned no result | N | - | - |
| BC-26 | harness_doctor/SKILL_detail.md | L95 | Exhaustion Gate | keyword AND AI judge both failed | N | - | - |
| BC-27 | harness_doctor/SKILL_detail.md | L116 | Count Threshold | count field updated in index_cfp_fix | N | - | - |
| BC-28 | mece/SKILL.md | L118 | mece-fail Halt | [mece-fail] emitted after retry | N | - | - |
| BC-29 | repo_researcher/SKILL.md | L53 | Clone Gate | about to call repo_scout.py | N | - | - |
| BC-30 | repo_researcher/SKILL.md | L64 | Size Routing | repo_scout.py JSON available | N | - | - |
| BC-31 | repo_researcher/SKILL.md | L76 | Output Write | synthesis complete, output ready | N | - | - |
| BC-32 | self_improve/SKILL.md | L104 | Approval Gate | proposal presented, awaiting reply | N | - | - |
| BC-33 | self_improve/SKILL.md | L125 | Cooldown Gate | §4 Step 0, before any file edit | N | - | - |
| BC-34 | self_improve/SKILL_detail.md | L100 | Audit Log Write | §4 Steps 1-4 complete | N | - | - |
| BC-35 | self_improve/SKILL_detail.md | L127 | Pre-Edit Backup | before every Edit in §4 | N | - | - |
| BC-36 | self_improve/SKILL_detail.md | L176 | Hard Rules Enforcement | after every CFP log operation | N | - | - |
| BC-37 | session_manager/SKILL.md | L47 | Handoff Contract Validation | about to write session_handoff.md | N | - | - |
| BC-38 | session_manager/SKILL.md | L118 | Self-Improve Gate | §3 Manual Close triggered | N | - | - |
| BC-39 | session_manager/SKILL.md | L128 | 5-File Completion Gate | Steps 1-5 claimed complete | N | - | - |
| BC-40 | skeptical_reviewer/SKILL.md | L125 | Output-Format | review complete, returning to caller | N | - | - |
| BC-41 | token_auditor/SKILL.md | L90 | Halt Threshold | SESSION_TOTAL >90k | N | - | - |
| BC-42 | variable_manager/SKILL.md | L86 | Symbol-Return | variable_manager section complete | N | - | - |

## Other tested contracts (signal-contracts/rules — outside the 42-BC set)
| target | tested | test_ref | verdict |
|---|---|---|---|
| harness_doctor approach-diff (SKILL.md ~L48) | Y | T-164-B | behave-pass (floor) |
| self_improve [blocked-self-edit] (SKILL.md ~L37) | Y | T-164-C | behave-pass (floor) |
| Stage 3.5 behavioral-verify ladder (harness_editor) | Y | T-162-dogfood(+retest) | behave-fail→behave-pass (floor, post-fix) |

## Next untested high-value targets (suggested order)
1. BC-04 Destructive Gate + BC-05 DB Gate (highest blast-radius → k=3 unanimous per Stage 3.5 step 6)
2. BC-01 Boot Gate (boot-sequence → k=3)
3. BC-10 Completion Gate + BC-03 Phase 3 Close (close-sequence correctness)
4. BC-07/08 MECE gates · BC-09 Token Pause
5. Per-skill gates (BC-11..BC-42) — batch by skill
