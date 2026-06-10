# Implement/07_platform.md — Platform Adapter Guide

> Read when: setting up a new project on a platform other than Antigravity 2.0, or when [platform-unknown] is emitted at Boot.

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
