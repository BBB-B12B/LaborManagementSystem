---
title: Token Efficiency Implementation Checklist for Agent Systems
topics:
  - agent-systems
  - token-efficiency
  - implementation
  - observability
  - caching
  - compaction
  - retrieval
aliases: [token efficiency checklist, agent token optimization checklist]
source: Synthesized from official provider documentation and the token-efficiency knowledge set created on 2026-05-31
created: 2026-05-31
updated: 2026-05-31
status: active
type: build
---

# Token Efficiency Implementation Checklist for Agent Systems

Translates the token-counting research set into an implementation sequence for real agent systems. Organized in execution order so teams can move from visibility to intervention without guessing.

## Summary

The correct unit of optimization is the completed workflow, not the last prompt. Most savings come from measuring token attribution, controlling retrieval and tool-result size, designing stable prompt prefixes, and managing long-running state with summary or compaction.

## Scope

Use this checklist when you need to:
- understand why agent requests are expensive
- reduce token usage across multi-call workflows
- improve cache hit rate
- control conversation-state growth
- compare token behavior across providers
- create a repeatable optimization practice

---

## Phase 1 - Establish Baseline Observability

**Objectives:** measure token usage at the workflow level, separate top-level task cost from individual API call cost, make repeated overhead visible.

### Checklist
1. Define a top-level task ID for every user request.
2. Log every model call under that task ID.
3. Record provider, model, latency, and outcome for each call.
4. Record input tokens, output tokens, and cached-token fields when available.
5. Group all calls into one completed-task total.

### Required Telemetry

| Field | Why it matters |
|---|---|
| task_id | Groups multi-call workflows |
| call_id | Distinguishes individual sampling calls |
| provider | Enables cross-provider analysis |
| model | Enables routing and cost comparisons |
| input_tokens | Measures request size |
| output_tokens | Measures response verbosity |
| cached_input_tokens or equivalent | Measures reuse effectiveness |
| latency_ms | Captures cost-performance tradeoffs |
| success_state | Prevents optimizing for cheap failures |

**Finding:** Teams usually under-measure agent cost because they only inspect single-call usage.
**Recommendation:** Make task-level aggregation mandatory before any optimization work begins.

---

## Phase 2 - Build Token Attribution by Lifecycle Stage

**Objectives:** locate the largest sources of waste, distinguish structural prompt cost from task-specific cost.

### Attribution Buckets

| Bucket | Contents |
|---|---|
| prefix_instructions | system rules, policy, developer instructions |
| tool_schema | tool names, descriptions, input schemas |
| retrieval | retrieved chunks, documents, snippets |
| history | prior conversation turns or memory state |
| user_input | current user message |
| tool_results | returned tool payloads fed back to the model |
| multimodal | images, documents, video, file-derived prompt content |
| output | assistant answer and tool calls |

### Checklist
1. Estimate token contribution per bucket when the provider exposes enough structure.
2. If exact attribution is unavailable, build deterministic approximations at the orchestrator layer.
3. Store per-bucket estimates with every model call.
4. Rank buckets by median and p95 token contribution.

**Finding:** Tool results and retrieval are often larger than the actual user input.
**Recommendation:** Prioritize optimization where the bucket size is largest, not where the prompt is easiest to edit.

---

## Phase 3 - Stabilize the Prompt Prefix

**Objectives:** make shared prompt content reusable, improve prompt caching success where supported, reduce repeated structural overhead.

### Checklist
1. Separate prompt content into stable prefix and dynamic suffix.
2. Move system instructions, tool schemas, and structured output schemas into the stable prefix.
3. Move timestamps, user-specific variables, and changing retrieval content into the suffix.
4. Keep serialization and field ordering stable for structured content.
5. Version tool schemas intentionally instead of editing them casually.

### Validation Signals

| Signal | Interpretation |
|---|---|
| higher cache hit rate | Prefix stability improved |
| lower uncached input tokens | Less repeated suffix bloat |
| lower latency | Cache or shorter request path is helping |

**Finding:** Prefix instability silently destroys caching gains.
**Recommendation:** Treat prompt structure as an interface contract, not just a string template.

---

## Phase 4 - Reduce Retrieval Waste

**Objectives:** cut irrelevant prompt context, improve signal per token.

### Checklist
1. Record tokens per retrieved chunk.
2. Record top-k count per request.
3. Measure how often retrieved chunks are actually cited or used.
4. Lower top-k for experiments before changing chunk size.
5. Deduplicate overlapping chunks.
6. Prefer excerpt-level retrieval over full-document insertion.
7. Review p95 retrieval-token requests separately from median requests.

### Quality Guardrails

| Risk | Guardrail |
|---|---|
| lower recall | compare answer accuracy before and after top-k reduction |
| loss of evidence | track citation or source-usage patterns |
| fragmentation | evaluate chunk size together with ranking quality |

**Finding:** Retrieval noise usually harms both cost and answer quality.
**Recommendation:** Treat retrieval efficiency as a first-tier optimization area.

---

## Phase 5 - Redesign Tool Schemas and Tool Results

**Objectives:** shrink repeated tool overhead, prevent large reinsertion payloads from dominating later turns.

### Checklist for Tool Schemas
1. Shorten descriptions that the model does not need repeatedly.
2. Remove redundant parameter explanations.
3. Split rarely used heavy tools from common light tools when possible.
4. Audit schema tokens per tool and rank the worst offenders.

### Checklist for Tool Results
1. Measure raw tool-result token size.
2. Strip irrelevant fields before reinsertion.
3. Convert raw logs, HTML, or large JSON into normalized summaries when possible.
4. Preserve raw payloads outside the model context when full detail is only needed for audit or debugging.
5. Reinsert structured summaries instead of raw dumps unless the reasoning step truly needs full fidelity.

### Validation Signals

| Signal | Interpretation |
|---|---|
| lower input tokens on post-tool calls | Reinsertion compression is working |
| stable task success | Compression did not remove needed detail |
| lower p95 workflow cost | Tool-heavy requests improved |

**Finding:** Tool-result reinsertion is one of the largest hidden token taxes in agent systems.
**Recommendation:** Build a tool-result normalization layer instead of passing raw outputs back to the model by default.

---

## Phase 6 - Manage Conversation State Growth

**Objectives:** control transcript sprawl, preserve useful continuity with fewer tokens.

### Checklist
1. Measure conversation length in turns and tokens.
2. Decide when to keep raw history, when to summarize, and when to compact.
3. Add rolling summaries for long tasks.
4. Use provider compaction features where available.
5. Keep obsolete turns out of future requests unless they still influence behavior.
6. Validate that summaries preserve active goals, constraints, and unresolved issues.

### State-Policy Choices

| Policy | Best use | Main risk |
|---|---|---|
| raw transcript | short tasks | rapid token growth |
| rolling summary | medium to long workflows | summary drift |
| provider compaction | long-running systems | opaque reduction behavior |
| structured memory state | repeatable operational agents | higher implementation effort |

**Finding:** Long-running agent cost is mainly a memory-policy problem.
**Recommendation:** Create an explicit state-retention policy instead of letting transcripts grow by default.

---

## Phase 7 - Add Output Controls

**Objectives:** prevent output inflation, reduce waste from unnecessary verbosity.

### Checklist
1. Record output-token distribution by workflow type.
2. Set output contracts for predictable tasks.
3. Use structured outputs when they reduce prose overhead.
4. Cap max output where safe.
5. Separate draft, routing, and final-answer modes if the workflow supports it.

### Guardrails

| Risk | Guardrail |
|---|---|
| responses too short | validate task success and user satisfaction |
| broken structure | test schema adherence |
| hidden retries | check whether shorter outputs trigger more follow-up calls |

**Finding:** Output control is often easier than input reduction and can save substantial cost.
**Recommendation:** Optimize verbosity at the workflow-contract level, not ad hoc per prompt.

---

## Phase 8 - Evaluate Provider-Specific Levers

### Checklist by Provider

| Provider | First levers to test |
|---|---|
| Anthropic | explicit cache breakpoints, cache-read monitoring, tool-schema stability |
| OpenAI | prompt-cache discipline, compaction thresholds, conversation-state policy |
| Google Gemini | multimodal preflight counting, media budgeting, selective file context |
| Cohere | local tokenization, chunk budgeting, tokenizer-aware preprocessing |

**Finding:** The shared optimization framework is universal, but each provider exposes different control points.
**Recommendation:** Use one shared observability schema and layer provider-specific optimizations on top of it.

---

## Phase 9 - Run Controlled Experiments

### Experiment Design Checklist
1. Change one lever at a time.
2. Compare against a baseline on the same workflow mix.
3. Track median, p95, and p99 token cost.
4. Track success quality and latency together.
5. Reject interventions that save tokens but materially harm workflow completion.

### Suggested Experiment Order
1. Retrieval reduction
2. Tool-result compression
3. Prompt-prefix stabilization
4. Summary or compaction policy
5. Output constraints
6. Model routing

---

## Phase 10 - Operationalize the Practice

### Checklist
1. Build dashboards for task-level token cost.
2. Add alerts for sudden p95 token spikes.
3. Review top waste buckets weekly.
4. Tie optimization findings back into prompt, retrieval, and tool governance.
5. Maintain a living benchmark set for quality regression checks.

---

## Implementation Readiness Scorecard

| Question | Yes / No |
|---|---|
| Do you log every model call under a task ID? | |
| Do you separate input, output, and cached-token fields? | |
| Do you estimate retrieval-token cost per request? | |
| Do you estimate tool-result reinsertion cost? | |
| Do you have a state-retention policy? | |
| Do you use output contracts for repeatable workflows? | |
| Do you measure quality alongside cost? | |
| Do you review p95 and not only averages? | |

## Recommended First 30 Days

| Week | Focus |
|---|---|
| Week 1 | baseline observability and task-level grouping |
| Week 2 | token attribution and retrieval analysis |
| Week 3 | tool-result compression and prompt-prefix stabilization |
| Week 4 | state policy, output controls, and first controlled experiments |

## Action Items

1. Start with observability, not prompt rewriting.
2. Rank the biggest token buckets before optimizing.
3. Attack retrieval and tool-result waste first.
4. Add state policy and cache strategy second.
5. Use experiments to protect quality while reducing cost.

**Finding:** The most effective token-efficiency work changes workflow shape, not just prompt wording.
**Recommendation:** Treat token optimization as systems engineering for agent workflows.

## Backlinks
_(none yet)_
