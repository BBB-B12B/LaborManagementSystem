# Agent Orientation — Asset Plan · ALL agents
> Framework/library read-first hints are domain-specific → see the active domain pack `## framework` (domain/<name>.md).
> Constraints → `CLAUDE.md` · Gates → `INVARIANTS.md` · Structure → `REPO_MAP.md` · Domain layer → `domain/<active>.md`

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
- B1 single-source note (T-180): `scripts/compact_reset.py` mirrors this exact CHAT formula + the consume-once `session_reset=armed→consumed` flip. The SessionStart:compact hook (settings.json) and the C0 COMPACT-CONFIRM path both call it, so the post-compact recompute is identical whether it runs at boot, on the hook, or on a user confirm — no logic drift.
- B1 LOOP_WEIGHT reset (BUG-3 fix): LOOP_WEIGHT is context-window-scoped → forced to 0 on EVERY boot via the python normalization after the if/elif · this covers the in_progress-resume path (fresh process, phase=in_progress) where neither printf branch fires → previously left LOOP_WEIGHT stale and triggered a spurious turn-1 compact nag (now a soft [compact-rec]; pre-Phase-C it was a hard [compact-required] STOP) · a fresh OS process always has an empty context window · do NOT remove this normalization when deduping B1
- B1 cache breakpoint: if compact_state.md has `prefix_hash=<val>` → compare vs `sha1sum CLAUDE.md | cut -c1-8` → mismatch → emit `[cache-miss-boot] prefix changed · cache cold this session`
- B1 session_tokens.md format: `SESSION_TOTAL: 0\nCHAT_TOTAL: N\nCACHE_READ: 0\nCACHE_WRITE: 0` — add cache fields on fresh session init only if file is being reset
- on_demand_files = lookup table for G2 only — NEVER auto-load at B3
- mece_plan.md has pending sections? Skip Phase 1+2 → resume Phase 3:
  `grep -n "^\- \[ \]\|^\- \[/\]" .sessions/mece_plan.md | head -3` → first pending item
  Resume staleness gate (V3): `sha1sum .sessions/mece_plan.md | cut -c1-8` vs mece_plan_hash in session_handoff.md · `git status src/` → emit [plan-stale] if either differs

[B4] Platform Probe: `detected.md` platform: unknown → list tools → update detected.md · else skip
     Provider sub-probe (fills api_provider + 4 profile fields — run when `api_provider:` missing OR =unknown · else skip):
       step 1 — map platform→provider: claude-code→anthropic · antigravity→(per host model id, step 2) · else → step 2
       step 2 — model-id heuristic: id contains `claude`→anthropic · `gpt`/`o[0-9]`→openai · `gemini`→google · else → step 3
       step 3 — unresolved → set `api_provider: unknown`
     Fill: copy the matching row from `## Known Provider Profiles` table into the active fields →
           api_provider / cache_mechanism / context_cliff_tokens / token_formula / cache_write_cost
       unknown → `token_formula: generic` · `cache_mechanism: none` · `context_cliff_tokens: 200000` (conservative floor) —
       NEVER apply one provider's cache rule to another (generic fallback only · §R1 + Implement/03_config.md §Provider Profiles)
     (deterministic — a MODEL_MEDIUM agent runs steps 1-3 + Fill with no chat history + no inference)

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <N>`
Emit after Boot reply: `[skill-active] <name>` — repeat at start of every turn while skill is loaded (user sees active skill in every response log)
compact-restore reply: append ` · Resume: S<N> — <step>` when section= + step= fields present in compact_state.md

> Boot ending ≠ ready to work. Run C0–C3 → Phase 1 next. SKILL.md load ≠ Phase 1.

---

## Per-Turn Routing (every message)

**Run C0→C0.5→C1→C2→C3 before any work. No exceptions.**

```
[C0] c0_resolved=true in memory → clear flag → skip to C1
     COMPACT-CONFIRM CHECK (T-180 · provider-aware): user message is a bare compact confirmation ("compact แล้ว" / "compacted" / "เคลียร์แล้ว" / "compact เสร็จแล้ว") → run `python3 scripts/compact_reset.py --trigger=user-confirm` → surface the printed [compact-reset] line to the user → resume C1. (Claude-code ALSO auto-resets via the SessionStart:compact hook in .claude/settings.json; this path is the fallback for providers with no compact hook + a manual re-sync for Claude.)
     COMPLAINT CHECK: "ลืม"/"you skipped"/"didn't log"/"harness says" + harness step name
     "ลืม" triggers ONLY on step names: roadmap/CFP/index/pre-read/session/boot/skill/gate/MECE
     "ลืมบอกให้เพิ่ม X" = feature request → pass to C1 normally
     YES → R16 self-improve → set c0_resolved=true → resume C1

[C0.5] → each turn before C1: read [token-state] hook (LOOP_W · SESSION · CHAT) · PRIMARY signal = CHAT_TOTAL (real context size) · LOOP_WEIGHT = SECONDARY tool-call-count hint only · CHAT_TOTAL >80k → [compact-rec] strong: surface recommendation block (Recommend/Why/MUST-vs-SHOULD=SHOULD/Resume brief/Your call) — NOT a STOP, user decides · LW >50 → [compact-rec] light hint only (secondary backstop · optional · no STOP) · HARD STOP only at the real ceiling SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP] write compact_state.md → STOP · skip required tier = CFP-026
       → STUCK-COUNTER GUARD (T-180): if [compact-STOP] fires with ~same CHAT_TOTAL (±2k) across ≥2 turns → the counter did NOT reset after a compact (the bug · CFP-037), NOT a real ceiling → run `python3 scripts/compact_reset.py --trigger=user-confirm` → surface the printed [compact-reset] line · do NOT keep re-nagging [compact-STOP]

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

**M5 verify** (before emitting [✓ MECE]): assess mece_plan.md is structurally complete — all Phase 0–3 blocks · Verify-N per Phase 3 section · compact_checkpoint if sections ≥3 · Phase 3 Close Checklist block. Complete → emit `[mece-schema-check] Phase2:ok · Verify-N:ok · checkpoint:ok · close-checklist:ok` → then [✓ MECE]. Gap found → re-read mece_plan_schema.md → rewrite missing block → re-assess.

**mece-compact** (after [✓ MECE]): emit `[mece-complete]` summary (task · sections · files · Verify-N count) + prompt "/compact แล้ว reply 'ลุย' เพื่อเริ่ม Phase 3 ครับ". Prefer starting Phase 3 in fresh context. If the user says "ลุย" directly without /compact → emit `[compact-skipped]` · proceed (fine).

MECE runs ONCE. On resume: load existing plan → jump to first pending [ ] section.

---

### Phase 3 · Execution Loop

```
REACT LOOP (per section — repeat until section_complete OR token pause):
  Token check: SESSION_TOTAL 60-80k → finish current step → PAUSE

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
**Token Pause** (SESSION_TOTAL 60-80k during Phase 3): finish the current step · claude-code → emit `[token-pause]` · ask "continue?" → resume on yes · other provider → write compact_state.md → STOP.
Compact check (every turn): use hook `[token-state]` values, not `session_tokens.md` (subagents overwrite it). Thresholds → see C0.5 (§Per-Turn Routing): PRIMARY = CHAT_TOTAL · LOOP_WEIGHT secondary · hard STOP only at SESSION_TOTAL >90k OR CHAT_TOTAL >120k → [compact-STOP].
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

**Completion Gate** (all mece_plan.md sections marked [X]):
- Close-gate (do NOT auto-close — CFP-037): first emit `[close-gate-check] trigger: (user typed /compact)=Y/N · (SESSION_TOTAL>80k)=Y/N · (LOOP_WEIGHT>50)=Y/N` (LOOP_WEIGHT from hook [token-state] only — session_tokens.md is polluted by subagents). All N → emit `[session-health]` + summary → WAIT for user · Any Y → proceed to close.
- Verify: Verify-N ≤3 + no src/ change → inline bash verify · Verify-N ≥4 OR src/ change → spawn MODEL_LOW reviewer.
- Done-criteria (all): every [✓ written] · R8 Index Sync · Roadmap [X] · active_thread phase:done · SESSION_TOTAL written · Feedback sent · mece_plan.md Phase 1-3 cleared (PATH A · exact cmd in mece_plan_schema.md §PATH A · CFP-025).
- Before /compact: run scripts/trim_exec_log.py + write session_summary to token_log.jsonl · SESSION >60k → compact first · 60-80k → TOKEN PAUSE.

Session Health: <20k ✅ · 20–40k 💡 · 40–60k ⚠️ compact now · 60-80k 🛑 TOKEN PAUSE · emit `[session-health]` · Thai summary: `งานเสร็จแล้วครับ ✅`
⚠️ CHAT_TOTAL undercount: true API context ≈ CHAT_TOTAL × 1.5–2× (triangular re-send) · use as lower bound · compact before CHAT_TOTAL > 80k to avoid spike

---

## Index Sync Invariant

Every create/modify/delete/rename **must** update indexes before task marked done.
Backlink 3-tier check before editing: references[] · backlinks[] · related[] → **Implement/03_config.md §Backlink Rule**

| Trigger event (when) | Must update | Regen command (how) | idempotent? |
|---|---|---|---|
| File created/moved/deleted | `index_files.json` (file_manager) | `python3 scripts/backlink_analyzer.py` | yes (auto-safe) |
| Symbol with cross-file dependency: created/renamed/deleted | `index_variables.json` · skip if symbol used only within its own file | `python3 scripts/symbol_indexer.py` | yes (auto-safe) |
| Code file (.py/.ts/.js under scripts/ or src/) created/edited/deleted | `imports[]`/`imported_by[]` (hard import edges) in `index_files.json` — distinct from semantic `references[]`/`related[]` (see `knowledge/code_linkage_index.md`) | `python3 scripts/code_graph.py --write` (Tier-A regex import graph · hash-locked) | yes (auto-safe · T-192) |
| Session closed | `index_sessions.json` | `python3 scripts/session_indexer.py` | yes (auto-safe) |
| Harness rule file edited (CLAUDE.md · AGENTS.md · Implement/* · */SKILL.md · INVARIANTS.md · CODING_FAILURE_PATTERNS.md) | `rules_defined[]`/`rules_referenced[]` in `index_files.json` | `python3 scripts/rule_indexer.py` | yes (auto-safe · T-182) |
| SKILL.md created/renamed | `skill-manifest.json` | manual (file_manager registers entry) | no (judgment) |
| Tool script created/renamed | `tool-manifest.json` | manual (register entry) | no (judgment) |
| `knowledge/` file modified | conflict check | `python3 scripts/knowledge_conflict_checker.py --file <path> --no-trigger` · EXCLUDE: index_*.json · error_index.md | no (judgment) |
| Top-level root file/dir OR nested folder added/moved/removed/renamed | `REPO_MAP.md` AUTO structure block (folders incl. nested + per-folder file counts) | `python3 scripts/repo_map_check.py --sync` (auto-run at Stop · regenerates AUTO block · carries content-renames via `git -M` · adds TODO placeholder rows for genuinely-new items) | structure block = yes (idempotent · auto-safe) · descriptions = judgment (never overwritten · T-185/T-190) |

> **Safety net (T-183 · T-190):** the Stop-hook reconciler `scripts/index_reconcile.py` runs at session close — it diffs git-changed files vs `index_files.json`, emits `[index-drift]` for anything stale, and **auto-runs the idempotent regenerators** (rule_indexer · backlink_analyzer · code_graph · symbol_indexer) so a missed manual update is caught, not silently lost. (session_indexer is NOT auto-run by this reconciler — index_sessions.json is regenerated by the session-close path · T-193.) *idempotent = re-running produces the same result, so it is always safe to auto-run.* It also **auto-runs `repo_map_check.py --sync`** (T-190): the REPO_MAP.md AUTO structure block (folders incl. nested + per-folder file counts) is regenerated and content-renames carried via `git -M`. This is safe to auto-apply because `--sync` only ever touches the marker-delimited AUTO block + adds TODO placeholder rows — curated descriptions live OUTSIDE the markers and are NEVER overwritten. Remaining judgment-type updates (manifests, knowledge conflict check) are only flagged, never auto-applied.

---

## Never-Full-Load (hard — no exceptions, including Phase 1 G2)
→ Full file list + whitelist: **Implement/03_config.md §Never-Full-Load**
Violation → emit `[violation] never-full-load` → discard → re-run as grep.
on_demand_files in manifest = lookup table for G2 only. B3 MUST NOT load them.

---

## Sub-agent Rules (R4)

Probe first: `find <path> -name "<pat>" | wc -l` → <5 files/<300L = main context · ≥5 = spawn sub-agent (≤500 tok summary)
Phase routing (model × EFFORT) — baseline = Sonnet @ low-med effort · every SKILL must be followable by a MEDIUM-tier model WITHOUT inference (robustness floor):
  · lookup / grep / read-only / Reviewer → MODEL_LOW @ low effort
  · mechanical / edit-as-instructed / classify → MODEL_MEDIUM @ low effort
  · multi-step execution / code edits → MODEL_MEDIUM (workhorse writer) @ medium effort
  · MECE planning / architecture / structural reasoning → MODEL_HIGH @ high effort (reserved — NOT routine code edits)
  Rule: dial EFFORT first, tier second · escalate to high effort ONLY for genuine reasoning (~35% cost saving)
  → full model×effort table: Implement/03_config.md §Sub-agent Rules
Max depth = 1 · pre-assign T-IDs before spawn · emit `[cycle N]` · HALT if blocked
→ Full routing table + OmO Roles + spawn patterns: **Implement/03_config.md §Sub-agent Rules**

---

## Critical Project Rules
Domain-specific non-negotiable rules (e.g. coding's Miniflare D1 / Edge Runtime / PapaParse) are NOT in core — they live INLINE in the active domain pack `## critical_rules` (domain/<name>.md). At task start, read the active pack and treat its `## critical_rules` as hard constraints.
<!-- END:agent-orientation -->
