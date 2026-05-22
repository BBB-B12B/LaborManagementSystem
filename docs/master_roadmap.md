# Master Project Roadmap: Labor Management System

> **📌 CURRENT ACTIVE FOCUS:** Phase 1 - Project Initialization & Architecture Setup
> **📊 OVERALL PROGRESS:** 0%

---

## 📚 System Documentation (Governance)
- `docs/master_roadmap.md`: แผนงานหลัก (อัปเดตตลอด)
- `docs/domain_rules.md`: กฎและ Business Logic ที่ตายตัว
- `knowledge/error_index.md`: แหล่งรวมความรู้สำหรับแก้ Bug และ Error

---

## 🖥️ Phase 1: Project Foundation

### Feature 1.1: Core Setup
- [X] T-000: ติดตั้งระบบ Agent และโครงสร้างพื้นฐาน
- [X] T-001: แสดงผู้บันทึกรายงานการทำงานในหน้าต่างแก้ไขเวลาทำงาน (Backlog/History Popup) · attempts: 1 · tool_calls: 15
- [X] T-002: แสดงชื่อ FM ที่ใช้งานก่อนหน้าเมื่อไม่มีข้อมูลการ์ดงาน (ขาดงาน) · attempts: 1 · tool_calls: 12
- [X] T-003: เพิ่มการแสดงวันที่ใช้งานล่าสุดในหัวการ์ดขาดงาน · attempts: 1 · tool_calls: 11
- [X] T-004: แสดงจำนวนพนักงานที่เลือกข้างข้อความรายชื่อพนักงานในหน้าต่างเลือกแรงงาน DC · attempts: 1 · tool_calls: 30
- [X] T-005: ป้องกันการลงเวลาซ้ำซ้อนของแรงงาน DC (Time Overlap Validation) · attempts: 2 · tool_calls: 11
- [X] T-006: แสดงข้อความ Error จาก Backend เป็นภาษาไทยในหน้าต่าง Popup บันทึก Daily Report · attempts: 1 · tool_calls: 3
- [X] T-007: ผสานอัปเดตโฟลเดอร์ Codeing_harness_killer จากระบบ Harness ต้นน้ำ (GitHub) · attempts: 1 · tool_calls: 34
- [X] T-008: เพิ่ม Dropdown เลือกการ์ดงานใน popup ขาดงาน และกรองรายการงานให้ตรงกับหน้า Daily Report · attempts: 1 · tool_calls: 15
- [X] T-008-001-01: ไม่สามารถเปิด Popup แก้ไขเวลาทำงานของวันที่ 17 ได้ (→ ERR-002) · attempts: 2 · tool_calls: 44
- [X] T-001-001-01: แสดงผู้บันทึกและวันที่บันทึกใน popup ปกติ/ลา (เหมือนกรณีขาดงาน) (→ ERR-003) · attempts: 1 · tool_calls: 38
- [X] T-001-001-02: ปรับปรุงการแสดงวันที่และผู้บันทึกให้คำนวณย้อนหลังจากวันที่เลือก (ไม่นำวันที่ในอนาคตมาแสดง) (→ ERR-004) · attempts: 1 · tool_calls: 42
- [X] T-001-001-03: ปรับปรุงค่าเริ่มต้นของเวลาโอทีเย็นเป็น 18:00-21:00 และปรับให้แสดงเวลาเริ่มต้นเมื่อคลิก Checkbox ใน Popup (→ ERR-005) · attempts: 1 · tool_calls: 34
- [X] T-001-001-04: แก้ไข Error 500 เมื่อบันทึกเวลาทำงานย้อนหลังใน Backlog (→ ERR-006) · attempts: 1 · tool_calls: 61
- [X] T-001-001-05: ปรับปรุงช่องกรองวันที่ให้เล็กลง ชิดขวา และเพิ่มช่องกรองรายชื่อแรงงาน (Autocomplete) · attempts: 1 · tool_calls: 12
- [X] T-001-001-06: ปรับปรุงระบบจัดการ API Cache และหน้าจอดาวน์โหลด Spinner (Workspace, Daily Report, Backlog) · attempts: 1 · tool_calls: 38
- [X] T-001-001-08: แก้ไข Error Maximum update depth exceeded ที่หน้า workspace/index.tsx (→ ERR-007) · attempts: 1 · tool_calls: 5
- [/] T-009: บันทึกรูปภาพจาก Site FM แนบใน Help Daily Report เมื่อมีการเปิดงาน Support
- [X] T-010: ปรับปรุง UI หน้าต่างสร้างรายงาน งานย่อย (Subtasks) เป็น 1 แถวต่อ 1 งาน และซ่อน Scrollbar · attempts: 1 · tool_calls: 10

---



### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
