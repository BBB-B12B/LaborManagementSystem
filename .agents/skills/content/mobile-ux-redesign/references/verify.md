# Verify — coverage sweep, tag balance, icon references

Run these before showing a mockup to the user (step 7) and again before claiming a
redesign is complete. Each check exists because skipping it caused a real miss.

## 1. Coverage sweep — did the catalog find every surface?

A hand-written catalog silently missed a whole `daily-report/` subfolder of modals
once. Never trust the hand list alone — run all three greps and reconcile every hit
against your catalog. Classify each hit as: **live** (imported + rendered), **dead**
(not imported / shadowed), or **already-mocked**.

```bash
# (a) files named like a popup
find src -type f \( -iname '*Modal*' -o -iname '*Drawer*' -o -iname '*Dialog*' \
  -o -iname '*Sheet*' -o -iname '*Popup*' \)

# (b) popups defined INSIDE a page (page-local, can shadow a standalone file)
grep -rnE '(const|function) [A-Za-z]*(Modal|Drawer|Dialog|Sheet)' src/pages

# (c) overlay popups NOT named *Modal (time pickers, lightboxes, custom overlays)
grep -rnE "position: ?['\"]fixed['\"]|role=\"dialog\"" src
```

If a hit isn't in your catalog and it's live → catalog + mock it. This sweep was
validated: on a real app its 3 greps predicted exactly the 5 live popups a later
pass then mocked. Sweep-before-done is a proven rule, not a hunch.

## 2. Tag balance — is the mockup HTML well-formed?

Unbalanced tags render as a broken preview and waste the user's review turn. Count
opening vs closing tags. **Use the character-class form** — the naive `<t[ >]`
counter miscounts because it breaks on `>`:

```bash
# example for <text>/<tspan> etc. — count opens vs closes
grep -oE "<t([ />]|$)"  mockup.html | wc -l   # opens (adjust letter per tag)
grep -oE "</t"          mockup.html | wc -l   # closes
```

More usefully, spot-check the tags you nested by hand (SVG `<g>`, `<text>`, `<div>`
wrappers). A quick browser open at 375px is the ultimate check — if it renders
whole and scrolls only where intended, structure is sound.

## 3. Icon-reference check — every `<use>` resolves

Every `<use href="#i-name">` must point at a `<symbol id="i-name">` that exists in
the sprite. A dangling reference shows an invisible/blank icon — which reads as
"faithful" but isn't.

```bash
# referenced icon ids
grep -oE 'href="#(i-[a-z0-9-]+)"' mockup.html | sed -E 's/.*#(i-[^"]+)"/\1/' | sort -u > /tmp/refd
# defined symbol ids
grep -oE '<symbol id="(i-[a-z0-9-]+)"' assets/icons_sprite.svg | sed -E 's/.*id="(i-[^"]+)"/\1/' | sort -u > /tmp/defd
# referenced but NOT defined (should be empty)
comm -23 /tmp/refd /tmp/defd
```

Any id printed by the last command is missing from the sprite → add it with
`extract_icons.mjs` (resolving lucide aliases one hop).

## 4. Final code-stage check (step 9)

After coding the approved mockup:
- Type-check / build passes with no new errors over baseline.
- The screen at 375px matches the signed-off mockup (screenshot it — a build pass is
  NOT proof of layout).
- The desktop view is unchanged (screenshot at ≥768px too; confirm the viewport
  actually reports desktop width before trusting it).
- No horizontal page scroll at either width (`scrollWidth === clientWidth`).
