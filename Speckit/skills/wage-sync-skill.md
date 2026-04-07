# Project Skill: Data Synchronization (Daily Report & ScanData)

## Skill Description
ความยืดหยุ่นในการบูรณาการข้อมูลจากระบบสแกนนิ้ว (ScanData) และระบบบันทึกหน้างาน (Daily Report) เพื่อใช้ในการคำนวณค่าแรงที่แม่นยำ

## Core Principles
1. **Match Key:** ใช้ `dailyContractorId` + `workDate` เป็นกุญแจสำคัญในการเชื่อมโยงข้อมูล
2. **Hours Consistency:** ชั่วโมงงานปกติ (`regularHours`) ต้องถูกตรวจสอบเทียบกับนโยบายบริษัท (เช่น ไม่เกิน 8 ชั่วโมง) และไม่ขัดแย้งกับข้อมูลใน ScanData
3. **Discrepancy Resolution:** ในกรณีที่ "ข้อมูลไม่ตรงกัน" ระบบจะต้อง Flag เป็น `discrepancy` เพื่อให้เจ้าหน้าที่ตรวจสอบ
4. **Auditability:** ทุกขั้นตอนต้องถูกบันทึกไว้ใน `editHistory` เพื่อให้ข้อมูลมีความน่าเชื่อถือสูงสุด (Traceability)

## How to use this skill
- เมื่อมีการแก้ไข `workerEntries` ระบบจะต้องทำการ **Recalculate** ยอดรวม (`totalNetHours`) ในระดับบุคคลทันที
- ข้อมูลสรุปใน `DailyReportSummary` จะต้องถูกบวกลบแบบ **Atomic (Increment)** เพื่อป้องกันปัญหาข้อมูลเพี้ยนในระยะยาว
- เมื่อข้อมูลได้รับการยืนยัน (Submitted/Verified) ระบบจะนำชั่วโมงไปประกอบกับตารางค่าแรง (Wage Rates) เพื่อออกสลิปเงินเดือนอัตโนมัติ
