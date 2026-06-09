---
title: "9arm-Skills Patterns to Port into AI Agent Harness"
tags: [harness, skills, claude-code, role-design, workflow, adaptation]
aliases: [9arm skills comparative note, 9arm patterns for harness]
source: "Comparative analysis of thananon/9arm-skills against target AI agent harness goals"
created: 2026-05-28
updated: 2026-05-28
status: active
type: reference
---

# 9arm-Skills Patterns to Port into AI Agent Harness

## Summary

This document identifies which patterns from the `9arm-skills` repo should be ported into the AI agent harness under development — a harness designed to control planning, requirement gathering, verification, context discipline, and audience-aware output. The core value of this repo is not the number of skills or tool integrations, but its use of skills as **behavioral contracts** for each role and each phase of work.

Four pattern groups are ready to port with minimal adaptation: role-first skill design, phase-gated workflow, prerequisite-based refusal, and audience transformation as a first-class role. Three areas require adaptation rather than direct copy: protocol verbosity, trigger model, and artifact destination. The repo also lacks several roles the target harness needs: requirements interviewer, MECE planner, verifier orchestrator, context budget manager, and execution supervisor.

---

## Why This Repo Matters for Harness Design

`9arm-skills` demonstrates using skills as **micro-harnesses**, not merely reusable prompt snippets. Each skill carries its own trigger, refusal rules, operating stance, workflow order, output shape, and implicit quality bar. This aligns closely with the goals of an AI agent harness — defining how agents should behave in different phases, not just making the model respond better.

---

## Pattern 1 — Role-First Skill Design

### What the Repo Does Well

Skills are designed around roles, not task categories:

- `debugger`
- `skeptical reviewer`
- `post-mortem author`
- `management-facing translator`

Each skill is defined by its role and cognitive stance first, with workflow and output rules following.

### What to Port

Design a clear **role layer** instead of binding everything to a single generic coding agent. Minimum roles for the target harness:

| Role | Purpose |
|---|---|
| requirements interviewer | Clarify and scope user intent |
| MECE planner | Build exhaustive, non-overlapping plans |
| skeptical reviewer | Challenge plans before execution |
| verifier | Confirm outcomes with evidence |
| closeout writer | Capture learning after task completion |
| audience translator | Adapt output per recipient |
| debug investigator | Structured fault investigation |

### What Not to Copy Directly

- Do not bind roles to Claude Code trigger syntax exclusively.
- Do not create role names without refusal logic or output contracts — they become decoration.

---

## Pattern 2 — Skills as Phase Gates

### What the Repo Does Well

Each skill acts as a phase owner:

| Skill | Phase Owned |
|---|---|
| `debug-mantra` | Investigation |
| `scrutinize` | Critical review |
| `post-mortem` | Closeout and learning capture |
| `management-talk` | Delivery adaptation |

Workflow is not free-flowing — each checkpoint defines which phase the agent is in and which standard applies.

### What to Port

Map the target harness as a **phase-based architecture**:

```text
Phase 1: Info Gather            → requirements-interviewer
Phase 2: Spec Consolidation     → spec-consolidator
Phase 3: MECE Planning          → mece-planner
Phase 4: Plan Scrutiny          → skeptical-reviewer
Phase 5: Execution              → executor
Phase 6: Verify-N               → verifier-orchestrator
Phase 7: Closeout               → closeout-writer
Phase 8: Audience Adaptation    → audience-translator
```

Each phase should have a distinct owner skill or role — not a generic agent improvising across all phases.

---

## Pattern 3 — Prerequisite-Based Refusal

### What the Repo Does Well

`post-mortem` is a strong example of the refusal pattern: the skill does not attempt a partial result if prerequisites are unmet. It stops and clearly states what is missing. `debug-mantra` shows similar behavior — if there is no reproducible case, stop hypothesizing and request artifacts instead.

### What to Port

Every critical phase in the harness should have its own **refusal criteria** and stop conditions:

```yaml
phase_guards:
  plan:
    require: [goal, scope, constraints, acceptance_criteria]
  verify:
    require: [evidence, pass_fail_signal, checked_surfaces]
  closeout:
    require: [validated_fix, known_root_cause]
```

Examples by phase:

- **Planner**: must not close without acceptance criteria
- **Verifier**: must not pass without evidence
- **Closeout writer**: must not state root cause if it is still a hypothesis
- **Audience translator**: must not invent owner, severity, or status

---

## Pattern 4 — Behavioral Precision Without Tool Sprawl

### What the Repo Does Well

The repo has minimal heavy tool integration, yet each skill achieves high behavioral precision. This is a reminder that a good harness is not built purely by adding tools — protocol design and output discipline matter equally.

### What to Port

Before building a new tool or MCP integration, ask:

> Can this problem be solved with a role contract or phase protocol instead?

Many harness concerns — verification checklists, planning discipline, audience adaptation — should be defined as **skill contracts first**, then supplemented with tools only when necessary.

---

## Pattern 5 — Audience Adaptation as a First-Class Role

### What the Repo Does Well

`management-talk` shows that translating content across audiences is not style transfer — it is **semantic filtering plus channel shaping**. The skill explicitly defines what to keep, what to cut, what to translate, and how each channel requires a different output shape.

### What to Port

The target harness should have distinct output roles:

| Output Role | Purpose |
|---|---|
| engineering truth | Full technical accuracy |
| reviewer feedback | Structured findings with evidence |
| management summary | Status, impact, owner, next step |
| ticket update | Issue key, fix state, validation |
| standup line | Single-sentence status |
| implementation note | Compact decision record |

Example output-role matrix:

```yaml
audiences:
  engineer:
    keep: [code identifiers, file paths, exact mechanism]
  manager:
    keep: [status, impact, owner, next_step]
    remove: [function_names, shas, low_level_structs]
  ticket:
    keep: [issue_key, fix_state, validation]
```

---

## Pattern 6 — Skeptical Review Before Correctness Review

### What the Repo Does Well

`scrutinize` captures a key insight: before asking whether the implementation is correct, ask whether it **should exist** in this form, and whether a smaller, more elegant alternative exists. This reduces wasted execution and overbuilt solutions.

### What to Port

Add a **pre-execution critic** or plan-skeptic phase before execution. This phase should ask at minimum:

- Is the objective clear?
- Is there a simpler alternative?
- Is this solving the wrong layer?
- Is the scope larger than necessary?
- Will the verification actually prove success?

---

## Pattern 7 — Closure Artifact as Learning Memory

### What the Repo Does Well

`post-mortem` shows that a closure artifact is not a short summary — it is a **canonical record** that future sessions can reference. This fits well with a harness that accumulates learning and uses structured memory.

### What to Port

After every significant task or bug fix, produce a closeout artifact with at minimum:

- What happened
- What the real cause was
- What fixed it
- How it was validated
- What should change in process or tests

This enables both memory distillation and continuous improvement.

---

## What to Copy Almost Directly

| Item | Notes |
|---|---|
| Bucket lifecycle model (stable, personal, in-progress, deprecated) | Apply directly to skill organization |
| Shipped-surface manifest model | Use for harness skill discovery |
| Prerequisite-based refusal | Apply to every critical phase |
| Phase-owner skill mindset | Core architecture pattern |
| Audience-aware output shaping | Implement as dedicated translator role |
| Requirement that every finding has rationale and evidence | Apply to reviewer and verifier roles |

---

## What to Adapt Rather Than Copy

| Item | Original Behavior | Target Harness Adaptation |
|---|---|---|
| Trigger model | Based on Claude Code invocation pattern | Add phase state and task metadata as triggers |
| Protocol verbosity | Some skills are very long and strict | Create compact execution forms to preserve context budget |
| Environment assumptions | Assumes Claude Code as primary runtime | Abstract to support multiple agents and runtimes |
| Artifact destination | Some skills assume JIRA, Slack, email | Support sheets, internal DB, webhook, summary memory |

---

## What Is Still Missing for the Target Harness

Roles and patterns not present in `9arm-skills` that the target harness still needs:

- requirements interviewer
- spec writer / HTML spec generator
- MECE plan builder
- verify-N orchestrator
- context budget manager
- execution supervisor
- tool or MCP policy selector
- contract-based UI verifier

---

## Recommended Port Plan

Ordered by return on investment:

1. Build `skeptical-reviewer` based on `scrutinize`
2. Build `closeout-writer` or `post-mortem-lite`
3. Build `audience-translation` layer for multiple output types
4. Use `debug-mantra` as prototype for `debug-mode`
5. Add phases absent from 9arm-skills: requirements, planning, verification orchestration, context management

---

## Suggested Harness Architecture (Inspired by 9arm-skills)

```text
User Request
  → Intent / Phase Router
  → Requirements Interviewer
  → Spec Consolidator
  → MECE Planner
  → Skeptical Reviewer
  → Executor
  → Verify-N Orchestrator
  → Closeout Writer
  → Audience Translator
```

---

## Bottom Line

The most valuable thing in `9arm-skills` is not the content of each individual skill — it is the **worldview** that a skill should serve as the operational contract of a specific role within a workflow. Porting this worldview into the target harness will produce greater sharpness, explainability, and maintainability than adding long prompts or scattered new tools.
