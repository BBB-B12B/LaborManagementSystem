---
title: Cross-Provider Token Routing Strategy
date: 2026-06-01
topics: [cost_optimization, token_efficiency, token_counting]
references:
  - knowledge/token-counting-cross-provider-comparison-2026-05-31.md
status: active
type: reference
---

## Purpose
Decision framework for routing agent tasks to the cheapest capable provider.

## Provider Cost Tiers (2026)
| Provider | Input $/MTok | Cached $/MTok | Output $/MTok | Best for |
|---|---|---|---|---|
| Claude Sonnet 4.x | $3.00 | $0.30 | $15.00 | Complex reasoning, code, multi-step agent loops |
| Claude Haiku 3.x | $0.25 | $0.03 | $1.25 | Classification, verification, targeted reads |
| Gemini Flash 2.x | $0.075 | ~$0.019 | $0.30 | Lookup, summarize, multimodal preflight |
| OpenAI GPT-4o-mini | $0.15 | $0.075 | $0.60 | Stateful agent loops, compaction-heavy tasks |
| Cohere Command R | $0.15 | n/a | $0.60 | Offline batch, preprocessing, tokenizer access |

> Note: Prices approximate as of 2026-06. Always verify at provider pricing pages before budget planning.
> Source: cross-provider comparison file — no explicit prices listed there; tiers reflect known public rates.

## Routing Decision Tree

### Rule 1 — Task Complexity
- Complex reasoning / multi-step / code → Claude Sonnet (quality priority)
- Single lookup / classification / summarize <2k tokens → Gemini Flash or Cohere (cost priority)
- Batch offline jobs → check provider batch pricing

### Rule 2 — Token Volume
- <1k tokens → any provider, default Claude
- 1k–10k tokens → evaluate cache hit rate first; if <30% hit → consider Gemini
- >10k tokens → mandatory cache strategy or provider switch

### Rule 3 — Harness Phase Routing
| Phase | Recommended provider | Reason |
|---|---|---|
| Boot / B1-B3 | Claude Sonnet | Needs full instruction following |
| G1 Scan (Phase 1) | Claude Haiku | Simple grep + classify |
| G2 Reads | Claude Haiku | Targeted file reads |
| M1-M3 MECE Plan | Claude Sonnet | Reasoning heavy |
| L1-L5 REACT | Claude Sonnet | Code edits need quality |
| Reviewer (Completion Gate) | Claude Haiku | Verify only — read-only |

## Estimated Savings by Task Mix
| Scenario | Relative cost | Savings vs baseline |
|---|---|---|
| All Sonnet | 100% | baseline |
| Route Haiku for G1+G2+Reviewer | ~65% | ~35% savings |
| Add Gemini for lookup tasks | ~55% | ~45% savings |

## Implementation Notes
- requires detected.md provider field + routing config in settings
- quality gate: run Reviewer on routed output — if FAIL → retry with Sonnet
- Anthropic cache TTL = 5 min; Gemini/OpenAI cache policies differ — verify before routing long sessions
- Cross-provider insight (from comparison file): real cost centers are stable instructions, tool schemas, retrieved context, tool results, and growing conversation state — not just the latest user message
