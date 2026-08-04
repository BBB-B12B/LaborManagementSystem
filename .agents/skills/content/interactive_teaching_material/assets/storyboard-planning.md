# Phase 0 — Plan & Storyboard (run BEFORE writing any code)

Goal: read the raw content, decide **where** an animation/interaction belongs, **which**
pattern fits, and lay out a reviewable **storyboard** — so the user approves the plan before
any code is built. Output = a filled storyboard table shown to the user for confirmation.

Patterns and quality minimums are defined once in **SKILL.md** (Pattern library + Richness
bar). This file does not restate them — it only adds the *content→plan* step on top.

**Input = the re-sequenced atom list from Phase 0a (Knowledge Re-architecture in SKILL.md),
not the raw source.** Storyboard rows follow *your* Zero→Hero order, never the source's order.

---

## Tool 0 — Chain of Thought (atom → Design Sheet; run BEFORE Tools 1–3)

Don't jump from an atom straight to "this screen = a morph." Reason each atom down a fixed
**6-step ladder** first — it derives the row instead of guessing it. Full rationale +
template: `project-context/05_DESIGN_PLAYBOOK.md` (★★ Phase 0b). Run per atom:

1. **State** — what does the learner already know/do right before this? Does this atom depend
   on anything not yet taught? If so, it's mis-ordered → move it earlier (0a prerequisite rule).
2. **One-new** — name the *single* new idea this beat adds. Two ideas? → split into two atoms (Rule 10).
3. **Misconception** — what does a beginner naively get wrong here, and why? → becomes the
   wrong-answer feedback + the predict-then-reveal question.
4. **Make-it-seen** — what unseen thing (process/change/relationship) must become visible?
   Write a **beat-sheet**: frame 1 shows ___ → 2 ___ → 3 ___ → end ___. This *is* the keyframe script.
5. **Make-them-act** — smallest action that *proves* understanding; pick the pattern and justify
   it against ≥2 alternatives (why this mechanic, not that one).
6. **Landed** — what can they now do that they couldn't? Does it unlock the next atom? → payoff
   + Learning-Map link.

**Output = one Atom Design Sheet per atom**, which fills a storyboard row directly: step 3 →
wrong-answer column, step 4 → pattern + animation timeline, step 5 → "what the learner does",
step 6 → payoff. So Tools 1–3 stop guessing — they lay out and validate what 0b already decided.

> Don't write the beat-sheet (step 4) before steps 1–3 are answered. An animation built before
> you know where the learner trips is decorative, not instructional (Rule 3).

---

## Tool 1 — Opportunity Scan (cross-check: signal → where to act)

Read the source content. Tag any sentence that fires a signal below; each fired signal is a
candidate screen. Pattern names point into the **Pattern library in SKILL.md** — don't
re-describe them here, just pick.

| Signal in the content | = Opportunity | Pattern (see SKILL.md) |
|---|---|---|
| "before/after", "turns into", "used to … now" | a transform | before→after morph |
| "first … then … finally", a pipeline/flow | a process | flowing-pipe |
| numbers, stats, ratios, %, counts | quantify | build-up chart |
| "good vs bad", "right vs wrong", two ways | contrast | comparison machine |
| a new technical term / acronym | analogy-first | click-reveal + `Real term:` badge |
| a filter, a condition, a gate/check | filtering | quality gate |
| "where does X go", placement, categories | placement | drop-to-correct-slot |
| assembling parts into a result, a recipe/summary | build | gated lab |
| a claim the learner could guess | engage | predict-then-reveal |

Rule of thumb: **every concept earns ≥1 tag.** No tag = you haven't found how to make the
learner *act* on it — look again; don't ship it read-only.

---

## Tool 2 — Storyboard table (one row = one screen)

Fill for the whole Unit, then show the user **before building**. Forces both pillars (act +
visual) up-front and exposes mechanic repetition (Rule 5) at a glance.

| # | Concept | Learner-world hook (their *actual* world) | What the learner *does* | Pattern | Wrong-answer feedback | Payoff |
|---|---|---|---|---|---|---|

Column rules:
- **Hook** = this audience's daily life (Rules 6 & 9). The project/domain case is a *bridge
  note*, never the first hook.
- **What the learner does** = a verb, never "reads". Can't fill it? → back to Tool 1.
- Scan that column top-to-bottom: a mechanic repeating within the Unit, or matching the
  previous Unit, must change (Rule 5).
- End with one line: **Unit closer** = which gated lab or quiz ends the Unit.

### Worked example — Unit 4b "System Analysis" (teen-first, bubble-tea bridge)

| # | Concept | Learner-world hook | What the learner *does* | Pattern | Wrong-answer feedback | Payoff |
|---|---|---|---|---|---|---|
| 1 | A system = Input → Process → Output | Ordering bubble tea: money + your choice go *in*, staff *make* it, a drink comes *out* | Flip 3 cards to **predict** what each stage is, before the label reveals | click-reveal flip cards (`Real term: System / IPO`) | card shakes + hint "what did you hand over to get the drink?" | "You just described how *any* system works" box |
| 2 | Splitting a real operation into I/P/O | Bridge: the bubble-tea **shop's** daily flow (now the workplace case, after the concept landed) | **Drag** 11 cards into 7 I/P/O slots, gated slot-by-slot; 4 are decoys that don't belong | gated lab (drop-to-correct-slot) | decoy bounces back + hint why it isn't an input/output | assembled IPO diagram lights up + confetti |

**Unit closer:** the gated drag lab in row 2 (`lab4b_sysana`) + a short quiz.

> Note how every concept is met in the teen's world *first* (ordering a drink), and the
> repair/shop "real workplace" case appears only as the **bridge** in row 2 — never as the
> opening explainer. Mechanics differ across rows (flip vs drag). This is the bar to match.

---

## Tool 3 — Density check (pacing guardrails; quality bar lives in SKILL.md)

Run against the filled storyboard before approval:

1. **No 2 read-only screens in a row** — insert an interaction between them.
2. **No mechanic repeated within a Unit**, and the Unit's set differs from the previous Unit.
3. **Every Unit ends with a gated lab or quiz** (not a plain summary slide).
4. **Every numeric claim** gets a build-up/count-up visual, not static text.
5. Storyboard clears the **Richness bar** in SKILL.md (don't restate it — open it and check).

If any check fails, fix the storyboard rows — do not proceed to build.

---

## Output of Phase 0

Show the user: (a) the filled Storyboard table, (b) the Unit-closer line, (c) a one-line
density-check result. Get explicit approval, then move to the Build & verify loop.
