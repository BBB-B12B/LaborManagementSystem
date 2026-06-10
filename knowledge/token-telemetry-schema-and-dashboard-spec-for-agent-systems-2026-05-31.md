---
title: Token Telemetry Schema and Dashboard Specification for Agent Systems
topics:
  - agent-systems
  - observability
  - implementation
aliases: [token telemetry schema, token dashboard spec]
source: Synthesized from the token-efficiency knowledge set created on 2026-05-31
created: 2026-05-31
updated: 2026-05-31
status: active
type: build
---

# Token Telemetry Schema and Dashboard Specification for Agent Systems

Implementation-ready telemetry schema and dashboard specification for measuring token behavior in real agent systems. Designed to move teams from qualitative observations about token waste to structured, workflow-level operational visibility.

## Summary

Token optimization is only sustainable when token usage is observable at the task, call, and lifecycle-stage levels. A useful telemetry design must separate top-level workflow cost from individual model-call cost, attribute tokens into actionable buckets (retrieval, tool results, etc.), and make quality, latency, and token spend visible together.

## Design Goals

- Measure token cost at the completed-task level
- Preserve per-call detail for root-cause analysis
- Support cross-provider comparison
- Expose token attribution by lifecycle stage
- Link token use with quality and latency outcomes
- Make p95 and spike behavior easy to detect

## Core Telemetry Model

### Event Layers

| Layer | Purpose |
|---|---|
| task-level record | Represents one completed user-facing workflow |
| call-level record | Represents one model sampling call inside a workflow |
| attribution record | Breaks a call into token-contributing buckets |
| experiment record | Tracks controlled optimization changes |

## Canonical Task-Level Schema

```json
{
  "task_id": "string",
  "session_id": "string",
  "thread_id": "string|null",
  "workflow_type": "string",
  "provider": "string",
  "primary_model": "string",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "duration_ms": 0,
  "call_count": 0,
  "tool_call_count": 0,
  "retrieval_count": 0,
  "input_tokens_total": 0,
  "output_tokens_total": 0,
  "cached_input_tokens_total": 0,
  "cache_write_tokens_total": 0,
  "multimodal_tokens_total": 0,
  "retrieval_tokens_total": 0,
  "tool_result_tokens_total": 0,
  "estimated_cost_usd": 0.0,
  "latency_p95_call_ms": 0,
  "success_state": "success|partial|failed",
  "quality_score": null,
  "user_followup_required": false,
  "compaction_used": false,
  "summary_used": false,
  "notes": "string|null"
}
```

## Canonical Call-Level Schema

```json
{
  "call_id": "string",
  "task_id": "string",
  "sequence_index": 0,
  "provider": "string",
  "model": "string",
  "call_role": "initial|tool_loop|followup|final",
  "started_at": "ISO-8601",
  "ended_at": "ISO-8601",
  "duration_ms": 0,
  "input_tokens": 0,
  "output_tokens": 0,
  "cached_input_tokens": 0,
  "cache_write_tokens": 0,
  "reasoning_tokens": null,
  "tool_schema_tokens": null,
  "retrieval_tokens": null,
  "tool_result_tokens": null,
  "history_tokens": null,
  "multimodal_tokens": null,
  "estimated_cost_usd": 0.0,
  "tool_called": false,
  "tool_name": null,
  "retrieval_used": false,
  "compaction_used": false,
  "summary_used": false,
  "response_status": "success|partial|failed"
}
```

## Canonical Attribution Schema

```json
{
  "call_id": "string",
  "task_id": "string",
  "prefix_instruction_tokens": 0,
  "tool_schema_tokens": 0,
  "retrieval_tokens": 0,
  "history_tokens": 0,
  "user_input_tokens": 0,
  "tool_result_tokens": 0,
  "multimodal_tokens": 0,
  "output_tokens": 0,
  "attribution_method": "exact|estimated|hybrid"
}
```

## Required vs Recommended Fields

| Field group | Requirement | Notes |
|---|---|---|
| task ID, call ID, provider, model | Required | Needed for any serious analysis |
| input and output tokens | Required | Absolute minimum token visibility |
| cached token fields | Recommended, required where supported | Important for cache strategy evaluation |
| retrieval and tool-result attribution | Strongly recommended | Usually the highest-leverage optimization areas |
| quality score or proxy | Recommended | Prevents cost-only optimization |
| estimated cost | Recommended | Makes usage legible to non-LLM stakeholders |

## Provider Mapping Guide

| Canonical field | Anthropic | OpenAI | Google Gemini | Cohere |
|---|---|---|---|---|
| input_tokens | direct | direct | map from runtime or request metrics | derived or runtime-dependent |
| output_tokens | direct | direct | runtime-dependent | runtime-dependent |
| cached_input_tokens | `cache_read_input_tokens` | cached token details | not primary in this packet | not primary in this packet |
| cache_write_tokens | `cache_creation_input_tokens` | cache creation equivalent where available | not primary in this packet | not primary in this packet |
| multimodal_tokens | estimated by content blocks | estimated by request analysis | strongest direct fit through modality details | limited in this packet |
| preflight count | `count_tokens` | mixed surface | `countTokens` | tokenizer/tokenize workflow |

## Ingestion Strategy

### Minimum Viable Pipeline

1. Emit one task record when a workflow starts.
2. Emit one call record per model request.
3. Emit or compute one attribution record per call.
4. Close the task record when the workflow completes.
5. Backfill estimated cost and derived ratios.

### Derived Metrics to Compute

| Metric | Formula |
|---|---|
| tokens_per_task | `input_tokens_total + output_tokens_total` |
| output_input_ratio | `output_tokens_total / max(input_tokens_total, 1)` |
| retrieval_share | `retrieval_tokens_total / max(input_tokens_total, 1)` |
| tool_result_share | `tool_result_tokens_total / max(input_tokens_total, 1)` |
| cache_hit_share | `cached_input_tokens_total / max(input_tokens_total + cached_input_tokens_total, 1)` |
| calls_per_task | `call_count` |
| tool_calls_per_task | `tool_call_count` |

## Dashboard Specification

### Dashboard 1 - Executive Overview

**Purpose:** Show total cost, token volume, and workflow efficiency at a glance.

| Widget | Type | Question answered |
|---|---|---|
| Total tokens by day | time series | Are we growing overall usage? |
| Estimated cost by day | time series | Is spend trending up or down? |
| Tokens per completed task | percentile card set | Are workflows becoming more efficient? |
| Success rate vs token cost | scatter plot | Are we paying more for better outcomes? |
| Top workflow types by cost | bar chart | Which flows deserve attention first? |

### Dashboard 2 - Workflow Diagnostics

**Purpose:** Show where tokens are being consumed inside workflows.

| Widget | Type | Question answered |
|---|---|---|
| Token attribution by bucket | stacked bar | Which lifecycle stage dominates cost? |
| Calls per task distribution | histogram | Which workflows loop too much? |
| Tool-result token share | percentile table | Are tools causing hidden prompt inflation? |
| Retrieval token share | percentile table | Is RAG oversized? |
| Output-input ratio by workflow | grouped bar chart | Are outputs too verbose? |

### Dashboard 3 - Cache and Context Health

**Purpose:** Show whether prompt reuse and state control are working.

| Widget | Type | Question answered |
|---|---|---|
| Cache hit share over time | time series | Is prefix reuse improving? |
| Cache write vs read volume | stacked area | Are we overpaying for cache creation? |
| Conversation length vs task cost | scatter plot | Is context growth driving expense? |
| Compaction usage and savings | table | Does compaction reduce cost or only complexity? |
| Summary-used vs raw-history cost | comparison chart | Is memory policy helping? |

### Dashboard 4 - Provider and Model Comparison

**Purpose:** Support routing decisions and provider-specific optimization.

| Widget | Type | Question answered |
|---|---|---|
| Cost per task by provider | grouped bar | Which provider is cheapest for each workflow class? |
| Latency vs cost by model | scatter plot | Which models offer the best tradeoff? |
| Cache effectiveness by provider | table | Which provider-specific cache strategy is working best? |
| Multimodal token share by provider | grouped bar | Where are media-heavy costs concentrated? |

### Dashboard 5 - Incident and Spike Detection

**Purpose:** Detect token regressions early.

| Alert | Trigger |
|---|---|
| task token spike | p95 tokens per task increases above threshold |
| retrieval inflation | retrieval share exceeds configured band |
| tool-result inflation | tool-result share exceeds configured band |
| cache collapse | cache hit share drops sharply |
| loop explosion | calls per task exceeds workflow norm |
| output runaway | output-input ratio exceeds workflow norm |

## Recommended Queries

### Query 1 - Most Expensive Workflows

```sql
SELECT workflow_type,
       COUNT(*) AS tasks,
       AVG(estimated_cost_usd) AS avg_cost,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY estimated_cost_usd) AS p95_cost,
       AVG(input_tokens_total + output_tokens_total) AS avg_tokens
FROM task_metrics
GROUP BY workflow_type
ORDER BY avg_cost DESC;
```

### Query 2 - Largest Token Buckets

```sql
SELECT workflow_type,
       AVG(retrieval_tokens_total) AS avg_retrieval,
       AVG(tool_result_tokens_total) AS avg_tool_results,
       AVG(input_tokens_total) AS avg_input,
       AVG(output_tokens_total) AS avg_output
FROM task_metrics
GROUP BY workflow_type
ORDER BY avg_tool_results DESC;
```

### Query 3 - Cache Performance

```sql
SELECT provider,
       model,
       AVG(cached_input_tokens_total) AS avg_cached,
       AVG(cache_write_tokens_total) AS avg_cache_write,
       AVG(cached_input_tokens_total / NULLIF(input_tokens_total + cached_input_tokens_total, 0)) AS avg_cache_hit_share
FROM task_metrics
GROUP BY provider, model;
```

## Rollout Checklist

### Phase 1 - Minimum Instrumentation
1. Log task-level and call-level records.
2. Capture input, output, latency, provider, and model.
3. Compute completed-task totals.

### Phase 2 - Attribution and Cost Model
1. Add retrieval, history, and tool-result estimates.
2. Add estimated cost mapping by provider and model.
3. Add cache fields where supported.

### Phase 3 - Dashboard and Alerting
1. Build executive and diagnostic dashboards.
2. Add p95 and spike alerts.
3. Review highest-cost workflow types weekly.

### Phase 4 - Experiment Support
1. Add experiment IDs to task records.
2. Compare baseline and intervention cohorts.
3. Track cost, latency, and success together.

## Quality Guardrails

| Guardrail | Why it matters |
|---|---|
| Always pair cost metrics with success metrics | Cheap failure is not optimization |
| Track p95 and p99, not just averages | Tail behavior often drives incidents |
| Preserve raw data when using summaries | Needed for audit and debugging |
| Version schemas and prompts | Prevents metric drift from silent structural change |

## Action Items

1. Implement canonical task-level and call-level records first.
2. Add attribution estimates for retrieval and tool results immediately after baseline logging works.
3. Build dashboards that expose token cost by workflow, not just by model.
4. Add alerts for p95 spikes, cache collapse, and loop explosions.
5. Use experiment tagging to validate every optimization safely.

**Finding:** Token observability becomes actionable only when tied to workflow completion, attribution buckets, and outcome quality.
**Recommendation:** Build telemetry so that the largest token bucket is obvious without manual investigation.

## Backlinks
_(none yet)_
