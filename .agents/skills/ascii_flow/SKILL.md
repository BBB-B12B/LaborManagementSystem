---
name: ascii_flow
description: >
  Produces ASCII flow diagrams and architecture charts using a strict char palette and box/connector templates.
  Trigger on: "create ascii diagram", "draw flow diagram", "add architecture chart", "update harness_flow",
  "diagram this flow", "วาด flow", "ทำ ascii diagram", "สร้าง flow doc".
triggers:
  - "draw ascii diagram"
  - "ascii flow chart"
  - "make a flow diagram"
  - "visualize this as ascii"
  - "วาด ascii"
  - "แผนภาพ ascii"
  - "flow chart ascii"
  - "create ascii diagram"
  - "add architecture chart"
---

## Sections
```
- id: 1
  name: "Diagram Production"
  steps: ["verify invoke pattern", "select chars §1", "build boxes §2", "apply detail §3", "connect §4", "verify box count"]
```

# ascii_flow Skill

## When to Invoke
Use ascii_flow when the task explicitly requires producing or updating a box/connector diagram in a `.md` file:
- User asks to "draw", "create", "visualize", or "diagram" a flow or architecture
- A calling skill includes `[→ ascii_flow]` in its section plan
- Updating an existing harness flow doc (e.g., `knowledge/harness_flow_*.md`)
- Adding an architecture chart to any project documentation file

## Trigger
Activated when creating or updating:
- ASCII flow diagrams / architecture charts in any `.md` file
- Flow reference docs (e.g., `knowledge/harness_flow_*.md`)
- Any `.md` file that will contain a box/connector diagram

Reference style: `knowledge/harness_flow_20260525.md`

## When NOT to Use
- Diagram complexity requires Mermaid, SVG, or graphviz (e.g., multi-level nested subgraphs not renderable in ASCII)
- Diagram has >20 nodes — split into sub-diagrams first, then invoke per sub-diagram
- Stakeholder output needs publication-quality rendering (PDF export, slide deck, or print media)
- Task is real-time data visualization or dynamic chart generation — use a charting library instead

## Refusal Contract
Skip entirely (emit `[ascii-skip]`) if:
- No diagram or flow doc is required in this task → return to calling skill, no action
- Task is purely code/config — no architectural documentation needed → delegate to `coder` or `editor`
- Calling skill does not include `[→ ascii_flow]` invoke pattern → emit `[ascii-skip] reason:no-invoke-pattern` · notify calling skill to add invoke pattern first

## Operating Stance
- Char-strict by default. Every diagram uses only §1 Char Palette — no Unicode outside the palette, no decorative box-drawing substitutes, no platform-specific symbols.
- Diagram-only scope. ascii_flow produces diagrams and flow docs. It does not modify code, config, or prose text — only .md files containing box/connector diagrams.
- Minimal node discipline. Add nodes only for entities that appear in the flow. Do not invent intermediate nodes to "fill out" the diagram — every box must correspond to a real component or decision.
- Reference before inventing. Check knowledge/harness_flow_*.md for existing diagram conventions before establishing new ones — consistency across docs matters more than local elegance.

## Prerequisites
**Refuse (emit `[ascii-skip]`) without all of these:**
- [ ] Target .md file path confirmed — the file that will contain the diagram
      → Why: diagram production requires knowing output context (line length, existing content)
      → Missing: emit `[ascii-skip] reason:no-target-file`
- [ ] Calling skill includes `[→ ascii_flow]` invoke pattern
      → Why: ascii_flow is a sub-skill, not a standalone initiator — prevents accidental invocation
      → Missing: emit `[ascii-skip] reason:no-invoke-pattern`
- [ ] Diagram intent described (box list OR flow description OR reference diagram named)
      → Why: cannot build correct nodes/connectors without knowing what the diagram represents
      → Missing: ask calling skill to provide diagram intent before proceeding

## Workflow
Sequential: verify `[→ ascii_flow]` invoke pattern → select chars from §1 Char Palette → build boxes from §2 templates → apply §3 detail level → connect with §4 flow connectors → structure per §5 doc format → emit `[ascii-done]`.
Stop condition: if §1 Char Palette not found in SKILL_detail.md → emit `[ascii-skip] reason:palette-missing` · do not improvise characters.
Full char palette, templates, guidelines, connectors, doc structure: `@.agents/skills/ascii_flow/SKILL_detail.md`

## Output Contract
Every diagram produced must use:
- Chars exclusively from §1 Char Palette (no Unicode outside palette)
- Box structure from §2 box-templates
- Node detail level from §3 detail-guidelines
- Connector patterns from §4 flow-connectors
- Emit `[ascii-done] <title> · lines: <N>` on completion

**Behavior Contract — Invoke-Gate (fires on any skill creating/editing a .md with box diagrams):**
```
Pre:    Edit/Write tool completed on a .md file · output contains box-drawing chars (┌ │ └ ─ ┐ ┘)
Contract: calling skill MUST invoke ascii_flow before marking section done
          missing invoke → [violation] BC-ascii-invoke → call ascii_flow now · wait for [ascii-done]
Post:   [ascii-done] emitted · box-count verified · section may proceed
Enforce: section marked done without [ascii-done] on .md with boxes = [violation] BC-ascii-invoke → invoke now
```

**Behavior Contract — Ascii-Return (fires at ascii_flow section completion):**
```
Pre:    diagram written and box-count verified
Contract: MUST emit [ascii-done] diagram: <file> · boxes: <N> before returning
          skip emit → [violation] BC-ascii-return → verify box count → emit [ascii-done] → return
Post:   [ascii-done] emitted · return to calling skill
Enforce: return without [ascii-done] = [violation] BC-ascii-return → emit now
```

## Routing
→ After diagram written and verified:
- Emit `[ascii-done] diagram: <file> · boxes: <N>`
- Return to calling skill (coder / editor / mece) — do not initiate further actions

## Output Tone
Keep:   `[ascii-done]` signal + box count + target file path · char palette source cited
Strip:  internal deliberation ("I'll draw this as...") · apologies for diagram complexity · hedging about char support
Format: emit `[ascii-done] diagram: <file> · boxes: <N>` — signal first, no preamble
Prohibited: "Here's a rough sketch..." · "This may not render perfectly..." · "I approximated the chars because..."

## Hard Rules
- Never use a character outside §1 Char Palette — if the right char is absent, extend the palette, do not substitute.
- Never produce a diagram without a confirmed target .md file — writing to the wrong file corrupts existing content.
- Never invent nodes: every box must map to a named entity in the calling skill's intent description.
- Never skip `[ascii-done]` emit — calling skills gate on this signal; silent completion breaks the pipeline.
- Never modify prose, code, or config sections of the target file — ascii_flow touches diagram regions only.
- Never start diagram construction without §1 Char Palette loaded from SKILL_detail.md — improvised chars = palette violation.
- Never produce more than one diagram per invoke without explicit calling-skill approval — scope creep risk.
- Quality heuristic: if the diagram requires >20 nodes to be readable, the flow is too complex for a single diagram — split into sub-diagrams and flag to the calling skill before proceeding.

## MECE Constraints Block (copy into mece_plan.md for sections using `ascii_flow`)
```
- Only trigger when section creates/updates a .md file with a flow diagram
- Chars must be from §1 Char Palette only — no Unicode outside palette
- [ascii-done] emit required after diagram written and box-count verified
- Verify: grep -c "┌" <file> → matches expected box count
- Return to calling skill immediately after [ascii-done] — do not initiate further actions
```

## Context Gate
If during this task a new hard constraint was discovered → add to INVARIANTS.md §I2 before closing task

## Tone Guide
Keep:      diagram labels · node IDs · `[ascii-done]` signal · box count
Strip:     "Here is your diagram..." preamble · "I'll now draw..." narration · apology for ASCII limitations
Format:    output inside a fenced code block containing the ASCII art — signal first, diagram second
Prohibited: prose description replacing the diagram · "This approximates..." hedging · inline explanation of box meaning outside the diagram

@.agents/skills/ascii_flow/SKILL_detail.md
