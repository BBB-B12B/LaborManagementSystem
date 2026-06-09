---
title: Harness Token Telemetry Schema
date: 2026-06-01
topics: [telemetry, token_tracking, cost_optimization]
---

## Purpose

Defines the per-turn JSON log entry and per-session summary record for the Harness Agent token tracking system. Enables cost attribution, cache efficiency analysis, and phase-level debugging against the harness's SESSION_TOTAL / CHAT_TOTAL dual-counter model.

## Per-Turn Log Entry (JSON)

One record written to `.sessions/token_log.jsonl` after every response.

```json
{
  "turn_id": "string (UUID v4)",
  "timestamp": "ISO-8601",
  "task_id": "string (T-NNN from roadmap)",
  "phase": "gather | mece | execute | verify | close",
  "skill_name": "string",
  "session_total": 0,
  "chat_total": 0,
  "cache_read_tokens": 0,
  "cache_write_tokens": 0,
  "cache_hit_pct": 0.0,
  "bucket_sys": 0,
  "bucket_tools": 0,
  "bucket_hist": 0,
  "bucket_output": 0,
  "turn_tokens": 0,
  "hooks_overhead": 700
}
```

**Field notes:**
| Field | Source | Notes |
|---|---|---|
| `session_total` | `.sessions/session_tokens.md` | Cumulative since task start; resets on close |
| `chat_total` | `.sessions/chat_tokens.md` | Cumulative since last `/compact`; never shrinks |
| `cache_read_tokens` | API response `usage.cache_read_input_tokens` | $0.30/MTok — cheap path |
| `cache_write_tokens` | API response `usage.cache_creation_input_tokens` | $3.75/MTok — written once |
| `cache_hit_pct` | `cache_read / (cache_read + cache_write + uncached_input) × 100` | Target ≥ 60% |
| `bucket_sys` | `(CLAUDE.md + AGENTS.md chars × 0.3) + 3500` | Fixed system overhead per turn |
| `bucket_tools` | `tool_result_chars × 0.3` | All tool call results this turn |
| `bucket_hist` | `CHAT_TOTAL - bucket_sys - bucket_tools - bucket_output` | Accumulated conversation history |
| `bucket_output` | `(thai_chars × 1.7) + (en_chars × 0.3)` | This response only |
| `hooks_overhead` | Constant 700 | Deferred-tools manifest ~600 + HARNESS REMINDER ~100 |

## Session Summary Record (JSON)

One record written to `.sessions/token_log.jsonl` at session close (phase: close).

```json
{
  "record_type": "session_summary",
  "task_id": "string",
  "skill_name": "string",
  "total_turns": 0,
  "session_total_final": 0,
  "cache_hit_pct_avg": 0.0,
  "peak_chat_total": 0,
  "compact_count": 0,
  "timestamp": "ISO-8601"
}
```

## Storage

Write location: `.sessions/token_log.jsonl` — one JSON object per line (JSONL format).

- Per-turn entries: written after each response (R1 token footer step)
- Session summary: written at Phase 3 completion gate before `/compact`
- Retention: keep last 30 days; archive older entries to `.sessions/archive/token_log_YYYY-MM.jsonl`

## Dashboard Queries (3 key queries)

**Q1 — Cost per task (session_total by task_id):**
```sql
SELECT task_id, skill_name,
       MAX(session_total) AS final_session_tokens,
       SUM(cache_write_tokens) AS total_cache_writes,
       AVG(cache_hit_pct) AS avg_cache_hit_pct
FROM token_log
WHERE record_type IS NULL  -- per-turn entries only
GROUP BY task_id, skill_name
ORDER BY final_session_tokens DESC
```

**Q2 — Cache hit rate trend (by date):**
```sql
SELECT DATE(timestamp) AS date,
       AVG(cache_hit_pct) AS avg_hit_pct,
       SUM(cache_read_tokens) AS total_reads,
       SUM(cache_write_tokens) AS total_writes
FROM token_log
WHERE record_type IS NULL
GROUP BY DATE(timestamp)
ORDER BY date DESC
```

**Q3 — Top token bucket by session (identify waste source):**
```sql
SELECT task_id,
       SUM(bucket_sys)    AS sys_total,
       SUM(bucket_tools)  AS tools_total,
       SUM(bucket_hist)   AS hist_total,
       SUM(bucket_output) AS output_total,
       SUM(bucket_hist) * 1.0 / NULLIF(SUM(bucket_sys + bucket_tools + bucket_hist + bucket_output), 0) AS hist_fraction
FROM token_log
WHERE record_type IS NULL
GROUP BY task_id
ORDER BY hist_fraction DESC
```
High `hist_fraction` (> 0.5) indicates `/compact` was overdue — history dominates context cost.
