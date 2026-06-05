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

## CFP-002 · Walkthrough Artifact Path Error
- **Symptom:** เมื่ออ้างอิงพาธของ walkthrough.md หรือเอกสารสรุปผลงานในระบบ, พาธถูกระบุเป็นพาธของ Windows ปกติ ทำให้ระบบการอ่านย้อนกลับและลิงก์ของผู้ใช้งานทำงานผิดพลาด
- **Root Cause:** เอเจนต์ไม่ได้เขียนพาธตามรูปแบบ Absolute URI ด้วยโปรโตคอล `file:///` พร้อมสัญลักษณ์ forward slash (`/`) แต่กลับเขียนเป็น Windows path สัญลักษณ์ backslash (`\`) หรือสัมพัทธ์
- **Wrong approach:** ระบุพาธตรงๆ เช่น `d:\Labor Management System\walkthrough.md` หรือใช้ backslash ทั่วไป
- **Resolution:** กำหนดให้การอ้างอิงพาธของเอกสาร walkthrough หรือไฟล์ระบบใดๆ ต้องเขียนตามสคีมา `file:///absolute/path/to/file` และใช้ forward slash (`/`) ทั้งหมดเสมอ
- **Files affected:** `docs/master_roadmap.md`, `walkthrough.md`
- **Task:** T-012-009-10 · Session: session_010_dashboard_styling

