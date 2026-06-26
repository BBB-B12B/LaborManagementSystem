# 9arm-skills (upstream) — Structure + Comparison vs Our Harness

> Reference note. Source: https://github.com/thananon/9arm-skills (the upstream "9arm" skill repo
> our harness drew its core ideas from). Captured 2026-06-18 while studying it to inform further
> harness development. Read-only study — no harness files were changed by the capture itself.

## 1. Upstream repo structure

Packaged as a Claude Code **plugin** (`.claude-plugin/plugin.json`); installs via `npx skills add thananon/9arm-skills`.
Skills live under `skills/`, bucketed: `engineering/` · `productivity/` · `misc/`(empty) · `personal/` · `in-progress/` · `deprecated/`.

| Skill | Bucket | One-line purpose |
|---|---|---|
| debug-mantra | engineering | 4-mantra debug discipline: reproduce → know fail path → falsify hypothesis → breadcrumb ledger. Recited verbatim at session start, applied in order before any fix. |
| post-mortem | engineering | Canonical engineering record of a FIXED+validated bug. Refuses to draft without repro + known cause + identified fix + validation. Hands off to management-talk. |
| scrutinize | engineering | Outsider review: Intent → Trace → Verify → Report. Mandatory simpler-way pass; traces the real code path (not just diff) to verify claims. |
| qwen-agent | engineering | Delegate menial, well-scoped coding tasks to a cheap Qwen model via the `claude-9arm` shell alias (`claude --model qwen3.6-35b-a3b` through the 9arm gateway), run headless with `-p`. |
| management-talk | productivity | Reframe engineer-to-engineer text for leadership, channel-shaped (JIRA / Slack / standup / email / meeting). Keep product/JIRA/PR identifiers; strip code identifiers; translate mechanism. |
| qwenchance | productivity | Keep a long task on-track: detect loops, cap reasoning (~1000 words/step), watch context by COUNTING signals (not estimating tokens), trigger a clean handoff before the window fills. |

## 2. Skill-by-skill comparison vs our harness

| Upstream | Our analog | Verdict |
|---|---|---|
| debug-mantra | `harness/debug` | Ours covers reproduce + rank≥2 + disprove-first + ledger. GAP: ours lacks the "know the fail path" ladder (attach debugger first → source trace + knob enumeration → tagged in-code instrumentation `[DBG-xxxx]`). Ours adds: machine signals, refuse-without-prereqs, hand-off block (debug→editor), R9 single-source. |
| scrutinize | `harness/scrutinize` | Ours = Outsider + Simpler-Way (clarity + minimalism). GAP: ours lacks 9arm's Trace + Verify steps (walk the real code path end-to-end, verify each claimed behavior against the trace, check edge cases / silent changes / test coverage). Ours adds: machine signals, refuse contract, single-source note vs skeptical_reviewer. |
| post-mortem | CFP entries + `harness/self_improve` | Ours records failures as CFP-NNN (symptom/root/prevention). 9arm's post-mortem is a richer standalone artifact (9 blocks, worked example, refuse-without-4-inputs gate). Pattern match, not 1:1. |
| management-talk | `content/project_presenter` (pattern only) | NOT functionally equivalent. project_presenter = scan codebase → pain-point interview → build HTML pitch pages (sales/pitch). management-talk = text reframe for leadership across channels. They match ONLY at the T-216 hand-off PATTERN level (upstream owns artifact → downstream reframes for an audience), not as the same skill. We have no true management-talk (multi-channel text reframe) skill. |
| qwenchance | our whole token/loop/handoff system (`token_tracker` + R3/C0.5 + `session_manager`) | Biggest divergence — see §3. |
| qwen-agent | `coding/delegate` + planned T-218 | delegate routes a mechanical MECE section to model_low. qwen-agent specifically targets a cheap/local model with a 128k window + fully self-contained prompts. Directly relevant to T-218 — see §4. |

## 3. Biggest insight — qwenchance "count signals, don't estimate"

qwenchance manages context by **counting 4 boolean signals**, NOT by estimating tokens:
- [ ] 20+ assistant turns into the task
- [ ] read 5+ files (or any one huge file/log)
- [ ] long tool outputs being scrolled back to
- [ ] 3+ plan steps still left

Count 0–1 → continue · count 2–4 → hand off now. A `<system-reminder>` about low context is authoritative → hand off regardless of count.

Our `token_tracker` is **estimation-primary**: CHAT_TOTAL via char-multiplier formulas (`thai×1.7 + en×0.3`), sys_fixed, hooks_overhead=700, and a documented ×1.5–2 "triangular re-send" undercount. LOOP_WEIGHT (tool-weighted) and TURN_COUNT exist but are SECONDARY hints; the primary compact trigger is the estimated CHAT_TOTAL.

The entire CFP-028 / CFP-031 / CFP-037 / CFP-041 family of bugs is about token estimation being unreliable (hook undercount, footer using stale/cached estimates, post-compact counter not resetting, subagents polluting the running total). 9arm sidesteps this whole bug class by refusing to estimate at all.

**Development implication:** consider elevating signal-counting to the PRIMARY compact trigger and demoting estimation to a rough secondary display. This would likely retire most of the token-estimation CFP class.

## 4. T-218 implication

qwen-agent's bridge is just a shell alias (`claude-9arm -p "<self-contained prompt>" --allowedTools ...`) routed through a gateway — far simpler than our 8-phase plan (procure hardware → Ollama → tune KV → Bash wrapper → MCP server → harness wiring → optimize → package). Worth re-scoping T-218 against this pattern before building a bespoke Ollama+MCP stack. Their packaging step (`.claude-plugin/plugin.json` + `npx skills add`) also maps to our T-218 Phase 8.

## 5. Honest scope note

Upstream skills were read in full from raw GitHub. Our `debug` / `scrutinize` / `token_tracker` / `project_presenter` were read in full or by targeted section. The management-talk↔project_presenter and qwenchance↔token system mappings were verified against our actual skill files, not inferred from descriptions alone.

## Related
- T-216 hand-off contracts modeled the post-mortem → management-talk pattern (`docs/session_templates/handoff_block_schema.md`).
- `coding/delegate` SKILL.md (our menial-delegation analog of qwen-agent).
- `knowledge/implement-plan-local-llm-deployment-2026-06-17.md` (T-218 plan to re-scope against qwen-agent).
