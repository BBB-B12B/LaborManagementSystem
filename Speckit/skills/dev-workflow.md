---
name: dev-workflow
description: "8-Step Development Workflow (Step 2.1 - 2.8). ใช้สำหรับควบคุมลำดับขั้นตอนการพัฒนา ตั้งแต่โหลดบริบท วางแผน ลงมือทำ ตรวจสอบ จนถึงปิดงาน"
---

# 🚀 Skill: Development Workflow Orchestrator

ให้ปฏิบัติงานตาม **8 ขั้นตอนนี้ (Step 1 - 8)** เรียงตามลำดับ (Sequential) **ห้ามข้ามขั้นตอนและห้ามทำพร้อมกัน (Parallel) โดยเด็ดขาด** ความถูกต้องของ Process สำคัญเท่ากับความถูกต้องของ Code

## 🌊 Flow Steps

### Step 1: Context Loading & Rehydration (โหลดบริบท)
ทุกครั้งที่เริ่ม Session หรือรับงานให้ทำความเข้าใจ Context จาก 4 ไฟล์หลัก:
1.  **`Speckit/instruction.md`**: Tech Stack & Standards
2.  **`Speckit/spec.md`**: User Flow & Features [F-XXX]
3.  **`Speckit/traceability.md`**: Relationship & Impact
4.  **`Speckit/task.md`**: Progress & Roadmap [T-XXX]

### Step 2: Analysis & Planning (วิเคราะห์และวางแผน)
- เปรียบเทียบ User Request กับ System Spec
- **The CRUD Heuristic (กฎการตรวจสอบความครบถ้วน):**
    > หากมีการเพิ่ม Field ใน Data Model ต้องวางแผนแก้ไขให้ครบ 3 จุด:
    > 1. **Create Form** (e.g., Add Dialog) -> Update Input
    > 2. **Read/View** (e.g., Detail Page) -> Update Display
    > 3. **Update Form** (e.g., Edit Dialog) -> Update Input

### Step 3: Ephemeral Planning (วางแผนเบื้องต้น) [PLANNING MODE]
1.  **Create `implementation_plan.md`**:
    - สร้างไฟล์แผนงานชั่วคราวเพื่อระบุ Goal, Proposed Changes, และ Verification Plan
    - ใช้ notify_user เพื่อขอ Approval จาก User เสมอ

### Step 4: Permanent Documentation (บันทึกข้อมูลถาวร) [CRITICAL GATEKEEPER]
**Pre-condition**: implementation_plan.md ต้องได้รับการอนุมัติ (Approved) แล้วเท่านั้น
ก่อนเขียนโค้ดบรรทัดแรก ต้องอัปเดตเอกสารหลักให้ครบถ้วนตามแผนที่วางไว้:
1.  **Update `task.md`**: ค้นหา Page Section ที่เกี่ยวข้อง (Page-Based Grouping)
2.  **Update `traceability.md`**: เพิ่ม Row ใหม่หากมี Feature หรือ Key Variable ใหม่
3.  **Update `spec.md`**: ปรับปรุง User Flow และ Description ของ Feature [F-XXX]

### Step 5: Implementation (ลงมือทำ) [EXECUTION MODE]
- **GATEKEEPER CHECK**: [ ] Plan Approved? [ ] task.md Updated? [ ] traceability.md Updated? [ ] spec.md Updated?
- เขียน Code ตามแผนที่วางไว้ใน Step 3 ทำทีละ Sub-task เพื่อลดความซับซ้อน

### Step 6: Verification (ตรวจสอบ) [VERIFICATION MODE]
- รัน Validate Command: npm run lint หรือ Build Check
- ตรวจสอบตาม "Confirmed Behavior" ที่ระบุใน Task

### Step 7: Closure & Handoff (จบงาน)
- [x] Mark Task as Completed ใน task.md
- ลบ Temporary Logs หรือ Comments ที่ไม่จำเป็นตอน Production

### Step 8: Documentation Summary (สรุปการอัปเดตเอกสาร) [MANDATORY FINAL CHECK]
ในขั้นตอนสุดท้ายของการตอบโต้ (Final Response) **คุณต้อง** สรุปการเปลี่ยนแปลงของเอกสาร 4 ฉบับหลักเสมอ (instruction.md, spec.md, task.md, traceability.md) หรือระบุ "No Change" หากไม่มีการแก้ไขจริง
