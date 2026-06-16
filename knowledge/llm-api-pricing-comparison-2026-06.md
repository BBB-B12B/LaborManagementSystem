# LLM API Pricing Comparison — June 2026
> Source: user-compiled from official pricing pages (OpenAI, Anthropic, Google) ~Jun 2026.
> Rates fluctuate — verify at provider pricing pages before long-term planning.

---

## Table A — Per-Model Rates (USD per 1M tokens)

| Provider | Model | Input | Output | Cached Input | Best For |
|---|---|---|---|---|---|
| OpenAI / Codex | GPT-5.5 (flagship) | $5 | $30 | $0.50 | Hardest tasks, complex agents |
| OpenAI / Codex | GPT-5.4 | $2.50 | $15 | ~$0.25 | Frontier, budget-friendly |
| OpenAI / Codex | GPT-5.3-Codex | ~$1.75 | ~$14 | ~$0.18 | Coding-specialist agent |
| OpenAI / Codex | GPT-5.4 Nano | $0.20 | $1.25 | — | Lightweight / extraction |
| Anthropic / Claude Code | Opus 4.8 (flagship) | $5 | $25 | $0.50 | Heavy reasoning / hard refactors |
| Anthropic / Claude Code | Sonnet 4.6 | $3 | $15 | $0.30 | Main coding workhorse |
| Anthropic / Claude Code | Haiku 4.5 | $1 | $5 | $0.10 | Cheap/fast, easy tasks |
| Google / Gemini | Gemini 3.1 Pro | $2 | $12 | ~$0.20–0.40 | High-quality, long context |
| Google / Gemini | Gemini 3.5 Flash | $1.50 | $9 | $0.15 | Balanced price/quality |
| Google / Gemini | Gemini 3.1 Flash-Lite | $0.25 | $1.50 | — | High-volume easy tasks |
| Google / Gemini | Gemini 2.5 Flash-Lite | $0.10 | $0.40 | — | Cheapest, high-volume |

---

## Table B — Mechanisms, Gotchas, Scores

### Cache Behavior

| Provider | Write cost | Read cost | TTL | Auto vs explicit |
|---|---|---|---|---|
| OpenAI | None | ~10% of input (−90%) | 5–10 min | Automatic when prefix stable >~1024 tokens |
| Anthropic | 1.25× (5-min TTL) or 2× (1-hr TTL) | 0.1× (−90%) | 5 min / 1 hr | Explicit breakpoint placement |
| Google | Storage cost per hour | ~75–90% reduction | varies | Implicit + explicit |

### Key Gotchas

| Provider | Gotcha |
|---|---|
| OpenAI | Cache TTL short 5–10 min; prefix must stay stable. credit-system changed 2 Apr. |
| Anthropic | Must place stable prefix — shifting prefix means paying write cost again each turn |
| Google | **200K input threshold**: crossing it reprices the ENTIRE request (in+out) at long-context rate — silent spike risk |

### Long-Context Pricing Cliffs

| Provider | Cliff | Impact |
|---|---|---|
| OpenAI | ~270K input | Whole session may be repriced |
| Anthropic | None (1M context at flat rate) | Predictable at any context size |
| Google | 200K input | Entire request (in+out) repriced |

### Reasoning / Thinking Tokens

All three providers count thinking tokens as **output tokens** (not returned in the response but billed).
Applies to: GPT-5.5, GPT-5.4 Pro, GPT-5.3-Codex, Claude extended thinking, Gemini thinking models.

### Batch (Async) Discount

All three providers: **−50%** on async/batch endpoints.

---

## Table C — Scores for Coding-Agent Use Case

| Provider | Score | Reason |
|---|---|---|
| Anthropic (Claude Code) | 9/10 | Fine-grained cache control; 1M context no pricing cliff; Sonnet 4.6 cost-effective workhorse. Loses points for strict prefix/TTL discipline required. |
| OpenAI (Codex) | 8.5/10 | Auto-cache (no write cost); coding-specialist models cheaper than flagship; 270K cliff higher than Gemini. Loses points for short cache TTL and post-Apr credit system changes. |
| Google (Gemini) | 8/10 | Cheapest raw rates (especially Flash); largest context window. Loses points for the 200K repricing trap — real risk for large codebase work. Flash under 200K can be cheapest overall if disciplined. |

---

## Relation to This Repo

- `knowledge/provider-routing-strategy-2026-06-01.md` — routing logic (which model for which task)
- `knowledge/token-counting-cross-provider-comparison-2026-05-31.md` — token counting methods per provider
- `Implement/03_config.md §Token Tracking` — harness token tracking implementation
- `AGENTS.md §Sub-agent Rules` — model routing table (`MODEL_LOW` / `MODEL_MEDIUM` / `MODEL_HIGH`)

---

## Key Insight for Subscription Users

On subscription plans (Claude Code Max, Codex Plus/Pro), per-token billing is not directly visible —
but these rates determine **how fast quota drains**. Choosing the right model tier + preserving cache +
limiting turn count = more work per quota unit, on both subscription and direct API.
