---
name: doc_builder
triggers:
  - "build documentation"
  - "generate docs"
  - "write README"
  - "create doc file"
  - "สร้าง doc"
  - "เขียน README"
  - "build doc"
  - "สร้างคู่มือ"
  - "ทำคู่มือ"
description: >
  Analyzes any web app project codebase → generates interlinked HTML manual pages
  served at /doc/manual within the target project → produces a Playwright screenshot
  capture script → optionally exports to PDF via `pdf` skill.
  Trigger on: "สร้างคู่มือ", "ทำคู่มือ", "สร้าง manual", "สร้าง user guide",
  "present project", "สร้าง presentation", "doc/manual", "capture หน้าจอระบบ",
  "create manual", "generate documentation", "build user guide".
---

# doc_builder Skill

## Overview
Analyzes any web app project codebase → generates interlinked HTML manual pages
served at `/doc/manual` within the target project → produces a Playwright screenshot
capture script → optionally exports to PDF via `pdf` skill.

Outputs:
- `<project>/public/doc/manual/index.html` — overview + flow diagram
- `<project>/public/doc/manual/<role>.html` — one page per role / feature group
- `<project>/scripts/capture_manual.py` — Playwright script to capture all screenshots
- `<project>/public/doc/manual/assets/` — screenshots named by convention

## Trigger
Use this skill when the user says any of:
- "สร้างคู่มือ" / "ทำคู่มือ" / "สร้าง manual" / "สร้าง user guide"
- "present project" / "สร้าง presentation" / "เอกสารแนะนำ project"
- "doc/manual" / "ทำหน้า overview ระบบ" / "capture หน้าจอระบบ"
- "อธิบาย flow ระบบ" + "เก็บภาพ" / "screenshot" + "คู่มือ"
Also trigger when: user wants to sell / demo / onboard users to a web app project.

## When to Invoke
- User asks to build, generate, or write documentation for a project
- User wants a README, manual, user guide, or doc site created
- User wants to present, demo, or onboard others to a web app project
- User asks to "create doc file", "build doc", or any phrase in `triggers:` above

## Prerequisites
**Refuse (emit `[doc-builder-refused] reason:<X>`) without all of these:**
- [ ] `project_root` path provided or inferable from context
      → Why: all scans and output paths depend on project root
      → Missing: ask user "project root path?" · emit `[doc-builder-refused] reason:no-project-root`
- [ ] `base_url` provided (e.g. `http://localhost:3000`)
      → Why: Playwright capture script requires base URL to navigate pages
      → Missing: ask user "base URL for local server?" · emit `[doc-builder-refused] reason:no-base-url`
- [ ] Target project has identifiable routes or roles (found in router file or nav config)
      → Why: cannot build role pages without knowing what roles exist
      → Missing: ask user to point to router file · emit `[doc-builder-refused] reason:no-routes`

## When NOT to Use
- Target is a CLI tool, library, or API-only project (no browser UI) → use `repo_researcher` to produce a text-based README doc instead
- User wants to fix or update an *existing* manual page → use `editor` directly · skip §1–§2 analysis
- User wants a slideshow / pitch deck, not a manual → route to `project_presenter` skill
- Auth-protected pages requested but no test credentials available → halt · ask user to provide test account before proceeding

## Operating Stance
- Understand before building. Always emit `[✓ system-map]` and confirm with user before writing any file — a misread system map produces a manual that describes the wrong product.
- Storyboard-first. No HTML is written until §2 page architecture is confirmed — writing files before confirming structure creates rework and orphaned pages.
- Role-driven structure. Every page maps to a real user role or cross-role task — do not create pages for technical modules, DB schemas, or implementation details unless the user explicitly requests them.
- Minimal scope. Produce only what the target project actually has — do not invent features, roles, or pages not evidenced in the codebase scan.

## §1 · Analyze Project

**Goal:** understand what the system does, its roles, permissions, and feature map.

Steps:
1. Ask user: `project_root=<path>` · `base_url=<http://...>` · `auth_needed=<yes/no>`
2. Scope probe: `find <project_root>/src -name "*.ts" -o -name "*.tsx" -o -name "*.py" | wc -l`
   - ≥5 files → spawn `Explore` agent (≤500 tok summary) · <5 → inline grep
3. G1 scan — one Bash call: routes · roles/permissions · features (→ detail: **SKILL_detail.md §1-scan**)
4. Build System Map: name · type · roles · pages-per-role · flow — emit `[✓ system-map]` · confirm before §2

## §2 · Storyboard HTML Pages

**Goal:** plan the full HTML manual structure before writing any files.

Page architecture:
```
index.html          — Overview: system name · flow diagram · role cards (links to role pages)
<role>.html         — Per-role: features list · flow steps · screenshots placeholder
shared/<task>.html  — Cross-role tasks: accessible by multiple roles → hyperlinked from role pages
```

Rules:
- Each role gets exactly 1 HTML page
- Tasks accessible by >1 role → write in primary role page · hyperlink from others
- Every page has: header (system name + nav) · breadcrumb · footer (PDF export button)
- Flow diagrams: ASCII or Mermaid (inline `<pre class="mermaid">`)
- Screenshot placeholders: `<img src="assets/<name>.png" alt="<desc>">` — named in §3

Steps:
1. Draft page list with purpose per page (index + per-role + shared cross-role pages)
2. Write storytelling outline per page (3–5 bullet narrative flow)
3. Present to user → confirm before §3

→ Full HTML template + CSS design system + Mermaid config: **SKILL_detail.md §3**

## §3–§6 Detail
→ See **SKILL_detail.md** for:
- §3 Screenshot Plan (enumerate all capture targets · Playwright naming convention)
- §4 Playwright Capture Script (Python template · login helper · named screenshots)
- §5 MECE Plan Update (insert screenshot filenames into HTML placeholders)
- §6 Build HTML + PDF Hook (write actual HTML files · call pdf skill)

## Workflow
1. **§1 Analyze** — scan project · emit `[✓ system-map]` · confirm with user
   - STOP if no `project_root` or `base_url` → emit `[doc-builder-refused]`
2. **§2 Storyboard** — plan HTML pages · confirm with user
   - STOP if user rejects storyboard → revise · do NOT write HTML until confirmed
3. **§3 Screenshot Plan** — enumerate capture targets + naming
4. **§4 Playwright Script** — generate capture script
5. **§5 MECE Update** — insert screenshot filenames into HTML placeholders
6. **§6 Build HTML + PDF** — write files · call `pdf` skill
   - STOP if any §6 file write fails → report error · wait for user

Stop conditions:
- Missing prerequisite → emit `[doc-builder-refused]` · halt immediately
- User rejects system-map or storyboard → revise · do NOT advance to next §
- Playwright capture fails → halt · do NOT call `pdf` skill on incomplete captures

## Output Tone
Keep:   `[✓ system-map]` signal + role list + page count · `[doc-builder-refused]` + reason
Strip:  internal deliberation ("I'll now scan...") · apologies for missing features · hedging ("this might not be complete")
Format: `[✓ system-map] roles: <N> · pages: <N> · confirmed: yes` — signal first, counts second
Prohibited: "Here's what I found so far..." · "I wasn't able to identify all roles but..." · "This is a rough draft of the manual structure"

## Tone Guide
Keep:
- Doc type label (e.g. "User Manual · Admin Guide · API Reference")
- Target audience statement (e.g. "Audience: end-users · role: admin")

Strip:
- "I'll generate..." preamble before delivering content
- "Feel free to..." filler phrases at end of response
- Hedging openers ("This might not cover everything...")

Format:
- Structured markdown with headers (`##`, `###`)
- Signal-first: emit `[✓ system-map]` or `[doc-builder-refused]` before prose
- Never wrap deliverables in conversational padding

## Hard Rules
- Never write any HTML file before `[✓ system-map]` is confirmed by user — §1 gate is mandatory, not advisory.
- Never write §3+ before §2 storyboard is user-confirmed — out-of-order execution produces orphaned pages.
- Never invent roles or features not evidenced in the codebase scan — every role page must trace to a real route or permission group.
- Never run Playwright capture before all HTML placeholders are finalized — screenshots of incomplete pages waste capture budget.
- Never omit the PDF export button — every page footer requires `<button onclick="window.print()">Export PDF</button>`.
- Never produce a manual with >1 canonical page per role — cross-role tasks get one page with links from others, not duplicated content.
- Never call `pdf` skill without user confirming all screenshot captures are complete first.
- Quality heuristic: if §1 scan finds >15 distinct roles, group into role families (admin/user/system) before §2 — a 15-page manual with no grouping is unnavigable.

## Output Contract
- Every response that creates a file MUST emit `[✓ written] <path>` after the write
- Every refusal MUST emit `[doc-builder-refused] reason:<X>` — no silent failures
- `[✓ system-map]` MUST be emitted after §1 and confirmed before any HTML is written
- Final deliverable includes: HTML pages + Playwright script + asset directory listing
- No response ends with filler ("Let me know if you need changes!") — end with signal or next-step prompt

## MECE Constraints Block
- Always confirm system-map with user before writing any HTML (§1 gate)
- Page storyboard must be user-confirmed before screenshot plan (§2 gate)
- Playwright script runs AFTER all HTML placeholders finalized (§4 after §5)
- Screenshot naming: `<role>_<feature>_<state>.png` (e.g. `admin_users_list.png`)
- PDF hook: append `<button onclick="window.print()">Export PDF</button>` to every page footer
