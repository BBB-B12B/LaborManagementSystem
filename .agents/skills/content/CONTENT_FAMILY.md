# Content Skill Family

> Shared conventions for the `content/` bucket skills.
> This file **explains** the shared pattern. **Enforcement stays INLINE** in each `SKILL.md` —
> a hard rule is never duplicated here as enforceable text (avoids the T-223 lost-enforcement-rung trap).
> This is the single source of the *explanation*, not a second copy of the *rule*.

## Members

| Skill | Input | Audience | Output | Scope rule | Handoff |
|---|---|---|---|---|---|
| `doc_builder` | web-app codebase + base_url + routes/roles | end-users / operators | role-based HTML manual + Playwright captures | writes OUTSIDE the target → `doc_output/<proj>/` | → `project_presenter` (primary) |
| `project_presenter` | web-app codebase + audience | buyers / stakeholders | 5-page sales HTML + storytelling `.md` | writes OUTSIDE the target → `present_output/<proj>/` | terminal (reads doc_builder output read-only) |
| `interactive_teaching_material` | ARBITRARY source + learner profile | learners / beginners | single-file animated HTML lesson | writes 1 HTML file | none (independent certified pipeline) |

## Shared patterns — what makes them a family

1. **Grounding gate** — every member grounds its output to a real source before building; ungrounded → refuse/halt. Each skill names its own gate signal *inline* (e.g. `[doc-builder-refused]`, `[presenter-refused]`, `[storyboard-wait]`).
2. **Scope discipline** — never write inside the source being documented.
   ⚠️ **Honest note:** this hard scope rule is shared by **2/3** only — `doc_builder` + `project_presenter` both write to an external output root. `interactive_teaching_material` does NOT share it: it writes 1 self-contained HTML file from arbitrary source. The skills are a family by *convention*, not by identical scope.
3. **Loop-guard bounds** — bounded gather/build loops, halt on blocker, never silent-loop.
4. **Storyboard-first craft** (evolving) — plan before building (which sections, where animation, how many frames). Proven inside `interactive_teaching_material`; other members may adopt the pattern by reference.

## Handoff convention (doc_builder → project_presenter)

One-directional only. `doc_builder` is **primary** (builds the manual) → `project_presenter` may read doc_builder's output **read-only** to reframe for buyers. Never the reverse. `project_presenter` is terminal.

## Independent member

`interactive_teaching_material` is a family **sibling by convention** — it shares the grounding-gate mindset and the storyboard-first craft, but keeps a **fully independent, certified pipeline** (T-276/T-277). Do **not** merge its workflow. When another member wants storyboard / animation / interactivity, it **references** these proven craft patterns — it does not modify the certified skill.

## Roadmap pointer

- **T-283** (planned): extend `doc_builder` with storyboard-first planning + click→result animation + interactive try-it widgets, adopting craft proven in `interactive_teaching_material` (referenced, not modified). When it lands, the "storyboard-first craft" pattern above graduates from *evolving* to a documented family standard.
