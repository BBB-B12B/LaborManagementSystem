<!-- DOC-MAP:START (auto · gen_doc_labels.py) -->
<!-- topic: doc_navigation · jump: python3 scripts/lookup.py "<label>" -->
- L13 · ## 14. Orchestrator Protocol — Dual-Mode Execution
- L21 · ### 14a. `.sessions/mece_plan.md` — Schema
- L105 · ### Phase 3 · REACT LOOP (execution detail)
- L178 · ### 14b. Boot Detection
- L200 · ### 14c. Cycle Result File Schema
- L233 · ### 14d. Sub-agent Loop Logic
- L262 · ### 14e. "จบ session" Clear Flow
- L289 · ### 14f. Token Budget Guidelines
<!-- DOC-MAP:END -->

## 14. Orchestrator Protocol — Dual-Mode Execution

Two modes — identical file format, different execution:
- **Mode A (spawn capable):** Orchestrator writes `mece_plan.md` → spawns sub-agents per section
- **Mode B (no spawn / single model):** Orchestrator writes `mece_plan.md` → loops as sub-agent in same session or resumes in new chat

---

### 14a. `.sessions/mece_plan.md` — Schema

Orchestrator writes this file at **end of Phase 2 M3 BEFORE presenting the plan** (aligns with AGENTS.md M2→M3→M4→M5). Format = Phase-Checklist Template from `mece/SKILL.md §Phase-Checklist Template`. See that file for the canonical template — schema below is a reference summary.

**Phase-Checklist Template format (written at M3):**

```markdown
## Phase 0 — Boot (once per session · keep [X] on same-chat resume · reset [X]→[ ] before /compact)
### Files Read
| File | Tool | TH ch | EN ch | ~Tok |   ← ~Tok = EN_ch × 0.3 / 1000 · TH_ch × 1.7 / 1000
|---|---|---|---|---|
| .sessions/compact_state.md | `cat` (if dt=today → [compact-restore]) | ___ | ___ | ___ |
| .sessions/active_thread.md | `wc -m` | ___ | ___ | ___ |
| skill-manifest.json (grep) | `grep keywords \| wc -m` (skip if [compact-restore]) | ___ | ___ | ___ |
| .agents/skills/<name>/SKILL.md | `wc -m` (skip if sk_h match) | ___ | ___ | ___ |
| .agents/skills/harness/mece/SKILL.md (offset=31 limit=110) | `wc -m` (skip if mece_h match) | ___ | ___ | ___ |
Phase 0 total: TH ___ch · EN ___ch → ~___tok
- [ ] B1: compact_state.md checked · active_thread read · SESSION_TOTAL reset/loaded · CFP_COUNT stored
- [ ] B2-B3: [compact-restore] → sk= + sha1 check · OR manifest grep + SKILL.md read · sections[] loaded
- [ ] C0-C0.5-C1-C3: routing confirmed · LOOP_WEIGHT checked · no topic switch
→ TOKEN CHECK (runtime · NOT at plan creation): READ `[token-state]` from the PostToolUse hook (`scripts/posttool_track.py` OWNS SESSION_TOTAL + CHAT — the agent NEVER hand-writes them · T-287/288) · hook line absent → grep `.sessions/session_tokens.md` → ___k

## Phase 1 — Info Gather
### Files Read  (same table format)
- [ ] G1/G2/G3/gather_complete.md checkboxes
→ TOKEN CHECK (runtime · NOT at plan creation) → ___k  (>60k → TOKEN PAUSE)

## Phase 2 — Plan
### Files Read  (same table format)
- [ ] M1.5: reasoning pass done · dependency_map[] + risk_flags[] + compact_checkpoint in working memory
      compact_checkpoint: IF sections ≥ 3 OR (sections × 6) > 30 → insert [/compact checkpoint] after ceil(N/2)
- [ ] M2/M3/M4/M5 checkboxes
→ TOKEN CHECK (runtime · NOT at plan creation) → ___k  (>60k → TOKEN PAUSE)
→ TOKEN/COMPACT CHECK — canonical model = CLAUDE.md R3 + AGENTS.md §Per-Turn Routing C0 Q3 (T-286): signal-box N/4 is PRIMARY · the char-estimate (CHAT/SESSION/LOOP_W) is advisory and NEVER hard-stops · the client meter (real %) is the only ceiling source. signal-box ≥2 → [compact-rec] strong (5 fields · a choice, NOT a STOP) · CHAT >80k OR LOOP_W >50 → [compact-note] light. Do not restate thresholds here (single-source).

---

**[✓ MECE]** Goal: ___

Section 1 — <name>:
  Skill:    ___   ← MANDATORY — editor|coder|index_manager|agent
  Tool:     ___   ← primary tool (Read|Edit|Write|Bash)
  Constraints:
    - ___         ← from §MECE Constraints Block in the section's SKILL.md
  Steps:
    - [S1-A] ___
  Verify:   ___
  Rollback: ___
  Data_Sent: Thai ___ch | ENG: ___ch  ← fill AFTER section completes
  Token:    ___k                       ← fill AFTER section completes

---

## Phase 3 — Execute + Close
- [ ] S1 [✓ written] + Verify PASS
      Data_Sent: TH ___ch · EN ___ch
      → TOKEN CHECK (runtime · NOT at plan creation) → ___k
- [ ] R8 index sync · Roadmap [X] · active_thread.md phase: done
- [ ] SESSION_TOTAL recorded — READ from the hook `[token-state]` (or grep `.sessions/session_tokens.md`); `scripts/posttool_track.py` owns it, the agent never hand-writes (T-287/288) · fill ___k
- [ ] Clear mece_plan.md Phase 1–3 (same-chat task complete — keeps Phase 0 [X] for boot continuity):
      Bash: `python3 scripts/clear_plan.py`
      → แจ้ง user: "งานเสร็จแล้วครับ สั่งงานต่อได้เลย"
- [ ] Reset Phase 0 [X]→[ ] (before /compact mid-task — enables B1 re-run boot checks in new chat):
      Bash: `awk '/^## Phase 0/{p=1} /^## Phase 1/{p=0} p{sub(/- \[X\]/,"- [ ]")} {print}' .sessions/mece_plan.md > /tmp/m.md && mv /tmp/m.md .sessions/mece_plan.md`
- [ ] Check provider: `grep "^platform:" .agents/platform/detected.md`
      claude-code → /compact → ✅ "compact เรียบร้อยครับ — เปิด chat ใหม่แล้วสั่งงานต่อได้เลยครับ"
      other       → compact_state.md พร้อมแล้ว → "Session ปิดแล้วครับ — เปิด chat ใหม่แล้วสั่งงานต่อได้เลย"
- [ ] [mece-audit] · self_improve · harness_doctor · Ask user
- [ ] Feedback & Error Summary delivered
```

**Pre-fill rule:** Leave ALL `___` placeholders as-is at plan creation (M5) — fill only at runtime.
**~Tok formula:** `EN_ch × 0.3 / 1000` · `TH_ch × 1.7 / 1000` · do NOT use `chars ÷ 1000` (overcounts 3×)

**Section status markers (used inside Sections + Phase 3 close):**

| Marker | Meaning |
|---|---|
| `[ ]` | Not started |
| `[/]` | In progress — mark before first tool call |
| `[X]` | Done — mark after Verify-N passes |

---

### Phase 3 · REACT LOOP (execution detail)
> Hot triggers live in AGENTS.md §Phase 3 · Execution Loop. This is the full how-to, lazy-loaded on entering the loop.

```
REACT LOOP (per section — repeat until section_complete OR token pause):
  Token check: SESSION_TOTAL 60-80k → finish current step → PAUSE

  [L1] SELECT  → next tool (R2 budget · R5 index-first)
               → if next tool = Read: MUST emit [pre-read] Target: `<symbol>` · Line: <N> BEFORE calling Read (mandatory — no exception · CFP-034)
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
    ⚡ HEADROOM EMIT (T-311 · distinct from the manual purge signals above): `safe_run.py` prints
       `[headroom] <technique>: <what> · saved ~N lines` to stderr when an AUTOMATED compressor fires —
       view-compress (T-302, table trim) or offload (T-301, park raw to exec_log). The agent surfaces it
       so the user can verify headroom actually ran (deterministic — the script emits, agent can't forget).
       Boundary (single-source): compression only. selective-read range-trim = `[pre-read]` (label lookup, not
       compression) · topic/label lookup = NOT headroom. Manual purge ([dropped]/[kept]) stays its own layer.
       AUTO-NUDGE (T-344 · Context-send Standard): `headroom_hook.py` (PostToolUse Bash) now fires WITHOUT the
       agent — Bash output >80 lines → parks a copy + injects a `[headroom]` additionalContext reminder. It
       nudges + parks; it does NOT rewrite the output (a PostToolUse hook cannot replace tool output — S0 spike).
       So heed the nudge: route big commands via safe_run + read index-first so the bulk never enters context.
    ⚡ CTX-LOAD (T-345 · PROACTIVE plan-prep · single source HERE · distinct from the REACTIVE headroom nudge above):
       when the current section carries a `Context-shrunk:` slice (prepared at plan time · M5.5 / mece S2-A.5), at [L1]/[L2]
       BEFORE reading load it via the staleness guard, never the full file blind:
         `python3 scripts/plan_ctx.py check <slice>` →
           `[ctx-loaded] slice:<path> · full-source:<file>:<Lstart-Lend> · hash:ok` → Read the SLICE (the real token saving —
             a small prepared pack instead of the full file · especially valuable when the section is delegated to a cheap model)
           `[ctx-stale] slice:<path> · <reason> · re-prepare or read Context-full` → the source region drifted since prep →
             re-run `plan_ctx.py prepare` OR Read the `Context-full:` range directly · NEVER load a stale slice silently
       This emit PROVES real proactive shrinkage happened (prepared slice loaded) — it is NOT the T-344 `[headroom]` nudge
       (that fires reactively AFTER a big output). Both are the Context-send Standard (CLAUDE.md R5): reactive + proactive.
  [L5] DECIDE  → section_done = [✓ written] AND Verify-N BOTH pass
                 → [L4.75] per-section scrutinize (LIGHT · auto · T-350): run scrutinize scoped to THIS section's diff → emit [scrutinized S<N>] (+ native passes) → append .sessions/.scrutinize_log `S<N>|<stripped-plan-hash>` · skill_gate Gate 4 HARD-BLOCKS the [X] without a hash-matched proof · FULL scrutinize still runs once at close
                 → mark mece_plan.md: `- [ ] S<N>` → `- [X] S<N>` (file write — not just memory)
                 → steps remain: emit [loop] continue · → done: emit [loop] done
```
→ at [L2] if Bash targets build/script/python/git with likely >40L output: use `python3 scripts/safe_run.py "<cmd>"` OR pipe `2>&1 | grep -iE "error|warn|fail" | tail -20` · skip = R6 violation
After each section → write session_handoff.md: sections_done + sections_pending + last_step + mece_plan_hash=`sha1sum .sessions/mece_plan.md | cut -c1-8` + resume_at=S<N>:step:<desc>

BLOCKED: halt · show error+progress · ask "fix or skip?" · wait
**Token Pause** (SESSION_TOTAL 60-80k during Phase 3): finish the current step · claude-code → emit `[token-pause]` · ask "continue?" → resume on yes · other provider → write compact_state.md → STOP.
Compact check (every turn): use hook `[token-state]` values — EXCEPT at a mid-turn DECISION point or on a heavy-tool turn (≥5 calls / clone / bulk-copy), where you MUST grep LIVE `session_tokens.md` because [token-state] is a start-of-turn snapshot and lags by up to 1 turn (CFP-041). After T-235 the live file is subagent-clean (hook early-exits on `agent_id`), so the live grep is reliable on any turn — not just main-context ones. Thresholds → see C0 Q3 (§Per-Turn Routing): PRIMARY = signal-box N/4 · CHAT/LOOP_W = advisory estimate · NEVER hard-stops — client meter (real %) is the only ceiling (T-286).
  [compact-rec] strong emit (5 mandatory fields — no partial emit):
    `[compact-rec] Recommend /compact: <now|after step|not yet> · Why: <session ~Nk · what's heavy · pending self-contained? y/n> · MUST vs SHOULD: SHOULD (client meter = only ceiling · T-286) · Resume brief: <paste-ready ≤5 lines> · Your call: "/compact" | "ทำต่อ"`
Cache note: Anthropic prompt cache TTL = 5 min · /compact resets cache prefix cleanly · compact before long idle > 5 min preserves cache hits on next turn (10× cheaper reads)
Tool schema serialization: JSON key ordering in tool definitions MUST be stable across turns — unstable serialization invalidates the prompt cache prefix silently (causes cache-collapse spike)
bucket_sys note: amortizes sys_fixed across turns — if tool schema edited this session → cache prefix resets → actual cost ≈ sys_fixed added back once · [spike:cache-collapse] detects this
Stable prefix rule: CLAUDE.md + AGENTS.md = stable prefix (cache_control these blocks — never change mid-session) · User message + tool results = dynamic suffix — never cache_control dynamic blocks.
→ if editing SKILL.md or tool-def mid-session (SESSION_TOTAL>10k): emit `[schema-gate]` · wait confirm · after edit emit `[schema-changed] Cache prefix reset · CHAT_TOTAL += sys_fixed` · skip = cache-collapse violation
Proactive cache invalidation: at boot → `sha1sum .agents/skills/*/SKILL.md 2>/dev/null | sort > .sessions/tool_schema_hash.txt` · per-turn: diff vs stored hash → mismatch → emit [cache-invalidated] + update `.sessions/tool_schema_hash.txt`

---

### 14b. Boot Detection

B1 must check mece_plan.md after reading active_thread.md:

```bash
pending=$(grep -cE "^\- \[[ /]\]" .sessions/mece_plan.md 2>/dev/null || echo "0")
current_cycle=$(grep "^current_cycle:" .sessions/session_handoff.md 2>/dev/null | awk '{print $2}')
mece_plan_hash=$(grep "^mece_plan_hash:" .sessions/session_handoff.md 2>/dev/null | awk '{print $2}')
# Staleness gate on resume: sha1sum .sessions/mece_plan.md vs mece_plan_hash
# hash mismatch OR src/ changed → emit [plan-stale] → ask reconfirm/rebuild
# On resume: start from current_cycle, not from section 1
```

| pending | phase | mece status | Boot action |
|---|---|---|---|
| > 0 | in_progress | any | Skip Phase 1+2 → resume Phase 3 at first `[/]` or `[ ]` |
| > 0 | done | any | Ask: "มีแผนค้าง `<N>` sections — ทำต่อ (resume) หรือล้างแผน (clear)?" |
| 0 | any | task-complete | Same chat → force Phase 1+2 fresh (skip Phase 0) |
| 0 | any | other | Normal boot — fresh start (Phase 1+2 needed) |

---

### 14c. Cycle Result File Schema

Every spawned sub-agent MUST write this file before returning. Missing or invalid file → treat as blocked.

```json
{
  "cycle": 1,
  "section": "S1",
  "status": "done | blocked",
  "verify_result": "<output of DoD command>",
  "artifacts": ["path/to/created/file.ts"],
  "tokens_estimated": 4200,
  "notes": ""
}
```

**`tokens_estimated` is REQUIRED** (INVARIANTS.md §I7). If missing → orchestrator adds 2,000 flat buffer.

**TOKEN MERGE (after all Cycle N agents done — run before spawning Cycle N+1):**
> Scope note (T-287/288): the MAIN-context SESSION_TOTAL is hook-owned (`posttool_track.py`) — never hand-write it per turn (see the close-checklist item above). This MERGE is the SEPARATE sub-agent fold-in — cycle agents run in isolated contexts the main hook cannot see, so their `tokens_estimated` are summed here. Reconciling this manual fold-in with hook ownership (so nothing double-counts or gets clobbered) is tracked in **T-327**.
```
1. Sum tokens_estimated from all cycle_N_*.json
2. Missing field → add 2,000 per file
3. Add sum to SESSION_TOTAL in working memory
4. Write updated total → .sessions/session_tokens.md
5. Check R3 threshold immediately:
   > 60k AND compact not run → compact first → emit [compact-rec] (recommend, not forced)
   60-80k → TOKEN PAUSE (do not spawn Cycle N+1 until user confirms) · above → advisory [compact-rec] + check CLIENT METER (real %) · estimate NEVER hard-stops (T-286)
   ≤ 60k → spawn Cycle N+1
```

---

### 14d. Sub-agent Loop Logic

> Signal (T-350): [scrutinized S<N>] = the per-section LIGHT scrutinize ran before the [X] mark (proof in .sessions/.scrutinize_log · skill_gate Gate 4 enforces).

```
Cycle-aware loop:
  1. FIND first Cycle with any [/] or [ ] section
     ไม่มีเลย (ทุก [X]) → session_manager close flow
  2. Pre-assign roadmap T-IDs for all sections in this Cycle (INVARIANTS.md §I6)
     grep roadmap → last T-N → write [ ] T-N+1, T-N+2 BEFORE spawn
  2.5 PREVIEW (optional · READ-ONLY): `python3 scripts/execution_schedule.py`
     → prints the cycle/section/model/spawn table (or "Cycle 1 — all sequential"
       for a single serial cycle) so the user SEES what is about to spawn before
       step 3. It only reads mece_plan.md — never edits it. (T-321c: wired here.)
  3. SPAWN all sections in that Cycle in parallel (one message)
     → EMIT `[cycle N] spawned: S<x>(<model>)·S<y>(<model>) · parallel:<k>` at THIS step (visible spawn signal · T-321) — name each section, its model tier, and delegate(spawn)-vs-main; `parallel:<k>` = how many were spawned together. A serial cycle of one emits `[cycle N] serial: S<x>(<model>) · main`. (single source — AGENTS.md §Phase 3 points here, never re-defines it.)
     → PER-SECTION `[model]` EMIT (T-328 · visibility · single source HERE): at the START of EVERY section — spawned OR inline — emit `[model] <tier> · <reason>` where tier ∈ {model_low | model_medium | model_high} and reason states WHY that tier (spawned: mechanical / same-tier-batch · inline-on-main: sensitive | core-file | judgment | genuinely-tiny). Inline sections are NOT exempt — an inline `[model] model_high · reason:<why not delegated>` is exactly what makes a silent fall-to-opus VISIBLE to the user. Missing `[model]` on any section = [violation] BC-model-visibility. → Plan-time companion (T-340): `scripts/plan_lint.py` prints the tier-distribution table at Phase-2 close (schema M3) + flags MISSING-MODEL / model_high-without-MAIN — the script-enforced visibility behind this prose per-section emit (a plan that is silently all-opus is caught before execution).
     → BATCH (T-328 · amortize): within a cycle, ≥2 sections of the SAME cheap tier (model_low / model_medium) that are mechanical + mutually independent MAY be spawned as ONE batched agent — the spawn overhead is paid ONCE, not per-section. Each item is self-verified independently; a failed item retries once then escalates, siblings unaffected. Judgment / sensitive / MAIN sections are never batched. (Full batched-spawn contract: `delegate` skill step 4.)
  4. Each agent writes .sessions/cycle_N_<section_id>.json
  5. AWAIT all agents in Cycle N
  6. TOKEN MERGE (see §14c) → check thresholds
  7. CHECK: all status=done? → read results → build context → advance to Cycle N+1
             any status=blocked? → HALT all pending Cycles → BLOCKED flow
  8. pending = 0 → session_manager close flow
  9. REPEAT from step 1 for next Cycle
```

---

### 14e. "จบ session" Clear Flow

Triggered by: `"จบ session"` / `"clear plan"` / `"ล้างแผน"` / `"สรุป session"`

```
1. อ่าน mece_plan.md → สรุป done/remaining
2. Append to Session Archive:
   ### Closed: <date>
   Done: [S1, S2] | Remaining: [S3, S4] | Summary: <one-line>
3. อัปเดต active_thread.md → phase: done
4. เขียน Sections ใน mece_plan.md ใหม่เป็น template ว่าง
5. บอก user: "ปิดแผน '<Task Name>' แล้ว — Chat ใหม่ได้เลย"
```

**Template หลัง clear:**

```markdown
# MECE Plan — (empty)
Status: ready
<!-- Orchestrator will write here at next Phase 2 -->

## Session Archive
<!-- previous plans archived below -->
```

---

### 14f. Token Budget Guidelines

| Section Est | Max sections per chat (50k limit, ~5k boot overhead) |
|---|---|
| ~4k | 10 sections |
| ~8k | 5 sections |
| ~12k | 3 sections |
| >15k | must split into smaller sections |
