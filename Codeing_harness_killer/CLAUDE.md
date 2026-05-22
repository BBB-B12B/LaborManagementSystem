# CLAUDE.md — Hard Constraints & Gateway

> Read first. Every AI agent, no exceptions. Rules here = hard constraints.
> Destructive-action gates and DB hard stop → see **INVARIANTS.md**.
> Repo structure and protected zones → see **REPO_MAP.md**.

---

## Boot (3 tool calls max)
```
[B1] Bash: (phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); [ "$phase" != "in_progress" ] && printf "SESSION_TOTAL: 0\n" > .sessions/session_tokens.md; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3)
[B2] Read: .agents/skills/skill-manifest.json → match user intent to keywords[] → identify skill_name
[B3] Read: .agents/skills/<skill_name>/SKILL.md → load sections[] and context_files
```
→ B1 auto-resets SESSION_TOTAL to 0 when phase ≠ in_progress (new session guard — runs before read)
→ Load SESSION_TOTAL from B1 into working memory (no further file reads for tokens this session)
→ If SESSION_TOTAL > 60k → warn user immediately before proceeding

[B4] Platform Probe (run only if `.agents/platform/detected.md` has `platform: unknown`):
     → List available tools → match against known platforms (see detected.md Known Platform Mappings)
     → Found match → update detected.md with correct values → proceed
     → No match → emit [platform-unknown] → ask 4 co-development questions (see R4)
     → B4 is skipped if detected.md already has a known platform value

→ Boot ends after B3 (B4 only if platform unknown) — emit Reply line 1 immediately.

Reply line 1 — Boot trace:
```
**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: `<name>` · Sections: <N> · Tokens: ~<N>k
```

After any task → write `.sessions/active_thread.md` (3 lines: task / phase / next).

---

## Trace Formats

Mid-task:
```
**[→ skill]**   Match: `<keyword>` → `<skill>` · Loaded: `<files>`
**[R9]**        Search: `<keyword>` → <ERR-XXX found: applying | not found: new ERR>
**[R8]**        Event: <edit|create|delete> · Running: symbol_indexer.py
**[index]**     Lookup: `<Symbol>` → line <N> · used_in: <N files>
**[tokens]**    Input est: ~NNN · Output est: ~NNN · Running: ~NNk
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

**Same session ≠ same skill.**

---

## Loop Architecture — All Work Runs Through 3 Phases

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**

| Phase | Name | What happens |
|---|---|---|
| 1 | Info Gather Loop | Repeat: identify missing context → R5 index-first → assess → emit [✓ gather] |
| 2 | MECE Plan | Load mece/SKILL.md → build plan (1:1 Skill sections) → define Verify-N per section → user confirms BOTH plan + criteria → roadmap entries → emit [✓ MECE] |
| 3 | Execution Loop | SECTION LOOP → REACT LOOP → write session_handoff.md between sections |

**Phase 2 DoD — define for each section before user confirm (required):**
```
Verify-<N>: `<runnable command>` → expected: <output or condition>
```
Examples: `` `grep -c "export default" src/app/page.tsx` → 1 `` | `` `npm run build` → exit 0 ``

**Phase 3 — Cycle Gate (run BEFORE SECTION LOOP):**
```
Group sections into Cycles based on output→input dependencies:
```
Cycle 1: [SA, SB]   ← no dependencies between them → parallel
Cycle 2: [SC]       ← SC needs output of SA or SB → sequential after Cycle 1
```
Rules:
- Section X depends on Section Y = X needs Y's `cycle_N_Y.json` as input
- All sections in a Cycle spawn in one message (parallel)
- Cycle N+1 only spawns after ALL sections in Cycle N have `status: done`
- Any section `status: blocked` in Cycle N → HALT all subsequent Cycles → BLOCKED flow

Emit before spawning each Cycle:
```
**[cycle N]** Sections <A>+<B> → .sessions/cycle_N_*.json · depends-on: <"none" | "cycle_N-1_*.json">
```

**Phase 3 REACT LOOP — execute per step in this order:**
1. **TOKEN CHECK:** SESSION_TOTAL > 60k? → finish current step → PAUSE (save state · show progress · ask user)
2. **SELECT** tool for current step (R2 budget · R5 index-first)
3. **EXECUTE** → run tool (or spawn sub-agent per R4 Execution pattern)
4. **OBSERVE** → unexpected? diagnose → retry once → still wrong → BLOCKED
5. **VERIFY** → run section's Verify-N → pass? emit `[✓ written]` → section eligible for done : diagnose → retry or BLOCKED
6. **DECIDE** → more steps? emit [loop] · continue : section done → emit [loop] done

**After each SECTION completes → write `.sessions/session_handoff.md`:**
```
sections_done: [S1, S2] · sections_pending: [S3, S4]
current_cycle: N · cycle_results: [.sessions/cycle_N_S1.json, .sessions/cycle_N_S2.json]
last_step: <name> · latest_result: <summary>
```

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
Write to file ONLY at: token pause · blocked halt · completion gate
Emit [tokens] trace · append footer every response: `*(Session total: ~NNN tokens)*`

---

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

---

## R3 · Session Pause
| SESSION_TOTAL | Action |
|---|---|
| >60k | finish current loop step → TOKEN PAUSE |
| >90k | HALT immediately → save state → report to user |

---

## R4 · Sub-agent Decision
Run 1 Bash scope probe before any task.

**Spawn patterns (3 types) — use `<spawn_tool>` from `.agents/platform/detected.md`:**

| Pattern | When | How |
|---|---|---|
| **Explore** | scope ≥ 5 files / ≥ 300 lines | `<spawn_tool>` explore mode (`explore_type` from detected.md) → summary ≤500 tokens → act on summary only |
| **Execution** | single section > 8 steps + isolated output | `<spawn_tool>` execution mode (`execution_type` from detected.md) → pass goal + constraints + output format → receive structured result |
| **Parallel fan-out** | ≥ 2 sections in same Cycle (no dependency) | `<spawn_tool>` parallel mode (`parallel_mode` from detected.md) → each writes `.sessions/cycle_N_<section_id>.json` → read all results → pass as context to next Cycle |

**Examples by platform (from detected.md):**
- Antigravity 2.0: `invoke_subagent` · explore=`"research"` · execution=`"self"` · parallel=`Subagents[]`
- Claude Code: `Agent()` · explore=`subagent_type=Explore` · execution=`subagent_type=task` · parallel=multiple calls

**Hard limits:**
- Max depth: 1 level only — worker agents may NOT spawn further agents
- Sub-agent output: structured (JSON or table) — never prose
- Token budget: sub-agent tokens count toward SESSION_TOTAL (no separate budget)
- Parallel spawn: use `parallel_mode` from detected.md — send all Cycle sections at once (not sequentially)
- Custom types: if platform has `define_tool` in detected.md → use it to register custom agent types for the session

**[platform-unknown] Co-development protocol — when no spawn tool detected:**
```
Q1: Does this platform support spawning sub-agents or parallel workers? (yes / no / partial)
Q2: What tool/command name spawns them? (check platform docs — e.g., invoke_subagent, spawn, Agent...)
Q3: What parameters does it accept? (share JSON schema or doc link)
Q4: Can multiple agents run in parallel in one call, or must they be called sequentially?
→ Based on answers: write .agents/platform/detected.md → proceed with correct tool name
→ If partial support: document what IS possible → adapt patterns to fit
```

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

## R-Roadmap · Log All Work Before Starting

Every task must be in `docs/master_roadmap.md` before execution. grep roadmap before creating — never duplicate task IDs.

| Format | Example |
|---|---|
| `[ ] T-<N>: <description>` | `[ ] T-017: Add export button` |
| `[ ] T-{P}-{B}-{A}: <desc>` | `[ ] T-004-001-01: Fix null crash` |

Update: `[ ]` → `[/]` → `[X]` · After bug fix: append `(→ ERR-XXX)`
Completion: `[X] T-004-001-01: Fix null crash (→ ERR-007) · attempts: 1 · tool_calls: 6`

---

## Knowledge Base (→ see REPO_MAP.md for full structure)
```
knowledge/index_files.json      ← backlinks (check BEFORE every edit)
knowledge/index_variables.json  ← symbols + line numbers (check BEFORE every edit)
knowledge/error_index.md        ← ERR-XXX codes (search FIRST before debug)
docs/master_roadmap.md          ← task checklist
INVARIANTS.md                   ← destructive gates + DB hard stop (I1–I5)
REPO_MAP.md                     ← directory structure + dependency rules
CODING_FAILURE_PATTERNS.md      ← known agent failure modes (CFP-001+)
```

---

## Critical Project-Specific Rules
- **Miniflare D1 (local):** No `onConflictDoNothing()` or multi-row INSERT — silent failures. Use SELECT+filter+single-row-insert. (ERR-007)
- **Edge Runtime:** No Node.js APIs (`bcryptjs`, `setImmediate`, etc.). WebCrypto only.
- **CSV parsing:** Always PapaParse — never `split(",")` or `split("\n")` manually.
