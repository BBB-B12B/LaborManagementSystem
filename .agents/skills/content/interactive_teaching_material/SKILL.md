---
name: interactive_teaching_material
description: >
  Build fun, interactive, animated single-file HTML learning material for true beginners
  (high-school / non-technical learners) from source content + a target-audience profile.
  Trigger on: "create teaching material", "build an interactive lesson", "make courseware",
  "improve this lesson", "explain X simply with animation", "สร้างสื่อการสอน",
  "ทำบทเรียน interactive", "ปรับสื่อให้เข้าใจง่าย".
  Proactively: when a MECE plan section type is "Build a lesson/screen" or "Improve a Unit".
  NOT for: API/reference docs, expert audiences, slide decks, or repairing a broken .pptx
  (use pptx-repair-imported). Distinct from doc_builder (manual from a codebase) and
  project_presenter (sales pitch from a codebase) — this builds LESSONS for LEARNERS from
  arbitrary source material, not from a codebase.
bucket: draft
---

# Interactive Teaching Material

> **Family:** a sibling in the **content family** (with doc_builder · project_presenter).
> Shares the grounding-gate + bounded-loop pattern, but writes ONE self-contained file —
> it does NOT share the external-output scope rule → `.agents/skills/content/CONTENT_FAMILY.md`.

## Sections
```
- id: 0
  name: "Plan (Phase 0a→0b→0)"
  steps: ["re-architect knowledge (explode→regroup→resequence)", "CoT 6-step ladder per atom → Atom Design Sheet", "fill storyboard + density check", "get user approval BEFORE any code"]
- id: 1
  name: "Build a screen"
  steps: ["locate section + match classes/colors", "edit CSS keyframes + markup + JS", "[✓ built] per screen"]
- id: 2
  name: "Verify"
  steps: ["DOM + getComputedStyle anim check", "375px no-overflow assert", "screenshot desktop+375 inspect by eye", "integrity check", "report honestly"]
```
> **Whole piece from scratch** (audience→research→knowledge→route→build→test) = the 12-phase
> SOP in `assets/production-pipeline.md` (it wraps Sections 0–2 as its phases 6–10). Research/QA
> phases are run by the sub-agent roster in `assets/sub-agents.md` (our R4-routed conversion of
> the original 4 helper agents — spawn per our model tiers, never loose agent files).

## Operating Stance
- **Participate, don't spectate** — learner *does* something on every screen with instant feedback; a read-only screen is a defect.
- **Visualize to amplify** — a chart/diagram/animation carries the core idea; text only annotates.
- **Zero prior knowledge, groom upward** — one new idea per beat, define before use.
- **Detail and fun are not a trade-off** — full detail delivered *through* something they watch/do, never a dense block.
- **Their world first; the domain case is the bridge** — every concept lands via a learner-world example, then transfers to the professional case, never the reverse.

## When to Invoke / When NOT to
INVOKE: create/build/improve an interactive lesson or courseware · "explain <jargon> simply with animation" for beginners · MECE section = "Build a lesson/screen" · pipeline phases 6–10 reach build.
NOT: reference/API docs, slide decks (wrong format) · expert/professional audience (analogy-first wastes their time) · broken .pptx (→ pptx-repair-imported) · pure research with no build yet (run pipeline phases 1–5 first).

## Required inputs — refuse without these
- [ ] **Source content** — the actual material to teach (text, doc, spec, code excerpt). No source → ask for it; never invent lesson content.
- [ ] **Target-audience profile** — who the learner is + their prior level. The analogy-first method breaks without it; vague → ask one question, then proceed.
- [ ] **Output target** — a fresh single-file HTML, or the path of an existing lesson to improve.
Missing **source** → refuse. **Audience** missing entirely → refuse; audience present but vague → ask ONE clarifying question, then proceed (do not loop). Refusal line: "I need <X> before I can build the lesson." Never guess the audience or fabricate source material.

## Workflow (run in order — full method: SKILL_detail.md + named asset)
0. **Check inputs** — confirm the three §Required inputs exist; refuse per that section if source or audience is missing. Precedes Plan — never start Phase 0 on missing inputs.
1. **Plan (Phase 0a→0b→0)** — re-architect → CoT 6-step ladder per atom → storyboard + density check → emit `[storyboard-wait]` and **get explicit user approval before editing the file** (do not edit until confirmed).
2. **Locate** — grep the section heading · match existing class names + color system.
3. **Build** — CSS keyframes + markup + JS · emit `[✓ built] <screen>` per screen.
4. **Verify (DOM)** — confirm structure via DOM queries · motion via `getComputedStyle(el).animationName` (never the eye) · at 375px assert `scrollWidth <= clientWidth`.
5. **Screenshot + inspect** — desktop AND 375px (mid-frame for staged animation) · hunt overlap/clip/misalignment · fix + re-capture until clean.
6. **Integrity** — after big edits confirm whole page renders (section count · sidebar · no console errors).
7. **Report honestly** — if it only partly works, say so.
8. **Offer next** — after a clean screen, offer the next step: build the next screen · run `skill_auditor` on the lesson · or package the whole piece (pipeline phases 11–12). Always close with a concrete next-step offer, never a dead stop.

**Stop conditions:** storyboard not approved → stop at step 1, do not edit · `getComputedStyle` shows no animation OR 375px overflows → not done · console error / wrong section count → not done. Third failed verify → `[blocked]`.

## Hard Rules
- **Analogy before term** — plain idea → learner-world analogy → then a `Real term: <X>` badge.
- **Concept in their world FIRST; professional case is the bridge, never the entry.** Never lead with jargon or `foo/bar`.
- **Zero prior knowledge — one new idea per beat**, define before use; full detail *through* animation/interaction.
- **Build, don't reveal** — a lab gates staged progression that assembles a result; a flat form is not a lab.
- **Animation teaches, never decorates; never covers text** — motion behind (z-index), opaque cards in front.
- **Vary the mechanic per lesson** · **Mobile-responsive at 375px by default** · **Never claim done below the Richness bar** (calibration rule).

## Detail & assets (load before building, again before claiming done)
- `SKILL_detail.md` — full Rules 1–10, Richness bar, Phase 0a/0b/0 method, build-verify loop, anti-patterns, Definition of Done.
- `assets/storyboard-planning.md` — Phase 0b CoT ladder + storyboard tools.
- `assets/craft-reference.md` — pattern library + mobile recipe + **Richness bar table = the mandatory done-bar / output structure every finished screen must meet** (a screen below the bar is not done).
- `assets/production-pipeline.md` — end-to-end 12-phase SOP.
- `assets/sub-agents.md` — R4 sub-agent roster (research/QA phases) + model tiers.

## Language
Skill + code/comments → **English**. Lesson content (UI, examples) → **the learner's language**;
still surface the original English term once via the `Real term:` badge.
