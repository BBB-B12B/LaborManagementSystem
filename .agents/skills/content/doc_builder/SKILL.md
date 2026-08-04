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
produces a Playwright screenshot capture script → optionally exports to PDF via `pdf` skill.

> **Scope rule (hard):** doc_builder NEVER writes inside the target project tree. It only
> *reads* (scans) the project source, and writes ALL of its own output to a separate
> `doc_output/<project_name>/` root that lives OUTSIDE the target project. `<project_name>` =
> the basename of the scanned project root. The target project's `src/` and files are
> strictly read-only — the skill adds nothing to the customer's repo.

Outputs (all under the external `doc_output/<project_name>/` root — never inside the project):
- `doc_output/<project_name>/manual/index.html` — overview + flow diagram
- `doc_output/<project_name>/manual/<role>.html` — one page per role / feature group
- `doc_output/<project_name>/capture_manual.py` — Playwright script to capture all screenshots
- `doc_output/<project_name>/manual/assets/` — screenshots named by convention

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

## Model Routing (the understanding phase must be COMPLETE before building)
The phases that REASON about the project — §1 Analyze, §2 Storyboard, and the Grounding Gate — run on
**model_medium as a floor, escalating to model_high for large or multi-role projects** (many routes,
>5 roles, or unclear architecture). This is deliberate: a weak model skims and invents, which is the
root cause of "the manual describes features the project doesn't have." Treat §1/§2 like a MECE plan
that must be thorough and confirmed *before* any HTML is written — not a quick skim.
Only the mechanical, fully-specified steps (running the capture script, writing finalized HTML from a
confirmed storyboard, PDF export) may use a lower tier. **Never route §1/§2/Grounding to model_low.**

## §1 · Analyze Project

**Goal:** understand what the system does, its roles, permissions, and feature map.

Steps:
1. Ask user: `project_root=<path>` · `base_url=<http://...>` · `auth_needed=<yes/no>`
2. Scope probe: `find <project_root>/src -name "*.ts" -o -name "*.tsx" -o -name "*.py" | wc -l`
   - ≥5 files → spawn `Explore` agent (≤500 tok summary) · <5 → inline grep
3. G1 scan — one Bash call: routes · roles/permissions · features (→ detail: **SKILL_detail.md §1-scan**)
4. Build System Map: name · type · roles · pages-per-role · flow — **every entry carries a `source:` (a route string or `file:line` from the scan)** — emit `[✓ system-map]` · confirm before §2

## Grounding Gate (hard — no evidence = no write)
Every fact that reaches the manual (a role, a page, a feature, a flow step, a button label) MUST trace
back to a real hit in the §1 scan. The skill describes only what it actually found — never what a
typical app *probably* has.
- **Each System Map row needs a `source:`** — a route (`/admin/users`) or `file:line` from the scan.
  A row with no source is not allowed into the map.
- **§6 build emits mapped facts only.** Before writing any page, re-check each claim against the
  confirmed System Map. A claim with no backing entry → do NOT write it → emit
  `[grounding-drop] <claim> · reason: no scan source` and skip it.
- **Verify-back step (before `[✓ doc-builder-done]`):** grep every page/role/feature name in the
  generated HTML against the scan output. Any name with zero scan hits → flag + remove or ask user.
- If the scan is too thin to ground a section, say so plainly — do not fill the gap from assumption.

## Coverage Gate (hard — every scanned feature must be documented)
The inverse twin of the Grounding Gate: Grounding blocks EXTRA (invented) content; Coverage blocks
MISSING content. Every role, route, and feature found in the §1 scan MUST appear somewhere in the manual.
- **§1 builds a full Coverage Inventory** — one row per role / route / feature found in the scan, each
  with its `source:` and a `documented_in:` slot (the page/section that will cover it, filled during §2).
  Nothing in the scan may be left without a planned home. Emit `[✓ coverage-inventory] items: <N>`.
  (row format → **SKILL_detail.md §1-scan · Coverage Inventory table**)
- **Verify-back step (before `[✓ doc-builder-done]`):** count documented-vs-inventory — walk every
  inventory item and confirm it has a real page/section in the generated HTML. Any item with no
  coverage → emit `[coverage-gap] <item> · source: <scan src>` → halt and ask the user (add the page,
  or confirm a deliberate omission). Never close with a silent gap.
- A feature shared by >1 role counts as covered once it has its single canonical section (see cross-role rule).

## §2 · Storyboard HTML Pages

**Goal:** plan the full HTML manual structure before writing any files.

Page architecture:
```
index.html               — Overview: system name · flow diagram · role cards (links to role pages)
<role>.html              — Per-role: features list · flow steps · screenshots placeholder.
                           A feature shared by >1 role lives ONCE here in its owner role page, marked
                           with an id="<feature-id>" anchor; other roles deep-link to it (new tab).
<role>_<task>_steps.html — Step-by-step walkthrough: customer-followable guide for one task
```

Rules:
- Each role gets exactly 1 HTML page
- **Step-by-step walkthrough pages (the customer-followable format — F5):** for each key task,
  build a numbered walkthrough where **1 step = exactly 1 instruction + 1 screenshot**. The reader
  completes the task by looking at each step's image and doing what its single sentence says — no
  step bundles two actions. Steps are numbered (Step 1, Step 2, …); each `<img>` is that one step's
  screenshot, named `<role>_<task>_step<NN>.png` (zero-padded, so the order is unambiguous).
- **Cross-role single source of truth:** a task/feature used by >1 role is written ONCE in its **owner**
  role page (owner = the most-relevant / most-used role — the agent decides), with an `id="<feature-id>"`
  anchor on that section. Every other role links to it with `<a href="<owner>.html#<feature-id>"
  target="_blank">` — opens a NEW TAB and jumps straight to that section. Other roles get the link only,
  never a copy of the content.
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
   - STOP if any §6 file write fails → emit `[doc-builder-halt] reason:write-fail` · report error · wait for user

Stop conditions:
- Missing prerequisite → emit `[doc-builder-refused]` · halt immediately
- User rejects system-map or storyboard → revise · do NOT advance to next §
- Playwright capture fails → halt · do NOT call `pdf` skill on incomplete captures
- Runaway iteration → see **Loop Guard** below · emit `[doc-builder-eject]` · halt + ask user

## Loop Guard (hard — bounded + ejectable)
doc_builder must never loop forever. Every step that can repeat (re-scanning, re-storyboarding after
rejection, retrying a failed capture, regenerating a page) is bounded and can eject.
- **Max iterations per step = 3.** A 4th attempt at the same step is not allowed — eject instead.
- **Read `[token-state]` Loop_W at the start of every retry cycle.** If `Loop_W > 50`, do not start
  another cycle — eject.
- **Early-eject:** on hitting the iteration cap OR the Loop_W threshold, STOP immediately and emit:
  `[doc-builder-eject] reason: <runaway|loop_w-high> · step: <§N> · attempts: <N> · Loop_W: <N>`
  then ask the user "ทำต่อ / ข้ามขั้นนี้ / ยกเลิก?" and WAIT — never silently retry past the cap.
- The eject is a hard halt: no file writes, no `pdf` call, no further capture after it fires.

## Output Tone
Keep:   `[✓ system-map]` signal + role list + page count · `[doc-builder-refused]` + reason ·
        doc-type label ("User Manual · Admin Guide") · target-audience statement ("Audience: admin")
Strip:  internal deliberation ("I'll now scan…") · "I'll generate…" preamble · "Feel free to…" filler ·
        apologies for missing features · hedging openers ("this might not be complete / cover everything")
Format: signal-first — emit `[✓ system-map]` / `[doc-builder-refused]` before any prose ·
        `[✓ system-map] roles: <N> · pages: <N> · confirmed: yes` · structured markdown headers ·
        never wrap deliverables in conversational padding
Prohibited: "Here's what I found so far…" · "I wasn't able to identify all roles but…" · "This is a rough draft…"

## Simpler-Way (P2 · always-on pointer)
Before finalizing the output, ask once: is there a materially simpler way to get the SAME result? → run the `scrutinize` skill if the answer is non-obvious. (scrutinize owns the full simpler-way pass — this is only the reflex pointer; never re-copy the pass here.)

## Hard Rules
- Never write any HTML file before `[✓ system-map]` is confirmed by user — §1 gate is mandatory, not advisory.
- Never write §3+ before §2 storyboard is user-confirmed — out-of-order execution produces orphaned pages.
- Never invent roles or features not evidenced in the codebase scan — every role page must trace to a real route or permission group.
- Never run Playwright capture before all HTML placeholders are finalized — screenshots of incomplete pages waste capture budget.
- Never omit the PDF export button — every page footer requires `<button onclick="window.print()">Export PDF</button>`.
- Never duplicate a shared feature across roles — a feature used by >1 role is written ONCE in its owner role page (owner = most-relevant/most-used, agent's call) with an `id="<feature-id>"` anchor; other roles get a `target="_blank"` deep link (`<owner>.html#<feature-id>`) opening a new tab on that exact section — single source of truth.
- Never call `pdf` skill without user confirming all screenshot captures are complete first.
- Quality heuristic: if §1 scan finds >15 distinct roles, group into role families (admin/user/system) before §2 — a 15-page manual with no grouping is unnavigable.
- Screenshot naming: reference shots `<role>_<feature>_<state>.png` (e.g. `admin_users_list.png`) · walkthrough shots `<role>_<task>_step<NN>.png` (zero-padded). Append `<button onclick="window.print()">Export PDF</button>` to every page footer.

## Output Contract
- Every response that creates a file MUST emit `[✓ written] <path>` after the write
- Every refusal MUST emit `[doc-builder-refused] reason:<X>` — no silent failures
- `[✓ system-map]` MUST be emitted after §1 and confirmed before any HTML is written
- Final deliverable includes: HTML pages + Playwright script + asset directory listing
- No response ends with filler ("Let me know if you need changes!") — end with signal or next-step prompt

## hand-off
> Spec: docs/session_templates/handoff_block_schema.md · this skill OWNS the manual artifact; downstream is a read-only reframe (T-202 single-source rule).
downstream: project_presenter
artifact: HTML system manual + screenshot set (the finished §3–§6 deliverable)
format: manual *.html pages + screenshots/*.png
role: primary
required-inputs:
  - every HTML page finalized — `[✓ written]` emitted per page AND §2 storyboard user-confirmed
  - screenshots/ contains ≥1 captured image (Playwright capture complete)
on-missing: HALT · emit `[handoff-blocked] missing:<inputs>` · ask the user · NO partial flow (reuse T-214 refuse-without-required-inputs)
on-present: offer to flow to project_presenter — reframe the manual into an audience/leadership presentation
owner-note: doc_builder stays SOLE owner of the manual; project_presenter only reads + reframes it

<!-- MECE Constraints Block merged into Hard Rules + Output Contract (S6 dedup · F6 fix) -->
<!-- §1/§2 gates → Hard Rules · screenshot naming + PDF footer → Hard Rules · write/refusal signals → Output Contract -->>

> hand-off (index): file create/delete → index_manager (mode:file) · symbol change → index_manager (mode:symbol) · folder move/rename → repo_map sync · enforced by R8 + scripts/index_reconcile.py · spec: docs/session_templates/handoff_block_schema.md §INDEX variant · reference only — index_manager stay sole owners.
