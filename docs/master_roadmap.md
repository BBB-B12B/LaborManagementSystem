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
- [X] T-001-001-10: แก้ไขปัญหา Spinner ซ้อน และยุบรวมคอมโพเนนต์ดาวน์โหลดช่วงเปลี่ยนผ่านหน้าจอ (→ ERR-085) · attempts: 1 · tool_calls: 54
- [/] T-009: บันทึกรูปภาพจาก Site FM แนบใน Help Daily Report เมื่อมีการเปิดงาน Support
- [X] T-010: ปรับปรุง UI หน้าต่างสร้างรายงาน งานย่อย (Subtasks) เป็น 1 แถวต่อ 1 งาน และซ่อน Scrollbar · attempts: 1 · tool_calls: 10
- [X] T-011: แสดงรายการ Subtasks ใน Workspace ก่อนดู Daily Report Log · attempts: 1 · tool_calls: 8
- [X] T-011-001-01: แก้ไข RangeError: Invalid time value ในหน้า Daily Report Sidebar (→ ERR-008) · attempts: 1 · tool_calls: 15
- [X] T-011-001-02: แก้ไข RangeError: Invalid time value ใน CustomPickersDay ปฏิทิน Daily Report (→ ERR-009) · attempts: 1 · tool_calls: 14
- [X] T-011-001-03: แก้ไขบักจุดแสดงสถานะสีปฏิทินและ Progress งานย่อย (Subtasks) FM แสดงผลไม่ถูกต้อง (→ ERR-010) · attempts: 1 · tool_calls: 12
- [X] T-011-001-04: แก้ไข Logic การ Enforce leaveType ในหลังบ้าน submitDailyReport ให้ทำงานกับ finalReportData (→ ERR-011) · attempts: 1 · tool_calls: 36
- [X] T-011-003-01: ปรับปรุงหน้าต่างรายงานให้แสดงข้อมูลของวันที่มีรายงานล่าสุดแทนหน้าว่างเปล่าเมื่อยังไม่มีการลงรายงานในวันปัจจุบัน (→ ERR-086) · attempts: 1 · tool_calls: 68
- [X] T-011-002-01: ปรับปรุงหน้าประวัติย้อนหลัง (Backlog) และระบบปลดล็อกให้รองรับโครงสร้าง Subtasks (→ ERR-012) · attempts: 1 · tool_calls: 12
- [X] T-012: ตารางกำลังพลและแผนงาน (Labor & Plans Table Workspace) สำหรับหัวหน้างาน · attempts: 1
- [X] T-012-001-01: นำปุ่มส่งออกและล็อกแผนงานที่เลือกพร้อม checkbox/ตัวแปรที่ผูกออกเพื่อให้เป็นนอกระบบ · attempts: 1 · tool_calls: 4
- [X] T-012-001-02: ปรับปรุง Filter โครงการเริ่มต้น เลือกโครงการที่รับผิดชอบ และเพิ่ม AutoComplete ผู้รายงาน (FM) กับชื่องาน (Task Name) · attempts: 1 · tool_calls: 3
- [X] T-012-001-03: ปรับปรุง Filter ช่วงวันที่เริ่มต้นและสิ้นสุด ให้แสดงค่าเริ่มต้นเป็นวันปัจจุบันเพื่อตอบรับการใช้งานของหัวหน้างาน · attempts: 1 · tool_calls: 2
- [X] T-012-001-04: ปรับปรุง Filter ผู้รายงาน (FM) และชื่องาน (Task Name) ให้เป็น Dropdown Autocomplete แบบ Multi-select พร้อมแสดง Checkbox · attempts: 1 · tool_calls: 2
- [X] T-012-001-05: ปรับปรุงโครงสร้างตัวกรองให้มีขนาดเล็กกะทัดรัด (Single Row, Size Small) ย้ายปุ่มสลับประเภทข้อมูลไปใต้ปุ่ม Export และจัดแต่งรูปแบบ iOS Segment Control · attempts: 1 · tool_calls: 2
- [X] T-012-002-01: แก้ไขปุ่ม "+ Newtasks" หายไปในหน้า Workspace บนอุปกรณ์มือถือ (→ ERR-013) · attempts: 1 · tool_calls: 2
- [X] T-012-002-02: ปรับแต่งสีปุ่มสลับประเภทข้อมูลแผนงาน/รายงาน (dataType capsule) ให้เป็นสีขาวและข้อความสีขาวบนพื้นหลังเข้ม (→ ERR-014) · attempts: 1 · tool_calls: 2
- [X] T-012-003-01: กรองงานในระบบเฉพาะที่มี workOrderCode เป็น 'WOA' หรือ 'WOP' (งานของ After-Sale) (→ ERR-015) · attempts: 1 · tool_calls: 5
- [X] T-012-003-02: แก้ไขปัญหา Docker build ของ frontend ติด peer dependencies conflict ด้วย --legacy-peer-deps (→ ERR-016) · attempts: 1 · tool_calls: 3
- [X] T-012-003-03: ปรับปรุงเงื่อนไขการกรองงาน กรองงานที่มี workOrderCode เป็น 'WOA' หรือ 'WOP' ออกจากระบบ (แทนการเก็บไว้) (→ ERR-015) · attempts: 1 · tool_calls: 5
- [X] T-013: ตอบคำถามระบบ After-sale และอธิบายความแตกต่างเชิงโครงสร้าง (Q&A) · attempts: 1 · tool_calls: 14
- [X] T-012-004-01: ปรับปรุง Popup แสดงงาน Subtasks ให้คล้ายรูปที่ 2 และเปลี่ยนจาก duedate เป็นชื่อ FM ที่รับผิดชอบ (→ ERR-017) · attempts: 1 · tool_calls: 3
- [X] T-012-004-02: ปรับปรุงส่วนแสดงผู้รับผิดชอบที่การ์ด Task หลัก โดยแสดงเฉพาะกลุ่ม Icon แบบซ้อนกัน และแสดงชื่อผ่าน Tooltip (→ ERR-018) · attempts: 1 · tool_calls: 3
- [X] T-012-005-01: ปรับปรุงโครงสร้างหน้า Workspace แสดงการ์ดเป็นราย Subtask และเพิ่มหน้าต่าง Structure Tree ด้านซ้ายพร้อมระบบแคช
- [X] T-012-006-01: แก้ไข UI/Logic Checkbox และปรับระบบรับงานช่วยเหลือเป็นระดับงานย่อย (Subtask) (→ ERR-019) · attempts: 2 · tool_calls: 7
- [X] T-012-006-02: แก้ไขบั๊ก Subtask ที่ไม่ได้ติ๊กขอความช่วยเหลือแสดงผลเป็นงาน Support (→ ERR-020) · attempts: 1 · tool_calls: 3
- [X] T-012-006-03: ปรับปรุง Layout และลดรูปฟอร์มระดับงานย่อย (Support Pickup Layout) ใน TaskCreateModal (→ ERR-021) · attempts: 1 · tool_calls: 5
- [X] T-012-006-04: เพิ่ม Checkbox ขอความช่วยเหลือในหน้าต่างแก้ไขงานย่อย และแสดงงานในดรอปดาวน์ช่วยเหลือทีม Support · attempts: 1 · tool_calls: 14
- [X] T-012-006-05: แก้ไขบั๊กข้อมูลการ์ดงาน Support และข้อมูล Daily Report ของ Support FM ไม่ถูกรีเซ็ตเมื่อโดน Reject · attempts: 1 · tool_calls: 5
- [X] T-012-007-01: ปรับแก้ UI Kanban Board (ลดขนาดการ์ด, เอา scrollbar ออก, ลดขนาด Font ให้เท่ากับ Structure Tree, จัด Layout ป้องกันการ์ดหลุดจอ) (→ ERR-022) · attempts: 1 · tool_calls: 36
- [X] T-012-008-01: ปรับปรุง Structure Tree (เพิ่มโฟลเดอร์ WorkOrder, แยกพื้นที่งาน Support, ใช้ฟิลด์ชื่อแสดงผล) และปรับปรุงระบบกรองสิทธิ์ดูงาน (→ ERR-023) · attempts: 1 · tool_calls: 10
- [X] T-012-008-02: แก้ไขบั๊กข้อมูลงานช่วยเหลือค้างรับ (Pending Support) และงานปกติโครงการอื่นหลุดไปแสดงสำหรับทีม Support (→ ERR-024) · attempts: 1 · tool_calls: 5
- [X] T-012-008-03: ปรับปรุงการซ่อน Structure Tree งานช่วยเหลือสำหรับผู้ใช้ที่ไม่ใช่ WH และนำงานขอ Support มาแสดงในงานหลัก (→ ERR-025) · attempts: 1 · tool_calls: 3
- [X] T-012-008-04: แก้ไขเงื่อนไขการ Bypass ตัวกรองสิทธิ์ของบทบาท AM ให้คัดกรองงานหากสังกัดแผนก WH (→ ERR-026) · attempts: 1 · tool_calls: 3
- [X] T-012-008-05: แก้ไขบั๊ก Logic การแสดงสถานะสีต่างๆ ในปฏิทิน Daily Report และจัดตำแหน่งจุดสถานะให้อยู่กึ่งกลางล่าง (→ ERR-027) · attempts: 1 · tool_calls: 42
- [X] T-012-008-06: แก้ไขบั๊กข้อมูลรายงานย่อยไม่โหลดเนื่องจาก subtask.id เป็น raw id (→ ERR-028) · attempts: 2 · tool_calls: 18
- [X] T-012-008-07: ปรับ Layout ปฏิทิน DatePicker ในหน้า Daily Report ให้อยู่ตรงกลาง (→ ERR-029) · attempts: 1 · tool_calls: 42
- [X] T-012-008-08: แก้ไขบั๊กการคำนวณวันล็อคย้อนหลังในปฏิทินหน้า Daily Report คลาดเคลื่อนไป 1 วัน (→ ERR-030) · attempts: 1 · tool_calls: 24
- [X] T-012-008-09: เพิ่ม Notification Badge แจ้งเตือนหัวหน้าใน TaskDailyReportModal เมื่อ FM ส่งคำขอปลดล็อคย้อนหลัง (→ ERR-031) · attempts: 1 · tool_calls: 24
- [X] T-012-008-10: แก้ไขบั๊กปุ่มปลดล็อคสิทธิ์และปฏิทินจุดสีม่วงไม่แสดงสำหรับระดับงานย่อย (Subtasks) (→ ERR-032) · attempts: 1 · tool_calls: 23
- [X] T-012-008-11: ปรับระยะขอบบน (padding-top) ของเนื้อหาในหน้าต่าง Daily Report Log เพื่อให้พ้นขอบหัวการ์ด (→ ERR-033) · attempts: 1 · tool_calls: 3
- [X] T-012-008-12: ปรับตำแหน่ง Grid container ในหน้าต่าง Daily Report Log โดยเพิ่ม mt: 1.5 เพื่อแก้ไขหัวตารางทับปุ่มปลดล็อค (→ ERR-034) · attempts: 1 · tool_calls: 3
- [X] T-012-008-13: แก้ไขข้อจำกัด Timestamp ใน API assigned-subtasks และ parse Date ในหน้า Daily Report เพื่อแก้ไขปัญหา FM ถูกล็อกแม้ได้รับสิทธิ์แล้ว (→ ERR-035) · attempts: 1 · tool_calls: 5
- [X] T-012-008-14: บันทึกประวัติการแก้ไข Subtask (editHistory) ในระดับ subtasks collection (→ ERR-036) · attempts: 1 · tool_calls: 3
- [X] T-012-008-15: เพิ่มการแสดงความคืบหน้า (Progress) และไอคอนรูปคนเช็คสถานะ Assign ที่ระดับ Task ในหน้าโครงสร้างงาน (Structure Tree) · attempts: 1 · tool_calls: 3
- [X] T-012-008-16: พัฒนาระบบเก็บข้อมูลและ API แจ้งเตือนการอัปเดตงานประจำวัน (Notification Backend) · attempts: 1 · tool_calls: 5
- [X] T-012-008-17: เพิ่มปุ่มกระดิ่งแจ้งเตือนพร้อม Popover แสดงรายการอัปเดตงานรายวันในส่วนหัวแถบเครื่องมือหลัก (Notification Bell UI) · attempts: 1 · tool_calls: 3
- [X] T-012-008-18: แสดงสถานะการอัปเดตรายงานด้วยจุดสีแดงกะพริบ (Pulsating Dot Indicator) บนการ์ด subtask และปิดสถานะเมื่อคลิกเปิดการ์ด · attempts: 1 · tool_calls: 10
- [X] T-012-008-19: แก้ไขบักการแจ้งเตือนรายงานของงาน Support ไม่แจ้งเตือนไปยังหัวหน้าทีม Support (WH) (→ ERR-038) · attempts: 1 · tool_calls: 11
- [X] T-012-008-20: เพิ่ม Flow นำทางผู้ใช้จากข้อความแจ้งเตือน Navbar ไปยังหน้าข้อมูลงานและเปิด Popup Daily Report อัตโนมัติ · attempts: 1 · tool_calls: 15
- [X] T-012-008-21: พัฒนาระบบแก้ไข/ลบการ์ดงานย่อย (Subtasks) และโครงสร้างงานหลัก (Tasks & WorkOrders) อย่างปลอดภัย · attempts: 1 · tool_calls: 10
- [X] T-012-008-21-02: แก้ไข Error 404 เมื่อลบ Category หรือ WorkOrder ที่ไม่มี Config Document ใน Firebase A (→ ERR-062) · attempts: 1 · tool_calls: 11
- [X] T-012-008-21-03: พัฒนาระบบแก้ไขชื่อของงานหลัก (Task) ใน Structure Tree และซิงค์แสดงผลแบบไดนามิก · attempts: 1 · tool_calls: 12
- [X] T-012-008-21-04: เพิ่มแทบสีแสดงสถานะ Due Date ในหน้าต่าง Structure Tree (สีน้ำเงิน/สีแดง) · attempts: 1 · tool_calls: 7
- [X] T-012-008-21-05: ปรับปรุงดีไซน์แทบเมนูด้านซ้ายและเปลี่ยนไฮไลท์ปุ่มใช้งานเป็นสีส้มพรีเมียม (#FF7F32) · attempts: 1 · tool_calls: 3
- [X] T-012-008-21-06: เพิ่มบทบาทหัวหน้ากลุ่มงาน (Leader) และกรอง Workspace ตาม Work Order ที่ได้รับมอบหมาย · attempts: 1 · tool_calls: 15
- [X] T-012-008-22: พัฒนาตัวกรองด้านบนให้สามารถกรอง Structure Tree ไปด้วยตามที่ผู้ใช้เลือก (→ ERR-060) · attempts: 1 · tool_calls: 20
- [X] T-012-008-23: ปรับปรุงแบบฟอร์มการสร้างงานย่อย (Subtask) ให้ไม่บังคับการเลือกผู้รับผิดชอบ (Optional Assignee) (→ ERR-061) · attempts: 1 · tool_calls: 15
- [X] T-014: จัดการวันครบกำหนด (Due Date) ในระดับ Subtask และคำนวณวันครบกำหนด of Task หลักอัตโนมัติ
- [X] T-014-001-01: เปลี่ยนคำอธิบายสี Due Date ให้แสดงผ่าน Tooltip บนปุ่ม Due Date ของการ์ดงาน · attempts: 1 · tool_calls: 5
- [X] T-015: ปรับปรุงสิทธิ์การเข้าถึงเมนูและหน้าต่าง ๆ ตามบทบาทผู้ใช้งาน (Page-level Route Protection) (→ ERR-037) · attempts: 1 · tool_calls: 15
- [X] T-012-009-01: ปรับปรุงตารางกำลังพลและแผนงาน (Labor & Plans Table UI, Dashboard & Subtask History Modal) · attempts: 1 · tool_calls: 12
- [X] T-016: ปรับปรุงโครงสร้างการสร้างงานในระบบ Model "Newtasks" ให้รองรับการแยกสร้าง งาน (Tasks) และ งานย่อย (Subtasks) · attempts: 1 · tool_calls: 31
- [X] T-016-001-01: แก้ไข React runtime error: Rendered fewer hooks than expected ใน TaskCreateModal.tsx (→ ERR-050) · attempts: 1 · tool_calls: 25
- [X] T-016-001-02: ซ่อนและปิดการตรวจสอบ Subtasks ในโหมดสร้างงานหลัก (Tasks) (→ ERR-051) · attempts: 1 · tool_calls: 29
- [X] T-016-001-03: ตัดแถววันครบกำหนด (Due Date) ออกจากป๊อปอัพยืนยันการสร้าง Task (→ ERR-052) · attempts: 1 · tool_calls: 10
- [X] T-016-001-04: ปรับปรุงสไตล์ปุ่มเพิ่มต่างๆ ให้สวยงามและพรีเมียมตามแบบรูปที่ 1 (→ ERR-053) · attempts: 1 · tool_calls: 24
- [X] T-016-001-05: ปรับปรุงความโค้งมนของช่องข้อมูลต่างๆ ให้สวยงามและเข้ากับดีไซน์ของปุ่ม (borderRadius: '12px') (→ ERR-054) · attempts: 1 · tool_calls: 13
- [X] T-016-001-06: ปรับปรุงสไตล์ช่องวันครบกำหนด (DatePicker) และช่องข้อมูลอื่นๆ ให้โค้งมนสวยงามเสมอกันและไม่มีขีดล่าง (→ ERR-055) · attempts: 1 · tool_calls: 15
- [X] T-016-001-07: แก้ไขเงื่อนไขการแสดงปุ่มลบงานย่อย (!item.subtaskId) เพื่อให้สามารถลบแถว Subtasks ในโหมดสร้างงานได้ (→ ERR-056) · attempts: 1 · tool_calls: 10
- [X] T-016-001-08: พัฒนาระบบปุ่มลบแถว Subtasks ในทุกโหมด และลบข้อมูลออกจากฐานข้อมูลอย่างถูกต้องเมื่อมีการแก้ไขบันทึก (→ ERR-057) · attempts: 1 · tool_calls: 15
- [X] T-016-001-09: ปรับปรุงโครงสร้างสวิตช์ปิด/เปิด และจัดวางฟิลด์ Due Date ในแถวเดียวกับชื่องานย่อยแบบการ์ดการกรอกข้อมูล (→ ERR-058) · attempts: 1 · tool_calls: 12
- [X] T-016-001-10: แสดงโครงสร้างงานกรณีไม่มี Subtask และปรับปรุงให้สามารถเลือกงานที่มีอยู่แล้วเมื่อติ๊กเพิ่มงานย่อย (→ ERR-059) · attempts: 1 · tool_calls: 61
- [X] T-016-001-11: ปรับปรุงโครงสร้างงานและฟังก์ชันมอบหมายงานย่อยด่วน (Quick Assign Subtask) · attempts: 1 · tool_calls: 18
- [X] T-012-009-06: เพิ่มฟังก์ชันตรวจสอบประวัติการบันทึก/แก้ไขย้อนหลังในการ์ด Subtask บนบอร์ด Workspace · attempts: 1 · tool_calls: 18
- [X] T-012-008-21-07: สิทธิ์การเข้าถึงเมนูและหน้า Workspace กับ Daily Report สำหรับบทบาท LD (Leader) · attempts: 1 · tool_calls: 18
- [X] T-012-008-21-08: ปรับปรุงการเลือกหัวหน้ากลุ่มงาน (Leader Selection) ให้สามารถระบุได้มากกว่า 1 คนและแก้ไขข้อความซ้อนทับ · attempts: 1 · tool_calls: 12
- [X] T-017: ระบบนำเข้าแผนงาน (WBS/Plan Excel Import) สำหรับบอร์ดโครงสร้างงาน · attempts: 1 · tool_calls: 14
- [X] T-017-01: ปรับปรุงฟอร์ม Excel Template และระบบ parser ให้ตรงกับฟิลด์ Newtask และรองรับกรณีไม่มีงานย่อยและไม่มีผู้รับผิดชอบ · attempts: 1 · tool_calls: 28


---




### 🐛 Bug & Error Task Format Reference
> **Format:** `{TaskID}-{BugID}-{AttemptID}`
> **Example:** `T-004-001-02`

---
> **Status:** `[ ]` (ยังไม่เริ่ม) → `[/]` (กำลังทำ/รอตรวจ) → `[X]` (เสร็จ/ตรวจผ่าน)
- [X] T-014-002-01: แก้ไข rejectTask Transaction reads-before-writes violation → 500 error (→ ERR-040) · attempts: 1 · tool_calls: 8
- [X] T-014-003-01: ????? Reject subtask card ?????? In Progress ??? Upcoming ????? Progress = 0 (-> ERR-041) * attempts: 1 * tool_calls: 6
- [X] T-014-004-01: แก้ไข updateSubtask และ deleteSubtask 404 (Not Found) เนื่องจาก resolveRefs ตีความ id ผิดพลาด (→ ERR-042) · attempts: 1 · tool_calls: 54
- [X] T-014-004-02: แก้ไขโครงสร้างการแยกไอดีงานของ TaskService ให้รองรับทั้ง single/double underscore (→ ERR-043) · attempts: 2 · tool_calls: 5
- [X] T-014-004-03: ปรับปรุงการคำนวณและอัปเดต dueDate บน Task หลักอัตโนมัติเมื่ออัปเดตหรือลบ subtask (→ ERR-044) · attempts: 1 · tool_calls: 25
- [X] T-012-009-02: ปรับดีไซน์ตารางกำลังพลและแดชบอร์ดให้เรียบหรู มินิมอล ทันสมัย · attempts: 1 · tool_calls: 29
- [X] T-012-009-03: ปรับปรุงแยกแดชบอร์ดชั่วโมงโอทีย่อย และแสดงประวัติแก้ไขรายงานกำลังพลอย่างโปร่งใส · attempts: 1 · tool_calls: 10
- [X] T-012-009-04: แก้ไข Error 500 เมื่อเรียกดูประวัติ subtask (AxiosError 500 ใน getSubtasks) (→ ERR-046) · attempts: 1 · tool_calls: 93
- [X] T-012-009-05: ปรับปรุงหน้าต่างแสดงประวัติการแก้ไขรายงานให้แสดงผลเปรียบเทียบก่อนและหลังการแก้ไข (Diff UI) · attempts: 1 · tool_calls: 37
- [X] T-014-005-01: พัฒนา Logic แสดงสีบอกสถานะวันครบกำหนด (Due Date) ตามเงื่อนไขใหม่ (→ ERR-047) · attempts: 1 · tool_calls: 16
- [X] T-014-005-02: ปรับปรุงการแสดงผลปุ่ม Due Date เมื่อ Progress = 100% (เสร็จก่อนแผน/เลยกำหนด/ตรงตามแผน) (→ ERR-048) · attempts: 1 · tool_calls: 18
- [X] T-014-005-03: ปรับปรุงการแสดงข้อความปุ่ม Due Date เป็นจำนวนวัน และย้ายวันที่ไปยัง Tooltip สำหรับงานที่ยังไม่เสร็จ (→ ERR-049) · attempts: 1 · tool_calls: 13
- [X] T-012-009-07: เพิ่มข้อมูลละเอียดใน History Modal — แสดงชื่อกำลังพลที่เพิ่มเข้ามา, เวลาบันทึกรายงาน และรายชื่อสรุปทั้งหมดพร้อมกะ · attempts: 1 · tool_calls: 22
- [X] T-012-009-08: เพิ่ม ReportEditHistoryPanel — แสดงประวัติการแก้ไขรายงานวันเดิม (FM บันทึกแล้วกลับมาแก้) พร้อม before/after diff กำลังพลและใบลา · attempts: 1 · tool_calls: 10
- [X] T-017-001-01: แก้ไขปัญหา Network Error ERR_EMPTY_RESPONSE เมื่อ Login ที่พอร์ต 4000 (→ ERR-063) · attempts: 1 · tool_calls: 33
- [X] T-017-002-01: นำคอลัมน์วันครบกำหนด (งานหลัก) ออกจากเทมเพลต Excel WBS และระบบนำเข้า (→ ERR-064) · attempts: 1 · tool_calls: 31
- [X] T-017-003-01: ปรับปรุงการนำเข้า WBS: ลบลายน้ำ ตารางหมายเหตุ และแก้ไข Tooltip/ตัวอย่างคอลัมน์ · attempts: 1 · tool_calls: 11
- [X] T-017-003-02: ปรับปรุงโครงสร้าง Popup นำเข้า WBS: ลบกรอบหลัง ปรับหัวตารางเป็น 2 แถวและลดขนาดความกว้าง (→ ERR-066) · attempts: 1 · tool_calls: 40
- [X] T-018: ผูก Logic WBS Import ให้ Upsert WorkOrder/Category Config ใน Firebase A หลัง Import สำเร็จ (เพื่อให้ Dropdown ฟอร์ม NewTask แสดง STR, ARC ฯลฯ) · attempts: 1 · tool_calls: 6
- [X] T-012-009-09: ปรับปรุงตารางกำลังพลและแผนงาน (ลบคอลัมน์ชั่วโมงรวม/สถานะ และแสดงปุ่ม Due Date งานย่อย) · attempts: 1 · tool_calls: 11
- [X] T-012-009-10: ปรับปรุงสีสันแดชบอร์ดการ์ดสถิติ (Gradient Colors & Glassmorphism OT Cards) · attempts: 1 · tool_calls: 5
- [X] T-012-009-11: ปรับแต่งรูปแบบตารางไฟล์ส่งออก Excel (Export to Excel) ให้สวยงามมีเส้นขอบและหัวตารางสีเขียวพรีเมียม · attempts: 1 · tool_calls: 4
- [X] T-019-001-01: กรองหัวหน้างานของ Work Order เฉพาะบทบาท LD และ projectId ปัจจุบัน พร้อมเก็บบันทึกข้อมูลลงฟิลด์ AssignLD แบบหลายรายชื่อ (→ ERR-070) · attempts: 1 · tool_calls: 63
- [X] T-019-001-02: กรอง (Filter) Work Order รหัส WOA และ WOP ออกจากการแสดงผลเนื่องจากเป็นของระบบอื่น (→ ERR-071) · attempts: 1 · tool_calls: 10
- [X] T-019-001-03: ปรับปรุงเงื่อนไขสลับหน้าต่างชื่องาน / เลือกงานหลักเมื่อเพิ่มงานย่อยตามข้อมูลที่ผู้ใช้กรอก (→ ERR-072) · attempts: 1 · tool_calls: 10
- [X] T-020: ปรับปรุงรูปแบบการ์ดของหน้า FM ให้คล้ายกันกับของหน้า Workspace เพื่อความเป็นระบบเดียวกัน · attempts: 1
- [X] T-020-001-01: ปรับดีไซน์ TaskSidebarCard ในหน้า FM (Daily Report) ให้เหมือน TaskCard ของหน้า Workspace · attempts: 1 · tool_calls: 46
- [X] T-020-001-02: ย้ายปุ่มควบคุมและปรับดีไซน์พื้นหลังของคอนเทนเนอร์รายการงานฝั่งซ้ายให้เข้ากับธีมหลัก · attempts: 1 · tool_calls: 12
- [X] T-020-001-03: ลบส่วนที่ซ้ำกันของชื่องานหลักในหน้า FM (Daily Report) ป้องกันการแสดงชื่อย่อยซ้ำซ้อน (→ ERR-073) · attempts: 1 · tool_calls: 57
- [X] T-020-001-04: แยกโหมดการทำงานและเพิ่มตัวกรองวันที่/รายการการ์ดงานระหว่าง Dailyreport และ Requests บนหน้าจอหลัก (→ ERR-074) · attempts: 1 · tool_calls: 70
- [X] T-020-001-04-01: แก้ไขบักหน้าต่างรายการงานฝั่งซ้ายว่างเปล่าเมื่อสลับโหมดทำรายงาน/คำขอของหัวหน้างาน (Sidebar closed and no toggle button) (→ ERR-075) · attempts: 1 · tool_calls: 72
- [X] T-020-001-05: ปรับปรุงการบังคับแนบรูปภาพ Dailyreport ระหว่างวัน และขีดจำกัดวันที่ของ Requests · attempts: 1 · tool_calls: 15
- [X] T-020-001-05-01: ปรับเงื่อนไขการเเนบรูปแรงงานปกติ (regular) ตามช่วงเวลาทำงานจริง (ครึ่งวัน/เต็มวัน) · attempts: 1 · tool_calls: 10
- [X] T-020-001-05-02: แก้ไขบั๊กข้อมูลความคืบหน้า (Progress) แสดงผลเป็น 100% เมื่อสร้างแผนล่วงหน้าในระบบ (→ ERR-076) · attempts: 1 · tool_calls: 52
- [X] T-020-001-05-03: ซ่อนแถบเลื่อน (Scrollbar) ของรายการงานย่อยในแถบด้านข้าง (Sidebar) (→ ERR-077) · attempts: 1 · tool_calls: 14
- [X] T-020-001-05-04: นำข้อความ "Daily Report" ออกจากหน้าจอเพื่อความเรียบร้อยและเพิ่มพื้นที่แสดงผล (→ ERR-078) · attempts: 1 · tool_calls: 11
- [X] T-020-001-05-05: ขยายความกว้างปุ่ม Dailyreport และ Requests ให้เท่ากับกรอบการ์ดงานด้านซ้าย (320px) (→ ERR-079) · attempts: 1 · tool_calls: 14
- [X] T-020-001-05-06: ปรับเปลี่ยนดีไซน์ส่วนหัวของการ์ดบันทึกข้อมูล (Centered Mode Indicator & Clean Metadata) (→ ERR-080) · attempts: 1 · tool_calls: 16
- [X] T-020-001-05-07: นำแถบแบนเนอร์แสดงสถานะโหมดกึ่งกลางการ์ด (Desktop) ออกตามความต้องการของผู้ใช้ (→ ERR-081) · attempts: 1 · tool_calls: 5
- [X] T-020-001-05-08: พัฒนาระบบบันทึกฉบับร่าง (Save Draft vs Submit Final) และล็อกการเลือกวันล่วงหน้าบนปฏิทิน (→ ERR-082) · attempts: 1 · tool_calls: 15
- [X] T-020-001-05-09: ปรับเปลี่ยนการแสดงผลปุ่ม "บันทึกฉบับร่าง" ให้แสดงเฉพาะเมื่อเลือกวันที่ปัจจุบัน (Today) เท่านั้น (→ ERR-083) · attempts: 1 · tool_calls: 3
- [X] T-020-001-05-10: แก้ไขบั๊กปุ่มลบรูปถ่ายหน้างาน (X) ไม่ทำงานสำหรับรูปภาพเก่าที่มีอยู่แล้ว (Existing Photos) (→ ERR-084) · attempts: 1 · tool_calls: 4










- [ ] T-020-001-05-11: แก้ไขบั๊ก Column Header ของ Kanban Board ไม่ lock เมื่อ scroll (Sticky Header)
- [X] T-020-001-05-12: ปรับปรุงช่อง Search ในแถบด้านข้างหน้า รายงานประจำวัน ให้มีขนาดสมดุลเต็มกรอบบนอุปกรณ์ขนาด laptop (→ ERR-087) · attempts: 1 · tool_calls: 25
- [X] T-012-009-12: ปรับปรุงตารางกำลังพลและแผนงานสำหรับเวอร์ชันมือถือด้วยรูปแบบการ์ดรายการ (Card-based List) · attempts: 1 · tool_calls: 3
- [X] T-012-009-13: ซ่อนปุ่ม Export to Excel บนหน้าจอมือถือในหน้าตารางกำลังพล · attempts: 1 · tool_calls: 2
- [X] T-012-009-14: ปรับปรุงส่วนเลือกผู้รับผิดชอบของ Quick Subtask และหน้าต่างแก้ไขย่อย ให้ดึงบทบาท SE เพิ่มเติม · attempts: 1 · tool_calls: 2
- [X] T-012-009-15: popup แก้ไขเวลาทำงาน แถวลาให้เอาช่อง ประเภทการลาออก · attempts: 1 · tool_calls: 11
- [X] T-012-009-17: ส่งการแจ้งเตือนเมื่อมีการมอบหมายงาน (Task Assignment Notifications Backend) · attempts: 1 · tool_calls: 15
- [X] T-021: ปรับปรุงประสิทธิภาพการอ่านเขียนฐานข้อมูลคิวรีในหน้ารายงานประจำวัน (daily-reports) และทำดัชนี (Query Indexing) · attempts: 1 · tool_calls: 38
- [X] T-022: ปรับปรุงประสิทธิภาพการดึงข้อมูล Presence และระบบ Heartbeat/Logs ที่หน้า Activity Monitor · attempts: 1 · tool_calls: 10
- [/] T-023: เพิ่มตัวกรองโครงการ (Project Level) และแยก Scrollbar งานช่วยเหลือใน Structure Tree หน้า Workspace
- [X] T-032: ผสานอัปเดตระบบ Harness จากโฟลเดอร์ดาวน์โหลดล่าสุด · attempts: 1 · tool_calls: 35
- [X] T-033: ผสานอัปเดตระบบ Harness เพิ่มเติมจากโฟลเดอร์ดาวน์โหลดล่าสุด (มิถุนายน 2026) · attempts: 1 · tool_calls: 46
- [X] T-034: เพิ่มหน้าคู่มือการใช้งานของระบบและเชื่อมโยงจากหน้า Login · attempts: 1 · tool_calls: 25





- [X] T-035: เขียนคู่มือการใช้งานระบบใหม่ทั้งหมด — Single Source of Truth, 10 roles, step-by-step actions · 11 HTML + 2 JSON + Playwright script · attempts:1 · tool_calls:~30
- [X] T-015-002-01: แก้ไขปัญหาหน้าจอค้างเมื่อกดปุ่มออกจากระบบ (Logout) และแก้ปัญหา Path Localization หายเมื่อเปลี่ยนเส้นทาง (→ ERR-088) · attempts: 1 · tool_calls: 13
- [/] T-024: ปรับปรุงระบบจัดการข้อมูลการเงินแรงงานรายวัน และซ่อนเมนูประกันสังคม
  - [X] T-024-001: S1 · Diagnose: ตรวจสอบตำแหน่งอ้างอิงของระบบข้อมูลการเงินและสถิติ · attempts: 1 · tool_calls: 3
  - [X] T-024-002: S2 · Edit & Verify: ซ่อนแท็บข้อมูลการเงิน เพิ่มช่องสถิติในหน้ากรอก/นำเข้า และซ่อนเมนูประกันสังคม · attempts: 1 · tool_calls: 5
  - [/] T-024-003: S3 · Sync & Close: อัปเดตดัชนีสัญลักษณ์และปิดการทำงานรอบนี้
- [X] T-025: ปรับปรุงประสิทธิภาพการดึงข้อมูลและบันทึกข้อมูลในระบบคำนวณค่าแรง (Wage Calculation DB Optimizations) (→ ERR-089) · attempts: 1 · tool_calls: 10
  - [X] T-025-01: S1 · Diagnose: ตรวจสอบจุดเกิดปัญหา N+1 queries และ redundant writes
  - [X] T-025-02: S2 · Edit & Verify: ปรับปรุงการคิวรีเป็นแบบ bulk และ dirty-check ในการเขียนรายงาน
  - [X] T-025-03: S3 · Sync & Close: อัปเดตดัชนีและบันทึกประวัติการแก้ไข
- [X] T-036: ปรับปรุงการจัดการทรัพยากรและลบฟังก์ชันการแก้ไขเวลาทำงานด้วยตนเอง (Optimize resource management and remove manual editing features)
  - [X] T-036-01: S1 · Fix duplicate query fetching and cache wagePeriods · attempts: 1 · tool_calls: 2
  - [X] T-036-02: S2 · Remove manual edit dialog/mutations and cache dc-stats · attempts: 1 · tool_calls: 3
  - [X] T-036-03: S3 · Clean up backend controller and routes · attempts: 1 · tool_calls: 3
  - [X] T-036-04: S4 · Clean up backend ReconciliationService · attempts: 1 · tool_calls: 3
  - [X] T-036-05: S5 · Build and Verify · attempts: 1 · tool_calls: 6
  - [X] T-036-06: S6 · Fix segment matching swap bug and add OT Noon continuous transition bypass · attempts: 1 · tool_calls: 2
- [X] T-037: Hide After-Sale Daily Report drafts from work-hours-tracking page (dailyReportStatus filter) · attempts:1 · tsc clean
  - [X] T-037-01: S1 · Plumb status from After-Sale into DailyTimesheetSummary (ProjectBDailyReportService.ts)
  - [X] T-037-02: S2 · Add dailyReportStatus field to ReconciliationRecord model (type + serialize + parse)
  - [X] T-037-03: S3 · Carry dailyReportStatus through reconcile upsert (ReconciliationService input build + buildUpdates)
  - [X] T-037-04: S4 · In-memory filter dailyReportStatus==='draft' in getRecords + getStats
  - [X] T-037-05: S5 · Document the draft filter in work-hour-monitoring-logic.md







- [X] T-044: /daily-reports แนบรูป — popup เลือกถ่ายรูป/เลือกรูป/แนบไฟล์ (consistent Android+iOS) · PhotoSourcePicker.tsx + 4 sites in daily-reports/index.tsx · tsc EXIT=0
- [X] T-045: Import Wizard — UserImportDialog + DCImportDialog: parse CSV client-side → preview table → dropdown Role/Dept/Project per row → rebuild CSV → submit · tsc EXIT=0
- [X] T-046: FM Self-Performed Checkbox — Daily Report modal adds "FM ทำเองโดยไม่มีแรงงาน" checkbox per work section; FM entries use sentinel ID FM:{userId}, fmSelfPerformed=true; backend skips contractor lookup + zeroes summary deltas; dashboard shows FM chip · attempts:1 · tool_calls:18
- [X] T-047 · P1 · depends_on: none · done 2026-07-11 · attempts:1 · tsc-clean · force-save download (fetch→blob + open-tab fallback) · behavioral-verify:pending-on-device
    Title:        Diary Report "รูปถ่ายหน้างาน" — accept PDF/document attachments + add PDF preview popup with download button
    ContextTask:  Painpoint from field: workers filling Daily/Diary Report sometimes need to attach a PDF or other document
                  (not just a photo) under the "รูปถ่ายหน้างาน" (site photo) field, but upload is currently hardcoded to
                  images only. Frontend: DailyReportForm.tsx:379-395 (field `imageUrls`, `accept="image/*"`, uses reusable
                  FileUpload.tsx component, maxFiles=5, 5MB/file) and frontend/src/pages/daily-reports/index.tsx (multiple
                  photo-upload sections ~lines 2900-3025, also hardcoded `accept="image/*"`; existing image preview is an
                  MUI Dialog lightbox with carousel nav at lines 4259-4389, renderPhotoGrid at 1917-2025). Backend:
                  media.routes.ts (POST /api/media/upload, /upload-multiple) + MediaController.ts already accept ANY file
                  type server-side (multer memory storage, 10MB limit, no MIME whitelist) and store to Firebase Storage via
                  storage.ts uploadBuffer(), returning url+filename+mimeType — so backend needs no structural change, just an
                  optional defensive whitelist. Data model: DailyReport.ts stores `importFileUrls?: string[]` (URLs only, no
                  mimetype/filename metadata) and dailyReportSchema.ts's `fileAttachmentIds` has no type constraint — the
                  frontend needs the mimetype to decide "render as image vs render as PDF" at preview time, so either infer
                  from the URL/filename extension (simplest) or extend the stored data to an object with {url, filename,
                  mimeType}. No PDF viewer exists anywhere in the codebase today (grepped "pdf"/"react-pdf"/"pdfjs"/"iframe"
                  — zero hits) — this is a new capability, not an extension of an existing one.
    Goal:         (1) The "รูปถ่ายหน้างาน" upload field (and any other daily-report attachment upload point sharing the same
                  pattern) accepts general document files broadly — not a narrow whitelist — covering at least
                  PDF/.doc/.docx/.xls/.xlsx/.ppt/.pptx alongside existing image types (user confirmed 2026-07-10: "เปิดกว้าง
                  ทุกไฟล์เอกสารทั่วไป"). (2) Clicking an attached PDF or image opens a popup/modal that renders the content
                  inline with a visible Download button (PDF gets a real inline preview; image keeps existing lightbox).
                  (3) Any other attached file type (non-PDF, non-image — e.g. .docx/.xlsx) that cannot be rendered inline
                  gets a popup/entry with just a Download button (no broken inline-render attempt). (4) Existing image
                  attach/preview behavior is unchanged (no regression on the current photo flow).
    How-Check:    Manual: on /daily-reports (desktop) and daily-reports/mobile/create, attach a PDF under "รูปถ่ายหน้างาน" →
                  submit succeeds → reopening the report and clicking the attached PDF thumbnail/entry opens a popup that
                  renders the PDF content with a working Download button → attaching/previewing an image still works exactly
                  as before. `npx tsc --noEmit` clean on both frontend and backend.
    Out-of-Scope: Do NOT change the underlying Firebase Storage backend or the already-permissive multer config beyond an
                  optional defensive MIME whitelist. Do NOT touch unrelated upload flows (e.g. Excel import in
                  DailyReportUploadDialog.tsx, which is a different feature).
    Relate File:  frontend/src/page-components/daily-reports/components/DailyReportForm.tsx,
                  frontend/src/components/forms/FileUpload.tsx, frontend/src/pages/daily-reports/index.tsx,
                  frontend/src/page-components/daily-reports/daily_report_ui_aftersale_reference.tsx,
                  frontend/src/validation/dailyReportSchema.ts, backend/src/controllers/MediaController.ts,
                  backend/src/api/routes/media.routes.ts, backend/src/models/DailyReport.ts
- [X] T-048 · done 2026-07-12 · attempts:1 · tool_calls:~30 · P1 · depends_on: none
    Title:        Workspace page — always-show overdue incomplete tasks past their month + add WorkOrder/Category filters
                  + consolidate Filter and Add-task buttons into single dropdowns
    ContextTask:  Workspace task list (frontend/src/pages/workspace/index.tsx) filters by date tab ("This Month" etc) at
                  the filteredSubtasks useMemo (lines 945-971); the month-match condition (lines 966-968) currently hides
                  ANY task/subtask whose dueDate falls outside the selected month, including tasks that are still
                  incomplete — these become invisible backlog and can silently fall out of focus. Progress lives as
                  `dailyProgress` (0-100) on both Task (Task.ts:38) and Subtask (Task.ts:85, plus `supportDailyProgress`
                  at :92). Separately: workOrderId/workOrderCode/workOrderName (Task.ts:26-28) and categoryId/categoryName
                  (Task.ts:29-30) — the "หมวดงานหลัก/Work Order" and "หมวดงานย่อย/Category" fields the user wants as
                  filters — ALREADY EXIST on the Task model and are already used by the left-sidebar WorkspaceTree
                  (Project → WorkOrder → Category → Task, selectedNode filter at index.tsx:978-980); no backend/data-model
                  change needed, this is a UI filter-surfacing gap. Toolbar today (index.tsx:1350-1651) has 3+ separate
                  controls competing for space: a date-tab Menu (1381-1457) + a Reset-filters button (1460-1485) + a
                  "Newtasks" add button (1488-1509 desktop / 1592-1610 mobile) + an "Upload" (WBS import) button
                  (1512-1533 / 1613-1631) — and "Download Template" is buried a level deeper inside WbsImportModal.tsx
                  (277-284) rather than in the toolbar at all. User's ask: not enough horizontal room to add 2 more
                  filters without consolidating first.
    Goal:         (1) A task/subtask with dailyProgress < 100 is ALWAYS visible regardless of the active date-tab/month
                  filter — only 100%-complete items are subject to the month cutoff. (2) Two new filter dimensions exist
                  on the workspace toolbar: "หมวดงานหลัก" (WorkOrder, using existing workOrderId/workOrderCode/
                  workOrderName) and "หมวดงานย่อย" (Category, using existing categoryId/categoryName) — usable
                  independently of (and in addition to) the left-sidebar tree selection, to make focusing on one
                  work-order/category fast without expanding the tree. (3) All filter controls (date-tab, reset, new
                  WorkOrder filter, new Category filter) are consolidated behind ONE "Filter" button that opens a
                  dropdown/popover containing all of them, including the clear/reset action inside it — no more standalone
                  filter buttons cluttering the toolbar. (4) "Add task", "Upload" (WBS import), and "Download Template"
                  are consolidated into ONE add-menu (e.g. split-button or dropdown) offering all three as sub-actions,
                  replacing the current 2-3 separate toolbar buttons + the buried in-modal download link.
    How-Check:    Manual on /workspace (desktop + mobile collapsed toolbar): (a) create/seed a task with dailyProgress<100
                  and a dueDate outside the current month → confirm it still appears under "This Month" tab; a
                  dailyProgress=100 task outside the month stays hidden as before. (b) open the new Filter dropdown →
                  select a WorkOrder → list narrows to that work order's tasks; select a Category → narrows further;
                  clear button inside the dropdown resets both + the date tab. (c) open the new Add-task dropdown →
                  "Add single item" opens TaskCreateModal, "Upload" opens WbsImportModal, "Download Template" downloads
                  the Excel template directly from the toolbar (no need to open the upload modal first). `npx tsc
                  --noEmit` clean on frontend.
    Out-of-Scope: Do NOT change the Task/Subtask backend model (workOrderId/categoryId/dailyProgress already exist) — this
                  is a frontend filter-logic + toolbar-layout task only. Do NOT change WorkspaceTree's own tree-based
                  filtering behavior, only add the two new toolbar-level filters alongside it.
    Relate File:  frontend/src/pages/workspace/index.tsx, frontend/src/page-components/workspace/components/WorkspaceTree.tsx,
                  frontend/src/page-components/workspace/components/WbsImportModal.tsx, backend/src/models/Task.ts
- [X] T-049 · P1 · depends_on: none · done 2026-07-13 · tool_calls:~30 · code-complete + tsc-clean (FE+BE) · BROWSER-VERIFIED 2026-07-13: draft-gating proven (งานผนังชั้น1 100%+draft stayed In-Progress while ฝ้าส่วนกลาง 100%+submitted sat in For-Checking) · "จัดเก็บ" confirmed live in card ⋮ menu + Completed-column chip ("จัดเก็บ 1") · Unarchive icon + popover title code-verified. Note: T-048 always-show-overdue only rescues progress<100 tasks, so a 100%-draft task past its month is hidden under the month filter (visible under "ทั้งหมด") — flagged to user as a UX interaction.
    Title:        Workspace "Complete" box — gate on draft daily-report status, not just progress=100 + rename
                  "ซ่อน"→"จัดเก็บ" and fix the confusing trash-can unarchive icon
    ContextTask:  (1) The Complete/In-Progress column grouping in frontend/src/pages/workspace/index.tsx (desktop
                  lines 1912-1913, mobile lines 1704-1705, helper fn lines 104-105) currently moves a task/subtask into
                  the "Complete" box purely on `dailyProgress >= 100` — it does NOT check whether the underlying daily
                  report is still 'draft'. ReportStatus ('draft'|'submitted'|'verified'|'locked') lives on DailyReport.ts
                  (line 11); TaskDailyReportModal.tsx already reads `latestSiteReportStatus === 'draft'` (lines 520-525)
                  to gate its own "approve" button, so a precedent for checking this exists — the workspace grouping
                  logic just never consulted it. Result: a task can visually land in "Complete" while its report is
                  still a draft, which is misleading (mirrors the same "draft ≠ done" concern already fixed for the
                  work-hours-tracking page in T-037). (2) The "hide completed task" action (TaskCard.tsx:307-313, label
                  "ซ่อน" at line 312, VisibilityOffIcon at line 310, handler handleHide at 189-193) moves a completed
                  task into a "hidden" popover ("งานที่ซ่อนไว้", index.tsx lines 2647-2737, opened via the "ซ่อน N" chip
                  on the Completed column header). The unhide button inside that popover (index.tsx:2708, handler
                  handleUnhideCard at 2705) uses the `RestoreFromTrash` MUI icon with tooltip "เอากลับมาแสดง" (line 2702)
                  — user finds the trash-can icon confusing since nothing is being deleted, it's an un-archive action.
    Goal:         (1) A task/subtask whose latest daily report status is 'draft' stays in the "In Progress" (or
                  "for-checking") column even when dailyProgress reaches 100 — it only moves to "Complete" once the
                  report is submitted/verified (not draft). (2) The "ซ่อน" action/label on a completed task is renamed
                  to "จัดเก็บ" everywhere it appears (menu item text at TaskCard.tsx:312, plus the "ซ่อน N" chip/popover
                  title "งานที่ซ่อนไว้" on the Completed column, renamed to reflect "จัดเก็บ"/"รายการที่จัดเก็บ").
                  (3) The unarchive button in that popover no longer uses a trash-can icon — replace `RestoreFromTrash`
                  with a non-trash icon (e.g. Unarchive/Restore-style icon that doesn't read as "delete") and change its
                  tooltip/label to "ยกเลิกจัดเก็บ".
    How-Check:    Manual on /workspace: (a) bring a task's dailyProgress to 100 while its linked daily report is still
                  'draft' → task stays in "In Progress", not "Complete"; once the report is submitted/verified, the same
                  task moves to "Complete". (b) on a Complete task, open its action menu → label reads "จัดเก็บ" (not
                  "ซ่อน") → click it → task moves into the archived/จัดเก็บ collection. (c) open that collection's popover
                  → the restore button shows a non-trash icon with tooltip/label "ยกเลิกจัดเก็บ" → clicking it brings the
                  task back to "Complete". `npx tsc --noEmit` clean on frontend.
    Out-of-Scope: Do NOT change the DailyReport status state machine itself (draft→submitted→verified→locked) — only
                  consume the existing status to gate the workspace column. Do NOT change TaskDailyReportModal's own
                  existing draft-gating logic for its approve button.
    Relate File:  frontend/src/pages/workspace/index.tsx, frontend/src/page-components/workspace/components/TaskCard.tsx,
                  frontend/src/page-components/workspace/components/TaskDailyReportModal.tsx,
                  backend/src/models/DailyReport.ts
- [X] T-050 · P0 · depends_on: none · done 2026-07-10 · attempts:1 · tsc EXIT=0 · device-verified by user · frontend-only fix (backend already correct — original both-sides assumption disproven at gather)
    Title:        Bug: Daily Report OT checkbox wrongly disabled cross-job — laborer working Job B in regular hours
                  can't get OT on Job A even though the two time-slots don't conflict
    ContextTask:  In `frontend/src/page-components/daily-reports/mobile/DailyReportEntryModal.tsx`, `getOtCandidates()`
                  (lines 292-297) only allows a laborer into the OT checkbox lists if
                  `regular.workerIds.includes(w.id) || existingRegularWorkerIds.includes(w.id)`. The second condition,
                  `existingRegularWorkerIds`, is populated in `DailyReportDashboard.tsx` (lines 243-246) as a GLOBAL pool
                  of every laborer who has ANY regular-hours entry on ANY job that day — it does not check which
                  specific job. Bug: laborer worked Job B during regular hours (not Job A) → tries to log OT on Job A →
                  blocked, because the check sees "already has regular hours today" globally instead of "does regular
                  hours on Job A specifically". Real-world case IS valid: regular-hours-on-Job-B + OT-on-Job-A for the
                  same person same day should be allowed; the only actual constraint is no double-booking the SAME
                  time-slot (e.g. can't be checked regular on both Job A and Job B, can't be checked ot_morning on both
                  Job A and Job B). Data model already supports the needed granularity — `DailyReportEntry` (DailyReport.ts
                  lines 13-26) carries `taskId` + `workType` per entry, so per-job-per-timeslot conflict detection is
                  possible without a model change. Also found: there is currently ZERO backend validation of this at all
                  — `DailyReportService.addWorkEntry()` (lines 71-187) just upserts deltas with no double-booking check,
                  so even once the frontend is fixed, two different sessions/tabs could still double-book the same
                  laborer/timeslot without a server-side guard.
    Goal:         (1) A laborer's OT checkbox availability on Job A depends ONLY on whether that laborer is already
                  booked (regular OR OT) on a DIFFERENT job for that SAME time-slot (regular / ot_morning / ot_noon /
                  ot_evening) — not on whether they have any regular-hours entry anywhere else that day. (2) Laborer
                  can be regular-hours on Job B and OT on Job A simultaneously on the same day. (3) Laborer CANNOT be
                  checked into the same time-slot (e.g. regular, or ot_morning) on two different jobs at once — this
                  conflict must be enforced both in the frontend checkbox UI (grayed out / blocked with a clear reason)
                  AND server-side in `addWorkEntry()` (reject/error on a genuine same-timeslot double-booking, so
                  concurrent edits from two tabs/sessions can't silently create one).
    How-Check:    Manual: create 2 Daily Report entries same day same laborer — Job A regular-hours unchecked + Job A
                  OT-morning checked, Job B regular-hours checked for the same laborer → both save successfully with no
                  block. Then attempt to check Job A regular-hours for the same laborer while Job B regular-hours is
                  already checked for them → blocked with a clear message (same time-slot conflict). Repeat the
                  same-timeslot-conflict attempt via direct API call (bypassing frontend) → backend rejects it too.
                  `npx tsc --noEmit` clean on frontend and backend.
    Out-of-Scope: Do NOT redesign the WorkType enum or DailyReportEntry schema — the existing `taskId` + `workType`
                  fields already carry enough info; this is a validation-logic fix only, not a data-model change.
    Relate File:  frontend/src/page-components/daily-reports/mobile/DailyReportEntryModal.tsx,
                  frontend/src/page-components/daily-reports/components/DailyReportDashboard.tsx,
                  backend/src/services/dailyReport/DailyReportService.ts, backend/src/models/DailyReport.ts
- [X] T-051 · P0 · done 2026-07-10 · attempts:1 · tool_calls:~22 · ERR-091 · depends_on: none
    Title:        Bug: "Daily Report Log" calendar popup shows 100% on day-1 of a freshly-created task revision
                  (Reject → Rev N+1) because it aggregates reports across ALL revisions instead of the current one
    ContextTask:  When a Leader clicks "Reject" on a submitted task, `TaskService.rejectTask()` (backend/src/services/
                  TaskService.ts lines 340-483) correctly creates a new revision with progress reset to 0
                  (`dailyProgress: 0` at lines 397, 444-445, 473-474 for the task and each subtask) — the revision
                  creation itself is NOT the bug. The bug is in report-fetching: `TaskService.getAllDailyReports()`
                  (lines 2537-2549) queries `revisionsSnapshot = await targetRef.collection('revisions').get()` — ALL
                  revisions, not just the current/active one — then merges every revision's daily reports into one
                  `dateMap` keyed ONLY by calendar date (`!dateMap.has(d.id)` at line 2544, where `d.id` is a date, not a
                  revision-scoped key). Result: if the OLD rejected revision's last report date happens to fall on the
                  NEW revision's day-1 date, the old revision's 100%-progress report gets returned and displayed as if
                  it belongs to the new revision. Frontend consumer:
                  `frontend/src/page-components/workspace/components/TaskDailyReportModal.tsx` `fetchReports()`
                  (lines 164-310) takes whatever `getAllDailyReports` returns at face value — line 265-266 sets
                  `runningProgress = entry.site.progress` from the first report found per date, line 275 stores it as
                  `totalProgress`, and the calendar day-cell coloring at lines 588-590 treats `totalProgress === 100` as
                  "completed" — it has no revision-scoping guard of its own, it trusts the backend response
                  (which does include a `_revisionId` per report at line 2545 that the frontend currently ignores).
    Goal:         Opening the "Daily Report Log" popup for a freshly-created task revision (right after a Reject) shows
                  0% progress on every day until an actual Daily Report is logged against THAT SPECIFIC revision — it
                  must never display progress carried over from a prior (rejected) revision, even if calendar dates
                  from the two revisions overlap.
    How-Check:    Manual: reject a task that has at least one submitted daily report with progress=100 → a new Rev is
                  created → open that new Rev's task card → click to open "Daily Report Log" → day 1 (and every day
                  before any report is logged against the new Rev) shows 0%, not 100% → log a real Daily Report against
                  the new Rev → that specific day now correctly shows its own progress. Confirm the OLD revision's log
                  (viewed separately, if still accessible) still correctly shows its own historical 100% — this is a
                  scoping fix, not a data-deletion. `npx tsc --noEmit` clean on backend and frontend.
    Out-of-Scope: Do NOT change `rejectTask()`'s revision-creation/reset logic (already correct). Do NOT delete or
                  migrate old revisions' daily report data — old revisions must remain viewable under their own
                  identity, just never bleed into a different revision's calendar.
    Relate File:  backend/src/services/TaskService.ts,
                  frontend/src/page-components/workspace/components/TaskDailyReportModal.tsx
- [X] T-052 · P1 · depends_on: none · done 2026-07-10 · attempts:1 · tsc EXIT=0 · device-verified via follow-up T-052b
    ### Failed Approaches (T-052b shutter no-op debug — full detail in knowledge/error_index.md ERR-090):
                  8 disproven theories before root cause: fullScreen→popup, toBlob error-logging, GPS highAccuracy,
                  button-disabled/backdrop, stale dev-server, .next cache wipe, form-submit, service-worker. Actual
                  root cause = MUI `<Dialog>` (Portal/aria-modal) eats the shutter tap; PhotoSourcePicker.tsx:29-49
                  already documented this app's non-Portal constraint. Fix: rewrote GeotaggedCamera as a position:fixed
                  overlay in the normal React tree. User confirmed on device 2026-07-10 ("ปิดได้เลยครับ").
    Title:        Daily Report site-photo capture — custom in-app camera that stamps GPS location + timestamp onto the
                  photo, with mandatory camera+location permission gating
    ContextTask:  See .sessions/mece_plan.md (full 5-section plan, reviewed twice by skeptical_reviewer) and
                  .sessions/gather_complete.md for full detail. Summary: native `<input capture="environment">`
                  (PhotoSourcePicker.tsx:116-123) has no hook to overlay a live watermark, so a custom getUserMedia+canvas
                  camera is required. New opt-in `enableGeoStamp` prop on PhotoSourcePicker, turned on ONLY at the 2
                  genuine Daily Report site-photo call sites (daily-reports/index.tsx ~1984, ~2117) — NOT the 2 medical
                  certificate call sites (~5154, ~5349) which are an unrelated leave-request feature.
    Goal:         See gather_complete.md acceptance_criteria — first-use permission prompt (camera+geolocation), mandatory
                  re-gate on every capture attempt until granted (with a clear "enable in settings" path once
                  permanently denied, since JS cannot force a browser permission dialog to reappear), live GPS+timestamp
                  watermark burned into the captured photo, gallery/attach-file paths and the 2 certificate call sites
                  fully unchanged.
    How-Check:    See mece_plan.md S5 Verify-1 (full manual checklist) + `npx tsc --noEmit` clean on frontend.
    Out-of-Scope: No backend/data-model changes. No reverse-geocoding. The 2 medical-certificate call sites stay on the
                  native camera untouched.
    Relate File:  frontend/src/components/forms/PhotoSourcePicker.tsx, frontend/src/pages/daily-reports/index.tsx,
                  frontend/src/components/camera/useCameraPermissions.ts (new),
                  frontend/src/components/camera/watermarkStamp.ts (new),
                  frontend/src/components/camera/GeotaggedCamera.tsx (new)

- [X] T-053 · P0 · depends_on: none · done 2026-07-13 · attempts:1 · tsc EXIT=0 · browser-verified (console 0 error, single clean redirect)
    Title:        Bug: white-screen / infinite router loop on logout and on unauthorized-route access (ProtectedRoute)
    ContextTask:  Found during T-049 behavioral verification. ProtectedRoute.tsx useEffect had `router` in its dependency
                  array while calling router.push('/login') | router.push('/unauthorized') inside. router identity churns
                  during a route transition → effect re-runs → push fires again → aborts the in-flight navigation every
                  render → console spams "Abort fetching component for route" and the page never finishes = white screen.
                  Same root cause behind 3 symptoms: (1) logout → /login white screen, (2) Foreman opening /workspace →
                  /unauthorized hang, (3) any protected route while logged out → hang.
    Goal:         Logout and unauthorized-access redirect exactly once, cleanly, with no console loop and no white screen.
    How-Check:    Logged-out navigate to /workspace → single redirect to /login, login form renders, read_console_messages
                  returns 0 errors (previously spammed "Abort fetching component"). `npx tsc --noEmit` frontend EXIT=0.
    Fix:          Removed `router` from the effect deps; guard each redirect with a redirectingRef + router.pathname check
                  so it fires once; switched router.push → router.replace for both /login and /unauthorized.
    Relate File:  frontend/src/components/layout/ProtectedRoute.tsx

- [X] T-054 · P1 · depends_on: none · done 2026-07-13 · attempts:1 · tsc EXIT=0 · frontend-only · single-source refactor (skeptical_reviewer: revise→go)
    Title:        Eliminate mobile/PC logic-drift in daily-reports + workspace (one logic set, CSS-only responsive difference)
    ContextTask:  User principle — mobile and PC must share ONE logic set; only CSS may differ, never two logic copies that
                  drift. Audit (3 parallel agents, 314 files) found live drift + a dead parallel flow. Folds in 2 reported
                  issues: (1) mobile OT-เย็น still required ปกติ ticked while desktop was fixed by T-050; (2) DC button row
                  unbalanced on mobile. skeptical_reviewer caught a self-contradiction (S1 changed a desktop default vs the
                  "never change desktop" constraint) → user confirmed otMorning default 06:00-08:00 → verdict go.
    Goal:         Mobile OT enabled without ปกติ (matches desktop); shift default times single-sourced; DC header responsive;
                  workspace board bucketing single-sourced; dead pre-T-050 flow removed.
    How-Check:    frontend npx tsc --noEmit EXIT=0. grep: !worker.times?.regular=0 · SHIFT_DEFAULT_TIMES shared 8 · bucketed
                  Columns shared 9 · allMobileColTasks/allColumnTasks/mobileHiddenTasks=0. 3 dead files git-rm'd, index_files
                  .json synced (−3 entries, valid JSON), 0 dangling refs. Browser behavioral test deferred to user (authed
                  page — assistant cannot log in per security policy).
    Fix:          S1 SHIFT_DEFAULT_TIMES const shared by WorkerTableRow+WorkerMobileCard; removed mobile OT "requires
                  regular" gate; unified otMorning default 08:00-12:00→06:00-08:00 (user-confirmed) incl. bulk picker
                  (drift #3, found during verify). S2 DC header flexDirection xs:column/md:row + full-width button on xs.
                  S3 bucketedColumns useMemo shared by both kanban branches. S4 git rm mobile/create.tsx +
                  DailyReportEntryModal.tsx + DailyReportDashboard.tsx.
    Relate File:  frontend/src/pages/daily-reports/index.tsx · frontend/src/pages/workspace/index.tsx

- [X] T-055 · P1 · depends_on: none · done 2026-07-31 · attempts:1 · tool_calls:~45
    Title:        Upgrade Codeing_harness_killer install to 2026-07-10 (was 2026-06-16), install real hooks
    ContextTask:  New harness source downloaded to Downloads/Codeing_harness_killer-main (3). Prior install had only
                  markdown framework files (CLAUDE.md/AGENTS.md/INVARIANTS.md/Implement/) — .claude/settings.json was
                  `{}` (no hooks ever wired), .agents/skills/ and scripts/ (the harness's own automation) were missing
                  entirely, .agents/platform/detected.md was mid-migration (only a stale .bak present). This matches the
                  CHANGELOG's "the LMS boot failure" note.
    Goal:         Bring CLAUDE.md/AGENTS.md/Implement/*/.agents/skills+tools+router/scripts up to 2026-07-10, wire real
                  hooks (SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop), keep it working on this Windows box.
    How-Check:    settings.json valid JSON, python3 occurrences=0, all 5 hook events present. Every wired hook script
                  smoke-tested standalone with sample stdin → exit 0, no crash. index_reconcile.py Stop-hook chain
                  (rule_indexer/backlink_analyzer/code_graph/symbol_indexer/gen_doc_labels) all → ok. repo_map_check.py
                  --sync ran clean (282 folders mapped). index_files.json/index_variables.json/index_cfp_fix.json all
                  valid JSON.
    Fix:          Overwrote CLAUDE.md, AGENTS.md, Implement/00-10, .agents/skills+tools+skill-patches+router.md (fresh
                  install — previously absent). Appended INVARIANTS.md §I9 (only real diff). Copied 87 harness scripts
                  into scripts/ (no name collisions with project's own scripts). Force-redetected .agents/platform/
                  detected.md for claude-code/anthropic/Sonnet-5/Windows. Found + fixed 2 real platform bugs: (1)
                  `python3` isn't aliased on this machine (only `python`/`py`) — every hook command + every internal
                  subprocess call inside the harness scripts uses literal `python3`, so created a `python3.exe` shim
                  (copy of python.exe) next to it in the Python312 install dir; (2) the harness's scripts open()
                  project files without `encoding="utf-8"`, which crashes with UnicodeDecodeError on this Thai-locale
                  Windows codepage — fixed by prefixing every hook's python invocation with `PYTHONUTF8=1`, which
                  propagates through nested subprocess calls too. Deliberately did NOT wire the shipped PreToolUse
                  phase-gate (scripts/phase_gate.py / the inline never-full-load+gather+mece check) — user chose to
                  skip it because, as shipped, it blocks every Edit/Write/Bash-write repo-wide unless
                  .sessions/gather_complete.md + .sessions/mece_plan.md are both dated same-day, with no override.
                  VERSION stamped to harness_version: 2026-07-10.
    Relate File:  CLAUDE.md · AGENTS.md · INVARIANTS.md · Implement/ · .agents/skills/ · .agents/tools/ ·
                  .agents/router.md · .agents/skill-patches/ · scripts/ · .agents/platform/detected.md ·
                  .claude/settings.json · VERSION

- [ ] T-056 · P2 · depends_on: none
    Title:        machine_install.sh has no Windows fallback when rsync is missing — Layer-1 install is a dead end
    ContextTask:  Ran `/harness-agent:harness_setup` on this project (2026-08-04). Detector correctly reported
                  `noop · self-hosted (project is the engine)` — this repo already carries its own local engine copy.
                  User wants to share the engine machine-wide (Layer 1) so other projects on this Windows box can use
                  it too. Following the skill's guided flow, `bash scripts/machine_install.sh --dry-run` failed
                  immediately: `rsync: command not found` (exit 127) — this machine's Git Bash ships without rsync
                  (Git for Windows dropped it years ago) and has no MSYS2/pacman/choco/scoop installed. Tried the
                  skill's fallback suggestion, `winget search rsync --source winget` — returns no real rsync package,
                  only unrelated tools incidentally tagged "rsync" (Rclone, win-sshpass, etc.); the `msstore` source
                  requires an interactive terms-of-transaction prompt that a non-interactive `winget search` cannot
                  answer (errors `0x8a150042`). WSL is also not installed, and `wsl --install` is a system-level
                  feature toggle correctly out of scope for the agent to run unprompted. Net result: on a bare
                  Windows machine with no MSYS2/WSL, Layer-1 machine-wide install is a hard dead end — the script
                  dies on a raw shell error and the skill's own remediation path (winget) doesn't actually work.
    Goal:         `machine_install.sh` should never die on a bare "command not found". Either (a) add a pre-flight
                  rsync availability check that exits with a clear, Windows-specific remediation message (point to
                  MSYS2 `pacman -S rsync`, since neither Git for Windows nor winget reliably provide rsync), or
                  (b) add a non-rsync copy fallback (e.g. a small Python routine driven by the same
                  `scripts/engine_manifest.txt` single-source list, preserving the existing idempotent / no-delete
                  copy guarantees) so Windows users without MSYS2 aren't blocked. Also fix the `harness_setup` skill's
                  Step 5 guidance, which currently proposes `winget search rsync` as a live option — it isn't.
    How-Check:    On a Windows machine with no rsync/MSYS2/WSL: `bash scripts/machine_install.sh --dry-run` either
                  (a) exits non-zero with a one-line human-readable remediation pointing to MSYS2 (no raw
                  "command not found" traceback), or (b) completes successfully via the fallback copy path and
                  produces the same file set rsync would have. `.agents/skills/harness/harness_setup/SKILL.md`
                  Step 5 no longer proposes `winget search rsync`.
    Out-of-Scope: Actually installing rsync/MSYS2/WSL for the user — that stays user-run under the existing R14 gate
                  (the skill correctly refused to self-confirm a `~/.claude` write or a system-level feature install
                  on the user's behalf).
    Relate File:  scripts/machine_install.sh · .agents/skills/harness/harness_setup/SKILL.md ·
                  Implement/10_machine_install.md

- [X] T-057 · P2 · depends_on: T-055 · done 2026-08-11 · attempts:1 · tool_calls:~40 · build+verify done (tsc clean · prod export ran 5190 records); live 4-process UI run is user-side (needs Java+firebase-tools)
    Title:        Firebase-emulator verify workflow — SEE the T-055 fix on real prod data in the real UI, no deploy
    ContextTask:  T-055 (extra-punch classifier) is code-complete + script-validated (13 CONFLICTED→MATCHED on prod
                  read-only) but the user cannot decide whether to deploy without SEEING the change in the UI. Deploy
                  is the only way to show real users — but the emulator can show the new calc in a real UI with ZERO
                  production impact. App is 3-tier (frontend :3000 → backend API :4000 → Firestore); reconciliation
                  data flows through the backend API, so the emulator run needs backend pointed at the emulator too.
    Goal:         Tooling to dump real prod reconciliationRecords (2026-07-01..2026-08-08, read-only) into the
                  Firestore emulator, seed a test MD admin (bcrypt) so the real username/password login works, recalc
                  in-emulator with the T-055 code so status flips are visible, and a run-book. Emulator scope only —
                  no frontend display-layer change, no deploy, no prod writes.
    How-Check:    exportProdForEmulator.ts (prod read-only) + importSeedToEmulator.ts + recalcInEmulator.ts all tsc-
                  clean; emulator UI shows seeded CONFLICTED (before) → MATCHED after recalc; docs/emulator-verify.md
                  reproduces the flow end-to-end.
    Out-of-Scope: frontend display-layer warning (WorkHourComparisonTable "⚠ พบสแกนไม่ตรงงาน"); deploy; any PROD
                  reconciliation re-run/write.
    Relate File:  backend/scripts/exportProdForEmulator.ts · backend/scripts/importSeedToEmulator.ts ·
                  backend/scripts/recalcInEmulator.ts · docs/emulator-verify.md

- [X] T-058 · P1 · depends_on: none · done 2026-08-13 · attempts:1 · tool_calls:~60 (v1 ACCEPTED — PDF 14pp from real P002 data; grouping by category confirmed. Template visual polish → T-061; persistence → T-060; พื้นที่/area field → T-059)
    Title:        ระบบออกเอกสาร Daily Report เป็น PDF (จากรูป+progress ที่บันทึกไว้ในระบบ)
    ContextTask:  LMS บันทึก daily report ทุกวันอยู่แล้ว (รูปหน้างาน + ชื่องาน + progress) ทีมงานต้องนำ
                  ข้อมูลนี้มาจัดเป็นเอกสาร PDF ส่งให้โครงการ ปัจจุบันทำมือ/นอกระบบ มีแอปต้นแบบที่สร้าง
                  PDF ได้แล้วที่ D:\qc-report-new (React+Firebase แยก · Reports.tsx = ตัวสร้าง PDF) →
                  งานนี้คือ port/integrate เข้ามาใน LMS ไม่ใช่เขียนใหม่หมด. daily report มี 2 สถานะ
                  draft/submit — ฟีเจอร์นี้ใช้เฉพาะรูปหน้างาน จึงดึงได้ทั้ง 2 สถานะ.
    Goal:         เพิ่มเมนู sidebar ใหม่ "ออกเอกสาร" ที่:
                  - เห็น/กดได้เฉพาะ role AM, LD · ล็อกตามโครงการที่สังกัด (ถ้าเข้าถึงหลายโครงการ → มี
                    dropdown เลือกโครงการก่อน)
                  - เลือกวันที่จากปฏิทิน โดยเป็นวันในอดีตเสมอ (ออกรายงานของเมื่อวาน/วันก่อนหน้า)
                  - หน้า "รายละเอียดงาน": ตารางงานของวันนั้น (ลำดับ · รายละเอียดงาน · พื้นที่ · %วันนี้ ·
                    %สะสม · หมายเหตุ) จัดเรียง/จัดกลุ่มตามหมวดงาน (categoryName) งานกลุ่มเดียวกันอยู่ด้วยกัน
                  - หน้า "รูปภาพ": ดึงรูปที่ลง daily report ของวันนั้น (ทั้งสถานะ draft + submit) มาให้เลือก
                    → 6 รูป/หน้า · ใต้รูปมี caption = ชื่องาน + progress · เรียงกลุ่มตาม category เหมือนตาราง
                  - ออกเป็นไฟล์ PDF ตาม template ที่โครงการกำหนด (อ้างอิงฟอร์ม ESCENT HATYAI)
    How-Check:    AM/LD login → เปิดเมนู "ออกเอกสาร" → เลือกโครงการ (ถ้ามีหลาย) + วันที่ย้อนหลัง → เห็น
                  รายการงาน + รูปของวันนั้น → เลือกรูป → กดออกเอกสาร → ได้ไฟล์ PDF ที่: หน้ารายละเอียดงาน
                  จัดกลุ่มตามหมวดงานถูกต้อง · หน้ารูป 6 รูป/หน้า พร้อม caption "ชื่องาน + progress" ตรงกับข้อมูล
                  daily report ของวันที่เลือก.
    Out-of-Scope: - หน้า 1 "ทรัพยากรที่ใช้" (สภาพอากาศ + นับเครื่องจักร/เครื่องมือ/แรงงาน) = เฟสถัดไป
                  - เอกสาร Inspection = ticket แยก (รอ approve) — อยู่เมนูเดียวกันแต่คนละงาน
                  - ระบบตั้งค่า/แก้ template เองในแอป = ยังไม่รวม (ใช้ template โครงการที่กำหนดไว้)
    Relate File:  D:\qc-report-new (Reports.tsx = PDF generator ต้นแบบ · watermark.ts · columnData.ts) ·
                  frontend sidebar/Layout · backend daily report data (controllers/dailyReportController.ts) ·
                  backend/src/models/Task.ts (categoryName สำหรับจัดกลุ่ม)

- [ ] T-059 · P2 · depends_on: none
    Title:        เพิ่มฟิลด์ "พื้นที่" (area) ตอนสร้างงาน + แสดงในคอลัมน์พื้นที่ของเอกสาร Daily Report
    ContextTask:  เอกสาร Daily Report (T-058) มีคอลัมน์ "พื้นที่" แต่ v1 เว้นว่างไว้ เพราะระบบยังไม่เก็บ
                  ข้อมูลพื้นที่งาน ต้องเพิ่มการเก็บที่ต้นทาง (ตอนสร้าง/แก้งาน) ก่อน แล้วเอกสารจึงเติมคอลัมน์นี้ได้.
    Goal:         - เพิ่มฟิลด์ area ใน Task model + ฟอร์มสร้าง/แก้งาน (frontend)
                  - buildDailyReportDoc ส่ง area ต่อเข้า entry → dailyReportPdf.ts เติมคอลัมน์ "พื้นที่"
                  - ค่าว่าง = ตั๋วแยก (คงพฤติกรรมเดิมได้)
    How-Check:    สร้างงานพร้อมกรอกพื้นที่ → ออกเอกสาร Daily Report ของวันนั้น → คอลัมน์ "พื้นที่" ในตาราง
                  แสดงค่าที่กรอกไว้ตรงกับงาน.
    Relate File:  backend/src/models/Task.ts · backend/src/api/routes/tasks.routes.ts (buildDailyReportDoc) ·
                  backend/src/services/pdf/dailyReportPdf.ts · frontend งานสร้าง/แก้งาน

- [X] T-060 · P1 · depends_on: T-058 · done 2026-08-13 · attempts:1 · tool_calls:~45 (persist Daily Report: LMS Storage + Firestore dailyReportDocs record per project+date, overwrite-latest; reopen→preselect saved photos + download-original via backend stream. Enabled LMS Storage bucket + Storage emulator for dev. Best-effort persist never blocks download.)
    Title:        บันทึก (persist) เอกสาร Daily Report ที่สร้าง — ไฟล์ PDF + รูปที่เลือก ต่อโครงการ+วันที่
    ContextTask:  T-058 ออก PDF แบบ stateless (สร้างแล้วดาวน์โหลด ไม่บันทึกที่ใด) ผู้ใช้ต้องการให้ระบบจำไว้:
                  (1) ถ้าไฟล์ที่ดาวน์โหลดหาย ให้โหลดซ้ำจากระบบได้ (2) ไม่ใช่ทุกรูปที่ถูกเลือกใส่รายงาน ระบบ
                  ต้องจำว่าเลือกรูปไหนไปบ้าง. Design ล็อกแล้ว: เก็บไฟล์ PDF ลง LMS Storage + Firestore record
                  ต่อ project+date {selectedPhotoIds, pdfPath/url, createdBy, createdAt}; overwrite-latest;
                  เก็บใน LMS project เอง (db) ไม่ใช่ After-Sale.
    Goal:         - POST /daily-report-pdf เขียนไฟล์ PDF ลง LMS Storage + upsert Firestore record (overwrite ล่าสุด)
                  - เปิดวันเดิมซ้ำ → preselect รูปที่บันทึกไว้ + ปุ่ม "ดาวน์โหลดไฟล์เดิม"
    How-Check:    สร้างรายงาน → ปิดหน้า → กลับมาวันเดิม → รูปที่เคยเลือกถูกติ๊กไว้ + ดาวน์โหลดไฟล์เดิมได้
                  โดยไม่ต้อง gen ใหม่.
    Relate File:  backend/src/api/routes/tasks.routes.ts (daily-report-pdf endpoint) · LMS Storage · Firestore (db) ·
                  frontend/src/pages/export-documents/index.tsx · exportDocumentService.ts

- [X] T-064 · P1 · depends_on: T-060 · done 2026-08-14 · attempts:1 · tool_calls:~40 (persist Daily Request PDFs with AUTO-VERSIONING — unlike T-060 overwrite-latest, every generate writes a NEW versioned Storage object daily-requests/{proj}/{date}/{versionId}.pdf (versionId=Date.now()_rand, collision-proof) + appends to Firestore dailyRequestDocs/{proj}__{date}.versions[]; latestPath tracks newest. "ดาวน์โหลดไฟล์เดิม" streams latest without regenerating. Best-effort persist never blocks download. Immutable snapshot per printed doc = integrity guard vs retroactively-editable After-Sale source. Committed bf721db on inspection; user-tested.)
    Title:        บันทึก (persist) เอกสาร Daily Request แบบเก็บทุกเวอร์ชัน (auto-versioning · ไม่ทับของเดิม)
    ContextTask:  T-062/T-063 ออก Daily Request PDF แบบ stateless — gen ใหม่ทุกครั้ง ไม่บันทึกไฟล์. ปัญหา integrity:
                  ถ้า print/ส่งเอกสารไปแล้ว แล้วข้อมูลต้นทาง (After-Sale requests) ถูกแก้ย้อนหลัง → gen ซ้ำได้เอกสาร
                  คนละฉบับ. ผู้ใช้เลือก "แบบ 3" = auto-versioning (เก็บทุกเวอร์ชัน ไม่ทับ) แทน overwrite/prompt.
    Goal:         - POST /daily-request-pdf เขียนไฟล์ PDF เวอร์ชันใหม่ทุกครั้ง + append Firestore record (best-effort)
                  - GET /daily-request-saved (record|null) + GET /daily-request-file (stream latest หรือ versionId ที่ระบุ)
                  - ปุ่ม "ดาวน์โหลดไฟล์เดิม" แสดงเมื่อ saved.hasFile → โหลดเวอร์ชันล่าสุดโดยไม่ gen ใหม่
    How-Check:    gen เอกสารเดิม 2 ครั้ง → มี 2 objects ใน Storage + versionCount=2 + ดาวน์โหลดไฟล์เดิม = bytes ล่าสุด.
    Relate File:  backend/src/services/pdf/dailyRequestStore.ts (NEW) · backend/src/api/routes/tasks.routes.ts ·
                  frontend/src/services/exportDocumentService.ts · frontend/src/pages/export-documents/index.tsx

- [X] T-065 · P1 · depends_on: T-064 · done 2026-08-14 · attempts:1 · tool_calls:~55 (per-project Excel-template fill engine — pilot: Daily Request, .xlsx output. Admin (GOD/MD) uploads one .xlsx per project holding {{token}} placeholders + a single data-marker row; system fills header tokens + expands the marker row into one styled row per work entry via ExcelJS duplicateRow, streams the filled .xlsx. Project with NO template → existing PDF flow untouched (additive, reversible). checkRole(['MD','AM','LD']) guards upload (GOD auto-passes); frontend canManageTemplate mirrors the same roleId set. PDF-via-LibreOffice deferred to phase 2. ⚠️ exceljs ^4.4.0 declared but needs npm install before runtime e2e. Not yet committed — on branch inspection.)
    Title:        เทมเพลต Excel ต่อโครงการ — อัปโหลด .xlsx ที่มี {{token}} แล้วระบบเติมค่า + ขยายแถวข้อมูลอัตโนมัติ (นำร่อง Daily Request)
    ContextTask:  T-058..T-064 ออกเอกสารเป็น PDF จาก template ที่ hardcode. ผู้ใช้อยากให้แต่ละโครงการอัปโหลด
                  ฟอร์ม Excel ของตัวเองได้ แล้วระบบกรอกข้อมูลลงฟอร์มนั้น (คงรูปแบบ/สไตล์เดิมในไฟล์).
    Goal:         - service เติม template: หา marker row ({{detail}}) → duplicateRow ตามจำนวนงาน → เติม {{token}} หัวเอกสาร+แต่ละแถว
                  - 4 endpoints: POST/GET daily-request-template (อัปโหลด/ดูสถานะ · admin) · GET .../sample · POST daily-request-xlsx (ออกไฟล์)
                  - UI DailyRequestTab: panel จัดการเทมเพลต (เฉพาะ GOD/MD) + ปุ่ม "ออกด้วย Template (Excel)" เมื่อมีเทมเพลต · ปุ่ม PDF เดิมไม่เปลี่ยน
    How-Check:    อัปโหลด .xlsx ให้โครงการ → กดออกด้วย Template → ได้ไฟล์ .xlsx ที่เติมค่าครบ + จำนวนแถว = จำนวนงาน. โครงการที่ไม่มีเทมเพลต → เห็นเฉพาะปุ่ม PDF เดิม.
    Relate File:  backend/src/services/pdf/dailyRequestTemplate.ts (NEW) · backend/src/api/routes/tasks.routes.ts ·
                  frontend/src/services/exportDocumentService.ts · frontend/src/pages/export-documents/index.tsx

- [X] T-066 · P1 · depends_on: T-065 · done 2026-08-14 · attempts:1 · tool_calls:~45
    Title:        เมนู "จัดการ Template" แยกออกมา + preview หลังอัปโหลด (นำร่อง Daily Request)
    ContextTask:  T-065 ฝังแผงจัดการเทมเพลตไว้ในแท็บออกเอกสาร (ซ่อนตามสิทธิ์). ผู้ใช้อยากให้เป็นเมนูแยกในแถบซ้าย
                  จัดการเทมเพลตทั้ง Daily Report + Daily Request ในที่เดียว + มี preview ให้ดูหลังอัปโหลด.
    Goal:         - หน้าใหม่ /template-management (เมนู "จัดการ Template" ในแถบซ้าย · GOD/MD/AM/LD)
                  - ย้ายแผงจัดการ Daily Request (อัปโหลด/สถานะ/ตัวอย่าง) จากแท็บออกเอกสารมาที่หน้าใหม่ · คงปุ่ม "ออกด้วย Template (Excel)" ไว้ที่เดิม
                  - preview: backend อ่าน .xlsx → {sheetName,rows} · frontend เรนเดอร์เป็นตาราง HTML (โชว์ {{token}})
                  - Daily Report template = เลื่อนไปทีหลัง (ทับกับ T-061)
    How-Check:    เปิดเมนู "จัดการ Template" → เลือกโครงการ → อัปโหลด .xlsx → เห็นตาราง preview + สถานะไฟล์. แท็บออกเอกสารยังกดออกไฟล์ได้เหมือนเดิม.
    Out-of-Scope: Daily Report template (T-061) · merged-cell rendering แบบเป๊ะ (โชว์เนื้อหาพอ)
    Relate File:  backend/src/services/pdf/dailyRequestTemplate.ts · backend/src/api/routes/tasks.routes.ts ·
                  frontend/src/services/exportDocumentService.ts · frontend/src/pages/template-management/index.tsx (NEW) ·
                  frontend/src/components/layout/Navbar.tsx · frontend/src/pages/export-documents/index.tsx

- [X] T-067 · P1 · depends_on: T-066 · done 2026-08-17 · RE-SCOPED (PDF-only pivot)
    Re-scoped:    2026-08-17 — ผู้ใช้เปลี่ยนแนวทาง: ไม่ซ่อม path Excel (approach B ด้านล่าง) แต่ "ถอด" ออกจาก UI แทน.
                  เอกสารใบแจ้งงาน = PDF อย่างเดียว (1 ปุ่ม). บั๊กฟอร์มเปล่าหายเพราะไม่มีปุ่ม Excel ให้กดแล้ว.
                  ทำจริง: ลบปุ่ม "ออกด้วย Template (Excel)" + wiring ในหน้า export-documents · ซ่อนเมนู "จัดการ Template".
                  backend (engine เติม Excel · dailyRequestTemplate.ts · routes · Firestore documentTemplates · Storage
                  document-templates/) ปล่อย DORMANT ไว้ (ไม่ลบ) — แนวทางชั้น 2 (T-068) จะ reuse ประตู upload + PDF engine.
                  แผน + งานลง .sessions/mece_plan.md (S1 export page · S2 navbar · S3 roadmap). Frontend-only · branch inspection.
    Title:        แก้บั๊ก "ออกด้วย Template" ได้ฟอร์มเปล่า — เติมข้อมูลฟอร์มที่ไม่มี {{token}} (approach B)
    ContextTask:  ฟอร์ม ESCENT (P002) จริงไม่มี {{token}} เลย → fillDailyRequestTemplate หา marker {{detail}} ไม่เจอ →
                  คืนฟอร์มเปล่า. POC เทียบ 2 แบบบนฟอร์มจริง → ผู้ใช้เลือกแบบ B (token-free) เพราะคง merge/เส้น/เลย์เอาต์.
    Goal:         - เพิ่ม path token-free ใน fillDailyRequestTemplate: ตรวจจับตาราง (หัวตารางไทย) → เขียนข้อมูลลงช่องว่างที่ตีเส้นไว้แล้ว
                  - คง merge (B:D รายละเอียด · E:G พื้นที่) + ตำแหน่งท้ายฟอร์ม · overflow → แทรกแถวก่อน footer
                  - path เดิม (มี token) ต้องทำงานเหมือนเดิมเป๊ะ (additive · backward-compatible)
    How-Check:    อัปฟอร์ม ESCENT เดิม (ไม่มี token) → กด "ออกด้วย Template" → ไฟล์ที่ได้มีข้อมูลในตาราง + merge/เส้นครบ + ท้ายฟอร์มอยู่ที่เดิม.
    Out-of-Scope: header/วันที่ substitution บนฟอร์ม token-free (คนละเรื่อง) · preview fidelity (เลื่อน) · IN/OUT scan (park)
    Relate File:  backend/src/services/pdf/dailyRequestTemplate.ts

- [ ] T-068 · P2 · depends_on: T-067
    Title:        Tier-2 self-service form onboarding — upload Excel → ปรับใน canvas → render PDF
    ContextTask:  T-067 ถอด path "เติม Excel" ออกจาก UI (PDF อย่างเดียว). ขั้นต่อไปที่ผู้ใช้อยากได้คือให้แต่ละโครงการ
                  ทำฟอร์มใบแจ้งงานของตัวเองได้ โดยไม่ต้องสร้างจากศูนย์ — อัปโหลด Excel ที่มีอยู่เป็นจุดตั้งต้น.
    Goal:         - reuse ประตู upload เดิม (documentTemplates · Storage document-templates/) เป็นทางเข้า
                  - Excel READER (parse โครงสร้าง 1 ครั้ง → JSON layout → seed canvas) — ไม่ใช้ engine "เติม Excel" เดิม (dormant)
                  - หน้า canvas ให้ผู้ใช้ลาก/แก้ช่อง/หัวตาราง → บันทึก layout ผูกกับโครงการ
                  - render ออกเป็น PDF ผ่าน engine เดิม (dailyRequestPdf.ts) — output คง PDF-only ตาม T-067
    How-Check:    โครงการอัปโหลด Excel → เห็น layout ใน canvas → แก้ → บันทึก → กด "สร้าง PDF" → PDF สะท้อน layout ที่ปรับ.
    Out-of-Scope: การรื้อ engine เติม Excel เดิม (ปล่อย dormant) · pixel-perfect fidelity รอบแรก · IN/OUT scan (park)
    Relate File:  frontend (canvas ใหม่) · frontend/src/pages/template-management · backend upload routes + Storage

- [X] T-069 · P1 · depends_on: T-067 · done 2026-08-17 · attempts:1
    Title:        Configurable Daily Request PDF header + แท็บ "ตั้งค่าเอกสาร" (per-project header config)
    ContextTask:  T-067 ทำ PDF Daily Request จาก engine กลาง (dailyRequestPdf.ts) แต่หัวเอกสารยังขาด logo · "โครงการ
                  <name>" · "ผู้รับจ้าง" · เลขที่เอกสาร ตามฟอร์มจริง (ESCENT HATYAI II). ค่าที่ต่างกันรายโครงการ
                  (Tier 2) ต้องอ่านจาก config ต่อโครงการ ไม่ hard-code.
    Goal:         - collection ใหม่ documentHeaderConfigs (doc id = projectId) เก็บ logo · contractor · docNumberPrefix
                  - dailyRequestPdf.ts วาดหัวเต็ม: logo · โครงการ+ชื่อ (จาก Project doc) · ผู้รับจ้าง · เลขที่ prefix+/..... · วันที่
                  - logo อัป Storage (project-assets/) → ฝัง base64 ตอน render (โหลด bytes เฉพาะ PDF-render path)
                  - แท็บใหม่ "ตั้งค่าเอกสาร" ในหน้าออกเอกสาร (เลือกโครงการ → กรอก → บันทึก) · role AM/LD/MD
    How-Check:    ตั้งค่า header ของโครงการ → สร้าง PDF Daily Request → หัวเอกสารแสดง logo/โครงการ/ผู้รับจ้าง/เลขที่ครบ ·
                  config ว่าง → หัว degrade สวย (ไม่มี logo, projectName จาก Project doc, ไม่มีบรรทัดผู้รับจ้าง, เลขที่ว่าง).
    Out-of-Scope: ตัวนับเลขเอกสารอัตโนมัติ (เว้น /..... เติมมือ) · Tier-2 canvas (T-068) · IN/OUT scan (park)
    Relate File:  backend/src/services/pdf/dailyRequestPdf.ts · backend/src/services/pdf/documentHeaderConfig.ts (new) ·
                  backend/src/api/routes/tasks.routes.ts · frontend/src/services/exportDocumentService.ts ·
                  frontend/src/pages/export-documents/index.tsx

- [X] T-071 · P1 · depends_on: T-069 · done 2026-08-17 · attempts:1 · tool_calls:~35
    Title:        Daily Report PDF letterhead + nested table header + report doc-number config (partial of T-061)
    ContextTask:  T-058 Daily Report PDF ยังไม่มีหัวเอกสาร (มีแค่ <h1> กลางหน้า) · หัวตารางแถวเดียว. ต้องตรงฟอร์ม
                  ESCENT HATYAI: logo มุมซ้าย · โครงการ+ชื่อ · เลขที่/วันที่/Duration มุมขวา · หัวตาราง % ซ้อนชั้น.
    Goal:         - ยืม letterhead จาก dailyRequestPdf.ts มาที่ dailyReportPdf.ts (logo · โครงการ · (DAILY REPORT) ·
                    เลขที่ prefix+/… · วันที่ · Duration ………/………)
                  - หัวตารางซ้อนชั้น: "ดำเนินการได้" (colspan 2) › วันนี้ / สะสม
                  - config: field docNumberPrefixReport แยกจาก docNumberPrefix (request) · logo+ผู้รับจ้างใช้ร่วม
                  - route daily-report-pdf ดึง projectName+config+logo ส่งเข้า render · PUT config รับ field ใหม่
                  - DocSettingsTab เพิ่มช่อง "เลขที่ Daily Report" + relabel ช่องเดิมเป็น "Daily Request"
    How-Check:    render HTML mock → หัวเอกสาร+เลขที่ DRP+Duration+หัวตารางซ้อนชั้นครบ (verified via browser preview) ·
                  tsc backend+frontend 0 error · config ว่าง → degrade (ไม่มี logo, เลขที่ว่าง).
    Out-of-Scope: ตัวนับเลขอัตโนมัติ (เติมมือ) · หน้า template-config เต็ม (ยังเปิดใน T-061) · IN/OUT scan (park)
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts · backend/src/services/pdf/documentHeaderConfig.ts ·
                  backend/src/api/routes/tasks.routes.ts · frontend/src/services/exportDocumentService.ts ·
                  frontend/src/pages/export-documents/index.tsx

- [X] T-072 · P2 · depends_on: T-058 · done 2026-08-17 · attempts:1 · tool_calls:~20
    Title:        Daily Report PDF: flow-fill photo pages + category dividers (save paper)
    ContextTask:  buildPhotoPages rendered 1 page per category (hard page-break between หมวด) → a หมวด with
                  <6 photos still burned a full A4 sheet. User: เปลืองกระดาษ — ไหลต่อเนื่องได้ + เส้นคั่นก่อนหมวดใหม่.
    Goal:         - drop per-category .page + hard page-break → one continuous .photo-section
                  - .cat-divider (border-top = เส้นคั่น + "หมวดงาน: X") before each category (first: no top border)
                  - photos in .photo-row of 2, .photo-item FIXED height 76mm → @page paginates naturally (~6/page)
                  - categories share PAGES but a new category always starts a new row (no cross-category row mixing)
    How-Check:    grep confirms .photo-section/.cat-divider/.photo-row + .photos-grid removed · tsc 0 error ·
                  render mock PDF 12 photos/3 หมวด = 4 pages (old = 5) → flow + paper-saving confirmed.
    Out-of-Scope: per-page running header · divider styling variants · IN/OUT scan (park)
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts

- [X] T-073 · P2 · depends_on: T-058 · done 2026-08-18 · attempts:1 · tool_calls:22
    Note (as-built): the user supplied the paper template image — col1/col2 headers are BOTH
                  "ผู้บันทึก/รายงาน/ผู้รับจ้าง" (differing only by role line: Site Engineer vs Project
                  Engineer), col3 = "รับทราบ / ผู้ควบคุมงาน" with a blank "บริษัท" line (NOT the
                  hard-coded TEAM-CM company name the Goal below guessed — the paper leaves it to sign).
    Follow-up fix (same day, same file): the report PDF page box was 210mm wide (FULL A4 sheet)
                  under 10mm @page margins → the right 20mm of every page spilled onto an extra
                  sheet ("ตกขอบ"). Now @page margin 7.5mm + .page width 195mm / min-height 282mm
                  (mirrors dailyRequestPdf), and `.photo-section` — a body-level block with no width
                  at all — pinned to the same 195mm. Verified: every block 195mm, doc scroll width
                  195mm, zero horizontal overflow, signature block still flush at the sheet bottom.
    Title:        Daily Report PDF: signature footer block (ช่องเซ็นท้ายตาราง)
    ContextTask:  Paper form has a 3-column signature block under the work table. User confirmed
                  wants "ช่องให้เซ็นเหมือนเดิม". Mirror the dailyRequestPdf buildSignatureFooter pattern
                  (dotted line + (name) parens + role + วันที่), adapted to 3 columns for the report.
    Goal:         - buildSignatureFooter(): 3 equal columns — (1) ผู้บันทึก/รายงาน · ผู้รับจ้าง TTS · Site Engineer
                    (2) ผู้บันทึก/รายงาน · ผู้รับจ้าง TTS · Project Engineer (3) รับทราบ · ผู้ควบคุมงาน (TEAM-CM) ·
                    บริษัท ทีม คอนสตรัคชั่น แมเนจเมนท์ จำกัด — each: dotted sign line + (….) + role + วันที่
                  - CSS .rsign-* (own namespace, static form fields, no data source)
                  - insert inside buildWorkTable .page AFTER </table>, margin-top:auto pushes it to the sheet bottom
    How-Check:    grep confirms buildSignatureFooter emits 3 columns + inserted into .page · tsc 0 error ·
                  render mock HTML → 3 signature columns with dotted lines at the bottom of the table page.
    Out-of-Scope: auto-filling signer names from data · เวลาปกติ/OT split (→ T-074) · IN/OUT scan (park)
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts

- [X] T-076 · P1 · depends_on: none · done 2026-08-18 · attempts:1 · tool_calls:~95 · commit 258b503 (branch inspection, not pushed)
    Title:        Inspect: port the inspection-topic CONFIG mechanism from D:\qc-report-new into LMS
    ContextTask:  D:\qc-report-new is the existing standalone React+Firebase app that already
                  generates inspect documents. LMS is absorbing it (see the QC-report memory).
                  This ticket is the FIRST, deliberately small slice: only the CONFIG /
                  settings side — how inspection topics (หัวข้อการตรวจ) are defined and stored —
                  NOT document generation, NOT photo handling.
    Goal:         - read how qc-report-new defines/stores/edits its inspection-topic config
                  - port that mechanism into LMS (adapt to LMS's Firebase + backend, do not
                    copy blindly; LMS already has a documentHeaderConfig pattern to match)
                  - surface it inside the EXISTING /export-documents page, on the "inspect" tab
                  - that tab therefore gains TWO sub-menus: "ตั้งค่าหัวข้อการตรวจ" and "สร้างเอกสาร"
                    (the page was originally issue-documents only, so the inspect tab needs the split)
    Out-of-Scope: document generation / PDF for inspect · photo upload · anything on the AM/LD
                  daily-report tabs · a separate sidebar menu (user rejected that — everything
                  lives inside /export-documents; the old template-management page was deleted
                  for exactly this reason on 2026-08-18)
    How-Check:    open /export-documents → inspect tab shows the two sub-menus; the settings
                  sub-menu can create/edit/list inspection topics and they persist (reload shows
                  them); "สร้างเอกสาร" sub-menu exists and still reaches the existing flow
    Relate File:  frontend/src/pages/export-documents/index.tsx · frontend/src/services/exportDocumentService.ts ·
                  backend/src/api/routes/tasks.routes.ts · backend/src/services/pdf/documentHeaderConfig.ts (pattern to mirror)

- [ ] T-077 · P2 · depends_on: T-076
    Title:        Enforce project scoping on the /export-documents config endpoints (both pairs)
    ContextTask:  Found while scrutinizing T-076 S2. The config routes trust the caller's
                  `projectId` outright: GET/PUT /tasks/daily-request-header-config and
                  GET/PUT /tasks/inspection-topic-config are gated by checkRole(['MD','AM','LD'])
                  only, with no check that the projectId belongs to the caller. The /export-documents
                  UI already limits the picker to the user's projectLocationIds, so normal use is
                  safe — the gap only opens to a crafted API call by an already-authenticated
                  MD/AM/LD user. LOW severity, not externally reachable. User reviewed and agreed
                  to queue rather than widen T-076's scope (2026-08-18).

- [ ] T-078 · P1 · depends_on: T-076 · PARKED 2026-08-19 (awaiting team meeting + user decision)
    Title:        Task creation: add workspace (floor + subworkspace) and an optional inspect link
    Status:       PARKED 2026-08-19 by the user: "มันยากมาก มันจะต้องผ่านการประชุมก่อน ฉันขอเวลาคิดก่อน".
                  Phase 1 + Phase 2 are DONE — .sessions/gather_complete.md and .sessions/mece_plan.md
                  are fully written (7 sections, all serial, stripped-plan-hash 01b49b29) and the
                  skeptical review passed (.sessions/.skeptical_ok verdict: go). Phase 3 NOT started:
                  ZERO lines of T-078 code exist. Resume = re-confirm the plan with the user (M3 user
                  confirm is still unchecked), then run S1. Do not start without that confirm.
    ContextTask:  Inspection topics now exist per project (T-076) but nothing connects them to actual
                  work. The user wants the task-creation dialog to place each job in space and to
                  optionally mark it as needing inspection, so a later slice can produce the
                  inspection document for that job.
    Goal:         In TaskCreateModal, at the task (ชื่องาน) level add: ชั้น/floor (REQUIRED) and
                  subworkspace (optional, e.g. "G/L A-1"), both as autocomplete — values already used
                  in THAT project are offered, and a new value can be typed in (guards against the
                  same floor being spelled three ways). Plus a toggle "ตรวจ inspect?" which, when on,
                  lets the user pick exactly ONE inspection sub-category (หมวดย่อย) from the T-076
                  tree, unfiltered (the user rejected auto-filtering by work order because the names
                  will not match exactly). Shape confirmed by the user as OPTION A (2026-08-18):
                  floor/subworkspace live on the TASK, subtasks are the steps inside it
                  (เข้าแบบ, เทคอนกรีต) and inherit the task's floor; a different floor = a new task.
    Out-of-Scope: the inspection screen/flow itself (next slice) · document generation · changing the
                  subtask shape · backfilling old tasks
    How-Check:    create a task in a non-warehouse project -> ชั้น is required, autocomplete offers
                  previously used floors, subworkspace optional, inspect toggle stores exactly one
                  sub-category id · create a task in โครงการคลังสินค้าและบริการ -> the form is
                  IDENTICAL to today (no floor, no inspect) · an existing task with no floor still
                  opens and saves
    Relate File:  frontend/src/page-components/workspace/components/TaskCreateModal.tsx (zod schema
                  L44, task-level fields) · backend/src/models/Task.ts · backend/src/services/
                  TaskService.ts · backend/src/api/routes/tasks.routes.ts
    Special:      WAREHOUSE EXEMPTION — workspace applies to every project EXCEPT those whose
                  ProjectLocation.department === 'WH', which keep task creation exactly as today.
                  DECIDED BY DEPARTMENT, NOT BY NAME (user, 2026-08-19: "เรากรองที่ department ดีไหม
                  เพราะทั้ง 2 โครงการมี department เหมือนกัน department = WH"). This SUPERSEDES the
                  earlier name-matching plan (pages/workspace/index.tsx:1364
                  projectName.includes('คลังสินค้าและบริการ')) and covers both คลังสินค้าและบริการ and
                  บริการลูกค้า. department is verified real and round-trips: ProjectLocation.ts L9/L29/L45
                  + converter L63/L95, frontend projectService.ts:24. Centralise the test in ONE helper.
    Must-Pair:    MOVING THE FLOOR OUT OF THE TASK NAME AND FIXING TASK IDENTITY MUST SHIP TOGETHER.
                  Today the floor is typed INTO the task name ("งานเสาชั้น 12" vs "งานเสาชั้น 13"), so
                  TaskService.createTask deciding new-vs-existing by taskName alone
                  (TaskService.ts:104 where('taskName','==',...).limit(1)) is CORRECT today — there is
                  no bug in production. The moment the floor becomes its own field the names collapse to
                  "งานเสา" for every floor, and that same query would match the other floor's task and
                  append into it (subtasks at L269-272, and the merge write at L252 would overwrite the
                  existing doc's floor). So identity must widen to (taskName + floor + subWorkspace) in
                  the SAME release. Do it in CODE after fetching the by-name candidates — NOT as extra
                  .where() equality filters: legacy docs have no `floor` field at all, so
                  where('floor','==',null) would never match them and every append to a legacy task
                  would create a duplicate. The frontend live duplicate warning
                  (TaskCreateModal taskNameDuplicate L354-363) must widen the same way.
    Also-Decided: (2026-08-19) inspect link is EDITABLE later in the task edit dialog · floor and
                  subWorkspace are DISPLAYED on the task card · legacy tasks are NOT forced to fill
                  floor when edited (required on create only) · the copy-task button
                  (handleDuplicateTask L446-466) must CARRY the source task's inspect sub-category but
                  leave floor/subWorkspace BLANK — copying งานเสา exists precisely to place it on a
                  new floor (user: "combobox จะไม่ใช่การ clone ชั้นมา แต่มันต้อง clone หัวข้อ inspect").
    Storage:      new collection taskWorkspaceConfigs, one doc per project
                  { projectId, floors: string[], subWorkspaces: string[], updatedAt, updatedBy }.
                  The BACKEND appends new values on task create; the client never writes the list.
                  Rejected: deriving DISTINCT floors from tasks (Firestore has no DISTINCT → full
                  per-project scan on every dialog open) · storing the arrays on the ProjectLocation
                  doc (the project edit form could overwrite and wipe them).

- [ ] T-079 · P2 · depends_on: none
    Title:        spawn_gate/execution_schedule only recognise "main context" — plans saying "MAIN" are
                  wrongly treated as delegated
    ContextTask:  Hit live while closing T-076: marking S5 [X] was BLOCKED with "no MAIN marker" even
                  though both the section header ([Cycle 4 · serial · MAIN]) and the Model: line
                  ("model_medium + MAIN marker") declared main context. Root cause:
                  scripts/execution_schedule.py MAIN_MARKERS = ("main context",) — one exact phrase,
                  while the plan template and schema examples use "MAIN" and "MAIN marker".
    Goal:         Make the marker vocabulary agree in ONE place: either widen MAIN_MARKERS to accept
                  the forms the template actually produces (bare "main", "main marker", "· main]") or
                  fix the template/schema to emit only "main context" — and add a self-test case for
                  whichever form is chosen, since the current self-test only covers "MAIN context".
    Out-of-Scope: changing the T-328 tier-binding rule itself
    How-Check:    a plan section written with "[Cycle N · serial · MAIN]" + "Model: model_medium +
                  MAIN marker" can be marked [X] without a spawn proof and without an env override ·
                  `python scripts/spawn_gate.py --self-test` passes
    Relate File:  scripts/execution_schedule.py (MAIN_MARKERS L45, is_delegated L99) ·
                  scripts/spawn_gate.py (decide L127) · docs/session_templates/mece_plan_schema.md
                  Note the AM rule: AM is project-scoped, NOT a superuser — only MD/GOD bypass
                  scoping (see the am-role-not-superuser memory). So AM must be scoped here too.
    Goal:         - decide the scope source (req.user projectLocationIds vs a project-membership read)
                  - reject a projectId outside the caller's scope on all FOUR handlers, MD/GOD exempt
                  - keep the existing { success, error } 4xx envelope; no behaviour change for the UI
    Out-of-Scope: any other /tasks route · role-model changes · frontend changes (the picker
                  already scopes correctly)
    How-Check:    as an AM of project A, a direct PUT with project B's projectId returns 403;
                  the same AM saving project A's config still succeeds from the UI; MD unaffected
    Relate File:  backend/src/api/routes/tasks.routes.ts (L1804-1863 header config · L1880-1940
                  inspection topic config) · backend/src/api/middleware/auth.ts
- [ ] T-074 · P2 · depends_on: T-073 · PARKED (needs design decision)
    Title:        Daily Report PDF: split work rows into เวลาปกติ / ล่วงเวลา(โอที) sections
    ContextTask:  Paper form divides work rows into normal-time vs OT sections. BLOCKER: the Daily Report
                  source (dailyReports collectionGroup) logs one cumulative %progress per task/day with NO
                  time/period field — unlike Daily Request, which reads per-worker shiftTimes (otMorning/day/
                  otNoon/otEvening) from the After-Sale `requests` collectionGroup. Progress can't be split by time.
    Goal:         DECIDE first (with user): (A) cross-reference each report task's request shiftTimes on that date
                  → tag task ล่วงเวลา if any OT slot, else เวลาปกติ (data-driven; needs a rule for tasks worked in
                  BOTH normal+OT) · OR (B) static section headers เวลาปกติ (real rows) + ล่วงเวลา (blank hand-fill).
    How-Check:    (pending design decision — do not start until resolved)
    Out-of-Scope: adding an OT flag to the task/subtask data model (separate task if chosen)
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts · backend/src/api/routes/tasks.routes.ts (buildDailyReportDoc)

- [X] T-075 · P2 · depends_on: T-072 · done 2026-08-18 · attempts:1 · tool_calls:19
    As-built: mechanism A (thead repeat). `buildPhotoPages` now returns a one-column
    `<table class="photo-section">` — thead = "โครงการ … · วันที่ … · เลขที่ <prefix>/……"
    (segment dropped when no prefix), each divider/photo-row = its own `<tr>` (divider row
    gets `class="cat-row"`). New CSS `.photo-head` / `.photo-cell`; break-avoidance moved
    to the rows (`tbody tr` + `tr.cat-row`) because inside a table Chrome applies it at row
    level; first-divider selector re-pointed from `>` child to `tbody tr:first-child`; dead
    `.photo-section-sub` removed. Verified at PDF level (screen DOM cannot prove thead
    repeat): 20 photos → 5 pages, pages 2-5 all start with the same glyph run, 6 photos/page
    unchanged, doc-number 1 hit/page with prefix and 0 without.
    Title:        Daily Report PDF: repeat an identifying header on EVERY photo page
    ContextTask:  User (2026-08-18): if the printed report gets separated, a loose photo page has no
                  way to tell which project/date it belongs to. Today the identifying line
                  (`.photo-section-sub`, e.g. "P002 · 11 ส.ค. 2569") is emitted ONCE at the top of the
                  photo section; T-072 made photos flow continuously so the browser decides where the
                  page breaks land — meaning no per-page header exists on photo pages 2..N.
    Goal:         - every printed photo page carries project + date (+ title) at its top
                  - keep T-072's continuous photo flow (do NOT go back to one page per category)
    How-Check:    render a mock with enough photos to span ≥3 photo pages → each photo page shows the
                  project + date line at its top; photo count per page unchanged vs before (no paper lost
                  beyond the header height).
    Out-of-Scope: re-designing the letterhead · per-page footers/page numbers (separate ask if wanted)
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts
    DECIDED (user, 2026-08-18): scope = PHOTO PAGES ONLY (the work-table page already has the full
                  letterhead). Header content = the compact one-liner PLUS the document number —
                  i.e. project + date + "เลขที่ HYI2-TTS-TCM-DRP/……" on one short line, styled like the
                  existing `.photo-section-sub`, not the full letterhead (photo space matters more).
    Options (decide before Phase 2):
                  A) `<thead>` repeat — wrap the photo flow in a table whose `<thead>` holds the header;
                     Chrome repeats a thead on every printed page automatically. Keeps all layout in the
                     existing HTML/CSS (Thai fonts already embedded). Cost: photo rows become table rows.
                  B) puppeteer `displayHeaderFooter` + `headerTemplate` in page.pdf() — header on EVERY
                     page (work table page too), drawn in the page margin box. Least HTML change, but the
                     margin box needs reserved top margin and renders outside the embedded-font context.

- [ ] T-061 · P2 · depends_on: T-058
    Title:        หน้ากำหนด/ปรับ template เอกสาร Daily Report + จูน visual ให้ตรง ESCENT HATYAI
    ContextTask:  T-058 v1 ออก PDF ได้ แต่ template ยังไม่ pixel-perfect ตามฟอร์ม ESCENT HATYAI ผู้ใช้อยากมี
                  หน้าเฉพาะสำหรับกำหนด/แก้ template เอง แทน hardcode ใน dailyReportPdf.ts.
    Goal:         - จูน HTML/CSS ใน dailyReportPdf.ts ให้ตรง ESCENT HATYAI (spacing/หัวตาราง/ฟอนต์/โลโก้)
                  - หน้าตั้งค่า template (เลือก/แก้ header, โลโก้, คอลัมน์, จำนวนรูป/หน้า) ที่ผูกกับโครงการ
    How-Check:    เปิดหน้าตั้งค่า template → แก้ค่า → ออกเอกสาร → PDF สะท้อนค่าที่ตั้ง + หน้าตาตรงฟอร์มอ้างอิง.
    Relate File:  backend/src/services/pdf/dailyReportPdf.ts · frontend (หน้า template config ใหม่) ·
                  ESCENT HATYAI DAILY REPORT.pdf (ฟอร์มอ้างอิง)

- [ ] T-080 · P1 · depends_on: none
    Title:        Settle who may open /export-documents — role matrix + route guard (PRE-PUSH BLOCKER)
    ContextTask:  Found while closing T-076. The PAGE is gated `<ProtectedRoute requiredRoles={['AM','LD']}>`
                  but the four config API endpoints allow MD/AM/LD, so MD is blocked at the door while the
                  backend would accept them. User (2026-08-19): "หน้า export เราให้สิทธิ์ AM LD MD เข้าได้ไม่ใช่หรอ
                  (อันนี้ต้องปรับอีก เพราะว่ายังไม่แน่ชัดว่าใครจะสามารถเข้าได้บ้าง)" — i.e. the intended list is
                  AM/LD/MD, but the FULL list is not decided yet.
    Goal:         - decide the final role list for the page AND per sub-tab (settings vs create-document
                    may differ) with the user
                  - make the page guard and the API checkRole lists agree — one source, no drift
                  - cover every /export-documents endpoint, not just the inspection pair
    How-Check:    log in as each role in the agreed list → page opens AND save works; log in as a role
                  outside the list → cannot open the page AND the API rejects a direct call.
    Out-of-Scope: project-level scoping of the config endpoints (that is T-077) · any document-generation
                  behaviour.
    Relate File:  frontend/src/pages/export-documents/index.tsx (ProtectedRoute requiredRoles) ·
                  backend/src/api/routes/tasks.routes.ts (checkRole on the config endpoints)
    PUSH GATE:    USER INSTRUCTION 2026-08-19 — this MUST be verified BEFORE any push of the `inspection`
                  work to `main`. main = production deploy. Do not push with the role matrix unresolved.
