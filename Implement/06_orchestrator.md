## 14. Orchestrator Protocol — Dual-Mode Execution

Two modes — identical file format, different execution:
- **Mode A (spawn capable):** Orchestrator writes `mece_plan.md` → spawns sub-agents per section
- **Mode B (no spawn / single model):** Orchestrator writes `mece_plan.md` → loops as sub-agent in same session or resumes in new chat

---

### 14a. `.sessions/mece_plan.md` — Schema

Orchestrator writes this file at **end of Phase 2 M5 AFTER user confirm** (aligns with AGENTS.md M3→M4→M5). Format = Phase-Checklist Template from `mece/SKILL.md §Phase-Checklist Template`. See that file for the canonical template — schema below is a reference summary.

**Phase-Checklist Template format (written at M5):**

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
→ TOKEN CHECK (runtime · NOT at plan creation): write SESSION_TOTAL → file · cat → ___k

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
→ LOOP_WEIGHT CHECK (Behavior Contract):
   Pre:      read [token-state] hook → LOOP_W · CHAT_TOTAL · SESSION_TOTAL
   Contract: CHAT_TOTAL >80k → MUST emit [compact-rec] strong (Recommend/Why/MUST-vs-SHOULD=SHOULD/Resume brief/Your call) — PRIMARY · recommendation + choice, NOT a STOP
             LOOP_WEIGHT >50 → MUST emit [compact-rec] light hint BEFORE continuing (secondary · optional · no STOP)
             hard STOP only at SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP] → write compact_state.md → STOP
   Post:     [compact-rec] strong missing any of the 5 fields = invalid · re-emit complete
   Enforce:  C0.5 gate fires every turn (AGENTS.md Per-Turn Routing)

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
- [ ] SESSION_TOTAL written (fill ___k from working memory · do NOT hardcode 0k)
- [ ] Clear mece_plan.md Phase 1–3 (same-chat task complete — keeps Phase 0 [X] for boot continuity):
      Bash: `head -n $(grep -n "^## Phase 1" .sessions/mece_plan.md | head -1 | cut -d: -f1) .sessions/mece_plan.md | grep -v "^## Phase 1" > /tmp/mece_h.md && printf "\n## Phase 1–3 — cleared\nstatus: task-complete\n" >> /tmp/mece_h.md && mv /tmp/mece_h.md .sessions/mece_plan.md`
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
  [L5] DECIDE  → section_done = [✓ written] AND Verify-N BOTH pass
                 → mark mece_plan.md: `- [ ] S<N>` → `- [X] S<N>` (file write — not just memory)
                 → steps remain: emit [loop] continue · → done: emit [loop] done
```
→ at [L2] if Bash targets build/script/python/git with likely >40L output: use `python3 scripts/safe_run.py "<cmd>"` OR pipe `2>&1 | grep -iE "error|warn|fail" | tail -20` · skip = R6 violation
After each section → write session_handoff.md: sections_done + sections_pending + last_step + mece_plan_hash=`sha1sum .sessions/mece_plan.md | cut -c1-8` + resume_at=S<N>:step:<desc>

BLOCKED: halt · show error+progress · ask "fix or skip?" · wait
**Token Pause** (SESSION_TOTAL 60-80k during Phase 3): finish the current step · claude-code → emit `[token-pause]` · ask "continue?" → resume on yes · other provider → write compact_state.md → STOP.
Compact check (every turn): use hook `[token-state]` values — EXCEPT at a mid-turn DECISION point or on a heavy-tool turn (≥5 calls / clone / bulk-copy), where you MUST grep LIVE `session_tokens.md` because [token-state] is a start-of-turn snapshot and lags by up to 1 turn (CFP-041). After T-235 the live file is subagent-clean (hook early-exits on `agent_id`), so the live grep is reliable on any turn — not just main-context ones. Thresholds → see C0.5 (§Per-Turn Routing): PRIMARY = CHAT_TOTAL · LOOP_WEIGHT secondary · hard STOP only at SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP].
  [compact-rec] strong emit (5 mandatory fields — no partial emit):
    `[compact-rec] Recommend /compact: <now|after step|not yet> · Why: <session ~Nk · what's heavy · pending self-contained? y/n> · MUST vs SHOULD: SHOULD (below 90k/120k ceiling) · Resume brief: <paste-ready ≤5 lines> · Your call: "/compact" | "ทำต่อ"`
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
  "section": "S1-scope",
  "status": "done | blocked",
  "verify_result": "<output of DoD command>",
  "artifacts": ["path/to/created/file.ts"],
  "tokens_estimated": 4200,
  "notes": ""
}
```

**`tokens_estimated` is REQUIRED** (INVARIANTS.md §I7). If missing → orchestrator adds 2,000 flat buffer.

**TOKEN MERGE (after all Cycle N agents done — run before spawning Cycle N+1):**
```
1. Sum tokens_estimated from all cycle_N_*.json
2. Missing field → add 2,000 per file
3. Add sum to SESSION_TOTAL in working memory
4. Write updated total → .sessions/session_tokens.md
5. Check R3 threshold immediately:
   > 60k AND compact not run → compact first → emit [compact-rec] (recommend, not forced)
   60-80k → TOKEN PAUSE (do not spawn Cycle N+1 until user confirms) · > 90k → HALT
   ≤ 60k → spawn Cycle N+1
```

---

### 14d. Sub-agent Loop Logic

```
Cycle-aware loop:
  1. FIND first Cycle with any [/] or [ ] section
     ไม่มีเลย (ทุก [X]) → session_manager close flow
  2. Pre-assign roadmap T-IDs for all sections in this Cycle (INVARIANTS.md §I6)
     grep roadmap → last T-N → write [ ] T-N+1, T-N+2 BEFORE spawn
  3. SPAWN all sections in that Cycle in parallel (one message)
  4. Each agent writes .sessions/cycle_N_<section_id>.json
  5. AWAIT all agents in Cycle N
  6. TOKEN MERGE (see §14c) → check thresholds
  7. CHECK: all status=done? → read results → build context → advance to Cycle N+1
             any status=blocked? → HALT all pending Cycles → BLOCKED flow
  8. pending = 0 → session_manager close flow
  9. REPEAT from step 1 for next Cycle
```

---

### 14d. "จบ session" Clear Flow

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

### 14e. Token Budget Guidelines

| Section Est | Max sections per chat (50k limit, ~5k boot overhead) |
|---|---|
| ~4k | 10 sections |
| ~8k | 5 sections |
| ~12k | 3 sections |
| >15k | must split into smaller sections |
