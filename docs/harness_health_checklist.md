# Harness Health Checklist
> Diagnostic tool for harness_doctor — run at §2 Harness Audit before emitting [audit-finding].
> Fill every Check-NN → tally Score Summary → identify fail domains → [checklist-score] emit.

## Usage
1. Load this file at start of §2 Harness Audit
2. For each Check-NN: grep/review session transcript or tool call log
3. Mark [ ] pass / [~] partial / [x] fail per check
4. Total score → emit `[checklist-score] total: N/85 · fails: <domains>`
5. Each [x] fail → becomes an [audit-finding] entry

---

## Check-01 · Boot Gate
**Rule:** AGENTS.md §Boot · Boot Gate BC
**Trigger:** Every session start (before any response)

| Signal to Find | Expected | Where to Look |
|---|---|---|
| `[Boot]` trace | emitted as response line 1 | turn 1 response |
| B1 ran | session_tokens.md reset + active_thread.md read | B1 bash output |
| B2 ran | skill matched from manifest | B2 grep output |
| B3 ran | SKILL.md loaded (hash check on compact-restore) | B3 read output |
| Reply format | `**[Boot]** Thread: · Tasks: · Skill: · Sections: · Tokens: · CFP:` | turn 1 line 1 |

**Pass:** All 5 signals present in turn 1
**Fail:** `[Boot]` missing · B1 session_tokens.md not reset · skill=unknown
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-02 · Per-Turn Routing (C0–C3)
**Rule:** AGENTS.md §Per-Turn Routing
**Trigger:** Every message

| Signal to Find | Expected | Where to Look |
|---|---|---|
| C0 complaint check | self-improve triggered on "ลืม"/"you skipped" | response first |
| C0.5 compact check | `[compact-rec]` strong if CHAT>80k (primary) · `[compact-rec]` light if LOOP_WEIGHT>50 (secondary) · `[compact-STOP]` if SESSION>90k/CHAT>120k | response first line |
| C1–C2 routing | active_thread.md read · topic compared | C1/C2 signals |
| Topic switch | `[topic-switch]` + session close + /compact | if different topic |
| No silent skip | C3 close runs when topic changes | C3 signals |

**Pass:** All routing signals present · topic switch handled correctly
**Fail:** No C0.5 check · topic switch without [topic-switch] emit · C3 skipped
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-03 · LOOP_WEIGHT & Token Budget
**Rule:** CLAUDE.md R3 · AGENTS.md §C0.5
**Trigger:** Every turn (hook fires)

| Signal to Find | Expected | Where to Look |
|---|---|---|
| LOOP_WEIGHT read | grep from session_tokens.md | C0.5 step |
| `[compact-rec]` strong at CHAT>80k | emitted as recommendation + user choice (PRIMARY) | response first line |
| `[compact-rec]` light at LOOP_WEIGHT>50 | emitted as secondary call-count hint (optional, no STOP) | response first line |
| `[compact-STOP]` at SESSION>90k OR CHAT>120k | emitted + compact_state written + STOP | response first line |
| TOKEN PAUSE at >60k | finish step → pause → ask continue? | phase 3 mid-section |
| Footer values | match [token-state] hook, never estimated | every response footer |

**Pass:** LOOP_WEIGHT read each turn · thresholds respected · footer accurate
**Fail:** CHAT>80k without [compact-rec] strong · ceiling (90k/120k) without [compact-STOP] · footer estimated not from file · TOKEN PAUSE skipped
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-04 · Phase 1 Info Gather
**Rule:** AGENTS.md §Phase 1 · Phase Transition Gate BC
**Trigger:** Every new task

| Signal to Find | Expected | Where to Look |
|---|---|---|
| G1 scan | all sections scanned in 1 pass | G1 response |
| G2 batch | greps in 1 Bash call · [post-read] verdict per Read | G2 output |
| G3 assess | Verify-N drafted per section | G3 output |
| `[✓ gather]` emitted | explicit signal before Phase 2 | response |
| `gather_complete.md` written | dated today · objective + constraints + affected_files | file check |

**Pass:** All 5 present · gather_complete.md dated today
**Fail:** gather_complete.md missing/stale · [✓ gather] not emitted · G2 multi-call
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-05 · Phase 2 MECE Plan (+ Size Gate)
**Rule:** AGENTS.md §Phase 2 · M5 Write-Before-Present BC · CFP-027
**Trigger:** Every new task

| Signal to Find | Expected | Where to Look |
|---|---|---|
| mece_plan_schema.md read | M5: Read schema BEFORE writing | M5 tool call |
| `gather_complete.md` written BEFORE plan shown | file write before response text | tool call order |
| `mece_plan.md` written BEFORE plan shown | file write before response text | tool call order |
| `[✓ MECE]` emitted | after both files written | response |
| compact_checkpoint inserted | ≥3 sections → checkpoint after ceil(N/2) | mece_plan.md |
| Roadmap T-N entries | `[ ] T-N` added per section | master_roadmap.md |

**Pass:** Both files written before user sees plan · schema read first · [✓ MECE] emitted
**Fail:** Plan shown before files written (CFP-027) · schema not read (CFP-019) · no compact_checkpoint
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-06 · Phase 3 REACT Loop
**Rule:** AGENTS.md §Phase 3
**Trigger:** Every Phase 3 section

| Signal to Find | Expected | Where to Look |
|---|---|---|
| L1 SELECT | next tool stated before calling | response |
| L2 EXECUTE | tool called (R2 ≤5/turn) | tool calls |
| L3 OBSERVE | result verified · unexpected → diagnose | L3 signal |
| L4 VERIFY | grep confirm · Verify-N run | [✓ written] |
| L5 DECIDE | `- [ ] S<N>` → `- [X] S<N>` written in mece_plan.md | file check |
| Section handoff | session_handoff.md written after each section | file check |

**Pass:** L1→L5 per section · [✓ written] before [X] mark · handoff after section
**Fail:** Section marked [X] without [✓ written] · L4 skipped · handoff missing
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-07 · L4.5 PURGE Compliance
**Rule:** AGENTS.md §Phase 3 L4.5 PURGE
**Trigger:** After every tool result

| Signal to Find | Expected | Where to Look |
|---|---|---|
| Bash verify/grep dropped | no raw bash output kept after verdict | context state |
| Irrelevant reads dropped | `[post-read] irrelevant → DROP` emitted | post-read signals |
| Tool results >50L offloaded | `[result-offloaded] path=<file>` emitted | response |
| Only excerpts kept | Read results trimmed to ≤10L in context | response content |

**Pass:** DROP signals present · no raw bash in later turns · offload on >50L
**Fail:** Large tool results kept across turns · irrelevant reads not dropped · no offload signals
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-08 · Phase 3 Close Sequence
**Rule:** AGENTS.md Completion Gate BC · Phase 3 Close Sequence BC
**Trigger:** All mece_plan.md sections marked [X]

| Signal to Find | Expected | Where to Look |
|---|---|---|
| All Verify-N passed | confirmed before close | L4 signals |
| R8 Index Sync done | [✓ written] for index updates | R8 signals |
| Roadmap [X] | T-N marked complete | master_roadmap.md |
| active_thread.md phase:done | written | file check |
| session_handoff.md written | sections_done + mece_plan_hash | file check |
| compact_state.md written | dt/sk/sk_h/mece_h/p3 fields | file check |
| mece_plan.md Phase 1-3 cleared (PATH A) | "status: task-complete" line | mece_plan.md |
| /compact run | after compact_state written | session log |

**Pass:** All 8 steps completed in order
**Fail:** compact_state missing · PATH A not run · active_thread not updated
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-09 · R2 Tool Budget (≤5/turn)
**Rule:** CLAUDE.md R2
**Trigger:** Every turn

| Signal to Find | Expected | Where to Look |
|---|---|---|
| Tool calls per turn | ≤5 | count tool calls in each turn |
| Retry count | max 2× per failed call | retry signals |
| 2nd retry → diagnose | `[diagnose]` or [blocked] emitted | response |
| R13 escalation | `[blocked]` on 2nd attempt same step | R13 signal |

**Pass:** Every turn ≤5 tool calls · retry ≤2× · diagnose on 2nd fail
**Fail:** >5 tool calls/turn · retry >2× without [blocked] · 37 calls in 1 turn (CFP-026 pattern)
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-10 · R5 Index-First Lookup
**Rule:** CLAUDE.md R5 · Index-First Lookup BC
**Trigger:** Before every Read or symbol Edit

| Signal to Find | Expected | Where to Look |
|---|---|---|
| `[pre-read]` before every Read | emitted with Target + Tier + Line | response |
| `[post-read]` after every Read | verdict: relevant/partial/irrelevant | response |
| `[pre-edit]` before every symbol Edit | emitted with Symbol + used_in | response |
| python scripts/lookup.py run first | T0 before T1-T3 | tool call log |
| Irrelevant reads dropped immediately | [post-read] irrelevant → DROP | context |

**Pass:** [pre-read] + [post-read] on every Read · [pre-edit] on symbol edits
**Fail:** Read without [pre-read] · Edit without [pre-edit] · no verdict assigned
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-11 · R6 Bash Filter
**Rule:** CLAUDE.md R6 · AGENTS.md Bash Filter BC
**Trigger:** Any Bash call likely to produce >40L output

| Signal to Find | Expected | Where to Look |
|---|---|---|
| safe_run.py used OR pipe filter | `python3 scripts/safe_run.py` OR `\| grep -iE "error\|warn\|fail" \| tail -20` | bash commands |
| Raw long output absent | no >40L unfiltered bash in response | tool results |
| Build/script/git filtered | npm/python/git commands use filter | tool call review |

**Pass:** All >40L bash commands filtered · no raw dumps in context
**Fail:** Unfiltered bash output kept · npm run output not filtered
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-12 · R8 Index Sync (New File + Backlink)
**Rule:** CLAUDE.md R8 · Index Sync BC
**Trigger:** After every file create/modify/delete/rename

| Signal to Find | Expected | Where to Look |
|---|---|---|
| index_files.json updated | new file entries added | knowledge/index_files.json |
| index_variables.json updated | new symbols added | knowledge/index_variables.json |
| backlink_analyzer.py called | on file create/delete/move | tool calls |
| Backlink 3-tier check | references[] + backlinks[] + related[] before edit | [pre-edit] |
| knowledge_conflict_checker.py | on knowledge/ file modify | tool calls |
| New file detected → sync | NOT silent skip | after each Write |

**Pass:** All new files indexed · backlinks checked before edit · sync scripts called
**Fail:** File created without index entry · backlink check skipped · symbol not in index_variables.json
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-13 · R12 Post-Edit Verify
**Rule:** CLAUDE.md R12 · Post-Edit Verify BC
**Trigger:** After every Edit/Write tool call

| Signal to Find | Expected | Where to Look |
|---|---|---|
| Re-read changed section | Read after Edit (offset/limit) | tool call sequence |
| No broken imports | import check for src/ edits | post-edit grep |
| DB schema check | ERR-007 verify on schema changes | if DB edit |
| [✓ written] emitted | grep confirm before [X] mark | response |
| Error fix → error_index updated | ERR-XXX entry added | error_index.md |

**Pass:** Re-read after every Edit · [✓ written] before section [X] · imports checked
**Fail:** Section marked [X] without [✓ written] · no re-read after Edit · import check skipped
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-14 · R13/R14/R15 Gates
**Rule:** CLAUDE.md R13/R14/R15
**Trigger:** 2nd attempt failure · destructive action · DB edit

| Signal to Find | Expected | Where to Look |
|---|---|---|
| `[blocked]` on 2nd attempt | R13: emitted + HALT + wait user | response |
| `[gate]` before delete/overwrite | R14: emitted + HALT before destructive action | response |
| `[db-gate]` before src/db/ edit | R15: emitted + wait explicit "yes" | response |
| No 3rd attempt without [blocked] | R13: HALT on 2nd fail | attempt count |

**Pass:** All gates fire correctly · no silent destructive actions
**Fail:** 3rd attempt without [blocked] · delete without [gate] · DB edit without [db-gate]
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-15 · Token Tracking Accuracy
**Rule:** CLAUDE.md R1 · Token Footer BC
**Trigger:** Every response footer

| Signal to Find | Expected | Where to Look |
|---|---|---|
| Footer present | every response ends with footer | response end |
| Values from file | [token-state] hook values used · never estimated | hook output match |
| SESSION_TOTAL incremented | each turn adds input+output | session_tokens.md |
| CHAT_TOTAL tracked | cumulative context window | session_tokens.md |
| LOOP_WEIGHT in footer | matches session_tokens.md LOOP_WEIGHT field | footer vs file |
| Spike alert | >5k output response → `⚠️ Response ~NNNk tokens` | response end |

**Pass:** Footer every response · values match hook/file · no hardcoded values
**Fail:** Footer missing · estimated values used (CFP-031) · SESSION_TOTAL not updated
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-16 · CFP Doctor Flow (R16 Self-Improve)
**Rule:** CLAUDE.md R16 · Doctor Flow BC-A→BC-E
**Trigger:** Complaint detected (C0) → [self-improve] emitted

| Signal to Find | Expected | Where to Look |
|---|---|---|
| `[self-improve]` emitted | C0 trigger → emitted SAME response | response |
| BC-A: resume check | index_cfp_fix.json approved check first | BC-A output |
| BC-B STEP 1-4: existing topic search | min 2 keyword greps before new CFP | BC-B output |
| CODING_FAILURE_PATTERNS.md edited | CFP-N+1 added (or recurrence logged) | file check |
| `[recurrence-logged]`/`[fix-required]`/`[fix-escalated]` | one of 3 emitted SAME response | response |
| Optimization log BEFORE self-heal | docs/optimization_logs.md entry first | CFP-036 pattern |

**Pass:** BC-A→BC-E complete same response · log before fix · topic exhaustion search done
**Fail:** [self-improve] without BC-E signal · fix applied before log (CFP-036) · no topic search
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Check-17 · Error Discovery → Improvement Toggle
**Rule:** CLAUDE.md R9 + R16 · AGENTS.md §Phase 3 L3 OBSERVE
**Trigger:** L3 OBSERVE: unexpected result · error in tool output

| Signal to Find | Expected | Where to Look |
|---|---|---|
| Error → error_index.md entry | T-{Parent}-{BugID}-{Attempt} written | knowledge/error_index.md |
| topic: field set | valid topic from error_topics.md | error_index entry |
| Prior approaches checked | grep "Failed Approaches" before re-attempt | R9 step 0 |
| Skill improvement proposed | structural gap found → [harness-proposal] | doctor flow |
| [active-fix] emitted | approach NOT in failed_approaches list | response |
| New file created → backlink + index sync | R8 triggered after new .md/.ts creation | R8 signals |

**Pass:** Every error logged with T-ID + topic · prior approaches read · R8 triggered on new files
**Fail:** Error fixed without error_index entry · same approach retried (no prior check) · new file not indexed
**Score:** [ ] pass (5) / [~] partial (2) / [x] fail (0)

---

## Score Summary

> Fill after completing all checks. Emit as `[checklist-score]` signal.

| Domain | Check | Score |
|---|---|---|
| Boot Gate | Check-01 | /5 |
| Per-Turn Routing | Check-02 | /5 |
| LOOP_WEIGHT / Token Budget | Check-03 | /5 |
| Phase 1 Info Gather | Check-04 | /5 |
| Phase 2 MECE Plan | Check-05 | /5 |
| Phase 3 REACT Loop | Check-06 | /5 |
| L4.5 PURGE | Check-07 | /5 |
| Phase 3 Close Sequence | Check-08 | /5 |
| R2 Tool Budget | Check-09 | /5 |
| R5 Index-First Lookup | Check-10 | /5 |
| R6 Bash Filter | Check-11 | /5 |
| R8 Index Sync | Check-12 | /5 |
| R12 Post-Edit Verify | Check-13 | /5 |
| R13/R14/R15 Gates | Check-14 | /5 |
| Token Tracking Accuracy | Check-15 | /5 |
| CFP Doctor Flow | Check-16 | /5 |
| Error → Improvement Toggle | Check-17 | /5 |
| **TOTAL** | | **/85** |

### Grading
| Score | Grade | Action |
|---|---|---|
| 75–85 | ✅ Healthy | No structural fix needed |
| 60–74 | ⚠️ Degraded | Identify top-3 fails → [fix-required] |
| 45–59 | 🔶 At Risk | harness_doctor §2–§5 full run |
| <45 | 🛑 Critical | Escalate → [fix-escalated] + user notify |

### Weak Domain Report
> List [x] fail domains here for [audit-finding] entries:

```
[checklist-score] total: __/85 · grade: <✅/⚠️/🔶/🛑> · fails: <domain list>
```
