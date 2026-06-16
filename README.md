# Agent Harness

A portable AI agent system for Claude Code (and other AI vendors). Drop these files into any project to get structured multi-skill agent coordination with token budgeting, boot sequencing, and skill routing.

---

## For AI Agents — Start Here

> **Read `Implement/00_index.md` first.**
> It is the bootstrap index for the entire harness. Follow the reading track that matches your situation:
> - **Track A** — Fresh project (no existing code)
> - **Track B** — Existing project (has source code already)

After reading `00_index.md`, follow the reading order it prescribes. Do not skip steps.

---

## For Humans — Setup

1. Copy all files from this repo into your project root
2. Have your AI agent read `Implement/00_index.md` and follow Track A or B
3. The agent will generate all config files (`CLAUDE.md`, `AGENTS.md`, `INVARIANTS.md`, `REPO_MAP.md`) and skill files automatically

---

## What's Included

| File / Dir | Purpose |
|---|---|
| `Implement/` | **Bootstrap guides** — agent reads these to install the harness |
| `CLAUDE.md` | Hard constraints R1–R13 (token budget, boot sequence, output rules) |
| `AGENTS.md` | Agent orientation — quick-reference for all AI vendors |
| `CLAUDE.th.md` | Thai-language user guide (aligned with CLAUDE.md) |
| `INVARIANTS.md` | Formal gates I1–I5 (destructive, DB, index sync, symbol check, roadmap) |
| `CODING_FAILURE_PATTERNS.md` | CFP-001–CFP-006 failure patterns to avoid |
| `.agents/skills/` | 10 skill SKILL.md files + registry + manifest (v2.0) |
| `.agents/skill-patches/` | Patch workflow for incremental skill updates |

## Key Constraints (CLAUDE.md)

- Max 5 tool calls per turn
- Token footer required every response
- Session limit: >60k warn, >90k HALT
- Boot reads `active_thread.md` to resume in-progress work
- All AI-facing content must be English (R7)
