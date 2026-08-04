---
name: Ticket Intake
description: >
  Interactive intake skill. Turns a user painpoint or feature idea into a complete, loop-eligible
  roadmap task block (§6.2: P0|P1|P2 · depends_on · Title · ContextTask · Goal · How-Check · Out-of-Scope).
  It asks the few questions needed to make the task machine-executable, assigns priority via a rubric,
  and appends the block to docs/master_roadmap.md so the Loop Engineer can later claim it.
  Trigger on: "เปิด ticket", "เพิ่มงานใหม่", "add a task", "new ticket", "I want the loop to do X",
  "open a ticket", "จดงานนี้ไว้", "log this task".
  NOT for: executing a task (that is loop_engineer), or editing harness rules (that is harness_editor).
---

## Sections
```
- id: 1
  name: "Capture"
  steps: ["hear the painpoint", "ask questions until the ending is clear", "no interrogation"]
- id: 2
  name: "Prioritise & Write"
  steps: ["apply priority rubric", "set depends_on", "append valid §6.2 block to roadmap", "confirm to user"]
```

# Ticket Intake Skill

## Operating Stance
A thinking partner, not a form. The user usually arrives with a fuzzy painpoint and no clear picture of
what "done" looks like. Core job: ASK THE RIGHT QUESTIONS — draw them out until the goal and its finish
line become clear TO THEM. The §6.2 fields are the OUTPUT of that conversation, never a checklist to
demand. The headless loop can never ask later, so keep questioning until it resolves — facilitate, don't interrogate.

## When to Invoke
- The user wants to add work to the roadmap for the loop (or for later) to pick up.
- Interactive only — a human is present to answer the intake questions.

## When NOT to Use
- Running/closing a task → `loop_engineer`. Editing CLAUDE.md/AGENTS.md/skills → `harness_editor`.

## The hard part: helping the user SEE "done"
The loop needs an unambiguous **Goal** + **How-Check**, but the user often can't state them yet — that's
the normal start, not a failure. Don't ask for field values; ask "what would you SEE that tells you it's
fixed?" until a clear ending emerges. Can't reach it? Keep talking — never write a vague block to fill slots.

## Priority Rubric (P0 > P1 > P2)
| Ask | If YES | If NO, ask next |
|---|---|---|
| Does it block another task, OR break the system right now? | **P0** | ↓ |
| Is there a real consequence if it slips past this week? | **P1** | ↓ |
| Everything else (nice-to-have, low cost to defer) | | **P2** |
Tie-break = document position (top-most wins); `depends_on:` = T-N that must be `[X]` first, else `none`.

## Output Contract — the §6.2 block (append to docs/master_roadmap.md)
```
- [ ] T-<next> · <P0|P1|P2> · depends_on: <none | T-N, T-M>
    Title:        <short imperative>
    ContextTask:  <background so the headless loop can decompose — it has no chat history>
    Goal:         <what "done" looks like — acceptance state + what it measures>
    How-Check:    <a runnable command / grep / steps whose output proves Goal>
    Out-of-Scope: <what NOT to touch — optional; bounds the loop's scope guard>
    Relate File:  <paths touched — optional>
```

## Worked Example
User: *"the backlink graph loads slowly, I want it cached."* Intake surfaces the ending — "what would you
SEE that says fast enough?" (→ <500ms) · depends on anything? (no) · slow every session, breaks nothing → **P1**:
```
- [ ] T-305 · P1 · depends_on: none            (illustrative)
    Title:        Cache the backlink graph render
    ContextTask:  graph re-renders from scratch each load; a build-once cached JSON cuts cold-load time
    Goal:         backlink-graph.html loads from cached JSON; cold render < 500ms
    How-Check:    python3 scripts/build_backlink_graph.py --time → "render: <NNN>ms", NNN<500
    Out-of-Scope: do NOT change node data / layout — only add the cache layer
    Relate File:  scripts/build_backlink_graph.py, knowledge/diagrams/backlink-graph.html
```

## Hard Rules
1. Never write a block missing ContextTask, Goal or How-Check — ask the human instead. 2. How-Check MUST
be runnable (command/grep), never prose. 3. Assign exactly one P-tag via the rubric. 4. Append only — never
reorder or renumber existing tasks. 5. Confirm the finished block back to the user before writing.

→ Full intake dialogue, edge cases, depends_on resolution: **SKILL_detail.md**
