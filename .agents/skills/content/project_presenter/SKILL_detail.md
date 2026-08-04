# project_presenter — Detail Procedures
> Overflow from SKILL.md. Read only when executing the section referenced.

---

## §1 Detail · Codebase Scan Procedures

**Step 1 — Project manifest read:**
```bash
# Try in order — stop at first match
cat <target>/package.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','?'), '|', d.get('description','?'))"
cat <target>/pyproject.toml 2>/dev/null | grep -E "^name|^description" | head -2
cat <target>/Cargo.toml 2>/dev/null | grep -E "^name|^description" | head -2
```

**Step 2 — Feature extraction (routes):**
```bash
# Next.js / React Router
grep -rn "path=\|href=\|router.push\|<Route" <target>/src --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test." | sed 's/.*path=["'"'"']\([^"'"'"']*\).*/\1/' | sort -u | head -15

# Express / Fastify
grep -rn "app\.\(get\|post\|put\|delete\)\|router\.\(get\|post\)" <target>/src --include="*.ts" --include="*.js" | grep -v node_modules | head -15
```

**Step 3 — README summary:**
```bash
head -40 <target>/README.md 2>/dev/null || echo "[no-readme]"
```

**Step 4 — Story questions generation:**
For each extracted feature, form: "Feature `<name>` — what problem does this solve for the user?"
Emit as internal context (not shown to user until §2).

---

## §2 Detail · Pain Point Interview Loop

**Full loop procedure:**
```
1. Present AI-generated pain points (from §1 analysis):
   "จากการสแกน codebase พบ Pain Point เหล่านี้:
   • [pain_1]
   • [pain_2]
   • [pain_3]
   มี Pain Point อื่นที่อยากเพิ่มไหมครับ? (พิมพ์ 'ไม่มีแล้ว' เมื่อครบ)"

2. User response loop:
   CASE user adds pain point → append to pain_points[] → ask again
   CASE user says stop signal → exit loop
   CASE user asks to edit existing → replace in pain_points[] → ask again
   CASE user is silent / sends unrelated → re-prompt (max 2 re-prompts)

3. Stop signals (case-insensitive, partial match allowed):
   "ไม่มีแล้ว" | "no more" | "พอแล้ว" | "done" | "ครบแล้ว" | "ok" + context of finality

4. After exit: confirm list back to user:
   "Pain Points ที่รวบรวมได้ (<N> ข้อ):
   1. [pain_1]
   2. [pain_2]
   ...
   ถูกต้องไหมครับ?"
   → wait 1 round for correction → proceed
```

**Pain point format for storytelling_<slug>.md:**
```
- <pain description> → feature: <feature_name> → how_solved: <one sentence>
```
Map each pain to the closest extracted feature from §1. If no match → feature: "custom implementation"

---

## §3 Detail · Hypothesis Validation Questions

Present as a single multi-part message (not AskUserQuestion tool — plain text with numbered options):

```
ขอถามเพื่อปรับทิศทาง presentation ครับ:

**1. กลุ่มเป้าหมายหลัก (Target Audience)**
   1) C-level / ผู้บริหารระดับสูง
   2) Middle management / ผู้จัดการ
   3) Technical team / ทีม IT
   4) Mixed / หลากหลาย

**2. เป้าหมายของ presentation นี้คืออะไร**
   1) ให้รู้สึก urgency — ต้องตัดสินใจซื้อเร็ว
   2) สร้าง confidence — มั่นใจในคุณภาพระบบ
   3) จุดประกาย curiosity — อยากดู demo
   4) สร้าง trust — เชื่อมั่นในทีม

**3. Use case หลักที่จะเปิด presentation ด้วย**
   <list 3-5 options generated from §1 features>

ตอบเลขได้เลยครับ (เช่น "1, 2, 3")
```

Parse response → set `audience`, `goal`, `top_use_case` fields.

---

## §4 Detail · Storytelling .md Construction

**Slug generation:**
```python
import re
slug = re.sub(r'[^a-z0-9]+', '_', project_name.lower()).strip('_')
# e.g. "My App 2.0" → "my_app_2_0"
output_path = f"<target>/knowledge/storytelling_{slug}.md"
```

**Narrative arc construction rules:**
- `hook`: address `audience` directly — C-level → ROI/risk framing · Technical → efficiency/automation framing
- `problem`: use top pain point from §2 (most voted or first if equal)
- `solution`: one sentence combining project name + top_use_case
- `proof`: count extracted features + screenshot count (0 if standalone) + tech stack keywords
- `cta`: match §3 `goal` → urgency="นัด demo วันนี้" · confidence="ขอ trial access" · curiosity="ดู live demo" · trust="พบทีม"

**Q&A matrix — generate from pain_points[]:**
Typical questions per audience:
- C-level: "ใช้เวลา implement นานไหม?" · "ROI คืนใน?" · "ใช้ง่ายไหม?"
- Mid-mgmt: "ทีมต้อง train นานไหม?" · "integrate กับระบบเดิมได้ไหม?"
- Technical: "stack คืออะไร?" · "scale ได้ไหม?" · "security ผ่าน?"
Select 5–8 most relevant per audience.

---

## §5 Detail · HTML Page Templates

### index.html — Hook/Landing
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{project_name}} — Presentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; color: #f1f5f9; font-family: 'Segoe UI', system-ui, sans-serif; }
    nav { background: #1e293b; padding: 1rem 2rem; display: flex; gap: 2rem; border-bottom: 1px solid #334155; }
    nav a { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
    nav a:hover, nav a.active { color: #38bdf8; }
    .hero { min-height: 80vh; display: flex; flex-direction: column; justify-content: center;
            align-items: center; text-align: center; padding: 4rem 2rem; }
    h1 { font-size: 3rem; font-weight: 700; background: linear-gradient(135deg, #38bdf8, #818cf8);
         -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
    .subtitle { font-size: 1.3rem; color: #94a3b8; max-width: 600px; line-height: 1.6; }
    .cta-btn { margin-top: 2rem; padding: 1rem 2.5rem; background: #38bdf8; color: #0f172a;
               font-weight: 700; font-size: 1rem; border-radius: 8px; text-decoration: none;
               transition: transform 0.2s; display: inline-block; }
    .cta-btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <nav>
    <a href="index.html" class="active">🏠 Overview</a>
    <a href="problem.html">⚠️ ปัญหา</a>
    <a href="solution.html">✅ โซลูชัน</a>
    <a href="qa.html">❓ Q&A</a>
    <a href="demo.html">🖥️ Demo</a>
  </nav>
  <div class="hero">
    <h1>{{project_name}}</h1>
    <p class="subtitle">{{solution_one_liner}}</p>
    <a href="problem.html" class="cta-btn">{{cta_text}} →</a>
  </div>
</body>
</html>
```

### problem.html — Pain Points
Structure: hero title "ปัญหาที่คุณกำลังเผชิญ" → grid of pain point cards (icon + title + description) → "แต่มีทางออก →" link to solution.html

Each card:
```html
<div class="pain-card">
  <div class="icon">⚡</div>
  <h3>{{pain_title}}</h3>
  <p>{{pain_description}}</p>
</div>
```
CSS grid: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;`

### solution.html — Features mapped to pain points
Two-column layout: left = pain point · right = feature solution with checkmark
Header: "{{project_name}} แก้ปัญหาได้อย่างไร"
Per row:
```html
<div class="mapping-row">
  <div class="pain-side">❌ {{pain}}</div>
  <div class="arrow">→</div>
  <div class="solution-side">✅ {{feature}}: {{how_solved}}</div>
</div>
```

### qa.html — Q&A Table
Full-width table with alternating row colors. Header row accent color `#38bdf8`.
```html
<table class="qa-table">
  <tr class="header"><th>คำถาม</th><th>คำตอบ</th></tr>
  {{rows from qa_matrix}}
</table>
```

### demo.html — Screenshots / Demo Flow
If screenshots_available=true: gallery grid of `<img>` tags with captions from doc_manual role names
If screenshots_available=false: placeholder divs styled as mockup frames:
```html
<div class="screenshot-placeholder">
  <div class="placeholder-frame">
    <span>[ ภาพหน้าจอ — รัน doc_builder เพื่อเพิ่มรูปจริง ]</span>
  </div>
  <p class="caption">{{feature_name}}</p>
</div>
```

---

## Integration with doc_builder

When doc_builder §6 `--with-story` flag is set:
1. doc_builder completes → writes `public/doc/manual/`
2. Auto-triggers project_presenter with `screenshots_available=true`
3. Pass `target_project_path` + `doc_manual_path` to project_presenter entry

Manual trigger (standalone):
```
skill: project_presenter
target: /path/to/project
```
