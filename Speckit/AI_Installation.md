# Speckit AI Installation & Development Guide (Thai Version)

เอกสารนี้ใช้เป็น **Master Template** และคู่มือแนะนำสำหรับการเริ่มต้น (Initialize) และพัฒนาโปรเจกต์ตาม **Speckit Concept**

เมื่อเริ่มโปรเจกต์ใหม่หรือโมดูลใหม่ภายใต้ Speckit, AI Agent จะต้องปฏิบัติตามกระบวนการ **Chain of Thought (CoT)** ที่ระบุไว้ด้านล่าง เพื่อสร้างไฟล์เอกสารที่จำเป็น ได้แก่: `Infrastructure.md`, `Spec.md`, `Task.md`, และ `Traceability.md`

---

## 🧠 กระบวนการ Chain of Thought (CoT)

**Principle**: "คิดก่อนทำ วางแผนก่อนโค้ด ตรวจสอบความเชื่อมโยงก่อนปิดงาน"

1.  **Analyze (Infarstructure & Spec)**:
    *   วิเคราะห์และกำหนด Technology Stack และโครงสร้างไฟล์ (Project Structure)
    *   แตก User Request ออกเป็น Features ย่อยๆ (F-xxx)
    *   กำหนด User Flow และ Architecture สำหรับแต่ละ Feature
    *   ระบุตัวแปร (Variables) และ Entities ที่เกี่ยวข้องทั้งหมด

2.  **Plan (Task)**:
    *   แปลง Features ให้เป็น Tasks ที่สามารถลงมือทำได้จริง (T-xxx)
    *   กำหนด Goal (เป้าหมาย) และ Principle (หลักการ) ของแต่ละ Task
    *   กำหนดจุดตรวจสอบความสำเร็จ (Confirmation / Definition of Done)

3.  **Map (Traceability)**:
    *   ตรวจสอบว่าทุก Feature ถูกเชื่อมโยงกับ Task ครบถ้วน
    *   ตรวจสอบว่าตัวแปรสำคัญ (Variable keys) มีการเชื่อมโยงกับ Code Component/Entity
    *   จัดทำ RTM (Requirements Traceability Matrix) เพื่อเชื่อมโยง F-xxx -> T-xxx -> File/Path

4.  **Execute (Implementation)**:
    *   (ขั้นตอนในอนาคต) ลงมือเขียนโค้ดตาม Task ที่วางแผนไว้

---

## 1. Infrastructure.md Template

**วัตถุประสงค์**: เพื่อระบุรากฐานทางเทคนิค (Technical Foundation) ของโปรเจกต์

```markdown
# Infrastructure

## 1. Tech Stack (Framework & Libraries)
*   **Core Framework**: [เช่น React, Node.js, Python/Django]
*   **Language**: [เช่น TypeScript, Python 3.9+]
*   **Key Libraries** (ไลบรารีสำคัญ):
    *   [ชื่อ Lib]: [ใช้เพื่ออะไร]
    *   [ชื่อ Lib]: [ใช้เพื่ออะไร]
*   **Database**: [เช่น PostgreSQL, MongoDB]
*   **Tools**: [เช่น Docker, Webpack]

## 2. Folder Structure
โครงสร้างไดเรกทอรีของโปรเจกต์:
/root
  /src
    /components
    /modules
    /utils
  /Speckit (Documentation & Traceability)
  ...
```

---

## 2. Spec.md Template

**วัตถุประสงค์**: เพื่อลงรายละเอียด Functional Requirements ทั้งหมด โดยระบุ ID ที่ไม่ซ้ำกัน

```markdown
# Specification (Spec.md)

## Feature List

### Feature ID: [F-xxx] (เช่น F-001)
**Name**: [ชื่อ Feature]

#### 1. User Flow
1.  [ขั้นตอนที่ 1]
2.  [ขั้นตอนที่ 2]
3.  [ขั้นตอนที่ 3]

#### 2. Architecture & Logic
*   **Description**: [คำอธิบายการทำงานภายในของ Feature]
*   **Diagram/Flow**: [คำอธิบาย Flow แบบ text หรือ Diagram]

#### 3. Related Variables & Entities (ตัวแปรและ Entity ที่เกี่ยวข้อง)
*   `[Variable Name]`: [คำอธิบาย/Type]
*   `[Entity Name]`: [คำอธิบาย]
```

---

## 3. Task.md Template

**วัตถุประสงค์**: แผนการพัฒนาแบบเป็นขั้นเป็นตอน (Step-by-step) ที่อ้างอิงมาจาก Spec

```markdown
# Development Tasks (Task.md)

## Task List

### Task ID: [T-xxx] (เช่น T-001)
**Feature Ref**: [อ้างอิง F-xxx]

#### 1. Concept / Goal (เป้าหมาย)
*   [งานนี้ทำเพื่ออะไร? เป้าหมายคืออะไร?]

#### 2. Principle (หลักการ)
*   [หลักการออกแบบหรือข้อควรระวัง เช่น "Keep it D.R.Y", "รองรับ Mobile"]

#### 3. Implementation Details (รายละเอียดการดำเนินงาน)
*   [ขั้นตอนการเขียนโค้ดอย่างละเอียด]
*   [API endpoint ที่ต้องสร้าง/แก้ไข]
*   [UI components ที่ต้องสร้าง]

#### 4. Confirmation (จุดตรวจสอบว่าเสร็จแล้ว / Definition of Done)
*   [ ] [สิ่งที่ต้องเช็ค 1: เช่น Unit tests ผ่าน]
*   [ ] [สิ่งที่ต้องเช็ค 2: เช่น UI ตรงตาม Design]
*   [ ] [สิ่งที่ต้องเช็ค 3: เช่น API ตอบกลับ 200 OK]

#### 5. Subtasks (งานย่อย - ถ้ามี)
*   [งานย่อย 1]
*   [งานย่อย 2]
```

---

## 4. Traceability.md Template

**วัตถุประสงค์**: เพื่อเชื่อมโยง Requirements, Code, และ Variables เข้าด้วยกัน เพื่อให้ง่ายต่อการบำรุงรักษาและวิเคราะห์ผลกระทบ (Impact Analysis) เมื่อมีการแก้ไข

```markdown
# Traceability Matrix

## 1. RTM (Requirements Traceability Matrix)
ตาราง Mapping ระหว่าง Feature, Task และไฟล์ Code

| Feature ID | Task ID | File / Path | Description |
| :--- | :--- | :--- | :--- |
| **F-001** | **T-001** | `src/auth/Login.tsx` | Login UI Component |
| **F-001** | **T-002** | `src/api/authController.ts` | Backend Auth Logic |

## 2. Data & Component Traceability
ตาราง Mapping ระหว่าง Entity, Variable ในโค้ด และ Component

| Entity / Concept | Variable Name | Component / File | Usage Type |
| :--- | :--- | :--- | :--- |
| User Profile | `user.email` | `UserProfile.tsx` | Display (แสดงผล) |
| User Profile | `user.email` | `UpdateProfile.ts` | Source of Truth (แก้ไขค่า) |
```
