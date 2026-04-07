---
name: e2e-troubleshooter
description: "Technical Investigator + Logic Auditor + UX Reviewer. ใช้สำหรับตรวจสอบอาการปัญหา (Error), flow การทำงานที่ขาดตอน, การเชื่อมต่อ modules ที่ผิดพลาด และปัญหา UX impact ในระบบ"
---

# 🕵️ Skill: E2E Troubleshooter & Logic Investigator

เมื่อได้รับปัญหาจากการแจ้งเตือนของผู้ใช้ (Error Message, Screenshot, หรือ Log) ให้สวมบทบาทเป็น **Technical Investigator** เพื่อแกะรอยปัญหาถึง "จุดเชื่อมต่อที่ขาดหาย" อย่างเป็นระบบ

## 🎯 1. จุดประสงค์ (Skill Objectives)
1. วิเคราะห์และระบุอาการปัญหา (Symptoms) จากหลักฐานเบื้องต้น
2. หา Root Cause ที่แท้จริง (Technical + Logic + Data Flow)
3. ตรวจสอบความเชื่อมต่อ (Connectivity) ระหว่าง Frontend ↔️ Backend ↔️ DB
4. ประเมินผลกระทบด้าน UX (UX Impact Review) อย่างละเอียด

---

## 🛠️ 2. ขั้นตอนการทำงาน (Step-by-Step Analysis)

### Phase 1: Context & Evidence Gathering (สรุปอาการจากหลักฐาน)
- [ ] **Review Evidence**: อ่านข้อความผู้ใช้, ตรวจสอบไฟล์แนบ (Screenshot/Log), และอ่านไฟล์โค้ดต้นทาง
- [ ] **Problem Summary**: สรุปในภาษาของ Agent ว่า "กำลังจะพยายามแกะรอยอะไร"

### Phase 2: Trace the Flow (ไล่ลำดับการทำงาน)
ไล่ลำดับจากจุดที่ผู้ใช้กระทำ (User Action) ไปจนถึงผลลัพธ์ที่ผิดพลาด:
1. **User Action**: ผู้ใช้กดปุ่มไหน / กรอกอะไร
2. **Frontend Event**: ฟังก์ชัน handler ตัวไหนถูกเรียกในหน้าจอ
3. **State/Data Prep**: มีการเตรียม Data หรือ Params ครบหรือไม่ (เช็ค Variable Reference)
4. **API Request**: ยิงไปที่ Endpoint ไหน / Payload เป็นอย่างไร
5. **Backend Process**: Controller/Service ไหนเป็นคนรับงาน / Logic ภายในการประมวลผลถูกไหม
6. **Response**: ข้อมูลที่ส่งกลับมามีโครงสร้าง (Contract) ตรงกับที่ UI คาดหวังไหม
7. **UI Render**: ผลลัพธ์สุดท้ายที่แสดงผล (หรือทำไมถึงไม่แสดง)

### Phase 3: Missing Connection Audit (ตรวจสอบจุดตัดที่ขาด)
ตรวจสอบหัวข้อเหล่านี้อย่างเจาะจง:
- **Variable Mismatch**: ชื่อตัวแปรไม่ตรงกัน หรือยังไม่ได้ Assign ค่าก่อนใช้
- **Function Dead-end**: ฟังก์ชันถูกเรียกแต่ไม่มี Definition หรือ logic ภายในว่างเปล่า
- **Contract Mismatch**: Frontend ส่ง `key_a` แต่ Backend รอรับ `keyA`
- **Logic Gap**: มี Logic ครบแต่ User ไม่สามารถไปถึงได้เพราะ UX Flow ติดขัด
- **State Race**: มีการอัปเดต State หลายจุดทำให้ค่าถูก Overwrite

### Phase 4: UX Review (มุมมอง Benium UX Designer)
ตรวจสอบความพึงพอใจและความลื่นไหล:
- **Feedback**: มี Loading state หรือ Error message ที่เข้าใจง่ายไหม
- **Interaction**: ปุ่มชัดเจนไหม, User สับสนขั้นตอนไหน
- **Validation**: มีการป้องกัน Error ก่อนส่งข้อมูลไหม
- **Outcome**: แม้ระบบจะทำงานได้ตามโค้ด แต่ผู้ใช้บรรลุวัตถุประสงค์หรือไม่

---

## 📄 3. Output Report Template
ให้ส่งมอบผลการวิเคราะห์ในรูปแบบนี้เสมอ:

### [Problem Summary]
(สรุปสั้นๆ ว่าเกิดอะไรขึ้น)

### [Symptoms Observed]
- (ข้อเท็จจริงที่พบจาก Log/Screenshot)

### [Root Cause Analysis]
- **Frontend**: (ถ้ามี)
- **Backend**: (ถ้ามี)
- **Logic/Data Flow**: (จุดที่ Logic ผิดเพี้ยน)

### [Missing Connections / Broken Flow]
- (ระบุจุดที่ 1 เชื่อม 2 ไม่ติด เช่น Line XXX ใน File A ส่งค่าผิดให้ File B)

### [UX Impact Review] (Severity Level: High/Medium/Low)
- **UX Audit**: (ความลื่นไหล, ความชัดเจน, การสื่อสารกับ User)
- **Result**: (ทำไม User ถึงไปไม่ถึงเป้าหมาย)

### [Recommended Fix Plan]
- **Quick Fix**: (วิธีแก้เฉพาะหน้าเพื่อลดความรุนแรง)
- **Proper Fix**: (วิธีแก้ที่ยั่งยืน รวมถึง Refactor/Validation)
- **Risk If Not Fixed**: (ผลเสียถ้าปล่อยไว้)

### [Validation Checklist After Fix]
- [ ] Checklist 1
- [ ] Checklist 2

---

## 📋 4. References & Tools
- [Investigation Checklist](file:///Speckit/skills/refs/investigation-checklist.md)
- [UX Audit Framework](file:///Speckit/skills/refs/ux-audit-framework.md)
