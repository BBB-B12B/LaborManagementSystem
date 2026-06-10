---
title: "9arm-Skills Repo Scan and Skill Taxonomy"
tags: [skills, claude-code, harness, repo-analysis, taxonomy]
aliases: [9arm skills repo scan, 9arm skills taxonomy]
source: "GitHub repo scan of thananon/9arm-skills"
created: 2026-05-28
updated: 2026-05-28
status: active
type: reference
---

# 9arm-Skills Repo Scan and Skill Taxonomy

## Summary

The `thananon/9arm-skills` repo is a compact but highly precise set of Claude Code skills that emphasizes **behavioral workflow skills** over tool-heavy automation. Its key strength is designing skills around real work roles — debugger, reviewer, post-mortem writer, management translator — rather than around tools. The repo also features strong governance, a clear bucket structure, and explicit separation between production-ready, personal, draft, and deprecated skill states, making it a strong reference model for a harness-oriented skill library.

From an AI agent harness perspective, the repo stands out for treating each skill as a **phase discipline** or micro-harness for a specific stage of work (debug, review, closeout, audience adaptation) rather than as a command library or utility toolkit.

---

## Repo Layout

The repo uses a bucket structure:

| Bucket | Purpose |
|---|---|
| `skills/engineering/` | Daily code work |
| `skills/productivity/` | Non-code workflow skills |
| `skills/misc/` | Supplementary but non-core skills |
| `skills/personal/` | Skills tied to personal setup |
| `skills/in-progress/` | Draft skills not yet ready to ship |
| `skills/deprecated/` | Skills no longer in use |

Key governance files:

| File | Role |
|---|---|
| `README.md` | Summary of all shipped skills |
| `CLAUDE.md` | Rules for skill placement and bucket policy |
| `.claude-plugin/plugin.json` | Manifest of shippable skills |
| `scripts/link-skills.sh` | Symlinks skills into the Claude environment |
| `scripts/list-skills.sh` | Lists all `SKILL.md` files in the repo |

---

## Governance Patterns

- Skills in `engineering/`, `productivity/`, and `misc/` must have entries in both the top-level `README.md` and `.claude-plugin/plugin.json`.
- Skills in `personal/`, `in-progress/`, and `deprecated/` must not appear in the README or plugin manifest.
- Each bucket has its own README and must list every skill it contains.

This cleanly separates the **public/shippable surface** from the **private/draft surface** — a pattern directly applicable to harness skill management.

---

## Currently Shipped Skills

Four skills are shipped via `.claude-plugin/plugin.json`:

| Skill | Bucket | Role Category |
|---|---|---|
| `debug-mantra` | engineering | Investigation protocol |
| `post-mortem` | engineering | Closeout and learning capture |
| `scrutinize` | engineering | Skeptical review |
| `management-talk` | productivity | Audience translation |

---

## Skill Taxonomy by Role

### 1. `debug-mantra`

**Primary role:** Debugger / investigation protocol / anti-premature-fix guardrail

**Core sequence enforced:**

1. Reproducibility confirmation
2. Fail path tracing
3. Hypothesis falsification
4. Breadcrumb cross-reference

**Key design decisions:**

- Prohibits proposing a fix before a reliable reproduction exists
- Prohibits accepting a hypothesis before it passes falsification
- Requires maintaining an experiment ledger for all attempts

**Harness applicability:**

Excellent prototype for a `debug-mode` or `incident-mode` skill. Enforces reasoning discipline without requiring external tools. Suitable for any harness phase where premature conclusions are a risk.

---

### 2. `post-mortem`

**Primary role:** Engineering truth recorder / closure protocol / verification gate / learning artifact generator

**Prerequisite requirements (refuses if unmet):**

- Reliable reproduction
- Known root cause
- Identified fix
- Validated fix

**Required output sections:**

| Section | Content |
|---|---|
| Summary | One-paragraph overview |
| Symptom | What was observed |
| Root cause | Actual technical cause |
| Why it produced the symptom | Causal explanation |
| Fix | What changed |
| How it was found | Discovery path |
| Why it slipped through | Process gap |
| Validation | Proof the fix holds |
| Action items | Follow-ups and prevention |

**Harness applicability:**

Functions as a **completion gate**, not just a writing formatter. Ideal for the closeout phase and post-bug knowledge distillation.

---

### 3. `scrutinize`

**Primary role:** Outsider reviewer / skeptical critic / adversarial plan challenger / scope challenge layer

**Workflow:**

1. State the intent of the artifact in one sentence
2. Ask whether a simpler or smaller alternative exists
3. Trace the real code path end-to-end
4. Verify each claim against the actual path and tests
5. Report in structured finding format

**Finding format:**

```yaml
finding:
why_it_matters:
evidence:
suggested_change:
```

**Harness applicability:**

Review begins with **necessity and elegance**, not only correctness. Suitable for plan review, PR review, design review, and post-execution critique. Key pattern: block overbuilt solutions before they enter execution.

---

### 4. `management-talk`

**Primary role:** Audience adapter / communication translator / channel-aware summarizer / engineering-to-leadership bridge

**Key rules:**

| Action | Items |
|---|---|
| Keep | JIRA key, PR number, customer/workload names |
| Remove | Function names, file paths, SHAs, code-level identifiers |
| Transform goal | Make it leadership-consumable without misrepresenting facts |

**Supported output channels:**

- JIRA comment
- Slack post
- Async standup line
- Email
- Meeting talking points

**Harness applicability:**

Encodes **audience semantics** at a high level of detail. Suitable for multi-audience harnesses or automated status communication layers.

---

## Repo-Wide Design Lessons

### Role-First Skill Design

Skills are designed around cognitive roles and workflow roles, not tool names. This pattern is highly valuable for any harness that needs to orchestrate behavior rather than just invoke capabilities.

### Phase Discipline Through Skills

Each skill acts as a phase owner:

| Skill | Phase |
|---|---|
| `debug-mantra` | Investigation |
| `scrutinize` | Critique and review |
| `post-mortem` | Closeout and truth capture |
| `management-talk` | Audience adaptation |

The repo can be read as a set of **micro-harnesses** rather than a broad skill library.

### Low Tool Complexity, High Behavioral Precision

The repo has minimal external integration but achieves high behavioral precision. This demonstrates that many agent system problems are better solved with **protocol design and refusal criteria** than with additional tools.

---

## What Is Missing for a Fuller Harness

Compared to a complete AI agent harness architecture, the repo lacks:

- requirements interviewer
- MECE planner
- execution supervisor
- verify-N orchestrator
- context budget manager
- spec-to-artifact generator
- contract-based UI verifier

What exists is a strong quality core covering debug, review, closeout, and communication.

---

## Practical Takeaways

| Takeaway | Application |
|---|---|
| Use bucket structure | Separate stable, personal, draft, deprecated skills |
| Use plugin manifest as shipped-surface contract | Control what is publicly available |
| Design skills by role, not by tool | Improve behavioral clarity |
| Add refusal criteria when prerequisites are unmet | Prevent partial outputs from bad inputs |
| Use skills as phase gates | Each workflow phase has an owner |
| Encode audience transformation as a dedicated skill | Do not rely on general prompts to handle every audience |
