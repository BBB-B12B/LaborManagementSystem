# Ticket Intake — Detail

> Full intake mechanics. SKILL.md is the ≤80-line summary. Source spec: `knowledge/loop_engineer_spec.md` §6.1-6.3.
> This skill is the upstream PRODUCER; `loop_engineer` is the downstream CONSUMER of the blocks it writes.

---

## Why this skill exists (spec §6.3)
The Loop Engineer is headless — it cannot ask a human anything mid-run. So every ambiguity has to be
resolved BEFORE a task reaches the roadmap. A raw one-liner ("make the graph faster") has no definition of
done and no way to prove it — the loop would just open a PR asking a human to clarify, defeating the point.
Ticket Intake is the interactive step that front-loads all that clarity into a §6.2 block.

## The intake dialogue (Section 1 · Capture)
Hear the painpoint, then act as a thinking partner — NOT a form. Ask questions that help the user reach a
clear ending, especially when they can't yet say what "done" looks like. Don't interrogate for field values;
most painpoints already imply Title + Relate File, so the real work is helping the user ARTICULATE the Goal +
How-Check when the finish line is still fuzzy. The fields are the output of that dialogue, not its agenda.

Field-by-field, what "good" looks like:
- **Title** — short imperative ("Cache the backlink graph render"). Usually inferable from the painpoint.
- **ContextTask** — the background the headless loop needs to break the task into waves: what exists today,
  why it's a problem, roughly where the work lives. The loop has NO chat history, so this is the ONLY place
  the intent lives — mirrors §7.1 `ContextSubTask`, one level up. Draw it out from the painpoint story.
- **Goal** — the concrete acceptance STATE, not the activity. "loads from cache, cold render <500ms",
  NOT "make it faster". If the user gives a vague goal, ask "how will we know it's done?".
- **How-Check** — a runnable command/grep whose OUTPUT proves the Goal. This is the field users skip and
  the loop needs most. If no check exists yet, ask the user to name one (a grep, a script flag, a count).
- **Out-of-Scope** — optional but valuable: the explicit "do NOT touch" boundary. A headless run cannot ask
  "should I also change X?", so naming what's off-limits feeds the scope-creep guard (§4 guard #8).
- **depends_on** — any T-N that must be `[X]` first. Default `none`. Ask only if the painpoint clearly
  builds on other pending work.
- **Relate File** — paths likely touched. Optional; helps the loop's scope guard. Infer when obvious.

## Priority decision (Section 2 · rubric walk-through)
Walk the rubric top-down and stop at the first YES:
1. **Blocks another task OR breaks the system right now?** → **P0**. (e.g. a hook crashes every boot.)
2. **Real consequence if it slips past this week?** → **P1**. (e.g. slow every session; a known-wrong doc.)
3. **Otherwise** → **P2**. (nice-to-have, cosmetic, low cost to defer.)
Only the P-tag is set here — the loop tie-breaks equal tags by document position (top-most first), so a
task's urgency within a tier is expressed by WHERE a human later places it, not by this skill.

## Writing the block (append-only)
- Compute `T-<next>` = one above the current highest T-N (grep the roadmap; never reuse a number).
- Append the block at the END of the roadmap task list (the loop reads position, so append = lowest
  within-tier priority by default, which is the safe default for a new task).
- NEVER reorder or renumber existing tasks — that would silently change their loop priority.
- After writing, echo the finished block back to the user and confirm before considering it done.

## Edge cases
- **User gives no How-Check and none exists** → propose the simplest observable check (a file exists, a
  grep count, a script exit code) and confirm it with the user. A weak check is better than prose.
- **Painpoint is really several tasks** → split into multiple §6.2 blocks, each independently checkable;
  set `depends_on` between them if order matters.
- **Painpoint is a harness-rule change** (CLAUDE.md/AGENTS.md/a skill) → this is NOT loop work; hand off
  to `harness_editor` instead of writing a loop-eligible ticket.
- **Duplicate** → grep the roadmap for the same Title/intent before appending; if found, point the user at
  the existing T-N instead of creating a second.

## Handoff to loop_engineer
Once the block is on the roadmap with a valid Goal + How-Check, the Loop Engineer's preflight
(`scripts/loop_engineer_preflight.py`) will detect it as an eligible `[ ]` task and — subject to priority,
position, and `depends_on` — claim it on a future tick. No further action is needed from intake.
