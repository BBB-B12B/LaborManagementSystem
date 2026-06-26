# ascii_flow — Detail Reference

## sections[]
1. char-palette      — box-drawing + connector chars
2. box-templates     — outer / inner / decision / note patterns
3. detail-guidelines — what detail to include in each node
4. flow-connectors   — branch / merge / sequence patterns
5. doc-structure     — how to organize a full flow document
6. invoke-rule       — when other skills must call this one

---

## 1 · Char Palette

```
BOX DRAWING
  top-left: ┌   top-right: ┐   bottom-left: └   bottom-right: ┘
  horizontal: ─   vertical: │
  left-branch: ├   right-branch: ┤   top-branch: ┬   bottom-branch: ┴
  cross: ┼

FLOW ARROWS
  down:  ▼   right: →   left: ←   up: ▲
  branch-down: ↓   branch-right: ├─   last-branch: └─
  split-label: ├─── <label> ──────┐   (right branch floats)

ANNOTATIONS
  new / important: ★
  done: ✅   fail: ❌   pending: □
  reference tag: [FILENAME §section]
  inline note: ← <note text>
```

---

## 2 · Box Templates

### Outer process box (70 chars wide)
```
┌──────────────────────────────────────────────────────────────────────┐
│  BOX TITLE · [optional reference tag]                                │
│                                                                      │
│  Purpose: <1-line description of what this box accomplishes>         │
│                                                                      │
│  [step] Action                   ← why: <reason if non-obvious>     │
│  [step] Action                                                       │
│                                                                      │
│  Output: <what this box produces for the next stage>                 │
└──────────────────────────────────────────────────────────────────────┘
```

### Inner nested box (indent 2 spaces, 66 chars wide)
```
  ┌────────────────────────────────────────────────────────────────┐
  │  INNER TITLE                                                   │
  │  <detail lines — keep to ≤ 5 lines per inner box>             │
  └────────────────────────────────────────────────────────────────┘
```

### Decision box
```
┌──────────────────────────────────────────────────────────────────────┐
│  DECISION: <question or condition>                                   │
│  Criteria: <what determines each path>                               │
└──────────────────────────────────────────────────────────────────────┘
     │
     ├─── <condition A> ──────────────────────────────────────────────┐
     │    <action for A>                                               │
     │                                                                 │
     └─── <condition B>                                               │
          <action for B>  ◄──────────────────────────────────────────-┘
```

### Note / warning box
```
  ┌─ NOTE ────────────────────────────────────────────────────────┐
  │  <important constraint, caveat, or rule>                       │
  └───────────────────────────────────────────────────────────────┘
```

---

## 3 · Detail Guidelines

Every box must answer 3 questions. Use inline annotations, not separate paragraphs.

| Question | Where to put it | Format |
|----------|----------------|--------|
| **What** | Step label | `[step] Action verb + object` |
| **Why** | Inline after step | `← why: <reason>` or `← trigger: <condition>` |
| **Output** | Bottom of box | `Output: <what next stage receives>` |

Detail rules:
- Obvious steps (grep, read): no inline note needed
- Non-obvious steps (why this order, why this command): add `← why:`
- Decision criteria: always explain in the box header or `Criteria:` line
- Error / failure paths: label with `← on fail:` or branch to error box
- Cross-references: tag `[FILENAME §section]` at top of code block, not inline
- Max 8 lines inside any single outer box before splitting into sub-boxes

---

## 4 · Flow Connector Patterns

### Sequence (steps in order)
```
[Box A]
     │
     ▼
[Box B]
```

### Parallel (concurrent paths)
```
     │
     ├─── Path A ────────────────────────────────┐
     │    [action A]                              │
     │                                            │
     ├─── Path B ────────────────────────────────┤
     │    [action B]                              │
     │                                            │
     ▼    ◄──────── merge after all complete ─────┘
[Next Box]
```

### Loop with exit condition
```
┌─── LOOP ───────────────────────────────────────────────────────┐
│  [step] action                                                 │
│  [check] condition met?                                        │
│       ❌ not met → repeat (max N iterations)                   │
│       ✅ met     → exit loop ──────────────────────────────────┼──▶
└────────────────────────────────────────────────────────────────┘
```

### Error / blocked branch
```
     │
     ├─── success path ──────────────────────────────────▶ [Next]
     │
     └─── error / blocked ───────────────────────────────▶ [Error Handler]
          ← on fail: <what to report + who decides next>
```

---

## 5 · Doc Structure

A full flow document must follow this section order:

```
# <Title> — <Purpose>
> Date · Version · Session · Replaces (if updating existing)

---
## Layer Architecture        ← optional: shows file/system layers
## <Phase/Stage 1 name>      ← one ## section per major phase
## <Phase/Stage 2 name>
## <Phase/Stage 3 name>
## Quick Reference           ← summary table of all gate/trace signals
## Appendix / Changelog      ← version history, ★ items explained
```

Each `## Section` contains exactly one fenced code block with the diagram.
- First line inside code block: `[reference tag — source files for this section]`
- Blank line after reference tag before diagram starts
- Section heading outside the code block (not inside)

---

## 6 · Invoke Rule

**Any skill creating or editing a `.md` file that contains flow diagrams MUST use this skill.**

Trigger phrase in task: "create flow", "update flow", "draw diagram", "architecture doc", "flow doc", "add diagram to"

Invoke pattern:
```
[→ ascii_flow] Creating flow diagram in <file>
  Style: knowledge/harness_flow_20260525.md
  Sections planned: [list]
```

After diagram is written:
- Verify: `grep -c "┌" <file>` → matches expected box count
- Verify: no broken box chars (┌ without matching └ on same indent level)
- Reference file: add to `knowledge/session_index.md` if it's a knowledge doc
