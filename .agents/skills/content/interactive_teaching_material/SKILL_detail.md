# Interactive Teaching Material — Detail (craft reference for SKILL.md)

> Extended craft guidance. `SKILL.md` is the lean driver (9arm format); this file holds the full
> rules, planning ladder, build-verify loop, anti-patterns, and Definition of Done it points to.
> Load this before building and again before claiming done.

You are making **teaching material, not a book**. Audience: a curious beginner (can use a
spreadsheet, no programming, limited English). Make it fun, hands-on, step-by-step. Every
screen must lower the barrier.

**Know who you're teaching, and translate into their world.** Before writing, pin down the
learner's age and daily life, and make *every first example* come from it. For **high-school /
teen** learners that world is: phone apps, games, social media, group chats, school, canteen,
allowance, sports, music playlists, fandoms — **not** workplaces, machinery, banking, ERP, or
industrial operations. A concept explained only in adult/professional terms (machine downtime,
SLA, procurement, credit scoring) has **not** been taught to a teenager — it's been talked over
their head. See Rules 6 & 9.

## Rules (non-negotiable) — full text

1. **Analogy before term.** Sequence: plain idea → relatable analogy → *then* the technical
   term as a small badge (`Real term: <X>`). The concept must land even if the term is skipped.
2. **No jargon-dump / no single-line cramming.** Break ≥3 concepts into bullets, a table, or an
   interactive reveal. Rewrite machine-speak ("partition the watermark field") for a human
   ("know when the data was last updated").
3. **Animation teaches, never decorates.** Each one demonstrates a concept; if it doesn't make
   an idea clearer, cut it.
4. **Animation never covers text.** Layer with z-index — motion behind (`z-index:1`), opaque
   readable cards in front (`z-index:2`). Verify nothing is occluded mid-animation.
5. **Vary the mechanic per lesson.** Never reuse one interaction everywhere.
6. **Anchor in the learner's *actual* world — not just any real-world case.** "Relatable"
   is measured against *this* audience. For teens, lead with their daily life (a group chat,
   a game's stats, who can see your IG story, organizing your phone, planning a birthday
   party). A professional/industrial domain — a repair-ticket system, ERP, a bank's loan
   engine — is **not** a teen's world; it may appear only as a *second-step transfer* (Rule 9),
   never as the thing that first explains a concept. Never lead with domain jargon (downtime,
   MTTR, SLA, vendor, procurement). And never `foo/bar` or unexplained data.
7. **Mobile-responsive by default.** Works at ~375px: drawer nav, no horizontal overflow,
   fluid rows, readable fonts.
8. **Build, don't reveal.** A lab makes the learner *construct* something through **gated,
   staged progression** — step N stays locked until step N−1 is correct, and finishing
   *assembles a result* (a thing builds, fills, sorts, launches). A flat form where every
   field is editable at once, or a button that just animates some numbers, is **not a lab** —
   it's a slideshow. The learner must feel they *made* something.
9. **Concept in their world first; the domain case is the bridge, not the entry.** Teaching
   order for *every* concept: **(1)** make it land with a learner-world example/analogy →
   **(2) then** bridge — "the same idea at a real workplace looks like this" — using the
   course's project/domain case. The learner's *first* encounter with a concept must never be
   the professional case in its native vocabulary. If the course's running case is professional
   (e.g. a maintenance/repair system), treat it as the **destination** ("now you can read a
   real company's data problem"), reached *after* understanding — not the **teacher**. One
   reliable shape: *teen example → "Real term" badge → one line: "businesses do the exact same
   thing — here's [project case]."*
10. **Assume zero prior knowledge — then groom upward.** The learner does *not* know what you
    know; never skip a step because it feels obvious to you (the expert's blind spot / curse of
    knowledge). Feed understanding **one small piece at a time**, each beat building on the last:
    define a thing before you use it, show **one new idea per beat**, never introduce two new
    concepts at once. Crucially — **detail and fun are not a trade-off.** You still deliver the
    *full* detail; you just change the *vehicle*: every new piece of knowledge enters through
    something the learner **watches move (animation)** or **does (interaction)** — never through a
    dense static block they must just read. When a point needs more depth, add **another
    interactive beat or an animated reveal**, not a denser paragraph. Make the unseen seen: the
    fastest way to "get it" is an animation of the thing happening.

## Richness bar (the floor — a lesson below this is NOT done)

Every Unit must clear hard per-Unit minimums **and** match the richest existing lesson in the
same file (calibration rule). **Full table of minimums + calibration rule:
`assets/craft-reference.md`** — load it before building and again before claiming done.

## Phase 0a — Knowledge Re-architecture (do this BEFORE Phase 0)

**Never follow the source's ordering** — a deck/textbook is sequenced for content-completeness,
not for a true beginner. Treat the source as **raw material + a completeness checklist**; the
*sequence* is yours. Three moves: **Explode** (break into atomic concepts/terms/rules/examples,
drop the original order) → **Re-group** (cluster by *learning prerequisite*, not the source's
chapters) → **Re-sequence Zero→Hero** (each step builds on the last; narrative/causal flow over
table-of-contents order). **Prerequisite rule:** no beat may depend on something not yet taught —
if it does, move it earlier. Merge/split topics freely; **change the sequence, never cut content** —
every source atom must still land somewhere.

The re-sequenced atom list is the **input to Phase 0b**: storyboard rows follow *your* order,
not the source's. Full rationale + worked example: `project-context/05_DESIGN_PLAYBOOK.md`
(★ top section).

## Phase 0b — Chain of Thought (atom → design; do this BETWEEN 0a and Phase 0)

Don't jump from a re-sequenced atom to "this screen = a morph." Reason each atom down a fixed
**6-step ladder** first — it *derives* the storyboard row instead of guessing from a keyword:
**(1) State** what's already known (flag any unmet prerequisite → move it earlier) → **(2) One-new**
the single new idea (two? split the atom) → **(3) Misconception** what a beginner gets wrong → this
*becomes* the wrong-answer feedback → **(4) Make-it-seen** the unseen process, written as a
frame-by-frame **beat-sheet** (= the keyframe script) → **(5) Make-them-act** the smallest proving
action + pattern justified vs ≥2 alternatives → **(6) Landed** what they can now do + does it unlock
the next atom. Output = one **Atom Design Sheet** per atom that fills a storyboard row directly.
Never write the beat-sheet (4) before answering 1–3 — an animation built before you know where the
learner trips is decoration, not teaching (Rule 3). Full method: `assets/storyboard-planning.md`
(Tool 0) + `project-context/05_DESIGN_PLAYBOOK.md` (★★ Phase 0b).

## Phase 0 — Plan & Storyboard (do this after Phase 0b, before any code)

Before building, read the raw content and decide **where** animation/interaction belongs,
**which** pattern fits, and lay out a **storyboard** for the user to approve. The full method
lives in **`assets/storyboard-planning.md`** — load it and apply its tools on the Atom Design
Sheets from Phase 0b: **Opportunity Scan** (cross-check each atom earns ≥1 act-signal) →
**Storyboard table** (one row/screen: concept · learner-world hook · what they *do* · pattern ·
wrong-answer · payoff — fill the whole Unit) → **Density check** (no 2 read-only screens in a
row, no repeated mechanic per Unit, each Unit ends in a gated lab/quiz, clears the Richness bar).

**Output:** show the user the filled storyboard + Unit closer + density-check result, and get
explicit approval **before** moving to the Build & verify loop.

## Lesson skeleton

1. Open with an **analogy block** ("Let's understand it simply first…") framing the whole idea.
2. Teach the idea through **one interactive visual** (see patterns).
3. Let the learner **act** (predict / build / choose) with instant feedback.
4. Close with a **payoff box** (what they can now do) and a **Next →** button.
5. Group lessons into **Units**; end each Unit with a **mini-lab or quiz**.

## Pattern library & Mobile recipe → `assets/craft-reference.md`

The full pattern library (pick one per screen, rotate across lessons) and the proven mobile
recipe (off-canvas drawer, shrink rows, floating panels) live in **`assets/craft-reference.md`**.
Apply the mobile recipe before verifying.

## Build & verify loop (do this; don't ask the user to check)

0. **Plan first (Phase 0a → 0b → Phase 0).** Re-architect the knowledge (explode → re-group →
   re-sequence Zero→Hero), **then** run the Chain-of-Thought 6-step ladder per atom (Phase 0b)
   to derive an Atom Design Sheet — *before* drawing screens — then fill the Storyboard + run the
   Density check from `assets/storyboard-planning.md` and get the user's approval of the
   storyboard. Do not edit the file until the storyboard is confirmed.
1. **Locate** the section (grep the heading). Match existing class names + color system.
2. **Edit** — CSS keyframes + markup + any JS array/handler.
3. **Verify in the live preview:**
   - Reload; navigate via the app's own nav function.
   - Confirm structure with DOM queries; confirm motion runs with
     `getComputedStyle(el).animationName` (don't trust the eye).
   - Resize to 375px; assert `documentElement.scrollWidth <= clientWidth` and that
     interactive rows don't overflow.
4. **Screenshot to inspect with your own eyes (not just as proof).** DOM checks prove logic;
   only a screenshot catches *visual* problems. Capture and actively look for: text overlap or
   occlusion, clipped/truncated labels, misaligned or cramped rows, a marker landing off-target,
   awkward wrapping, empty gaps. Fix what looks untidy and re-capture — iterate until it reads clean.
   - For a **multi-step / staged animation**, capture more than the final frame: grab a
     *mid-animation* frame too (drive it via eval if timing is hard) to confirm the intermediate
     states are legible and nothing collides while in motion.
   - Capture at **both desktop and 375px**. The screenshot is for *you* first, the user second.
5. **Re-run the integrity check after big edits** — confirm the whole page still renders
   (e.g. expected section count, sidebar present, no console errors); a broken tag can silently
   eat unrelated parts of the page.
6. **Report honestly** — if it only partly works, say so.

## Language

Skill + code/comments → **English**. Lesson content (UI, examples) → **the learner's
language**. Still surface the original English term once, via the `Real term:` badge.

## Anti-patterns (reject)

- Prose explaining what an animation could show; or an "animation box" *beside* the concept
  instead of *being* it (a pipe drawn as a bar chart); or weak static examples where motion was asked.
- **Designing a screen straight from a keyword** — skipping the Phase 0b ladder, or writing the
  beat-sheet before naming the misconception. Animation built before you know where the learner
  trips is decoration, not teaching (Rule 3).
- **Number-reveal masquerading as a lab** — a button that just counts figures up/down and recolors
  cards. That's a reveal; pair it with a real build mechanic.
- **Flat form with no gates** — all slots clickable in any order, no unlock progression, no
  assembled result. Add staged gating so finishing *builds* something.
- **One keyframe reused everywhere** — signals a lesson with no real motion design (also Rule 5).
- **Skipping a step because it's "obvious"**, or stacking two new ideas in one beat — groom one
  piece at a time (Rule 10).
- **Cutting detail to stay fun, or dumping detail and going boring** — both fail. Deliver the full
  detail *through* an interaction/animation beat (Rule 10).
- **Shipping a lesson thinner than the file's existing best** — skipping the calibration rule.
- **Leading with the domain/professional case** — workplace vocabulary (machine downtime, SLA,
  vendor, credit score) before the learner met the idea in their own world. The corporate case is
  the *bridge* after understanding, never the first explainer (Rules 6 & 9).

## Definition of done

Beginner understands it cold · **assumes zero prior knowledge — groomed up one piece per beat,
no skipped steps, full detail delivered through interaction/animation not dense text (Rule 10)** ·
every term introduced via analogy first · **every concept's
*first* example comes from the learner's own world, with the project/domain case appearing only
as a labelled bridge afterward (Rules 6 & 9)** · learner *acts* on the
screen (Pillar 1) · a visual carries the core idea (Pillar 2) · renders clean on mobile ·
**meets every row of the Richness bar and passed the calibration rule** (see
`assets/craft-reference.md`) — verified in-league with the richest existing lesson in the same
file, not a thinner regression.
