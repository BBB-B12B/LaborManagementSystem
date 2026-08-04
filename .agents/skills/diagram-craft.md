# Diagram Craft — shared layout rules for any saved diagram

> Single home for diagram-layout craft. Referenced by `ascii_flow` and `flow_summarizer`.
> Do NOT copy these rules into a skill — point here (single-source-of-truth).
> Applies when producing a diagram a PERSON opens to understand (SVG per T-284, or ASCII).

## 1 · Detail at the real grain (CoT)
Break the subject into its ACTUAL step-by-step links — the chain of reasoning the
system really follows. One box = one real step. Never collapse a multi-step stage
into a single lump ("Build", "Process"). If a step has sub-steps, show them.
Ground every box in a real source first (flow_summarizer traces line-by-line).

## 2 · Shared step = ONE shared block   (multi-lane / comparison diagrams)
When two or more lanes (skills, roles, services) do the SAME step, draw it ONCE as a
single block spanning the lanes that share it — a long bar across those columns —
NOT repeated as separate boxes. A step done DIFFERENTLY per lane stays its own box on
that same row. This is what makes "shared vs unique" readable at a glance.

## 3 · Align by stage (levels)
Put the same work-stage on the same horizontal level across every lane, so the reader
can go DOWN one lane (one workflow end-to-end) or ACROSS one row (how each lane does
that stage). Order rows by real run order. A loop is a return arrow on the step that
loops — never a final bottom bar.

## When NOT to apply rules 2 & 3
A single-process diagram (one lane) has nothing to share or align across — use only
rule 1. Rules 2–3 are for MULTI-LANE comparison diagrams (e.g. a skill-family map).

> Worked example of all 3: `knowledge/diagrams/content-family-flow.svg` (stage rows ×
> 3 skill lanes; Grounding = long bar shared 3/3; Write-outside = long bar shared 2/3).
