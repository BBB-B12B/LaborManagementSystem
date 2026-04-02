---
name: issue-management
description: "Error Handling, Logging, and Incident Resolution. ใช้สำหรับจัดการกับ Error ที่เกิดขึ้นระหว่างการพัฒนา (Internal) และปัญหาเร่งด่วนในระดับ Production"
---

# 🛡️ Skill: Issue & Incident Management

ใช้สำหรับบันทึกปัญหาที่พบบริหว่างทำงาน เพื่อรักษามาตรฐาน Traceability และความรวดเร็วในการแก้ปัญหา

## 🔴 1. Internal Error Logging (บันทึกระหว่างพัฒนา)

หากพบ Error ระหว่างทำงาน ให้บันทึกแบบ **Nested Log** ภายใต้ Task นั้นๆ ใน task.md เสมอ:

### Format: T-XXX-EX-Y
- **`T-XXX` (Task ID)**: รหัสงานหลักที่ปัญหานั้นเกิดขึ้น
- **`EX` (Error Index)**: ลำดับของ "ปัญหา" (Problem) ที่พบ (รันเลข E1, E2, ... ตามลำดับการเจอ)
- **`Y` (Attempt Count)**: จำนวนครั้งที่พยายามแก้ไข (เริ่มที่ 1)

### Rule: No New Task for Bug
- **ห้ามสร้าง Task ใหม่** ([T-New]) สำหรับการแก้ไขปัญหา (Bug/Fix) ในทุกกรณี ยกเว้นมันคือ Feature ใหม่ 100%
- ให้บันทึกเป็น **Error Log (Nested List)** ใต้ Task เดิมที่เป็นเจ้าของ Feature นั้นๆ ทันที

---

## 🌩️ 2. Incident Resolution (Production Issues)

สำหรับปัญหาเร่งด่วน หรือ Critical Bug ที่ต้องสรุปผลทันที:

### Section A: Symptom (อาการ)
*   **What**: เกิดอะไรขึ้น Error คืออะไร (แนบ Log/Screenshot)
*   **Where**: Environment ไหน (Dev/Prod/Staging)

### Section B: Analysis (วิเคราะห์)
*   **Root Cause**: สาเหตุทางเทคนิค (เช่น Database connection timeout)
*   **Impact**: มีผลกระทบต่อกี่ User หรือกี่ Module

### Section C: Solution (การแก้ไข)
*   **Fix Steps**: ลำดับการแก้ไข (1. Restart service -> 2. Patch code)
*   **Verification**: วิธีตรวจสอบว่าปัญหาจะไม่กลับมาอีกครั้ง
