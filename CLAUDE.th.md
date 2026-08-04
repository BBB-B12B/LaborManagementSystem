# CLAUDE.th.md — คู่มือสำหรับ User (Asset Plan)

> ไฟล์นี้เป็นเวอร์ชันภาษาไทยสำหรับ user อ่านทำความเข้าใจเท่านั้น
> **Claude ใช้ CLAUDE.md (English) เป็นต้นฉบับเสมอ** — ถ้า R-number ขัดแย้งกัน CLAUDE.md ชนะ
> ⚠️ R-numbers ที่แสดงด้านล่างตรงกับ CLAUDE.md ทุก rule (R1–R18)

---

## ทำไมถึงมี Rules เหล่านี้?

CLAUDE.md ควบคุมพฤติกรรมของ Claude ใน Asset Plan โดยเฉพาะ

---

## Boot Sequence
ทุก session Claude จะ:
1. อ่าน `.sessions/active_thread.md` → ถ้า `phase: in_progress` ต่องานเก่าทันที
2. อ่าน `skill-manifest.json` → match intent → identify skill path → โหลด SKILL.md
3. แจ้งสถานะ `[Boot]` บรรทัดแรกก่อนทำงาน

---

## Loop Architecture — 3 Phases
งานทุกชิ้นผ่าน 3 เฟส:

| เฟส | ชื่อ | สิ่งที่ทำ |
|---|---|---|
| 1 | Info Gather | ค้นหาบริบทผ่าน index ก่อนอ่านไฟล์จริง |
| 2 | MECE Plan | สร้างแผน → เขียน `.sessions/mece_plan.md` → รอ user confirm |
| 3 | Execution | REACT LOOP ตามขั้นตอนด้านล่าง |

**Phase 3 REACT LOOP (ทำซ้ำต่อ section):**
0. **MARK START** → อัปเดต `mece_plan.md`: section นี้ `[ ]` → `[/]` ก่อน tool call แรก
1. TOKEN CHECK: SESSION > 60k? → หยุดชั่วคราว ถามผู้ใช้
2. SELECT tool สำหรับ step ปัจจุบัน
3. EXECUTE → รัน tool
4. OBSERVE → ผลไม่ตรง? → diagnose → retry 1× → ยังผิด → BLOCKED
5. VERIFY → รัน Verify-N ของ section → ผ่าน? emit `[✓ written]` → section eligible for done
6. DECIDE → มี step เพิ่ม? → [loop] ต่อ · section เสร็จ → อัปเดต `mece_plan.md`: `[/]` → `[X]` → emit [loop] done

**สถานะ section ใน mece_plan.md:**
- `- [ ]` ยังไม่เริ่ม
- `- [/]` กำลังทำอยู่
- `- [X]` เสร็จแล้ว

> ดูรายละเอียดเต็มใน CLAUDE.md §Phase 3 REACT LOOP (authoritative)

---

## R1 · Token Tracking
ตัวนับ 2 ตัว: `SESSION_TOTAL` (ต่อ-งาน) · `CHAT_TOTAL` (หน้าต่าง context). **รีเซ็ต SESSION_TOTAL เป็น 0 เฉพาะเมื่อ: (1) ผู้ใช้ยืนยัน /compact ที่ mece compact-checkpoint (PATH B), หรือ (2) งานเสร็จ + ปิด session (PATH A/C). ห้ามรีเซ็ตจาก compact_state.md ค้าง หรือ boot กลางงาน** (CFP-031). CHAT_TOTAL รีเซ็ตเมื่อ /compact เท่านั้น.
- PostToolUse hook (`scripts/posttool_track.py`) สะสม SESSION_TOTAL + CHAT_TOTAL ให้อัตโนมัติทุก tool call — **agent ไม่เขียนเอง/ไม่แต่งตัวเลข** (เป็น lower bound — นับเฉพาะ tool I/O · ของจริง ≈1.5–2× · เชื่อมิเตอร์ของแอปสำหรับ ceiling/compact)
- Footer ทุกเทิร์น: `*(Turn: N · Loop_W: N | Session: ~NNNk | Chat: ~NNNk tokens)*` · ใช้ค่า [token-state] ตรง ๆ · ค่าเป็น snapshot ต้น-เทิร์น (ช้า ≤1 เทิร์น) — ต้องการค่าสด → grep `.sessions/session_tokens.md`
- รายละเอียดเต็ม (สูตร · hook · spike · reset): **Implement/03_config.md §Token Tracking**

## R2 · Tool Budget
จำกัด 5 tool calls ต่อ 1 response — retry สูงสุด 2 ครั้ง แล้ว diagnose

## R3 · Session Pause
| SESSION_TOTAL | สิ่งที่เกิดขึ้น |
|---|---|
| >60k | TOKEN PAUSE → load `token_auditor` → บันทึก state → แจ้ง user |
| >90k | HALT ทันที → บันทึก state → รายงาน user |

## R4 · Sub-agent Decision
ก่อนเริ่ม task ทุกครั้ง Claude รัน 1 Bash scope probe:
- < 5 files / < 300 lines → ทำใน main context ปกติ
- ≥ 5 files / ≥ 300 lines → spawn Explore sub-agent → รับ summary ≤500 tokens

> ⚠️ Sub-agent ต้องรับ R1–R13 constraints ใน prompt — ไม่โหลด CLAUDE.md อัตโนมัติ

## R5 · Index-First Lookup (สำคัญมาก)
ลำดับบังคับก่อนแก้ไขไฟล์ใดๆ:
1. T1: grep `knowledge/index_variables.json` หา symbol → ได้ line number
2. T2: grep เพิ่ม context ถ้า T1 ไม่พอ
3. T3: `Read offset=<line> limit=60` — **ห้าม Read ไฟล์ทั้งหมดโดยไม่มี offset/limit**

## R6 · Output Filter
ทุก Bash command ต้องผ่าน: `cmd 2>&1 | grep -iE "error|warn|fail" | tail -20`

## R7 · Response Density
Claude ตอบ table/bullet แทน prose — ประหยัด token ~40%

## R8 · Index Sync
ทุกครั้งที่สร้าง/ลบ/ย้ายไฟล์หรือ symbol → อัปเดต `knowledge/` indexes ทันที
รัน `python scripts/symbol_indexer.py` หลังเปลี่ยน symbol

## R9 · Error Protocol
ก่อน debug ทุกครั้ง → ค้น `knowledge/error_index.md` **3 ขั้น** ก่อนเสมอ:
1. grep symptom ใน error_index.md
2. grep symbol ใน index_variables.json
3. grep file ใน index_files.json

ถ้า error ใหม่ → เพิ่ม roadmap task → fix → กำหนด ERR-XXX code → เขียน index

## R10 · Tool Result Cap
ตัด output ที่ยาวเกิน 300 บรรทัด — ถ้า >300 ให้ grep เฉพาะส่วนที่เกี่ยวข้อง

## R11 · English-first Analysis
งาน reasoning ซับซ้อน >5 ขั้นตอน → Claude เขียน outline English ก่อน → สรุปไทยให้ user

## R12 · Post-Edit Verification
ทุก write ต้องมีการ verify ก่อนรายงาน success — grep confirm ใน file จริง

## R13 · Escalation
ถ้า step fail ครบ 2 ครั้ง → STOP → emit `[blocked]` → รอ user — **ห้าม auto-retry**

---

## R14–R18 · Gates (ดูรายละเอียดใน INVARIANTS.md)
| Rule | Gate ที่ trigger | ไฟล์อ้างอิง |
|---|---|---|
| R14 | Destructive Action Gate — I1 | INVARIANTS.md |
| R15 | DB Structure Hard Stop — I2 | INVARIANTS.md |
| R16 | Index Sync Gate — I3 | INVARIANTS.md |
| R17 | Symbol Check Gate — I4 | INVARIANTS.md |
| R18 | Roadmap Gate — I5 | INVARIANTS.md |

---

## Knowledge Base Files
| ไฟล์ | ใช้ทำอะไร |
|------|----------|
| `knowledge/index_files.json` | backlinks ทุกไฟล์ในโปรเจกต์ |
| `knowledge/index_variables.json` | symbols + บรรทัดที่อยู่ |
| `knowledge/error_index.md` | ERR codes ที่เคยเจอ |
| `docs/master_roadmap.md` | task checklist |
| `.agents/skills/registry.md` | skill routing |
| `.sessions/session_*.json` | state ของแต่ละ session |
