---
name: delegate
description: Hand a confirmed, mechanical MECE Phase-3 section to a cheap Haiku sub-agent instead of running it in the expensive main context. Use when a `[ ] S<N>` section is already planned, self-contained (absolute paths + its own Verify-N), and mechanical — edit-as-instructed, bulk rename/format, find-replace, scaffolding, or run-and-report. Also triggers on "delegate this", "send it to Haiku", "do this cheaply", "offload". Do NOT use for planning, debugging judgment, security-sensitive edits, R14/R15-gated paths, or anything needing this conversation's context.
triggers:
  - "delegate"
  - "offload"
  - "send to haiku"
  - "do this cheaply"
  - "cheap model"
  - "mechanical section"
---

## Sections
```
- id: 1
  name: "Eligibility Gate"
  steps: ["confirm section came from a passed MECE plan", "confirm mechanical (edit/format/bulk/report)", "confirm no R14/R15-gated path", "any fail → refuse + run in main context"]
- id: 2
  name: "Build & Spawn"
  steps: ["feed the MECE section verbatim as the standalone prompt", "spawn Agent with model=model_low (Haiku)", "scope tools to the minimum the section needs"]
- id: 3
  name: "Self-Verify & Escalate"
  steps: ["run the section's Verify-N on the output", "PASS → report done", "FAIL → auto-retry once → still FAIL → escalate to MODEL_MEDIUM + emit [delegate-escalated]"]
```

---

# Delegate

Offload **already-planned, mechanical** MECE sections to a **Haiku** sub-agent so the expensive reasoning models (Opus/Sonnet) stay reserved for planning and judgment. The cheap model is named in `detected.md` as `model_low` — never hardcode the id; resolve it from the active provider.

## Operating Stance
A passed MECE plan **is** the standalone delegate prompt. Each `[ ] S<N>` section already carries tight scope, absolute paths, minimal context, and a Verify-N acceptance test — exactly the conditions where Haiku is reliable and cheap. You do not invent a new "is this menial?" judgment: the trigger is simply "this section came out of a confirmed MECE plan and is mechanical." Unplanned / exploratory / judgment work never reaches this stage as a clean section, so it is never delegated.

## When to Invoke
- A `[ ] S<N>` section in a **confirmed** `mece_plan.md` is marked mechanical (Model: model_low, or task = edit-as-instructed / format / bulk / report).
- The user explicitly says delegate / offload / "send to Haiku" / "do this cheaply".

## When NOT to Use (refuse → run in main context)
- Planning, architecture, or MECE design.
- Debugging that needs reasoning, or any security-sensitive change.
- A section touching an R14/R15-gated path (e.g. `src/db/`, protected paths in the active domain pack).
- Anything needing this conversation's context, or where a wrong cheap-model edit is costly to catch.
- The section has no real Verify-N (a "looks ok" check is not delegable — self-verify would be meaningless).
- When in doubt → keep it. Emit `[delegate-refused] reason: <which gate>` and run inline.

## Prerequisites (all required — else refuse)
1. The section comes from a `mece_plan.md` that is dated today and user-confirmed.
2. The section is self-contained: absolute paths for every input/output, no "the file we discussed".
3. The section has a runnable Verify-N (grep / test / build — not prose).
Missing any → `[delegate-refused]` + state which prerequisite failed.

## Workflow
1. **Eligibility gate** — check the three Prerequisites + the When-NOT list. Any fail → `[delegate-refused] reason: <gate>` → run the section in main context (this is a routing choice, not an error).
2. **Context-budget check** — estimate the section's footprint (bytes of files it must read/write ÷ 4 ≈ tokens). If it would pull in large/many files at once, split it into bounded per-file chunks before delegating, or keep it.
3. **Build the prompt** — feed the MECE section **verbatim** as the sub-agent prompt. It already has absolute paths + acceptance criteria. Add nothing from this chat.
4. **Spawn** — `Agent(prompt=<section>, model=<model_low from detected.md>)`, scoping tools to the minimum the section needs (e.g. Read/Edit for an edit task). Resolve `model_low` from `detected.md` — never hardcode `claude-haiku-4-5`.
5. **Self-verify (mandatory)** — run the section's Verify-N against the result yourself. Haiku is cheaper and less reliable; never accept its word.
6. **On failure** — Verify-N fails → **auto-retry once** with the same prompt → still fails → **escalate** to MODEL_MEDIUM (Sonnet) / main context per the R13 ladder + emit `[delegate-escalated] S<N> · reason: <verify failure>`. Never silently accept a failed delegate result.
7. **Report** — `[delegate-done] S<N> · model: haiku · verify: PASS` (or the escalation line).

## Hard Rules
- Self-verify is **always** mandatory — a delegated result is never trusted until its Verify-N passes in main context.
- Never delegate an R14/R15-gated path, even if mechanical.
- One retry, then escalate — no infinite retry loop on the cheap model.
- Resolve the model id from `detected.md model_low`; hardcoding a provider id = a portability bug.
- Watch for context-exhaustion symptoms (truncated edits, ignored later instructions, omitted files) → split smaller and retry, or keep it.

## Output Tone
Terse signals only — `[delegate-done]` / `[delegate-refused]` / `[delegate-escalated]`, each one line with S<N> + reason. No narration of the sub-agent's internal steps.

## Refusal Contract
Not eligible (gate / prerequisite / When-NOT match) → emit `[delegate-refused] reason: <gate>` and run the section in main context. Refusal is the safe default; never force a borderline section onto the cheap model.

## Routing
- Section list / plan source → read from `mece_plan.md` (Phase 3 sections).
- Model id → `detected.md model_low`. Routing rule → `Implement/03_config.md §R4` (MODEL_LOW @ low · delegated).
- Escalation → R13 ladder (CLAUDE.md) → MODEL_MEDIUM / main context.
- After all delegated sections → return to the orchestrator / `session_manager` close path.
