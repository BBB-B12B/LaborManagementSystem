# MECE Plan - ตรวจสอบและแก้ไขการบันทึก Dailyreport งานย่อย (Subtasks)

## 1. Goal & Context
ตรวจสอบและยืนยันการบันทึกข้อมูลรายงานประจำวัน (Daily Report) ในระบบหลังบ้านเมื่อมีการใช้ฟังก์ชัน subtasks
- ยืนยันว่าข้อมูลแรงงาน (labor) และข้อมูลการลา (leave) บันทึกลงฟิลด์ `labor` และ `leave` ที่ระดับบนสุด (top-level) ของเอกสารรายงานประจำวัน ไม่ใช่บันทึกแค่ในประวัติการแก้ไข (`editHistory`) เท่านั้น
- แก้ไขจุดบกพร่อง (Bug) ใน backend `TaskService.submitDailyReport` ที่การตั้งค่า `leaveType` (Paid/Unpaid) ถูกทำหลังจากโคลนข้อมูล ทำให้ไม่ได้ถูกบันทึกลงในเอกสารจริง

## 2. Proposed Changes
### Backend
#### [MODIFY] [TaskService.ts](file:///d:/Labor%20Management%20System/backend/src/services/TaskService.ts)
- เปลี่ยนแปลงการตั้งค่า `leaveType` ในส่วน Enforce leaveType logic จากเดิมที่ทำผ่าน `reportData.leave` ให้ทำผ่าน `finalReportData.leave` เพื่อให้ข้อมูลที่มีการ map ค่าถูกนำไปเซฟลงใน payload จริงที่เขียนลง Firestore

## 3. Definition of Done (DoD)
- [ ] มีการอัปเกรดโค้ดใน `TaskService.ts` ให้ใช้ `finalReportData.leave` ในการตั้งค่า `leaveType`
- [ ] มีการรันคอมไพล์โค้ดหลังบ้าน (`npm run type-check`) สำเร็จ
- [ ] เขียนสคริปต์จำลองเพื่อทดสอบการเรียกใช้งาน `submitDailyReport` และตรวจสอบโครงสร้างข้อมูลใน `afterSaleDb` ว่ามี `labor` และ `leave` อยู่ในระดับบนสุดของเอกสารอย่างถูกต้อง
- [ ] ซิงก์ดัชนีสัญลักษณ์และอัปเดตไฟล์ `docs/master_roadmap.md` และ `knowledge/error_index.md`

## 4. Estimation
- ความเสี่ยง: ต่ำ (เนื่องจากเป็นการปรับแก้ logic เล็กน้อยในส่วนงานย่อย)
- ระยะเวลาดำเนินการ: 10 นาที
