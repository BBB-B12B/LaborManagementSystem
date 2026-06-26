---
name: project_presenter
triggers:
  - "present this project"
  - "show project overview"
  - "explain what this does"
  - "project summary"
  - "แนะนำ project"
  - "สรุป project"
  - "present to stakeholder"
  - "create presentation"
  - "sales page"
  - "pitch deck"
description: >
  Generates a sales-oriented, multi-page HTML presentation for any web-app project.
  Scans the target codebase, runs a bounded pain-point interview, validates the audience
  hypothesis, writes a storytelling source file, then builds 5 standalone HTML pages
  (hook / problem / solution / Q&A / demo) with a dark professional theme.
  Best run AFTER doc_builder so screenshots can be imported; standalone mode uses placeholders.
---

# Skill: project_presenter
> Generates sales-oriented HTML presentation pages for any web-app project.
> Run AFTER doc_builder (doc_manual) for best results — screenshots auto-imported.
> Standalone mode supported — missing doc_manual → warn + use placeholders.

> **Scope rule (hard).** project_presenter NEVER writes inside the target project tree.
> It reads the target project's `src/`, `README.md`, and manifests **read-only**, and writes
> ALL of its own output (HTML pages + storytelling file) to a separate
> `present_output/<project_name>/` root that lives OUTSIDE the target project.
> The target project is never modified — no file is created or edited inside it.

---

## When to Invoke
Use when: stakeholder/demo presentation needed · sales pitch page · project showcase · explaining project value to non-technical audience.

## When NOT to Use
- Task requires technical deep-dive (use doc_builder instead)
- Audience is developer needing API/code details
- Single-file documentation only
- Real-time metrics or live dashboard needed

## Operating Stance
- Audience-first: lead with value, not implementation
- Value before implementation: benefits → features → tech stack
- Visual structure over prose: headers, bullets, tables preferred
- Tailor depth to requester: exec → summary; team → detail
- Interview honestly: never invent pain points the user did not confirm; never close the interview on silence — only on an explicit stop word

## Prerequisites
| Item | Why | If Missing |
|---|---|---|
| Project root path | Cannot scan without root | Ask "ระบุ path ของ project ครับ" |
| Target audience defined | Depth and language differ by audience | Ask "who is this for?" |
| README/docs present | Existing docs → faster scan | Warn — generate from code scan |

**Refusal Contract (P1 · refuse-without-required-inputs)** — on any halt below, emit `[presenter-refused] reason:<missing-input>` + name what is missing, then halt (do not present partially):
- No target project path provided → ask: "ระบุ path ของ project ที่ต้องการสร้าง presentation ครับ"
- Target path does not exist → `[presenter-refused] reason:no-target-path` + halt
- Running inside the harness repo itself → `[presenter-refused] reason:in-harness-repo` + halt (must target a real project)

---

## Model Routing
§1 Codebase Scan, §2 Pain Point Interview, §4 Storytelling, and the Grounding Gate run on
**model_medium as a floor, escalating to model_high** for a large/unfamiliar codebase.
These steps decide what is true about the project and how to frame it — a weak model skims
and invents value claims. §5 HTML build (mechanical fill of a fixed template) may run on model_medium.
**Never route §1 / §2 / §4 / Grounding to model_low.**

---

## Grounding Gate
Every claim that lands on a page — feature, benefit, pain point, proof number — MUST trace
to something found in the §1 scan or stated by the user in §2/§3.
- Cannot trace a claim to a scan source or a user answer → drop it · emit
  `[grounding-drop] <claim> · reason: no scan source / not user-confirmed`
- Proof numbers (feature count, screenshot count, stack) come from the §1 scan only — never estimated.
- Emit `[✓ grounded]` once every page's claims are traced before §5 build.

---

## Loop Guard
- Max iterations per step = 3 (esp. §2 interview rounds and §5 page rebuilds).
- If the same step runs a 4th time, or `Loop_W > 50`, do NOT start another cycle — eject:
  `[present-eject] reason: <runaway | loop_w-high> · step: <§N> · attempts: <N> · Loop_W: <N>`
- On eject: write whatever is complete, report what is missing, hand back to the user. Never spin silently.

---

## Workflow
| § | Name | Stop condition |
|---|---|---|
| §1 | Codebase Scan | path invalid → [gate]+halt |
| §2 | Pain Point Interview | explicit user stop word OR Loop Guard eject |
| §3 | Hypothesis Validation | all 3 answers collected |
| §4 | Storytelling .md | file written before §5 |
| §5 | Build HTML Pages | 5 files emitted [✓ written] |

---

## §1 · Codebase Scan
Steps:
1. **Screenshot check** — test whether `<target>/public/doc/manual/index.html` exists:
   - exists → `screenshots_available = true` · emit `[doc-manual-found]`
   - missing → `screenshots_available = false` · emit `[no-screenshots]` ·
     warn: "ไม่พบ doc_manual — แนะนำรัน doc_builder ก่อน · จะใช้ placeholder แทนรูป" · proceed (do NOT halt)
2. Read `package.json` / `pyproject.toml` / `Cargo.toml` → extract project name + tech stack
3. Grep `src/` for route definitions → list top 5–10 features
4. Read `README.md` (≤40L) if exists → extract summary
5. Form 3–5 story-telling design questions (what problem does feature X solve?)
6. Emit `[✓ scan] Features: N · Stack: <tech> · Screenshots: <yes|placeholder>`

---

## §2 · Pain Point Interview
Bounded interview (governed by Loop Guard — max 3 add-rounds):
1. AI proposes initial pain points from the §1 scan (3–5 bullets, each tied to a scanned feature).
2. AI asks: "มี Pain Point อื่นที่อยากเพิ่มไหมครับ?"
3. Loop: user adds → AI acknowledges + appends to `pain_points[]`.
4. Exit the loop ONLY when the user gives an explicit stop word — "ไม่มีแล้ว" / "no more" / "พอแล้ว" / "done" —
   OR Loop Guard ejects after 3 add-rounds. Never exit on silence or a partial answer.
End state: `pain_points[]` has ≥3 items, each traceable to a feature or a user statement (Grounding Gate).

---

## §3 · Hypothesis Validation
Ask 3 multiple-choice questions (AskUserQuestion style — present as numbered options):
1. **Target Audience** — Who is this pitched to? (C-level exec / Mid-mgmt / Technical team / Mixed)
2. **Primary Goal** — What should the audience feel? (Urgency to buy / Confidence in quality / Curiosity to demo / Trust in team)
3. **Top Use Case** — Pick the #1 scenario this presentation should open with (generated from §1 features)

Store: `audience`, `goal`, `top_use_case` → used in §4 narrative-arc opening.

---

## §4 · Storytelling .md
Build `present_output/<project_name>/storytelling_<slug>.md`:
```markdown
## narrative_arc
hook: <audience-specific opening line>
problem: <top pain point — most relatable to audience>
solution: <how the system solves it — 1 sentence>
proof: <feature count / screenshot count / tech stack credibility — from §1 scan only>
cta: <call to action matching §3 goal>

## pain_points
- <pain> → feature: <feature_name> → how_solved: <one sentence>
(repeat per item in pain_points[])

## qa_matrix
| Question | Answer |
|---|---|
| <likely question from audience> | <confident answer> |
(5–8 rows)

## audience: <from §3>
## goal: <from §3>
## top_use_case: <from §3>
```
Emit: `[✓ story] File: present_output/<project_name>/storytelling_<slug>.md · Pain points: N · Q&A rows: N`

---

## §5 · Build HTML Pages
Generate 5 standalone HTML files in `present_output/<project_name>/`:
`index.html` (hook) · `problem.html` (pain) · `solution.html` (features) · `qa.html` (Q&A table) · `demo.html` (screenshots/placeholders).

Every page is built from the SAME paste-ready skeleton below — only the `<main>` content changes per page.
Standalone: inline CSS only, no CDN / no npm. Dark professional theme. Same nav bar on all 5 pages.

**Paste-ready page template** (copy verbatim → fill the 4 `{{...}}` slots per page):
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{PROJECT_NAME}} — {{PAGE_TITLE}}</title>
  <style>
    :root { --bg:#0f172a; --accent:#38bdf8; --text:#e2e8f0; --muted:#94a3b8; --card:#1e293b; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.6; }
    .nav { position:sticky; top:0; display:flex; gap:1.5rem; padding:1rem 2rem; background:rgba(15,23,42,.95); border-bottom:1px solid var(--card); }
    .nav a { color:var(--muted); text-decoration:none; font-weight:600; }
    .nav a:hover, .nav a.active { color:var(--accent); }
    main { max-width:960px; margin:0 auto; padding:3rem 2rem; }
    h1 { font-size:2.2rem; color:#fff; margin-bottom:.5rem; }
    h1 .accent { color:var(--accent); }
    .lead { color:var(--muted); font-size:1.15rem; margin-bottom:2rem; }
    .card { background:var(--card); border-radius:12px; padding:1.5rem; margin:1rem 0; }
    table { width:100%; border-collapse:collapse; margin:1rem 0; }
    th,td { text-align:left; padding:.75rem 1rem; border-bottom:1px solid #334155; }
    th { color:var(--accent); }
    .placeholder { display:flex; align-items:center; justify-content:center; height:240px; background:var(--card); border:2px dashed #334155; border-radius:12px; color:var(--muted); }
    .cta { display:inline-block; margin-top:2rem; padding:.85rem 2rem; background:var(--accent); color:var(--bg); border-radius:8px; font-weight:700; text-decoration:none; }
    footer { text-align:center; color:var(--muted); padding:2rem; font-size:.9rem; }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="index.html">ภาพรวม</a>
    <a href="problem.html">ปัญหา</a>
    <a href="solution.html">ทางออก</a>
    <a href="qa.html">Q&amp;A</a>
    <a href="demo.html">เดโม</a>
  </nav>
  <main>
    <h1>{{PAGE_HEADING}} <span class="accent">{{PROJECT_NAME}}</span></h1>
    <p class="lead">{{AUDIENCE_LABEL}}</p>
    {{PAGE_BODY}}
  </main>
  <footer>{{PROJECT_NAME}} · สร้างเพื่อ {{AUDIENCE_LABEL}}</footer>
</body>
</html>
```

Per-page `{{PAGE_BODY}}` guide:
- **index.html** — narrative `hook` + 3 value bullets in `.card`s + a `.cta` matching §3 goal.
- **problem.html** — each `pain_points[]` item as a `.card` (pain → who it hurts).
- **solution.html** — each pain mapped to its feature (`how_solved`), grouped in `.card`s; tech stack line at the end.
- **qa.html** — the `qa_matrix` rendered as a `<table>` (Question / Answer).
- **demo.html** — screenshots OR placeholders:
  - `screenshots_available = true` → `<img src="../doc/manual/...">` (relative to present_output root)
  - `screenshots_available = false` → `<div class="placeholder">[ ภาพหน้าจอ — รัน doc_builder เพื่อเพิ่ม ]</div>`

Set the `active` class on the nav link of the current page.
Emit per file: `[✓ written] <filename>`
Final: `[✓ present] Pages: 5 · Story: present_output/<project_name>/storytelling_<slug>.md · Root: present_output/<project_name>/`

---

## Simpler-Way (P2 · always-on pointer)
Before finalizing the output, ask once: is there a materially simpler way to get the SAME result? → run the `scrutinize` skill if the answer is non-obvious. (scrutinize owns the full simpler-way pass — this is only the reflex pointer; never re-copy the pass here.)

## Hard Rules
- Never write inside the target project — all output goes to `present_output/<project_name>/` (Scope rule).
- Never omit audience framing — always reference who the presentation is for.
- Never include raw code in the executive summary or `index.html`.
- Always confirm project purpose before generating any page.
- Never fabricate metrics, user counts, or performance numbers (Grounding Gate).
- Never use jargon without a definition for a non-technical audience.
- Never skip the §4 storytelling file before §5 HTML generation.
- All 5 HTML files MUST be standalone (no CDN / no npm) — inline CSS only.
- Validate the target project path before any read; never write to a path inside it.

## Tone Guide
- Keep: project name + value prop + audience label on every page.
- Strip: "I'll now present..." / "As an AI I can..."
- Format: structured sections with headers and a consistent nav bar.
- Prohibited: filler phrases, unsupported superlatives, raw stack traces.
