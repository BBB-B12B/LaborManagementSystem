---
title: Cross-Provider Comparison of Token Counting and Token Efficiency
topics:
  - token-counting
  - anthropic
  - openai
  - google
  - gemini
  - cohere
  - prompt-caching
  - compaction
  - multimodal
  - agent-systems
aliases: [token counting comparison, provider token comparison]
source: Synthesized from provider-specific official documentation notes created on 2026-05-31
created: 2026-05-31
updated: 2026-05-31
status: active
type: reference
---

# Cross-Provider Comparison of Token Counting and Token Efficiency

Central summary comparing how Anthropic Claude, OpenAI, Google Gemini (Vertex AI), and Cohere expose token counting and token-efficiency controls. Covers common principles, provider differences, and distinctive strengths.

## Summary

Across providers, the same high-level rule holds: token cost is driven by the full lifecycle of a request chain, not just the latest user message. The largest recurring cost drivers are stable instructions, tool schemas, retrieved context, tool results, and growing conversation state. The main provider differences are where they expose control: Anthropic is strongest on explicit cache accounting, OpenAI on state and compaction, Google on multimodal count preflight, and Cohere on tokenizer access.

## Provider Summary Table

| Provider | Strongest documented token surface | Best fit |
|---|---|---|
| Anthropic Claude | Token count endpoint plus explicit prompt caching controls | Agent loops with large stable prefixes |
| OpenAI | Prompt caching plus conversation-state and compaction controls | Long-running stateful agent systems |
| Google Gemini / Vertex AI | Count Tokens API with multimodal details | Media-heavy or multimodal pipelines |
| Cohere | Tokenizer and local tokenization workflow | Preprocessing and offline token estimation |

## What Is Similar Across Providers

| Shared principle | Why it matters |
|---|---|
| Context window is finite | Input growth eventually competes with output budget |
| Multi-turn state increases cost | Every carried-forward item consumes prompt budget |
| Retrieval can waste tokens | Irrelevant chunks cost money and hurt quality |
| Tool traffic inflates prompts | Tool schema and tool results both add cost |
| Shorter is not always better | Over-compression can lower quality and force retries |
| Workflow cost is multi-call | One user instruction often maps to several model requests |

## What Is Distinctive by Provider

| Provider | Distinctive capability | Why it stands out |
|---|---|---|
| Anthropic | `count_tokens` plus `cache_creation_input_tokens` and `cache_read_input_tokens` | Best explicit accounting for cached vs uncached input |
| OpenAI | Conversations, `previous_response_id`, and compaction | Best documented answer to persistent long-running state |
| Google | `countTokens` with modality details and billable characters | Best prompt-sizing visibility for multimodal requests |
| Cohere | Tokenize/detokenize endpoints and local tokenizer support | Best developer ergonomics for offline token estimation |

## Comparison of Control Levers

| Lever | Anthropic | OpenAI | Google | Cohere |
|---|---|---|---|---|
| Preflight token count | Strong | Moderate | Strong | Strong via tokenizer tooling |
| Prompt caching | Strong | Strong | Not central in this packet | Not central in this packet |
| Compaction | Not central in this packet | Strong | Not covered | Not covered |
| Stateful conversation primitives | Standard multi-turn messages | Strong | Not central | Not central |
| Multimodal count visibility | Good | Moderate | Strong | Limited |
| Local token estimation | Not central | Not central | Not central | Strong |

## Context Growth Comparison

| Provider | Main growth story |
|---|---|
| Anthropic | Prefix-heavy agent loops benefit greatly from cache design, but tool schemas and tool results still dominate growth |
| OpenAI | Long-running state must be managed through compaction or state strategy to prevent transcript sprawl |
| Google | Multimodal content can dominate prompt growth faster than plain text |
| Cohere | Growth is easiest to reason about through tokenizer-aware preprocessing and chunk control |

## Best Shared Optimization Moves

| Move | Why it works across providers |
|---|---|
| Separate stable prefix from dynamic suffix | Makes repeated content easier to reuse or cache |
| Keep tool schemas compact | Reduces repeated overhead |
| Compress tool results before reinsertion | Prevents later-turn prompt bloat |
| Narrow retrieval aggressively | Reduces irrelevant context |
| Summarize long history | Controls context growth |
| Constrain outputs | Prevents runaway output billing |
| Measure per completed task | Matches real agent economics |

## Shared Failure Patterns

| Failure pattern | Cross-provider effect |
|---|---|
| Sending full history every turn | Fast context inflation |
| Over-retrieval | High input cost and lower answer quality |
| Verbose tool descriptions | Hidden repeated tax |
| Raw logs or HTML in tool results | Massive reinsertion overhead |
| Dynamic values inside cached prefixes | Cache misses or poor reuse |
| Optimizing only the latest user prompt | Misses the real cost centers |

## Research Priorities

| Research area | Why it matters |
|---|---|
| Token attribution by lifecycle stage | Identifies the largest real cost centers |
| Retrieval efficiency | Usually the highest-leverage input optimization area |
| Tool-result compression policy | Major agent-loop savings opportunity |
| Memory policy design | Determines long-run context shape |
| Cache strategy benchmarking | Important where stable prefixes dominate |
| Model-routing economics | Reduces cost before prompt-level optimization even begins |

## Recommendation Map

| If your main problem is... | Start with... |
|---|---|
| repeated large prefixes | Anthropic or OpenAI cache strategy analysis |
| long-running threaded agents | OpenAI compaction and state policy |
| multimodal prompt uncertainty | Gemini `countTokens` instrumentation |
| offline prompt budgeting | Cohere tokenizer workflow |
| unknown agent token spikes | provider-agnostic token attribution logging |

## Action Items

1. Use the provider-specific notes as canonical references.
2. Build one shared observability schema across all providers.
3. Compare costs at the top-level task, not just the per-call level.
4. Standardize token attribution into prefix, retrieval, tools, tool-results, history, and output.

**Finding:** Provider choice changes where optimization is easiest, but not the core economics of agent workflows.
**Recommendation:** Normalize observability first, then apply provider-specific optimizations second.

## Backlinks
_(none yet)_
