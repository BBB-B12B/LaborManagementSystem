# Craft reference — Richness bar · Pattern library · Mobile recipe

Load this when building a lesson. SKILL.md keeps only pointers to these three; the full detail
lives here. (Process/gates stay in SKILL.md; this file is the "how" reference.)

---

## Richness bar (the floor — a lesson below this is NOT done)

The earlier soft bar ("≥1 animation, an interactive visual") let thin lessons pass. These are
hard minimums **per Unit**, calibrated to the project's own best work. Hit every one:

| Ingredient | Minimum per Unit | Why |
|---|---|---|
| Distinct CSS `@keyframes` | **≥3**, each doing a *different* thing (e.g. drop-in, shake-on-wrong, celebrate) — never one fade reused | one reused fade reads as flat/dead |
| Core visual asset | **≥1** inline SVG **or** build-up chart whose parts **animate in** as the learner acts | the visual must *be* the concept, and grow |
| Distinct interaction mechanics | **≥2** across the Unit, and **different from the previous Unit** | variety = engagement; repetition = boredom |
| Staged / gated build | **≥1** lab with progressive unlock (slot 1 → slot 2 → … → assembled result) | this is what makes it a "lab" not a form |
| Wrong-answer feedback | shake/bounce + a **specific hint**, not just a color swap | hints teach; color swaps don't |
| Completion payoff | a **celebration animation** (shimmer / pop / confetti / launch) + payoff box | rewards effort, signals progress |
| Live progress signal | counter, growing bar, or stepper that updates **as they act** | "Progress Visibility" pillar |

> **Calibration rule (do this before claiming done):** open the **richest existing lesson in
> the same file** (grep its keyframes, JS handlers, SVG). Count its animations and mechanics.
> Your new lesson must be **in the same league** — comparable keyframe count, comparable
> mechanic sophistication, comparable code depth. If the new lab is a fraction of the size
> (e.g. ~100 lines vs an existing ~400-line lab), it is under-built — go back and add a real
> mechanic. Never let a new Unit regress below the standard already set.

---

## Pattern library (pick to fit; rotate across lessons)

| Goal | Pattern |
|---|---|
| Reveal detail | **Click-reveal cards** → `pick(i,el)` injects a fading detail panel |
| Show a flow/process | **Flowing-pipe** → emojis animate `left:-7%→106%` behind cards (`z-index` layered) |
| Show a transform | **Before→after morph** → two states cross-fade on a timer + spinning gear |
| Show filtering | **Quality gate** → good items pass, bad ones bounce out |
| Show placement | **Drop-to-correct-slot** → item lands in the right shelf |
| Contrast two ways | **Comparison machine** → bad vs good, both animated, side by side |
| Engage (Pillar 1) | **Predict-then-reveal** · **drag-to-build/match** · **scenario toggle** · **mini-quiz** |
| Quantify (Pillar 2) | **Build-up chart** (bars grow/count up) · **annotated diagram** · **before/after counts** · **progress stepper** |

Keep keyframes short; stagger with `animation-delay`; honor `prefers-reduced-motion` when feasible.

---

## Mobile recipe (proven)

- Sidebar → off-canvas drawer: `transform:translateX(-100%)` default;
  `.sidebar.mobile-open{transform:none}`; fixed top bar with a hamburger + a backdrop that
  closes on tap. Auto-close the drawer on nav tap via `matchMedia('(max-width:768px)')`.
- `.main{margin-left:0; padding-top:<bar>}` on mobile.
- Shrink interactive rows in `@media(max-width:600px)` (smaller gaps/fonts/heights) so a
  single-row metaphor survives instead of wrapping.
- Floating panels: `left/right:10px`, not fixed widths.
