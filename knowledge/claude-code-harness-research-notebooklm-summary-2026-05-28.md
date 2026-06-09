---
title: Claude Code Harness Research — NotebookLM Summary
topic: harness-design
tags: [claude-code, harness, requirements, verification, context-management, configuration]
source: NotebookLM synthesis — Claude Code docs, MCP docs, settings docs, Chrome integration docs, auto-mode docs, The Bitter Lesson
created: 2026-05-28
updated: 2026-05-28
status: active
type: reference
---

# Claude Code Harness Research — NotebookLM Summary (2026-05-28)

Synthesis of 13 research questions across 4 design axes: **requirement extraction**, **verification**, **context management**, and **configuration**. Key insight: separate Info Gather from Execute, enforce verification evidence at multiple surfaces, store hard constraints in hooks/policy layers rather than prompt prose.

---

## Source Coverage

**Sources ingested:**
- Claude Code best practices, common workflows, MCP docs, settings docs, Chrome integration docs, auto mode docs
- The Bitter Lesson

**Not yet ingested (answers marked N/A below):**
- Ara talk: "How we Claude Code"
- Tar post: "The unreasonable effectiveness of HTML files"

---

## Group A — Requirements Extraction

### Q1: Structured requirements interview pattern

**Finding:** Claude Code best practices recommends starting with a minimal prompt and letting Claude interview the user via `AskUserQuestion` for features. The interview covers technical implementation, UI/UX, edge cases, and tradeoffs.

**Harness recommendation:**

```text
Phase 1: Info Gather — do NOT implement.
Interview user to produce a self-contained spec with:
  - goal
  - files/interfaces involved
  - constraints
  - out of scope
  - acceptance criteria
  - end-to-end verification plan
Ask one high-value question at a time.
Stop when spec is complete enough to execute.
```

**Stop rule:**
```json
{
  "stop_when_all_present": [
    "problem statement",
    "constraints",
    "affected surfaces",
    "acceptance criteria",
    "verification plan"
  ],
  "max_clarification_rounds": 5
}
```

---

### Q2: Requirement → HTML spec workflow

**Finding:** Not in current sources. Docs support written spec only — `files/interfaces involved`, `out of scope`, `end-to-end verification`.

**Recommendation:** Use written spec schema as source of truth. Treat HTML as a render/presentation layer, not a logic contract, until sources confirm otherwise.

---

### Q3: Clarification stopping criterion

**Finding:** No fixed number in sources. Docs say "interview until spec is complete, then start a fresh session to execute."

**Recommendation:** Semantic completeness as primary stop condition; max rounds as backup guardrail (see Q1 config above).

---

## Group B — HTML Spec Pattern

### Q4: Minimum HTML spec structure

**Finding:** Not directly in sources, but Anthropic docs define a good spec as: requirements, affected files/interfaces, out of scope, verification.

**Recommended canonical schema:**
```html
<section id="goal"></section>
<section id="requirements"></section>
<section id="constraints"></section>
<section id="affected-files-interfaces"></section>
<section id="out-of-scope"></section>
<section id="acceptance-criteria"></section>
<section id="verification"></section>
```

---

### Q5: Real HTML spec examples from Anthropic

**Finding:** Not in current sources. No internal templates or community writeups ingested yet.

**Recommendation:** Build internal template now; version the schema explicitly. Do not wait for official templates.

---

### Q6: Task suitability for HTML spec

**Finding:** Sources emphasize Chrome integration, visual verification, screenshot comparison → HTML spec suits UI/interaction/visible-acceptance-criteria tasks. Backend/data pipeline tasks are better served by tests, linters, and bash verification.

**Recommendation:**
| Task Type | Spec Format |
|---|---|
| Frontend, user-flow, workflow-heavy | HTML spec |
| Backend-only, infra, data pipeline | Markdown or JSON spec |

---

## Group C — Agent-Native Verification

### Q7: DOM data-attribute verification pattern

**Finding:** Not in sources. Docs confirm Claude can verify UI via browser integration, read DOM state, read console output. No naming contract (e.g., `data-state="loaded"`) found.

**Recommendation — design your own convention:**
```html
<div data-verify="orders-table" data-state="loaded" data-row-count="25"></div>
```
Keep display state separate from verification state.

---

### Q8: Verification contract that fails if touched

**Finding:** Not in sources. Docs emphasize deterministic surfaces: tests, screenshots, expected outputs, linters, bash commands.

**Recommended contract schema:**
```json
{
  "component": "orders-table",
  "must_expose": {
    "data-state": "loaded",
    "data-empty": "false"
  }
}
```
Verifier must fail immediately if contract is not met — no soft warnings.

---

### Q9: Three verification surfaces

**Finding:** Sources support three surfaces:

| Surface | What it covers |
|---|---|
| Human evidence | Screenshot, visual diff, proof of result |
| Browser interaction | Claude in Chrome — open page, read DOM, read console, verify user flow |
| Headless / CI | Test suite, linter, bash command, non-interactive CI run |

Playwright is mentioned only in the context of macOS sandbox/XPC requirements, not as a first-class verification flow.

**Recommended config:**
```yaml
verification:
  human:
    require: [screenshot, diff-summary]
  browser:
    require: [dom-check, console-check, user-flow]
  headless:
    require: [tests, lints, cli-assertions]
```

---

## Group D — Claude Code Configuration

### Q10: effortLevel, fast mode, auto mode settings

**Key settings from docs:**
```json
{
  "effortLevel": "high",
  "fastModePerSessionOptIn": true,
  "autoMode": {
    "environment": ["github.com/your-org/*"],
    "allow": ["read and write within working repo"],
    "soft_deny": ["$defaults"],
    "hard_deny": ["Never force push"]
  }
}
```

**Critical notes:**
- `autoMode` is **not** read from shared `.claude/settings.json`
- Non-interactive `-p` runs will abort on repeated classifier blocks (no human fallback)
- `fastModePerSessionOptIn: true` means fast mode does not persist across sessions — must re-enable with `/fast` each time
- `effortLevel` persists but can be overridden per-session via flag or env

**Recommendation:** Inject `autoMode` policy via managed settings or invocation-level config, not shared project settings. Create separate presets for exploration vs. CI verification.

---

### Q11: Playwright MCP vs Claude Preview MCP

**Finding:** Not in current sources. Only Chrome integration and generic MCP docs were ingested.

**Recommendation:** Use Chrome integration as default browser verification path per current sources. Treat Playwright as an optional deterministic runner. Build an abstraction layer in the harness so verifier implementations can be swapped.

---

## Group E — The Bitter Lesson × Harness Design

### Q12: Applying The Bitter Lesson to harness design

**Core insight:** General methods + compute beats hand-crafted domain tricks long-term. Anthropic's supported pattern: give the model room to explore, plan, and execute — but constrain via context management, verification, hooks, and policy boundaries.

**What to keep as hard rules:**
- Safety boundaries
- Approval gates
- Deterministic enforcement
- Evidence requirements at verification surfaces

**What to remove or relax:**
- Detailed step-by-step reasoning mandates
- Brittle prompt choreography
- Too many task-specific heuristics

**Design split:**
```text
KEEP:
  - required output schema
  - verification gates
  - approval boundaries
  - context reset rules

REMOVE / RELAX:
  - micro-managed chain-of-thought
  - overly detailed reasoning paths
  - brittle per-task heuristics
```

**Recommendation:** Use subagent review or fresh-context adversarial verification instead of stacking prose constraints.

---

### Q13: Over-constrained prompts degrading performance

**Finding:** Practical evidence in Claude Code best practices — an overly long `CLAUDE.md` causes important rules to disappear in noise. Docs recommend pruning ruthlessly. Claude Code also notes that sometimes a broad or vague prompt is correct, meaning over-constraint has a real cost.

**Recommendation:**
- Use **minimum effective constraint**
- Constrain output contract over reasoning path
- If the model already does something well → remove the rule
- If behavior must be deterministic → move the constraint to a hook

---

## Immediate Harness Action Items

Priority-ordered actions from this research:

1. **Separate `Info Gather` from `Execute`** — different sessions or at minimum different context phases; gate with a state file
2. **Enforce spec completeness** — every spec must contain: scope + files/interfaces + out-of-scope + acceptance criteria + verification plan
3. **Implement 3 verification surfaces** — human evidence, browser verification, headless/CI checks; each surface has its own required evidence list
4. **Move hard constraints to hooks and policy** — not prompt prose; hooks enforce deterministically
5. **Reduce prompt over-constraint** — replace with evidence requirements; prune rules the model already follows
6. **Add fresh-context adversarial review** — use a subagent reviewer before closing high-stakes tasks

---

## Open Research Gaps

| Gap | Needed Source |
|---|---|
| HTML spec workflow step-by-step | Tar post: "Unreasonable effectiveness of HTML files" |
| DOM verification naming contract | Ara talk: "How we Claude Code" |
| Playwright MCP vs Preview MCP comparison | Claude Code preview integration docs |
| Real internal HTML spec templates | Internal Anthropic writeups or community repos |
