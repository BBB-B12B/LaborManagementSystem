# Catalog template — capture each surface VERBATIM

The catalog is the contract between the real app and the mockup. If it is faithful,
the mockup is faithful. Fill one block per surface. Copy text character-for-character
— do not paraphrase, translate, or "clean up" wording. Record real icon names, real
data, and every state.

## Per-surface block

```
### <surface name> — <source file:line>
Trigger:      <how the user reaches it: route / button / QR / modal-open-from X>
Kind:         page | modal | drawer | bottom-sheet | overlay
Data-branch:  <none | renders differently when <field> === <value> — list each branch>
States:       <list ALL: default, loading, empty, error, success, submitting, ...>

Copy (verbatim):
  - heading:   "<exact text>"
  - labels:    "<exact>", "<exact>", ...
  - buttons:   "<exact>", "<exact>", ...
  - helper/empty/error text: "<exact>"

Icons (real names):  <lucide names, e.g. building-2, map-pin, chevron-down>
Data / values:       <real sample values, units, counts>
Layout today:        <columns, grid, table, card list, chart — the desktop shape>
Notes:               <colored header, badges, anything meaning-bearing>
```

## Rules

- **Every state is its own entry** (or a clearly-listed sub-block). A page with an
  approve-form and a reject-form and two success screens is four+ surfaces, not one.
- **Data-branches are separate render trees.** If `type === 'PreHandover'` shows
  different copy/labels/questions, catalog both branches fully.
- **Trace triggers across files.** The popup you see on a page is usually defined in
  another component; a page may also define its own modal that shadows a standalone
  file of the same name. Record where each really lives.
- **Icons: real names only.** No emoji, no approximations. Resolve lucide aliases one
  hop (`bar-chart-3`→`chart-column`).
- **Near-duplicate surfaces:** catalog one fully, then add a `Variant of <X>: diffs =
  ...` line listing the EXACT differences (labels that change, sections absent).

## Coverage — prove the catalog is complete

Before moving on, run the 3-grep sweep in `verify.md`. A hand-written catalog WILL
miss surfaces (it missed a whole subfolder once); the sweep is what makes "I covered
everything" a fact instead of a hope.
