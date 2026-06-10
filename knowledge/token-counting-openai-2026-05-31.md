---
title: Token Counting and Token Efficiency for OpenAI
topics:
  - openai
  - token-counting
  - prompt-caching
  - compaction
  - agent-systems
  - cost-optimization
aliases: [OpenAI token counting, OpenAI prompt caching, OpenAI compaction]
source: OpenAI official docs and pricing pages, synthesized via NotebookLM from official source packet
created: 2026-05-31
updated: 2026-05-31
status: active
type: reference
---

# Token Counting and Token Efficiency for OpenAI

Provider-specific reference for agent architecture and token optimization covering OpenAI's token usage, prompt caching, conversation state, and compaction.

## Summary

OpenAI's design is less about a standalone token-count endpoint and more about lifecycle controls around stateful conversations, cached prefixes, and compaction. The most important engineering levers are prompt-prefix stability, careful use of conversation-state mechanisms such as `previous_response_id` or Conversations, and explicit compaction when the context window accumulates too much history and tool traffic.

## Source Coverage

| Source area | Coverage |
|---|---|
| OpenAI pricing | Input, cached input, and output price structure |
| Prompt caching docs | Prefix caching behavior, retention, routing, and best practices |
| Conversation state docs | Stateful vs stateless context carry-forward |
| Compaction docs | Server-side and standalone context reduction |

## Token Accounting Model

| Aspect | OpenAI behavior |
|---|---|
| Runtime usage surface | Usage fields in responses |
| Cached token visibility | Exposed through cached token details |
| Primary operational model | Stateful and stateless response chaining |
| Cost model | Distinguishes input, cached input, and output |
| Context model | Context window covers input and output; some models include reasoning-related usage |

**Finding:** OpenAI optimization is more about controlling the conversation lifecycle than counting isolated prompts in advance.
**Recommendation:** Treat OpenAI token analysis as a request-chain problem, not a single-prompt problem. Use request logging plus state strategy review as the core instrumentation loop.

## How Agent Token Flow Works

### Request Lifecycle

1. Build prompt prefix with instructions, schema, and optional structured-output requirements.
2. Add current user message and any carried-forward conversation state.
3. Submit request directly, through `previous_response_id`, or via a Conversation object.
4. Receive output, which may include tool calls.
5. Execute tools externally.
6. Return tool outputs or next user message into the next response.
7. Compact when the context window becomes too large.

### Token-Bearing Components

| Component | Token effect |
|---|---|
| System or policy instructions | Input tokens |
| Tool definitions | Input tokens, often cacheable if stable |
| Structured output schema | Prefix overhead, also cacheable if stable |
| Prior messages or response chain | Input tokens |
| Tool calls and outputs | Output now, then input later |
| User message | Input tokens |
| Final response | Output tokens |
| Cached prefix | Cached input tokens |

## Prompt Caching Behavior

### Core Behavior

| Aspect | OpenAI behavior |
|---|---|
| Minimum size | Prompts under 1024 tokens do not realize cache hits |
| Prefix rule | Cache hits require exact shared prefixes |
| Retention | Model-dependent; typically in-memory or 24h-style depending on model family |
| Routing | Prefix hash and optional `prompt_cache_key` influence cache locality |

### What Can Be Cached

| Cacheable prefix element | Notes |
|---|---|
| Messages | Full shared prefix of conversation content |
| Images | Cacheable if identical, including matching detail settings |
| Tool lists | Cacheable when unchanged |
| Structured output schema | Acts like prefix content before the system message |

### Best-Practice Pattern

| Pattern | Why it helps |
|---|---|
| Static content first | Maximizes shared prefix |
| Dynamic suffix last | Prevents cache churn |
| Consistent `prompt_cache_key` | Improves cache routing consistency |
| Stable request shape | Increases hit rate and lowers latency |

**Finding:** OpenAI caching is fundamentally prefix economics. Small prompt-shape drift can erase most of the benefit.
**Recommendation:** Freeze tool schemas and response schemas where possible. Keep user-specific material and timestamps at the tail of the request.

## Conversation State and Context Growth

### State Options

| Option | Behavior |
|---|---|
| Manual stateless chaining | Append prior inputs and outputs yourself |
| `previous_response_id` | Chain responses with less manual reconstruction |
| Conversations API | Persist long-lived conversation state as a first-class object |

### Growth Pattern

As interaction continues, OpenAI context accumulates:
- user messages
- assistant messages
- tool calls
- tool outputs
- retained items from prior windows
- compaction items

### Why Agent Loops Become Expensive

| Growth driver | Why it matters |
|---|---|
| Full transcript chaining | Repeats old content |
| Tool outputs | Often much larger than user turns |
| Structured output schemas | Repeated overhead when not stabilized or cached |
| Retrieval inserts | Adds large dynamic chunks per turn |

**Finding:** OpenAI's state features do not remove token cost by themselves. They change how state is managed, not whether state exists.
**Recommendation:** Measure token growth per completed top-level task, not only per API call. Attribute growth to transcript, retrieval, and tool-result reinsertion separately.

## Compaction

### Modes

| Mode | Description |
|---|---|
| Server-side compaction | Triggered by context-management thresholds |
| Standalone compaction | Explicit compaction call returns a canonical reduced window |

### Operational Rules

| Rule | Meaning |
|---|---|
| Use compaction for long-running workflows | Reduces context while preserving needed state |
| Do not prune compact output manually | Returned compacted window is canonical |
| If using `previous_response_id`, do not manually prune | The chaining semantics already manage continuity |
| Latest compaction item is the key carry-forward unit | Earlier items before it can often be dropped in stateless chaining |

**Finding:** Compaction is OpenAI's key answer to long-running context inflation.
**Recommendation:** Add a compaction threshold in any agent workflow expected to cross moderate conversation length. Compare quality before and after compaction on representative tasks.

## Optimization Levers

| Lever | Why it saves tokens | Primary risk |
|---|---|---|
| Stable prefix caching | Replaces repeated input with cached input | Cache misses from drift |
| `prompt_cache_key` discipline | Improves locality and hit behavior | Over-fragmentation of cache key space |
| Conversations or `previous_response_id` | Cleaner state management | Hidden transcript growth if not audited |
| Compaction | Controls long-run window size | Loss of edge-case detail |
| Structured output reuse | Makes schemas cacheable | Less flexibility in per-call output shape |
| Tool-result normalization | Reduces later-turn input | Possible information loss |
| Retrieval narrowing | Cuts dynamic input chunk size | Lower recall |
| Output constraints | Reduces output billing | Overly terse answers |

## Telemetry to Capture

| Metric | Why it matters |
|---|---|
| input tokens | Measures active request size |
| cached tokens | Measures realized cache value |
| output tokens | Measures answer and tool-call verbosity |
| latency | Validates caching/compaction payoffs |
| tool count | Identifies loop-heavy requests |
| conversation length | Predicts need for compaction |
| retrieval tokens | Detects noisy RAG behavior |
| compaction events | Shows long-run state management behavior |

## Distinctive Strengths of OpenAI

| Distinctive trait | Why it stands out |
|---|---|
| Stateful conversation options | Useful for agent systems with durable threads |
| First-class compaction | Strong answer to transcript sprawl |
| Cached input pricing model | Rewards stable prompt engineering |
| Schema-aware caching guidance | Important for structured-output-heavy systems |

## Action Items

1. Log usage at every response step and group it by top-level user task.
2. Standardize prompt prefixes and schema placement.
3. Use `prompt_cache_key` intentionally on repeated workloads.
4. Add compaction thresholds for long-running agents.
5. Separate tool-result tokens from user-message tokens in observability.

**Finding:** OpenAI is strongest when an engineer treats token efficiency as state management plus prefix reuse, not just prompt trimming.
**Recommendation:** Prioritize compaction, cacheable schemas, and request-shape consistency before spending effort on minor prompt wording reductions.

## Open Research Gaps

| Gap | Notes |
|---|---|
| Optimal compaction thresholds by workflow type | Needs empirical tuning |
| Tradeoff between manual chaining and stateful APIs | Depends on debugging and observability needs |
| Best cache-key partitioning strategy | Requires workload-specific routing analysis |

## Backlinks
_(none yet)_
