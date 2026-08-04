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
