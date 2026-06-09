# Agent Orientation — Asset Plan · ALL agents
> Next.js: read `node_modules/next/dist/docs/` first — conventions may differ from training data.
> Constraints → `CLAUDE.md` · Gates → `INVARIANTS.md` · Structure → `REPO_MAP.md`

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (cs_dt=$(grep "^dt=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 | cut -d' ' -f1); today=$(date +%Y-%m-%d); compact_restore=false; [ "$cs_dt" = "$today" ] && compact_restore=true && echo "[compact-restore]" && cat .sessions/compact_state.md && echo "---"; phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); sys_fixed=$(python3 -c "import os; print(int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md'))*0.3) + 3500)" 2>/dev/null || echo 11070); if [ "$compact_restore" = "true" ]; then cs=$(grep "^compact_size=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 || echo "0"); ct=$((sys_fixed + ${cs:-0})); reset_marker=$(grep "^session_reset=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2); if [ "$reset_marker" = "armed" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; sed -i '' 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null || sed -i 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null; echo "[reset-consumed] SESSION=0 · marker armed→consumed"; else st=$(grep "^SESSION_TOTAL:" .sessions/session_tokens.md 2>/dev/null | awk '{print $2}'); st=${st:-0}; printf "SESSION_TOTAL: $st\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; echo "[reset-skip] marker=${reset_marker:-absent} · SESSION preserved=$st"; fi; elif [ "$phase" != "in_progress" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $sys_fixed\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; fi; [ -f .sessions/session_tokens.md ] && python3 -c "p='.sessions/session_tokens.md';L=[('LOOP_WEIGHT: 0' if x.startswith('LOOP_WEIGHT:') else x) for x in open(p).read().splitlines()];open(p,'w').write(chr(10).join(L)+chr(10))" 2>/dev/null; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3; echo "---"; echo "CFP_COUNT: $(grep -c '^## CFP-' CODING_FAILURE_PATTERNS.md 2>/dev/null || echo 0)")
[B2] IF [compact-restore]: parse sk= → skill_name · parse section= + step= → resume_hint · SKIP manifest read
     IF prompt has `skill: <name>`: use directly · SKIP manifest
     ELSE: grep -B1 -A6 '"keywords"' .agents/skills/skill-manifest.json | head -160 → assess keyword overlap with user prompt:
             ≥1 keyword aligns with user intent → emit [skill-match] skill:<name> · keyword:<matched> · then emit [skill-active] <name>
             no keyword aligns → emit [skill-miss] · default: agent (manifest fallback) · note reason
             (cannot silently proceed — [skill-miss] is a forcing function: agent MUST name default + reason)
             confirmed match used ≥2 turns → may append to manifest learned_routes[].examples (optional · never required)
[B3] IF [compact-restore]: sha1sum <skill>/SKILL.md → compare sk_h · sha1sum mece/SKILL.md → compare mece_h
       match → SKIP read (~2.9k tokens saved) | mismatch → Read offset=1 limit=80
     ELSE: Read .agents/skills/<skill_name>/SKILL.md offset=1 limit=80
           Read .agents/skills/mece/SKILL.md offset=31 limit=110
```
- B1 resets SESSION_TOTAL=0 · compact-restore: CHAT_TOTAL = compact_size + sys_fixed · fresh session: CHAT_TOTAL = sys_fixed · sys_fixed = (CLAUDE.md + AGENTS.md chars × 0.3) + 3500 · CFP_COUNT → cfp_boot_count in working memory
- B1 LOOP_WEIGHT reset (BUG-3 fix): LOOP_WEIGHT is context-window-scoped → forced to 0 on EVERY boot via the python normalization after the if/elif · this covers the in_progress-resume path (fresh process, phase=in_progress) where neither printf branch fires → previously left LOOP_WEIGHT stale and triggered a spurious turn-1 compact nag (now a soft [compact-rec]; pre-Phase-C it was a hard [compact-required] STOP) · a fresh OS process always has an empty context window · do NOT remove this normalization when deduping B1
- B1 cache breakpoint: if compact_state.md has `prefix_hash=<val>` → compare vs `sha1sum CLAUDE.md | cut -c1-8` → mismatch → emit `[cache-miss-boot] prefix changed · cache cold this session`
- B1 session_tokens.md format: `SESSION_TOTAL: 0\nCHAT_TOTAL: N\nCACHE_READ: 0\nCACHE_WRITE: 0` — add cache fields on fresh session init only if file is being reset
- on_demand_files = lookup table for G2 only — NEVER auto-load at B3
- mece_plan.md has pending sections? Skip Phase 1+2 → resume Phase 3:
  `grep -n "^\- \[ \]\|^\- \[/\]" .sessions/mece_plan.md | head -3` → first pending item
  Resume staleness gate (V3): compare mece_plan_hash in handoff vs sha1sum · git status src/ → [plan-stale] if changed

[B4] Platform Probe: `detected.md` platform: unknown → list tools → update detected.md · else skip

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <N>`
Emit after Boot reply: `[skill-active] <name>` — repeat at start of every turn while skill is loaded (user sees active skill in every response log)
compact-restore reply: append ` · Resume: S<N> — <step>` when section= + step= fields present in compact_state.md

> Boot ending ≠ ready to work. Run C0–C3 → Phase 1 next. SKILL.md load ≠ Phase 1.

---

## Per-Turn Routing (every message)

**Run C0→C0.5→C1→C2→C3 before any work. No exceptions.**

```
[C0.5] → each turn before C1: read [token-state] hook (LOOP_W · SESSION · CHAT) · PRIMARY signal = CHAT_TOTAL (real context size) · LOOP_WEIGHT = SECONDARY tool-call-count hint only · CHAT_TOTAL >80k → [compact-rec] strong: surface recommendation block (Recommend/Why/MUST-vs-SHOULD=SHOULD/Resume brief/Your call) — NOT a STOP, user decides · LW >50 → [compact-rec] light hint only (secondary backstop · optional · no STOP) · HARD STOP only at the real ceiling SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP] write compact_state.md → STOP · skip required tier = CFP-026

[C0] c0_resolved=true in memory → clear flag → skip to C1
     COMPLAINT CHECK: "ลืม"/"you skipped"/"didn't log"/"harness says" + harness step name
     "ลืม" triggers ONLY on step names: roadmap/CFP/index/pre-read/session/boot/skill/gate/MECE
     "ลืมบอกให้เพิ่ม X" = feature request → pass to C1 normally
     YES → R16 self-improve → set c0_resolved=true → resume C1

[C1] Read active_thread.md → extract task: field
[C2] Compare new topic vs task:
     → different topic → TOPIC SWITCH (→ C3)
     → same topic: check mece_plan.md for pending sections matching current task:
         no pending [ ] or [/] sections, OR status:task-complete, OR task field doesn't match → NEW TASK (force Phase 1+2 · skip Phase 0 if same chat)
         pending [ ] or [/] found + task matches → resume Phase 3 (→ C3 stay)
[C3] TOPIC SWITCH:
       (a) Emit [topic-switch] Current: `<task>` · New: `<topic>` · Closing first
       (b) session_manager §3 (5-file close + SESSION_TOTAL reset to 0)
       (c) Check provider: `grep "^platform:" .agents/platform/detected.md`
           claude-code → /compact → Phase 1 fresh same chat
           other       → write compact_state.md → emit "Session ปิดแล้ว — เปิด chat ใหม่ได้เลยครับ" → STOP
     SAME: re-read SKILL.md ONLY if skill changes (compare to cached skill_name)
```

→ if C2 detects topic change: emit `[topic-switch] Current: <task> · New: <topic>` → session_manager §3 · claude-code → /compact → Phase 1 · other → compact_state.md → STOP · skip = [violation] C3-skip
**IS switch:** different section/entity/intent/feature/path · **NOT:** additive/"also"/continue/same-task-bug · **Uncertain:** `[topic-unclear]` → wait
> After C3 → Phase 1 mandatory.

---

## Loop Architecture

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**

| Phase | What happens |
|---|---|
| 1 Info Gather | G1 scan all sections → G2 batch greps+reads → G3 assess · emit [✓ gather] |
| 2 MECE Plan | Plan + Verify-N → user confirms → roadmap → mece_plan.md |
| 3 Execution | REACT LOOP: Select → Execute → Observe → Verify → Decide |

---

### Phase 1 · Info Gather

G0 (clarity gate) → G1 (1-pass scan) → G2 (batch grep+read) → G3 (assess) → [✓ gather] → write gather_complete.md
→ Full G0–G3 detail + limits + refusal contract: **Implement/04_skills.md §Phase 1**

Key rules: G2 = 1 Bash call · user ask = 1 message · max 3 loops · max 5 clarification rounds
[post-read] verdict after every Read: irrelevant→DROP · partial→excerpt · relevant→keep

---

### Phase 2 · MECE Plan

[M1] Read mece/SKILL.md → [M1.5] dependency_map + risk_flags + compact_checkpoint (≥3 sections → insert after ceil(N/2)) → [M2] build plan + Verify-N → [M3] user confirms → [M4] roadmap T-N → [M4.5] optional Skeptical Reviewer → [M5] Read docs/session_templates/mece_plan_schema.md → copy structure → fill task content → write mece_plan.md (Phase 0-3 template mandatory · NEVER write from memory — CFP-019) → [M6] emit [✓ MECE]
→ Full M1–M6 detail + compact_checkpoint formula: **Implement/04_skills.md §Phase 2**

→ at M2: grep `activates_at` + `tools` per skill from manifest (grep only — never Read full manifest) → fill Tool:/Avoid: per section · skip = manifest-routing-miss
→ at M5: Read mece_plan_schema.md → Write gather_complete.md → Write mece_plan.md → THEN present plan · writing from memory = CFP-019 · presenting without files written = CFP-027

**Behavior Contract — BC-M5-verify (fires before emitting [✓ MECE]):**
```
Pre:    mece_plan.md just written · about to emit [✓ MECE]
Contract: Assess whether mece_plan.md is structurally complete before emitting signal:
          — all Phase 0–3 blocks present · Verify-N exists per Phase 3 section
          — compact_checkpoint present if sections ≥ 3 · Phase 3 Close Checklist block present
          Structurally complete → emit [mece-schema-check] Phase2:ok · Verify-N:ok · checkpoint:ok · close-checklist:ok → then [✓ MECE]
          Any structural gap found → re-read docs/session_templates/mece_plan_schema.md → rewrite missing block → re-assess
Post:   [✓ MECE] emitted ONLY after [mece-schema-check] all ok
Enforce: [✓ MECE] without prior [mece-schema-check] = [violation] BC-M5-verify → assess now · rewrite if needed
```

**Behavior Contract — BC-mece-compact (fires immediately after [✓ MECE] emitted):**
```
Pre:    [✓ MECE] just emitted · mece_plan.md written today · user confirmed plan
Contract: MUST emit [mece-complete] summary (task · sections · files · Verify-N count)
          MUST prompt user: "/compact แล้ว reply 'ลุย' เพื่อเริ่ม Phase 3 ครับ"
          HALT — do NOT start Phase 3 execution until compact-restore confirmed
          compact-restore confirmed = B1 output contains [compact-restore] this session
          If user skips /compact and says "ลุย" directly → emit [compact-skipped] · proceed (not a violation)
Post:   [mece-complete] emitted · user prompted · Phase 3 starts in fresh context (or [compact-skipped])
Enforce: Phase 3 Edit/Write started without [mece-complete] emitted = [violation] BC-mece-compact
         → emit [mece-complete] now · prompt /compact · wait
```

MECE runs ONCE. On resume: load existing plan → jump to first pending [ ] section.

---

### Phase 3 · Execution Loop

```
REACT LOOP (per section — repeat until section_complete OR token pause):
  Token check: SESSION_TOTAL > 60k → finish current step → PAUSE

  [L1] SELECT  → next tool (R2 budget · R5 index-first)
               → if next tool = Read: MUST emit [pre-read] Target: `<symbol>` · Tier: T<N> · Line: <N> BEFORE calling Read (mandatory — no exception · CFP-034)
  [L2] EXECUTE → run tool (R6 filter · R10 cap)
  [L3] OBSERVE → verify result · unexpected → diagnose → retry once → BLOCKED
  [L4] VERIFY  → (a) grep confirm → emit [✓ written]
                 (b) run section Verify-N from MECE plan
                 → optional automation: `python3 scripts/verify_runner.py --section S<N> --file .sessions/mece_plan.md` · PASS → proceed · FAIL → diagnose → retry once → BLOCKED
                 FAIL → do NOT mark done → diagnose → retry or BLOCKED
  [L4.5] PURGE → drop tool results from context per state-retention policy:
    | Tool result type        | Policy                                      |
    |-------------------------|---------------------------------------------|
    | Bash verify/grep        | DROP immediately after verdict emitted      |
    | Read · irrelevant       | DROP immediately ([post-read] irrelevant)   |
    | Read · partial/relevant | KEEP excerpt only (≤10L) · drop full output |
    | Edit success            | KEEP [✓ written] verdict + artifact path    |
    | Write success           | KEEP [✓ written] verdict + artifact path    |
    | tool result >50L        | OFFLOAD → write to .sessions/exec_log/<uuid>.txt · inject [result-offloaded] path=<file> lines=<N> · agent reads file if needed |
    keep: [✓ written] verdict + artifact path + Verify-N result · drop: everything else
    exec_log schema: .sessions/exec_log/<uuid>.txt — full tool result · agent reads on-demand via Read tool
    ⚡ MANDATORY PURGE SIGNAL (CFP-033 fix): after EVERY tool result MUST emit ONE of:
       [dropped] <tool-type> — result cleared after verdict
       [kept: N lines] <tool-type> — excerpt only
       [offloaded] path=<file> lines=<N>
       silent keep (no signal) = [violation] BC-L4.5-purge → emit signal now · drop result
  [L5] DECIDE  → section_done = [✓ written] AND Verify-N BOTH pass
                 → mark mece_plan.md: `- [ ] S<N>` → `- [X] S<N>` (file write — not just memory)
                 → steps remain: emit [loop] continue · → done: emit [loop] done
```
→ at [L2] if Bash targets build/script/python/git with likely >40L output: use `python3 scripts/safe_run.py "<cmd>"` OR pipe `2>&1 | grep -iE "error|warn|fail" | tail -20` · skip = R6 violation
After each section → write session_handoff.md: sections_done + sections_pending + last_step + mece_plan_hash=`sha1sum .sessions/mece_plan.md | cut -c1-8` + resume_at=S<N>:step:<desc>

BLOCKED: halt · show error+progress · ask "fix or skip?" · wait
**Behavior Contract — Token Pause (fires when SESSION_TOTAL >60k during Phase 3):**
```
Pre:    SESSION_TOTAL just crossed 60k during Phase 3
Contract: finish current step · claude-code → emit [token-pause] · ask "continue?" → resume on yes · other → compact_state.md → STOP
Post:   compact_state.md written (other) OR user confirmed (claude-code) before new step
Enforce: Phase 3 step started after 60k without pause = R3 violation → HALT immediately
```
Compact check (every turn after hook fires): use hook `[token-state]` values (main-context only) — do NOT read from `session_tokens.md` (subagents can overwrite that file) · PRIMARY signal = CHAT_TOTAL (real context size); LOOP_WEIGHT is a SECONDARY tool-call-count hint, NOT a token ceiling → neither hard-stops · CHAT_TOTAL >80k → [compact-rec] strong (recommendation + user choice) · LW >50 → [compact-rec] light hint only · HARD STOP only at the real ceiling: SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP]
  [compact-rec] strong emit (5 mandatory fields — no partial emit):
    `[compact-rec] Recommend /compact: <now|after step|not yet> · Why: <session ~Nk · what's heavy · pending self-contained? y/n> · MUST vs SHOULD: SHOULD (below 90k/120k ceiling) · Resume brief: <paste-ready ≤5 lines> · Your call: "/compact" | "ทำต่อ"`
Cache note: Anthropic prompt cache TTL = 5 min · /compact resets cache prefix cleanly · compact before long idle > 5 min preserves cache hits on next turn (10× cheaper reads)
Tool schema serialization: JSON key ordering in tool definitions MUST be stable across turns — unstable serialization invalidates the prompt cache prefix silently (causes cache-collapse spike)
bucket_sys note: amortizes sys_fixed across turns — if tool schema edited this session → cache prefix resets → actual cost ≈ sys_fixed added back once · [spike:cache-collapse] detects this
Stable prefix rule: CLAUDE.md + AGENTS.md = stable prefix (cache_control these blocks — never change mid-session) · User message + tool results = dynamic suffix — never cache_control dynamic blocks.
→ if editing SKILL.md or tool-def mid-session (SESSION_TOTAL>10k): emit `[schema-gate]` · wait confirm · after edit emit `[schema-changed] Cache prefix reset · CHAT_TOTAL += sys_fixed` · skip = cache-collapse violation
Proactive cache invalidation: at boot → `sha1sum .agents/skills/*/SKILL.md 2>/dev/null | sort > .sessions/tool_schema_hash.txt` · per-turn: diff vs stored hash → mismatch → emit [cache-invalidated] + update `.sessions/tool_schema_hash.txt`

---

### Completion Gate

**Behavior Contract — Completion Gate (fires when all mece_plan.md sections marked [X]):**
```
Pre:    all Phase 3 sections marked [X] in mece_plan.md
        ⚡ MANDATORY FIRST STEP — emit [close-gate-check] before ANY close action:
           [close-gate-check] trigger: (user typed /compact)=<Y/N> · (SESSION_TOTAL>80k)=<Y/N> · (LOOP_WEIGHT>50)=<Y/N>
           ALL three = N → emit [session-health] + task summary → WAIT for user (CFP-037 hardstop)
           ANY = Y → proceed to close sequence
           omitting [close-gate-check] = [violation] CFP-037 → emit now · halt · re-check
           ⚠️ LOOP_WEIGHT source: read from hook [token-state] LOOP_W only — NOT from session_tokens.md (subagents write that file and pollute the value)
        close-gate: MUST check — (user typed /compact) OR (SESSION_TOTAL>80k) OR (LOOP_WEIGHT>50)
        neither condition met → present summary + [session-health] → WAIT for user · do NOT auto-close (CFP-037)
Contract: Verify-N ≤3 + no src/ changes → run inline bash verify
          Verify-N ≥4 OR src/ changes → spawn MODEL_LOW reviewer agent
          done criteria must ALL pass:
            all [✓ written] emitted · R8 Index Sync complete · Roadmap [X]
            active_thread phase:done written · SESSION_TOTAL written · Feedback sent
            mece_plan.md Phase 1-3 cleared (PATH A) — NEVER ad-hoc · use exact cmd in mece_plan_schema.md §PATH A (CFP-025)
          run python3 scripts/trim_exec_log.py + write session_summary to token_log.jsonl before /compact
          SESSION_TOTAL >50k → compact first · >60k → TOKEN PAUSE · >30k + ≥3 sections → compact after current section
Post:   close-gate passed · session close sequence complete · compact_state.md written · /compact run
Enforce: task marked done without all done-criteria passing = [violation] BC-completion-gate → re-run missing criteria first
         auto-close without close-gate check = [violation] CFP-037 → present summary · wait for user
```

Session Health: <20k ✅ · 20–40k 💡 · 40–60k ⚠️ compact now · >60k 🛑 TOKEN PAUSE · emit `[session-health]` · Thai summary: `งานเสร็จแล้วครับ ✅`
⚠️ CHAT_TOTAL undercount: true API context ≈ CHAT_TOTAL × 1.5–2× (triangular re-send) · use as lower bound · compact before CHAT_TOTAL > 80k to avoid spike

---

## Index Sync Invariant

Every create/modify/delete/rename **must** update indexes before task marked done.
Backlink 3-tier check before editing: references[] · backlinks[] · related[] → **Implement/03_config.md §Backlink Rule**
| Entity | Must update |
|---|---|
| File created/moved/deleted | `index_files.json` (file_manager) |
| Symbol with cross-file dependency: created/renamed/deleted | `index_variables.json` (symbol_indexer.py) · skip if symbol is used only within its own file |
| Session closed | `index_sessions.json` (session_indexer.py) |
| SKILL.md created/renamed | `skill-manifest.json` + `skill-index.md` |
| Tool script created/renamed | `tool-manifest.json` |
| `knowledge/` file modified | `knowledge_conflict_checker.py --file <path> --no-trigger` · EXCLUDE: index_*.json · error_index.md |

---

## Never-Full-Load (hard — no exceptions, including Phase 1 G2)
→ Full file list + whitelist: **Implement/03_config.md §Never-Full-Load**
Violation → emit `[violation] never-full-load` → discard → re-run as grep.
on_demand_files in manifest = lookup table for G2 only. B3 MUST NOT load them.

---

## Sub-agent Rules (R4)

Probe first: `find <path> -name "<pat>" | wc -l` → <5 files/<300L = main context · ≥5 = spawn sub-agent (≤500 tok summary)
Phase routing: G1/G2/Reviewer → MODEL_LOW · MECE/Execute → MODEL_HIGH (~35% cost saving)
Max depth = 1 · pre-assign T-IDs before spawn · emit `[cycle N]` · HALT if blocked
→ Full routing table + OmO Roles + spawn patterns: **Implement/03_config.md §Sub-agent Rules**

---

## Critical Project Rules
- **Miniflare D1 (local):** No `onConflictDoNothing()` or multi-row INSERT — silent failures. Use SELECT+filter+single-row-insert. (ERR-007)
- **Edge Runtime:** No Node.js APIs. WebCrypto only.
- **CSV parsing:** Always PapaParse — never `split(",")` manually.
<!-- END:agent-orientation -->
