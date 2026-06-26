# CLAUDE.md — Hard Constraints & Gateway

> Read first. Every AI agent, no exceptions.
> Destructive gates + DB stop → **INVARIANTS.md** · Repo structure → **REPO_MAP.md**

## Boot Gate
Boot runs before the first response: if the `[Boot]` trace was not emitted this session → run B1→B2→B3, then respond. If skipped → re-run B1-B3 + emit the trace (recoverable · the UserPromptSubmit hook also reminds).

## Boot (3 tool calls max)
→ Full B1/B2/B3 + compact-restore: **AGENTS.md §Boot Sequence**
Reply: `**[Boot]** Thread: <done|in_progress> · Tasks: <N> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <N>`
After task → write `.sessions/active_thread.md`: `task: · phase: done|in_progress|blocked · next:`

## Per-Turn Routing (every message — before any work)
Run C0→C1→C2→C3. → Full logic + topic switch criteria: **AGENTS.md §Per-Turn Routing**

## Loop Architecture
→ Full Phase 1–3 detail + REACT LOOP: **AGENTS.md §Loop Architecture**

## Phase Transition (enforced by PreToolUse hook)
Before any Edit/Write to `src/`: `gather_complete.md` + `mece_plan.md` must both be dated today (mece has Phase 0-3 blocks + user confirmed). The PreToolUse hook BLOCKS the tool call if either is missing/stale → emit `[phase-gate-blocked]` → run the missing phase. (Boot ≠ Phase 1 · Phase 1 = G1 greps + G2 reads + G3 assess + [✓ gather].)

## Phase 3 Close (sequence)
When all mece_plan.md sections are marked [X]: (0) verify all [X] → (1) Write session_handoff.md (skill_name + CFP_COUNT + task) → (2) Write compact_state.md (dt/sk/sk_h/mece_h/p3/section/step) before /compact + reset LOOP_WEIGHT=0 → (3) /compact → (4) PATH A clear mece_plan.md Phase 1-3 (Phase 0 kept · exact cmd in mece_plan_schema.md §PATH A · CFP-025). → Completion Gate: AGENTS.md §Phase 3.

## R1 · Token Tracking
Two counters: `SESSION_TOTAL` (per-task) · `CHAT_TOTAL` (context window). **Reset SESSION_TOTAL to 0 ONLY on: (1) user-confirmed /compact at an explicit mece compact-checkpoint — PATH B arms `session_reset=armed` in compact_state.md, consumed once at next boot, OR (2) task done + session close (PATH A/C). NEVER reset on stale/leftover compact_state.md or mid-task fresh boot** (CFP-031). CHAT_TOTAL resets on /compact only.
→ Full formulas + JSONL + spike alerts: **Implement/03_config.md §Token Tracking**
Each turn: the **PostToolUse hook (`scripts/posttool_track.py`) auto-accumulates SESSION_TOTAL + CHAT_TOTAL per tool call** — agent does NOT hand-write these (lower bound — tool I/O only). Agent per turn: (1) read [token-state] (2) write JSONL (3) check R3 (4) check spike (5) footer (6) at any mid-turn DECISION point (compact_checkpoint · R3/C0.5 threshold · heavy-tool turn) → grep LIVE `.sessions/session_tokens.md` (hook writes the running total there during the turn · snapshot lags ≤1 turn). → mechanics (provider-aware · hook-owned persist · T-231/T-235 · CFP-028/031/041): **Implement/03_config.md §Token Tracking**

Footer: use [token-state] hook values DIRECTLY (absent → grep session_tokens.md) · agent reads, never hand-writes/fabricates · **lower bound — tool I/O only; real context ≈1.5–2× (trust the client meter for any ceiling/compact call)** · format: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*` · start-of-turn total, lags ≤1 turn (CFP-041) — live mid-turn figure → grep `.sessions/session_tokens.md` · 4-bucket when SESSION_TOTAL >5k: `[sys:Nk tools:Nk hist:Nk out:Nk]`
[compact-reset] emit (T-180 · hard): on ANY post-compact reset (SessionStart:compact hook · C0 plain-text confirm · C0 Q3 stuck-counter guard) the agent MUST surface the line printed by `scripts/compact_reset.py` — `[compact-reset] trigger: <hook|user-confirm> · CHAT_TOTAL→N · LOOP_WEIGHT→0 · SESSION_TOTAL→<0|preserved> · cache: cold`. Every reset is visible to the user — never silent.
→ after footer: if cache_hit_pct < 60% AND cache_read_tokens > 0: emit `[cache-warn] hit%: NN% (target ≥60%) · recommend /compact before next task` · skip = R1 violation

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

## R3 · Session Pause Protocol
→ Full threshold table: **Implement/03_config.md §R3**
Key: PRIMARY trigger = signal-box N/4 (4 drift-proof booleans from the UserPromptSubmit hook · N≥2 → [compact-rec] strong · T-221) — full logic in AGENTS.md C0 Q3. Char-estimate is SECONDARY/backstop only: window-anchored eff (CHAT×1.75) ≥90%·WIN(128k) AND signal-box ≥2 → HALT (hard ceiling · BOTH required · T-261; estimate alone never stops) · CHAT 80-120k / SESSION 60-90k / LOOP_WEIGHT >50 → light [compact-note] (optional · estimate is a lower bound — tool I/O only; subagent pollution removed by T-235 · CFP-041 root-fixed)
Stuck-counter guard (T-180): [compact-STOP] firing with ~same CHAT_TOTAL (±2k) across ≥2 turns = the post-compact counter did NOT reset (CFP-037 · /compact is invisible to the agent), NOT a real ceiling → run `scripts/compact_reset.py` → emit [compact-reset] · do NOT keep nagging. Post-compact reset is provider-aware: claude-code auto via the SessionStart:compact hook · other providers via the C0 plain-text confirm path.

## R4 · Sub-agent Decision
Probe: `find <path> -name "<pat>" | wc -l` → <5 files/<300L: main context · ≥5: spawn sub-agent (≤500 tok)
Spawn: read `spawn_tool` from `detected.md` · platform-unknown → run B4 first
→ Spawn patterns + Phase routing table (~35% cost saving): **AGENTS.md §Sub-agent Rules** · **Implement/03_config.md §R4**
→ Delegate a *confirmed* mechanical MECE section to the low tier (`model_low`) instead of running it in main context → **`delegate` skill** (self-verify + retry-once + escalate · never gated/judgment work).

## R5 · Index-First Lookup (hard)

→ before Read: emit `[pre-read] Target: <symbol> · Line: <N>` · after Read: emit `[post-read] Verdict: relevant|partial|irrelevant` · irrelevant → DROP · before Edit symbol: emit `[pre-edit] Symbol: <name> · used_in: <N> · safe: yes|review` · skip any emit = [violation] R5

## Never-Full-Load (hard — no exceptions)

Never-Full-Load: prohibited files → grep/offset only:
- CLAUDE.md → NEVER re-read · knowledge/index_variables.json / knowledge/index_files.json → grep ONLY
- CODING_FAILURE_PATTERNS.md → grep -c + offset=N limit=30 · docs/master_roadmap.md → grep -n or tail -30
- INVARIANTS.md → on-demand R14/R15 only · error_index.md → grep → ≤40L · index_cfp_fix.json → full ok ≤30 entries
- Full-Read ok: SKILL.md ≤80L · src/ ≤80L · active_thread.md · session_handoff.md · compact_state.md · REPO_MAP.md
→ full Read of prohibited file = [violation] never-full-load → discard → re-run as grep

## R6–R7 · Output + Density
R6: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20` · R7: table/bullet > prose · comparison→table · steps→numbered · enum→bullet
→ R7b reply-style (hard): every reply + work-summary = concise · simple · clear · plain-person tone (talk like a person, not a manual) · technical term allowed ONLY with a simple gloss + everyday analogy (for user learning) · simplicity FIRST, always · no dense jargon · no long ceremony

## R8 · Index Sync
→ after file create/delete/move/symbol-change/session-close: run the matching indexer + emit `[r8-sync-check]` · skip = [violation] R8-index-sync → full event→command map: **Implement/03_config.md §R8**

## R9 · Error Protocol
→ on error / "still broken" / "same error" / same ERR-XXX: Step-0 recurrence check (grep roadmap + `### Failed Approaches:` → `[recurring]`) · pre-debug greps (error_index · index_variables · index_files) · new ERR = `T-{Parent}-{BugID}-{Attempt}` + BC-topic-lookup + BC-active-fix (each `[violation]`-enforced) · **disproof-first (P3 short form):** rank ≥2 hypotheses → disprove the cheapest-to-kill first → log each ruled-out (never re-test a killed one) · hard/looping case → load the `debug` skill (full ledger) → full protocol + signals: **Implement/03_config.md §R9**

## R10–R11 · Tool Cap + English
R10: Truncate at 300 lines · >50L offload → `.sessions/exec_log/<uuid>.txt` · terse signals only
→ Re-insertion rule + Offload detail + Output Contracts: **Implement/03_config.md §R10**
R11: `.sessions/`, `knowledge/`, comments, commits → English only. Thai: user replies only.

## R12 · Post-Edit Verification
→ after Edit/Write: src/ re-read · DB → no ERR-007 · file create/delete → index_files.json · error fix → ERR-XXX + roadmap [X] · step [X] without checks = [violation] R12 → full table: **Implement/03_config.md §R12**

## R13 · Escalation
→ on 2nd failed attempt OR tool error 2× OR R12 fail 2×: HALT · emit `[blocked] Task · Attempts · Cause · Need` · 3rd attempt without [blocked] = [violation] R13 → **Implement/03_config.md §R13**

## R14 · Destructive Action Gates

**Behavior Contract — Destructive Gate (fires before delete/overwrite/batch actions):**
```
Pre:    about to delete/overwrite knowledge/ or .sessions/mece_plan.md · OR any path listed under the active domain pack's `## paths` protected: field (domain/<name>.md) · OR batch >5 files
Contract: MUST emit [gate] signal and HALT — no execution until explicit user confirm received
          emit: [gate] Action: `<what>` · Scope: `<files>` · Risk: `<why>` · Waiting: confirm
Post:   action proceeds ONLY after user types explicit confirmation
Enforce: destructive action without [gate] emit + confirm = [violation] R14 → HALT · re-emit [gate] immediately
```
> Domain-specific protected paths (e.g. coding's `src/`, `src/db/`) live in the active domain pack `## paths`. Core enforces this generic mechanism for ALL projects.

## R15 · Domain Hard-Stop Gate

**Behavior Contract — Domain Gate (fires on any edit that matches a gate in the active domain pack's `## domain_gates`):**
```
Pre:    about to perform an edit whose target matches a gate defined in domain/<active>.md `## domain_gates` (Pre: condition)
Contract: HALT immediately — emit the gate's exact signal (e.g. coding's [db-gate]) and wait for the explicit confirmation word that gate requires
          the FULL Pre/Contract/emit/Post/Enforce contract is written INLINE in the domain pack — read it there and follow verbatim
Post:   edit proceeds ONLY after the user types the explicit confirmation the gate demands (coding pack: explicit "yes" — not "ok"/"continue")
Enforce: a gated edit without its signal + explicit confirm = [violation] R15 → HALT · REVERT · re-emit the gate signal
```
> Core defines this hard-stop MECHANISM for all projects. The concrete trigger + signal + payload (e.g. coding's `src/db/` DB-gate) live INLINE in the active domain pack `## domain_gates` — read that block and enforce it exactly.

## R16 · Self-Improvement (C0 detection)
Signals: "ทำไมไม่ทำตาม" · "you skipped" · "didn't log" · "ลืม" + harness step name → emit `[self-improve] Rule: <R-N> · Missed: <what>` → execute missed step → emit `[✓ backfilled]`
→ **MANDATORY same-response tool call:** Edit `CODING_FAILURE_PATTERNS.md` — `## CFP-<N+1>`: Symptom/Root/Prevention/Detection/topic:<id>/count:0/recurrences:[]
→ After Edit: `grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md` → count = N+1 · emit `[✓ CFP-<N+1>]`

**Doctor Flow** — runs in the same response as `[self-improve]` (the learning loop · backfill if missed):
- BC-A: check index_cfp_fix.json for an approved proposal → found: emit `[resume] CFP-N` → go to BC-E
- BC-B (find existing first — avoid duplicate CFPs): grep index_cfp_fix.json for the symptom → match: `[cfp-match] CFP-N` · else grep cfp_topics.md keywords → topic match: `[keyword-match] topic:<id>` · else AI-judge (≥0.7) · all fail: `[new-topic-proposed]` + ask before creating
- BC-E: append recurrence on the matched entry → count++ → emit `[recurrence-logged]` (count<3) · `[fix-required]` (≥3) · `[fix-escalated]` (≥5)

## R-Roadmap · Log Before Starting
`[ ] T-<N>: desc · [ ]→[/]→[X]` · grep before creating — no dupes · Completion: `[X] T-N: desc (→ERR-XXX) · attempts:N · tool_calls:N`

## Knowledge Base Paths
`knowledge/index_files.json` · `knowledge/index_variables.json` · `error_index.md` · `docs/master_roadmap.md` · `INVARIANTS.md` · `REPO_MAP.md` · `.sessions/session_*.json` · `CODING_FAILURE_PATTERNS.md`

@AGENTS.md
