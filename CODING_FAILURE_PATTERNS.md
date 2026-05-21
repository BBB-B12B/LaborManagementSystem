# Coding Failure Patterns

> Agent adds an entry here whenever a fix requires ≥2 attempts. Search this file before attempting any similar fix.

---

<!-- Entry format:
## CFP-NNN · [Short title]
- **Symptom:** What the error looks like / what went wrong
- **Root Cause:** Why it happens (the real reason, not the surface error)
- **Wrong approach:** What was tried first (and why it failed)
- **Resolution:** The correct fix
- **Files affected:** src/path/to/file.ts
- **Task:** T-NNN-NNN · Session: session_NNN
-->

## CFP-001 · Session Manager Manual Close Failure
- **Symptom:** เมื่อสั่งปิดเซสชัน เอเจนต์ไม่ได้สร้างไฟล์ Session JSON, ไม่ได้จัดรูปแบบไฟล์ `session_handoff.md` ให้เป็นไปตามสคีมา และไม่ได้ทำการ Archive/ล้างหัวข้อแผนงานหลักใน `mece_plan.md`
- **Root Cause:** เอเจนต์ไม่ได้ทำตามขั้นตอนบังคับทั้ง 6 ขั้นตอนของกระบวนการ Manual Close ที่ระบุไว้ใน `.agents/skills/session_manager/SKILL.md` และเลือกตอบยืนยันการปิดงานอย่างย่อเท่านั้น
- **Wrong approach:** เขียนเพียงข้อความตอบกลับธรรมดาและอัปเดตไฟล์แบบไม่สมบูรณ์ โดยข้ามการสร้างไฟล์ข้อมูลจำลองเซสชัน `.sessions/session_*.json`, ไฟล์ Handoff และกระบวนการล้างแผนการทำงาน
- **Resolution:** ดำเนินการตาม 6 ขั้นตอนบังคับอย่างเคร่งครัดตามข้อกำหนด Manual Close (Self-Eval R19, บันทึกสถานะ Session JSON เป็น completed, รีเซ็ตโทเค็น, บันทึก active_thread, บันทึก handoff และย้ายแผนงานลงคลัง Archive พร้อมเคลียร์ Sections ใน mece_plan.md)
- **Files affected:** `.sessions/session_*.json`, `.sessions/session_handoff.md`, `.sessions/mece_plan.md`
- **Task:** T-003 · Session: session_001_labor_popups

