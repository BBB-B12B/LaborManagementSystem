---
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
---

# Skill: project_presenter
> Generates sales-oriented HTML presentation pages at `/present/` for any web app project.
> Run AFTER doc_builder (doc_manual) for best results — screenshots auto-imported.
> Standalone mode supported — missing doc_manual → warn + use placeholders.

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

## Prerequisites
| Item | Why | If Missing |
|---|---|---|
| Project root path | Cannot scan without root | Ask "ระบุ path ของ project ครับ" |
| Target audience defined | Depth and language differ by audience | Ask "who is this for?" |
| README/docs present | Existing docs → faster scan | Warn — generate from code scan |

---

## Trigger
Keywords: `present`, `presentation`, `sales page`, `นำเสนองาน`, `present project`, `สร้าง present`,
          `project presenter`, `demo page`, `pitch`

Refusal Contract:
- NO target project path provided → ask: "ระบุ path ของ project ที่ต้องการสร้าง presentation ครับ"
- Target path does not exist → [gate] emit + halt
- Running inside harness repo itself → [gate] emit + halt (must target a real project)

---

## Output Contract
Files in `<target_project>/`: `public/present/index.html` · `problem.html` · `solution.html` · `qa.html` · `demo.html` · `knowledge/storytelling_<slug>.md`
Emit: `[✓ present] Pages: 5 · Story: knowledge/storytelling_<slug>.md · Path: public/present/`

---

## Workflow
| § | Name | Stop condition |
|---|---|---|
| §1 | Codebase Scan | path invalid → [gate]+halt |
| §2 | Pain Point Interview | loop until explicit stop signal |
| §3 | Hypothesis Validation | all 3 answers collected |
| §4 | Storytelling .md | file written before §5 |
| §5 | Build HTML Pages | 5 files emitted [✓ written] |

---

## §1 · Codebase Scan

**BC-Screenshot-Check (fires at §1 start):**
```
Pre:    entering §1
Contract: check <target>/public/doc/manual/index.html exists
          exists → set screenshots_available=true · emit [doc-manual-found]
          missing → set screenshots_available=false · emit [no-screenshots]
                    warn: "ไม่พบ doc_manual — แนะนำรัน doc_builder ก่อน · จะใช้ placeholder แทนรูป"
                    proceed with placeholders (do NOT halt)
Post:   screenshots_available flag set · user informed if missing
Enforce: §1 proceed without check = [violation] BC-screenshot-check
```

Steps:
1. Read `package.json` / `pyproject.toml` / `Cargo.toml` → extract project name + tech stack
2. Grep `src/` for route definitions → list top 5–10 features
3. Read `README.md` (≤40L) if exists → extract summary
4. Form 3–5 story-telling design questions (what problem does feature X solve?)
5. Emit `[✓ scan] Features: N · Stack: <tech> · Screenshots: <yes|placeholder>`

---

## §2 · Pain Point Interview

**BC-Interview-Gate (fires throughout §2):**
```
Pre:    §2 running
Contract: AI proposes initial pain points from §1 scan (3–5 bullets)
          then asks user: "มี Pain Point อื่นที่อยากเพิ่มไหมครับ?"
          loop: user adds → AI acknowledges + appends to pain_points[]
          exit ONLY when user says: "ไม่มีแล้ว" / "no more" / "พอแล้ว" / "done"
          do NOT exit loop on silence or partial answer
Post:   pain_points[] has ≥3 items · user gave explicit stop signal
Enforce: exit §2 without explicit stop signal = [violation] BC-interview-gate → re-enter loop
```

---

## §3 · Hypothesis Validation

Ask 3 multiple-choice questions (AskUserQuestion style — present as numbered options):
1. **Target Audience** — Who is this pitched to? (options: C-level exec / Mid-mgmt / Technical team / Mixed)
2. **Primary Goal** — What should audience feel? (options: Urgency to buy / Confidence in quality / Curiosity to demo / Trust in team)
3. **Top Use Case** — Pick the #1 scenario this presentation should open with (generated from §1 features)

Store: `audience`, `goal`, `top_use_case` → used in §4 narrative arc opening.

---

## §4 · Storytelling .md

Build `knowledge/storytelling_<slug>.md` in target project:
```markdown
## narrative_arc
hook: <audience-specific opening line>
problem: <top pain point — most relatable to audience>
solution: <how the system solves it — 1 sentence>
proof: <feature count / screenshot count / tech stack credibility>
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
Emit: `[✓ story] File: knowledge/storytelling_<slug>.md · Pain points: N · Q&A rows: N`

---

## §5 · Build HTML Pages

Generate 5 HTML files at `<target>/public/present/`. Each file:
- Standalone HTML with inline CSS (no external dependencies)
- Responsive — works on laptop/projector
- Dark professional theme (#0f172a bg · #38bdf8 accent · white text)
- Navigation bar linking all 5 pages

Pages: `index.html` (hook) · `problem.html` (pain) · `solution.html` (features) · `qa.html` (Q&A table) · `demo.html` (screenshots or placeholders)

Screenshot handling in `demo.html`:
- `screenshots_available=true` → `<img src="../doc/manual/...">` relative paths
- `screenshots_available=false` → placeholder divs with caption "[ ภาพหน้าจอ — รัน doc_builder เพื่อเพิ่ม ]"

Emit per file: `[✓ written] <filename>`
Final: `[✓ present] Pages: 5 · Story: knowledge/storytelling_<slug>.md · Path: public/present/`

---

## Hard Rules
- Never omit audience framing — always reference who the presentation is for
- Never include raw code in executive summary or index.html
- Always confirm project purpose before generating any page
- Never fabricate metrics, user counts, or performance numbers
- Never use jargon without definition for non-technical audience
- Never skip §4 storytelling file before §5 HTML generation

## Tone Guide
- Keep: project name + value prop + audience label in every page
- Strip: "I'll now present..." / "As an AI I can..."
- Format: structured sections with headers and consistent nav bar
- Prohibited: filler phrases, unsupported superlatives, raw stack traces

---

## MECE Constraints Block
- BC-Screenshot-Check MUST fire at §1 start — no exceptions
- BC-Interview-Gate MUST enforce explicit stop signal — no auto-exit
- All 5 HTML files MUST be standalone (no CDN / no npm) — inline CSS only
- storytelling_<slug>.md MUST be written BEFORE HTML generation (§4 before §5)
- Target project path MUST be validated before any file write
