# CLAUDE.md — Hard Constraints & Gateway

> Read first. Every AI agent, no exceptions. Rules here = hard constraints.
> Destructive-action gates and DB hard stop → see **INVARIANTS.md**.
> Repo structure and protected zones → see **REPO_MAP.md**.

---

## Boot (3 tool calls max)
```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill path · no match → default to 'editor' skill
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files into memory
    → If SKILL.md not found: emit [warn: <skill_name>/SKILL.md missing] → fallback to `editor` skill
```
→ B1 always resets SESSION_TOTAL to 0 on every Boot — every new conversation starts fresh regardless of phase
→ Load SESSION_TOTAL from B1 into working memory (no further file reads for tokens this session)
→ If SESSION_TOTAL > 60k → warn user immediately before proceeding
→ B1 also checks mece_plan: `pending=$(grep -cE "^\- \[[ /]\]" .sessions/mece_plan.md 2>/dev/null || echo "0")`
  · pending > 0 + phase=in_progress → emit Reply line 1 FIRST → then skip Phase 1+2 → Phase 3 at first [/] or [ ] section
  · pending > 0 + phase=done → ask user: "มีแผนค้าง <N> sections — ทำต่อ (resume) หรือล้างแผน (clear)?"
→ **After Boot completes: proceed immediately to Phase 1 of the loaded skill for the user's current request. Do NOT wait for another user message.**
  · pending = 0 → normal fresh start
→ B3 "context_files" = note paths in memory ONLY — do NOT read during Boot. Read in Phase 1.
→ Boot ends after B3 — emit Reply line 1 immediately. No extra tool calls.

Reply line 1 — Boot trace (emit verbatim — **[Boot]** bold and `<name>` backtick required):
```
**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: `<name>` · Sections: <N> · Tokens: ~<N>k
```
❌ wrong output: [Boot] Thread: done · Skill: editor
✅ correct output: **[Boot]** Thread: done · Skill: `editor`

After any task → write `.sessions/active_thread.md` (3 lines: task / phase / next).

---

## Trace Formats

Mid-task:
```
**[→ skill]**   Match: `<keyword>` → `<skill>` · Loaded: `<files>`
**[R9]**        Search: `<keyword>` → <ERR-XXX found: applying | not found: new ERR>
**[R8]**        Event: <edit|create|delete> · Running: symbol_indexer.py
**[index]**     Lookup: `<Symbol>` → line <N> · used_in: <N files>
**[tokens]**    <source>: <N> chars · <type> → ×<mult> → +<N> | total: ~<N>    ← emit after EVERY tool call
**[tokens]**    turn: input ~NNN · output ~NNN | SESSION_TOTAL: ~NNk           ← emit once per turn (before footer)
**[MECE]**      ✓ Section <N> done · → Section <N+1> next | ✓ All done · Thread: done
```

Gate-confirmation:
```
**[✓ gather]**  Context sufficient after <N> reads · proceeding to MECE
**[✓ MECE]**    Plan covers <N> sections · user confirmed · roadmap entries added
**[✓ R9]**      3-checks: error_index ✓ · symbol_index ✓ · file_index ✓ → proceeding
**[✓ written]** grep `<key>` in `<file>` → found line <N> ✓
**[loop]**      Section <S>/<N> · step `<name>` → <execute|verify|done>
**[blocked]**   Section <S> `<step>` failed 2× → reason: `<cause>` · waiting for user
**[pause]**     SESSION ~<N>k > 60k · done: <X>/<N> sections · saving state · asking user
**[resume]**    Config reloaded · MECE: <reused|rebuilt> · resuming section <N>
```

---

## Per-Turn Routing (every user message — before any work)

Boot selects a skill for the FIRST task only. Every new user message: extract keywords → match skill-manifest.json → same skill? continue : read new SKILL.md → emit [→ skill].

| Situation | Action |
|---|---|
| User asks to fix a bug (was doing session work) | Re-route → `editor` |
| User says "ปิด session" (was editing code) | Re-route → `session_manager` |
| User asks to create a new file (was debugging) | Re-route → `coder` |
| Same task type | Stay on current skill |

**Dual-skill match (tie-breaking):** If intent matches 2+ skills simultaneously → priority: `session_manager` > `mece` > `editor` > `coder` > others. Load higher-priority skill. Emit `[ambiguous: chose X over Y]` trace.

**Same session ≠ same skill.**

---

## Loop Architecture — All Work Runs Through 3 Phases

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**
**Task boundary:** Per-Turn skill change = new task → Phases 1–2 re-run for the new task. **Before overwriting `.sessions/mece_plan.md`** → save existing to `.sessions/mece_plan_prev.md` first.

| Phase | Name | What happens |
|---|---|---|
| 1 | Info Gather Loop | Repeat: identify missing context → R5 index-first → **run tool → emit `[tokens]` trace** → assess → emit [✓ gather] |
| 2 | MECE Plan | Load mece/SKILL.md → build plan (1:1 Skill sections) → define Verify-N per section → **write `.sessions/mece_plan.md`** (sections + DoD + Est) → user confirms → roadmap entries → emit [✓ MECE] |
| 3 | Execution Loop | SECTION LOOP → REACT LOOP → write session_handoff.md between sections |

**Phase 2 DoD — define for each section before user confirm (required):**
```
Verify-<N>: `<runnable command>` → expected: <output or condition>
```
Examples: `` `grep -c "export default" src/app/page.tsx` → 1 `` | `` `npm run build` → exit 0 ``

**Phase 3 REACT LOOP — execute per step in this order:**
0. **MARK START** → update `.sessions/mece_plan.md`: this section `[ ]` → `[/]` (before first tool call)
1. **TOKEN CHECK:** SESSION_TOTAL > 60k? → finish current step → PAUSE (save state · show progress · ask user)
2. **SELECT** tool for current step (R2 budget · R5 index-first)
3. **EXECUTE** → run tool → **immediately emit `[tokens]` trace** (per R1 format: source · chars · type → ×mult → +N | total: ~N)
4. **OBSERVE** → unexpected? diagnose → retry once → still wrong → BLOCKED
5. **VERIFY** → run section's Verify-N → pass? emit `[✓ written]` → section eligible for done : diagnose → retry or BLOCKED
6. **DECIDE** → more steps? emit [loop] · continue : section done → update `.sessions/mece_plan.md`: `[/]` → `[X]` → emit [loop] done

**After each SECTION completes → write `.sessions/session_handoff.md`:**
```
sections_done: [S1, S2] · sections_pending: [S3, S4]
last_step: <name> · latest_result: <summary>
```

**Token Gate — check BEFORE starting next section:**
| Condition | Action |
|---|---|
| remaining > next_est AND sections pending | Continue — start next section immediately |
| remaining ≤ next_est AND sections pending | Tell user: "open new chat + paste Continuation Prompt from mece_plan.md" |
| no sections pending | Route → `session_manager` close flow |

`remaining = 50k − SESSION_TOTAL` · `next_est` = Est field of next `[ ]` section in mece_plan.md

**At each SECTION boundary — re-check skill:**
Before starting next section: does task type change? → re-route via C1→C2→C3 (Per-Turn Routing).

**BLOCKED:** halt remaining sections → show error + completed + pending → ask user → wait.

**Completion Gate — NOT done until all pass:**
```
□ All N sections executed (tool calls — not described)  □ Writes: [✓ written] grep verified
□ R8 Index Sync done                                    □ Roadmap [X]
□ active_thread.md → phase: done                        □ SESSION_TOTAL written → .sessions/session_tokens.md
```

---

## R1 · Token Tracking

Read session_tokens.md ONCE at Boot (B1) → SESSION_TOTAL in working memory.
```
Input  = (user_msg_chars × 0.3) + context_overhead + (tool_result_chars × 0.3)
Output = (thai_chars × 1.7) + (en_chars × 0.3)
context_overhead: Turn 1 = ~4,000 | subsequent = 200 + (SESSION_TOTAL × 0.08)
```
> ⚠️ **Canonical formula** — registry.md and other files must not define their own token formula. Use these values exclusively.

Write to `.sessions/session_tokens.md` at **end of every response** (so B1 reads correct value next turn).
Also write at: token pause · blocked halt · completion gate.
⚠️ **Exception — session close:** When `session_manager` is actively closing (Step 6 confirm), **skip** the end-of-response R1 write. session_manager's Step 2 already wrote `SESSION_TOTAL: 0` — R1 must not overwrite it.
**After every tool call** — emit per-tool trace immediately. **No bash needed — estimate from visible content:**

| Shorthand estimate | chars |
|---|---|
| ~50 lines code/json | ~1,500 |
| ~100 lines code/json | ~3,000 |
| ~50 lines markdown | ~2,000 |
| ~100 lines markdown | ~4,000 |
| small bash output (<20 lines) | ~600 |

```
[tokens] <source>: ~<N> chars · <type> → ×<mult> → +~<N> | total: ~<N>
```
Examples:
```
[tokens] skill-manifest.json (~200 lines): ~6k chars · json → ×0.3 → +~1,800 | total: ~1,800
[tokens] editor/SKILL.md (~180 lines): ~5k chars · md(en) → ×0.3 → +~1,500 | total: ~3,300
[tokens] Bash output (~15 lines): ~600 chars · no-thai → ×0.3 → +~180 | total: ~3,480
```
Tilde `~` = estimate — **do not skip because exact count is unknown. Approximate is required.**

**End of turn** — emit turn summary then footer:
```
[tokens] turn: input ~3,800 · output ~120 | SESSION_TOTAL: ~3,920
*(Session total: ~3,920 tokens | Input+Output combined)*
```
❌ wrong: (Session total: ~2k tokens)  ← missing asterisks
✅ correct: *(Session total: ~2k tokens)*  ← italic markdown required

---

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

---

## R3 · Session Pause
| SESSION_TOTAL | Action |
|---|---|
| >60k | finish current loop step → TOKEN PAUSE → **load `token_auditor`** |
| >90k | HALT immediately → save state → report to user |

---

## R4 · Sub-agent Decision
Run 1 Bash scope probe before any task.
| Probe Result | Action |
|---|---|
| < 5 files / < 300 lines | Proceed in main context |
| ≥ 5 files / ≥ 300 lines | Spawn `Agent (subagent_type=Explore)` → summary ≤500 tokens |

> Sub-agent prompts must include a brief summary of R1–R13 constraints. Sub-agents do not load CLAUDE.md automatically.

---

## R5 · Index-First Lookup

**Pre-Read Gate — emit BEFORE every Read call:**
```
**[pre-read]** Target: `<symbol>` · Tier: T<1|2|3> · Line: <N> · Will read: offset=<N> limit=60
```
Cannot fill Line? → grep not done yet → run grep first.

**Pre-Edit Gate — emit BEFORE every Edit/Write on a named symbol:**
```
**[pre-edit]** Symbol: `<name>` · index_variables lookup: T1 done · used_in: <N files> · safe to edit: <yes|needs review>
```
→ `grep -A 8 '"SymbolName"' knowledge/index_variables.json` → check `used_in` → review all dependents

**Lookup tiers (stop at first that yields line number):**
- T1: `grep -A 8 '"Symbol"' knowledge/index_variables.json` or `index_files.json`
- T2: `grep -B 2 -A 20 '"Symbol"' knowledge/index_variables.json`
- T3: `grep -n "Symbol" src/path/to/file.ts`

T1 partial match (path found but no line number) → proceed to T2. Still no line? → T3.

**Config files load ONCE at Boot (B1–B3) — never re-read mid-session:**
CLAUDE.md · index_files.json · index_variables.json → in working memory after Boot.
Re-read only after TOKEN PAUSE + resume.

| Prohibited | Required instead |
|---|---|
| Read without offset+limit | grep first → get line N → Read offset=N-5 limit=60 |
| Read >60 lines per call | Split into multiple targeted reads |
| Read knowledge/*.json in full | grep specific key only |
| Re-read CLAUDE.md mid-session | Already in working memory |

---

## R6 · Output Filter
Pipe all Bash: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20`

---

## R7 · Response Density
Table/bullet over prose. Comparison→table · Steps→numbered · Enumeration→bullet.

---

## R8 · Index Sync
| Event | Action |
|---|---|
| Create/delete/move file | Update `knowledge/index_files.json` + backlinks |
| Edit file (add/remove imports) | Update backlinks in `knowledge/index_files.json` |
| Create/delete/rename symbol | Update `knowledge/index_variables.json` + run `python scripts/symbol_indexer.py` |

---

## R9 · Error Protocol

⚠️ MANDATORY 3 checks BEFORE any fix. Skipping = rule violation.

```
Step 1: grep -A 12 '<symptom>' knowledge/error_index.md    → ERR found: apply immediately, STOP
Step 2: grep -A 8 '"FailingSymbol"' knowledge/index_variables.json  → source + used_in
Step 3: grep -A 6 '"failing/file.ts"' knowledge/index_files.json     → backlinks
```
Emit [✓ R9] after all 3.

**New error workflow:**
1. grep roadmap → find parent task ID → assign `T-{Parent}-{BugID}-{AttemptID}`
2. Fix → run `python scripts/symbol_indexer.py`
3. Write ERR-XXX entry → `knowledge/error_index.md`
4. Mark roadmap `[X] (→ ERR-XXX)`

---

## R10 · Tool Result Cap
Truncate at 300 lines. If >300 lines: grep relevant section only.

---

## R11 · English-first Analysis
Reasoning >5 steps → English outline (code block) → Thai summary only.

---

## R12 · Post-Edit Verification

Every write verified before reporting success. Task-specific Verify-N (Phase 2 DoD) takes priority.

| Action | Verify by |
|---|---|
| Edit src/ file | Re-read changed section; check no broken imports |
| Add/remove symbol | Run symbol_indexer.py → confirm in index |
| DB schema change | Confirm no ERR-007 violations |
| Create/delete file | Confirm index_files.json updated + backlinks resolved |
| Error fix | Confirm ERR-XXX written + roadmap [X] |

---

## R13 · Escalation
AttemptID = 02 → STOP. Emit [blocked] → wait for user. Do NOT auto-retry.
```
[blocked] Task: <T-ID> · Attempts: 2 · Cause: <root cause> · Need: <what is missing>
```

---

## R14 · Destructive Action Gate
→ **See INVARIANTS.md §I1** — gate format, trigger table, and required confirm flow.

---

## R15 · DB Structure Hard Stop
→ **See INVARIANTS.md §I2** — hard stop triggers, [db-gate] format, and confirm flow.

---

## R16 · Index Sync Gate
→ **See INVARIANTS.md §I3** — enforces R8 as a formal gate after every file create/move/delete.

## R17 · Symbol Check Gate
→ **See INVARIANTS.md §I4** — enforces R5 pre-edit symbol check as a formal gate.

## R18 · Roadmap Gate
→ **See INVARIANTS.md §I5** — enforces R-Roadmap task logging as a formal gate.

---

## R-Roadmap · Log All Work Before Starting

Every task must be in `docs/master_roadmap.md` before execution. grep roadmap before creating — never duplicate task IDs.

| Format | Example |
|---|---|
| `[ ] T-<N>: <description>` | `[ ] T-017: Add export button` |
| `[ ] T-{P}-{B}-{A}: <desc>` | `[ ] T-004-001-01: Fix null crash` |

Update: `[ ]` → `[/]` → `[X]` · After bug fix: append `(→ ERR-XXX)`
Completion: `[X] T-004-001-01: Fix null crash (→ ERR-007) · attempts: 1 · tool_calls: 6`

---

## R19 · Self-Improvement
_Extension only — runs after Completion Gate. Does NOT modify Boot, Loop, or R1–R18._

**Post-task self-eval** — after all Completion Gate boxes checked, before session_manager close:
| check | pass condition |
|---|---|
| `invariant_ok` | No I1–I5 gate tripped unexpectedly during this task |
| `index_ok` | R8 Index Sync completed without error |
| `new_pattern` | No failure type encountered that is absent from CODING_FAILURE_PATTERNS.md |
| `routing_ok` | Skill used for each section matched skill-manifest.json at the start of that section. Mid-session re-routes via Per-Turn Routing do NOT count as mismatches. |
| `budget_ok` | Tool calls stayed ≤5 per turn throughout this task |

- All pass → no action, proceed to session close
- `new_pattern = true` → trigger CFP Auto-Draft below
- `routing_ok = false` OR `budget_ok = false` → write friction note to `.agents/skill-patches/pending/<skill>-gap-<YYYY-MM-DD>.md` (use `_template.md`), then lower skill score in registry.md by 0.5

**CFP Auto-Draft** (only when `new_pattern = true`):
1. Write draft → `knowledge/cfp-proposals/CFP-draft-YYYY-MM-DD.md` (Symptom / Root cause / Prevention — same format as existing CFPs)
2. At session close → present to user: "พบ failure pattern ใหม่ — ต้องการเพิ่ม CFP ไหม? (y/n)"
3. Confirm → เสนอตัวร่างรายละเอียด (Symptom, Root Cause, และ Correct Resolution) ให้ผู้ใช้ช่วยตรวจสอบความถูกต้องและขอข้อมูลเพิ่มเติม จากนั้นเมื่อได้รับการยืนยันและเห็นชอบจากผู้ใช้แล้ว จึงค่อยเขียนบันทึกเข้าระบบลงไฟล์ `CODING_FAILURE_PATTERNS.md` พร้อมกำหนดรหัส CFP ถัดไป → ย้ายไฟล์ร่างไปที่ `knowledge/cfp-proposals/applied/`
4. Decline → move draft → `knowledge/cfp-proposals/applied/` with `status: declined` in frontmatter

**Reference Docs** — load-on-demand only (never at Boot):
- `knowledge/recipes/<topic>.md` — step-by-step safe procedures for recurring operations. Add when: operation ≥ 2 times + CFP related.
- `TESTING.md` — per-action verification matrix (Next.js + D1 + edge). Load when: task involves API route, DB operation, auth, CSV, or new component. Skip for: typo fixes, config changes, read-only tasks.

**Safety:**
- ห้ามแก้ไขหรือเขียนเพิ่มใน `CODING_FAILURE_PATTERNS.md` โดยตรงเด็ดขาด — ต้องผ่านกระบวนการเสนอตัวร่าง สอบถามความถูกต้อง และรอการยินยอม (User Confirmation) จากผู้ใช้ผ่านแชตก่อนเสมอ (ป้องกันเอเจนต์คาดเดาความถูกต้องของ Resolution เอง)
- ห้าม run R19 self-eval ถ้า Completion Gate ยังไม่ผ่าน
- ห้าม auto-add CFP หากไม่แน่ใจว่าเป็น new pattern — prefer false-negative over false-positive
- If `new_pattern = true` AND (`routing_ok = false` OR `budget_ok = false`): write CFP draft only — skip friction note (CFP is canonical record for that event)

---

## R21 · Correction Event Flag

**Trigger:** Agent issues a correction — apologizes, rewrites output, or acknowledges wrong format/result after user feedback.

**Immediate action** (do not wait for session close):
```bash
printf "- %s | skill: %s | issue: %s\n" \
  "$(date +%Y-%m-%d)" "<current_skill>" "<one-line description of what was wrong>" \
  >> .sessions/cfp_flags.md
```
Emit trace: `[flag] Correction recorded → .sessions/cfp_flags.md`

This fires regardless of whether the session closes normally. session_manager reads this file at Step 0.5.

---

## R20 · Skill Gap Threshold Alert
_Extension of R19. Runs after Boot B3 (outside Boot 3-call cap), before Phase 1 of the first task._

- Count `.md` files in `.agents/skill-patches/pending/` whose filename starts with the resolved skill name
- If count ≥ 2: prepend to first response:
  `"⚠️ Repeated gap in [skill] — [N] pending friction notes. Want to review before proceeding?"`
- Alert only — do NOT block the task; user decides
- Skip: tasks with no pre-determined skill (free exploration, boot phase)

---

## Knowledge Base (→ see REPO_MAP.md for full structure)
```
knowledge/index_files.json           ← backlinks (check BEFORE every edit)
knowledge/index_variables.json       ← symbols + line numbers (check BEFORE every edit)
knowledge/error_index.md             ← ERR-XXX codes (search FIRST before debug)
knowledge/recipes/<topic>.md         ← procedural recipes (load on-demand per R19)
docs/master_roadmap.md               ← task checklist
INVARIANTS.md                        ← destructive gates + DB hard stop (I1–I5)
REPO_MAP.md                          ← directory structure + dependency rules
CODING_FAILURE_PATTERNS.md           ← known agent failure modes (CFP-001+)
TESTING.md                           ← per-action verification matrix (load on-demand per R19)
.agents/skill-patches/pending/       ← friction notes awaiting review (written by R19)
.agents/skill-patches/applied/       ← committed patch notes
```

---

## Critical Project-Specific Rules
- **Miniflare D1 (local):** No `onConflictDoNothing()` or multi-row INSERT — silent failures. Use SELECT+filter+single-row-insert. (ERR-007)
- **Edge Runtime:** No Node.js APIs (`bcryptjs`, `setImmediate`, etc.). WebCrypto only.
- **CSV parsing:** Always PapaParse — never `split(",")` or `split("\n")` manually.
