# CLAUDE.md — Hard Constraints & Gateway

> Read first. Every AI agent, no exceptions.
> Destructive gates + DB stop → **INVARIANTS.md** · Repo structure → **REPO_MAP.md**

## Boot Gate
Boot runs before the first response: if the `[Boot]` trace was not emitted this session → run B1→B2→B3, then respond. If skipped → re-run B1-B3 + emit the trace (recoverable · the UserPromptSubmit hook also reminds).

## Boot (3 tool calls max)
→ Full B1/B2/B3 + compact-restore: **AGENTS.md §Boot Sequence**
> Harness skills are ALSO native: invoke `/harness-agent:<name>` (generated into `skills/` from `.agents/skills/` — **never hand-edit `skills/`**; edit the source + run `release.py`). `Skill(<bare-name>)` will NOT match a harness skill · detail: AGENTS.md §Boot B3.
Reply: `**[Boot]** Thread: <done|in_progress> · Tasks: <N> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <N>`
After task → write `.sessions/active_thread.md`: `task: · phase: done|in_progress|blocked · next:`

## Per-Turn Routing (every message — before any work)
Run C0→C1→C2→C3. → Full logic + topic switch criteria: **AGENTS.md §Per-Turn Routing**

## Loop Architecture
→ Full Phase 1–3 detail + REACT LOOP: **AGENTS.md §Loop Architecture**

## Phase Transition (enforced by PreToolUse hook)
Before any Edit/Write to `src/`: `gather_complete.md` + `mece_plan.md` must both be dated today (mece has Phase 0-3 blocks + user confirmed). The PreToolUse hook BLOCKS the tool call if either is missing/stale → emit `[phase-gate-blocked]` → run the missing phase. (Boot ≠ Phase 1 · Phase 1 = G1 greps + G2 reads + G3 assess + [✓ gather].)

## Review Gates (auto · T-350 · enforced by `scripts/skill_gate.py` PreToolUse)
Two reviews fire on their own — no manual "review" request — each with a visible signal:
- **Phase 2 end · skeptical_reviewer (MANDATORY)**: the moment mece_plan.md is written, skeptical challenges it → writes `.sessions/.skeptical_ok` (stripped-plan-hash + verdict) → emit `[sr-done] verdict:<go|revise|reject>`. **Gate 3 (skeptical-entry)** HARD-BLOCKS the first real (in-repo, non-`.sessions/`) Phase-3 edit until `.skeptical_ok` matches the current plan → `[skeptical-gate] BLOCKED`.
- **Phase 3 · per-section scrutinize (LIGHT)**: before marking any `- [X] S<N>`, run a light section-scoped scrutinize → append `.sessions/.scrutinize_log` (`S<N>|<stripped-plan-hash>`) → emit `[scrutinized S<N>]` (+ scrutinize's native passes). **Gate 4 (scrutinize)** HARD-BLOCKS the `[X]` mark without a hash-matched proof → `[scrutinize-gate] BLOCKED`. FULL scrutinize still runs once at close (existing skill_gate close-gate 2a/2b).
Proof is tied to the plan's IDENTITY (checkbox-stripped hash): ticking a box keeps proofs valid; a real plan-content change invalidates them → re-review. Fail-open (any error → allow · never bricks the loop). Escape: `HARNESS_SKIP_REVIEW_GATE=1`. Detail: AGENTS.md §Phase 2 M4 + §Phase 3 Execution Loop.

## Phase 3 Close (sequence)
When all mece_plan.md sections are marked [X]: (0) verify all [X] → (1) Write session_handoff.md (skill_name + CFP_COUNT + task) → (2) Write compact_state.md (dt/sk/sk_h/mece_h/p3/section/step) before /compact + reset LOOP_WEIGHT=0 → (3) /compact → (4) PATH A clear mece_plan.md Phase 1-3 (Phase 0 kept · exact cmd in mece_plan_schema.md §PATH A · CFP-025). **Engine/harness change → (5) Propagation Stage: `python3 scripts/release.py <level>` (bump + hook-sync · FIRST) → commit incl. the bump → `git push` (USER) — release.py runs BEFORE the commit so the version bump lands in the same commit; running it after strands the bump uncommitted (T-334) · full block AGENTS.md §Completion Gate · done = propagated, not local-only.** → Completion Gate: AGENTS.md §Phase 3.

## R1 · Token Tracking
Two counters: `SESSION_TOTAL` (per-task) · `CHAT_TOTAL` (context window). **Reset SESSION_TOTAL to 0 ONLY on: (1) user-confirmed /compact at an explicit mece compact-checkpoint — PATH B arms `session_reset=armed` in compact_state.md, consumed once at next boot, OR (2) task done + session close (PATH A/C). NEVER reset on stale/leftover compact_state.md or mid-task fresh boot** (CFP-031). CHAT_TOTAL resets on /compact only.
→ Full formulas + JSONL + spike alerts: **Implement/03_config.md §Token Tracking**
**T-287:** on claude-code/anthropic, CHAT_TOTAL = REAL window-fill read from the session transcript by `scripts/real_context.py` (single source = the client-meter number); the hook char-estimate is the cross-platform FALLBACK only. SESSION_TOTAL stays the per-task estimate.
Each turn: the **PostToolUse hook (`scripts/posttool_track.py`) auto-accumulates SESSION_TOTAL + CHAT_TOTAL per tool call** — agent does NOT hand-write these (lower bound — tool I/O only). Agent per turn: (1) read [token-state] (2) write JSONL (3) check R3 (4) check spike (5) footer (6) at any mid-turn DECISION point (compact_checkpoint · R3/C0.5 threshold · heavy-tool turn) → grep LIVE `.sessions/session_tokens.md` (hook writes the running total there during the turn · snapshot lags ≤1 turn). → mechanics (provider-aware · hook-owned persist · T-231/T-235 · CFP-028/031/041): **Implement/03_config.md §Token Tracking**

Footer: use [token-state] hook values DIRECTLY (absent → grep session_tokens.md) · agent reads, never hand-writes/fabricates · **lower bound — tool I/O only; real context ≈1.5–2× (trust the client meter for any ceiling/compact call)** · format: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*` · start-of-turn total, lags ≤1 turn (CFP-041) — live mid-turn figure → grep `.sessions/session_tokens.md` · 4-bucket when SESSION_TOTAL >5k: `[sys:Nk tools:Nk hist:Nk out:Nk]`
[compact-reset] emit (T-180 · hard): on ANY post-compact reset (SessionStart:compact hook · C0 plain-text confirm · C0 Q3 stuck-counter guard) the agent MUST surface the line printed by `scripts/compact_reset.py` — `[compact-reset] trigger: <hook|user-confirm> · CHAT_TOTAL→N · LOOP_WEIGHT→0 · SESSION_TOTAL→<0|preserved> · cache: cold`. Every reset is visible to the user — never silent.
→ after footer: if cache_hit_pct < 60% AND cache_read_tokens > 0: emit `[cache-warn] hit%: NN% (target ≥60%) · recommend /compact before next task` · skip = R1 violation

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

## R3 · Session Pause Protocol
→ Full threshold table: **Implement/03_config.md §R3**
Key: PRIMARY trigger = signal-box N/4 (4 drift-proof booleans from the UserPromptSubmit hook · N≥2 → [compact-rec] strong · T-221) — full logic in AGENTS.md C0 Q3. Char-estimate is SECONDARY/advisory only and NEVER hard-stops (T-286): even at eff (CHAT×1.75) ≥90%·token_budget(128k) AND signal-box ≥2 → advisory [compact-rec] pointing to the CLIENT METER (real %) — the client meter is the single source for any ceiling/compact decision · token_budget(128k)=per-room spend cap, distinct from context_window(1M) · SESSION >60k → TOKEN PAUSE · 80-90k → strong [compact-rec] (SESSION action table = the single source Implement/03_config.md §R3) · CHAT 80-120k / LOOP_WEIGHT >50 → light [compact-note] (optional · estimate is a lower bound — tool I/O only; subagent pollution removed by T-235 · CFP-041 root-fixed)
Stuck-counter guard (T-180): [compact-STOP] firing with ~same CHAT_TOTAL (±2k) across ≥2 turns = the post-compact counter did NOT reset (CFP-037 · /compact is invisible to the agent), NOT a real ceiling → run `scripts/compact_reset.py` → emit [compact-reset] · do NOT keep nagging. Post-compact reset is provider-aware: claude-code auto via the SessionStart:compact hook · other providers via the C0 plain-text confirm path.

## R4 · Sub-agent Decision
Probe: `find <path> -name "<pat>" | wc -l` → <5 files/<300L: main context · ≥5: spawn sub-agent (≤500 tok)
Spawn: read `spawn_tool` from `detected.md` · platform-unknown → run B4 first
→ Spawn patterns + Phase routing table (~35% cost saving): **AGENTS.md §Sub-agent Rules** · **Implement/03_config.md §R4**
→ Delegate a *confirmed* mechanical MECE section to the low tier (`model_low`) instead of running it in main context → **`delegate` skill** (self-verify + retry-once + escalate · never gated/judgment work).

## R5 · Index-First Lookup (hard)

> **Context-send Standard (PRIMARY · T-344/T-345):** the default way context enters the model is minimized, not full-loaded — (1) **index-first**: `lookup.py` → read only the `read_hint` offset/limit range, never whole files (this rule); (2) **headroom (reactive)**: oversized tool output is auto-flagged by the `headroom_hook.py` PostToolUse nudge + a lossless copy parked, and big Bash commands route through `safe_run.py`; (3) **proactive plan-prep (T-345)**: a MECE-planned task pre-compresses the HEAVY context each section needs into a per-project slice (`scripts/plan_ctx.py`, stored gitignored under `.sessions/plan_ctx/<task>/`) at plan time (M5.5), referenced in the plan by `Context-shrunk:` (the slice to load) + `Context-full: <file>:<line>` (source of truth), loaded via a staleness guard (`[ctx-loaded]`/`[ctx-stale]`) — SELECTIVE (heavy-only, prompt-cache-aware). (1)+(2) are reactive/pull; (3) is proactive/prepared. All ARE the standard for bringing context in — a token-economy default, not an afterthought. **(4) lookup self-tunes (T-364):** lookup.py ranks by `query_hits` — usage counts (capped, positive-only) that the `posttool_track` judge writes when the agent actually READS what lookup pointed to (behavioral confirm, not self-report), stored IN the same `index_files.json` lookup reads (single-source: label from headings, hit from behavior — different facts, one file). Detail: Implement/03_config.md §R5 + §Token Tracking.

→ before Read: emit `[pre-read] Target: <symbol> · Line: <N>` · after Read: emit `[post-read] Verdict: relevant|partial|irrelevant` · irrelevant → DROP · before Edit symbol: emit `[pre-edit] Symbol: <name> · used_in: <N> · safe: yes|review` · skip any emit = [violation] R5
→ indexed file → `python3 scripts/lookup.py <topic|file-path|phrase>` first → `type:label` read_hint → Read that offset/limit range only (T-307) · **plugin-only project (no local `scripts/`) — GENERAL RULE (single source) for EVERY engine-script invocation in this constitution (lookup.py · safe_run.py · compact_reset.py · boot_init.sh · any `scripts/X`): prefix with B1's `[engine-root]` abs path → e.g. `python3 "<ENG>/scripts/lookup.py" …` · self-hosted (local `scripts/` exists) → run as-is** (T-314)
→ **DOCS companion rule (same shape · single source · T-348):** the constitution DETAIL docs — every `Implement/*.md` (03_config.md · 04_skills.md · 06_orchestrator.md · 07_platform.md · …) AND every `docs/session_templates/*.md` (mece_plan_schema.md · …) — are ENGINE files, not project-local. **Plugin-only project (no local `Implement/`) → resolve them from B1's `[engine-root]` `<ENG>` exactly like `scripts/X`: Read `"<ENG>/Implement/03_config.md"`, `"<ENG>/docs/session_templates/mece_plan_schema.md"`, etc. Self-hosted (local `Implement/` exists) → read as-is.** This ONE rule resolves all `Implement/*.md` + `docs/session_templates/*.md` references throughout this constitution — no per-reference path edits, no per-project copies (Model B · central engine · finishes the T-309 rollout).

## Never-Full-Load (hard — no exceptions)

Never-Full-Load: prohibited files → grep/offset only:
- CLAUDE.md → NEVER re-read · knowledge/index_variables.json / knowledge/index_files.json → grep ONLY
- CODING_FAILURE_PATTERNS.md → grep -c + offset=N limit=30 · docs/master_roadmap.md → grep -n or tail -30
- INVARIANTS.md → on-demand R14/R15 only · error_index.md → grep → ≤40L · index_cfp_fix.json → full ok ≤30 entries
- Full-Read ok: SKILL.md ≤80L · src/ ≤80L · active_thread.md · session_handoff.md · compact_state.md · REPO_MAP.md
→ full Read of prohibited file = [violation] never-full-load → discard → re-run as grep
> **Auto-enforced (T-363):** the list above is the hardcoded BELT; the GENERAL rule is now hook-enforced (PreToolUse in settings.json). Reading ANY doc that carries a DOC-MAP nav-map — every `Implement/` + `docs/session_templates/` + `knowledge/` doc >250 lines, auto-stamped by `gen_doc_labels.py` (scope widened to knowledge/ in T-363) — WITHOUT offset/limit HARD-BLOCKS and points to `lookup.py`. So index-first is enforced, not just disciplined (escape: `HARNESS_SKIP_READ_GATE=1`). A changed `knowledge/` long doc auto-regenerates its nav-map at close (index_reconcile).

## R6–R7 · Output + Density
R6: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20` · R7: table/bullet > prose · comparison→table · steps→numbered · enum→bullet
→ R7b reply-style (hard): every reply + work-summary = concise · simple · clear · plain-person tone (talk like a person, not a manual) · technical term allowed ONLY with a simple gloss + everyday analogy (for user learning) · simplicity FIRST, always · no dense jargon · no long ceremony

## R8 · Index Sync
→ after file create/delete/move/symbol-change/session-close: run the matching indexer + emit `[r8-sync-check]` · skip = [violation] R8-index-sync → full event→command map: **Implement/03_config.md §R8**
> **Auto safety-net (T-322):** index_files entries now upsert **per-event** via the `scripts/mutation_sync.py` PostToolUse hook, and the Stop reconciler `scripts/index_reconcile.py` regenerates the heavy graphs (backlink/symbol/code_graph/repo_map) at close — a missed manual sync is caught, not lost, so a plan never needs its own "sync section". The manual `[r8-sync-check]` emit stays the human-visible confirmation; the hook is the backstop.

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
Interactive: (T-342) the gate is HARD here too, not prose-only. A destructive Bash (rm/mv/sed -i/redirect/…) or a full-file overwrite (Write/NotebookEdit) of a protected path BLOCKS (exit 2) until the user's explicit "yes" arms a one-shot, command-bound, TTL'd ack; the retry consumes it and proceeds. **Arm the ack by WRITING the hash the block message prints into `.sessions/.gate_ack`** (a `.sessions/` write is un-gated, so this never deadlocks — the `--ack <cmd>` CLI would re-echo the destructive string and re-trigger the gate, so it is only for non-destructive keys · T-342 scrutinize GAP-1). A surgical Edit is neither delete nor overwrite → it defers to Claude Code's own permission prompt + the phase gate (not ack-walled, so routine plan bookkeeping is unblocked). Escape: HARNESS_SKIP_DANGER_GATE=1.
Headless: if running headless / autonomous-loop (no human in the loop to type confirm) → the gate can NEVER be satisfied by a human "yes" → MUST escalate to a PR / human-review queue and HALT. NEVER auto-confirm its own destructive action (no self-issued "yes"). A blocked headless action waits for out-of-band human review, it does not proceed.
Enforce: destructive action without [gate] emit + confirm = [violation] R14 → HALT · re-emit [gate] immediately · headless self-confirm = [violation] R14-headless → HALT
```
> Domain-specific protected paths (e.g. coding's `src/`, `src/db/`) live in the active domain pack `## paths`. Core enforces this generic mechanism for ALL projects.
> ⚠️ **The `Headless:` clause above is documentation of INTENT, not the enforcing mechanism.** In headless mode a prose rule is soft — the model can still talk itself into "yes". The HARD enforcement point is a follow-up danger-gate **hook** (T-304 · PreToolUse) that blocks the destructive tool call before it runs and routes it to the PR/human queue. As of T-304 this hook is LIVE: `scripts/danger_gate.py` (registered in .claude/settings.json PreToolUse) hard-blocks (exit 2) a destructive/gated call when headless and escalates it to .sessions/review_queue/ + trips .sessions/loop_paused instead of self-confirming. **T-342 extends the SAME hook to interactive mode** (see the `Interactive:` clause): destructive-Bash + overwrite-Write now hard-block until a one-shot command-bound ack is armed — the gate no longer silently passes when a human is present. The phase gate (`scripts/phase_gate.py` + its settings.json inline copy) also now parses Bash write-targets (single-sourced via `danger_gate.bash_write_targets`), so a `sed -i src/x` / `cat > src/x` can no longer skip the phase-order gate; a behavioral parity self-test (`phase_gate.py --self-test`) keeps the two copies identical.

## R15 · Domain Hard-Stop Gate

**Behavior Contract — Domain Gate (fires on any edit that matches a gate in the active domain pack's `## domain_gates`):**
```
Pre:    about to perform an edit whose target matches a gate defined in domain/<active>.md `## domain_gates` (Pre: condition)
Contract: HALT immediately — emit the gate's exact signal (e.g. coding's [db-gate]) and wait for the explicit confirmation word that gate requires
          the FULL Pre/Contract/emit/Post/Enforce contract is written INLINE in the domain pack — read it there and follow verbatim
Post:   edit proceeds ONLY after the user types the explicit confirmation the gate demands (coding pack: explicit "yes" — not "ok"/"continue")
Enforce: a gated edit without its signal + explicit confirm = [violation] R15 → HALT · REVERT · re-emit the gate signal
```
> Headless note: same as R14 — in headless mode a domain hard-stop gate has no human to give the confirmation word → escalate to the PR/human-review queue and HALT, never self-confirm. Hard enforcement (LIVE · T-304) = `scripts/danger_gate.py`, the PreToolUse danger-gate hook that hard-blocks + escalates to the review queue when headless.
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
Every NEW roadmap Task = a full **§6.2 block** (`- [ ] T-N · P0|P1|P2 · depends_on:` + indented `Title:`/`ContextTask:`/`Goal:`/`How-Check:` required; `Out-of-Scope:`/`Relate File:` optional). Free-text one-liners are legacy — old finished ones stay as-is, do NOT write new ones. **Grain:** roadmap holds BIG tasks only (≥3 steps OR complex); MECE sections belong in `mece_plan.md` only — NEVER on the roadmap (mece S2-B registers only the parent §6.2 Task · per-section registration removed in T-300). Small work (<3 steps AND simple) → the standing **Small-Tasks Pool** (T-299), one line + its own How-Check. grep before creating — no dupes · Completion: `[X] T-N · done <date> · attempts:N · tool_calls:N`.
→ full schema + field table + Pool lifecycle: **knowledge/loop_engineer_spec.md §6.2 + §6.5** (single source).

## Knowledge Base Paths
`knowledge/index_files.json` · `knowledge/index_variables.json` · `error_index.md` · `docs/master_roadmap.md` · `INVARIANTS.md` · `REPO_MAP.md` · `.sessions/session_*.json` · `CODING_FAILURE_PATTERNS.md`

@AGENTS.md
