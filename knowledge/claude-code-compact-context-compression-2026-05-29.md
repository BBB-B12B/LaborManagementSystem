---
title: Claude Code /compact — Context Compression Mechanism
topic: claude-code
tags: [context-management, compact, token-optimization, session-management, claude-code]
source: Claude Code CLI — direct session observation + feature documentation
created: 2026-05-29
updated: 2026-05-29
status: active
type: reference
---

# Claude Code /compact — Context Compression Mechanism

## Summary

`/compact` is a Claude Code slash command that compresses conversation history into a structured summary, freeing context window space while preserving actionable state. It is the primary mechanism for extending long sessions without losing task continuity.

## How It Works

### Trigger Conditions

- **Manual**: user types `/compact`
- **Automatic**: Claude Code detects context approaching window limit
- **Programmatic**: agent applies threshold rule (e.g., >110k tokens → HALT → compact)

### Execution Flow

```
[Full conversation history — N turns + tool results + file reads]
        ↓ /compact triggered
[Claude reads all turns → generates structured summary]
        ↓
[Summary replaces history in active context window]
        ↓
[Original turns remain on disk at <session>.jsonl — not deleted]
        ↓
[Session continues — summary serves as working memory]
```

### Summary Structure (9-section standard)

| # | Section | Content Preserved |
|---|---|---|
| 1 | Primary Request & Intent | Verbatim goals the user stated |
| 2 | Key Technical Concepts | Domain vocabulary, architecture patterns |
| 3 | Files & Code Sections | Paths + what changed per file (not full content) |
| 4 | Errors & Fixes | Errors encountered + how they were resolved |
| 5 | Problem Solving | Decisions made + tradeoffs considered |
| 6 | All User Messages | Every user turn — verbatim |
| 7 | Pending Tasks | Unfinished items explicitly called out |
| 8 | Current Work | Final state at compact time |
| 9 | Optional Next Step | Suggested continuation |

## Compression Characteristics

| Metric | Typical Value |
|---|---|
| Input (pre-compact) | 40k–100k tokens |
| Summary output | 3k–5k tokens |
| Compression ratio | ~90% reduction |
| Hard size limit on summary | None declared — Claude decides |
| Disk file (`.jsonl`) | Preserved — full original history intact |

## What Is Lost vs Preserved

| Category | Preserved | Lost |
|---|---|---|
| Task goals | ✅ | — |
| File paths | ✅ | — |
| Key decisions | ✅ (outcome) | ❌ reasoning chain |
| Error messages | ✅ summary | ❌ full stack trace |
| User messages | ✅ verbatim | — |
| Tool call outputs | ❌ | full raw output |
| Intermediate exploration | ❌ | steps, failed attempts |

## /compact vs /clear

| | `/compact` | `/clear` |
|---|---|---|
| Context window | Replaced by summary | Fully cleared |
| Disk history `.jsonl` | Preserved | Preserved |
| Task continuity | ✅ resumable | ❌ must restart |
| Token reduction | ~90% | ~100% |
| Use when | Ongoing task near limit | Starting unrelated task |

## Token Threshold Rules (from CLAUDE.md R3)

| Session Total | Action |
|---|---|
| >60k | Warn user — consider /clear |
| >90k | Recommend new session |
| >110k | HALT → run `/compact` → if still large → R6 handoff |

`/compact` is the first-line defense. R6 handoff (write brief → `/clear`) is the fallback.

## Recovery

If compact summary lost critical detail:

```
~/.claude/projects/<project-id>/<session-id>.jsonl
```

Full history always on disk. Read it to recover any lost context.

## Design Principles Behind /compact

| Principle | Description |
|---|---|
| **Lossless what, lossy how** | Preserve *what was done* — drop *how it was debugged* |
| **State over history** | Current state is more valuable than event log |
| **Actionable forward** | Summary emphasizes what's still pending, not retrospective |
| **File paths over content** | Paths are cheap pointers — content can be re-read on demand |

## Backlinks

- [[claude-code-harness-research-notebooklm-summary-2026-05-28]]
- [[context-compression-roadmap-vps-agent-2026-05-29]]
