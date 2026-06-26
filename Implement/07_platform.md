# Implement/07_platform.md — Platform Adapter Guide

> Read when: setting up a new project on a platform other than Antigravity 2.0, or when [platform-unknown] is emitted at Boot.

## Boot Init (B1 internals — externalized from AGENTS.md §Boot Sequence · T-212/D1)

> B1 runs `bash scripts/boot_init.sh`. The trigger + one-line summary stay HOT in AGENTS.md; the formula bodies below are reference, loaded only when debugging boot.

- B1 resets SESSION_TOTAL=0 · compact-restore: CHAT_TOTAL = compact_size + sys_fixed · fresh session: CHAT_TOTAL = sys_fixed · sys_fixed = (CLAUDE.md + AGENTS.md chars × 0.3) + 11000 · CFP_COUNT → cfp_boot_count in working memory
- B1 single-source note (T-180): `scripts/compact_reset.py` mirrors this exact CHAT formula + the consume-once `session_reset=armed→consumed` flip. The SessionStart:compact hook (settings.json) and the C0 COMPACT-CONFIRM path both call it, so the post-compact recompute is identical whether it runs at boot, on the hook, or on a user confirm — no logic drift. `scripts/boot_init.sh` is the third caller of this same formula and MUST stay in sync.
- B1 compact_state.md field format (canonical · single source · T-262): every field is `key: value` (COLON). All readers — `scripts/boot_init.sh`, `scripts/compact_reset.py`, the settings.json hook — MUST parse `[:=]` (tolerate `=` for back-compat with old files); every writer — the agent, the mece_plan_schema.md PATH B template, boot_init's consume `sed` — MUST emit colon. A new field-reader reuses the `[:=]` tolerant parse, NEVER `=`-only. (The `=`-only drift silently broke `compact_size` + `session_reset` reset AND `dt` compact-restore detection — T-261 audit → T-262 fix.)
- B1 LOOP_WEIGHT reset (BUG-3 fix): LOOP_WEIGHT is context-window-scoped → forced to 0 on EVERY boot via the python normalization after the if/elif · this covers the in_progress-resume path (fresh process, phase=in_progress) where neither printf branch fires → previously left LOOP_WEIGHT stale and triggered a spurious turn-1 compact nag (now a soft [compact-rec]; pre-Phase-C it was a hard [compact-required] STOP) · a fresh OS process always has an empty context window · do NOT remove this normalization when deduping B1
- B1 cache breakpoint: if compact_state.md has `prefix_hash=<val>` → compare vs `sha1sum CLAUDE.md | cut -c1-8` → mismatch → emit `[cache-miss-boot] prefix changed · cache cold this session`
- B1 session_tokens.md format (8 fields · T-221): `SESSION_TOTAL: 0\nCHAT_TOTAL: N\nCACHE_READ: 0\nCACHE_WRITE: 0\nTURN_COUNT: 0\nLOOP_WEIGHT: 0\nFILES_READ: 0\nLONG_OUTPUTS: 0` — TURN_COUNT/FILES_READ/LONG_OUTPUTS feed the signal-box 4-box PRIMARY compact trigger (T-221). Every writer of this file MUST emit all 8 fields, or posttool_track.py re-appends the missing ones (CFP-031 guard). Add cache fields on fresh session init only if file is being reset

## What is the Platform Adapter?

The harness does not hardcode any platform's tool names. Instead, it reads spawn tool configuration from `.agents/platform/detected.md` at Boot. This makes the harness work on any AI platform.

## How Detection Works (Boot B4)

```
1. Check .agents/platform/detected.md
   → platform ≠ unknown → use values as-is → skip to work
   → platform = unknown → run Platform Probe:

2. Platform Probe:
   a. List all available tools in this session
   b. Match against known platforms (see Known Mappings table below)
   c. Found → write detected.md → proceed
   d. Not found → emit [platform-unknown] → Co-development dialogue (see below)
```

## Known Platform Mappings

| Platform | spawn_tool | explore_type | execution_type | parallel_mode | define_tool |
|---|---|---|---|---|---|
| Antigravity 2.0 | invoke_subagent | research | self | Subagents[] array | define_subagent |
| Claude Code | Agent() | subagent_type=Explore | subagent_type=task | multiple Agent() calls | none |

## Co-development Dialogue (when platform unknown)

When no known spawn tool is found, the agent emits `[platform-unknown]` and asks:

```
[platform-unknown] Sub-agent spawn capability not detected on this platform.
To configure the harness, I need your help with 4 questions:

Q1: Does this platform support spawning sub-agents or parallel workers?
    (yes / no / partial — explain what is possible)

Q2: What tool or command name is used to spawn them?
    (e.g., invoke_subagent, spawn_agent, run_parallel, Agent...)

Q3: What parameters does it accept?
    (share JSON schema, function signature, or a doc link)

Q4: Can multiple agents run in parallel in one call, or must they be sequential?
    (parallel-in-one-call / sequential-calls / not-supported)

→ Once answered, I will write .agents/platform/detected.md and we proceed.
→ If partial support: I will document what IS possible and adapt the 3 spawn patterns to fit.
```

## Model Tier + Provider Co-configuration (AI-guided · runs at setup Step 4b)

The spawn-tool dialogue above covers *how to spawn*. This one covers *which model runs each job* and
*which provider's cost rules apply* — two things the harness CANNOT auto-guess and must set WITH the user.

```
── Model tiers (ask the user — they alone know what they can use) ──
[setup] To route work by cost, I map your models to 3 tiers. Which models can you use?
  MODEL_HIGH   = strongest reasoning → MECE planning / architecture ONLY (reserved)
  MODEL_MEDIUM = mid-tier workhorse  → code edits / multi-step execution / structured output (baseline)
  MODEL_LOW    = fast/cheap          → lookup / grep / read-only / Reviewer
  Rule: dial EFFORT first (low/med/high), tier second. Every skill must run on MODEL_MEDIUM
        with no inference — MODEL_HIGH is reserved, not the default.
  Only 1 model → all 3 tiers = it, differentiate by EFFORT. Only 2 → HIGH=MEDIUM=stronger, LOW=cheaper.

── Provider (auto-probe, then confirm) ──
I detected provider = `<guess>` from your model id (claude→anthropic · gpt/o#→openai · gemini→google).
Confirm? Provider sets cache + token-cost rules — the wrong one breaks cost tracking immediately.
  → I copy the matching row from 03_config.md §Provider Profiles into detected.md:
    api_provider / cache_mechanism / context_cliff_tokens / token_formula / cache_write_cost
  → unknown → token_formula: generic · cache_mechanism: none · context_cliff_tokens: 200000.
```

Then I write the model_high / model_medium / model_low + provider fields into `detected.md`
(full field list: 02_setup.md Step 4b). All AGENTS.md spawn calls use tier names — never raw model IDs.

## What Happens After Co-development

1. Agent writes `.agents/platform/detected.md` with confirmed values
2. Agent confirms back: "Platform configured: `<platform>` · spawn_tool: `<tool>`"
3. Harness continues from where it left off — no restart needed
4. For future sessions: detected.md is already populated → B4 skipped

## Maintenance

- Delete `detected.md` to re-run detection (e.g., after platform upgrade)
- Update Known Platform Mappings table when a new platform is confirmed
- If platform adds new capabilities → update detected.md `notes` field

## Session Management by Provider

The harness uses `detected.md platform:` to decide how to handle context window limits and task boundaries. Full spec: `.agents/platform/session_protocol.md`.

| Situation | claude-code | other (Antigravity etc.) |
|---|---|---|
| C3 topic-switch (after §3) | /compact → Phase 1 same chat | write compact_state.md → "เปิด chat ใหม่" → STOP |
| TOKEN PAUSE (>60k) | ask continue → resume same chat | §3 close → "context เต็ม เปิด chat ใหม่" → STOP |
| Task complete | /compact → same chat ready | "Session ปิดแล้ว — เปิด chat ใหม่" |
| Prompt caching | auto-cached (90% discount) | NOT automatic — requires Context Caching API in platform code |

For Antigravity: **new chat per task** is the baseline. Each chat starts with full system prompt. Compression of CLAUDE.md + AGENTS.md (54% reduction) reduces base cost per chat.

## Setup Checklist

When bootstrapping on a new platform:
```
[ ] .agents/platform/detected.md created (auto or manual)
[ ] platform field is NOT "unknown"
[ ] spawn_tool, explore_type, execution_type, parallel_mode all filled
[ ] Test: trigger a small Explore task → verify spawn_tool is called correctly
[ ] If test fails → update detected.md or run co-development dialogue
[ ] Read .agents/platform/session_protocol.md → understand session close behavior for this platform
```
