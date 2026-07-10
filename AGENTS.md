# Agent Orientation — Asset Plan · ALL agents
> Framework/library read-first hints are domain-specific → see the active domain pack `## framework` (domain/<name>.md).
> Constraints → `CLAUDE.md` · Gates → `INVARIANTS.md` · Structure → `REPO_MAP.md` · Domain layer → `domain/<active>.md`

---

## Boot Sequence (3 tool calls max)

```
[B1] Bash: `BI=scripts/boot_init.sh; [ -f "$BI" ] || BI="$CLAUDE_PLUGIN_ROOT/scripts/boot_init.sh"; [ -f "$BI" ] || BI="$(ls -t ~/.claude/plugins/cache/*/harness-agent/*/scripts/boot_init.sh 2>/dev/null | head -1)"; bash "$BI"`  (resolve order: local `scripts/` → `$CLAUDE_PLUGIN_ROOT` → plugin-cache glob · NOTE `$CLAUDE_PLUGIN_ROOT` is EMPTY in a plain Bash tool call, so the glob fallback is what actually works for a plugin-only project (verified T-314) · boot_init.sh self-locates ENGINE from `$0` so `$ENG` never 404s · emits: [compact-restore] if any · active_thread tail · session_tokens · roadmap [/] · CFP_COUNT)
     → B1 internals (reset branches · CHAT formula · LOOP_WEIGHT normalization · cache breakpoint · compact_reset.py single-source sync): **Implement/07_platform.md §Boot Init**
[B2] IF [compact-restore]: parse sk= → skill_name · parse section= + step= → resume_hint · SKIP manifest read
     IF prompt has `skill: <name>`: use directly · SKIP manifest
     ELSE: grep -B1 -A6 '"keywords"' .agents/skills/skill-manifest.json | head -160 → assess keyword overlap with user prompt:
             ≥1 keyword aligns with user intent → emit [skill-match] skill:<name> · keyword:<matched> · then emit [skill-active] <name>
             >1 skill matches → prefer the one whose `activates_at` best fits the trigger phrase · still tied → pick last in manifest order + emit [skill-match-tie] skills:<A,B> → chose:<A> (deterministic — removes the multi-match stall · T-234)
             no keyword aligns → emit [skill-miss] · default: agent (manifest fallback) · note reason
             (cannot silently proceed — [skill-miss] is a forcing function: agent MUST name default + reason)
             confirmed match used ≥2 turns → may append to manifest learned_routes[].examples (optional · never required)
[B3] Let <ENG> = the abs path printed on B1's `[engine-root]` line (quote it — may contain spaces). Read engine skills by SHELLING OUT to read_skill.py (code-resolves ENGINE_ROOT + fails LOUD on 404), substituting <ENG> literally each Bash call — NEVER a bare project-relative `Read .agents/skills/...`, which silently 404s in a plugin-only project with no local engine copy (T-314 S1 · HALT-1).
     IF [compact-restore]: sha1sum "<ENG>/.agents/skills/<bucket>/<skill>/SKILL.md" → compare sk_h · sha1sum "<ENG>/.agents/skills/harness/mece/SKILL.md" → compare mece_h
       match → SKIP read (~2.9k tokens saved) | mismatch → run the Bash read below
     ELSE: Bash `python3 "<ENG>/scripts/read_skill.py" <bucket>/<skill_name> 1 80`  (path from manifest — skills bucketed under harness/ knowledge/ content/ coding/ user/ · lines 1–80)
           Bash `python3 "<ENG>/scripts/read_skill.py" harness/mece 31 140`  (mece SKILL.md lines 31–140)
```
- B1 internals (reset branches · CHAT/sys_fixed formula · compact_reset.py single-source · LOOP_WEIGHT normalization · cache breakpoint · session_tokens.md format): **Implement/07_platform.md §Boot Init**
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
     Fill (model-aware · from `## Known Model Windows + Tokenizers`): set by the ACTIVE model id →
           context_window (Opus4.8/4.7/4.6 · Sonnet4.6 · Fable5 = 1000000 · Haiku4.5 = 200000) · tokenizer (Opus4.7/4.8 + Fable5 = opus-4.7-family · others re-baseline via count_tokens). token_budget = USER policy (default 128000), set once — NOT model-derived. context_window (real ceiling) and token_budget (spend cap) stay DISTINCT.
       unknown → `token_formula: generic` · `cache_mechanism: none` · `context_cliff_tokens: 200000` (conservative floor) · `context_window: 200000` (conservative floor) —
       NEVER apply one provider's cache rule to another (generic fallback only · §R1 + Implement/03_config.md §Provider Profiles)
     (deterministic — a MODEL_MEDIUM agent runs steps 1-3 + Fill with no chat history + no inference)

Reply line 1: `**[Boot]** Thread: <done|in_progress> · Tasks: <N> · Skill: <name> · Sections: <N> · Tokens: ~<N>k · CFP: <N>`
Emit after Boot reply: `[skill-active] <name>` — repeat at start of every turn while skill is loaded (user sees active skill in every response log)
compact-restore reply: append ` · Resume: S<N> — <step>` when section= + step= fields present in compact_state.md

> Boot ending ≠ ready to work. Run C0–C3 → Phase 1 next. SKILL.md load ≠ Phase 1.

---

## Per-Turn Routing (every message)

**Run C0→C1→C2→C3 before any work. No exceptions.** (C0 = 3-question gate; the token check is C0's Q3, formerly C0.5.)

```
[C0] Pre-work gate — 4 questions, resolve in order (c0_resolved=true in memory → clear flag → skip to C1):
     Q1 compact-confirm? bare "compact แล้ว / compacted / เคลียร์แล้ว / compact เสร็จแล้ว" → run `python3 scripts/compact_reset.py --trigger=user-confirm` → surface its [compact-reset] line → C1. (claude-code also auto-resets via the SessionStart:compact hook; this is the fallback + manual re-sync.) · plugin-only → `<ENG>/scripts/compact_reset.py` (R5 engine-script rule)
     Q2 complaint? "ลืม / you skipped / didn't log / harness says" + a harness step name (roadmap/CFP/index/pre-read/session/boot/skill/gate/MECE) → R16 self-improve → set c0_resolved=true → C1. ("ลืมบอกให้เพิ่ม X" = feature request → not C0, pass to C1.)
     Q3 compact warranted now? (the token gate · formerly the separate C0.5) PRIMARY = signal-box N/4 from the UserPromptSubmit hook (turns≥20 · files_read≥5 · long_outputs≥3 · steps_left≥3 · T-221): N≥2 → [compact-rec] strong (a choice, NOT a STOP). NO HARD STOP from the estimate (T-286): even at window-anchored eff (CHAT×1.75) ≥90%·token_budget(128k) AND signal-box ≥2 → advisory [compact-rec] pointing to the CLIENT METER (real %) — the estimate is a LOWER BOUND and NEVER stops the session; the client meter is the single source for any ceiling/compact decision · token_budget(128k)=per-room spend cap, distinct from context_window(1M, detected.md). SECONDARY char-estimate (lower bound): CHAT >80k or LOOP_W >50 → [compact-note] light hint only. → 5-field [compact-rec] template · precedence (ceiling>strong>light) · stuck-counter guard · start-of-turn snapshot lags ≤1 turn so grep LIVE `.sessions/session_tokens.md` at any DECISION/heavy-tool turn (CFP-041/T-235 · provider-aware reset): **Implement/03_config.md §Per-Turn**.
     Q4 scope-grill invoked? (T-228) user message contains a scope-grill trigger — Thai "เจาะ scope" / "scope ก่อน" / "ซัก scope" · EN "scope-grill" / "grill scope" → set scope_grill=armed → on reaching Phase 1, force ACTIVE G0 (run the G0 questions even if the skip-when-clear condition is met) + add the out-of-scope question, then persist the filled brief (incl. out_of_scope) to gather_complete.md before G1. Detected here at C0 — BEFORE the G0-skip decision — so the trigger can never be lost to a "task looks clear → skip G0" shortcut. → active-G0 mechanics: **Implement/03_config.md §G0**.
     none → C1.

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

[M1] Read mece/SKILL.md → [M1.5] dependency_map + risk_flags + compact_checkpoint (≥3 sections → insert after ceil(N/2)) → [M2] build plan + Verify-N → [M3] Read docs/session_templates/mece_plan_schema.md → copy structure → fill task content → write gather_complete.md + write mece_plan.md (Phase 0-3 template mandatory · NEVER write from memory — CFP-019) → [M4] optional Skeptical Reviewer (also greps knowledge/out_of_scope.md → already-rejected guard · appends on a permanent `reject` · T-224) → [M5] present plan to user → wait explicit confirm → [M6] roadmap: parent Task only (a NEW parent Task = full §6.2 block — Title/ContextTask/Goal/How-Check; schema: loop_engineer_spec.md §6.2 · NEVER per section — roadmap is big-task-only; usually already registered → just [X] at close) → [M7] emit [✓ MECE]
→ Full M1–M7 detail + compact_checkpoint formula: **Implement/04_skills.md §Phase 2**

→ at M2: grep `activates_at` + `tools` per skill from manifest (grep only — never Read full manifest) → fill Tool:/Avoid: per section · skip = manifest-routing-miss
→ at M3: Read mece_plan_schema.md → Write gather_complete.md → Write mece_plan.md → THEN present plan (M5) · writing from memory = CFP-019 · presenting without files written = CFP-027

**M3 verify** (after writing mece_plan.md, before presenting to user): assess mece_plan.md is structurally complete — all Phase 0–3 blocks · Verify-N per Phase 3 section · compact_checkpoint if sections ≥3 · Phase 3 Close Checklist block. Complete → emit `[mece-schema-check] Phase2:ok · Verify-N:ok · checkpoint:ok · close-checklist:ok` → then present plan (M5). Gap found → re-read mece_plan_schema.md → rewrite missing block → re-assess. Final [✓ MECE] emitted at M7 after roadmap.

**mece-compact** (after [✓ MECE]): emit `[mece-complete]` summary (task · sections · files · Verify-N count) + prompt "/compact แล้ว reply 'ลุย' เพื่อเริ่ม Phase 3 ครับ". Prefer starting Phase 3 in fresh context. If the user says "ลุย" directly without /compact → emit `[compact-skipped]` · proceed (fine).

MECE runs ONCE. On resume: load existing plan → jump to first pending [ ] section.

---

### Phase 3 · Execution Loop

REACT LOOP (per section): **[L1] Select → [L2] Execute → [L3] Observe → [L4] Verify → [L4.5] Purge → [L5] Decide** · repeat until section_complete OR token pause. HOT triggers (fire every loop — never lazy-load):
- [L1] next tool = Read → MUST emit `[pre-read] Target · Line` FIRST (CFP-034)
- [L4] mark mece_plan `[ ] S<N>` → `[X]` ONLY when `[✓ written]` AND Verify-N both pass (file write, not memory)
- [L4.5] PURGE: after EVERY tool result emit ONE of `[dropped]` / `[kept: N lines]` / `[offloaded]` · silent keep = [violation] BC-L4.5-purge
- `[headroom] <technique>: <what> · saved ~N lines` — DETERMINISTIC emit from `safe_run.py` when an automated compressor fires (view-compress T-302 · offload T-301). Surface it so the user can verify headroom ran. Distinct LAYER from the manual purge signals above (agent judgment on one result). Boundary (single-source): compression only — selective-read range-trim keeps `[pre-read]`; topic/label lookup is NOT headroom.
- after each section → write session_handoff.md (sections_done · resume_at=S<N> · mece_plan_hash=`sha1sum .sessions/mece_plan.md | cut -c1-8`)
- Token: SESSION 60-80k → finish step → `[token-pause]` · thresholds → C0 Q3 (§Per-Turn Routing) · estimate never hard-stops (T-286) · eff(CHAT×1.75)≥90%·token_budget(128k)+signal-box≥2 → advisory `[compact-rec]` → check CLIENT METER (real %)
- [L2] Bash with likely >40L output → `python3 scripts/safe_run.py` OR pipe `2>&1 | grep -iE "error|warn|fail" | tail -20` (R6) · plugin-only → `<ENG>/scripts/safe_run.py` (R5 engine-script rule)
- BLOCKED → halt · show error+progress · ask "fix or skip?" · wait
- editing SKILL.md/tool-def mid-session (SESSION>10k) → emit `[schema-gate]` · wait confirm · after edit → `[schema-changed]`
→ full L1–L5 steps + PURGE table + safe_run/verify_runner + cache notes ([compact-rec] 5-field · TTL · stable-prefix · proactive-invalidation): **Implement/06_orchestrator.md §Phase 3 REACT LOOP**

---

### Completion Gate

**Completion Gate** (all mece_plan.md sections marked [X]):
- Close-gate (do NOT auto-close — CFP-037): first emit `[close-gate-check] trigger: (user typed /compact)=Y/N · (SESSION_TOTAL>80k)=Y/N · (LOOP_WEIGHT>50)=Y/N` (LOOP_WEIGHT from hook [token-state]; after T-235 session_tokens.md is subagent-clean too — either source is valid). All N → emit `[session-health]` + summary → WAIT for user · Any Y → proceed to close.
- [scope-creep] gate (T-230 · all edit skills): files changed since task-start baseline (`.sessions/.scope_baseline` — auto-captured at Phase 1 by `scripts/posttool_track.py` when gather_complete.md is written · T-230b · gitignored · NOT raw git-diff-vs-HEAD — a dirty tree pollutes it) ⊆ union of section `File:` declarations → undeclared file = emit `[scope-creep] file:<path>` → justify or `git checkout` before [X] · all declared → `[scope-creep] clean`. Canonical: mece_plan_schema.md §Surgical Scope + §Close Checklist.
- Verify: Verify-N ≤3 + no src/ change → inline bash verify · Verify-N ≥4 OR src/ change → spawn MODEL_LOW reviewer.
- Post-build artifact review (T-263 · CFP-044): any review/audit of a FINISHED artifact MUST load the `scrutinize` skill first (emit `[skill-active] scrutinize`) — never review in head. A demanded review (`.review_intent` armed by `scripts/review_intent.py`) that reaches `phase: done` without scrutinize/skeptical_reviewer loaded is HARD-BLOCKED by `scripts/skill_gate.py` (escape: `HARNESS_SKIP_REVIEW_GATE=1`). Skill SELECTION happens at B2 (manifest keyword match); skill INVOCATION is ENFORCED here by the T-263 gate — the manifest tells you which skill, the gate makes loading it non-optional.
- Done-criteria (all): every [✓ written] · R8 Index Sync · Roadmap [X] · active_thread phase:done · SESSION_TOTAL written · Feedback sent · mece_plan.md Phase 1-3 cleared (PATH A · exact cmd in mece_plan_schema.md §PATH A · CFP-025).
- Before /compact: run scripts/trim_exec_log.py + write session_summary to token_log.jsonl · SESSION >60k → compact first · 60-80k → TOKEN PAUSE.

Session Health: <20k ✅ · 20–40k 💡 · 40–60k ⚠️ compact now · 60-80k 🛑 TOKEN PAUSE · emit `[session-health]` · Thai summary: `งานเสร็จแล้วครับ ✅`
⚠️ CHAT_TOTAL: when `CHAT_SRC=real` (claude-code/anthropic · read by `scripts/real_context.py` from the transcript's latest `usage`) CHAT_TOTAL is the REAL window-fill — no undercount, treat as truth (= client-meter number). When `CHAT_SRC=est` (fallback · no transcript) it is a LOWER BOUND: true API context ≈ estimate × 1.5–2× (triangular re-send) · compact before it climbs near budget. (T-287) The EST path is now CATEGORY-COMPLETE — `token_estimator.full_context_estimate` adds system + history + output (not tool-I/O-only), closing the old ~4× gap; the READ path stays Claude-only (off-Claude availability matrix in detected.md). (T-288)

---

## Index Sync Invariant

Every create/modify/delete/rename **must** update indexes before task marked done → emit `[r8-sync-check]`.
Backlink 3-tier check before editing: references[] · backlinks[] · related[] → **Implement/03_config.md §Backlink Rule**
→ Full trigger-event → must-update → regen-command table (8 rows: file · symbol · code-graph · session · rule-file · SKILL/tool manifest · knowledge · REPO_MAP · with idempotent flags): **Implement/03_config.md §R8**

> **Safety net (T-183 · T-190):** the Stop-hook reconciler `scripts/index_reconcile.py` auto-runs the idempotent regenerators (rule_indexer · backlink_analyzer · code_graph · symbol_indexer) + `repo_map_check.py --sync` at session close, emitting `[index-drift]` for anything stale — a missed manual update is caught, not lost. Manifest + knowledge-conflict updates stay judgment-type (flagged, never auto-applied). Full detail: **Implement/03_config.md §R8**.

---

## Never-Full-Load (hard — no exceptions, including Phase 1 G2)
→ Full file list + whitelist: **Implement/03_config.md §Never-Full-Load**
Violation → emit `[violation] never-full-load` → discard → re-run as grep.
on_demand_files in manifest = lookup table for G2 only. B3 MUST NOT load them.

---

## Sub-agent Rules (R4)

Probe first: `find <path> -name "<pat>" | wc -l` → <5 files/<300L = main context · ≥5 = spawn sub-agent (≤500 tok summary)
Routing (model × EFFORT): dial EFFORT first, tier second · baseline = Sonnet @ low-med · MODEL_LOW=lookup/grep/Reviewer · MODEL_LOW(delegated)=mechanical MECE section (→ `delegate` skill · confirmed-plan only · self-verify + retry-once + escalate · never gated/judgment) · MODEL_MEDIUM=mechanical@low / code-edits@med · MODEL_HIGH=MECE/architecture ONLY (reserved) · robustness floor: every skill must run on a MEDIUM model WITHOUT inference (~35% cost saving).
Max depth = 1 · pre-assign T-IDs before spawn · emit `[cycle N]` · HALT if blocked
→ Full routing table (model×effort + phase overrides) + spawn patterns: **Implement/03_config.md §Sub-agent Rules** · OmO Reviewer roles: **Implement/04_skills.md §Orchestration Protocol**

---

## Critical Project Rules
Domain-specific non-negotiable rules (e.g. coding's Miniflare D1 / Edge Runtime / PapaParse) are NOT in core — they live INLINE in the active domain pack `## critical_rules` (domain/<name>.md). At task start, read the active pack and treat its `## critical_rules` as hard constraints.
<!-- END:agent-orientation -->
