## 4. CLAUDE.md Gateway Template

Copy this into `CLAUDE.md` at project root. Adjust token thresholds to match your model's context window.

```markdown
# CLAUDE.md — Agent Gateway Rules

> Read first. Hard constraints.

## Boot (3 tool calls max)
```
[B1] Bash: (cs_dt=$(grep "^dt=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 | cut -d' ' -f1); today=$(date +%Y-%m-%d); compact_restore=false; [ "$cs_dt" = "$today" ] && compact_restore=true && echo "[compact-restore]" && cat .sessions/compact_state.md && echo "---"; phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); sys_fixed=$(python3 -c "import os; print(int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md'))*0.3) + 3500)" 2>/dev/null || echo 11070); if [ "$compact_restore" = "true" ]; then cs=$(grep "^compact_size=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 || echo "0"); ct=$((sys_fixed + ${cs:-0})); reset_marker=$(grep "^session_reset=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2); if [ "$reset_marker" = "armed" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; sed -i '' 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null || sed -i 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null; echo "[reset-consumed] SESSION=0 · marker armed→consumed"; else st=$(grep "^SESSION_TOTAL:" .sessions/session_tokens.md 2>/dev/null | awk '{print $2}'); st=${st:-0}; printf "SESSION_TOTAL: $st\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; echo "[reset-skip] marker=${reset_marker:-absent} · SESSION preserved=$st"; fi; elif [ "$phase" != "in_progress" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $sys_fixed\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; fi; [ -f .sessions/session_tokens.md ] && python3 -c "p='.sessions/session_tokens.md';L=[('LOOP_WEIGHT: 0' if x.startswith('LOOP_WEIGHT:') else x) for x in open(p).read().splitlines()];open(p,'w').write(chr(10).join(L)+chr(10))" 2>/dev/null; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3; echo "---"; echo "CFP_COUNT: $(grep -c '^## CFP-' CODING_FAILURE_PATTERNS.md 2>/dev/null || echo 0)")
[B2] IF [compact-restore] in B1 output → parse sk= from compact_state.md → use as skill_name · SKIP manifest read (~1,300 tokens saved)
     ELSE IF prompt contains `skill: <name>` → skip manifest read · ELSE: grep keywords[] from skill-manifest.json (not full read) → identify skill_name
[B3] IF [compact-restore]: sha1 check sk_h= + mece_h= → hash match → SKIP SKILL.md + mece/SKILL.md reads (~2.9k tokens saved total)
     ELSE: Read .agents/skills/<skill_name>/SKILL.md offset=1 limit=80 → sections[] only · on_demand_files = lookup table for G2 (NOT loaded at boot)
           Also: Read .agents/skills/mece/SKILL.md offset=31 limit=110 → §Plan Format + §Execution Protocol into working memory
```
→ B1 resets SESSION_TOTAL=0 · compact-restore: CHAT_TOTAL = compact_size + sys_fixed · fresh (phase≠in_progress): CHAT_TOTAL = sys_fixed (dynamic ≈ 11–13k) · sys_fixed = (CLAUDE.md+AGENTS.md chars × 0.3)+3500
→ Load SESSION_TOTAL + CHAT_TOTAL from B1 into working memory (both sourced from session_tokens.md)
→ Load CFP_COUNT from B1 output → store as `cfp_boot_count` in working memory (used by self_improve)
→ If SESSION_TOTAL > 60k → warn user immediately before proceeding

[B4] Platform Probe (run only if `.agents/platform/detected.md` has `platform: unknown`):
     → List available tools → match against known platforms (see 07_platform.md Known Mappings)
     → Found match → update detected.md → proceed
     → No match → emit [platform-unknown] → ask 4 co-development questions (see 07_platform.md)
     → B4 is skipped if detected.md already has a known platform value

Reply line 1 — Boot trace:
```
**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: `<name>` · Sections: <N> · Tokens: ~<N>k · CFP: <cfp_boot_count>
```

## ⚡ MANDATORY BOOT GATE

**Before responding to ANY user message — verify `[Boot]` trace has been emitted this session.**

If `[Boot]` trace has NOT been emitted yet:
1. STOP — do not respond to the user message
2. Run B1 → B2 → B3 (Boot Sequence above, max 3 tool calls)
3. Emit: `**[Boot]** Thread: ... · Skill: ... · Tokens: ~Nk · CFP: N`
4. THEN respond to the user

**Skipping boot = invalid session state. Responding without `[Boot]` = harness violation (CFP).**

---

## R1 · Token Tracking
Two counters — both in working memory, sourced from files at Boot:
- `SESSION_TOTAL` — resets at session close (per-task cost) · file: `.sessions/session_tokens.md`
- `CHAT_TOTAL` — resets only on /compact · B1 sets to sys_fixed (dynamic: (CLAUDE.md+AGENTS.md chars × 0.3)+3500 ≈ 11–13k) · compact-restore: compact_size + sys_fixed
- `CACHE_READ` / `CACHE_WRITE` — from API usage fields · `cache_hit% = CACHE_READ / (CACHE_READ + uncached_input) × 100` · target ≥ 60%

**Provider formula selection (read `api_provider` / `token_formula` from detected.md — see §Provider Profiles):**
- `anthropic` → use the baseline Formulas below as-is (calibrated for the Claude tokenizer). Cache read ≈ 0.1× input.
- `openai` → tiktoken-style: English ≈ chars/4 (≈ 0.25/char); code/structured denser → 0.30/char; thinking tokens count as output; cache read ≈ 0.1× input.
- `google` → multi-byte correction: Latin ≈ 0.27/char, CJK/Thai ≈ 1.0/char; ⚠️ input >200000 → reprice the WHOLE request (in+out) at long-context rate before logging (200K cliff).
- `generic` (provider unknown) → average / generic fallback: use the baseline Formulas below AND assume NO cache discount (cold every turn — most conservative).
- ⚠️ Never apply one provider's cache cost factor to another (§Provider Profiles). api_provider missing/unknown → generic fallback + no-cache assumption.
- **PostToolUse hook (`scripts/posttool_track.py`, T-178)** consumes this profile: it imports `token_estimator.PROVIDER_MULTS` + `_load_provider_formula()` and accumulates SESSION_TOTAL/CHAT_TOTAL using the detected provider's `tool` multiplier (anthropic 0.3 / openai 0.27 / google 0.27 / generic 0.35). Import failure → generic 0.35 fallback (fail-safe). CHAT uses the same delta as SESSION (no ×1.5 — true API context ≈1.5–2× this lower bound, doc note only).

Formulas: (baseline — `anthropic` and `generic` fallback)
- Output = (thai_chars × 1.7) + (en_chars × 0.3)
- Input = (user_msg_chars × 0.3) + tool_result_tokens
- Per-turn CHAT_TOTAL growth: CHAT_TOTAL += 700 + turn_tokens × 1.5  (calibrated T-046: actual ≈ 1.5–2×)
- 4-bucket: sys=sys_fixed/turns · tools=tool_result_tokens · hist=SESSION_TOTAL×0.4 · output=output_tokens
- ⚠️ Cache invalidation: tool schema edit → prefix reset → CHAT_TOTAL spike ≈ +sys_fixed · detected via [spike:cache-collapse]
- bucket_sys note: if schema edited this session → actual cost ≈ sys_fixed added back once (not amortized)

Each turn (in order):
1. Compute turn_tokens → SESSION_TOTAL += turn_tokens · CHAT_TOTAL += 700 + turn_tokens × 1.5
2. Write SESSION_TOTAL + CHAT_TOTAL to session_tokens.md EVERY turn, before the footer (persist-every-turn — closes CFP-031). Reset SESSION_TOTAL to 0 ONLY on: (1) user-confirmed /compact at an explicit mece compact-checkpoint (PATH B writes `session_reset=armed`), OR (2) task done + session close (PATH A/C). NEVER reset on stale/leftover compact_state.md or mid-task fresh boot. CHAT_TOTAL resets on /compact only.
   · T-180 single-source: `scripts/compact_reset.py` is the ONE place that recomputes counters after a compact (CHAT=compact_size+sys_fixed, LOOP=0, SESSION=0 if armed|phase:done else preserve, flips armed→consumed, prints `[compact-reset]`). Called by the SessionStart:compact hook (claude-code, automatic) and the C0 plain-text-confirm path (other providers). It mirrors the B1 formula exactly so B1 / hook / confirm never drift. Stuck-counter guard (C0.5): [compact-STOP] with ~same CHAT (±2k) across ≥2 turns = didn't-reset bug, not a real ceiling → run compact_reset.py instead of nagging.
3. Write JSONL entry → `.sessions/token_log.jsonl`: turn_id · timestamp · task_id · phase · session_total · chat_total · cache_read_tokens · cache_write_tokens · cache_hit_pct · bucket_sys/tools/hist/output · turn_tokens · hooks_overhead=700
   · bucket fields required — write 0 if value unknown (never omit fields from schema)
4. Footer: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*` · if SESSION_TOTAL >5k add `[sys:Nk tools:Nk hist:Nk out:Nk]`
   · Turn 1 with [compact-restore]: hook fires pre-B1 → use B1-written session_tokens.md values, not hook pre-B1 values

**Spike Detection — 6 alert types:**
| Alert | Condition | Emit |
|---|---|---|
| turn-spike | turn_tokens > 3 × avg_turn | `[spike:turn]` |
| cache-collapse | cache_hit_pct drops >20pp | `[spike:cache-collapse]` |
| loop-explosion | same tool ≥3× same turn | `[spike:loop-explosion]` |
| retrieval-inflation | bucket_tools > 0.5 × turn_tokens | `[spike:retrieval-inflation]` |
| output-runaway | bucket_output > 5k | `[spike:output-runaway]` |
| tool-result-inflation | single result > 200L | `[spike:tool-result-inflation]` |

**Cache Guardrail:** cache_hit_pct < 60% AND cache_read > 0 → emit `[cache-warn] hit%: NN% (target ≥60%)`
- ⚠️ Do not define token formulas in other skill files — use R1 values exclusively

### Tool Result Tokens (tiered — applied per result before adding to SESSION_TOTAL)

| Result size | Formula | Minimum |
|---|---|---|
| ≤ 150 lines | `result_chars × 0.3` | 200 tokens |
| 151–300 lines | `result_chars × 0.5` | 200 tokens |
| > 300 lines | `result_chars × 0.5 + 1,000 flat buffer` | 200 tokens |

Never use UTF-8 bytes ÷ 3 — undercounts Thai by up to 1.7×.

---

## R2 · Tool Budget
Max 5 tool calls/turn. Retry max 2×; diagnose on 2nd fail.

---

## Per-Turn Routing (every user message — before any work)

Run C0 → **C0.5** → C1 → C2 → C3 before any work. Topic switch = close current session FIRST.

**C0.5 — LOOP_WEIGHT Gate (Behavior Contract — runs every turn before C1):**
```
Pre:      read [token-state] hook → N=LOOP_W · S=SESSION_TOTAL · C=CHAT_TOTAL. PRIMARY signal = CHAT_TOTAL (real context size); LOOP_WEIGHT = SECONDARY tool-call-count hint, NOT token cost → neither hard-stops.
Contract: HARD STOP (genuine ceiling): S >90k OR C >120k → MUST emit [compact-STOP] as FIRST line → write compact_state.md → STOP (no new work). This is the ONLY hard stop.
          Strong rec (PRIMARY): C >80k (below ceiling) → MUST emit [compact-rec] strong as FIRST line — a recommendation WITH a choice, NOT a STOP. User decides; continue if they say so.
          Light hint (SECONDARY): N >50 (below ceiling) → emit [compact-rec] light (1 line, optional, no block) — flags high call-count, not context size.
          Precedence: ceiling > strong (CHAT_TOTAL >80k) > light (LOOP_WEIGHT >50). Ceiling met → emit [compact-STOP] only (skip rec tiers).
Post:     [compact-rec] strong MUST contain all 5 fields or response is invalid:
            Recommend /compact: <now | after this step | not yet>
            Why: <session ~Nk · what's heavy · pending task self-contained? y/n>
            MUST vs SHOULD: SHOULD (below the 90k/120k ceiling — recommendation, not command)
            Resume brief: <paste-ready, ≤5 lines>
            Your call: "/compact" now · "ทำต่อ" continue (re-check in ~N steps)
Enforce:  skip required tier (STOP or strong) = CFP-026 → emit [self-improve] CFP-026 → backfill immediately
```

**C0 — Complaint Check:**
- Detect signals: "ทำไมไม่ทำตาม" · "you skipped" · "ลืม" + harness step · "harness says" + violation
- "ลืม" qualifier: object MUST be a harness step name (roadmap/error_index/CFP/index/boot/skill/gate/MECE)
  "ลืมบอกให้เพิ่ม filter" = feature request → NOT C0
- c0_resolved flag set in working memory → clear flag → skip C0 → proceed to C1 (prevents loop)
- YES → emit [self-improve] → backfill missed step (ask if context gone) → log CFP → set c0_resolved=true → re-run C0-C3
- NO → C1

**C1 — Load state:** Read `.sessions/active_thread.md` → extract current task

**C2 — Topic Switch + Task Freshness Check:**
IS a switch (close session first):
  · Different app section · Different primary entity · Different intent type (debug→feature)
  · Message names a different route/module than current task
NOT a switch:
  · "also fix/update" · revision of approach · bug inside current work · "ต่อ/continue"
UNCERTAIN → emit [topic-unclear] → ASK before routing

Same topic detected → task-freshness check:
  `grep "status:\|^\- \[ \]\|^\- \[/\]" .sessions/mece_plan.md | head -3`
  status:task-complete OR task-mismatch OR no pending [ ]/[/] → NEW TASK (force Phase 1+2 · skip Phase 0 if same chat)
  pending [ ] or [/] found + task matches → resume Phase 3

**C3 — Route:**
- Topic switch → emit [topic-switch] Current: X · New: Y → session_manager close
  → check provider (`grep "^platform:" detected.md`):
    claude-code → /compact → Phase 1 fresh same chat
    other       → compact_state.md → "เปิด chat ใหม่ได้เลยครับ" → STOP
- Same topic → match keywords → re-read SKILL.md if skill changes

Routing shortcuts:
  "แก้ bug / fix / error"       → editor
  "สร้าง / implement / เพิ่ม"   → coder
  "ปิด / close / done"           → session_manager
  "plan / วางแผน"                → mece
  "review CFP / improve harness" → self_improve
  no match                       → agent (fallback)

---

## R3 · Session Pause Protocol
| Counter | Threshold | Action |
|---|---|---|
| SESSION_TOTAL | >40k + turns ≥8 | rolling summary: summarize prior 4 turns → `.sessions/session_memory.md` · keep last 2 raw |
| SESSION_TOTAL | >60k | finish current step → TOKEN PAUSE |
| SESSION_TOTAL | 80-90k | 🟡 [compact-rec] strong — recommend /compact (NOT forced · user choice) |
| SESSION_TOTAL | >90k | HALT → save state → report |
| CHAT_TOTAL | >80k | 🟡 [compact-rec] strong — PRIMARY trigger: recommend /compact + user choice (NOT a STOP) |
| CHAT_TOTAL | >120k | 🛑 HALT (hard ceiling) — save state → report |
⚠️ CHAT_TOTAL undercount: true API context ≈ CHAT_TOTAL × 1.5–2× (triangular re-send) · use as lower bound · compact before CHAT_TOTAL > 80k to avoid spike
| LOOP_WEIGHT | >50 | 🟡 [compact-rec] light hint only — SECONDARY: high call-count, not context size (no STOP) |
> Hard STOP = SESSION_TOTAL >90k OR CHAT_TOTAL >120k only. PRIMARY rec signal = CHAT_TOTAL >80k (real context size); LOOP_WEIGHT >50 is a secondary call-count hint, never hard-stops (Phase C+D).

---

## Model Tiers — Provider-Agnostic Configuration

**Set once at project setup. All harness files reference tier names — never hardcode model names.**

```
MODEL_HIGH   = <your high-capability model>   # structural reasoning, MECE plan, architecture (reserved — not routine code edits)
MODEL_MEDIUM = <your mid-tier model>           # analysis, code review, structured output
MODEL_LOW    = <your fast/cheap model>         # lookup, grep, read-only, single-output tasks
```

**Provider examples:**

| Tier | Anthropic (Claude) | Google (Gemini) | OpenAI |
|---|---|---|---|
| HIGH | claude-opus-4-8 | gemini-3.1-pro | gpt-5.5 |
| MEDIUM | claude-sonnet-4-6 | gemini-3.5-flash | gpt-5.4 |
| LOW | claude-haiku-4-5 | gemini-3.1-flash-lite | gpt-5.4-nano |

> Model IDs current as of Jun 2026 (see `knowledge/llm-api-pricing-comparison-2026-06.md`). Tier ladder: HIGH reserved for genuine structural reasoning; MEDIUM = capable workhorse writer (does the bulk of execution); LOW = grep/lookup/review.

**How to configure:** Agent fills in actual model IDs during project setup (Phase 1 §1.1).
Store in `.agents/platform/detected.md` under `model_high:` / `model_medium:` / `model_low:` fields.
The active provider is set in detected.md `api_provider:` — runtime resolves tier → that provider's column. All spawn calls in AGENTS.md use tier names — never hardcode model IDs.

**Routing rule (R4) — model × EFFORT · baseline = Sonnet (MEDIUM) @ low-med effort · provider resolved via detected.md `api_provider` · robustness floor: every skill must run on a MEDIUM-tier model WITHOUT inference:**
- `MODEL_LOW` @ low → lookup / grep / single-file read / Reviewer / Completion Gate
- `MODEL_MEDIUM` (Sonnet) @ low → mechanical edit / edit-as-instructed / classify / structured output
- `MODEL_MEDIUM` (Sonnet) @ medium → multi-step execution / code edits / Phase 3 sections ≥2 (workhorse — must produce complete detailed output without inference)
- `MODEL_HIGH` (Opus) @ high → MECE planning / architecture / structural reasoning ONLY (reserved — NOT for routine code edits)
- Rule: dial EFFORT first, tier second · escalate to MODEL_HIGH (Opus) ONLY for genuine structural reasoning (a strong model masking a vague step = the skill is still broken for weaker models)

---

## Provider Profiles — Cache & Token Rules per Provider

**Why this section exists:** cache mechanics and token-cost behavior differ per provider. Applying one provider's cache rules to another **breaks immediately** (e.g. placing Anthropic explicit breakpoints on an OpenAI request, or ignoring Google's 200K repricing cliff). Runtime MUST read `api_provider:` from `.agents/platform/detected.md` and apply ONLY that provider's row. Source rates: `knowledge/llm-api-pricing-comparison-2026-06.md`.

| api_provider | cache_mechanism | cache_write_cost | cache_read_cost | cache_TTL | context_cliff_tokens | token_formula |
|---|---|---|---|---|---|---|
| `anthropic` | explicit_breakpoint (must place `cache_control` on stable prefix) | 1.25× (5-min TTL) / 2× (1-hr TTL) | 0.1× (−90%) | 5 min / 1 hr | none (flat to 1M) | `anthropic` |
| `openai` | auto_prefix (automatic when prefix stable >~1024 tokens) | none | ~0.1× (−90%) | 5–10 min | ~270000 | `openai` |
| `google` | implicit + explicit | per-hour storage cost | ~0.1–0.25× (−75–90%) | varies | **200000** | `google` |
| _unknown_ | treat as no-cache (assume cold every turn) | — | — | — | assume 200000 (most conservative) | `generic` |

**Per-provider guardrails (hard):**
- **anthropic** — keep CLAUDE.md + AGENTS.md as a stable cached prefix; any mid-session edit to that prefix pays write cost again → emit `[schema-changed]`. Never `cache_control` dynamic blocks (user msg / tool results).
- **openai** — cache is automatic; just keep the prefix byte-stable. Short TTL (5–10 min) → compact before idle >10 min or lose the cached prefix.
- **google** — ⚠️ **200K cliff**: crossing 200K *input* reprices the ENTIRE request (input **and** output) at long-context rate — silent cost spike. Guard: warn + consider compact when approaching 200K with a Google provider.
- **unknown** — never assume a cache discount; never apply another provider's breakpoint syntax. Use `generic` token formula + the most conservative cliff.

**Resolution order:** detected.md `api_provider` → match row → apply cache_mechanism + token_formula. Missing/unknown → `generic` row. This profile is set once at B4 Platform Probe and read by R1 (token formula) and the cache-discipline rules.

---

## R4 · Sub-agent Decision
Run 1 Bash scope probe before any task.

**Spawn patterns (3 types):**

| Pattern | When | How |
|---|---|---|
| **Explore** | scope ≥ 5 files / ≥ 300 lines | `invoke_subagent` (TypeName: `"research"`) → summary ≤500 tokens → act on summary only |
| **Execution** | single section > 8 steps + isolated output | `invoke_subagent` (TypeName: `"self"`) → pass goal + constraints + output format → receive structured result |
| **Parallel fan-out** | ≥ 2 sections in same Cycle (no dependency) | `invoke_subagent` Subagents[...] (one per section) → each writes `.sessions/cycle_N_<section_id>.json` → read all results → pass as context to next Cycle → single Completion Gate after all Cycles |

**Hard limits:**
- Max depth: 1 level only — worker agents may NOT spawn further agents
- Sub-agent output: structured (JSON or table) — never prose
- Token budget: sub-agent tokens count toward SESSION_TOTAL (no separate budget)
- Parallel spawn: pass all sections as array in single `invoke_subagents` Subagents[] (not sequentially)
- Custom types: use `define_subagent` to register a new TypeName for the session before invoking

**Phase routing (override task-type tier when phase is known) — model × effort:**
| Phase | Tier | Effort | Reason |
|---|---|---|---|
| G1 Scan / G2 Reads | MODEL_LOW | low | Grep + classify only |
| MECE Plan M1-M3 | MODEL_HIGH | high | Structural reasoning |
| L1-L5 REACT Loop (mechanical / edit-as-instructed) | MODEL_MEDIUM | low | Explicit steps, no reasoning |
| L1-L5 REACT Loop (multi-step / code edits) | MODEL_MEDIUM | medium | Workhorse writer — complete output w/o inference (HIGH reserved for planning) |
| Reviewer (Completion Gate) | MODEL_LOW | low | Verify only — read-only |
Baseline when phase unknown: Sonnet @ low-med effort. Savings: route lookups+reviewer to MODEL_LOW + dial effort low for mechanical work → ~35%+ cost reduction vs all-HIGH @ high-effort.

**Harness Context in Sub-agent Prompts:**
- Explore agents (read-only): no harness constraints needed
- Execution/Coder agents (any src/ work): MUST include `constraints:` block:
  ```
  constraints:
    - Roadmap: task T-<N> must be [/] before any edit — grep docs/master_roadmap.md first
    - No src/ edit without gather_complete.md AND mece_plan.md written today
    - No new file without updating knowledge/index_files.json backlinks
    - No symbol create/rename without python scripts/symbol_indexer.py after edit
    - Domain-gated edits (per active domain pack `## domain_gates`, e.g. coding's src/db/): emit the pack's gate signal and halt — main agent must confirm
  ```
- Missing `constraints:` block in execution sub-agent prompt = CFP violation

**Multi-file relevance check — primary vs fallback:**

**Primary (spawn available):** Reading > 2 files to assess relevance → spawn Explore sub-agent instead.
- Prompt: file list + "return verdict per file: relevant | partial | irrelevant + excerpt if partial"
- Act on summary only — never inject sub-agent's full read results into main context
- Irrelevant content stays isolated in sub-agent context, not main history

**Fallback (spawn NOT available — platform-unknown, max depth = 1, or spawn error):**
Main agent must read directly — apply strict protocol:
1. Read one file at a time — Pre-Read Gate (T1/T2/T3) mandatory, no exceptions
2. Emit `[post-read]` verdict immediately after each read
3. Verdict `irrelevant` → stop reading that file — do NOT read further sections
4. Every 3 reads: compress relevant findings to ≤200 chars in working memory → release individual read results from active tracking
5. Hard cap: max 5 direct reads per relevance batch — if still unresolved → emit `[read-cap]` → ask user: "ช่วยบอกว่าข้อมูลที่ต้องการอยู่ที่ไฟล์ไหนครับ?"

---

## R5 · Index-First Lookup

**Pre-Read Gate — emit BEFORE every Read call:**
```
**[pre-read]** Target: `<symbol>` · Tier: T<1|2|3> · Line: <N> · Will read: offset=<N> limit=60
```
Cannot fill Line? → grep not done yet → run grep first.

**Post-Read Verdict — emit AFTER every Read result is processed:**

**[post-read]** Target: `<file>` · Verdict: `relevant | partial | irrelevant` · Action: `keep | excerpt(L<N>–L<N>) | drop`
- `relevant` → include as-is in `on_demand_files:` or `cycle_context:`
- `partial` → include only the stated excerpt range — not the full file
- `irrelevant` → drop immediately; do NOT include in `on_demand_files:`, `cycle_context:`, or any sub-agent prompt
- Failure to emit `[post-read]` = treat content as `irrelevant` → drop
- See CFP-004 in CODING_FAILURE_PATTERNS.md

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
CLAUDE.md · knowledge/index_files.json · knowledge/index_variables.json → in working memory after Boot.
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
Default: table/bullet over prose. Comparison → table. Steps → numbered list.

---

## R8 · Index Sync (MANDATORY after every file change)
| Event | Action |
|---|---|
| Create/delete/move file | Update knowledge/index_files.json + backlinks |
| Edit file (add/remove imports) | Update backlinks in knowledge/index_files.json |
| Create/delete/rename symbol | Update knowledge/index_variables.json + run python scripts/symbol_indexer.py |

---

## R9 · Error Protocol
⚠️ MANDATORY 3-step check before any debug:
1. grep knowledge/error_index.md for symptom keyword
2. grep knowledge/index_variables.json for affected symbol
3. grep knowledge/index_files.json for backlinks

**Step 0 — Recurring Fix Detection (run FIRST):**
Signals: "ยังไม่หาย" · "แก้แล้วยัง" · "still broken" · "same error" · "กลับมาอีก" · "fix ไม่ผ่าน" · "ยังเจออยู่" · "ยังเป็นอยู่"
OR: same ERR-XXX already [X] in roadmap / same T-N-BugID referenced
→ Recurring: grep roadmap for prior AttemptID → read `### Failed Approaches:` in error_index entry → choose DIFFERENT approach
→ Emit: `[recurring] ERR-XXX · Prior attempts: N · Previous approach: <summary> · New approach: <what's different>`

New error → Task ID format: `T-{ParentTask}-{BugID}-{AttemptID}` (e.g. `T-004-001-02`)
1. Add `[ ] T-{N}-{BugID}-01: <description>` to roadmap → set `[/]`
2. Fix code
3. Run python scripts/symbol_indexer.py
4. Assign ERR-XXX code
5. Write entry in knowledge/error_index.md (include Task ID + cross-link + `### Failed Approaches:` field)
6. Mark roadmap `[X] T-{N}-{BugID}-{Attempt} (→ ERR-XXX)`

**On R12 verify failure** — before escalating per R13, MUST write to error_index entry:
```
### Failed Approaches:
- [YYYY-MM-DD] T-{N}-{BugID}-01: <approach tried> → verify failed · Reason: <why it didn't resolve>
```

**Behavior Contract — Topic Lookup (fires before writing any new error_index.md entry):**
```
Pre:    new ERR-XXX being documented
Contract: grep knowledge/error_topics.md for matching topic id
          match found → set topic: <id> in entry · proceed
          no match → emit [topic-missing] domain:<desc> · add new topic to error_topics.md first · then write entry
Post:   every ERR-XXX entry has a valid topic: field from error_topics.md
Enforce: error_index entry without topic: field = [violation] BC-topic-lookup → add topic before continuing
```

**Behavior Contract — Active Fix (fires when it_work=false entry found during debug):**
```
Pre:    grep error_index.md for ERR-XXX matching current bug → entry found with it_work: false
Contract: MUST read failed_approaches: list → choose approach NOT in that list
          emit [active-fix] ERR-XXX · Avoiding: <prior approaches> · Trying: <new approach>
          after fix confirmed → update it_work: true + append to occurrences:
Post:   [active-fix] emitted before any fix attempt · entry updated on success
Enforce: debug attempt without reading failed_approaches = [violation] BC-active-fix → read first · re-attempt
```

---

## R10–R11 · Tool Cap + English
R10: Truncate all tool results at 300 lines. >300 → grep relevant section only.
**Tool-Result Offload:** tool result >50L → write full result to `.sessions/exec_log/<uuid>.txt` → inject only `[result-offloaded] path=<file> lines=<N>` into history. Agent reads file via Read tool if needed. (prevents triangular CHAT_TOTAL bloat)
- exec_log schema: `.sessions/exec_log/<uuid>.txt` — full tool result · agent reads on-demand
- Prune: `python3 scripts/trim_exec_log.py` before /compact (max 50 files · max age 24h)
R11: `.sessions/`, `knowledge/`, comments, commits → English only. Thai: user replies only.

---

## R12 · Post-Edit Verification

| Action | Verify |
|---|---|
| Edit `src/` | Re-read changed section · check no broken imports |
| DB schema | No ERR-007 violations |
| Create/delete file | `knowledge/index_files.json` updated + backlinks resolved |
| Error fix | ERR-XXX in error_index.md + roadmap `[X]` |

---

## R13 · Escalation
AttemptID=02 / tool error 2× / R12 FAIL twice → emit and halt:
```
[blocked] Task: `<T-ID>` · Attempts: 2 · Cause: <root cause> · Need: <missing>
```

---

## R14 · Destructive Action Gates
Emit `[gate]` + wait confirm before: delete/overwrite `knowledge/` or `.sessions/mece_plan.md` · any path in the active domain pack `## paths` `protected:` field (e.g. coding's `src/`, `src/db/`) · batch >5 files.
```
[gate] Action: `<what>` · Scope: `<files>` · Risk: `<why>` · Waiting: confirm
```

---

## R15 · Domain Hard Stop
Any edit matching the active domain pack `## domain_gates` `Pre:` condition (e.g. coding's `src/db/` or TS type with DB columns) → HALT immediately:
```
[db-gate] File: `<path>` · Symbol: `<name>` · Change: `<what>` · DB impact: `<tables>` · → Waiting for explicit "yes"
```
Do NOT proceed until user says "yes" explicitly.

---

## Never-Full-Load (hard — no exceptions)

These files must NEVER be fully read — grep or targeted offset+limit only:

```
CLAUDE.md                      → NEVER re-read (in context at boot)
knowledge/index_variables.json → grep ONLY · NEVER Read full
knowledge/index_files.json     → grep ONLY · NEVER Read full
CODING_FAILURE_PATTERNS.md     → grep -c + Read offset=N limit=30 per entry ONLY
docs/master_roadmap.md         → grep -n or tail -30 · NEVER full Read
INVARIANTS.md                  → on-demand when R14/R15 gate fires ONLY
knowledge/error_index.md       → grep → Read ≤40L ONLY
knowledge/index_cfp_fix.json   → full ok ≤30 entries · grep ONLY beyond 30
```

Full-Read permitted: `.agents/skills/*/SKILL.md` (≤80L) · `src/` ≤80L G2 only · `.sessions/active_thread.md` · `.sessions/session_handoff.md` · `.sessions/compact_state.md` · `REPO_MAP.md`

Violation → emit `[violation] never-full-load` → discard → re-run as grep.

---

## PostToolUse Hook — LOOP_WEIGHT Tracking

File: `.claude/settings.json` → `hooks.PostToolUse`

```json
{
  "type": "command",
  "command": "python3 -c \"\nimport os, subprocess\nroot = os.environ.get('CLAUDE_PROJECT_DIR')\nif not root:\n    try:\n        root = subprocess.check_output(['git','rev-parse','--show-toplevel'], stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()\n    except Exception:\n        root = os.getcwd()\ntool = os.environ.get('TOOL_NAME', '')\nweights = {'Agent': 3, 'Workflow': 3, 'WebFetch': 3, 'WebSearch': 3, 'Write': 2, 'NotebookEdit': 2}\nw = next((v for k, v in weights.items() if k in tool), 1)\nif 'mcp__' in tool:\n    w = 2\npath = os.path.join(root, '.sessions', 'session_tokens.md')\nif not os.path.exists(path):\n    exit(0)\nlines = open(path).readlines()\nnew_lines = []\nfor line in lines:\n    if line.startswith('LOOP_WEIGHT:'):\n        cur = int(line.split(':')[1].strip() or 0)\n        new_lines.append(f'LOOP_WEIGHT: {cur + w}\\n')\n    else:\n        new_lines.append(line)\nopen(path, 'w').writelines(new_lines)\n\"",
  "timeout": 5
}
```

---

## PreToolUse Hook — Phase Gate (ALL Edit/Write)

File: `.claude/settings.json` → `hooks.PreToolUse`

Blocks ALL Edit/Write/NotebookEdit tool calls unless Phase 1+2 state files are present and dated today.
**Exception:** paths containing `.sessions/` are always allowed (session state files).

```json
{
  "type": "command",
  "command": "python3 -c \"\nimport json, sys, os, subprocess\ndata = json.load(sys.stdin)\ntool = data.get('tool_name', '')\nif tool not in ('Edit', 'Write', 'NotebookEdit'):\n    sys.exit(0)\nfile_path = data.get('tool_input', {}).get('file_path', '') or data.get('tool_input', {}).get('notebook_path', '')\nif '.sessions/' in file_path:\n    sys.exit(0)\nroot = os.environ.get('CLAUDE_PROJECT_DIR')\nif not root:\n    try:\n        root = subprocess.check_output(['git','rev-parse','--show-toplevel'], stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()\n    except Exception:\n        root = os.getcwd()\ntoday = __import__('datetime').date.today().isoformat()\ngather = os.path.join(root, '.sessions', 'gather_complete.md')\nmece = os.path.join(root, '.sessions', 'mece_plan.md')\nerrors = []\nif not os.path.exists(gather):\n    errors.append('[gate] gather_complete.md missing — run Phase 1 first')\nelse:\n    content = open(gather).read()\n    if today not in content:\n        errors.append('[gate] gather_complete.md stale (not today) — re-run Phase 1')\nif not os.path.exists(mece):\n    errors.append('[gate] mece_plan.md missing — run Phase 2 first')\nelse:\n    content = open(mece).read()\n    if today not in content:\n        errors.append('[gate] mece_plan.md stale (not today) — re-run Phase 2')\nif errors:\n    print('\\n'.join(errors), file=sys.stderr)\n    sys.exit(1)\nsys.exit(0)\n\"",
  "timeout": 8,
  "statusMessage": "Phase gate check..."
}
```

---

## Cross-Platform Notes (macOS · Linux · Windows Git Bash/WSL)

> All hook commands MUST use python3 for file manipulation. Never use `sed -i ''` (macOS-only) or `sed -i` (Linux). Use the python3 pattern below for portability.

### Dynamic ROOT Pattern
```bash
# bash hooks — resolve project root without hardcoding
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
```
```python
# python3 hooks — resolve project root
import os, subprocess
root = os.environ.get('CLAUDE_PROJECT_DIR')
if not root:
    try:
        root = subprocess.check_output(['git','rev-parse','--show-toplevel'],
                                        stderr=subprocess.DEVNULL, cwd=os.getcwd()).decode().strip()
    except Exception:
        root = os.getcwd()
```

### File Update Pattern (replaces `sed -i`)
```python
# cross-platform in-place line replacement
lines = open(path).readlines()
new_lines = [new_value + '\n' if line.startswith(prefix) else line for line in lines]
open(path, 'w').writelines(new_lines)
```

### OS Support Matrix
| Feature | macOS | Linux | Windows (Git Bash) | Windows (WSL) |
|---|---|---|---|---|
| `git rev-parse --show-toplevel` | ✅ | ✅ | ✅ | ✅ |
| `python3 -c "..."` | ✅ | ✅ | ✅ (if Python installed) | ✅ |
| `sed -i ''` | ✅ | ❌ | ❌ | ❌ |
| `CLAUDE_PROJECT_DIR` env | ✅ (if set) | ✅ (if set) | ✅ (if set) | ✅ (if set) |

**Weight table:**
| Tool category | Weight |
|---|---|
| Agent · Workflow · WebFetch · WebSearch | 3 (L) |
| Write · mcp__* | 2 (M) |
| All others (Read · Edit · Bash · etc.) | 1 (S) |

Reset: B1 writes `LOOP_WEIGHT: 0` on every fresh session or compact-restore.

---

## M1.5 — compact_checkpoint Rule

**Trigger:** `sections ≥ 3 OR (sections × 6) > 30`

**Action:** insert `[/compact checkpoint]` in Sequential plan after section `ceil(N/2)`

**Template for Steps checklist:**
```
- [ ] /compact checkpoint
  Pre:  python3 scripts/compute_compact_size.py   # → compact_size · retention constant lives in the script (single source)
  Pre:  write compact_state.md (section=S<N> · step=<last-step> · skill=<name> · compact_size=<value>)
  How:  user runs /compact in terminal
  Post: SESSION_TOTAL=0 · LOOP_WEIGHT=0 · CHAT_TOTAL ≈ compact_size + sys_fixed
  Verify: cat .sessions/session_tokens.md → SESSION_TOTAL: 0 · LOOP_WEIGHT: 0
  Resume: new chat → "Resume T-<N> · Skill: <name> · ต่อจาก S<N+1>"
```

---

## R-Roadmap · All work must be logged
Before starting ANY task:
- New feature: `[ ] T-<N>: description`
- Bug fix: `[ ] T-{Parent}-{BugID}-{AttemptID}: description`
- Sub-task: `- [ ] T-<N>.{sub}: description`

Set `[/]` when starting → `[X]` when done.
---

## R16 · Self-Improvement Protocol (User Complaint Detection)

**Detection — treat as harness complaint if user message contains ANY of:**
- "ทำไมไม่ทำตาม" / "ไม่ได้ทำตาม" + harness context
- "ลืม" + harness step name (roadmap/error_index/CFP/index/pre-read/boot/skill/gate/MECE) — NOT feature/component name
- "ไม่ได้บันทึก" / "ไม่ได้ log" / "ไม่ได้ update" + (roadmap|error_index|index|CFP)
- "why didn't you follow" / "you skipped" / "you forgot" + rule/step reference
- "harness says" / "CLAUDE.md says" / "rule says" + implied violation
- Any correction where user explicitly names a harness step that was supposed to run

**On detection — run this sequence immediately (before resuming original task):**
```
[C0] COMPLAINT DETECTED
  1. Emit: [self-improve] Rule violated: `<R-number>` · Missed: `<what was skipped>`
  2. DO NOT argue, explain away, or justify the skip
  3. Execute the missed step NOW (context gone → ask user for missing info first → wait)
  4. Verify missed step completed → emit [✓ backfilled] `<what was done>`
  5. **MANDATORY tool call (same response):** Edit CODING_FAILURE_PATTERNS.md → append CFP entry immediately · no deferral
     CFP format: `## CFP-<N+1> · <title>` · Symptom · Root cause · Prevention · Detection signal
     After Edit: grep -c "^## CFP-" → verify count = N+1 · emit `[✓ CFP-<N+1>]`
  6. Set c0_resolved = true → re-run C0→C0.5→C1→C2→C3 with original user message
     (C0 detects c0_resolved → clears it → skips complaint check → proceeds to C1)
```

**CFP Logging Procedure:**
```
Step 1: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → get count N → next = CFP-(N+1)
Step 2: Append to CODING_FAILURE_PATTERNS.md:

## CFP-<N+1> · <Short Title of What Was Skipped>

**Symptom:** <What the user observed — what was missing>
**Root cause:**
- <Why agent skipped this step>
- <Which rule/phase was violated>
**Prevention:**
1. <Specific check to prevent recurrence>
2. <Where in the loop this check should live>
**Detection signal:** User message contains `<C0 keyword>` + <step name>

---

Step 2.5: Validate "Detection signal:" field
  Must contain ≥1 keyword from C0 signal list
  Keyword absent/vague → rewrite with matching keyword → then proceed
Step 3: Verify: grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md → N+1
```

**Hard rules:**
- Never skip CFP logging even if the fix is trivial
- Never re-use an existing CFP number — always increment
- Same pattern recurs → new CFP with `(recurrence of CFP-N)` note

```

---

## 11. AGENTS.md Template (Generic Harness)

Copy this file verbatim to `AGENTS.md` at project root.
Fill in `[PROJECT NAME]` and add project-specific rules in the placeholder at the bottom.

```markdown
<!-- BEGIN:agent-orientation -->
# Agent Orientation — Read Before Acting

You are operating inside the **[PROJECT NAME]** project. Rules apply to ALL agents regardless of vendor.

> **Full hard constraints → `CLAUDE.md` (You MUST read this file first and strictly follow all of its principles)** · **Destructive gates → `INVARIANTS.md`** · **Repo structure → `REPO_MAP.md`**

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: (cs_dt=$(grep "^dt=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 | cut -d' ' -f1); today=$(date +%Y-%m-%d); compact_restore=false; [ "$cs_dt" = "$today" ] && compact_restore=true && echo "[compact-restore]" && cat .sessions/compact_state.md && echo "---"; phase=$(grep "^phase:" .sessions/active_thread.md 2>/dev/null | awk '{print $2}'); sys_fixed=$(python3 -c "import os; print(int((os.path.getsize('CLAUDE.md') + os.path.getsize('AGENTS.md'))*0.3) + 3500)" 2>/dev/null || echo 11070); if [ "$compact_restore" = "true" ]; then cs=$(grep "^compact_size=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2 || echo "0"); ct=$((sys_fixed + ${cs:-0})); reset_marker=$(grep "^session_reset=" .sessions/compact_state.md 2>/dev/null | cut -d= -f2); if [ "$reset_marker" = "armed" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; sed -i '' 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null || sed -i 's/^session_reset=armed/session_reset=consumed/' .sessions/compact_state.md 2>/dev/null; echo "[reset-consumed] SESSION=0 · marker armed→consumed"; else st=$(grep "^SESSION_TOTAL:" .sessions/session_tokens.md 2>/dev/null | awk '{print $2}'); st=${st:-0}; printf "SESSION_TOTAL: $st\nCHAT_TOTAL: $ct\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; echo "[reset-skip] marker=${reset_marker:-absent} · SESSION preserved=$st"; fi; elif [ "$phase" != "in_progress" ]; then printf "SESSION_TOTAL: 0\nCHAT_TOTAL: $sys_fixed\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\n" > .sessions/session_tokens.md; fi; [ -f .sessions/session_tokens.md ] && python3 -c "p='.sessions/session_tokens.md';L=[('LOOP_WEIGHT: 0' if x.startswith('LOOP_WEIGHT:') else x) for x in open(p).read().splitlines()];open(p,'w').write(chr(10).join(L)+chr(10))" 2>/dev/null; cat .sessions/active_thread.md 2>/dev/null | tail -4; echo "---"; cat .sessions/session_tokens.md 2>/dev/null; echo "---"; grep -n "\[/\]" docs/master_roadmap.md 2>/dev/null | head -3; echo "---"; echo "CFP_COUNT: $(grep -c '^## CFP-' CODING_FAILURE_PATTERNS.md 2>/dev/null || echo 0)")
[B2] IF [compact-restore] in B1 output → parse sk= from compact_state.md → use as skill_name · SKIP manifest read (~1,300 tokens saved)
     ELSE IF prompt contains `skill: <name>` → skip manifest read · ELSE: grep keywords[] from skill-manifest.json (not full read) → identify skill_name
[B3] IF [compact-restore]: sha1 check sk_h= + mece_h= → hash match → SKIP SKILL.md + mece/SKILL.md reads (~2.9k tokens saved total)
     ELSE: Read .agents/skills/<skill_name>/SKILL.md offset=1 limit=80 → sections[] only · on_demand_files = lookup table for G2 (NOT loaded at boot)
           Also: Read .agents/skills/mece/SKILL.md offset=31 limit=110 → §Plan Format + §Execution Protocol into working memory
```

[B4] Platform Probe (run only if `.agents/platform/detected.md` has `platform: unknown`):
     → List available tools → match against known platforms (see detected.md Known Platform Mappings)
     → Found match → update detected.md → proceed
     → No match → emit [platform-unknown] → ask 4 co-development questions (see 07_platform.md)
     → B4 is skipped if detected.md already has a known platform value

- B1 auto-resets SESSION_TOTAL to 0 when phase ≠ in_progress (preserves in-progress sessions)
- Load CFP_COUNT from B1 output → store as `cfp_boot_count` in working memory (used by self_improve)
- If SESSION_TOTAL > 60k → warn user before proceeding

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N open> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <cfp_boot_count>`

> ⚠️ **Boot ending ≠ ready to work.** After Reply line 1 → run C0–C3 → then Phase 1.
> Reading SKILL.md at B3 is NOT Phase 1. Do NOT touch `src/` until `[✓ gather]` AND `[✓ MECE]` emitted.

---

## Per-Turn Routing (every user message — run C0→C0.5→C1→C2→C3 before any work)

**Hard rule:** Agent detects topic switch autonomously — user must NOT need to say "close session".

**C0 — Complaint Check:**
- Signals: "ทำไมไม่ทำตาม" · "ไม่ได้บันทึก" · "you skipped" · "ลืม" + harness step · "harness says" + violation
- "ลืม" qualifier: object must be a harness step name (roadmap/error_index/CFP/index/boot/skill/gate/MECE)
  "ลืมบอกให้เพิ่ม X" = feature request → NOT C0
- c0_resolved flag set → clear → skip C0 → proceed to C1 (prevents infinite C0 loop)
- YES → [self-improve] → backfill → CFP log → c0_resolved=true → re-run C0-C3
- NO → C0.5

**C0.5 — Compact / Token Pre-Check (every turn, before C1):**
- Read the `[token-state]` hook values: LOOP_W · SESSION · CHAT. PRIMARY signal = CHAT_TOTAL (real context size); LOOP_WEIGHT = secondary tool-call-count hint only.
- CHAT_TOTAL > 80k → emit `[compact-rec]` strong (recommend /compact · NOT a stop · user decides)
- LOOP_WEIGHT > 50 → emit `[compact-rec]` light hint only (secondary · optional · no stop)
- HARD STOP only at the real ceiling: SESSION_TOTAL > 90k OR CHAT_TOTAL > 120k → emit `[compact-STOP]` → write compact_state.md → STOP
- Stuck-counter guard: `[compact-STOP]` firing with ~same CHAT_TOTAL (±2k) across ≥2 turns = the counter did NOT reset after a compact (the bug), NOT a real ceiling → run `python3 scripts/compact_reset.py --trigger=user-confirm` → surface its `[compact-reset]` line · do NOT keep nagging

**C1 — Load:** Read `.sessions/active_thread.md` → extract task: field

**C2 — Topic Switch Check:**
IS a switch (close first):
  · Different app section (site-plan ↔ center ↔ admin ↔ report)
  · Different primary entity (job ↔ user ↔ plan ↔ request)
  · Different intent type (debug→feature or feature→debug)
  · Message names different route/module than current task
NOT a switch:
  · "also fix/update" · revision of approach · added constraint
  · Bug inside current work · "ต่อ/continue/keep going"
UNCERTAIN → emit [topic-unclear] → ASK before routing

**C3 — Route:**
Topic switch → emit [topic-switch] Current: X · New: Y · Closing first
             → session_manager §3 (close + reset) → new Phase 1
Same topic   → match keywords[] → re-read SKILL.md if skill changes

> ⚠️ **After C3 (any branch) → MANDATORY: Phase 1 G1-G2-G3 next. No exceptions.**
> Knowing the skill (B3) does NOT satisfy Phase 1. Must grep indexes + read files + emit `[✓ gather]`.
> `[✓ gather]` MUST write `.sessions/gather_complete.md` with `date: YYYY-MM-DD`.
> Then Phase 2: MECE plan → user confirm → write `mece_plan.md` → emit `[✓ MECE]`.
> **PreToolUse hook blocks `src/` Edit if `gather_complete.md` or `mece_plan.md` missing or stale (not written today).**

| Keywords | Skill |
|---|---|
| แก้ bug / fix / error / debug | editor |
| สร้าง / implement / new / เพิ่ม | coder |
| ย้าย / ลบ / rename file | file_manager |
| ปิด / close / done / จบ | session_manager |
| plan / วางแผน / mece | mece |
| review CFP / improve harness / self improve | self_improve |
| no match | agent (fallback) |

---

## Loop Architecture

| Phase | What happens |
|---|---|
| 1 Info Gather | **Hybrid front-loaded:** G1 scans ALL sections at once → output missing_files[] + missing_user_input[] · G2 runs ALL greps in one Bash call → targeted Read per item · Single user ask (max 1 per Phase 1 run) if input still missing → emit [✓ gather] |
| 2 MECE Plan | Build plan (1:1 Skill sections) → Verify-N per section → user confirms → roadmap |

**[G0] Task clarity gate** — run ONCE before G1:
- Skip G0 if task has ≥3 of: specific feature name · file/path · error message · "fix/add/update X in Y"
- Otherwise → `AskUserQuestion` — **MUST include options per question (never open-ended only)**:
  - Goal: what outcome? · options = [add feature / fix bug / refactor / other]
  - Affected area: which module/file? · options = sections from REPO_MAP.md (read at G0 — in Never-Full-Load whitelist)
  - Constraints: limits? · options = [none / list specific]
  - Definition of done: acceptance test? · options = [passes tests / UI works / data correct / other]
- **Refusal contract:** user ignores ≥2 rounds → emit `[gather-refused]` · HALT (don't proceed to G1)
- **Output contract:** on spec complete → gather_complete.md must include: `objective` · `constraints` · `affected_files` · `acceptance_criteria` · `verification_intent`
- G0 runs ONCE only → if still unclear → `[gather-stalled]`

**Gather rules:**
- G1: scan ALL sections in one pass — never one section at a time
- G2: batch ALL greps into one Bash call — never one grep per turn
- User ask: combine ALL missing items into ONE message — never ask incrementally
- Stall cap: if after G1+G2+1 user ask context still insufficient → emit `[gather-stalled]` → halt Phase 1
- Spec completeness (new feature tasks): G3 must confirm all 5 fields present: goal · constraints · affected files · acceptance criteria · verification plan
- max_clarification_rounds: 5 → after 5 rounds still incomplete → `[gather-stalled]`
| 3 | Execution | Cycle Gate → group sections into Cycles → CYCLE LOOP: spawn Cycle N parallel → await → read cycle_N_*.json → spawn Cycle N+1 → Completion Gate |

**Phases 1–2 run ONCE per task. On resume: skip to Phase 3 at pending section.**

Completion Gate:
**Token Check (run first):**
- SESSION_TOTAL > 60k AND compact not yet run? → compact first → then run Completion Gate checks
- SESSION_TOTAL 60-80k (still high after compact)? → TOKEN PAUSE before Completion Gate · > 90k → HALT
```
□ All sections executed  □ Writes [✓ written]  □ Index Sync
□ Roadmap [X]           □ phase: done          □ SESSION_TOTAL written → .sessions/session_tokens.md
□ Write session_summary → .sessions/token_log.jsonl before /compact
□ Feedback & Error Summary delivered to user (see mece/SKILL.md Final Step)
□ Clear mece_plan.md Phase 1–3 (PATH A) — NEVER ad-hoc (CFP-025) · use exact command from mece_plan_schema.md §PATH A
```
Tool schema serialization: JSON key ordering MUST be stable — unstable serialization invalidates prompt cache prefix silently (→ cache-collapse spike)

---

## Backlink Rule

Before editing any file:
```bash
grep -A 6 '"src/path/to/file"' knowledge/index_files.json
```
Check `backlinks[]` — every file listed imports the file you are about to edit. Update all of them.

---

## Quick Reference

| Rule | Requirement |
|---|---|
| Token footer | Every response: `*(Session total: ~NNN tokens)*` |
| File reads | grep index first → Read offset+limit only (never full file >60 lines) |
| Symbol edits | grep index_variables → check used_in → emit [pre-edit] |
| Destructive actions | INVARIANTS.md §I1 — emit [gate] and wait confirm |
| Error protocol | error_index → symbol_index → file_index (all 3 in order) |
| Roadmap | Every task logged before execution. `[ ]` → `[/]` → `[X]` |
| Session close | route `session_manager` — writes: `active_thread.md` · `session_tokens.md` · `session_handoff.md` · session JSON · `master_roadmap.md` → SESSION_TOTAL: 0 |
| Topic switch | New task = new session JSON — never carry raw History across tasks |

---

## Reference Files

| File | Purpose |
|---|---|
| `INVARIANTS.md` | Destructive gates (I1) + hard stops (I2) |
| `REPO_MAP.md` | Directory layers, protected zones, quick lookup commands |
| `CODING_FAILURE_PATTERNS.md` | Known agent failure modes (fill as bugs occur) |
| `knowledge/error_index.md` | ERR-XXX error log (search first before any debug) |
| `docs/master_roadmap.md` | Task checklist |

---

## Critical Project-Specific Rules

<!-- EDIT: Add hard rules specific to this project's stack.
     Examples:
     - Database constraints (no multi-row inserts, no upsert on conflict, no float in int columns)
     - Runtime constraints (no Node.js APIs in edge runtime, WebCrypto only)
     - Parsing rules (always use library X, never manual split)
     Reference INVARIANTS.md for destructive-action gates. -->
<!-- END:agent-orientation -->
```

---

## 12. INVARIANTS.md Skeleton

Copy to `INVARIANTS.md`. Fill in I2 with project-specific hard stops.

```markdown
# INVARIANTS.md — Destructive Action Gates

> Hard stops for this project. Every AI agent must check this file before any irreversible action.

---

## I1 · Destructive Action Gate

Before any of these actions → emit `[gate]` → ask user → wait for explicit "yes":

- Deleting files or directories
- Overwriting existing data (DB write, file overwrite, bulk update)
- Running `rm`, `drop`, `truncate`, `DELETE` without scoped WHERE
- `git reset --hard`, `git push --force`, `git checkout --`

---

## I2 · DB Structure Hard Stop

**Any trigger below = HALT immediately. Do NOT touch anything until user says "yes" explicitly.**

Triggers (any one is enough — per active domain pack `## domain_gates` · defaults shown are coding pack examples):
- Edit to any file matching the domain pack gate path (e.g. coding's `src/db/`: schema, migration, seed, connection, queries)
- Rename, remove, or change a protected type/interface listed in the domain pack gate (e.g. coding's TS type with DB column fields)
- Any symbol in `knowledge/index_variables.json` with type `DBTable`, `DBColumn`, or `DrizzleSchema`
- Domain-specific structural change listed in the pack `## domain_gates` (e.g. coding's adding/removing columns, changing column types)

Gate — emit and WAIT before any tool call:
```
[db-gate] File: `<path>` · Symbol: `<name>` · Change: `<what will change>`
          DB impact: `<tables/columns affected>` · Data risk: `<what could break>`
          → Waiting for explicit "yes" — NOT proceeding until confirmed
```

**"It's just a TypeScript type" is NOT an exemption.**
Drizzle derives DB schema from TypeScript types — a type rename silently breaks migrations and queries.

> ⚠️ Project-specific hard rules now live in the active domain pack (`domain/<name>.md` `## critical_rules` + `## domain_gates`), not here — e.g. coding's Miniflare D1 multi-row INSERT restriction, edge runtime (WebCrypto only), CSV parsing rules.
> Reference: INVARIANTS.md I2 for canonical source.

---

## I3 · Knowledge Index Sync

After any symbol create/delete/rename → MUST update both indexes before closing task:
- `knowledge/index_variables.json` — symbol entry + line numbers
- `knowledge/index_files.json` — backlinks

Run: `python scripts/symbol_indexer.py` to regenerate.

---

## I4 · Pre-Edit Symbol Check (Required)

Before editing any symbol that appears in `knowledge/index_variables.json`:
```bash
grep -A 8 '"SymbolName"' knowledge/index_variables.json   # check used_in array
```
Emit and log:
```
[pre-edit] Symbol: `<name>` · used_in: <N files> · safe to edit: <yes|needs review>
```

## I5 · Roadmap Entry Required

Every task (bug fix, feature, enhancement) must exist in `docs/master_roadmap.md` before execution.
Never duplicate task IDs. grep roadmap before creating.

---

## I6 · Pre-assign Roadmap IDs Before Parallel Spawn

When spawning parallel sub-agents — pre-assign ALL roadmap task IDs BEFORE any spawn call:
1. `grep docs/master_roadmap.md` → find last T-N
2. Write `[ ] T-N+1`, `[ ] T-N+2`, ... for ALL sections BEFORE spawning any agent
3. Pass assigned T-ID to each sub-agent in its Delegation Contract
Sub-agents MUST NOT self-assign IDs — race condition causes duplicate T-IDs.

---

## I7 · Cycle Token Accounting (tokens_estimated mandatory)

Every sub-agent result file (`.sessions/cycle_N_<id>.json`) MUST include `"tokens_estimated"` field.
After all Cycle N agents complete — orchestrator must:
1. Sum `tokens_estimated` from all `cycle_N_*.json` files
2. Missing field → add 2,000 flat (buffer)
3. Add sum to SESSION_TOTAL in working memory
4. Write updated total → `.sessions/session_tokens.md`
5. Check R3 threshold immediately after writing

---

## I8 · CFP ID Pre-assignment (Parallel Sessions)

When multiple parallel agents may log CFPs:
1. `grep -c "^## CFP-" CODING_FAILURE_PATTERNS.md` → get count N
2. Pre-assign CFP-N+1, CFP-N+2, ... before spawn
3. Pass assigned IDs to sub-agents in Delegation Contract
Sub-agents MUST NOT auto-increment without pre-assignment — causes duplicate CFP numbers.

---

## Protected Zones

<!-- EDIT: List files/directories that must NEVER be overwritten without user confirmation.
     Examples:
     - CLAUDE.md · AGENTS.md · INVARIANTS.md — system files
     - docs/master_roadmap.md — task ledger
     - knowledge/index_files.json · knowledge/index_variables.json — indexes
     - db_migrations/ — never edit manually; use migration tooling only
-->
```

---

## 13. REPO_MAP.md Skeleton

Copy to `REPO_MAP.md`. Fill in directory layout and project-specific zones.

```markdown
# REPO_MAP.md — Repository Structure & Protected Zones

---

## Directory Layout

```
<!-- EDIT: Document your project's source tree here. Example:
src/
├── app/           # Next.js app router pages
├── components/    # Shared UI components
├── lib/           # Utilities and helpers
└── db/            # Database schema and queries
-->

knowledge/         # Agent indexes — managed by agent + symbol_indexer.py
.agents/skills/    # Skill definitions
.sessions/         # Session state
docs/              # Roadmap and logs
scripts/           # Automation scripts (symbol_indexer.py)
```

---

## Protected Zones

| Path | Rule |
|---|---|
| `knowledge/` | Never delete manually — managed by agent |
| `.sessions/` | Never delete manually — session state |
| `docs/master_roadmap.md` | Edit only via agent workflow (`[ ]` → `[/]` → `[X]`) |

<!-- EDIT: Add project-specific protected zones -->

---

## Quick Lookup Commands

```bash
# Find file by name
find src/ -name "*.ts" | grep "keyword"

# Find symbol definition
grep -rn "export.*FunctionName" src/

# Check who imports a file
grep -A 6 '"src/path/to/file"' knowledge/index_files.json

# Find all usages of a symbol
grep -rl "SymbolName" src/
```

<!-- EDIT: Add project-specific module boundaries and lookup patterns -->
```

---

## skill-manifest.json Template

Copy to `.agents/skills/skill-manifest.json`. Add or remove skills to match your project.

```json
{
  "version": "2.1",
  "_comment": "Machine-readable skill routing. on_demand_files = lookup table for G2 only — NOT auto-loaded at boot.",
  "_schema_note": "Each on_demand_files entry: { path, when, how }. 'how' values: grep_only | targeted | full_ok (≤30 lines only) | grep_headers_then_append",
  "boot_read_policy": {
    "_note": "Files that MAY be read at boot — all others on_demand only",
    "B1_bash_only": [".sessions/active_thread.md", ".sessions/session_tokens.md", "docs/master_roadmap.md (grep [/] only)", "CODING_FAILURE_PATTERNS.md (grep -c only)"],
    "B3_sections_only": "Read SKILL.md offset=1 limit=80 — sections[] and skill name only",
    "never_at_boot": ["knowledge/index_variables.json", "knowledge/index_files.json", "INVARIANTS.md", "REPO_MAP.md", "CODING_FAILURE_PATTERNS.md (full read)", "docs/master_roadmap.md (full read)"]
  },
  "default_skill": "editor",
  "skills": {
    "editor": {
      "path": ".agents/skills/editor/SKILL.md",
      "keywords": ["แก้", "fix", "bug", "edit", "debug", "เปลี่ยน", "ปรับ", "อัปเดต", "update", "modify"],
      "on_demand_files": [
        { "path": "knowledge/index_variables.json", "when": "looking up symbol line number or used_in list", "how": "grep_only" },
        { "path": "knowledge/index_files.json",     "when": "checking backlinks before editing a file",        "how": "grep_only" },
        { "path": "INVARIANTS.md",                  "when": "R14/R15 gate fires (DB change or destructive op)","how": "targeted" },
        { "path": "CODING_FAILURE_PATTERNS.md",     "when": "writing a new CFP entry only",                   "how": "grep_headers_then_append" }
      ]
    },
    "coder": {
      "path": ".agents/skills/coder/SKILL.md",
      "keywords": ["สร้าง", "create", "new file", "implement", "feature", "add", "เพิ่ม"],
      "on_demand_files": [
        { "path": "knowledge/index_files.json",  "when": "checking file exists or backlinks before creating", "how": "grep_only" },
        { "path": "docs/master_roadmap.md",      "when": "assigning new T-ID (check for duplicates)",        "how": "grep_only" },
        { "path": "INVARIANTS.md",               "when": "R14/R15 gate fires (DB change or destructive op)", "how": "targeted" }
      ]
    },
    "file_manager": {
      "path": ".agents/skills/file_manager/SKILL.md",
      "keywords": ["move", "rename", "delete file", "restructure", "ย้าย", "ลบ", "เปลี่ยนชื่อ"],
      "on_demand_files": [
        { "path": "knowledge/index_files.json", "when": "updating backlinks for changed file", "how": "grep_only" }
      ]
    },
    "variable_manager": {
      "path": ".agents/skills/variable_manager/SKILL.md",
      "keywords": ["rename symbol", "refactor", "export", "symbol", "function name"],
      "on_demand_files": [
        { "path": "knowledge/index_variables.json", "when": "updating symbol entry after code change", "how": "grep_only" }
      ]
    },
    "session_manager": {
      "path": ".agents/skills/session_manager/SKILL.md",
      "keywords": ["จบ session", "close", "end session", "สรุป session", "ปิด session"],
      "on_demand_files": [
        { "path": ".sessions/active_thread.md",   "when": "checking current phase at routing",   "how": "full_ok" },
        { "path": ".sessions/session_handoff.md", "when": "resume flow or blocked state",         "how": "full_ok" },
        { "path": ".sessions/session_tokens.md",  "when": "writing SESSION_TOTAL at checkpoint", "how": "full_ok" }
      ]
    },
    "mece": {
      "path": ".agents/skills/mece/SKILL.md",
      "keywords": ["plan", "วางแผน", "mece", "orchestrate", "phases"],
      "on_demand_files": []
    },
    "agent": {
      "path": ".agents/skills/agent/SKILL.md",
      "keywords": ["orchestrate", "multi-step", "coordinate", "spawn", "จัดการหลายขั้นตอน", "cycle", "fan-out", "orchestrate cycles"],
      "on_demand_files": []
    },
    "identity": {
      "path": ".agents/skills/identity/SKILL.md",
      "keywords": ["identity", "session state", "who am i", "current skill", "ตัวตน"],
      "on_demand_files": []
    },
    "token_auditor": {
      "path": ".agents/skills/token_auditor/SKILL.md",
      "keywords": ["token limit", "context full", "approaching limit", "token threshold"],
      "on_demand_files": [
        { "path": ".sessions/session_tokens.md", "when": "reading current total for audit", "how": "full_ok" }
      ]
    },
    "token_tracker": {
      "path": ".agents/skills/token_tracker/SKILL.md",
      "keywords": ["token count", "session total", "how many tokens", "นับ token"],
      "on_demand_files": [
        { "path": ".sessions/session_tokens.md", "when": "Boot B1 read (once) and checkpoint write", "how": "full_ok" }
      ]
    },
    "self_improve": {
      "path": ".agents/skills/self_improve/SKILL.md",
      "keywords": ["review CFP", "improve harness", "ปรับปรุง harness", "CFP review", "self improve", "failure pattern", "ปรับปรุงตัวเอง"],
      "on_demand_files": [
        { "path": "CODING_FAILURE_PATTERNS.md", "when": "reading CFP headers for analysis (grep -c first)", "how": "targeted" },
        { "path": "CLAUDE.md",  "when": "proposing rule injection into CLAUDE.md", "how": "targeted" },
        { "path": "AGENTS.md",  "when": "proposing rule injection into AGENTS.md", "how": "targeted" }
      ]
    },
    "ascii_flow": {
      "path": ".agents/skills/ascii_flow/SKILL.md",
      "trigger": "Creating or updating ASCII flow diagrams, architecture charts, flow documentation in .md files",
      "keywords": ["flow diagram", "ascii flow", "flowchart", "architecture diagram", "flow doc", "create flow", "update flow", "draw diagram", "draw flow"],
      "on_demand_files": [
        { "path": "knowledge/harness_flow_20260525.md", "when": "reading existing flow as style reference", "how": "targeted" }
      ],
      "invoke_from": "Any skill that creates/edits a .md file containing box diagrams must call this skill"
    },
    "harness_doctor": {
      "path": ".agents/skills/harness_doctor/SKILL.md",
      "trigger": "CFP pattern recurred after a fix was applied — structural harness repair needed",
      "keywords": ["harness doctor", "fix harness pattern", "recurring cfp", "ซ่อม harness", "cfp recurred", "structural fix"],
      "on_demand_files": [
        { "path": "knowledge/index_cfp_fix.json", "when": "loading recurrence data for top recurring CFP", "how": "full_ok" },
        { "path": "CODING_FAILURE_PATTERNS.md", "when": "reading CFP entry details (grep + targeted Read)", "how": "targeted" }
      ]
    }
  }
}
```

---

## registry.md Template

Copy to `.agents/skills/registry.md`. Human-readable fallback routing table.

```markdown
# Skill Registry — Fast Match Table

> Fallback when skill-manifest.json lookup is ambiguous. List keyword → skill mappings.

| Keyword / Intent | Skill |
|---|---|
| แก้ bug / fix / debug | editor |
| สร้างไฟล์ใหม่ / create / implement | coder |
| ย้าย / ลบ / rename file | file_manager |
| rename symbol / refactor export | variable_manager |
| จบ session / close / สรุป | session_manager |
| วางแผน / orchestrate multi-step | agent |
| token limit warning | token_auditor |
| review CFP / improve harness / self improve | self_improve |

## Default
No match → load `agent` skill (fallback to routing).

> **`mece` trigger priority** (highest → lowest): (1) Loop Phase 2 auto-run — fires ONCE per task; task boundary = Per-Turn skill change. Before overwriting `.sessions/mece_plan.md`, save existing plan to `.sessions/mece_plan_prev.md`. (2) Prefix before `editor` — when >1 file is affected by a fix. (3) Primary skill — when keywords like "implement/refactor" are the main intent. All three can apply; Phase 2 auto-run always supersedes.

## Micro-rules
- MECE plan required for tasks >3 steps or any irreversible action
- MECE plan sections MUST include `Skill:` field (editor|coder|file_manager|variable_manager|agent)
- token_auditor gates: >60k warn · >90k halt
- session_manager closes with 5 mandatory writes: Step 0 = self_improve CFP review FIRST → then session JSON + active_thread.md + session_tokens.md + session_handoff.md
- session_handoff.md must include: mece_plan_hash · cfp_boot_count · cfp_deferred · cfp_dismissed · last_self_improve_session
- On close: enumerate any `.sessions/cycle_N_*.json` files written this session in the confirmation reply
- Parallel sub-agent spawns: pre-assign T-IDs (I6) and CFP-IDs (I8) BEFORE spawning
- Cycle result files MUST include `tokens_estimated` field (I7)

## Learned Routes (auto-updated — fast match before skill lookup)

| Keyword/Pattern | Skill | Score | Uses | Last Gap |
|---|---|---|---|---|
| _(auto-populated by session_manager after 3+ confirmed uses: pattern → skill)_ | | 4.0 | 0 | null |

## Scoring Rules
- Task success: score +0.1 (max 5.0)
- CFP logged or friction note written: score -0.5
- score < 2.5: route flagged unreliable → fallback to default skill (`editor`)
- Threshold: pending friction notes for same skill ≥ 2 → alert user before next task
```

---

## docs/master_roadmap.md Template

Copy to `docs/master_roadmap.md`. Replace `[PROJECT NAME]` and add feature sections.

```markdown
# Master Project Roadmap: [PROJECT NAME]

> **📌 CURRENT ACTIVE FOCUS:** Phase 1 - Project Initialization & Architecture Setup
> **📊 OVERALL PROGRESS:** 0%

---

## 📚 System Documentation (Governance)
- `docs/master_roadmap.md`: แผนงานหลัก (อัปเดตตลอด)
- `docs/domain_rules.md`: กฎและ Business Logic ที่ตายตัว
- `knowledge/error_index.md`: แหล่งรวมความรู้สำหรับแก้ Bug และ Error

---

## 🖥️ Phase 1: Project Foundation

### Feature 1.1: Core Setup
- [X] T-000: ติดตั้งระบบ Agent และโครงสร้างพื้นฐาน

<!-- Add feature sections below. Format:
### Feature N.N: Name
- [ ] T-001: description (session_NNN)
- [/] T-002: in progress (session_NNN)
- [X] T-003: done (session_NNN)
-->

---

### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
```

---

## CODING_FAILURE_PATTERNS.md Template

Copy to `CODING_FAILURE_PATTERNS.md` at project root. Agent adds entries whenever a bug requires ≥2 fix attempts.

```markdown
# Coding Failure Patterns

> Agent adds an entry here whenever a fix requires ≥2 attempts. Search this file before attempting any similar fix.

---

<!-- Entry format:
## CFP-NNN · [Short title]
- **Symptom:** What the error looks like / what went wrong
- **Root Cause:** Why it happens (the real reason, not the surface error)
- **Wrong approach:** What was tried first (and why it failed)
- **Resolution:** The correct fix
- **Files affected:** src/path/to/file.ts
- **Task:** T-NNN-NNN · Session: session_NNN
-->
```

---

## Trace Token Reference

All valid trace tokens agents must emit. Include in `CLAUDE.md` Quick Reference.

| Token | When to emit |
|---|---|
| `**[Boot]**` | First line of every session response |
| `**[pre-read]**` | Before every file read (index-first lookup) |
| `**[pre-edit]**` | Before editing any symbol — after used_in check |
| `**[gate]**` | Before any destructive action (I1) — wait for confirm |
| `**[db-gate]**` | Before any DB schema change (I2) — wait for confirm |
| `**[R8]**` | After file create/edit/delete — running symbol_indexer.py |
| `**[loop]**` | After each MECE section completes |
| `**[compact-rec]**` | When SESSION_TOTAL > 60k — recommend /compact (not forced · user decides), continue working |
| `**[pause]**` | When SESSION_TOTAL 60-80k — TOKEN PAUSE, save state, ask user · > 90k → HALT |
| `**[resume]**` | When resuming an in_progress thread |
| `**[tokens]**` | Token checkpoint (A=before, B=after, C=final) |
| `**[MECE]**` | MECE plan sent to user — waiting confirm |
| `**[topic-switch]**` | New task = different topic → close session first → new Phase 1 |
| `**[topic-unclear]**` | Topic ambiguous → ask user before routing |
| `**[self-improve]**` | R16 complaint detected → backfill missed step |
| `**[cfp-tally]**` | New CFPs found at session close |
| `**[cfp-skip]**` | No new CFPs → skip CFP review |
| `**[cfp-deferred]**` | User skipped proposal → save count |
| `**[✓ harness-updated]**` | Harness file edited + verified by self_improve |
| `**[platform-unknown]**` | detected.md has platform: unknown → ask 4 questions |
| `**[plan-stale]**` | Resume + mece_plan_hash mismatch / src/ changed → ask reconfirm |
| `**[gather-stalled]**` | Phase 1 gather loop hit cap (3 iterations) → ask user |

---
