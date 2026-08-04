# Responsive pattern library — desktop shape → mobile shape

The reusable transforms for turning a desktop UI into a faithful mobile one. Each
pattern says WHAT to change and WHY, so you can apply judgment instead of copying
blindly. Distilled from a real 7-section, 5-mockup-group app redesign.

## Contents
1. Type scale + text rules
2. Spacing + tap targets
3. Chip / filter rows
4. Tables
5. Kanban / multi-column boards
6. Charts (donut / gauge / bar)
7. Stat grids + two-panel rows
8. Modals → mobile chrome
9. Already-mobile-first surfaces
10. Hard-won rules (the ones that bit us)

---

## 1. Type scale + text rules

Stop each screen from hand-picking font sizes — that is what causes desktop text to
sit oversized on a phone, wrap, and bloat the card. Use one scale:

| Role | Mobile | Desktop |
|---|---|---|
| display | 28 | 40 |
| h1 | 20 | 32 |
| h2 | 16 | 22 |
| h3 | 15 | 18 |
| body | 14 | 16 |
| label | 12 | 13 |
| code | 13 | 14 (mono, nowrap) |

- **Identifier codes** (order numbers, SKUs, `ART-2026-WOA-0014`): monospace +
  `white-space: nowrap` so they never break mid-string. A wrapped code reads as two
  broken tokens.
- A common code implementation is a `scaleFont(isMobile, desktopPx, mobileOverride?)`
  helper and a shared `identifierStyle`. Reuse the app's if it has one.

## 2. Spacing + tap targets

- Card padding ~12px on mobile (down from the usual desktop 20–24).
- Gaps 8–12px.
- **Tap targets ≥44px** min-height/width for anything tappable (buttons, tabs, chips,
  icon buttons). Gate this so it applies on mobile only — an unconditional 44px can
  shift an absolutely-positioned/centered desktop icon.

## 3. Chip / filter rows

Desktop lays chips in a multi-column grid or a wrapping flex row. On a phone that
wraps into 2–3 ugly rows. **Transform:** one horizontal-scroll row —
`display:flex; flex-wrap:nowrap; overflow-x:auto; gap:8px`, each chip `flex:0 0 auto`.
The row scrolls sideways; it never wrap-bloats. Add a subtle "swipe ←→" affordance if
content clearly overflows.

Gotcha: a plain `1fr 1fr` grid can be blown out past the viewport by a select's
min-content width. Use `minmax(0, 1fr)` tracks so columns can actually shrink.

## 4. Tables

A wide/dense table must NEVER make the whole page scroll sideways. **Transform:** wrap
just the table in its own `overflow-x:auto` frame with a "swipe ←→" hint; the page body
stays fixed. Keep colored group-header column spans intact — they carry meaning.
For very card-like tables, an alternative is one card per row on mobile (label:value
stack) and the real table on desktop.

## 5. Kanban / multi-column boards

A 5-column board can't show 5 columns at 375px. **Transform:** stack the columns as
**collapsible accordion rows** — each column becomes a full-width row with a colored
status dot + a count badge in its header; tapping expands its cards. Default to
collapsed (compact overview first, detail on demand). Keep the desktop board (row of
columns, horizontal scroll) unchanged behind an `isMobile` gate.

## 6. Charts (donut / gauge / bar)

Charting libraries don't run inside a static HTML mockup, so **hand-author the chart
as inline SVG**. A donut/gauge arc is `stroke-dasharray` on a `<circle>`: circumference
`C = 2·π·r`; a segment of fraction `f` is `stroke-dasharray: (f·C) (C−f·C)` with a
`stroke-dashoffset` to rotate each segment after the previous. Use the **verbatim**
segment names, values, and colors from the source. In the real code, keep the chart
library but gate the radii (innerRadius/outerRadius) smaller on mobile so it fits the
shrunk container.

## 7. Stat grids + two-panel rows

- Stat grid `repeat(3,1fr)` / `repeat(4,1fr)` → **2×2** on mobile (`repeat(2,1fr)`),
  gap 12. Watch the auto-fit-minmax gotcha: `repeat(auto-fit, minmax(160px,1fr))`
  collapses to 1 column on a narrow phone — force `repeat(2,1fr)` explicitly.
- A two-panel row (e.g. list beside a chart) → **stack full-width**, list then chart.
- Shrink big stat numbers with the type scale (a `2.5rem` KPI → ~1.65rem mobile).

## 8. Modals → mobile chrome

Desktop modals are centered, fixed-width cards. On mobile: **full-screen or bottom
sheet**. Header pinned to the top, footer action buttons pinned to the bottom, body
scrolls between them. Keep the source's gradient header color (indigo/green/blue) so
it still reads as the same modal. A `1fr 1fr` rating grid → a full-width segmented
scale. Always give the modal a visible close affordance (X in the header and/or a
Cancel button) — overlay-click-to-close alone is a trap on touch.

## 9. Already-mobile-first surfaces

Some surfaces are already fluid and centered — login screens, public QR portals,
time pickers, image lightboxes (often `maxWidth: 420/640`, no `isMobile`). **Do not
restructure these.** Only: bump tap targets to ≥44px and apply the type scale. Over-
restructuring a page that was already fine is how you introduce regressions for no gain.

---

## 10. Hard-won rules (these actually bit us — heed them)

1. **Enumerate EVERY state branch, not just the happy path.** One stateful page
   (`OwnerReview`) was really 5 mockups: main + approve-form + reject-form + 2 success
   screens. Miss a branch → miss a design.
2. **A page can hard-branch on a data field** into two different render trees with
   different copy/labels/survey questions (`type === 'PreHandover'`). Mock both,
   capture each verbatim.
3. **Coverage needs a full-repo SWEEP, not a hand-written list.** A hand catalog
   silently missed a whole subfolder of modals. Before claiming "all popups covered",
   run the 3 greps in `verify.md`.
4. **Modal triggers live in other files.** A page's popups are usually defined in
   separate components — and a page can define its OWN modal that shadows a
   same-named standalone file. Trace them.
5. **lucide has deprecated aliases that re-export** (`bar-chart-3`→`chart-column`,
   `x-circle`→`circle-x`, `loader-2`→`loader-circle`). Follow one hop or the icon
   won't resolve.
6. **Near-duplicate modals: mock ONE fully + a variant note.** Two ~95%-identical
   modals don't both need full re-rendering — mock one, then list the EXACT verbatim
   diffs (which labels differ, which section is absent). Faithful ≠ blind duplication.
7. **`100vw` includes the scrollbar width** → on a centered full-screen container it
   causes horizontal scroll on mobile. Use `100%` (byte-identical on desktop when
   there's no h-overflow).
8. **Verify the mockup is well-formed** before showing it (see `verify.md`) — a
   broken preview wastes the user's review.
