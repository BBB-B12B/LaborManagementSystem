# Master Implementation Protocol (Implement.md)

**ไฟล์สั่งการหลักสำหรับการพัฒนาโปรเจกต์** (Master Control File for the Entire Project)
ไฟล์นี้คือกฎเหล็กและคู่มือการปฏิบัติงานสำหรับ Project "Labor Management System" โดยเฉพาะ

---

## 1. กฎเหล็กของการทำงาน (Rules of Engagement)
1.  **ภาษาที่ใช้ (Strictly Thai)**:
    *   **ต้องใช้ภาษาไทยเป็นหลัก 100%** ในการอธิบายความคิด, ตอบคำถาม, และเขียนสรุปงาน
    *   *ข้อยกเว้นเดียว*: อนุญาตให้ใช้ภาษาอังกฤษสำหรับศัพท์เทคนิค (Technical Terms) เฉพาะคำ noun หรือ proper noun เพื่อความชัดเจน เช่น `Endpoint`, `Component`, `Function`, `Variable Name`
    *   **ตัวอย่าง**: "ผมตรวจสอบ `Logic` ในการคำนวณ `Wage` แล้วครับ พบว่าถูกต้อง" (ห้ามพูดว่า "I checked the logic...")

2.  **การแก้ไขเอกสาร (Documentation Integrity)**:
    *   **ห้ามลบข้อมูลเก่า**: ให้ใช้วิธี Mark as Done หรือ เปลี่ยน Status
    *   **ต้องอัพเดต Speckit ทั้ง 4 ไฟล์**: ทุกครั้งที่มีการเปลี่ยนแปลง Code ที่สำคัญ
    *   **Speckit คือตัวแทนของ Code**: เอกสารต้องตรงกับ Code เสมอ (Single Source of Truth)

---

## 2. ขั้นตอนการปฏิบัติงานมาตรฐาน (Standard Operating Procedure)

ไม่ว่าจะงานเล็กหรือใหญ่ ให้ทำตาม Loop นี้เสมอ:

### Step 2.1: โหลดข้อมูล (Context Loading)
อ่านไฟล์เหล่านี้เสมอ เพื่อให้เห็นภาพรวมทั้งโปรเจกต์ (Full Project Visibility):
1.  **`@[Speckit/Infrastructure.md]`**: 
    *   เช็ค Tech Stack: เราใช้ Next.js 14, Express, Firebase, AWS S3
    *   เช็ค Structure: Model อยู่ที่ `backend/src/models` (มี 19 models), Route อยู่ที่ `api/routes` (มี 14 files)
2.  **`@[Speckit/Spec.md]`**: 
    *   ดู Feature ID (F-001 ถึง F-008) 
    *   เช็คให้แน่ใจว่างานที่ทำ อยู่ใน Feature ไหน
3.  **`@[Speckit/Task.md]`**: 
    *   ดูประวัติงาน (Phase 1-10 เสร็จแล้ว)
    *   ดูงานปัจจุบัน (Phase 11-12) ว่าต้องทำอะไรต่อ
4.  **`@[Speckit/Traceability.md]`**: 
    *   เช็คความเชื่อมโยง เช่น `DailyReport` เชื่อมกับ `FileAttachment` และ `EditHistory`

### Step 2.2: วิเคราะห์และแผนงาน (Analysis & Planning)
*   **วิเคราะห์**: ตีโจทย์ให้แตกว่ากระทบ module ไหนบ้าง (Backend/Frontend)
*   **วางแผน**: เขียนแผนเป็นข้อๆ (Step 1, 2, 3)

### Step 2.3: ลงมือทำ (Execution)
*   เขียนโค้ดตามมาตรฐานที่วางไว้
*   **Run Project**: ใช้ `docker-compose up` เป็นมาตรฐาน
*   **Frontend**: ใช้ MUI v5, React Hook Form, Zustand
*   **Backend**: ใช้ Service Pattern, Repository Pattern (Firestore), Express Validator

### Step 2.4: ตรวจสอบและบันทึกผล (Verification & Logging)
*   รัน Test หรือลองเล่นหน้าเว็บ
*   **เช็ค Console**: ต้องไม่มี Error ตัวแดง (เช่น Hydration Mismatch, 400 Bad Request)
*   **ถ้าเจอ Error**:
    *   **หยุด!** อย่าเพิ่งแก้แบบมั่วๆ
    *   วิเคราะห์หาสาเหตุ
    *   **บันทึก Error ลงใน `Speckit/Task.md` ทันที** (Format: `T-xxx-Ex-x`)
    *   แก้เสร็จแล้วค่อยไปต่อ

### Step 2.5: อัพเดตเอกสาร (Documentation Update)
ก่อนส่งงาน ต้องเช็ค 4 จุด:
3.  **งานเสร็จ?** -> อัพเดต `Task.md` (เปลี่ยน Status)
4.  **เพิ่มความสัมพันธ์?** -> อัพเดต `Traceability.md`

### Step 2.6: ข้อควรระวังสำหรับ Emulator (Emulator Quirks)
*   **Token Signature**: ใน Development Mode ที่ใช้ Firebase Emulator Backend จะข้ามการตรวจสอบ Signature (Manual Decode) เพื่อป้องกันปัญหา Issuer Mismatch 
*   **ห้ามใช้ Logic นี้บน Production**: ต้องเช็ค `process.env.NODE_ENV === 'development'` เสมอ

---

## 3. รูปแบบการบันทึก Error (Error Logging Protocol)

ต้องบันทึกทุกครั้งที่มีปัญหา เพื่อให้คนอื่นมาทำต่อแแล้วรู้ประวัติ

**Format**: `T-xxx-Ex-x`
(`Ex` = Error ครั้งที่, `x` = ความพยายามครั้งที่)

### ตัวอย่าง:
**Task T-170 (Wage Calc)**
*   **T-170-E1-1**:
    *   **สาเหตุ**: `DailyReport` บางอันไม่มี `totalWage` ทำให้ sum แล้วเป็น NaN
    *   **แนวทางแก้ไข**: เพิ่ม condition เช็ค `report.totalWage || 0`

---

## 4. UI/UX Design Rules
*   **Navigation**:
    *   Do NOT place "Back" buttons inside the page content (e.g., above title).
    *   ALWAYS rely on the **Global Header Back Button** (Top-Left) for navigation.
    *   Exception: Modals/Drawers should have their own Close/Cancel buttons.
