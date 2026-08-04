---
name: mobile-ux-redesign
description: >-
  Mockup-first, UX-first workflow for redesigning any UI to work on mobile / small
  screens. Use this whenever the user wants to redesign, restructure, or "make
  responsive" a screen, page, modal, or whole app — or complains a layout is
  "crammed", text "wraps" or "overflows", buttons are "too small to tap", or a
  desktop view "doesn't fit on the phone". Also trigger on Thai phrasing: "ออกแบบ
  UI", "ปรับ UI", "จอเล็ก", "มือถือใช้ยาก", "ทำ responsive", "หน้าจอเพี้ยน". The core
  rule this skill enforces: think about the mobile UX first, build a FAITHFUL
  static mockup (verbatim copy + real icons, changing only layout / font-size /
  wrapping), get the user to sign off on the mockup, and only THEN write code —
  never redesign straight into the codebase. Use it even when the user just says
  "fix the mobile view" without asking for a mockup, because the mockup step is
  what makes the result faithful instead of a guess.
triggers: ["redesign this", "make responsive", "mobile view", "fix the mobile", "layout is crammed", "text wraps", "buttons too small", "doesn't fit on phone", "ออกแบบ UI", "ปรับ UI", "จอเล็ก", "มือถือใช้ยาก", "ทำ responsive", "หน้าจอเพี้ยน"]
---

## Sections
```
- id: 1
  name: "Scope & Catalog"
  steps: ["frame every surface (screens/modals/states) + where each lives in code", "catalog each VERBATIM — real copy, real icon names, real data, every state + data branch (references/catalog-template.md)"]
- id: 2
  name: "Diagnose & Foundation"
  steps: ["diagnose real @375px breaks (wrap, overflow, <44px taps, wide table) = acceptance criteria", "set shared type scale + spacing tokens FIRST (references/patterns.md)"]
- id: 3
  name: "Build Mockup"
  steps: ["extract real lucide SVG icons — never emoji (assets/icons_sprite.svg + extract_icons.mjs, alias one-hop)", "build 375px mockup from assets/mockup-template.html — change ONLY layout/font/wrap, keep every word+icon", "verify mechanically before showing (references/verify.md: coverage sweep + tag-balance + icon-ref)"]
- id: 4
  name: "Review & Code"
  steps: ["show grouped for explicit sign-off — full-frame diff, MOCKUP-AUTHORITATIVE", "transcribe approved mockup to code, gate mobile so desktop stays identical, verify @375 + desktop"]
```

# Mobile UX Redesign — mockup-first, faithful, review-before-code

## Why this skill exists

Redesigning UI straight into the codebase fails in a predictable way: you can't
_see_ what you're making until it's already built, so you guess — and the guess
"crams the desktop layout onto the phone" (fonts stay desktop-sized → text wraps →
cards bloat), or silently drops copy and features, or invents emoji where the app
used real icons. By the time it renders, the damage is spread across many files.

The fix is to move the design decision _out_ of the code and _in front of the
user_ first: build a **faithful static HTML mockup at a real phone width (375px)**
that mirrors the app exactly — same words, same icons, same data — and changes
**only** the three things a mobile redesign is allowed to change: **layout,
font-size, and wrapping**. The user reviews that mockup like a photo. Once they
sign off, coding is just transcription — low-risk, because the target is settled.

This is not ceremony. Every step below removes a specific way redesigns go wrong.

## When to use / not use

**Use it** for any screen/page/modal/flow that needs to work on mobile or be
restructured responsively — a single component or a whole app. Reach for it the
moment "mobile", "responsive", "redesign", "จอเล็ก", or a layout complaint shows up.

**Don't use it** for pure logic/data/backend changes with no visible layout, for a
one-word copy tweak, or for building a brand-new screen from a blank page (there's
no existing UI to be _faithful to_ — though the pattern library still helps).

## The 9-step workflow

Do these in order. Each step names the failure it prevents — understand the WHY so
you can adapt, not just follow.

### 1. Frame — pick the exact surfaces in scope
Name every screen/modal you'll touch and where each lives in the code. **Why:** a
vague "redesign the dashboard" hides that a dashboard is really 5 states + 3 popups.
Framing scope now stops half-done coverage later. Output a short frame list.

### 2. Catalog — record each surface VERBATIM
For every surface, capture the real thing exactly: every label/heading/button word
copied character-for-character, the real icon names, the real data/values, and
**every state branch** (loading, empty, error, success) and **every data-branch**
(a page that renders a different tree when `type === 'X'`). Trace modal triggers
across files — a page's popups usually live in _other_ components. **Why:** faithful
means _faithful_. If you paraphrase copy or miss the reject-form state, the mockup
lies and the user signs off on a fiction. See `references/catalog-template.md` for
the format, and `references/verify.md` for the 3-grep coverage sweep that proves you
didn't miss a surface.

### 3. Diagnose — find the real mobile UX problems @375px
Look at each surface as it is today at 375px wide and write down what actually
breaks: codes wrapping to 2 lines, chip rows overflowing, tap targets under 44px,
a 5-column board that can't fit, a wide table forcing the whole page sideways.
**Why:** you fix problems you've _named_, not a vague feeling of "make it mobile".
This list becomes your acceptance criteria.

### 4. Foundation — set a shared type scale + spacing first
Before touching individual screens, settle the shared tokens: a mobile/desktop
**type scale** (see the table in `references/patterns.md`), identifier codes as
nowrap monospace, card padding ~12, gaps 8–12, tap targets ≥44px. **Why:** if each
screen hand-picks font sizes, you get 20 slightly-different scales and the wrap-bloat
comes back. One scale, applied everywhere, is what "designed" looks like.

### 5. Extract icons — real lucide SVGs, never emoji
Build/reuse an SVG symbol sprite of the **real** icons the app uses (this app uses
lucide). Follow deprecated aliases one hop (`bar-chart-3`→`chart-column`,
`x-circle`→`circle-x`, `loader-2`→`loader-circle`). **Why:** emoji stand-ins make
the mockup look unlike the product, so the user reviews the wrong thing and the
coded result surprises them. `assets/icons_sprite.svg` already holds 50+ common
symbols; `assets/extract_icons.mjs` adds more by name.

### 6. Build the mockup — 375px, change ONLY layout/font/wrap
Copy `assets/mockup-template.html` (device frame + type-scale CSS + sprite include +
sheet/modal chrome + analytics components) and render each catalogued surface inside
it. Apply the desktop→mobile transforms from `references/patterns.md`. **The one hard
rule: change only layout, font-size, and wrapping — keep every word and icon exactly
as catalogued.** **Why:** the moment the mockup "improves" copy or drops a field, it
stops being a faithful preview and becomes a redesign nobody approved.

### 7. Verify the mockup — mechanically, before showing it
Run the checks in `references/verify.md`: the coverage sweep (did every catalogued
surface get mocked?), tag-balance (`grep -oE "<t([ />]|$)"` — the naive counter
breaks on `>`), and an icon-reference check (every `<use href>` resolves to a symbol).
**Why:** a broken or incomplete mockup wastes the user's review turn. Catch it yourself.

### 8. Review per group — get explicit sign-off
Show the mockup to the user, grouped into reviewable chunks, and get a clear yes
before coding. Do a **full-frame** visual diff (top-to-bottom, not just your
checklist) — MOCKUP-AUTHORITATIVE. **Why:** this is the whole point. The cheap moment
to change direction is now, looking at a picture — not after it's coded across files.

### 9. Code — transcribe the approved mockup
Only now write code, matching the signed-off mockup. Gate mobile changes so the
desktop view stays byte-identical (e.g. `isMobile` conditionals) unless a desktop
change was explicitly approved. Verify the built screen against the mockup at 375px
_and_ desktop width. **Why:** with the design settled, coding is transcription; the
risk left is regressing desktop, so prove you didn't.

## Desktop → mobile transform quick-reference

Full library with reasoning in `references/patterns.md`. The essentials:

| Desktop shape | Mobile shape |
|---|---|
| Multi-column chip/filter row | horizontal-scroll row (no wrap) |
| Wide/dense table | its OWN horizontal-scroll frame + swipe hint (never page-level) |
| Kanban N columns | collapsible stacked accordion rows (dot + count) |
| Donut/gauge/bar chart | keep as inline SVG, radii mobile-gated to fit |
| Stat grid `repeat(3–4,1fr)` | 2×2 |
| Two-panel row (list + chart) | stack full-width |
| Centered modal, fixed width | full-screen / bottom-sheet, header pinned + footer pinned, body scrolls |
| Already mobile-first (login, QR portals) | keep layout — only tap-target ≥44px + type-scale |

## Bundled resources

- `references/patterns.md` — full desktop→mobile pattern library + the hard-won rules
  (charts as hand-authored SVG arcs, near-duplicate modals, state/branch enumeration).
  Read it before step 6.
- `references/catalog-template.md` — the verbatim-catalog format. Read it at step 2.
- `references/verify.md` — coverage sweep + tag-balance + icon-ref checks. Read at step 7.
- `assets/mockup-template.html` — starting point for step 6.
- `assets/icons_sprite.svg` — real lucide symbols to `<use>`.
- `assets/extract_icons.mjs` — generate more symbols by lucide name.
