---
title: "Harness Reference — File Role Clarity"
tags: [harness, agent, file-roles, routing, continuity, policy]
aliases: [harness file responsibilities, agent harness file roles, role clarity for harness files]
source: "Derived from NotebookLM research synthesis and local workspace analysis on 2026-05-13"
created: 2026-05-13
updated: 2026-05-13
status: active
type: reference
---

# Harness Reference — File Role Clarity

## Summary

This document defines the responsibilities of each primary file in the agent harness so that every file has a clear boundary, no two files govern the same concern, and the agent can route, plan, remember, and execute with greater precision. The core principle: separate persona, policy, bootstrap, routing, continuity, and operations into distinct files with explicit precedence. When multiple files control the same behavior without a clear precedence order, the agent experiences behavioral drift.

The current workspace structure is sound — `AGENTS.md`, `IDENTITY.md`, `SOUL.md`, `brain/router.md`, `brain/skill-index.md`, `skill-manifest.json`, `brain/podcast.md`, `TOOLS.md`, and `README.md` each carry distinct roles. The recommended next steps are to make each file's role more explicit and to add dedicated coding agent harness files when code-heavy work begins.

---

## File Layer Architecture

### Layer 1 — Persona Layer

**Files:** `SOUL.md`, `USER.md`

**Responsibilities:**
- Define personality, tone, values, and trust posture
- Store long-lived user preferences

**Must not control:**
- Routing policy
- Execution order
- Tool discovery
- Detailed operational safety rules

---

### Layer 2 — Identity and Policy Layer

**Files:** `IDENTITY.md`

**Responsibilities:**
- Define the agent's primary role
- Set boundaries, red lines, and execution discipline
- Define global rules: verification gates, planning gates, read discipline, write discipline

**Must not control:**
- Directory listings
- Long architecture inventories
- Detailed repo maps

---

### Layer 3 — Bootstrap Layer

**Files:** `AGENTS.md`

**Responsibilities:**
- Define the session startup read order
- Specify the harness entry flow
- Point to where to start, how to detect topic type, and where to route next

**Must not control:**
- Domain-specific rules
- Long routing tables
- Full tool catalogs

---

### Layer 4 — Routing and Discovery Layer

**Files:** `brain/skill-index.md`, `brain/router.md`, `skill-manifest.json`

**Responsibilities per file:**

| File | Responsibility |
|---|---|
| `brain/skill-index.md` | Fast-match trigger lookup to preserve context budget |
| `brain/router.md` | Routing policy layer and learned route overrides |
| `skill-manifest.json` | Machine-readable discovery: triggers, context_files, verify_method, related_files |

**Must not control:**
- Persona
- Short-term working memory
- Broad system history

---

### Layer 5 — Continuity Layer

**Files:** `brain/podcast.md`

**Responsibilities:**
- Store active thread state
- Store recent loops, open loops, compacted history
- Enable the next session to resume context without loading long transcripts

**Must not control:**
- Long-term policy
- Stable architecture source of truth
- Tool manifests

---

### Layer 6 — Operations and Environment Layer

**Files:** `TOOLS.md`, `README.md`

**Responsibilities per file:**

| File | Responsibility |
|---|---|
| `TOOLS.md` | File paths, scripts, setup notes, local tools, native tool vs. spawn script distinction |
| `README.md` | System overview, architecture, cron, runtime notes, known bugs, debug flow |

**Must not control:**
- Persona
- Routing precedence
- Per-turn execution policy

---

## File Role Summary Table

| File | Primary Role | Must Not Carry |
|---|---|---|
| `AGENTS.md` | Startup order, entry flow, thread-switch entry policy | Long routing detail, full tool catalog |
| `IDENTITY.md` | Role, boundaries, global execution rules | Repo maps, long reference notes |
| `SOUL.md` | Personality, tone, values | Operational rules, routing logic |
| `USER.md` | Durable user preferences | Working memory, long dossiers |
| `brain/skill-index.md` | Fast trigger matching | Detailed policy reasoning |
| `brain/router.md` | Routing policy, learned routes, fallback logic | Broad knowledge dumps |
| `skill-manifest.json` | Machine-readable discovery and verification metadata | Human-narrative documentation |
| `brain/podcast.md` | Continuity and open loops | Durable policy |
| `TOOLS.md` | Local environment facts and script inventory | Decision policy |
| `README.md` | System documentation and architecture overview | Per-turn execution rules |

---

## On `CLAUDE.md` and Equivalent Files

`CLAUDE.md` is not required in every harness, but in coding agent work it typically serves as a **repo-local coding harness file** consolidating code-related rules in one place:

- Architecture summary
- File ownership hints
- Testing commands
- Patch discipline
- Refactor boundaries
- Dangerous areas to avoid
- Code review checklist

In the current workspace, these responsibilities are distributed across `AGENTS.md`, `IDENTITY.md`, `TOOLS.md`, and `README.md`. Adding a dedicated `CLAUDE.md` or `CODING_AGENT.md` will become valuable when code-heavy workflows are introduced.

---

## Recommended Precedence Order

When files conflict, apply this precedence:

| Priority | File / Source | Governs |
|---|---|---|
| 1 | System / developer runtime instructions | Absolute overrides |
| 2 | `IDENTITY.md` | Permanent workspace policy |
| 3 | `AGENTS.md` | Startup order |
| 4 | `brain/router.md` | Routing policy |
| 5 | `skill-manifest.json` | Context loading and verification metadata |
| 6 | `brain/podcast.md` | Thread-local continuity |
| 7 | `SOUL.md` and `USER.md` | Style and personalization |
| 8 | `README.md` and `TOOLS.md` | Environment facts |

**Note:** If `router.md` and `skill-manifest.json` conflict, `router.md` wins — the policy layer must not be overridden by the machine-readable discovery layer.

---

## Common Failure Modes When File Roles Are Unclear

| Failure Mode | Description |
|---|---|
| Policy drift | Same rule appears in multiple files, diverges over time |
| Routing table bloat | `router.md` grows into a knowledge dump instead of a policy file |
| Continuity pollution | `podcast.md` becomes durable memory and grows unmanageably |
| Environment facts mixed with policy | `TOOLS.md` or `README.md` starts containing execution policy |
| Persona file carrying operational constraints | Makes persona hard to update without breaking behavior |
| Coding rules scattered | Coding agent misses invariants because rules are spread across 4+ files |

---

## Signals That a File Is Carrying Too Much

- Changing one behavior consistently requires editing 3–4 files
- The agent begins responding inconsistently on the same task type
- The same route uses different context sets across sessions
- `podcast.md` contains policy that belongs in `IDENTITY.md`
- `README.md` is simultaneously an onboarding document and an execution policy

---

## Principles for Maintaining Role Clarity

| Principle | Separation to Enforce |
|---|---|
| Identity vs. startup | Separate "what the agent is" from "how the agent starts" |
| Selection vs. memory | Separate "how the agent chooses work" from "what the agent remembers" |
| Human-readable vs. machine-readable | Separate overview docs from metadata manifests |
| Durable policy vs. thread continuity | Separate stable rules from per-session state |
| Coding harness vs. general assistant | Separate when code work becomes complex enough to warrant it |

---

## Recommendations for This Workspace

| Action | Priority |
|---|---|
| Keep `AGENTS.md` short and deterministic as a bootstrap file | High |
| Maintain `IDENTITY.md` as the single source of truth for global policy | High |
| Do not expand `brain/router.md` into a directory or knowledge note | High |
| Preserve `skill-manifest.json` strictly for machine-readable discovery | Medium |
| Add dedicated coding harness files when implementing coding workflows | Medium |
