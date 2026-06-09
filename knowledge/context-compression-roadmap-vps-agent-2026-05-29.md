---
title: Context Compression Roadmap — VPS Agent System
topic: harness-design
tags: [roadmap, context-management, session-lifecycle, token-optimization, agent-memory, compact]
source: internal — derived from /compact analysis + VPS OpenClaw bot architecture
created: 2026-05-29
updated: 2026-05-29
status: active
type: build
---

# Context Compression Roadmap — VPS Agent System

## Summary

Development opportunities for applying `/compact`-style context compression to the VPS trading assistant (OpenClaw). Organized by priority: P1 = quick wins, P2 = medium effort, P3 = architectural.

## Current State

| Capability | Status | Notes |
|---|---|---|
| Token tracking (R1) | ✅ manual | CLAUDE.md — per-turn estimate only |
| Session compact | ✅ manual | `/compact` in Claude Code only |
| Cross-session memory | ✅ | `memory/` files |
| Bot-side token tracking | ❌ | not implemented |
| Auto-compact trigger in bot | ❌ | not implemented |
| Telegram conversation pruning | ❌ | history grows unbounded |
| Skill-aware summarization | ❌ | not implemented |
| Session snapshot on skill completion | ❌ | not implemented |

---

## P1 — High Impact, Low Effort (Days)

### 1.1 Conversation History Cap

Limit `messages[]` array before every Claude API call.

```js
// keep system prompt + last 15 turns
const MAX_HISTORY = 15;
const trimmed = [systemPrompt, ...history.slice(-MAX_HISTORY)];
```

- **Effort**: half-day
- **Impact**: prevents unbounded token growth per Telegram session
- **Risk**: none — only removes oldest turns

### 1.2 Per-Message Token Estimate Log

Add lightweight token counter to bot message handler.

```js
function estimateTokens(text) {
  const thaiChars = (text.match(/[฀-๿]/g) || []).length;
  const enChars = text.length - thaiChars;
  return Math.round(thaiChars * 1.7 + enChars * 0.3);
}
```

- **Effort**: 1 day (add to existing message pipeline)
- **Impact**: visibility into cost per session; feeds auto-compact trigger

### 1.3 Document Compact Pattern in session-lifecycle SKILL.md

Add a section to `skills/session-lifecycle/SKILL.md` referencing when to trigger compact.

- **Effort**: 30 min
- **Impact**: agents know to apply compress-before-limit pattern

---

## P2 — Medium Impact, Medium Effort (1–2 weeks)

### 2.1 Bot Compact Command (`/compact` via Telegram)

User sends `/compact` in Telegram → bot summarizes current conversation → prunes old turns.

```
User: /compact
Bot: [runs summarization prompt on message history]
     [stores summary in session state]
     [clears old turns]
     "Context compressed. Continuing from: <summary headline>"
```

- **Effort**: 2–3 days
- **Impact**: users control session length without losing state
- **Dependency**: session state storage (memory object or Redis)

### 2.2 Session Snapshot on Skill Completion

After each skill execution, write lightweight state file:

```json
{
  "last_skill": "knowledge-updater",
  "completed_at": "2026-05-29T...",
  "files_changed": ["skills/knowledge-updater/SKILL.md"],
  "pending": [],
  "summary": "Updated SKILL.md with P1-P7 rewrite principles"
}
```

- **Effort**: 1 day
- **Impact**: skills can hand off cleanly; next turn resumes from snapshot, not from raw history
- **Location**: `logs/session-snapshots/<timestamp>.json`

### 2.3 Auto-Compact Trigger

Bot automatically compacts when history exceeds threshold (e.g., 20 turns OR cumulative tokens > 30k).

```
[Message handler]
  → count messages in history
  → if > threshold → run compact silently
  → notify user: "📦 Context compressed to save space"
```

- **Effort**: 2 days
- **Impact**: eliminates need for manual `/compact` — session stays lean automatically
- **Dependency**: 1.2 (token counter) for token-based trigger

---

## P3 — High Impact, High Effort (Weeks)

### 3.1 Skill-Aware Compact Summary

Compact prompt varies by active skill — output format matched to domain.

| Active Skill | Summary Emphasis |
|---|---|
| `knowledge-updater` | File paths, frontmatter decisions, backlinks |
| `trade-operator` | Positions, active orders, price levels |
| `session-lifecycle` | Tasks completed, session state, pending |
| `task-verifier` | Verification results, pass/fail per item |

- **Effort**: 1 week
- **Impact**: much more accurate resume — no generic summaries losing domain context

### 3.2 Persistent Session State (SQLite)

Store compact summaries in SQLite keyed by Telegram user ID.

```sql
CREATE TABLE sessions (
  user_id TEXT,
  skill_context TEXT,
  summary TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

- **Effort**: 1 week
- **Impact**: session survives bot restart; user can resume days later

### 3.3 Cross-Session Memory Graph

Connect compact summaries from multiple sessions into a queryable knowledge graph.

```
session-2026-05-20 (knowledge work)
    ↓ references
session-2026-05-23 (skill upgrades)
    ↓ references
session-2026-05-29 (compact mechanism)
```

- **Effort**: 3–4 weeks
- **Impact**: "remember what we worked on last month about X" — long-horizon memory
- **Dependency**: `brain/index.md` as index layer; `choose_tools` for discovery

---

## Recommended Execution Order

```
Week 1:  1.1 + 1.2 + 1.3   (quick wins — immediate cost reduction)
Week 2:  2.1 + 2.2           (compact command + session snapshots)
Week 3:  2.3                  (auto-compact trigger)
Month 2: 3.1                  (skill-aware compact)
Month 3: 3.2 + 3.3           (persistent state + memory graph)
```

## Success Metrics

| Metric | Target |
|---|---|
| Average tokens per Telegram session | < 20k (vs current unbounded) |
| Sessions requiring manual /compact | < 10% |
| Context-loss incidents (user repeats themselves) | 0 per week |
| Session resume success rate | > 95% |

## Dependencies

| Item | Depends On |
|---|---|
| 2.1 Bot Compact | session state storage |
| 2.3 Auto-Compact | 1.2 token counter |
| 3.1 Skill-Aware | skill-manifest.json schema |
| 3.2 Persistent State | SQLite or Redis on VPS |
| 3.3 Memory Graph | brain/index.md + choose_tools |

## Backlinks

- [[claude-code-compact-context-compression-2026-05-29]]
- [[claude-code-harness-research-notebooklm-summary-2026-05-28]]
- [[9arm-skills-patterns-to-port-into-ai-agent-harness-2026-05-28]]
