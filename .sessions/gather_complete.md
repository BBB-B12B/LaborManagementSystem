# Gather Complete — 2026-06-22

## Task
Fix dark-browser-theme rendering bug: when a user's browser/OS uses a dark theme, some text/UI becomes unreadable. App is light-theme-only. Lock app to light color-scheme permanently (user-confirmed direction).

## Root cause (confirmed)
`frontend/src/styles/globals.css:25-29` contains leftover Next.js boilerplate:
```css
@media (prefers-color-scheme: dark) { html { color-scheme: dark; } }
```
This flips UA-styled elements (inputs, scrollbars, dropdowns, default text/bg) to dark when the browser theme is dark — but no real dark theme exists, so light-on-light / dark-on-dark text becomes invisible.

## Evidence
- Only ONE "dark" reference in entire `src/styles/` (grep) -> no real dark theme implemented.
- Snippet matches create-next-app default globals.css verbatim -> boilerplate, not intentional.

## Fix direction (user-confirmed)
Replace the dark media query with an unconditional `html { color-scheme: light; }` to lock light rendering regardless of OS/browser theme.

[✓ gather]
