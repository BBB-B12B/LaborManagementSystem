# Harness Editor — Detail Reference

## BC Selection Guide Detail

### Decision Tree — ถามตามลำดับ หยุดเมื่อตรง

```
Q1: Shell hook บล็อกได้โดยไม่ต้องรู้ context ของ AI?
    YES → HOOK   (ไม่ต้องถาม Q2-Q4)

Q2: มีครบ: Pre-condition + ≥2 branches + Post-assertion + close sequence?
    YES → BC     (ไม่ต้องถาม Q3-Q4)

Q3: เงื่อนไขเดียว → action เดียว (emit หรือ halt)?
    YES → Signal Contract

Q4: ใส่เป็น note/bullet ได้ ไม่ต้อง gate?
    YES → CONV
```

---

### Per-Tier: ใช้เมื่อ / ❌ ไม่ใช้เมื่อ

#### HOOK (PreToolUse / PostToolUse shell)
**ใช้เมื่อ:**
- อ่าน/เขียน file ต้องถูกบล็อก *ก่อน* AI เห็น content
- Rule ที่ AI ลืมบ่อยภายใต้ context pressure (เช่น Never-Full-Load)
- ตรวจสอบได้ด้วย filesystem/process state เท่านั้น (ไม่ต้อง reasoning)
- LOOP_WEIGHT threshold — ค่าตัวเลขล้วน

**❌ ไม่ใช้เมื่อ:**
- ต้องวิเคราะห์ content ของไฟล์ (→ ใช้ BC + Signal Contract)
- Logic ขึ้นอยู่กับ state ใน working memory ของ AI

#### BC (Pre/Contract/Post/Enforce)
**ใช้เมื่อ — ต้องครบทุกข้อ:**
1. Pre: มี precondition state ที่ต้องยืนยันก่อน
2. Contract: มี ≥2 branches (found vs not-found, pass vs fail)
3. Post: state ต้องเป็นอย่างไรหลังจากทำ (assertion)
4. Enforce: มีวิธีตรวจจับว่า skip (CFP-N, [violation] signal)
5. (optional) ต้องมี close sequence ที่ verifiable

**❌ ไม่ใช้เมื่อ:**
- เงื่อนไขเดียว ไม่มี Post assertion → ใช้ Signal Contract
- ไม่มี Enforce path → ใช้ Signal Contract หรือ CONV

#### Signal Contract (`→ if X: emit [Y] · skip = CFP-N`)
**ใช้เมื่อ:**
- 1 condition → 1 action (emit signal หรือ halt)
- ใส่ใน 1-2 บรรทัดได้
- ไม่มี branching, ไม่ต้อง Post assertion
- เป็น "seam gate" — จุดต่อระหว่าง step ที่ต้องมี signal

**❌ ไม่ใช้เมื่อ:**
- มี ≥2 branches ที่ต่างกัน → ต้องเป็น BC
- มี irreversible action → ต้องเป็น BC (Destructive/DB Gate)

#### CONV (inline note/bullet)
**ใช้เมื่อ:**
- Style, format, naming convention
- Reminder ที่ไม่มีผลต่อ correctness ถ้าลืม

**❌ ไม่ใช้เมื่อ:**
- เขียนว่า "MUST" หรือ "required" → ต้องเป็น Signal Contract ขึ้นไป

---

### ตัวอย่างจริงในระบบ

| Rule | Tier | เหตุผล |
|---|---|---|
| Never-Full-Load prohibited Read | **HOOK** | Shell บล็อก Read ก่อน AI เห็น — ไม่ต้อง context |
| gather_complete.md date check ก่อน Edit/Write | **HOOK** | Filesystem check — AI ลืมบ่อย |
| LOOP_WEIGHT threshold reset | **HOOK** | ค่าตัวเลข — shell อ่านได้โดยตรง |
| Boot Gate | **BC** | Pre(session-state) + 3 branches(compact-restore/in_progress/fresh) + Post(tokens-init) + Enforce |
| Destructive Gate / DB Gate | **BC** | Irreversible + explicit confirm + Post verified |
| Doctor Flow (BC-A→BC-E) | **BC** | Multi-step + count threshold branching + close sequence |
| Completion Gate | **BC** | close-gate-check + PATH A/B/C + Post(all criteria) |
| Phase Transition Gate | **BC** | Pre(2 files) + branches(proceed/STOP) + Post(both verified today) + Enforce |
| C3 topic-switch | **Signal Contract** | if C2 detects → emit [topic-switch] → /compact · 1 seam, no Post |
| R5 pre-read / post-read | **Signal Contract** | before/after Read → emit [pre-read]/[post-read] · 1 condition each |
| M5 write-before-present | **Signal Contract** | → at M5: Write files THEN present · 1 seam |
| R12 post-edit verify | **Signal Contract** | after Edit/Write → re-read section · 1 condition → 1 action |
| R8 index sync | **Signal Contract** | after file change → update indexes · emit [r8-sync-check] |
| Thai user replies only | **CONV** | Style — ไม่มี enforcement consequence |
| Prefer grep over Read >80L | **CONV** | Style/performance guideline |

---

### Anti-patterns

| ❌ ผิด | ✅ ถูก | ผลที่ตามมา |
|---|---|---|
| ใส่ Pre/Contract/Post/Enforce กับ 1-branch gate | ใช้ Signal Contract | ขนาด 10L → 1L · อ่านง่ายกว่า (ดู C0.5 T-093) |
| ใช้ Signal Contract กับ irreversible action | ใช้ BC | ไม่มี Post assertion → ตรวจไม่ได้ว่า complete |
| เขียน CONV แล้วใส่คำว่า "MUST" | ใช้ Signal Contract | MUST โดยไม่มี CFP-N = ไม่มี enforcement |
| เพิ่ม BC ที่ 7 โดยไม่แปลง BC เดิม | Convert BC เก่า → Signal Contract ก่อน | Hard limit violation |
| HOOK กับ logic ที่ต้อง read content ไฟล์ | ใช้ BC | Shell hook ไม่มี AI reasoning |
| Signal Contract ที่มี 2 ผลลัพธ์ต่างกัน | แยกเป็น BC | `→ if X: emit [Y] else write Z` = BC แล้ว |

---

### Trigger Keywords สำหรับ harness_editor

เมื่อ user พูดถึง:
- "เพิ่ม rule" / "แก้ rule" / "เพิ่ม enforcement"
- "เพิ่ม BC" / "แก้ BC" / "ลด BC" / "convert BC"
- "hook" / "PreToolUse" / "PostToolUse"
- "signal contract" / "seam gate"
- "เลือก tier" / "ใช้ BC หรือ hook"
- "SKILL.md" / "CLAUDE.md" / "AGENTS.md" edit

→ Activate harness_editor skill ทันที

---

## Stage 3.5 — Behavioral Verify (detail)

Goal: after a harness edit, empirically confirm a fresh model *obeys* the rule — not just that the text landed.

1. **Trigger gate** — run ONLY on behavioural edits: BC / gate / signal-contract / step-sequence. Typo / doc / format / table-only edit → emit `[behave-skip]` and go to Stage 4 (zero overhead). Behavioural edit → emit `[behave-test]` to open the run, then proceed to step 2.
2. **Test-spec derivation** — a BC is already a test spec: `Pre:` clause → the trigger prompt (the situation that should fire the rule); `Post:`/required signal → the expected output to grep for. No separate test format is invented.
3. **3-config ladder (sequential · early-exit)** — spawn sub-agents (Agent tool) on the SAME trigger prompt under **isolation** (each reads ONLY the edited file + the trigger prompt — never the author's intent or this plan), cheapest-first, stopping at the first PASS:
   - ① **Haiku** — the robustness floor (AGENTS.md: every SKILL must be followable by a medium-tier model without inference).
   - ② **Sonnet@medium** — production model, direct answer.
   - ③ **Sonnet@high** — production model, deep reasoning.
   ⚠️ The Agent tool exposes `model` but has **no effort param** → effort is set via spawn-prompt framing: medium = prompt ends "answer directly"; high = prompt ends "reason step-by-step before answering". Record the exact framing in the run log for reproducibility.
4. **Scoring (signal-grep)** — grep each sub-agent's returned output for the expected `Post:`/signal string. Present = PASS, absent = FAIL. Deterministic; no LLM judge in v1.
5. **Verdict routing (early-exit)** —
   - Haiku PASS → `[behave-pass]` → proceed to Stage 4 (do not spawn Sonnet — early-exit).
   - Haiku FAIL, Sonnet@medium PASS → `[behave-gap]` (rule too subtle for the floor — rewrite for clarity) → loop Stage 5.
   - only Sonnet@high PASS → `[behave-gap]` `effort:high` (rule is clear but needs deep reasoning — acceptable, but flag) → loop Stage 5.
   - all 3 FAIL → `[behave-fail]` (rule not landing at all) → loop Stage 5.
6. **k=3 sample** — single sample by default. For DB gates (R15) and boot-sequence edits, run k=3 per config and require unanimous PASS (these are high-blast-radius; one lucky pass is not enough).
7. **Log** — append one JSON line per run to `knowledge/behave_test_log.jsonl`: this is both the feedback capture and the future regression suite (replay past trigger prompts after later edits).
