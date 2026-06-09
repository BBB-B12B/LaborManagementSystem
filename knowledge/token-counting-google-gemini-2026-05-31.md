---
title: Token Counting and Token Efficiency for Google Gemini and Vertex AI
topics:
  - google
  - gemini
  - token-counting
  - multimodal
  - agent-systems
  - cost-optimization
aliases: [Gemini token counting, Vertex countTokens]
source: Google official Vertex AI documentation, synthesized via NotebookLM from official source packet
created: 2026-05-31
updated: 2026-05-31
status: active
type: reference
---

# Token Counting and Token Efficiency for Google Gemini and Vertex AI

Provider-specific reference for teams building multimodal or agent-style systems on Google Gemini through the Vertex AI surface.

## Summary

Google's strongest documented surface in this packet is the Count Tokens API. It is particularly useful for multimodal planning because it returns both token estimates and billable character information. For agent systems, the main value is preflight sizing of prompts, retrieved context, and multimodal attachments before generation calls are sent.

## Source Coverage

| Source area | Coverage |
|---|---|
| Vertex AI Count Tokens API | Supported models, request shape, multimodal counting, quota notes |

## Token Counting Model

| Aspect | Google behavior |
|---|---|
| Preflight count API | `:countTokens` on model endpoint |
| Count scope | Prompt contents, including multimodal parts |
| Return fields | `totalTokens`, `totalBillableCharacters`, modality token details |
| Supported focus | Strong visibility into multimodal prompt sizing |
| Cost to count | Count Tokens API documented as no-charge/no-quota-billing within stated limits |

**Finding:** Gemini's documented strength is preflight measurement of multimodal prompt payloads before generation.
**Recommendation:** Call `countTokens` for any workflow that mixes text with files, images, or video. Use `totalBillableCharacters` alongside token counts when forecasting cost behavior.

## How Agent Token Flow Works

### Request Lifecycle

1. Build `contents` with role plus parts.
2. Add text and any file or media parts.
3. Call `countTokens` if sizing is needed.
4. Send generation request with the same or related payload.
5. Append later-turn content, retrieved context, or tool results in future calls.

### Token-Bearing Components

| Component | Token effect |
|---|---|
| Text parts | Text tokens |
| File parts | Modality-specific prompt tokens |
| Retrieved context | Text tokens |
| User history | Text tokens |
| Tool-like orchestration payloads | Input tokens when injected as text or structured content |
| Model outputs | Output tokens at runtime |

## Multimodal Counting Strength

| Capability | Why it matters |
|---|---|
| Image/video-aware count estimation | Important when media dominates prompt cost |
| Prompt tokenizer visibility in console | Useful for manual inspection |
| Modality token detail fields | Better attribution than a single aggregate count |

**Finding:** Gemini is especially useful where media, not just text, is a major source of prompt expansion.
**Recommendation:** Track modality-level prompt inflation separately from text-only growth. Design a media budget per workflow, not just a text budget.

## Context Growth in Multi-Turn Systems

Gemini context grows with repeated inclusion of:
- prior text history
- retrieved documents
- file references or media parts
- tool-result payloads if reintroduced as text

### Main Growth Risks

| Growth source | Why it matters |
|---|---|
| Repeated media context | Can be expensive even when text is short |
| Large file parts | Raise total prompt tokens rapidly |
| Retrieval plus media | Combined multimodal context can crowd the window |
| Raw tool output pasted as text | Hidden cost in later turns |

**Finding:** In Gemini workflows, media and files can dominate token usage faster than the user realizes.
**Recommendation:** Count before sending whenever media or large documents are involved. Prefer references or extracted summaries over repeated full file context.

## Optimization Levers

| Lever | Why it saves tokens | Primary risk |
|---|---|---|
| Preflight count checks | Prevents accidental oversizing | Extra engineering step |
| Media budgeting | Avoids hidden multimodal inflation | Under-context for visual tasks |
| Selective excerpting | Reduces full-document reinsertion | Missed evidence |
| Retrieval narrowing | Cuts text overhead | Lower recall |
| Tool-result compression | Reduces later-turn prompt size | Potential detail loss |
| Output constraints | Reduces output tokens | Over-compression |

## Telemetry to Capture

| Metric | Why it matters |
|---|---|
| `totalTokens` | Baseline prompt size |
| `totalBillableCharacters` | Secondary cost signal |
| prompt token details by modality | Reveals whether text or media is the main cost driver |
| media count and type | Ties usage spikes to file inputs |
| retrieval tokens | Distinguishes RAG inflation from media inflation |
| completed-task token totals | Shows workflow-level economics |

## Distinctive Strengths of Gemini / Vertex AI

| Distinctive trait | Why it stands out |
|---|---|
| Count Tokens API with modality detail | Better multimodal planning |
| Billable character signal | Useful secondary accounting dimension |
| Good fit for preflight prompt sizing | Strong for pipeline validation |

## Action Items

1. Add `countTokens` as a preflight check for multimodal or long-document requests.
2. Record modality-level token details in logs.
3. Budget separate caps for text, images, and documents.
4. Avoid repeatedly sending the same heavy media context without justification.

**Finding:** Gemini is strongest in workflows where prompt sizing uncertainty comes from multimodal inputs rather than only text history.
**Recommendation:** Use Gemini preflight counts as a gating and budgeting tool in multimodal pipelines.

## Open Research Gaps

| Gap | Notes |
|---|---|
| Best policy for reusing media context across turns | Needs workflow-specific testing |
| Tradeoff between extracted summaries and full-file context | Depends on task fidelity requirements |
| Runtime token usage visibility beyond preflight in this source packet | Needs additional official source expansion |

## Backlinks
_(none yet)_
