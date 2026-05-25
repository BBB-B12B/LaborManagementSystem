# Master Project Roadmap: LaborManagementSystem

> **📌 CURRENT ACTIVE FOCUS:** Phase 1 - Project Initialization & Architecture Setup
> **📊 OVERALL PROGRESS:** 100% (Phase 1 Setup)

---

## 📚 System Documentation (Governance)
- `docs/master_roadmap.md`: แผนงานหลัก (อัปเดตตลอด)
- `docs/domain_rules.md`: กฎและ Business Logic ที่ตายตัว
- `knowledge/error_index.md`: แหล่งรวมความรู้สำหรับแก้ Bug และ Error

---

## 🖥️ Phase 1: Project Foundation

### Feature 1.1: Core Setup
- [X] T-000: ติดตั้งระบบ Agent และโครงสร้างพื้นฐาน

---

## 🖥️ Phase 2: Reconciliation & Data Integrity

### Feature 2.1: Assignee Name Resolution
- [X] T-001: จัดการข้อมูลในระบบ Reconciliation (→ ERR-001) · attempts: 1 · tool_calls: 31
- [X] T-001-001-01: แก้ไขปัญหา assigneeName เป็น null เนื่องจากฟังก์ชัน generateForEmployee ตรวจสอบชื่อไม่ครอบคลุม (→ ERR-001) · attempts: 1 · tool_calls: 31
- [X] T-001-001-02: แก้ไข case-sensitivity ของฟิลด์คิวรีผู้ใช้และรัน backfill ข้อมูลเก่าที่มีค่าเป็น null (→ ERR-002) · attempts: 1 · tool_calls: 16
- [X] T-001-001-03: แก้ไขปัญหา assigneeName ของพนักงานรหัส 411435 เป็น null ใน Cloud Functions (→ ERR-003) · attempts: 1 · tool_calls: 14
- [X] T-001-001-04: แก้ไขการแสดงรูปภาพของ Daily Report ในช่วงเวลาลางาน (Leave) บน Modal รายละเอียด (→ ERR-004) · attempts: 1 · tool_calls: 23
- [X] T-001-001-05: แก้ไขการแสดงช่วงเวลาทำงานและลางานครึ่งวัน/ไม่เต็มวันใน Modal รายละเอียด (→ ERR-005) · attempts: 1 · tool_calls: 18
- [X] T-001-002-01: เพิ่มการบันทึก workLogs (subtaskName, taskName) จาก After-Sale ใน reconciliationRecords ทั้ง Cloud Functions และ Backend Service · attempts: 1
- [X] T-002: ยุบปุ่มและปรับปรุงระบบ Export รายงานแบบ Multi-sheet (v2+C+D) · session_008


---

### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
